// ── tests/embedding.test.js ──────────────────────────────────────────────
// Der Embedding-Port und seine zwei Adapter (ADR-0015).
//
// DIESE DATEI BRAUCHT KEIN NETZ UND KEINEN SCHLÜSSEL. Der Voyage-Adapter
// nimmt sein `fetch` als Parameter entgegen, und die Tests reichen eines
// hinein, das die dokumentierte Antwortform nachbildet. Damit ist alles
// prüfbar, was an diesem Adapter schiefgehen kann — Reihenfolge, Stapel,
// `input_type`, Fehlercodes — ohne einen Cent auszugeben.
//
// Was so NICHT geprüft wird, und das gehört dazugesagt: ob Voyage wirklich so
// antwortet. Das prüft nur ein echter Lauf, und der ist ausdrücklich opt-in.
// Ein Testdouble beweist die eigene Logik, nicht die Fremde.
//
// DER WERTVOLLSTE TEST IST „nach index sortiert, nicht nach Reihenfolge".
// Eine vertauschte Antwort liefert die RICHTIGE ANZAHL Vektoren — die Prüfung
// im Port greift also nicht, und keine Metrik dieses Repos auch nicht. Jeder
// Chunk trüge den Vektor eines anderen, und es sähe aus wie schlechte
// Suchqualität.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createEmbedding } from "../src/kernel/context/embedding/index.js";
import { createVoyageAdapter } from "../src/kernel/context/embedding/voyage.js";

// Ein `fetch`, das die dokumentierte Voyage-Antwort nachbildet. `reihenfolge`
// steuert, in welcher Ordnung die Einträge zurückkommen.
function fakeFetch({
  reihenfolge = "aufsteigend",
  status = 200,
  breite = 4,
} = {}) {
  const aufrufe = [];
  const impl = async (url, optionen) => {
    const koerper = JSON.parse(optionen.body);
    aufrufe.push({ url, koerper, headers: optionen.headers });

    if (status !== 200) {
      return {
        ok: false,
        status,
        statusText: "Nope",
        text: async () => `{"detail":"kaputt"}`,
      };
    }

    // Jeder Text bekommt einen Vektor, der seinen Index trägt — so lässt sich
    // hinterher prüfen, ob Text und Vektor zusammengeblieben sind.
    const data = koerper.input.map((_, i) => ({
      index: i,
      embedding: [i, ...new Array(breite - 1).fill(0)],
    }));
    if (reihenfolge === "umgekehrt") data.reverse();
    if (reihenfolge === "lueckenhaft" && data.length > 1) data[1].index = 99;

    return { ok: true, status: 200, json: async () => ({ data }) };
  };
  impl.aufrufe = aufrufe;
  return impl;
}

const voyage = (optionen = {}, fetchOptionen = {}) => {
  const f = fakeFetch(fetchOptionen);
  const port = createEmbedding(
    createVoyageAdapter({
      apiKey: "test-schluessel",
      modell: "voyage-4",
      dimensionen: fetchOptionen.breite ?? 4,
      fetchImpl: f,
      ...optionen,
    }),
  );
  return { port, f };
};

// ── Der Schluessel ───────────────────────────────────────────────────────

test("Voyage: ohne Schluessel wirft der Adapter, statt still zu starten", () => {
  // Ein Lauf, der still auf `hash` zurückfiele, würde etwas anderes messen
  // als angefordert — genau der Ausfall, um den dieses Repo gebaut ist.
  assert.throws(
    () => createVoyageAdapter({ apiKey: "", fetchImpl: fakeFetch() }),
    /VOYAGE_API_KEY fehlt/,
  );
});

test("Voyage: der Schluessel steht im Authorization-Kopf, nicht im Text", async () => {
  const { port, f } = voyage();
  await port.einbetteViele(["a"], "dokument");
  assert.equal(f.aufrufe[0].headers.Authorization, "Bearer test-schluessel");
  assert.ok(!JSON.stringify(f.aufrufe[0].koerper).includes("test-schluessel"));
});

// ── Die Asymmetrie (input_type) ──────────────────────────────────────────

