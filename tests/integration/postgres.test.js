// ── tests/integration/postgres.test.js ───────────────────────────────────
// Der zweite Store-Adapter gegen eine ECHTE Datenbank (ADR-0006, Etappe 3c).
//
// DIESE DATEI ÜBERSPRINGT SICH SELBST, wenn `DATABASE_URL` fehlt. Das ist
// keine Bequemlichkeit, sondern K5 (ADR-0013): `npm test` muss ohne jede
// Infrastruktur durchlaufen. Ein Test, der eine Datenbank ERZWINGT, nähme dem
// Repo seine wichtigste Zusage — und ein Test, der stillschweigend nichts
// prüft, wäre noch schlimmer. Deshalb sagt der Lauf ausdrücklich, dass er
// übersprungen wurde.
//
//   docker compose up -d
//   DATABASE_URL=postgresql://agentic:agentic@localhost:55433/agentic npm test
//
// DER WERTVOLLSTE TEST IST DER DIFFERENZTEST ganz unten: dieselben Dokumente,
// dieselbe Frage, derselbe Principal — durch BEIDE Adapter. Alles andere hier
// prüft den Postgres-Adapter für sich; jener prüft, dass die zwei Kompilate
// aus ADR-0014 wirklich dasselbe bedeuten. Zwei Adapter, die je für sich
// richtig aussehen und verschieden antworten, sind der Ausfall, den diese
// Etappe ausschließen soll.

import { test } from "node:test";
import assert from "node:assert/strict";

import { baueStore } from "../../src/kernel/context/aufbau.js";
import { verarbeiteDokument } from "../../src/kernel/context/ingest/pipeline.js";

const OHNE_DB = !process.env.DATABASE_URL;
const nurMitDb = {
  skip: OHNE_DB ? "DATABASE_URL fehlt — siehe Dateikopf" : false,
};

const env = (over = {}) => ({
  tenantId: "t1",
  quelle: "q-test",
  dokumentId: "d1",
  sichtbarkeit: "oeffentlich",
  erlaubteGruppen: [],
  erlaubtePersonen: [],
  besitzerId: "u1",
  ...over,
});

const wer = (over = {}) => ({
  tenantId: "t1",
  benutzerId: "u2",
  gruppen: [],
  ...over,
});

const TEXT = "Rollout offene Punkte im dritten Quartal";

// Die Dokumente decken jede Zugangsregel und beide Grenzen ab.
const dokumente = () => [
  { envelope: env({ dokumentId: "d-oeffentlich" }), text: TEXT },
  {
    envelope: env({
      dokumentId: "d-gruppe",
      sichtbarkeit: "gruppe",
      erlaubteGruppen: ["technik"],
    }),
    text: TEXT,
  },
  {
    envelope: env({
      dokumentId: "d-privat",
      sichtbarkeit: "privat",
      besitzerId: "chef",
    }),
    text: TEXT,
  },
  {
    envelope: env({
      dokumentId: "d-freigabe",
      sichtbarkeit: "privat",
      besitzerId: "chef",
      erlaubtePersonen: ["u2"],
    }),
    text: TEXT,
  },
  {
    envelope: env({ dokumentId: "d-fremder-mandant", tenantId: "t2" }),
    text: TEXT,
  },
];

// Chunks bauen mit demselben Embedding, das der Speicher traegt — sonst
// laegen Dokument- und Fragevektor in verschiedenen Raeumen.
const chunksAus = async (doks, store) => {
  const alle = [];
  for (const d of doks)
    alle.push(...(await verarbeiteDokument(d, store.embedding)));
  return alle;
};

async function frischerPostgresStore() {
  const store = await baueStore("postgres");
  await store.leere();
  return store;
}

const idsVon = (treffer) =>
  [...new Set(treffer.map((t) => t.dokumentId))].sort();

test(
  "Postgres: Schema entsteht traege und mehrfaches Aufrufen stoert nicht",
  nurMitDb,
  async () => {
    // Idempotenz des DDL. Ein Adapter, der beim zweiten Start scheitert, wäre
    // im Betrieb ein Neustart, der nicht wiederkommt.
    const a = await baueStore("postgres");
    await a.leere();
    const b = await baueStore("postgres");
    assert.equal(await b.zaehle(), 0);
    await a.schliesse();
    await b.schliesse();
  },
);

test(
  "Postgres: der ACL-Filter steht IN der Abfrage, nicht dahinter",
  nurMitDb,
  async () => {
    // Was hier zurückkommt, hat die Datenbank bereits gefiltert. Der Beweis
    // dafür ist nicht diese Zusicherung, sondern die Mutationsprobe (siehe
    // EVALS.md §8): nimmt man die Mandantengrenze NUR aus dem SQL-Kompilat,
    // bleibt der memory-Lauf grün und dieser hier wird rot.
    const store = await frischerPostgresStore();
    try {
      await store.ersetzeQuelle("q-test", await chunksAus(dokumente(), store));
      const { treffer, grund } = await store.suche({
        principal: wer({ gruppen: ["technik"] }),
        anfrage: TEXT,
        k: 100,
      });
      assert.equal(grund, null);
      assert.deepEqual(idsVon(treffer), [
        "d-freigabe",
        "d-gruppe",
        "d-oeffentlich",
      ]);
    } finally {
      await store.schliesse();
    }
  },
);

