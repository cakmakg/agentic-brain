// ── tests/env.test.js ────────────────────────────────────────────────────
// modelFor kennt keine Rollennamen — der Kern bleibt domänen-unwissend. Die
// Rollennamen hier sind reiner Testinput, keine Aussage über eine Domäne.

import { test } from "node:test";
import assert from "node:assert/strict";

import { env, modelFor } from "../src/kernel/config/env.js";

test("modelFor fällt ohne Override auf env.model zurück", () => {
  assert.equal(modelFor("irgendeine_rolle"), env.model);
});

test("modelFor liest MODEL_<ROLLE>, groß geschrieben", () => {
  process.env.MODEL_CRITIC = "claude-haiku-4-5";
  try {
    assert.equal(modelFor("critic"), "claude-haiku-4-5");
    assert.equal(modelFor("CRITIC"), "claude-haiku-4-5");
  } finally {
    delete process.env.MODEL_CRITIC;
  }
});

test("Ein Override betrifft nur seine eigene Rolle", () => {
  process.env.MODEL_CRITIC = "claude-haiku-4-5";
  try {
    assert.equal(modelFor("writer"), env.model);
  } finally {
    delete process.env.MODEL_CRITIC;
  }
});
