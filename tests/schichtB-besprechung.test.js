// ── tests/schichtB-besprechung.test.js ───────────────────────────────────
// Prüft, was an der Schicht B der Domäne `besprechung` OHNE Modell prüfbar
// ist: dass `pruefe` den Vertrag richtig übersetzt, dass eine leere Liste
// eigens gezählt wird, dass die Fälle die Notizen aus Schicht A sind — und
// dass der Runner im Mock-Modus NICHT misst.
//
// Was hier nicht geprüft wird, und das gehört dazugesagt: was ein echtes
// Modell schreibt. Das ist die Frage der Schicht B selbst (ADR-0024).

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const { schichtB } = await import("../evals/domains/besprechung/schichtB.js");
const { MAX_REVISIONS } = await import("../src/domains/besprechung/domain.js");

const b = schichtB({ modell: "claude-haiku-4-5" });

test("Die Faelle sind die fuenf Notizen aus Schicht A, mit ihrem Text", () => {
  assert.deepEqual(
    b.faelle.map((f) => f.id),
    ["n-offen", "n-sprint", "n-archiv", "n-leitung", "n-vertraulich"],
  );
  for (const f of b.faelle) {
    assert.equal(f.gegenstand.id, f.id);
    assert.ok(f.gegenstand.text.length > 0, `${f.id} ohne Text`);
  }
});

test("Die Versuchsgrenze ist die der Domaene, keine eigene Zahl", () => {
  assert.equal(b.maxVersuche, MAX_REVISIONS);
});

test("pruefe: ein vertragstreuer Punkt ist konform", () => {
  const u = b.pruefe({
    aktionspunkte: [
      { text: "Release-Notes bis Freitag", verantwortlich: "mia" },
    ],
  });
  assert.equal(u.konform, true);
});

test("pruefe: ein Punkt ohne Verantwortliche faellt durch — mit Grund", () => {
  const u = b.pruefe({
    aktionspunkte: [
      { text: "Release-Notes bis Freitag", verantwortlich: "unbesetzt" },
    ],
  });
  assert.equal(u.konform, false);
  assert.match(u.gruende, /keine verantwortliche Person/);
});

test("pruefe: eine Antwort ohne Liste ist nicht konform", () => {
  assert.equal(b.pruefe({}).konform, false);
  assert.equal(b.pruefe(null).konform, false);
});

test("Eine leere Liste ist konform — und wird deshalb EIGENS gezaehlt", () => {
  const leer = { aktionspunkte: [] };
  assert.equal(b.pruefe(leer).konform, true, "der Vertrag nimmt sie an");
  assert.equal(b.istLeer(leer), true, "aber sie faellt in der Zaehlung auf");
  assert.equal(
    b.istLeer({
      aktionspunkte: [{ text: "x".repeat(12), verantwortlich: "mia" }],
    }),
    false,
  );
});

test("Der Runner misst im Mock-Modus NICHT — und fragt kein Netz", () => {
  // Leerer Schluessel: die .env wird nicht nachgeladen, MOCK_LLM ist wahr.
  const r = spawnSync(
    process.execPath,
    ["evals/runners/quality.js", "besprechung"],
    { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "" } },
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /braucht ein echtes Modell/);
});