test(
  "Postgres: fail-closed — ein unaufloesbarer Principal fragt die Datenbank gar nicht",
  nurMitDb,
  async () => {
    const store = await frischerPostgresStore();
    try {
      await store.ersetzeQuelle("q-test", await chunksAus(dokumente(), store));
      const r = await store.suche({
        principal: { tenantId: "t1" },
        anfrage: TEXT,
        k: 100,
      });
      assert.deepEqual(r.treffer, []);
      assert.equal(r.grund, "principal-nicht-aufloesbar");
    } finally {
      await store.schliesse();
    }
  },
);

test(
  "Postgres: ersetzeQuelle ist ATOMAR — ein Fehler laesst den alten Stand stehen",
  nurMitDb,
  async () => {
    // Die Anforderung, die ADR-0011 ausdrücklich an diese Etappe stellt. Im
    // Arbeitsspeicher ist Atomarität eine Zuweisung; hier muss sie mit einer
    // Transaktion hergestellt werden. Ohne sie bliebe nach einem Abbruch eine
    // LEERE Quelle zurück — und ein leeres Retrieval sieht in 3.13 makellos aus.
    const store = await frischerPostgresStore();
    try {
      await store.ersetzeQuelle("q-test", await chunksAus(dokumente(), store));
      const vorher = await store.zaehle();
      assert.ok(vorher > 0);

      // Ein Chunk mit zu langem Vektor: die Datenbank lehnt ab, MITTEN im
      // Schreiben, nachdem das DELETE schon gelaufen ist.
      const kaputt = await chunksAus(
        [{ envelope: env({ dokumentId: "d-kaputt" }), text: TEXT }],
        store,
      );
      kaputt[0].vektor = [...kaputt[0].vektor, 1, 2, 3];

      const gesund = await chunksAus(dokumente(), store);
      await assert.rejects(() =>
        store.ersetzeQuelle("q-test", [...gesund, ...kaputt]),
      );

      assert.equal(
        await store.zaehle(),
        vorher,
        "nach dem Rollback muss der alte Stand vollständig dastehen",
      );
    } finally {
      await store.schliesse();
    }
  },
);

test(
  "Postgres: ersetzeQuelle laesst fremde Quellen unberuehrt",
  nurMitDb,
  async () => {
    const store = await frischerPostgresStore();
    try {
      await store.ersetzeQuelle("q-test", await chunksAus(dokumente(), store));
      const andere = await chunksAus(
        [
          {
            envelope: env({ dokumentId: "d-andere", quelle: "q-andere" }),
            text: TEXT,
          },
        ],
        store,
      );
      await store.ersetzeQuelle("q-andere", andere);
      const gesamt = await store.zaehle();

      await store.ersetzeQuelle("q-test", []);

      const rest = await store.zaehle();
      assert.ok(rest > 0 && rest < gesamt);
      const { treffer } = await store.suche({
        principal: wer(),
        anfrage: TEXT,
        k: 100,
      });
      assert.deepEqual(idsVon(treffer), ["d-andere"]);
    } finally {
      await store.schliesse();
    }
  },
);

// ── Der Differenztest ────────────────────────────────────────────────────

test(
  "BEIDE Adapter liefern fuer dieselbe Frage dasselbe Ergebnis",
  nurMitDb,
  async () => {
    // Der eigentliche Beweis von ADR-0014. Die zwei Kompilate eines Regelwerks
    // sind nur dann eine Quelle, wenn sie auch dasselbe BEDEUTEN — und das
    // lässt sich nicht durch Hinsehen entscheiden, sondern nur durch Vergleich.
    //
    // Verglichen werden die Chunk-Ids in ihrer Reihenfolge, nicht nur die
    // Dokumente: die Reihenfolge trägt den Determinismus-Nachweis der Schicht A,
    // und zwei Adapter mit verschiedener Sortierung würden dort unterschiedliche
    // Berichte erzeugen, ohne dass eine Berechtigung verletzt wäre.
    const mem = await baueStore("memory");
    // Beide Speicher bekommen DIESELBEN Chunks — also auch dieselben
    // Dokumentvektoren. Was verglichen wird, ist der Filter, nicht das
    // Embedding.
    const chunks = await chunksAus(dokumente(), mem);
    await mem.ersetzeQuelle("q-test", chunks);

    const pg = await frischerPostgresStore();
    try {
      await pg.ersetzeQuelle("q-test", chunks);

      const principale = [
        wer(),
        wer({ gruppen: ["technik"] }),
        wer({ benutzerId: "chef" }),
        wer({ tenantId: "t2", benutzerId: "u2" }),
        wer({ benutzerId: "niemand", gruppen: ["gibtsnicht"] }),
      ];

      for (const principal of principale) {
        const frage = { principal, anfrage: TEXT, k: 100 };
        const a = await mem.suche(frage);
        const b = await pg.suche(frage);

        assert.deepEqual(
          b.treffer.map((t) => t.chunkId),
          a.treffer.map((t) => t.chunkId),
          `Principal ${principal.tenantId}/${principal.benutzerId}: verschiedene Treffer`,
        );
        assert.equal(b.grund, a.grund);
      }
    } finally {
      await pg.schliesse();
      await mem.schliesse();
    }
  },
);
