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
  terme,
  createEmbedding,
  ARTEN,
} from "../src/kernel/context/embedding/index.js";
import {
  createHashAdapter,
  DIMENSIONEN,
} from "../src/kernel/context/embedding/hash.js";
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

test("Envelope: erlaubtePersonen ist OPTIONAL — jede alte Envelope bleibt gueltig", () => {
  // Der Beweis, dass ADR-0012 nichts Bestehendes bewegt.
  assert.doesNotThrow(() => pruefeEnvelope(envelope()));
  assert.doesNotThrow(() =>
    pruefeEnvelope(envelope({ erlaubtePersonen: ["u7"] })),
  );
});

test("Envelope: eine kaputte erlaubtePersonen-Liste wird LAUT abgelehnt", () => {
  // Still durchzulassen hieße, eine Berechtigung zu speichern, die der Filter
  // später nicht deuten kann — und dann entscheidet ein Zufall.
  for (const kaputt of ["u7", [""], [null], [1], {}]) {
    assert.throws(
      () => pruefeEnvelope(envelope({ erlaubtePersonen: kaputt })),
      /erlaubtePersonen/,
    );
  }
});

test("Envelope: auch die Einzelfreigaben werden als KOPIE vererbt", () => {
  // Ohne die Kopie änderte ein späterer Entzug am Dokument still die Envelope
  // jedes bereits geschriebenen Chunks — der Entzug sähe korrekt aus, ohne
  // dass je synchronisiert wurde. Genau die Illusion, die 3.14 aufdecken soll.
  const dok = envelope({ erlaubtePersonen: ["u7"] });
  const geerbt = erbeEnvelope(dok);
  dok.erlaubtePersonen.push("u8");
  assert.deepEqual(geerbt.erlaubtePersonen, ["u7"]);
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

// ── Embedding (ADR-0007, ADR-0015) ───────────────────────────────────────

const hash = createEmbedding(createHashAdapter());
const einbetten = (text) => hash.einbette(text, "dokument");

test("Embedding: derselbe Text ergibt denselben Vektor", async () => {
  // Das Prüfkriterium von ADR-0007. Ohne diese Eigenschaft ist Schicht A
  // nicht deterministisch und 3.13 nicht beweisfähig.
  assert.deepEqual(
    await einbetten("gleicher Text"),
    await einbetten("gleicher Text"),
  );
});

test("Embedding: feste Dimension, L2-normiert", async () => {
  const v = await einbetten("ein Text mit mehreren Wörtern");
  assert.equal(v.length, DIMENSIONEN);
  const laenge = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(laenge - 1) < 1e-9, `Länge war ${laenge}`);
});

test("Embedding: ein Text ohne Terme bleibt der Nullvektor", async () => {
  // Die ehrliche Antwort: Ähnlichkeit 0 zu allem. Kein künstlicher Wert, der
  // ihn irgendwo einsortiert.
  const v = await einbetten("!!! ??? ...");
  assert.deepEqual(
    v,
    new Array(DIMENSIONEN).fill(0),
    "kein NaN aus Division durch null",
  );
});

test("Embedding: verschiedene Texte ergeben verschiedene Vektoren", async () => {
  assert.notDeepEqual(
    await einbetten("Quartalszahlen"),
    await einbetten("Lieferzeiten"),
  );
});

// ── Der Port (ADR-0015) ──────────────────────────────────────────────────

test("Embedding-Port: ein unvollstaendiger Adapter wird LAUT abgelehnt", () => {
  assert.throws(
    () => createEmbedding({ dimensionen: 4, einbetteViele: () => [] }),
    /name/,
  );
  assert.throws(
    () => createEmbedding({ name: "x", einbetteViele: () => [] }),
    /dimensionen/,
  );
  assert.throws(
    () => createEmbedding({ name: "x", dimensionen: 4 }),
    /einbetteViele/,
  );
  assert.throws(
    () =>
      createEmbedding({ name: "x", dimensionen: 0, einbetteViele: () => [] }),
    /positive ganze Zahl/,
  );
});

test("Embedding-Port: eine unbekannte Art wirft, statt still zu raten", async () => {
  // Ein Adapter, der die Unterscheidung braucht, bekaeme sonst irgendeinen
  // Wert — und die Frage waere als Dokument eingebettet, ohne dass es
  // auffiele.
  await assert.rejects(
    () => hash.einbetteViele(["x"], "irgendwas"),
    /unbekannte Art/,
  );
  for (const art of ARTEN) {
    assert.equal((await hash.einbetteViele(["x"], art)).length, 1);
  }
});

test("Embedding-Port: zu wenige Vektoren werden LAUT abgelehnt", async () => {
  // Der wichtigste Test dieser Gruppe. Eine um eins verschobene Zuordnung
  // Chunk ↔ Vektor faelscht Daten und tarnt sich als schlechte Suchqualitaet;
  // KEINE Metrik dieses Repos wuerde sie fangen — 3.13 zaehlt unerlaubte
  // Treffer, nicht falsch zugeordnete.
  const luegner = createEmbedding({
    name: "luegner",
    dimensionen: 2,
    einbetteViele: (texte) => texte.slice(1).map(() => [1, 0]),
  });
  await assert.rejects(
    () => luegner.einbetteViele(["a", "b"], "dokument"),
    /2 Texte hineingegeben, 1 Vektoren/,
  );
});

test("Embedding-Port: eine falsche Dimension wird LAUT abgelehnt", async () => {
  const schief = createEmbedding({
    name: "schief",
    dimensionen: 4,
    einbetteViele: (texte) => texte.map(() => [1, 0]),
  });
  await assert.rejects(
    () => schief.einbetteViele(["a"], "dokument"),
    /2 statt 4 Dimensionen/,
  );
});

test("Embedding-Port: eine leere Liste fragt den Adapter GAR NICHT", async () => {
  let gefragt = 0;
  const zaehler = createEmbedding({
    name: "zaehler",
    dimensionen: 2,
    einbetteViele: (texte) => {
      gefragt++;
      return texte.map(() => [1, 0]);
    },
  });
  assert.deepEqual(await zaehler.einbetteViele([], "dokument"), []);
  assert.equal(gefragt, 0, "ein Netzaufruf fuer nichts kostet trotzdem");
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

test("Ingest: ein Dokument ohne Envelope wird abgelehnt", async () => {
  await assert.rejects(
    () => verarbeiteDokument({ text: "Inhalt" }, hash),
    /envelope/,
  );
});

test("Ingest: JEDER Chunk trägt dieselbe Envelope wie sein Dokument", async () => {
  // Die Zusage von ADR-0009 in ausführbarer Form.
  const dok = envelope({ sichtbarkeit: "gruppe", erlaubteGruppen: ["g1"] });
  const text = ["A".repeat(300), "B".repeat(300)].join("\n\n");
  const chunks = await verarbeiteDokument({ envelope: dok, text }, hash);

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

test("Ingest: chunkId ist deterministisch — sonst wäre die Trefferfolge es nicht", async () => {
  const dok = {
    envelope: envelope(),
    text: "Erster Absatz.\n\nZweiter Absatz.",
  };
  const a = (await verarbeiteDokument(dok, hash)).map((c) => c.chunkId);
  const b = (await verarbeiteDokument(dok, hash)).map((c) => c.chunkId);
  assert.deepEqual(a, b, "zwei Läufe, dieselben Ids");
  assert.deepEqual(a, ["d1#0", "d1#1"], "Dokument-Id plus Position");
});

test("Teilen: Absätze zuerst, dann harte Kappung", () => {
  assert.deepEqual(teile("kurz\n\nauch kurz"), ["kurz", "auch kurz"]);
  assert.deepEqual(teile("abcdef", 2), ["ab", "cd", "ef"]);
  assert.deepEqual(teile(""), []);
});
