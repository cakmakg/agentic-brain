// ── domains/besprechung/agents/entwurf.js ────────────────────────────────
// Legt den Ticketentwurf in den dauerhaften Speicher. KEIN LLM
// (deterministisch).
//
// Entscheidend: liefert `entworfen: true` → BREMSE 2 greift → HITL. Die
// Handlung „entwerfen" ist also das Signal, das „zur menschlichen Genehmigung
// bringen" auslöst. Das ist der Grund, warum dieser Knoten überhaupt existiert
// und nicht Teil des Extrahierers ist: ein Produzent, der zugleich das
// HITL-Signal setzt, kann es unbemerkt beim Überarbeiten setzen.
//
// Der Speicher liegt hinter der Dauerhaftigkeits-Schicht des Kerns, nicht im
// Arbeitsspeicher: die Mechanik gehört in den Kern, die Bedeutung — WAS ein
// Entwurf dieser Domäne ist — hierher.

import { createArtifactStore } from "../../../kernel/persistence/store.js";

const store = createArtifactStore("artefakte-besprechung");

// Der Titel des Tickets. Deterministisch aus dem ersten Aktionspunkt, gekappt:
// ein Titel, der aus einem Modellaufruf käme, machte diesen Knoten
// nichtdeterministisch — und damit die Sequenzen der Schicht A wertlos.
export function titelAus(aktionspunkte) {
  const erster = aktionspunkte?.[0]?.text ?? "";
  return erster.slice(0, 120);
}

export function entwurfNode(state) {
  store.set(state.threadId, {
    task: state.task,
    notizId: state.notizId,
    titel: titelAus(state.aktionspunkte),
    aktionspunkte: state.aktionspunkte,
    status: "AWAITING_APPROVAL",
  });

  return {
    entworfen: true,
    nextAgent: "orchestrator",
    log: [
      `📝 entwurf: Ticketentwurf gespeichert (AWAITING_APPROVAL, Herkunft: ${state.notizId || "keine"})`,
    ],
  };
}

// Fallback nach einem Reload: geht ein SSE-Event verloren, holt sich der
// Client den Inhalt von hier.
export function getEntwurf(threadId) {
  return store.get(threadId) || null;
}

export function markZugestellt(threadId) {
  // patch statt Mutieren des gelesenen Objekts: eine Änderung, die nur im
  // Arbeitsspeicher landete, wäre nach einem Neustart weg — und niemandem
  // fiele es auf, weil derselbe Prozess sie noch sähe.
  store.patch(threadId, { status: "ZUGESTELLT" });
}
