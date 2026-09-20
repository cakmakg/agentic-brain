// ── kernel/context/store/postgres.js ─────────────────────────────────────
// Der ZWEITE Adapter (ADR-0006, Etappe 3c). Er tritt NEBEN `memory`, nicht an
// seine Stelle: `npm run demo`, `npm test` und `npm run evals` laufen
// weiterhin ohne jede Infrastruktur (K5, ADR-0013).
//
// ERST DER ZWEITE ADAPTER BEWEIST DEN PORT. `store/index.js` sagt es selbst:
// ein Adapter beweist keine Grenze. Diese Datei ist der Beweis — und der
// Prüfbefehl dazu ist nicht ihre Existenz, sondern dieselbe Eval-Suite gegen
// sie, mit unveränderten 3.13 und 3.14.
//
// WORAN DIE ZUSAGE HIER HÄNGT — drei Stellen, jede mit eigener Begründung:
//
//   1. Der ACL-Filter steht IN der Abfrage (ADR-0008), im `WHERE` der
//      bewertenden Unterabfrage. Ein unberechtigter Chunk wird nicht einmal
//      BEWERTET, geschweige denn zurückgegeben. Nachgelagert zu filtern wäre
//      hier besonders verlockend und besonders falsch.
//   2. Die Bedingung stammt aus demselben Regelwerk wie das JS-Prädikat
//      (ADR-0014). Diese Datei formuliert KEINE eigene ACL-Regel — sie ruft
//      `sqlFilter(ab)` und setzt ein, was zurückkommt.
//   3. `ersetzeQuelle` läuft in einer TRANSAKTION. Im Arbeitsspeicher ist die
//      Atomarität geschenkt (eine Zuweisung), hier nicht: ohne Transaktion
//      gäbe es ein Fenster, in dem die Quelle gelöscht und noch nicht neu
//      geschrieben ist — eine gleichzeitige Suche fände dann nichts, und ein
//      Abbruch dazwischen ließe sie leer zurück. ADR-0011 nennt genau das als
//      Anforderung an diese Etappe.

import pg from "pg";

import { env } from "../../config/env.js";
import { terme } from "../embedding/index.js";
import { SPALTEN } from "../../retrieval/filter.js";

// So viele Zeilen je INSERT. Postgres verträgt 65535 gebundene Parameter je
// Anweisung; bei elf Spalten je Zeile wären das knapp 5900. 500 lässt reichlich
// Luft und hält die Anweisung lesbar, wenn sie je in einem Log landet.
const STAPEL = 500;

// pgvector erwartet den Vektor als Zeichenkette `[1,2,3]`. Kein `JSON.stringify`
// auf dem Array: das erzeugt dieselbe Form nur zufällig, und eine spätere
// Änderung an der Zahlenformatierung fiele niemandem auf.
const alsVektor = (v) => `[${v.join(",")}]`;

// Das Schema. Es wird aus `SPALTEN` gebaut, damit es mit dem SQL-Kompilat des
// Filters nicht auseinanderlaufen kann (ADR-0014) — ein Tippfehler in einem
// Spaltennamen tarnt sich sonst als leeres Suchergebnis.
//
// Die Vektorbreite kommt seit Etappe 3d vom EMBEDDING-Adapter, nicht mehr aus
// einer Konstante: `hash` liefert 64 Dimensionen, `voyage-4` liefert 1024.
// Damit haengt das Schema am gewaehlten Verfahren — siehe `pruefeDimension`
// unten, die aus einer kryptischen Postgres-Fehlermeldung eine verstaendliche
// macht.
const ddlFuer = (dimensionen) => `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS chunks (
    chunk_id                     text PRIMARY KEY,
    quelle                       text NOT NULL,
    dokument_id                  text NOT NULL,
    ${SPALTEN.tenantId}          text NOT NULL,
    ${SPALTEN.sichtbarkeit}      text NOT NULL,
    ${SPALTEN.erlaubteGruppen}   text[] NOT NULL DEFAULT '{}',
    ${SPALTEN.erlaubtePersonen}  text[] NOT NULL DEFAULT '{}',
    ${SPALTEN.besitzerId}        text NOT NULL,
    inhalt                       text NOT NULL,
    vektor                       vector(${dimensionen}) NOT NULL,
    terme                        text[] NOT NULL
  );

  -- Der Index auf die Quelle trägt ersetzeQuelle: jeder Zyklus löscht genau
  -- eine Quelle, und ohne Index wäre das ein voller Tabellendurchlauf.
  CREATE INDEX IF NOT EXISTS chunks_quelle_idx ON chunks (quelle);

  -- Und einer auf den Mandanten: er steht in JEDER Abfrage, weil die
  -- Mandantengrenze ein UND ist (ADR-0014).
  CREATE INDEX IF NOT EXISTS chunks_tenant_idx ON chunks (${SPALTEN.tenantId});
`;

