// ── tests/policy.test.js ─────────────────────────────────────────────────
// Etappe 4c: jede Aktion trägt eine RISIKOKLASSE, und die menschliche
// Genehmigung hat eine FRIST mit Voreinstellung deny.
//
// Die Klasse wird vergeben und protokolliert, sie routet nicht (A5) — deshalb
// prüft diese Datei nur, DASS sie da ist und WO sie steht, nicht, was sie
// bewirkt. Wirksam wird sie erst in Etappe 14b.
//
// Der wertvollste Test ist „eine abgelaufene Genehmigung reiht nichts ein und
// stellt nichts zu". Ohne ihn wäre die Frist eine Zahl im Trace, und ein
// spätes „ja" ginge trotzdem durch die Kante in `build.js`.
//
// Die Uhr ist EINGESPEIST, nicht abgewartet: ein Test, der schläft, misst die
// Uhr und nicht die Regel.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { frischerZustand } from "./helpers/zustand.js";

frischerZustand();

const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-policy-"));
process.env.TRACE_DIR = traceDir;

const { MOCK_LLM } = await import("../src/kernel/config/env.js");
const { baueStore } = await import("../src/kernel/context/aufbau.js");
const { synchronisiere } =
  await import("../src/kernel/connectors/synchronisation.js");
const { pruefeTraceKette } = await import("../src/kernel/governance/trace.js");
const { RISIKOSTUFEN, pruefeRisikoklasse } =
  await import("../src/kernel/policy/risk.js");
const { klassifiziere } = await import("../src/kernel/policy/engine.js");
const { createActionQueue } = await import("../src/kernel/action/queue.js");
const { erzeugeAktionsflaeche } =
  await import("../src/kernel/action/flaeche.js");

await import("../src/domains/besprechung/domain.js");
const { getRunner } = await import("../src/kernel/registry.js");
const { createNotizlaufwerk } =
  await import("../src/domains/besprechung/connectors/notizlaufwerk.js");
const { setzeLeseweg } = await import("../src/domains/besprechung/leseweg.js");
const { getEntwurf } =
  await import("../src/domains/besprechung/agents/entwurf.js");
const { getQueue, risikoklassen: besprechungKlassen } =
  await import("../src/domains/besprechung/actions.js");
const { risikoklassen: beispielKlassen } =
  await import("../src/domains/beispiel/actions.js");

// Die Uhr dieses Prozesses. Der Runner wird HIER zum ersten Mal gebaut — die
// Optionen wirken nur beim ersten Bau (siehe den Registry-Test unten).
const FRIST_MS = 60_000;
let uhr = 1_000_000_000_000;
const runner = getRunner("besprechung", {
  jetzt: () => uhr,
  genehmigungsFristMs: FRIST_MS,
});

before(() =>
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  ),
);
after(() => fs.rmSync(traceDir, { recursive: true, force: true }));

// Eine Notiz, für jeden im Mandanten sichtbar: gemessen wird die FRIST,
// nicht der Leseweg.
const QUELLE = {
  tenantId: "t1",
  quelle: "notizlaufwerk",
  ordner: [
    { ordnerId: "o-alle", name: "Alle", elternId: null, sichtbarFuer: ["*"] },
  ],
  besprechungen: [
    {
      besprechungId: "b-x",
      titel: "Runde",
      datum: "2026-09-01",
      organisatorId: "otto",
      teilnehmer: ["otto"],
    },
  ],
  notizen: [
    {
      notizId: "n-frei",
      besprechungId: "b-x",
      ordnerId: "o-alle",
      titel: "Fuer alle",
      text: "Offene Punkte, die jeder im Mandanten sehen darf.",
      freigegebenAn: [],
      vertraulich: false,
    },
  ],
};

const MIA = { tenantId: "t1", benutzerId: "mia", gruppen: [] };
const OTTO = { tenantId: "t1", benutzerId: "otto", gruppen: ["leitung"] };
const TASK = "Aktionspunkte aus notiz:n-frei zum Rollout.";

let store = null;

beforeEach(async () => {
  if (store) await store.schliesse();
  store = await baueStore("memory");
  await synchronisiere(store, createNotizlaufwerk(QUELLE).connector);
  setzeLeseweg(store);
});

after(async () => {
  setzeLeseweg(null);
  if (store) await store.schliesse();
});

