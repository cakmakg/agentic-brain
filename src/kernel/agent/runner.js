// ── kernel/agent/runner.js ───────────────────────────────────────────────
// Die Schicht, die den Graphen ausführt. Drei Verantwortungen:
//   1) Streamen und bei jedem Knotenübergang ein SSE-Event senden.
//   2) Je Lauf einen Trace schreiben — der Bus zeigt an und vergisst,
//      der Trace misst und bleibt.
//   3) Die HITL-Brücke: hält der Graph bei human_approval, wird abgebrochen;
//      kommt die Genehmigung, geht es mit derselben thread_id vom Checkpoint WEITER.
//
// Gründerlektion (HITL): Das ist eine Zustandsmaschine, die ZWISCHEN ZWEI
// HTTP-Anfragen lebt. Die erste startet den Workflow und hält bei "__interrupt__".
// Die zweite (die Genehmigung) aktualisiert denselben Checkpoint und setzt fort.
// Das Geheimnis ist: DIESELBE thread_id.

import { buildGraph, HUMAN_NODE } from "./build.js";
import { emitToThread, scheduleBufferGc } from "../governance/eventBus.js";
import { startTrace, resumeTrace } from "../governance/trace.js";

export function createRunner(domain) {
  const app = buildGraph(domain);

  // Ein Knotenübergang: erst messen, dann anzeigen.
  const uebergang = (trace, threadId, step) => {
    for (const [node, update] of Object.entries(step)) {
      trace.node(node, update);
      (update.log || []).forEach((line) =>
        emitToThread(threadId, { type: "agent_log", node, line }),
      );
      emitToThread(threadId, { type: "agent_active", node });
    }
  };

  // Startet einen Workflow. Läuft bis human_approval und hält dort an.
  async function startWorkflow({ task, threadId }) {
    const config = { configurable: { thread_id: threadId } };
    const trace = startTrace({ runId: threadId, task });
    let interrupted = false;

    // stream: nach jedem fertigen Knoten kommt ein "update".
    for await (const step of await app.stream({ task, threadId }, config)) {
      uebergang(trace, threadId, step);
    }

    // Hat er angehalten? Den State prüfen.
    const snap = await app.getState(config);
    if (snap.next && snap.next.includes(HUMAN_NODE)) {
      interrupted = true;
      trace.pause("AWAITING_APPROVAL");
      emitToThread(threadId, {
        type: "workflow_complete",
        status: "AWAITING_APPROVAL",
      });
    } else {
      trace.end("DONE");
      emitToThread(threadId, { type: "workflow_complete", status: "DONE" });
    }
    scheduleBufferGc(threadId);
    return { interrupted };
  }

  // Wendet die HITL-Entscheidung an und setzt fort.
  async function resolveApproval({ threadId, approved }) {
    const config = { configurable: { thread_id: threadId } };
    // Dieselbe run_id, dieselbe Trace-Datei: die menschliche Entscheidung ist
    // eine eigene Zeile und damit nachträglich prüfbar.
    const trace = resumeTrace({ runId: threadId, humanApproval: approved });

    // Die menschliche Entscheidung in den Checkpoint schreiben.
    await app.updateState(config, { humanApproval: approved });

    // ABLEHNUNG ist endgültig: die bedingte Kante in build.js führt nach END,
    // also wird nichts eingereiht und nichts veröffentlicht.
    //
    // Eine Ablehnung in eine neue Revisionsrunde zu führen wäre ein eigenes
    // Merkmal. Halt es draußen, bis das Genehmigungstor gemessen ist.

    // Ein stream mit null = vom Checkpoint FORTSETZEN.
    for await (const step of await app.stream(null, config)) {
      uebergang(trace, threadId, step);
    }

    trace.end(approved ? "PUBLISHED" : "REJECTED");
    emitToThread(threadId, {
      type: "workflow_complete",
      status: approved ? "PUBLISHED" : "REJECTED",
    });
  }

  return { app, startWorkflow, resolveApproval };
}
