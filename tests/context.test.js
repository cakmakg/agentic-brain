// ── tests/context.test.js ────────────────────────────────────────────────
// Die Kontext-Ebene ②: Envelope, Embedding, Ingest.
//
// Das Prüfkriterium von ADR-0007 und ADR-0009 zeigt auf diese Datei. Zwei
// Aussagen trägt sie deshalb ausdrücklich:
//   • derselbe Text ergibt denselben Vektor (ADR-0007)
//   • ein Chunk ohne Envelope entsteht nicht, und Chunks eines Dokuments
//     tragen dieselbe Envelope (ADR-0009)

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pruefeEnvelope,
  erbeEnvelope,
  istPrincipalAufloesbar,
  SICHTBARKEITEN,
} from "../src/kernel/context/envelope.js";
import {
  einbetten,
  terme,
  DIMENSIONEN,
} from "../src/kernel/context/embedding.js";
import {
  verarbeiteDokument,
  teile,
} from "../src/kernel/context/ingest/pipeline.js";

const envelope = (over = {}) => ({
  tenantId: "t1",
  quelle: "fixture",
  dokumentId: "d1",
  sichtbarkeit: "oeffentlich",
  erlaubteGruppen: [],
  besitzerId: "u1",
  ...over,
});

// ── Envelope ─────────────────────────────────────────────────────────────

test("Envelope: eine vollständige Envelope kommt durch", () => {
  assert.doesNotThrow(() => pruefeEnvelope(envelope()));
});

test("Envelope: jedes Pflichtfeld einzeln — fehlt es, wird geworfen", () => {
  for (const feld of [
    "tenantId",
    "quelle",
    "dokumentId",
    "sichtbarkeit",
    "besitzerId",
  ]) {
    const kaputt = envelope();
    delete kaputt[feld];
    assert.throws(
      () => pruefeEnvelope(kaputt),
      new RegExp(feld),
      `ohne "${feld}" muss geworfen werden`,
    );
  }
});

test("Envelope: eine unbekannte Sichtbarkeit wird abgelehnt, nicht durchgelassen", () => {
  assert.throws(
    () => pruefeEnvelope(envelope({ sichtbarkeit: "halboeffentlich" })),
    /Sichtbarkeit/,
  );
  // Und die drei bekannten sind wirklich die drei bekannten.
  assert.deepEqual(SICHTBARKEITEN, ["oeffentlich", "gruppe", "privat"]);
});

test('Envelope: "gruppe" ohne Gruppen ist in Wahrheit "privat" und wird abgelehnt', () => {
  // Zwei Schreibweisen für denselben Zustand sind der Anfang von Drift.
  assert.throws(
    () => pruefeEnvelope(envelope({ sichtbarkeit: "gruppe" })),
    /erlaubteGruppen/,
  );
});

test("Envelope: die geerbte Kopie hängt NICHT am Original", () => {
  // Sonst änderte ein späteres push() am Dokument still die Berechtigung
  // bereits gespeicherter Chunks — und niemand sähe es.
  const dok = envelope({ sichtbarkeit: "gruppe", erlaubteGruppen: ["g1"] });
  const geerbt = erbeEnvelope(dok);
  dok.erlaubteGruppen.push("g2");
  assert.deepEqual(geerbt.erlaubteGruppen, ["g1"]);
});

// ── Principal ────────────────────────────────────────────────────────────

test("Principal: auflösbar heißt Mandant, Benutzer und Gruppenliste", () => {
  assert.equal(
    istPrincipalAufloesbar({ tenantId: "t1", benutzerId: "u1", gruppen: [] }),
    true,
  );
  for (const kaputt of [
    null,
    undefined,
    {},
    { tenantId: "t1", benutzerId: "u1" }, // keine Gruppenliste
    { tenantId: "", benutzerId: "u1", gruppen: [] },
    { tenantId: "t1", benutzerId: "", gruppen: [] },
  ]) {
    assert.equal(
      istPrincipalAufloesbar(kaputt),
      false,
      `muss unauflösbar sein: ${JSON.stringify(kaputt)}`,
    );
  }
});

