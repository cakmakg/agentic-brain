// ── domains/besprechung/agents/extrahierer.js ────────────────────────────
// Der produzierende Agent dieser Domäne: aus einer Besprechungsnotiz werden
// Aktionspunkte. Er ist der einzige Knoten hier, der etwas erzeugt — der
// Prüfer urteilt, der Entwurf legt ab, der Ticketdienst reiht ein.
//
// Er ERHÖHT `revisionCount` (liefert bei jedem Aufruf +1). Der
// Akkumulator-Reducer im Kern summiert; BREMSE 3 fängt das Limit ab.
//
// Und er setzt `istFreigegeben` bei jeder neuen Fassung auf `null` zurück.
// Diese eine Zeile ist die Falle, die Etappe 1 in `beispiel` gekostet hat:
// bleibt das Feld auf `false`, greift die Ablehnungs-Bremse sofort wieder und
// der Produzent ruft sich selbst auf, bis der Schutzschalter kommt. Genau
// dafür trägt das Feld den Reducer `lastWins` — `keepIfFilled` könnte dieses
// `null` nicht schreiben.

import { z } from "zod";

import { llmStructured } from "../../../kernel/llm/adapter.js";
import { modelFor } from "../../../kernel/config/env.js";
import { prompts } from "../prompts.js";
import { UNBESETZT } from "../vertrag.js";

// Der Ausgabevertrag des Produzenten. Strukturiert statt Freitext: eine Liste
// in Prosa lässt sich weder prüfen noch in ein Ticket überführen.
export const extrahiererSchema = z.object({
  aktionspunkte: z.array(
    z.object({
      text: z.string(),
      verantwortlich: z.string(),
    }),
  ),
  notizId: z.string(),
});

// ── Die Herkunft der Notiz ───────────────────────────────────────────────
// Ein Ticket ohne Beleg ist eine Behauptung (Ontologie: `Ticket verweist_auf
// Notiz`). Bis der Retrieval-Knoten existiert — er ist an einen Auslöser
// gebunden, `docs/roadmap.md` §5, Etappe 6 —, kommt die Kennung aus der
// Aufgabe selbst, nach diesem ausdrücklichen Muster.
//
// Findet sich keine, bleibt `notizId` leer, und der Validierer von
// TICKET_ANLEGEN lehnt die Aktion ab. Fail-closed bis in die Aktionsfläche:
// lieber kein Ticket als eines ohne Herkunft.
export const NOTIZ_MUSTER = /\bnotiz:([a-z0-9-]+)/i;

// ── Die Regeln des Mock-Produzenten ──────────────────────────────────────
// Im Mock-Modus entscheidet keine Zufallszahl, sondern eine REGEL — nur so
// lassen sich die Erwartungen im Golden-Datensatz ABLEITEN statt aus einem
// beobachteten Lauf zu übernehmen.
//
//   Notiz trägt „ergebnislos"   → leere Liste, der Ablauf endet ohne Ticket
//   Notiz trägt „nachbessern"   → erste Fassung ohne Verantwortliche, dann mit
//   Notiz trägt „unzureichend"  → IMMER ohne Verantwortliche, fährt BREMSE 3 an
//   sonst                        → vollständige Liste
//
// Die Marker sind umlautfrei und harmlos gewählt: kein Guardrail-Muster greift
// auf sie, der Bedrohungswert bleibt 0. Ein Marker mit Umlaut würde im
// Datensatz still nie greifen, weil der dort umlautfrei schreibt.
export const OHNE_AKTIONSPUNKTE = /ergebnislos/i;
export const EINMAL_UNBESETZT = /nachbessern/i;
export const IMMER_UNBESETZT = /unzureichend/i;

export function mockExtraktion(state) {
  const notizId = NOTIZ_MUSTER.exec(state.task)?.[1] ?? "";

  if (OHNE_AKTIONSPUNKTE.test(state.task)) {
    return { aktionspunkte: [], notizId };
  }

  // Beim ERSTEN Aufruf steht `revisionCount` auf 0 — der Zähler wächst erst
  // durch die Rückgabe dieses Knotens.
  const unbesetzt =
    IMMER_UNBESETZT.test(state.task) ||
    (EINMAL_UNBESETZT.test(state.task) && state.revisionCount < 1);

  const verantwortlich = unbesetzt ? UNBESETZT : "team-technik";

  return {
    aktionspunkte: [
      {
        text: `Offenen Punkt aus der Besprechung klaeren: ${state.task.slice(0, 60)}`,
        verantwortlich,
      },
      {
        text: "Ergebnis der Besprechung im Ticketsystem festhalten",
        verantwortlich,
      },
    ],
    notizId,
  };
}

export async function extrahiererNode(state) {
  const ausgabe = await llmStructured(
    extrahiererSchema,
    prompts.extrahierer.system,
    prompts.extrahierer.user(state),
    () => mockExtraktion(state),
    modelFor("extrahierer"),
  );

  return {
    aktionspunkte: ausgabe.aktionspunkte,
    notizId: ausgabe.notizId,
    // Eine NEUE Fassung ist ungeprüft. Siehe Kopf dieser Datei.
    istFreigegeben: null,
    revisionCount: 1, // der Akkumulator-Reducer addiert +1 → Schutzschalter
    nextAgent: "orchestrator", // jeder Spoke kehrt zum Hub zurück
    log: [
      `⚙️ extrahierer: ${ausgabe.aktionspunkte.length} Aktionspunkt(e) (Durchgang ${state.revisionCount + 1})`,
    ],
  };
}
