// ── domains/beispiel/agents/zusteller.js ─────────────────────────────────
// Der terminale Knoten. Er läuft NUR nach ausdrücklicher menschlicher
// Freigabe — die fail-closed-Kante im Kern sorgt dafür.
//
// Und hier steht das Kernprinzip des MOAT:
//
//   AGENTEN RUFEN NIEMALS DIREKT EINE EXTERNE API AUF.
//
// Der Zusteller SCHREIBT nur in die ActionQueue. Den echten externen Aufruf
// führt ein separater Worker aus — nach eigener Validierung.
//
// Gründerlektion: Ein gekaperter oder halluzinierender Agent kann weder Daten
// abfließen lassen noch spammen — er kann nur Aktionen in die Queue legen, die
// auf einer Whitelist stehen und schemabegrenzt sind.

import { enqueueAction } from "../actions.js";
import { markZugestellt } from "./ablage.js";

export function zustellerNode(state) {
  // KEIN direktes fetch — nur in die Queue schreiben.
  enqueueAction({
    threadId: state.threadId,
    actionType: "NOTIFY", // muss auf der Whitelist stehen, sonst lehnt die Queue ab
    payload: { text: `Aufgabe abgeschlossen: ${state.task}` },
  });
  markZugestellt(state.threadId);

  return {
    zugestellt: true,
    nextAgent: "END",
    log: [
      "📡 zusteller: Aktion in die Queue gelegt (der Worker validiert und führt aus)",
    ],
  };
}
