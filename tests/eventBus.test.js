// ── tests/eventBus.test.js ───────────────────────────────────────────────
// Event-Buffering gegen eine echte Race-Condition: der Workflow erzeugt fast
// immer schon Events, BEVOR der Browser die SSE-Verbindung geöffnet hat. Ohne
// Puffer wäre der Anfang jedes Laufs für die Zuschauerin unsichtbar.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agentEventBus,
  emitToThread,
  drainBuffer,
  scheduleBufferGc,
} from "../src/kernel/observability/eventBus.js";

test("Ohne Zuhörer werden Events gepuffert und später in Reihenfolge geliefert", () => {
  const threadId = "t-puffer";
  emitToThread(threadId, { type: "agent_log", line: "eins" });
  emitToThread(threadId, { type: "agent_log", line: "zwei" });

  const gesehen = [];
  drainBuffer(threadId, (ev) => gesehen.push(ev.line));

  assert.deepEqual(gesehen, ["eins", "zwei"]);
});

test("Der Puffer wird nach dem Leeren nicht erneut geliefert", () => {
  const threadId = "t-einmal";
  emitToThread(threadId, { type: "agent_log", line: "eins" });
  drainBuffer(threadId, () => {});

  const nochmal = [];
  drainBuffer(threadId, (ev) => nochmal.push(ev));
  assert.deepEqual(nochmal, []);
});

test("Mit Zuhörer wird live gesendet, nicht gepuffert", () => {
  const threadId = "t-live";
  const gesehen = [];
  const listener = (ev) => gesehen.push(ev.line);
  agentEventBus.on(threadId, listener);

  emitToThread(threadId, { type: "agent_log", line: "sofort" });
  agentEventBus.off(threadId, listener);

  assert.deepEqual(gesehen, ["sofort"]);

  const rest = [];
  drainBuffer(threadId, (ev) => rest.push(ev));
  assert.deepEqual(
    rest,
    [],
    "Live gesendete Events landen nicht zusätzlich im Puffer",
  );
});

test("Jedes Event bekommt einen Zeitstempel", () => {
  const threadId = "t-ts";
  emitToThread(threadId, { type: "agent_active", node: "writer" });
  let ts;
  drainBuffer(threadId, (ev) => (ts = ev.ts));
  assert.equal(typeof ts, "number");
});

test("drainBuffer auf einem unbekannten Thread liefert nichts und wirft nicht", () => {
  const gesehen = [];
  drainBuffer("gibt-es-nicht", (ev) => gesehen.push(ev));
  assert.deepEqual(gesehen, []);
});

test("scheduleBufferGc lässt sich aufrufen, ohne den Prozess offenzuhalten", () => {
  // Die eigentliche Wirkung tritt erst nach 5 Minuten ein und ist hier nicht
  // prüfbar. Geprüft wird, dass der Aufruf selbst folgenlos bleibt — die
  // bekannte Lücke (kein GC nach resolveApproval) steht in eventBus.js.
  assert.doesNotThrow(() => scheduleBufferGc("t-gc"));
});
