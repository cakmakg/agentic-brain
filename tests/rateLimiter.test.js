// ── tests/rateLimiter.test.js ────────────────────────────────────────────
// MOAT Layer 2. Ein einziges globales Limit reicht nicht: teure (LLM-aufrufende)
// und billige (nur lesende) Endpunkte gehören in getrennte Eimer.
//
// Dieser Test ist bewusst flach — die Zählmechanik gehört express-rate-limit und
// wird nicht hier nachgetestet. Geprüft wird, dass es drei getrennte Eimer gibt
// und dass die Datei überhaupt geladen wird: sonst fiele sie still aus dem
// Nenner der Abdeckung, und die Zahl sähe besser aus als die Lage.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  globalLimiter,
  workflowLimiter,
  approveLimiter,
} from "../src/kernel/governance/rateLimiter.js";

test("Es gibt drei getrennte Limiter, keinen gemeinsamen", () => {
  const alle = [globalLimiter, workflowLimiter, approveLimiter];
  for (const l of alle) assert.equal(typeof l, "function");
  assert.equal(new Set(alle).size, 3, "Drei Eimer, nicht dreimal derselbe");
});

test("Jeder Limiter ist eine Express-Middleware (req, res, next)", () => {
  assert.equal(globalLimiter.length, 3);
  assert.equal(workflowLimiter.length, 3);
  assert.equal(approveLimiter.length, 3);
});
