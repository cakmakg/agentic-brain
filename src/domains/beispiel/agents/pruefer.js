// ── domains/beispiel/agents/pruefer.js ───────────────────────────────────
// Das QA-Tor. Der zweite produzierende Spoke — und der Grund, warum der
// Schutzschalter (BREMSE 3) überhaupt auslösen KANN: erst eine Ablehnung
// schickt den Bearbeiter ein zweites Mal los, erst dann wächst
// `revisionCount` im Live-Pfad. Ein Schutzschalter, der nie auslöst, ist
// unbelegt.
//
// STRIKTE TRENNUNG VON PRODUZENT UND PRÜFER. Sagst du demselben Modell im
// selben Aufruf „schreib und kritisiere dich selbst", findet es seine eigene
// Arbeit gut. Deshalb: eigener Knoten, eigener Prompt, und über
// `modelFor("pruefer")` die Möglichkeit eines eigenen (billigeren) Modells.
//
// Er schreibt `istFreigegeben` — Reducer `lastWins`, NICHT `keepIfFilled`.
// `null` ist hier eine Aussage („ungeprüft") und muss geschrieben werden
// dürfen; ein Reducer mit Leer-Schutz könnte ein Urteil nie zurücknehmen.

import { z } from "zod";

import { llmStructured } from "../../../kernel/llm/adapter.js";
import { modelFor } from "../../../kernel/config/env.js";
import { prompts } from "../prompts.js";

// Der Ausgabevertrag des Prüfers. Strukturierte Ausgabe statt Freitext: ein
// „ja, aber…" in Prosa ist keine Entscheidung, auf die eine Bremse routen kann.
export const prueferSchema = z.object({
  istFreigegeben: z.boolean(),
  gruende: z.string(),
});

// ── Die Regel des Mock-Prüfers ───────────────────────────────────────────
// Im Mock-Modus entscheidet keine Zufallszahl, sondern eine REGEL. Nur so
// lassen sich die Erwartungen im Golden-Datensatz aus der Regel ABLEITEN
// statt aus einem beobachteten Lauf zu übernehmen.
//
//   Aufgabe trägt „nachbessern"   → erster Durchgang abgelehnt, danach frei
//   Aufgabe trägt „unzureichend"  → IMMER abgelehnt, fährt BREMSE 3 an
//   sonst                          → freigegeben
//
// Die beiden Marker sind bewusst harmlos gewählt: kein Guardrail-Muster greift
// auf sie. Der Bedrohungswert bleibt 0, und der Fall misst das QA-Tor statt
// versehentlich den Filter. Und sie sind bewusst UMLAUTFREI — der Datensatz
// schreibt „Teamkapazitaet" statt „Teamkapazität"; ein Marker mit Umlaut
// würde dort still nie greifen.
export const EINMAL_ABLEHNEN = /nachbessern/i;
export const IMMER_ABLEHNEN = /unzureichend/i;

export function mockUrteil(state) {
  if (IMMER_ABLEHNEN.test(state.task)) {
    return {
      istFreigegeben: false,
      gruende: "mock: dauerhaft unzureichend",
    };
  }
  // Beim ERSTEN Prüfen steht `revisionCount` auf 1 — der Bearbeiter hat genau
  // einmal geliefert. Ab dem zweiten Durchgang gibt der Prüfer frei.
  if (EINMAL_ABLEHNEN.test(state.task) && state.revisionCount < 2) {
    return {
      istFreigegeben: false,
      gruende: "mock: erste Fassung, Überarbeitung angefordert",
    };
  }
  return { istFreigegeben: true, gruende: "mock: Ausgabevertrag erfüllt" };
}

export async function prueferNode(state) {
  const urteil = await llmStructured(
    prueferSchema,
    prompts.pruefer.system,
    prompts.pruefer.user(state),
    () => mockUrteil(state),
    modelFor("pruefer"),
  );

  return {
    istFreigegeben: urteil.istFreigegeben,
    gruende: urteil.gruende,
    nextAgent: "orchestrator", // jeder Spoke kehrt zum Hub zurück
    log: [
      urteil.istFreigegeben
        ? "🔍 pruefer: freigegeben"
        : `🔍 pruefer: abgelehnt (${urteil.gruende})`,
    ],
  };
}
