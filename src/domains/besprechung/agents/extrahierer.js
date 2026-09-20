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
import { suche } from "../../../kernel/retrieval/suche.js";
import { prompts } from "../prompts.js";
import { UNBESETZT } from "../vertrag.js";
import { holeLeseweg, merkeBeleg } from "../leseweg.js";

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
// Notiz`). Das Muster sagt, WELCHE Notiz gemeint ist — es ist die Auswahl des
// Fragenden, nicht die Quelle des Inhalts.
//
// SEIT T1 (ADR-0019) BEANTWORTET ES NICHT MEHR DIE FRAGE, OB SIE GELESEN
// WERDEN DARF. Davor war es beides: die Kennung kam aus der Aufgabe und der
// Inhalt kam nie — der Agent schrieb über eine Notiz, die er nie gesehen hatte
// und niemand ihm freigegeben hatte. Jetzt entscheidet der gefilterte Leseweg,
// und die Aufgabe wählt nur aus.
//
// Findet sich kein Muster, bleibt `notizId` leer, der Leseweg wird NICHT
// befragt, und der Validierer von TICKET_ANLEGEN lehnt die Aktion später ab.
// Fail-closed bis in die Aktionsfläche: lieber kein Ticket als eines ohne
// Herkunft. (Der Fall ist AI-2 im Golden-Datensatz.)
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

// Kein Beleg, kein Entwurf. Der Lauf endet über BREMSE 5 mit END, und zwar
// OHNE dass ein Modell gefragt wurde: fail-closed vor den Kosten.
//
// Der Grund wird mitgeschrieben, weil „nicht sichtbar" und „Principal nicht
// auflösbar" zwei verschiedene Ereignisse sind. Ohne diesen Unterschied sieht
// eine Störung der Identität aus wie eine korrekte Verweigerung (ADR-0008).
function ohneBeleg(state, gewaehlt, grund) {
  return {
    aktionspunkte: [],
    notizId: "",
    istFreigegeben: null,
    revisionCount: 1,
    nextAgent: "orchestrator",
    log: [
      grund
        ? `⛔ extrahierer: leeres Ergebnis (${grund}) → kein Entwurf`
        : `⛔ extrahierer: notiz:${gewaehlt} ist für diesen Principal nicht sichtbar → kein Entwurf`,
    ],
  };
}

export async function extrahiererNode(state) {
  const gewaehlt = NOTIZ_MUSTER.exec(state.task)?.[1] ?? "";

  // ── Die Naht (ADR-0019, T1) ────────────────────────────────────────────
  // Gelesen wird über `suche` und mit dem Principal DES LAUFS. Was dieser
  // Principal nicht sehen darf, kommt hier nicht an — der Filter läuft in der
  // Abfrage, nicht danach (ADR-0008).
  let notiz = null;
  if (gewaehlt) {
    // GEZIELT, nicht nach Relevanz: die Aufgabe nennt die Notiz, also wird
    // genau sie abgerufen. Käme sie über die Relevanzsuche, entschiede der
    // Ähnlichkeitswert darüber, ob eine berechtigte Notiz „sichtbar" ist —
    // beim Hash-Embedding also der Zufall (ADR-0007).
    const { treffer, grund } = await suche({
      store: holeLeseweg(),
      principal: state.principal,
      dokumentId: gewaehlt,
    });

    // Der Beleg wird gemerkt, BEVOR entschieden wird — auch ein Lauf, der
    // nichts bekommt, hat gelesen, und genau das geht in den Nenner von 3.13.
    merkeBeleg(state.threadId, treffer);

    if (treffer.length === 0) return ohneBeleg(state, gewaehlt, grund);

    notiz = { id: gewaehlt, text: treffer.map((t) => t.text).join("\n\n") };
  }

  const ausgabe = await llmStructured(
    extrahiererSchema,
    prompts.extrahierer.system,
    prompts.extrahierer.user(state, notiz),
    () => mockExtraktion(state),
    modelFor("extrahierer"),
  );

  return {
    aktionspunkte: ausgabe.aktionspunkte,
    // DIE HERKUNFT KOMMT AUS DEM LESEWEG, NICHT AUS DER ANTWORT DES MODELLS.
    // Vorher stand hier `ausgabe.notizId`: ein Modell, das eine andere Kennung
    // zurückgibt, hätte ein Ticket auf eine Notiz zeigen lassen, die der
    // Fragende nie sehen durfte. Geprüft wird, was gelesen wurde.
    notizId: notiz?.id ?? "",
    // Eine NEUE Fassung ist ungeprüft. Siehe Kopf dieser Datei.
    istFreigegeben: null,
    revisionCount: 1, // der Akkumulator-Reducer addiert +1 → Schutzschalter
    nextAgent: "orchestrator", // jeder Spoke kehrt zum Hub zurück
    log: [
      `⚙️ extrahierer: ${ausgabe.aktionspunkte.length} Aktionspunkt(e) aus ${
        notiz ? `notiz:${notiz.id}` : "der Aufgabe (ohne Beleg)"
      } (Durchgang ${state.revisionCount + 1})`,
    ],
  };
}
