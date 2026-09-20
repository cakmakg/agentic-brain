// ── tests/identitaet.test.js ─────────────────────────────────────────────
// Prüft den Identitäts-Port: wird ein Principal AUFGELÖST statt geglaubt, und
// hält die Frist?
//
// Der Messpunkt ist nicht der Principal, sondern die Zahl der Verzeichnis-
// Aufrufe. Am zurückgegebenen Objekt sieht man nicht, ob es frisch erfragt
// oder aus dem Speicher gereicht wurde — beide sind gleich. Genau deshalb
// zählt der Auflöser mit: ohne diese Zahl wäre „abgelaufen und neu aufgelöst"
// von „einfach weiterverwendet" nicht zu unterscheiden, und das zweite
// Tor-Kriterium von Etappe 4a nicht prüfbar.
//
// Die Uhr wird eingespeist, nicht abgewartet. Ein Test, der schläft, misst die
// Uhr und nicht die Regel — und wird bei Gelegenheit flockig.

import { test } from "node:test";
import assert from "node:assert/strict";

const { createAufloeser, pruefeAdapter, FRIST_MS } =
  await import("../src/kernel/governance/identitaet/index.js");
const { createFixturesAufloeser } =
  await import("../src/kernel/governance/identitaet/fixtures.js");

const ANNA = { tenantId: "t1", benutzerId: "anna", gruppen: ["team-a"] };
const BODO = { tenantId: "t2", benutzerId: "bodo", gruppen: [] };

const verzeichnis = { "nachweis-anna": ANNA, "nachweis-bodo": BODO };

// Eine einspeisbare Uhr: der Test bestimmt, wann Zeit vergeht.
function uhr(start = 0) {
  let t = start;
  return { jetzt: () => t, weiter: (ms) => (t += ms) };
}

test("ein Nachweis wird zu einem Principal aufgeloest", async () => {
  const adapter = createFixturesAufloeser({ verzeichnis });
  const a = createAufloeser({ adapter, jetzt: () => 0 });

  assert.deepEqual(await a.aufloese("nachweis-anna"), ANNA);
  assert.deepEqual(await a.aufloese("nachweis-bodo"), BODO);
  assert.equal(a.name, "fixtures", "der Adaptername gehoert in den Bericht");
});

test("ein unbekannter oder leerer Nachweis ergibt null — nicht einen Principal", async () => {
  const adapter = createFixturesAufloeser({ verzeichnis });
  const a = createAufloeser({ adapter, jetzt: () => 0 });

  assert.equal(await a.aufloese("nachweis-fremd"), null);
  assert.equal(await a.aufloese(""), null);
  assert.equal(await a.aufloese(undefined), null);
  assert.equal(
    await a.aufloese({ tenantId: "t1", benutzerId: "anna", gruppen: [] }),
    null,
    "ein fertig geformtes Objekt ist KEIN Nachweis — genau das war der alte Zustand",
  );
});

test("ein Nicht-String erreicht das Verzeichnis gar nicht erst", async () => {
  // Der Fixtures-Adapter gaebe fuer `undefined` ohnehin null zurueck — mit ihm
  // allein ist diese Schranke also unpruefbar (Mutationsprobe M3 blieb gruen).
  // Ein echtes Verzeichnis ist nicht so gutmuetig: ein Objekt als "Token" kann
  // dort zu einer Anfrage werden, die etwas anderes bedeutet. Der Port darf so
  // etwas nicht weiterreichen, und genau das misst dieser Spion.
  const gesehen = [];
  const a = createAufloeser({
    adapter: {
      name: "spion",
      async aufloese(nachweis) {
        gesehen.push(nachweis);
        return ANNA;
      },
    },
    jetzt: () => 0,
  });

  assert.equal(await a.aufloese(undefined), null);
  assert.equal(await a.aufloese(null), null);
  assert.equal(await a.aufloese(42), null);
  assert.equal(await a.aufloese({ benutzerId: "anna" }), null);
  assert.equal(await a.aufloese(""), null);

  assert.deepEqual(gesehen, [], "kein einziger dieser Werte darf hinausgehen");
  assert.equal(a.statistik.verzeichnisAufrufe, 0);
});

