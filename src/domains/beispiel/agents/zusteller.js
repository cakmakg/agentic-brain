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

//
// Die Risikoklasse steht im Update (Etappe 4c), damit sie als Zahl in der
// Knotenzeile des Traces landet — nicht nur in der Queue. Sie entscheidet
// nichts (A5).

import { klassifiziere } from "../../../kernel/policy/engine.js";
import { enqueueAction, risikoklassen } from "../actions.js";
import { markZugestellt } from "./ablage.js";

const AKTION = "NOTIFY"; // muss auf der Whitelist stehen, sonst lehnt die Queue ab

export async function zustellerNode(state) {
  // KEIN direktes fetch — nur in die Queue schreiben.
  // `await` seit ADR-0020: die Einreihung ist asynchron. `beispiel` bringt
  // KEINE Befugnis-Politik mit — sie hat keinen Leseweg (ADR-0004) —, also
  // ändert sich hier nur, dass gewartet wird.
  await enqueueAction({
    threadId: state.threadId,
    actionType: AKTION,
    payload: { text: `Aufgabe abgeschlossen: ${state.task}` },
  });
  markZugestellt(state.threadId);

  return {
    zugestellt: true,
    risikoklasse: klassifiziere({ actionType: AKTION, risikoklassen }),
    nextAgent: "END",
    log: [
      "📡 zusteller: Aktion in die Queue gelegt (der Worker validiert und führt aus)",
    ],
  };
}
