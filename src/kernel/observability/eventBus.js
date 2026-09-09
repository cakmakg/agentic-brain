// ── kernel/observability/eventBus.js ──────────────────────────────────────────────────────
// Ereignisbus für den Live-Stream (SSE) + EVENT-BUFFERING.
//
// Gründerlektion: In einem asynchronen System ist die Race-Condition der
// Normalfall. Der Workflow beginnt meist schon Events zu erzeugen, BEVOR der
// Browser die SSE-Verbindung geöffnet hat. Damit diese Events nicht verloren
// gehen: ohne Zuhörer in den Puffer legen, beim Verbinden der Reihe nach abspielen.

import { EventEmitter } from "node:events";

export const agentEventBus = new EventEmitter();
agentEventBus.setMaxListeners(0);

// threadId -> wartende Events (erzeugt, bevor ein Zuhörer verbunden war)
const buffers = new Map();

export function emitToThread(threadId, event) {
  const payload = { ...event, ts: Date.now() };
  if (agentEventBus.listenerCount(threadId) === 0) {
    // Kein Zuhörer → in den Puffer legen.
    if (!buffers.has(threadId)) buffers.set(threadId, []);
    buffers.get(threadId).push(payload);
  } else {
    // Zuhörer vorhanden → live senden.
    agentEventBus.emit(threadId, payload);
  }
}

// Beim Öffnen der SSE-Verbindung: erst den Puffer leeren, dann live zuhören.
export function drainBuffer(threadId, listener) {
  const pending = buffers.get(threadId) || [];
  for (const ev of pending) listener(ev);
  buffers.delete(threadId);
}

// Nach 5 Minuten nie abgeholte Puffer aufräumen (verhindert ein Speicherleck).
//
// 🔴 Bekannte Grenze: Diese Funktion wird nur am Ende von startWorkflow gerufen.
// Nach resolveApproval erzeugte Events können erneut gepuffert werden, ohne dass
// jemand sie aufräumt. Kleines Leck, bekannt und vorgemerkt.
export function scheduleBufferGc(threadId) {
  setTimeout(() => buffers.delete(threadId), 5 * 60 * 1000);
}