test("innerhalb der Frist wird das Verzeichnis nicht erneut gefragt", async () => {
  const u = uhr();
  const a = createAufloeser({
    adapter: createFixturesAufloeser({ verzeichnis }),
    fristMs: 1000,
    jetzt: u.jetzt,
  });

  await a.aufloese("nachweis-anna");
  u.weiter(999);
  await a.aufloese("nachweis-anna");

  assert.equal(a.statistik.verzeichnisAufrufe, 1);
  assert.equal(a.statistik.treffer, 1);
});

test("ein abgelaufener Eintrag wird NEU aufgeloest, nicht weiterverwendet", async () => {
  const u = uhr();
  const a = createAufloeser({
    adapter: createFixturesAufloeser({ verzeichnis }),
    fristMs: 1000,
    jetzt: u.jetzt,
  });

  await a.aufloese("nachweis-anna");
  u.weiter(1001);
  await a.aufloese("nachweis-anna");

  // Das ist das zweite Tor-Kriterium von Etappe 4a, als Zahl.
  assert.equal(a.statistik.verzeichnisAufrufe, 2);
  assert.equal(
    a.statistik.treffer,
    0,
    "nach Ablauf darf es keinen Treffer geben",
  );
});

test("ein negatives Ergebnis wird NICHT zwischengespeichert", async () => {
  const u = uhr();
  let aufrufe = 0;
  const a = createAufloeser({
    adapter: {
      name: "stoerung",
      async aufloese() {
        aufrufe += 1;
        return null; // das Verzeichnis antwortet nicht brauchbar
      },
    },
    fristMs: 1_000_000,
    jetzt: u.jetzt,
  });

  assert.equal(await a.aufloese("nachweis-anna"), null);
  assert.equal(await a.aufloese("nachweis-anna"), null);

  // Waere das Nein gespeichert, bliebe es fuer die Dauer der Frist stehen: aus
  // einer Stoerung des Verzeichnisses wuerde eine Berechtigungsentscheidung.
  assert.equal(aufrufe, 2, "jedes Nein wird neu erfragt");
});

test("vergiss() nimmt einen Principal sofort aus dem Speicher", async () => {
  const u = uhr();
  const a = createAufloeser({
    adapter: createFixturesAufloeser({ verzeichnis }),
    fristMs: 1_000_000,
    jetzt: u.jetzt,
  });

  await a.aufloese("nachweis-anna");
  assert.equal(a.vergiss("nachweis-anna"), true);
  await a.aufloese("nachweis-anna");

  // Ohne diesen Weg muesste ein Entzug die Frist abwarten — und ein Entzug,
  // auf den man warten muss, ist in einem Sicherheitsmodell keiner.
  assert.equal(a.statistik.verzeichnisAufrufe, 2);
});

test("der Port lehnt einen Adapter ab, der seinen Vertrag nicht erfuellt", () => {
  assert.throws(() => pruefeAdapter(null), /aufloese/);
  assert.throws(() => pruefeAdapter({ name: "x" }), /aufloese/);
  assert.throws(() => pruefeAdapter({ aufloese: () => null }), /name/);
  // Eine Frist von null waere kein Zwischenspeicher, unendlich waere ein
  // dauerhafter — beides ist ausdruecklich nicht gewollt.
  const adapter = createFixturesAufloeser({ verzeichnis });
  assert.throws(() => createAufloeser({ adapter, fristMs: 0 }), /fristMs/);
  assert.throws(
    () => createAufloeser({ adapter, fristMs: Infinity }),
    /fristMs/,
  );
});

test("ein Fixtures-Verzeichnis mit kaputtem Eintrag faellt beim BAU auf", () => {
  assert.throws(
    () =>
      createFixturesAufloeser({ verzeichnis: { x: { benutzerId: "anna" } } }),
    /auflösbarer Principal/,
    "sonst sieht ein Datenfehler im Lauf aus wie eine abgelehnte Identitaet",
  );
});

test("die Standardfrist ist endlich", () => {
  assert.ok(Number.isFinite(FRIST_MS) && FRIST_MS > 0);
});
