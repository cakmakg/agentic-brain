// ── tests/graphState.test.js ─────────────────────────────────────────────
// Die Reducer tragen BEDEUTUNG, nicht nur Mechanik:
//   • Datenfelder      → ein leeres Schreiben überschreibt nicht
//   • Zähler           → Akkumulator, der Mechanismus des Schutzschalters
//   • Entscheidungen   → der letzte Wert gewinnt, auch wenn er null ist
//
// Verwechselt man sie, bricht nicht die Syntax, sondern die Logik: ein
// akkumulierender Entscheidungswert oder ein überschreibender revisionCount
// würde BREMSE 3 im Orchestrator still aushebeln. „Still" ist das Problem —
// deshalb steht hier ein Test und kein Kommentar.
//
// Zugriff über GraphState.spec.<feld>.operator — die Reducer selbst sind
// modulprivat, ihre Wirkung ist über die Annotation prüfbar.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildState } from "../src/kernel/state/schema.js";
import { beispielDomain } from "../src/domains/beispiel/domain.js";

import { frischerZustand } from "./helpers/zustand.js";

// Eigenes Zustandsverzeichnis je Testdatei — sonst sähe der zweite
// `npm test`-Lauf den Zustand des ersten.
frischerZustand();

// Dasselbe Schema wie im Lauf: Kernfelder plus die Felder der Domäne.
const GraphState = buildState(beispielDomain);

const feld = (name) => GraphState.spec[name];
const reduziere = (name, alt, neu) => feld(name).operator(alt, neu);
const standard = (name) => feld(name).initialValueFactory();

test("Datenfeld: ein leerer Wert überschreibt den alten NICHT", () => {
  assert.equal(reduziere("ergebnis", "altes Ergebnis", ""), "altes Ergebnis");
});

test("Datenfeld: ein gefüllter Wert überschreibt", () => {
  assert.equal(reduziere("ergebnis", "alt", "neu"), "neu");
});

test("Datenfeld: undefined lässt den alten Wert stehen", () => {
  assert.equal(reduziere("ergebnis", "alt", undefined), "alt");
});

test("Zähler: revisionCount akkumuliert — sonst greift BREMSE 3 nie", () => {
  assert.equal(reduziere("revisionCount", 2, 1), 3);
  assert.equal(reduziere("revisionCount", 2, undefined), 2);
  assert.equal(standard("revisionCount"), 0);
});

test("Entscheidungsfeld: der letzte Wert gewinnt — auch null", () => {
  // null ist bei einem Entscheidungsfeld eine Aussage („noch nicht
  // entschieden"), kein fehlender Wert. Ein Reducer mit Leer-Schutz könnte
  // eine Entscheidung nie zurücknehmen.
  assert.equal(reduziere("humanApproval", true, null), null);
  assert.equal(reduziere("humanApproval", null, false), false);
  assert.equal(reduziere("humanApproval", true, undefined), true);
});

test("Entscheidungsfeld: humanApproval startet als null (weder ja noch nein)", () => {
  assert.equal(standard("humanApproval"), null);
  assert.equal(standard("abgelegt"), false);
  assert.equal(standard("zugestellt"), false);
});

test("Log: wird angehängt, nie ersetzt", () => {
  assert.deepEqual(reduziere("log", ["a"], ["b"]), ["a", "b"]);
  assert.deepEqual(reduziere("log", ["a"], undefined), ["a"]);
  assert.deepEqual(standard("log"), []);
});

test("Eine Domäne darf ein Kernfeld NICHT überschreiben", () => {
  // Sonst könnte sie die fail-closed-Kante still aushebeln, indem sie
  // humanApproval mit einem eigenen Reducer belegt.
  assert.throws(
    () =>
      buildState({
        name: "boese",
        stateFields: { humanApproval: {} },
      }),
    /Kernfeld/,
  );
});
