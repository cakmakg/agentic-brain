// ── tests/costTracker.test.js ────────────────────────────────────────────
// In einem System, das Geld ausgibt, ist Kosten ein SICHERHEITSTHEMA. Ein
// Schleifenfehler kann über Nacht eine dreistellige Rechnung erzeugen; der
// Budget-Kill-Switch ist die finanzielle Brandmauer.
//
// Der wichtigste Test hier ist der letzte: einmal gedrosselt, bleibt gedrosselt.
// Ein Schalter, der sich selbst zurücksetzt, ist keine Brandmauer.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { trackUsage, cost } from "../src/kernel/observability/costTracker.js";
import { env } from "../src/kernel/config/env.js";

beforeEach(() => cost.reset());

test("Zurückgesetzt ist der Stand null und nichts gedrosselt", () => {
  assert.equal(cost.spend(), 0);
  assert.equal(cost.isThrottled(), false);
});

test("trackUsage rechnet Token in USD um (Input 3 $, Output 15 $ je Mio.)", () => {
  const betrag = trackUsage({ inputTokens: 1_000_000, outputTokens: 0 });
  assert.equal(betrag, 3);
  assert.equal(cost.spend(), 3);
});

test("Output-Token sind fünfmal so teuer wie Input-Token", () => {
  const ein = trackUsage({ inputTokens: 1000, outputTokens: 0 });
  cost.reset();
  const aus = trackUsage({ inputTokens: 0, outputTokens: 1000 });
  // Gleitkomma: 1000 * 15/1e6 ist nicht bitgenau 5 * (1000 * 3/1e6).
  assert.ok(Math.abs(aus - ein * 5) < 1e-12);
});

test("trackUsage benutzt bei übergebenem Modell dessen eigenen Preis (Haiku 4.5)", () => {
  const betrag = trackUsage({
    inputTokens: 1_000_000,
    outputTokens: 0,
    model: "claude-haiku-4-5",
  });
  assert.equal(betrag, 1, "Haiku 4.5 kostet 1 $ / Mio. Input-Token, nicht 3 $");
});

test("Ein unbekanntes Modell fällt sicher auf den Standardpreis zurück", () => {
  const betrag = trackUsage({
    inputTokens: 1_000_000,
    outputTokens: 0,
    model: "modell-nicht-in-der-tabelle",
  });
  assert.equal(betrag, 3, "kein Crash, Default-Preis wie ohne model-Angabe");
});

test("Fehlende Felder werden als null gezählt, nicht als NaN", () => {
  assert.equal(trackUsage({}), 0);
  assert.equal(cost.spend(), 0);
});

test("Kosten akkumulieren über mehrere Aufrufe", () => {
  trackUsage({ inputTokens: 1000, outputTokens: 1000 });
  const nachEins = cost.spend();
  trackUsage({ inputTokens: 1000, outputTokens: 1000 });
  assert.equal(cost.spend(), nachEins * 2);
});

test("Beim Erreichen des Monatsbudgets schaltet der Kill-Switch", () => {
  // Genau die Grenze treffen: das Budget in Input-Token ausgedrückt.
  const tokenBisBudget = Math.ceil(env.monthlyBudgetUsd / (3 / 1_000_000));
  trackUsage({ inputTokens: tokenBisBudget });
  assert.equal(cost.isThrottled(), true);
});

test("Einmal gedrosselt, bleibt gedrosselt — auch bei winzigen Folgeaufrufen", () => {
  cost.setThrottled(true);
  trackUsage({ inputTokens: 1 });
  assert.equal(
    cost.isThrottled(),
    true,
    "Eine Brandmauer, die sich selbst zurücksetzt, ist keine",
  );
});

test("Der manuelle Schalter lässt sich beidseitig bedienen (Admin-Knopf)", () => {
  cost.setThrottled(true);
  assert.equal(cost.isThrottled(), true);
  cost.setThrottled(false);
  assert.equal(cost.isThrottled(), false);
});