const SPALTENLISTE = [
  "chunk_id",
  "quelle",
  "dokument_id",
  SPALTEN.tenantId,
  SPALTEN.sichtbarkeit,
  SPALTEN.erlaubteGruppen,
  SPALTEN.erlaubtePersonen,
  SPALTEN.besitzerId,
  "inhalt",
  "vektor",
  "terme",
];

// Ein Chunk zu seinen elf Werten, in der Reihenfolge von SPALTENLISTE.
const werte = (c) => [
  c.chunkId,
  c.envelope.quelle,
  c.envelope.dokumentId,
  c.envelope.tenantId,
  c.envelope.sichtbarkeit,
  c.envelope.erlaubteGruppen ?? [],
  c.envelope.erlaubtePersonen ?? [],
  c.envelope.besitzerId,
  c.text,
  alsVektor(c.vektor),
  [...c.terme],
];

async function schreibeStapel(client, chunks) {
  for (let i = 0; i < chunks.length; i += STAPEL) {
    const teil = chunks.slice(i, i + STAPEL);
    const params = [];
    const zeilen = teil.map((c) => {
      const platz = werte(c).map((w) => {
        params.push(w);
        return `$${params.length}`;
      });
      // Nur der Vektor braucht eine Umwandlung; alles andere kommt typrichtig
      // aus dem Treiber.
      platz[9] = `${platz[9]}::vector`;
      return `(${platz.join(", ")})`;
    });
    await client.query(
      `INSERT INTO chunks (${SPALTENLISTE.join(", ")}) VALUES ${zeilen.join(", ")}`,
      params,
    );
  }
}

// ── Schema anlegen UND die Vektorbreite pruefen. ────────────────────────
// `CREATE TABLE IF NOT EXISTS` laesst eine bestehende Tabelle in Ruhe. Wer
// den Embedding-Adapter wechselt (64 → 1024 Dimensionen), bekaeme daher
// eine Tabelle mit der ALTEN Breite und beim ersten INSERT eine kryptische
// Meldung ueber „expected 64 dimensions". Diese Pruefung sagt stattdessen,
// was wirklich los ist und was zu tun ist.
//
// Absichtlich KEIN automatisches Migrieren: die Tabelle zu verwerfen ist
// ein Datenverlust, und den entscheidet kein Adapter im Vorbeigehen.
async function herstellen(pool, embedding) {
  await pool.query(ddlFuer(embedding.dimensionen));
  const r = await pool.query(
    `SELECT atttypmod AS breite FROM pg_attribute
      WHERE attrelid = 'chunks'::regclass AND attname = 'vektor'`,
  );
  const breite = r.rows[0]?.breite;
  if (breite !== embedding.dimensionen) {
    throw new Error(
      `Postgres: die Tabelle "chunks" hat vector(${breite}), das Embedding "${embedding.name}" liefert ${embedding.dimensionen}. ` +
        "Ein Adapterwechsel braucht eine neue Tabelle: DROP TABLE chunks; (oder `docker compose down` und neu hoch).",
    );
  }
}