test("Voyage: dokument und anfrage werden VERSCHIEDEN eingebettet", async () => {
  // Die Dokumentation nennt `input_type` als Pflicht für Retrieval: das
  // Modell setzt vor Frage und Dokument je einen eigenen Hinweis. Ohne die
  // Unterscheidung sucht man in einem Raum, für den das Modell nicht
  // trainiert wurde — und es fiele nirgends auf.
  const { port, f } = voyage();
  await port.einbetteViele(["x"], "dokument");
  await port.einbetteViele(["x"], "anfrage");
  assert.equal(f.aufrufe[0].koerper.input_type, "document");
  assert.equal(f.aufrufe[1].koerper.input_type, "query");
});

test("Voyage: Modell und Vektorbreite stehen in JEDER Anfrage", async () => {
  // Die Breite steht im Vertrag mit dem Postgres-Schema (`vector(n)`). Sie
  // aus der ersten Antwort zu raten hiesse, das Schema von einer Antwort
  // abhaengig zu machen, die noch nicht da ist.
  const { port, f } = voyage({}, { breite: 8 });
  await port.einbetteViele(["a", "b"], "dokument");
  assert.equal(f.aufrufe[0].koerper.model, "voyage-4");
  assert.equal(f.aufrufe[0].koerper.output_dimension, 8);
});

// ── Die Reihenfolge ──────────────────────────────────────────────────────

test("Voyage: die Antwort wird nach index sortiert, nicht nach Reihenfolge", async () => {
  // DER WERTVOLLSTE TEST DIESER DATEI. Kommt die Antwort vertauscht zurück
  // und man vertraut der Reihenfolge, trägt jeder Chunk den Vektor eines
  // anderen — bei RICHTIGER Anzahl. Die Prüfung im Port greift dann nicht.
  const { port } = voyage({}, { reihenfolge: "umgekehrt" });
  const v = await port.einbetteViele(["a", "b", "c"], "dokument");
  // Jeder Vektor trägt seinen Index in der ersten Dimension.
  assert.deepEqual(
    v.map((x) => x[0]),
    [0, 1, 2],
    "Text i muss Vektor i bekommen, egal wie die Antwort sortiert war",
  );
});

test("Voyage: eine lueckenhafte Antwort wird LAUT abgelehnt", async () => {
  const { port } = voyage({}, { reihenfolge: "lueckenhaft" });
  await assert.rejects(
    () => port.einbetteViele(["a", "b"], "dokument"),
    /lueckenhaft|lückenhaft/,
  );
});

// ── Stapel ───────────────────────────────────────────────────────────────

test("Voyage: viele Texte werden gestapelt, nicht einzeln gefragt", async () => {
  // 300 Chunks einzeln zu fragen waeren 300 Netzaufrufe — und die Anbieter
  // rechnen je Aufruf ab.
  const { port, f } = voyage();
  const texte = Array.from({ length: 300 }, (_, i) => `text ${i}`);
  const v = await port.einbetteViele(texte, "dokument");
  assert.equal(v.length, 300);
  assert.equal(f.aufrufe.length, 3, "300 Texte bei Stapel 128 → drei Anfragen");
  assert.equal(f.aufrufe[0].koerper.input.length, 128);
  assert.equal(f.aufrufe[2].koerper.input.length, 44);
});

test("Voyage: ueber Stapelgrenzen hinweg bleibt die Zuordnung erhalten", async () => {
  // Der Stapel ist die zweite Stelle, an der sich Text und Vektor trennen
  // koennen: jeder Aufruf zaehlt seinen `index` bei null neu.
  const { port } = voyage({}, { reihenfolge: "umgekehrt" });
  const texte = Array.from({ length: 200 }, (_, i) => `text ${i}`);
  const v = await port.einbetteViele(texte, "dokument");
  // Erwartet: 0..127 aus dem ersten Stapel, dann 0..71 aus dem zweiten.
  assert.equal(v[0][0], 0);
  assert.equal(v[127][0], 127);
  assert.equal(v[128][0], 0, "der zweite Stapel zaehlt bei null neu");
  assert.equal(v.length, 200);
});

// ── Fehler ───────────────────────────────────────────────────────────────

