// ── bin/demo.js ──────────────────────────────────────────────────────────
// Zeigt den kompletten Ablauf ohne HTTP in einem einzigen Befehl: npm run demo
//
//   guardrail → bearbeiter → ablage → (HITL HÄLT AN) → Genehmigung → zusteller → END
//
// Das ist der schnellste Weg, das System zu VERSTEHEN: schau der Konsole zu und
// sieh, was jeder Knoten tut. Ohne ANTHROPIC_API_KEY läuft es im Mock-Modus
// vollständig durch — kostenlos und deterministisch.

import crypto from "node:crypto";

import { getRunner } from "../kernel/registry.js";
import { agentEventBus } from "../kernel/governance/eventBus.js";
import "../domains/beispiel/domain.js";
import { getArtifact } from "../domains/beispiel/agents/ablage.js";

const { startWorkflow, resolveApproval } = getRunner("beispiel");
const threadId = crypto.randomUUID();

// Statt SSE: direkt am Event-Bus lauschen und auf die Konsole schreiben.
agentEventBus.on(threadId, (ev) => {
  if (ev.type === "agent_log") console.log("   " + ev.line);
  if (ev.type === "workflow_complete")
    console.log(`\n=== workflow_complete: ${ev.status} ===\n`);
});

console.log("\n▶  Workflow startet...\n");
const { interrupted } = await startWorkflow({
  task: "Eine kurze Zusammenfassung der offenen Punkte.",
  threadId,
});

if (interrupted) {
  console.log(
    "⏸  Der Graph HÄLT bei human_approval (interruptBefore). Artefakt:",
  );
  console.log("   status:", getArtifact(threadId)?.status);
  console.log("\n▶  Der Mensch GENEHMIGT → zusteller läuft...\n");
  await resolveApproval({ threadId, approved: true });
  console.log("✓ Endgültiger Artefaktstatus:", getArtifact(threadId)?.status);
}
process.exit(0);