// ── Die hybride Abfrage. ─────────────────────────────────────────────────
// Neben `ddlFuer`, weil sie dieselben Spalten nennt: wer das Schema aendert,
// sieht die Abfrage im selben Blick. Der ACL-Filter kommt als fertige
// WHERE-Klausel herein und steht IN der CTE — nicht dahinter. Ein Filter
// hinter dem `LIMIT` haette die verbotenen Zeilen erst gelesen und dann
// verworfen; dazwischen liegt ein Log, ein Trace, ein Fehlerpfad.
function sucheSql(whereKlausel, limitPlatz) {
  return `
    WITH bewertet AS (
      SELECT
        chunk_id,
        dokument_id,
        inhalt,
        quelle,
        ${SPALTEN.tenantId},
        ${SPALTEN.sichtbarkeit},
        ${SPALTEN.erlaubteGruppen},
        ${SPALTEN.erlaubtePersonen},
        ${SPALTEN.besitzerId},
        0.5 * (1 - (vektor <=> $1::vector))
          + 0.5 * (
            CASE WHEN $3 = 0 THEN 0
                 ELSE (
                   SELECT count(*) FROM unnest($2::text[]) AS f(t)
                   WHERE f.t = ANY(terme)
                 )::float8 / $3
            END
          ) AS wert
      FROM chunks
      WHERE ${whereKlausel}
    )
    SELECT * FROM bewertet
    WHERE wert > 0
    ORDER BY wert DESC, chunk_id ASC
    LIMIT ${limitPlatz}
`;
}

// ── Der gezielte Abruf (ADR-0019, T1) ────────────────────────────────────
// Ein benanntes Dokument, vollständig, in Absatzreihenfolge — und derselbe
// ACL-Filter an derselben Stelle: IN dem `WHERE`, das die Zeilen liest. Kein
// `wert > 0` und kein `LIMIT`: hier entscheidet keine Relevanz, weder über die
// Auswahl noch über die Länge.
//
// `$1` ist die Dokumentkennung, der Filter beginnt ab `$2`.
//
// `NULL::float8 AS wert` hält die Form der Zeile gleich mit der Suche. Die
// Sortierung nimmt die ABSATZZAHL, nicht die Zeichenkette: `chunk_id` endet auf
// `#<i>`, und lexikalisch stünde `#10` vor `#2` — der `memory`-Adapter sortiert
// dieselbe Zahl.
function gezieltSql(whereKlausel) {
  return `
    SELECT
      chunk_id,
      dokument_id,
      inhalt,
      quelle,
      ${SPALTEN.tenantId},
      ${SPALTEN.sichtbarkeit},
      ${SPALTEN.erlaubteGruppen},
      ${SPALTEN.erlaubtePersonen},
      ${SPALTEN.besitzerId},
      NULL::float8 AS wert
    FROM chunks
    WHERE dokument_id = $1 AND (${whereKlausel})
    ORDER BY (split_part(chunk_id, '#', 2))::int ASC
`;
}

// Eine Zeile wird zum Treffer. Die Envelope wird wieder zusammengesetzt, damit
// der Aufrufer adapterunabhängig dasselbe sieht wie beim `memory`-Adapter —
// deshalb steht diese Übersetzung an EINER Stelle und wird von beiden Kippen
// benutzt. Zwei Kopien liefen auseinander, und der Unterschied wäre eine
// Verhaltensänderung, die keine Metrik meldet.
//
// `wert` bleibt `null`, wenn die Zeile aus dem gezielten Abruf kommt:
// `Number(null)` wäre 0, und 0 hieße „ohne Relevanz bewertet" statt
// „nicht bewertet".
const alsTreffer = (z) => ({
  chunkId: z.chunk_id,
  dokumentId: z.dokument_id,
  text: z.inhalt,
  envelope: {
    tenantId: z[SPALTEN.tenantId],
    quelle: z.quelle,
    dokumentId: z.dokument_id,
    sichtbarkeit: z[SPALTEN.sichtbarkeit],
    erlaubteGruppen: z[SPALTEN.erlaubteGruppen],
    erlaubtePersonen: z[SPALTEN.erlaubtePersonen],
    besitzerId: z[SPALTEN.besitzerId],
  },
  wert: z.wert === null ? null : Number(z.wert),
});

