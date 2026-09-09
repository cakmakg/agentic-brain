// ── domains/beispiel/agents/ablage.js ────────────────────────────────────
// Legt das Artefakt in den dauerhaften Speicher. KEIN LLM (deterministisch).
//
// Entscheidend: liefert `abgelegt: true` → BREMSE 2 greift → HITL. Die Aktion
// „ablegen" ist also das Signal, das „zur menschlichen Genehmigung bringen"
// auslöst. Das ist der Grund, warum dieser Knoten überhaupt existiert und
// nicht Teil des Bearbeiters ist.
//
// Der Speicher liegt hinter der Dauerhaftigkeits-Schicht des Kerns, nicht im
// Arbeitsspeicher: die Mechanik gehört in den Kern, die Bedeutung — WAS ein
// Artefakt dieser Domäne ist — hierher.

import { createArtifactStore } from "../../../kernel/persistence/store.js";

const store = createArtifactStore("artefakte-beispiel"); // threadId -> { task, inhalt, status }

export function ablageNode(state) {
  store.set(state.threadId, {
    task: state.task,
    inhalt: state.ergebnis,
    status: "AWAITING_APPROVAL",
  });
  return {
    abgelegt: true,
    nextAgent: "orchestrator",
    log: ["💾 ablage: Artefakt gespeichert (AWAITING_APPROVAL)"],
  };
}

// Fallback nach einem Reload: geht ein SSE-Event verloren, holt sich der Client
// den Inhalt von hier.
export function getArtifact(threadId) {
  return store.get(threadId) || null;
}

export function markZugestellt(threadId) {
  // patch statt Mutieren des gelesenen Objekts: eine Änderung, die nur im
  // Arbeitsspeicher landete, wäre nach einem Neustart weg — und niemandem
  // fiele es auf, weil derselbe Prozess sie noch sähe.
  store.patch(threadId, { status: "ZUGESTELLT" });
}
