// ── tests/connectors.test.js ─────────────────────────────────────────────
// Die Connector-Ebene ① und die Synchronisation (ADR-0011).
//
// Der wertvollste Test dieser Datei ist „ein Dokument, das die Momentaufnahme
// nicht mehr enthält, ist nach der Synchronisation verschwunden". Er prüft
// die Zusage, die Metrik 3.14 misst, an ihrer Wurzel: nicht dass ein
// Löschpfad richtig arbeitet, sondern dass es keinen braucht.
//
// Der zweitwertvollste ist „ersetzeQuelle lässt Chunks anderer Quellen
// unberührt". Ohne ihn sähe ein Speicher, der bei jedem Zyklus ALLES verwirft,
// in jedem anderen Test dieser Datei genauso aus wie ein richtiger.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createConnector } from "../src/kernel/connectors/index.js";
import { synchronisiere } from "../src/kernel/connectors/synchronisation.js";
import { baueStore } from "../src/kernel/context/aufbau.js";
import { createStore } from "../src/kernel/context/store/index.js";
import { createMemoryAdapter } from "../src/kernel/context/store/memory.js";

const env = (over = {}) => ({
  tenantId: "t1",
  quelle: "q1",
  dokumentId: "d1",
  sichtbarkeit: "oeffentlich",
  erlaubteGruppen: [],
  besitzerId: "u1",
  ...over,
});

const wer = (over = {}) => ({
  tenantId: "t1",
  benutzerId: "u2",
  gruppen: [],
  ...over,
});

// Ein Connector über einer veränderbaren Liste. Er steht für jede Quelle:
// der Port kennt nur `quelle` und `hole`.
function fixtureConnector(quelle, dokumente) {
  const zustand = { dokumente: [...dokumente] };
  return {
    zustand,
    connector: createConnector({
      quelle,
      hole: () => zustand.dokumente,
    }),
  };
}

const dok = (id, text = "Rollout offene Punkte", over = {}) => ({
  envelope: env({ dokumentId: id, ...over }),
  text,
});

// ── Der Port ─────────────────────────────────────────────────────────────

test("Connector-Port: ein Adapter ohne Quelle wird LAUT abgelehnt", () => {
  assert.throws(() => createConnector({ hole: () => [] }), /keine Quelle/);
  assert.throws(
    () => createConnector({ quelle: "", hole: () => [] }),
    /keine Quelle/,
  );
});

test("Connector-Port: ein Adapter ohne hole() wird LAUT abgelehnt", () => {
  assert.throws(() => createConnector({ quelle: "q1" }), /hole/);
  assert.throws(
    () => createConnector({ quelle: "q1", hole: "nein" }),
    /keine Funktion/,
  );
});

test("Connector-Port: hole() muss eine Liste liefern", () => {
  const c = createConnector({ quelle: "q1", hole: () => ({}) });
  assert.throws(() => c.hole(), /keine Liste/);
});

test("Connector-Port: ein FREMD etikettiertes Dokument scheitert am Port", () => {
  // Das ist kein Formfehler, sondern ein Angriffsweg: über ein fremdes
  // Etikett könnte ein Connector die Momentaufnahme einer ANDEREN Quelle
  // austauschen. Er muss dort scheitern, wo er entsteht.
  const c = createConnector({
    quelle: "q1",
    hole: () => [dok("d1", "x", { quelle: "q2" })],
  });
  assert.throws(() => c.hole(), /etikettiert/);
});

// ── Die Synchronisation ──────────────────────────────────────────────────

test("Synchronisation: ein Zyklus schreibt die ganze Momentaufnahme", async () => {
  const store = await baueStore("memory");
  const { connector } = fixtureConnector("q1", [dok("d1"), dok("d2")]);

  const bericht = await synchronisiere(store, connector);

  assert.equal(bericht.dokumente, 2);
  assert.equal(bericht.quelle, "q1");
  assert.ok(bericht.chunks > 0);
  assert.equal(await store.zaehle(), bericht.chunks);
});