export function createPostgresAdapter({ connectionString, embedding } = {}) {
  const url = connectionString || env.databaseUrl;
  if (!url) {
    throw new Error(
      "createPostgresAdapter: DATABASE_URL fehlt. Der Adapter rät keine Verbindung — " +
        "ein Lauf gegen die falsche Datenbank ist schlimmer als einer, der nicht startet.",
    );
  }

  const pool = new pg.Pool({ connectionString: url, max: 4 });

  // Das Schema wird EINMAL je Adapter sichergestellt, träge beim ersten
  // Zugriff. Ein Modul-Seiteneffekt beim Import wäre schlimmer: dann bräuchte
  // schon `import` eine laufende Datenbank, und K5 wäre über einen Umweg
  // gebrochen.
  let bereit = null;
  const stelleSicher = () => (bereit ??= herstellen(pool, embedding));

  return {
    name: "postgres",

    async schreibe(neue) {
      await stelleSicher();
      if (neue.length === 0) return 0;
      const client = await pool.connect();
      try {
        await schreibeStapel(client, neue);
      } finally {
        client.release();
      }
      return neue.length;
    },

    // ── Atomarer Ersatz einer Quelle (ADR-0011). ────────────────────────
    // Löschen und Neuschreiben in EINER Transaktion. Das ist die Stelle, auf
    // die `memory.js` ausdrücklich verweist: dort ist die Atomarität eine
    // Zuweisung, hier muss sie hergestellt werden.
    async ersetzeQuelle(quelle, neue) {
      await stelleSicher();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const weg = await client.query("DELETE FROM chunks WHERE quelle = $1", [
          quelle,
        ]);
        await schreibeStapel(client, neue);
        await client.query("COMMIT");
        return { entfernt: weg.rowCount, geschrieben: neue.length };
      } catch (e) {
        // ROLLBACK darf den ursprünglichen Fehler nicht verdecken: was hier
        // schiefging, ist die Ursache, nicht das Aufräumen.
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },

    async zaehle() {
      await stelleSicher();
      const r = await pool.query("SELECT count(*)::int AS n FROM chunks");
      return r.rows[0].n;
    },

    async leere() {
      await stelleSicher();
      await pool.query("TRUNCATE chunks");
    },

    // ── Hybride Suche, beide Pfade gefiltert ────────────────────────────
    // Die Form ist dieselbe wie im `memory`-Adapter, und das ist Absicht: ein
    // Unterschied hier wäre eine stille Verhaltensänderung zwischen zwei
    // Adaptern, die dieselbe Metrik tragen sollen.
    //
    //   vektorWert = 1 - Kosinusdistanz      (pgvector `<=>`)
    //   lexWert    = getroffene Frageterme / alle Frageterme
    //   wert       = 0.5 * vektorWert + 0.5 * lexWert
    //
    // DER FILTER STEHT IM `WHERE` DER BEWERTENDEN UNTERABFRAGE, nicht darüber.
    // Damit wird ein unberechtigter Chunk nicht bewertet und nicht sortiert —
    // er verlässt die Datenbank nie (ADR-0008).
    async suche({ sqlFilter, anfrage, k, dokumentId = null }) {
      await stelleSicher();

      // Die gezielte Kippe: kein Einbettungsaufruf, keine Termliste, kein
      // Limit — nur der Filter und die Absatzreihenfolge.
      if (dokumentId) {
        const filter = sqlFilter(2); // $1 ist die Dokumentkennung
        const r = await pool.query(gezieltSql(filter.where), [
          dokumentId,
          ...filter.params,
        ]);
        return r.rows.map(alsTreffer);
      }

      // `"anfrage"` und nicht `"dokument"`: ein echtes Retrieval-Modell
      // bettet die Frage anders ein als den Text, den sie finden soll
      // (ADR-0015).
      const frageVektor = alsVektor(
        await embedding.einbette(anfrage, "anfrage"),
      );
      // Entdoppelt, weil der `memory`-Adapter über ein Set rechnet. Ohne das
      // wäre der Nenner des lexikalischen Pfades ein anderer und die beiden
      // Adaptern lieferten verschiedene Werte für dieselbe Frage.
      const frageTerme = [...new Set(terme(anfrage))];

      // $1 Vektor · $2 Termliste · $3 Anzahl Terme · ab $4 der Filter · zuletzt k
      const filter = sqlFilter(4);
      const params = [
        frageVektor,
        frageTerme,
        frageTerme.length,
        ...filter.params,
        k,
      ];
      const limitPlatz = `$${params.length}`;

      const sql = sucheSql(filter.where, limitPlatz);

      const r = await pool.query(sql, params);

      return r.rows.map(alsTreffer);
    },

    // Optional im Port: ohne sie hielte der Verbindungspool den Prozess offen
    // und ein Eval-Lauf endete nie von selbst.
    async schliesse() {
      await pool.end();
    },
  };
}