const lies = (runId) =>
  fs
    .readFileSync(path.join(traceDir, `${runId}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((z) => JSON.parse(z));

const queueFor = (threadId) =>
  getQueue().filter((a) => a.threadId === threadId);

const laufEnde = (threadId) =>
  lies(threadId)
    .filter((z) => z.type === "run_end")
    .map((z) => z.status);

async function wartenderLauf() {
  const threadId = crypto.randomUUID();
  const { interrupted } = await runner.startWorkflow({
    task: TASK,
    threadId,
    principal: MIA,
  });
  assert.equal(interrupted, true, "Der Lauf muss am Tor warten");
  return threadId;
}

const genehmige = (threadId) =>
  runner.resolveApproval({
    threadId,
    entscheidung: { genehmigt: true, genehmigender: OTTO },
  });

// ── Die Frist ────────────────────────────────────────────────────────────

test("DAS TOR VON 4c: eine abgelaufene Genehmigung → deny, nichts eingereiht, nichts zugestellt", async () => {
  const threadId = await wartenderLauf();
  uhr += FRIST_MS + 1;

  const ergebnis = await genehmige(threadId);

  assert.equal(ergebnis.angewandt, false);
  assert.match(ergebnis.grund, /Genehmigung abgelaufen/);
  assert.equal(queueFor(threadId).length, 0, "Nichts eingereiht");
  assert.equal(
    getEntwurf(threadId)?.status,
    "AWAITING_APPROVAL",
    "Nichts zugestellt",
  );

  const zeilen = lies(threadId);
  const abgelaufen = zeilen.find((z) => z.type === "entscheidung_abgelaufen");
  assert.ok(abgelaufen, "Der Ablauf gehört ins Audit");
  assert.equal(abgelaufen.wartet_ms, FRIST_MS + 1);
  assert.equal(abgelaufen.frist_ms, FRIST_MS);

  // Wirksam wurde ein Nein — mit dem, der zu spät Ja sagte.
  const resume = zeilen.find((z) => z.type === "run_resume");
  assert.equal(resume.humanApproval, false);
  assert.equal(resume.genehmigender, "otto");

  assert.deepEqual(laufEnde(threadId), ["EXPIRED"]);
  assert.equal(
    zeilen.some((z) => z.node === "ticketdienst"),
    false,
    "Der Terminalknoten darf nicht gelaufen sein",
  );
  assert.equal(pruefeTraceKette(threadId).ok, true);
});

test("Eine rechtzeitige Genehmigung → PUBLISHED, und die Aktion trägt ihre Risikoklasse", async () => {
  const threadId = await wartenderLauf();
  // Genau an der Grenze ist noch rechtzeitig: abgelaufen ist erst „mehr als".
  uhr += FRIST_MS;

  const ergebnis = await genehmige(threadId);

  assert.equal(ergebnis.angewandt, true);
  const aktionen = queueFor(threadId);
  assert.equal(aktionen.length, 1);
  assert.equal(aktionen[0].risikoklasse, 2);
  assert.equal(getEntwurf(threadId)?.status, "ZUGESTELLT");

  const zeilen = lies(threadId);
  assert.deepEqual(laufEnde(threadId), ["PUBLISHED"]);
  assert.equal(
    zeilen.some((z) => z.type === "entscheidung_abgelaufen"),
    false,
  );
  // Jede Aktion trägt eine Risikoklasse IM TRACE, nicht nur in der Queue.
  const terminal = zeilen.find((z) => z.node === "ticketdienst");
  assert.equal(terminal?.risikoklasse, 2);
  assert.equal(pruefeTraceKette(threadId).ok, true);
});

test("Fehlt `wartetSeit`, gilt die Genehmigung als abgelaufen (fail-closed)", async () => {
  const threadId = await wartenderLauf();
  const config = { configurable: { thread_id: threadId } };
  await runner.app.updateState(config, { wartetSeit: null });

  const ergebnis = await genehmige(threadId);

  assert.equal(ergebnis.angewandt, false);
  assert.match(ergebnis.grund, /Wartebeginn ist unbekannt/);
  assert.equal(queueFor(threadId).length, 0);
  assert.equal(getEntwurf(threadId)?.status, "AWAITING_APPROVAL");

  const abgelaufen = lies(threadId).find(
    (z) => z.type === "entscheidung_abgelaufen",
  );
  assert.ok(abgelaufen);
  assert.equal(abgelaufen.wartet_ms, null, "Unbekannt bleibt unbekannt");
  assert.deepEqual(laufEnde(threadId), ["EXPIRED"]);
  assert.equal(pruefeTraceKette(threadId).ok, true);
});

test("Eine späte ABLEHNUNG bleibt eine Ablehnung, kein Ablauf", async () => {
  const threadId = await wartenderLauf();
  uhr += FRIST_MS * 10;

  await runner.resolveApproval({
    threadId,
    entscheidung: { genehmigt: false, genehmigender: OTTO },
  });

  assert.equal(queueFor(threadId).length, 0);
  assert.deepEqual(laufEnde(threadId), ["REJECTED"]);
  assert.equal(
    lies(threadId).some((z) => z.type === "entscheidung_abgelaufen"),
    false,
  );
});

test("Die Frist steht NACH dem Genehmigenden: ohne ihn wird geworfen, nicht abgelaufen", async () => {
  const threadId = await wartenderLauf();
  uhr += FRIST_MS + 1;

  await assert.rejects(
    () =>
      runner.resolveApproval({ threadId, entscheidung: { genehmigt: true } }),
    /ohne aufgelösten Genehmigenden/,
  );
  assert.deepEqual(laufEnde(threadId), []);
});

// ── Die Registry ─────────────────────────────────────────────────────────

test("getRunner: Optionen auf einen schon gebauten Runner werfen", () => {
  assert.throws(
    () => getRunner("besprechung", { genehmigungsFristMs: 1 }),
    /schon gebaut/,
  );
  // Ohne Optionen wie bisher: derselbe Runner, derselbe Checkpointer.
  assert.equal(getRunner("besprechung"), runner);
});

// ── Die Klasse ───────────────────────────────────────────────────────────

test("Risikostufen: genau 0, 1 und 2 — sonst wird geworfen", () => {
  assert.deepEqual(Object.keys(RISIKOSTUFEN), ["0", "1", "2"]);
  for (const k of [0, 1, 2]) assert.equal(pruefeRisikoklasse(k), k);
  for (const k of [3, -1, "2", null, undefined, 1.5]) {
    assert.throws(() => pruefeRisikoklasse(k), /Risikoklasse/);
  }
});

test("klassifiziere gibt die Klasse zurück und wirft bei unbekanntem Typ", () => {
  const risikoklassen = { A_TUN: 1 };
  assert.equal(klassifiziere({ actionType: "A_TUN", risikoklassen }), 1);
  assert.throws(
    () => klassifiziere({ actionType: "B_TUN", risikoklassen }),
    /B_TUN.*keine Risikoklasse/,
  );
  // Kein Treffer über die Prototypkette: `toString` ist kein Aktionstyp.
  assert.throws(
    () => klassifiziere({ actionType: "toString", risikoklassen }),
    /keine Risikoklasse/,
  );
  assert.throws(
    () => klassifiziere({ actionType: "A_TUN", risikoklassen: { A_TUN: 7 } }),
    /Risikoklasse/,
  );
});

test("createActionQueue: ein Whitelist-Typ ohne Klasse wirft beim Bau", () => {
  const basis = { whitelist: ["A_TUN"], validators: { A_TUN: () => true } };
  assert.throws(() => createActionQueue(basis), /A_TUN.*Risikoklasse/s);
  assert.throws(
    () => createActionQueue({ ...basis, risikoklassen: { B_TUN: 2 } }),
    /A_TUN.*Risikoklasse/s,
  );
  assert.throws(
    () => createActionQueue({ ...basis, risikoklassen: { A_TUN: 3 } }),
    /A_TUN.*Risikoklasse/s,
  );
});

test("createActionQueue: jede eingereihte Aktion trägt ihre Klasse", async () => {
  const { enqueueAction, getQueue: liste } = createActionQueue({
    whitelist: ["A_TUN"],
    validators: { A_TUN: () => true },
    risikoklassen: { A_TUN: 1 },
  });
  await enqueueAction({ threadId: "t", actionType: "A_TUN", payload: {} });
  assert.equal(liste()[0].risikoklasse, 1);
});

test("erzeugeAktionsflaeche: eine fehlende oder ungültige Klasse wirft beim Laden", () => {
  const scharf = { validator: () => true, befugnis: () => true };
  assert.throws(
    () =>
      erzeugeAktionsflaeche({ A_TUN: { risikoklasse: 3 } }, { A_TUN: scharf }),
    /A_TUN.*Risikoklasse/s,
  );
  assert.throws(
    () => erzeugeAktionsflaeche({ A_TUN: {} }, { A_TUN: scharf }),
    /A_TUN.*Risikoklasse/s,
  );
  // Auch ein NICHT scharfer Typ trägt seine Klasse: er ist modelliert.
  assert.throws(
    () =>
      erzeugeAktionsflaeche(
        { A_TUN: { risikoklasse: 2 }, B_TUN: {} },
        { A_TUN: scharf, B_TUN: "noch nicht scharf" },
      ),
    /B_TUN.*Risikoklasse/s,
  );

  const { whitelist, risikoklassen } = erzeugeAktionsflaeche(
    { A_TUN: { risikoklasse: 2 }, B_TUN: { risikoklasse: 0 } },
    { A_TUN: scharf, B_TUN: "noch nicht scharf" },
  );
  assert.deepEqual(whitelist, ["A_TUN"]);
  assert.deepEqual(risikoklassen, { A_TUN: 2, B_TUN: 0 });
});

test("Beide Domänen vergeben für jeden Aktionstyp eine Klasse", () => {
  assert.deepEqual(besprechungKlassen, {
    TICKET_ANLEGEN: 2,
    TICKET_ZUWEISEN: 2,
    ZUSAMMENFASSUNG_SENDEN: 2,
  });
  assert.deepEqual(beispielKlassen, { NOTIFY: 2, WEBHOOK: 2, EMAIL: 2 });
});