// ── Embedding (ADR-0007) ─────────────────────────────────────────────────

test("Embedding: derselbe Text ergibt denselben Vektor", () => {
  // Das Prüfkriterium von ADR-0007. Ohne diese Eigenschaft ist Schicht A
  // nicht deterministisch und 3.13 nicht beweisfähig.
  assert.deepEqual(einbetten("gleicher Text"), einbetten("gleicher Text"));
});

test("Embedding: feste Dimension, L2-normiert", () => {
  const v = einbetten("ein Text mit mehreren Wörtern");
  assert.equal(v.length, DIMENSIONEN);
  const laenge = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(laenge - 1) < 1e-9, `Länge war ${laenge}`);
});

test("Embedding: ein Text ohne Terme bleibt der Nullvektor", () => {
  // Die ehrliche Antwort: Ähnlichkeit 0 zu allem. Kein künstlicher Wert, der
  // ihn irgendwo einsortiert.
  const v = einbetten("!!! ??? ...");
  assert.deepEqual(
    v,
    new Array(DIMENSIONEN).fill(0),
    "kein NaN aus Division durch null",
  );
});

test("Embedding: verschiedene Texte ergeben verschiedene Vektoren", () => {
  assert.notDeepEqual(einbetten("Quartalszahlen"), einbetten("Lieferzeiten"));
});

test("Terme: Zerlegung ist gemeinsam mit dem lexikalischen Pfad", () => {
  // Zwei Zerlegungen wären zwei Vorstellungen davon, was ein Wort ist.
  assert.deepEqual(terme("Die Quartalszahlen, Q3!"), [
    "die",
    "quartalszahlen",
    "q3",
  ]);
  assert.deepEqual(terme(null), []);
});

// ── Ingest (ADR-0009) ────────────────────────────────────────────────────

test("Ingest: ein Dokument ohne Envelope wird abgelehnt", () => {
  assert.throws(() => verarbeiteDokument({ text: "Inhalt" }), /envelope/);
});

test("Ingest: JEDER Chunk trägt dieselbe Envelope wie sein Dokument", () => {
  // Die Zusage von ADR-0009 in ausführbarer Form.
  const dok = envelope({ sichtbarkeit: "gruppe", erlaubteGruppen: ["g1"] });
  const text = ["A".repeat(300), "B".repeat(300)].join("\n\n");
  const chunks = verarbeiteDokument({ envelope: dok, text });

  assert.ok(
    chunks.length > 2,
    `mehrere Chunks erwartet, waren ${chunks.length}`,
  );
  for (const c of chunks) {
    assert.equal(c.envelope.sichtbarkeit, "gruppe");
    assert.deepEqual(c.envelope.erlaubteGruppen, ["g1"]);
    assert.equal(c.envelope.tenantId, "t1");
    assert.equal(c.envelope.besitzerId, "u1");
  }
});

test("Ingest: chunkId ist deterministisch — sonst wäre die Trefferfolge es nicht", () => {
  const dok = {
    envelope: envelope(),
    text: "Erster Absatz.\n\nZweiter Absatz.",
  };
  const a = verarbeiteDokument(dok).map((c) => c.chunkId);
  const b = verarbeiteDokument(dok).map((c) => c.chunkId);
  assert.deepEqual(a, b, "zwei Läufe, dieselben Ids");
  assert.deepEqual(a, ["d1#0", "d1#1"], "Dokument-Id plus Position");
});

test("Teilen: Absätze zuerst, dann harte Kappung", () => {
  assert.deepEqual(teile("kurz\n\nauch kurz"), ["kurz", "auch kurz"]);
  assert.deepEqual(teile("abcdef", 2), ["ab", "cd", "ef"]);
  assert.deepEqual(teile(""), []);
});