test("ein Dokument, das die Momentaufnahme nicht mehr enthaelt, ist nach der Synchronisation verschwunden", async () => {
  // DIE ZUSAGE VON ADR-0011, an ihrer Wurzel. Es gibt keinen Löschpfad, den
  // jemand vergessen könnte — das Dokument ist weg, weil es nicht mehr da ist.
  const store = await baueStore("memory");
  const { zustand, connector } = fixtureConnector("q1", [dok("d1"), dok("d2")]);
  await synchronisiere(store, connector);

  const frage = {
    store,
    principal: wer(),
    anfrage: "Rollout offene Punkte",
    k: 100,
  };

  zustand.dokumente = zustand.dokumente.filter(
    (d) => d.envelope.dokumentId !== "d2",
  );
  const bericht = await synchronisiere(store, connector);

  assert.ok(bericht.entfernt > 0, "der alte Stand muss entfernt worden sein");
  assert.equal(bericht.dokumente, 1);

  const ids = (
    await store.suche({
      principal: frage.principal,
      anfrage: frage.anfrage,
      k: 100,
    })
  ).treffer.map((t) => t.dokumentId);
  assert.ok(ids.includes("d1"));
  assert.ok(!ids.includes("d2"), "d2 darf nach dem Zyklus nicht mehr kommen");
});

test("Synchronisation: eine enger gewordene Berechtigung kommt mit der NEUEN Envelope zurueck", async () => {
  const store = await baueStore("memory");
  const { zustand, connector } = fixtureConnector("q1", [dok("d1")]);
  await synchronisiere(store, connector);

  const fremder = wer({ benutzerId: "u9" });
  const sichtbar = async () =>
    (
      await store.suche({
        principal: fremder,
        anfrage: "Rollout offene Punkte",
        k: 100,
      })
    ).treffer.map((t) => t.dokumentId);

  assert.deepEqual(await sichtbar(), ["d1"], "oeffentlich: sichtbar");

  zustand.dokumente = [
    dok("d1", "Rollout offene Punkte", { sichtbarkeit: "privat" }),
  ];
  await synchronisiere(store, connector);

  assert.deepEqual(await sichtbar(), [], "privat: nicht mehr sichtbar");
});

test("ersetzeQuelle laesst Chunks anderer Quellen unberuehrt", async () => {
  // Ohne diesen Test sähe ein Speicher, der bei jedem Zyklus ALLES verwirft,
  // in jedem anderen Test dieser Datei genauso aus wie ein richtiger — und in
  // Metrik 3.14 makellos.
  const store = await baueStore("memory");
  const a = fixtureConnector("q1", [dok("d1")]);
  const b = fixtureConnector("q2", [
    dok("d9", "Rollout offene Punkte", { quelle: "q2" }),
  ]);

  await synchronisiere(store, a.connector);
  await synchronisiere(store, b.connector);
  const gesamt = await store.zaehle();

  // q1 leeren — q2 muss vollständig bleiben.
  a.zustand.dokumente = [];
  await synchronisiere(store, a.connector);

  const ids = (
    await store.suche({
      principal: wer(),
      anfrage: "Rollout offene Punkte",
      k: 100,
    })
  ).treffer.map((t) => t.dokumentId);
  assert.ok(!ids.includes("d1"));
  assert.ok(
    ids.includes("d9"),
    "die fremde Quelle darf nicht mitgelöscht werden",
  );
  const rest = await store.zaehle();
  assert.ok(rest > 0 && rest < gesamt);
});

test("Synchronisation: eine unvollstaendige Envelope wirft und ersetzt NICHTS", async () => {
  // Der eingehandelte Preis aus ADR-0011, als Test: schlägt ein Zyklus fehl,
  // bleibt der ALTE Stand stehen. Wer den Fehler schluckt, behält alte
  // Berechtigungen — deshalb muss er laut sein.
  const store = await baueStore("memory");
  const { zustand, connector } = fixtureConnector("q1", [dok("d1")]);
  await synchronisiere(store, connector);
  const vorher = await store.zaehle();

  zustand.dokumente = [
    dok("d1"),
    { envelope: { ...env({ dokumentId: "d2" }), besitzerId: "" }, text: "x" },
  ];

  await assert.rejects(() => synchronisiere(store, connector), /besitzerId/);
  assert.equal(await store.zaehle(), vorher, "nichts darf ersetzt worden sein");
});

// ── Der Store-Port ───────────────────────────────────────────────────────

test("Store-Port: ein Adapter ohne ersetzeQuelle wird LAUT abgelehnt", () => {
  const halb = createMemoryAdapter();
  delete halb.ersetzeQuelle;
  assert.throws(() => createStore(halb), /ersetzeQuelle/);
});

test("Store-Port: ein Chunk mit fremder Quelle scheitert vor dem Adapter", async () => {
  // Zweites Netz unter der Etikettenprüfung des Connector-Ports: die Regel
  // gilt für JEDEN Adapter, nicht nur für die, die daran denken.
  const store = await baueStore("memory");
  await assert.rejects(
    () =>
      store.ersetzeQuelle("q1", [
        { chunkId: "x#0", envelope: env({ quelle: "q2" }), text: "x" },
      ]),
    /ersetzt wird aber/,
  );
});