test("Voyage: ein Fehlerstatus steht in der Meldung", async () => {
  // 401 ist ein falscher Schluessel, 429 ein Ratenlimit, 400 meist ein zu
  // grosser Stapel. Ein „Fehler beim Einbetten" ohne Code schickt den
  // Naechsten auf die falsche Faehrte.
  for (const status of [401, 429, 400]) {
    const { port } = voyage({}, { status });
    await assert.rejects(
      () => port.einbetteViele(["a"], "dokument"),
      new RegExp(`Voyage ${status}`),
    );
  }
});

test("Voyage: eine Antwort ohne data-Liste wird abgelehnt", async () => {
  const port = createEmbedding(
    createVoyageAdapter({
      apiKey: "k",
      dimensionen: 4,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    }),
  );
  await assert.rejects(() => port.einbetteViele(["a"], "dokument"), /data/);
});

test("Voyage: eine falsche Vektorbreite faengt der PORT ab", async () => {
  // Der Adapter meldet 1024, das Testdouble liefert 4. Ohne diese Prüfung
  // landeten zu kurze Vektoren im Postgres-Schema und die Datenbank meldete
  // etwas Kryptisches — oder der memory-Adapter rechnete stillschweigend
  // falsch weiter.
  const port = createEmbedding(
    createVoyageAdapter({
      apiKey: "k",
      dimensionen: 1024,
      fetchImpl: fakeFetch({ breite: 4 }),
    }),
  );
  await assert.rejects(
    () => port.einbetteViele(["a"], "dokument"),
    /4 statt 1024 Dimensionen/,
  );
});

// ── Der Rest der Kette haengt nicht am Hash ──────────────────────────────

test("Kette: ein 1024-dimensionales Embedding laeuft durch Ingest, Speicher und Suche", async () => {
  // Was dieser Test beweist und was nicht.
  //
  // ER BEWEIST: nichts zwischen Ingest und Filter haengt an der Breite 64
  // oder am Hash. Envelope-Vererbung, `ersetzeQuelle`, die hybride Suche und
  // der ACL-Filter arbeiten mit einem beliebigen Adapter zusammen. Ohne
  // diesen Nachweis waere „der Adapter ist austauschbar" eine Behauptung.
  //
  // ER BEWEIST NICHT, dass ein ECHTES Embedding 3.13 nicht bewegt. Das
  // entscheidet nur ein Lauf gegen Voyage, und der braucht einen Schluessel
  // (Etappe 3d-2, siehe ADR-0015).
  const { baueStore } = await import("../src/kernel/context/aufbau.js");
  const { ingestiere } =
    await import("../src/kernel/context/ingest/pipeline.js");
  const { suche } = await import("../src/kernel/retrieval/suche.js");

  // Ein deterministisches, breites Embedding: jedes Wort belegt eine
  // Dimension. Semantisch bedeutungslos, aber genau so breit wie voyage-4.
  const breit = createEmbedding({
    name: "breit-1024",
    dimensionen: 1024,
    einbetteViele: (texte) =>
      texte.map((t) => {
        const v = new Array(1024).fill(0);
        for (const w of String(t).toLowerCase().split(/\W+/).filter(Boolean)) {
          let h = 7;
          for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0;
          v[h % 1024] = 1;
        }
        const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
        return v.map((x) => x / n);
      }),
  });

  const env2 = (over) => ({
    tenantId: "t1",
    quelle: "q",
    dokumentId: "d",
    sichtbarkeit: "oeffentlich",
    erlaubteGruppen: [],
    besitzerId: "u1",
    ...over,
  });

  const store = await baueStore("memory", { embedding: breit });
  assert.equal(store.embedding.dimensionen, 1024);

  await ingestiere(store, [
    { envelope: env2({ dokumentId: "offen" }), text: "Rollout offene Punkte" },
    {
      envelope: env2({
        dokumentId: "geheim",
        sichtbarkeit: "privat",
        besitzerId: "chef",
      }),
      text: "Rollout offene Punkte",
    },
  ]);

  const { treffer } = await suche({
    store,
    principal: { tenantId: "t1", benutzerId: "u2", gruppen: [] },
    anfrage: "Rollout offene Punkte",
    k: 100,
  });

  assert.ok(treffer.length > 0, "das erlaubte Dokument muss gefunden werden");
  for (const t of treffer) {
    assert.equal(t.vektor?.length ?? 1024, 1024);
    assert.notEqual(
      t.dokumentId,
      "geheim",
      "kein unerlaubter Chunk — unabhaengig von der Vektorbreite",
    );
  }
});
// ── Der Zwischenspeicher (ADR-0016) ──────────────────────────────────────
//
// WAS HIER AUF DEM SPIEL STEHT. Der Zwischenspeicher spart Geld, indem er
// eine Antwort wiederverwendet. Jeder Fehler in ihm hat dieselbe Form: ein
// Text bekommt den Vektor eines anderen. Die ANZAHL stimmt dabei — die
// Prüfung im Port greift also nicht, und keine Metrik dieses Repos auch
// nicht. Deshalb prüft jeder Test hier die ZUORDNUNG, nicht nur die Länge.
//
// Jede Zusicherung dieses Abschnitts wurde mutiert, bevor sie stehenblieb:
// die Art aus dem Schlüssel genommen, die Teiltreffer-Zusammensetzung auf
// `neue[i]` statt `neue[j]` gestellt, die Verdrängung abgeschaltet. Jede
// Mutation macht genau einen Test rot.

