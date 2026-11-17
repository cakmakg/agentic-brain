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
import {
  llmText,
  llmStructured,
  strukturiertMitVerbrauch,
} from "../src/kernel/llm/adapter.js";
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

// ── Der echte strukturierte Pfad zählt seine Kosten ──────────────────────
// Bis zum 2026-11-17 verlor `llmStructured` außerhalb des Mock-Modus die
// Token-Zahlen: der Budget-Kill-Switch sah 0 USD. Geprüft ohne Netz, mit einem
// Runnable, das antwortet wie `withStructuredOutput(schema, { includeRaw: true })`.
const runnable = (antwort) => ({ invoke: async () => antwort });

test("Echter Pfad: die Token aus usage_metadata landen im Budget", async () => {
  cost.reset();
  const ergebnis = await strukturiertMitVerbrauch(
    runnable({
      raw: { usage_metadata: { input_tokens: 1_000, output_tokens: 200 } },
      parsed: { aktionspunkte: [] },
    }),
    [],
    "claude-haiku-4-5",
  );
  assert.deepEqual(ergebnis, { aktionspunkte: [] });
  // Haiku 4.5: 1 USD / 5 USD je Mio. → 0,001 + 0,001
  assert.ok(Math.abs(cost.spend() - 0.002) < 1e-12, `spend ${cost.spend()}`);
});

test("Echter Pfad: ein Parse-Fehler wirft — aber erst nach dem Zählen", async () => {
  cost.reset();
  const fehler = new Error("Schema verletzt");
  await assert.rejects(
    () =>
      strukturiertMitVerbrauch(
        runnable({
          raw: { usage_metadata: { input_tokens: 500, output_tokens: 0 } },
          parsed: null,
          parsing_error: fehler,
        }),
        [],
        "claude-haiku-4-5",
      ),
    /Schema verletzt/,
  );
  assert.ok(cost.spend() > 0, "bezahlt ist bezahlt");
});
