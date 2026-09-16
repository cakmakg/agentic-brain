// ── adapters/http/server.js ──────────────────────────────────────────────
// Die HTTP-Schicht — ein ADAPTER über dem Kern, kein Teil von ihm. Die
// Middleware-Pipeline entspricht der Aufbaureihenfolge des MOAT:
//
//   express.json(limit) → [auth] → Rate-Limiter → Routen
//
// Endpunkte:
//   POST /api/run          → Workflow starten (auth + workflowLimiter)
//   GET  /api/events/:id   → SSE-Live-Stream (mit Event-Buffering)
//   POST /api/approve      → HITL-Entscheidung (auth + approveLimiter)
//   GET  /api/artifact/:id → Inhalts-Fallback nach einem Reload
//   GET  /api/queue        → Zustand der Action-Queue (Beobachtung)
//
// Tritt später ein zweiter Kanal daneben (etwa ein MCP-Server), teilt er sich
// denselben Kern. Deshalb steht hier keine Ablauflogik — nur Übersetzung.
//
// HIER WÄCHST DAS GERÜST: Der Adapter WÄHLT die Domäne; der Kern kennt sie
// nicht. Mehrere Domänen bedienst du, indem du den Namen aus dem Request
// nimmst statt ihn wie hier fest zu verdrahten.

import express from "express";
import crypto from "node:crypto";

import { authMiddleware } from "../../kernel/governance/auth.js";
import {
  globalLimiter,
  workflowLimiter,
  approveLimiter,
} from "../../kernel/governance/rateLimiter.js";
import { getRunner } from "../../kernel/registry.js";
import {
  agentEventBus,
  drainBuffer,
} from "../../kernel/governance/eventBus.js";

// Die Domäne wird hier registriert — der Adapter wählt sie, der Kern kennt sie nicht.
import "../../domains/beispiel/domain.js";
import { getArtifact } from "../../domains/beispiel/agents/ablage.js";
import { getQueue } from "../../domains/beispiel/actions.js";

const { startWorkflow, resolveApproval } = getRunner("beispiel");

export const app = express();
app.use(express.json({ limit: "2mb" })); // Begrenzung der Body-Größe = DoS-Schutz
app.use("/api", globalLimiter);

// SSE: vor der Auth (EventSource kann keine Header senden); die thread_id ist
// nicht erratbar (uuid).
app.get("/api/events/:threadId", (req, res) => {
  const { threadId } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  drainBuffer(threadId, send); // erst den Puffer leeren
  agentEventBus.on(threadId, send); // dann live zuhören
  req.on("close", () => agentEventBus.off(threadId, send));
});

// Workflow starten.
app.post("/api/run", authMiddleware, workflowLimiter, async (req, res) => {
  const task = String(req.body?.task || "").trim();
  if (!task) return res.status(400).json({ error: "task erforderlich" });
  const threadId = crypto.randomUUID();
  res.json({ threadId }); // sofort antworten; der Fortschritt fließt über SSE
  startWorkflow({ task, threadId }).catch((e) =>
    console.error("Workflow-Fehler:", e.message),
  );
});

// HITL-Entscheidung.
//
// NUR ein JSON-Boolean `true` ist eine Genehmigung. Jeder andere Wert wird
// ABGELEHNT, nicht umgewandelt: `Boolean("false")` ist `true`, und mit der
// frueheren Umwandlung genehmigte ein Client, der `{"approved": "false"}`
// sendete. Die Kante im Kern prueft auf exakt `true` (`agent/build.js`) — der
// Rand darf den Wert davor nicht zurechtbiegen, sonst gilt die Zusage im Kern
// und nicht am Rand. Dieselbe Regel gilt fuer jeden spaeteren Kanal.
app.post("/api/approve", authMiddleware, approveLimiter, async (req, res) => {
  const { threadId, approved } = req.body || {};
  if (!threadId)
    return res.status(400).json({ error: "threadId erforderlich" });
  if (typeof approved !== "boolean")
    return res
      .status(400)
      .json({ error: "approved muss ein JSON-Boolean sein (true oder false)" });
  res.json({ ok: true });
  resolveApproval({ threadId, approved }).catch((e) =>
    console.error("Genehmigungsfehler:", e.message),
  );
});

app.get("/api/artifact/:threadId", authMiddleware, (req, res) => {
  res.json(getArtifact(req.params.threadId) || { error: "nicht vorhanden" });
});
app.get("/api/queue", authMiddleware, (req, res) => res.json(getQueue()));