import { mitZwischenspeicher } from "../src/kernel/context/embedding/zwischenspeicher.js";

// Ein Adapter, der mitzählt und dessen Vektor den TEXT trägt — so ist an der
// Antwort ablesbar, welcher Text welchen Vektor bekommen hat. Die Art steckt
// in der zweiten Dimension: ein asymmetrisches Modell im Kleinen.
function zaehlAdapter({ name = "zaehl", dimensionen = 3 } = {}) {
  const aufrufe = [];
  return {
    name,
    dimensionen,
    aufrufe,
    einbetteViele: async (texte, art) => {
      aufrufe.push({ texte: [...texte], art });
      return texte.map((t) => {
        const v = new Array(dimensionen).fill(0);
        v[0] = t.length;
        v[1] = art === "anfrage" ? 1 : 0;
        v[2] = t.charCodeAt(0) || 0;
        return v;
      });
    },
  };
}

const gefragteTexte = (adapter) => adapter.aufrufe.flatMap((a) => a.texte);

// Ein vollstaendiger Zyklus-Aufbau: Speicher, Connector und eine
// veraenderbare Momentaufnahme. Steht ausserhalb des Tests, damit der Test
// selbst nur noch die ZUSAGEN enthaelt und nicht die Einrichtung.
async function baueZyklus(adapter) {
  const { createConnector } = await import("../src/kernel/connectors/index.js");
  const { createStore } = await import("../src/kernel/context/store/index.js");
  const { createMemoryAdapter } =
    await import("../src/kernel/context/store/memory.js");

  const embedding = createEmbedding(
    mitZwischenspeicher(adapter, { max: 1000 }),
  );
  const store = createStore(createMemoryAdapter({ embedding }), embedding);

  const huelle = (id) => ({
    tenantId: "t1",
    quelle: "laufwerk",
    dokumentId: id,
    sichtbarkeit: "oeffentlich",
    erlaubteGruppen: [],
    besitzerId: "u1",
  });

  const zustand = {
    dokumente: [
      { envelope: huelle("d1"), text: "Rollout verschoben auf Maerz" },
      { envelope: huelle("d2"), text: "Budget freigegeben fuer Q2" },
    ],
  };

  return {
    embedding,
    store,
    zustand,
    huelle,
    connector: createConnector({
      quelle: "laufwerk",
      hole: () => zustand.dokumente,
    }),
  };
}

test("Zwischenspeicher: derselbe Stapel ein zweites Mal fragt den Adapter NICHT", async () => {
  const adapter = zaehlAdapter();
  const port = createEmbedding(mitZwischenspeicher(adapter, { max: 100 }));

  const texte = ["Rollout verschoben", "Budget freigegeben"];
  const erste = await port.einbetteViele(texte, "dokument");
  const zweite = await port.einbetteViele(texte, "dokument");

  assert.equal(adapter.aufrufe.length, 1, "der zweite Stapel kostet nichts");
  assert.deepEqual(zweite, erste, "und liefert dasselbe Ergebnis");
  assert.equal(port.zwischenspeicher.statistik().gefragt, 2);
  assert.equal(port.zwischenspeicher.statistik().treffer, 2);
});

