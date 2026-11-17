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

const { schichtB, bewerte } =
  await import("../evals/domains/besprechung/schichtB.js");
const { MAX_REVISIONS } = await import("../src/domains/besprechung/domain.js");
const { messeEntwuerfe } = await import("../evals/runners/messung.js");

const b = schichtB({ modell: "claude-haiku-4-5" });

test("Die Faelle sind die sechs freigegebenen Notizen, getrennt von acl.json", () => {
  assert.deepEqual(
    b.faelle.map((f) => f.id),
    [
      "b-klar",
      "b-einer",
      "b-niemand",
      "b-erledigt",
      "b-beschluss",
      "b-gemischt",
    ],
  );
});

test("Der Datensatz prueft sich selbst: jeder erwartete Name steht im Text", () => {
  // Eine Erwartung, deren Name nicht in der Notiz steht, verlangte vom Modell
  // genau das Erfinden, das `belegt` bestraft. Sie faellt hier auf, nicht im Lauf.
  for (const { id, gegenstand } of b.faelle) {
    assert.ok(gegenstand.text.length > 0, `${id} ohne Text`);
    for (const name of gegenstand.erwartet.verantwortliche) {
      if (name === "unbesetzt") continue;
      assert.ok(
        gegenstand.text.includes(name),
        `${id}: „${name}" fehlt im Text`,
      );
    }
  }
});

// ── bewerte: die Erwartung des Falls, über den Vertrag hinaus ────────────
const fall = (verantwortliche, text) => ({
  text,
  erwartet: { verantwortliche },
});
const punkte = (...namen) => ({
  aktionspunkte: namen.map((n) => ({
    text: "Etwas Konkretes tun",
    verantwortlich: n,
  })),
});

test("bewerte: die erwarteten Verantwortlichen, gleich in welcher Reihenfolge", () => {
  const f = fall(["Mia", "Tom"], "Mia schreibt. Tom prueft.");
  assert.equal(bewerte(punkte("tom", "Mia"), f).verantwortlicheRichtig, true);
  assert.equal(
    bewerte(punkte("Mia"), f).verantwortlicheRichtig,
    false,
    "einer fehlt",
  );
  assert.equal(
    bewerte(punkte("Mia", "Tom", "Mia"), f).verantwortlicheRichtig,
    false,
    "einer zu viel",
  );
});

test("bewerte: ein Name, der nicht in der Notiz steht, ist erfunden", () => {
  const f = fall(["unbesetzt"], "Wer das uebernimmt, ist noch offen.");
  const r = bewerte(punkte("Lena"), f);
  assert.equal(r.belegt, false);
  assert.deepEqual(r.ungedeckt, ["Lena"]);
  assert.equal(
    bewerte(punkte("unbesetzt"), f).belegt,
    true,
    "unbesetzt ist kein Name",
  );
});

test('bewerte: "" besteht den Vertrag, wird aber gezaehlt', () => {
  const f = fall(["unbesetzt"], "Noch offen.");
  const ausgabe = punkte("");
  assert.equal(b.pruefe(ausgabe).konform, true, "die Luecke im Vertrag");
  assert.equal(bewerte(ausgabe, f).leereVerantwortliche, 1);
  assert.equal(bewerte(ausgabe, f).verantwortlicheRichtig, false);
});

test("bewerte: die erwartete leere Liste ist richtig", () => {
  assert.equal(
    bewerte({ aktionspunkte: [] }, fall([], "Erledigt."))
      .verantwortlicheRichtig,
    true,
  );
});

test("Die Messschleife behaelt den ersten Versuch neben der letzten Fassung", async () => {
  const antworten = [punkte("unbesetzt"), punkte("Lena")];
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: {
      maxVersuche: 3,
      schreibe: async () => antworten.shift(),
      pruefe: b.pruefe,
    },
    faelle: [{ id: "x", gegenstand: {} }],
    varianten: ["standard"],
    maxUsd: 1,
    verbrauch: () => 0,
  });
  const [e] = entwuerfe;
  assert.equal(e.versuche, 2);
  assert.equal(
    e.textErsterVersuch.aktionspunkte[0].verantwortlich,
    "unbesetzt",
  );
  assert.equal(e.text.aktionspunkte[0].verantwortlich, "Lena");
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
