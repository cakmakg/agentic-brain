// ── tests/llm.test.js ────────────────────────────────────────────────────
// Der Mock-Modus ist kein Notbehelf, sondern das Fundament: ohne ihn
// wären Tests und die Evaluationen der Schicht A weder deterministisch noch
// kostenlos noch in CI ausführbar.
//
// Geprüft wird deshalb vor allem eines: dass hier wirklich KEIN externer Aufruf
// stattfindet — und dass trotzdem Kosten mitgeschrieben werden, sonst wäre die
// Kostenmetrik im Mock blind.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { MOCK_LLM } from "../src/kernel/config/env.js";
import { llmText, llmStructured } from "../src/kernel/llm/adapter.js";
import { cost } from "../src/kernel/governance/costTracker.js";

before(() => {
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  );
  cost.reset();
});

test("llmText liefert eine deterministisch als Mock erkennbare Antwort", async () => {
  const a = await llmText("System", "Nutzerfrage über Markttrends");
  const b = await llmText("System", "Nutzerfrage über Markttrends");

  assert.match(a, /^\[MOCK\]/);
  assert.equal(a, b, "Zweimal derselbe Aufruf muss dasselbe liefern");
});

test("llmStructured gibt genau das zurück, was der mockFactory erzeugt", async () => {
  const schema = z.object({ nextAgent: z.string(), reason: z.string() });
  const erwartet = { nextAgent: "END", reason: "mock" };

  const r = await llmStructured(schema, "System", "Nutzer", () => erwartet);
  assert.deepEqual(r, erwartet);
});

test("Auch im Mock-Modus werden Kosten mitgeschrieben", async () => {
  cost.reset();
  const vorher = cost.spend();
  await llmText("System", "eine Frage");
  assert.ok(
    cost.spend() > vorher,
    "Sonst wäre die Kostenmetrik im Mock-Modus blind — die Schätzung ist grob, aber sie existiert",
  );
});

test("Die Kostenschätzung wächst mit der Eingabelänge", async () => {
  cost.reset();
  await llmText("S", "kurz");
  const klein = cost.spend();

  cost.reset();
  await llmText("S", "x".repeat(4000));
  const gross = cost.spend();

  assert.ok(gross > klein);
});