test("Zwischenspeicher: bei Teiltreffern wird NUR das Fehlende gefragt — in der richtigen Ordnung", async () => {
  // Der teuerste Fehler dieser Datei sitzt hier: die Antwort auf die
  // Teilmenge muss an die Positionen der Teilmenge zurück, nicht an die
  // ersten Positionen des Stapels.
  const adapter = zaehlAdapter();
  const port = createEmbedding(mitZwischenspeicher(adapter, { max: 100 }));

  await port.einbetteViele(["bb", "dddd"], "dokument");
  const alle = await port.einbetteViele(["a", "bb", "ccc", "dddd"], "dokument");

  assert.deepEqual(
    gefragteTexte(adapter),
    ["bb", "dddd", "a", "ccc"],
    "nur die zwei neuen Texte gehen an den Adapter",
  );
  // v[0] ist die Textlänge: die Zuordnung ist damit an der Antwort ablesbar.
  assert.deepEqual(
    alle.map((v) => v[0]),
    [1, 2, 3, 4],
    "jeder Text hat seinen eigenen Vektor behalten",
  );
});

test("Zwischenspeicher: `dokument` und `anfrage` teilen KEINEN Eintrag", async () => {
  // Ein echtes Retrieval-Modell ist asymmetrisch (Voyage: `input_type`).
  // Fiele die Art aus dem Schlüssel, bekäme die Frage den Dokumentvektor —
  // und das Retrieval suchte in einem Raum, für den das Modell nicht
  // trainiert wurde. Es sähe aus wie schlechte Suchqualität.
  const adapter = zaehlAdapter();
  const port = createEmbedding(mitZwischenspeicher(adapter, { max: 100 }));

  const alsDokument = await port.einbetteViele(["Rollout"], "dokument");
  const alsAnfrage = await port.einbetteViele(["Rollout"], "anfrage");

  assert.equal(
    adapter.aufrufe.length,
    2,
    "derselbe Text, zwei Arten, zwei Aufrufe",
  );
  assert.equal(alsDokument[0][1], 0);
  assert.equal(alsAnfrage[0][1], 1);
  assert.notDeepEqual(alsAnfrage, alsDokument);
});

test("Zwischenspeicher: ein Duplikat im selben Stapel wird einmal gefragt, zweimal eingesetzt", async () => {
  const adapter = zaehlAdapter();
  const port = createEmbedding(mitZwischenspeicher(adapter, { max: 100 }));

  const alle = await port.einbetteViele(["a", "bb", "a"], "dokument");

  assert.deepEqual(gefragteTexte(adapter), ["a", "bb"]);
  assert.equal(alle.length, 3);
  assert.deepEqual(
    alle[0],
    alle[2],
    "beide Positionen tragen denselben Vektor",
  );
  assert.equal(alle[1][0], 2, "und die Mitte ist nicht verrutscht");
});

test("Zwischenspeicher: bei voller Kapazitaet wird der aelteste Eintrag verdraengt", async () => {
  const adapter = zaehlAdapter();
  const port = createEmbedding(mitZwischenspeicher(adapter, { max: 2 }));

  await port.einbetteViele(["a"], "dokument");
  await port.einbetteViele(["bb"], "dokument");
  await port.einbetteViele(["ccc"], "dokument"); // verdraengt "a"
  await port.einbetteViele(["ccc"], "dokument"); // Treffer
  await port.einbetteViele(["a"], "dokument"); // erneut gefragt

  assert.deepEqual(gefragteTexte(adapter), ["a", "bb", "ccc", "a"]);
  const s = port.zwischenspeicher.statistik();
  assert.equal(s.eintraege, 2, "der Speicher waechst nicht ueber `max`");
  assert.ok(s.verdraengt >= 1);
});

test("Zwischenspeicher: `max: 0` schaltet ihn ab, statt still zu speichern", async () => {
  const adapter = zaehlAdapter();
  const port = createEmbedding(mitZwischenspeicher(adapter, { max: 0 }));

  await port.einbetteViele(["a"], "dokument");
  await port.einbetteViele(["a"], "dokument");

  assert.equal(adapter.aufrufe.length, 2, "jeder Stapel zahlt voll");
  assert.equal(port.zwischenspeicher.statistik().eintraege, 0);
});

test("Zwischenspeicher: eine unvollstaendige Teilantwort wird HIER abgefangen, nicht erst im Port", async () => {
  // Der Port vergleicht mit dem, was IHM hineingegeben wurde — inklusive der
  // Treffer aus dem Speicher. Die Gesamtzahl stimmt also, während die
  // Zuordnung der Teilmenge schon verschoben ist. Deshalb prüft der
  // Zwischenspeicher seine eigene Teilantwort.
  const kaputt = {
    name: "kaputt",
    dimensionen: 3,
    einbetteViele: async (texte) => texte.slice(1).map(() => [0, 0, 0]),
  };
  const port = createEmbedding(mitZwischenspeicher(kaputt, { max: 100 }));

  await assert.rejects(
    () => port.einbetteViele(["a", "bb"], "dokument"),
    /2 Texte nachgefragt, 1 Vektoren zurueck/,
  );
});

test("Zwischenspeicher: er aendert am Ergebnis NICHTS — dieselben Texte, dieselben Vektoren", async () => {
  // Das Tor dieser Etappe im Kleinen: mit und ohne Zwischenspeicher muss
  // Gleiches herauskommen, sonst wäre die Ersparnis eine Messänderung.
  const { createHashAdapter } =
    await import("../src/kernel/context/embedding/hash.js");
  const texte = [
    "Rollout verschoben",
    "Budget freigegeben",
    "Rollout verschoben",
  ];

  const ohne = createEmbedding(createHashAdapter());
  const mit = createEmbedding(
    mitZwischenspeicher(createHashAdapter(), { max: 100 }),
  );

  for (const art of ["dokument", "anfrage"]) {
    assert.deepEqual(
      await mit.einbetteViele(texte, art),
      await ohne.einbetteViele(texte, art),
      `Art ${art}: identisch`,
    );
  }
});

test("Kapitalprobe: ein zweiter Synchronisationszyklus kostet NULL Einbettungen", async () => {
  // DAS TOR DER ETAPPE 3d-2 (ADR-0016). Die Momentaufnahme bleibt
  // vollstaendig — der Connector liefert jedes Mal alle Dokumente, der
  // Speicher ersetzt die ganze Quelle. Was NICHT noch einmal passiert, ist
  // der Einbettungsaufruf.
  const { synchronisiere } =
    await import("../src/kernel/connectors/synchronisation.js");
  const { suche } = await import("../src/kernel/retrieval/suche.js");

  const adapter = zaehlAdapter({ dimensionen: 3 });
  const { embedding, store, zustand, huelle, connector } =
    await baueZyklus(adapter);

  await synchronisiere(store, connector);
  const nachErstem = embedding.zwischenspeicher.statistik().gefragt;
  assert.ok(nachErstem > 0, "der erste Zyklus bettet ein");

  await synchronisiere(store, connector);
  assert.equal(
    embedding.zwischenspeicher.statistik().gefragt,
    nachErstem,
    "der zweite Zyklus ueber unveraenderte Dokumente fragt den Adapter kein einziges Mal",
  );

  // ── Und die Zusage aus ADR-0011 steht unveraendert. ──────────────────
  // Das ist die Haelfte, die zaehlt: die Ersparnis darf den Entzug nicht
  // aufweichen. `d2` faellt aus der Momentaufnahme — es muss verschwinden,
  // obwohl sein Vektor noch im Zwischenspeicher liegt.
  zustand.dokumente = [zustand.dokumente[0]];
  await synchronisiere(store, connector);

  const { treffer } = await suche({
    store,
    principal: { tenantId: "t1", benutzerId: "u2", gruppen: [] },
    anfrage: "Budget freigegeben fuer Q2",
    k: 100,
  });
  assert.equal(
    treffer.filter((t) => t.dokumentId === "d2").length,
    0,
    "entzogen bleibt entzogen — der Zwischenspeicher haelt Vektoren, keine Dokumente",
  );

  // Ein NEUES Dokument kostet wieder — sonst waere der Speicher taub.
  zustand.dokumente = [
    ...zustand.dokumente,
    { envelope: huelle("d3"), text: "Ganz neuer Text in diesem Zyklus" },
  ];
  await synchronisiere(store, connector);
  assert.ok(
    embedding.zwischenspeicher.statistik().gefragt > nachErstem,
    "neuer Text wird eingebettet",
  );
});
