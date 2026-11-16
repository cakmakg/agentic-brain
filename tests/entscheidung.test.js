// ── tests/entscheidung.test.js ───────────────────────────────────────────
// A12, Etappe 4d: die Genehmigung ist ein ENTSCHEIDUNGSOBJEKT, kein Boolean.
// Sie trägt, WER entschieden hat, und optional einen vom Menschen BEARBEITETEN
// Entwurf.
//
// Die Kante in `agent/build.js` wird dabei NICHT angefasst — sie prüft weiter
// auf exakt `true`. Was diese Datei prüft, ist ausschließlich das, was VOR ihr
// ankommt.
//
// Der wertvollste Test ist „ein bearbeiteter Entwurf, der den Vertrag
// verletzt, wird abgelehnt und NICHT eingereiht". Ohne ihn wäre die
// Bearbeitung ein Weg, den Prüfer zu umgehen: der Mensch am Tor könnte eine
// Fassung durchreichen, die kein Agent je hätte schreiben dürfen.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { frischerZustand } from "./helpers/zustand.js";

frischerZustand();

const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-entscheidung-"));
process.env.TRACE_DIR = traceDir;

const { MOCK_LLM } = await import("../src/kernel/config/env.js");
const { baueStore } = await import("../src/kernel/context/aufbau.js");
const { synchronisiere } =
  await import("../src/kernel/connectors/synchronisation.js");
const { pruefeTraceKette } = await import("../src/kernel/governance/trace.js");

await import("../src/domains/besprechung/domain.js");
await import("../src/domains/beispiel/domain.js");
const { getRunner } = await import("../src/kernel/registry.js");
const { createNotizlaufwerk } =
  await import("../src/domains/besprechung/connectors/notizlaufwerk.js");
const { setzeLeseweg } = await import("../src/domains/besprechung/leseweg.js");
const { getEntwurf } =
  await import("../src/domains/besprechung/agents/entwurf.js");
const { getQueue } = await import("../src/domains/besprechung/actions.js");

before(() =>
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  ),
);
after(() => fs.rmSync(traceDir, { recursive: true, force: true }));

// Eine Notiz, für jeden im Mandanten sichtbar: was hier gemessen wird, ist die
// ENTSCHEIDUNG, nicht der Leseweg. Der steht in `tests/naht.test.js`.
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

// Ein Lauf, der am Genehmigungstor wartet.
async function wartenderLauf() {
  const { startWorkflow } = getRunner("besprechung");
  const threadId = crypto.randomUUID();
  const { interrupted } = await startWorkflow({
    task: TASK,
    threadId,
    principal: MIA,
  });
  assert.equal(interrupted, true, "Der Lauf muss am Tor warten");
  return threadId;
}

// ── Die Form der Entscheidung ────────────────────────────────────────────

test("Ein Nicht-Boolean ist keine Entscheidung", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  // Dieselbe Strenge wie am HTTP-Rand seit dem 2026-09-14: `Boolean("false")`
  // ist `true`, also wird hier nicht umgewandelt, sondern abgelehnt.
  await assert.rejects(
    () =>
      resolveApproval({
        threadId,
        entscheidung: { genehmigt: "true", genehmigender: OTTO },
      }),
    /muss ein Boolean sein/,
  );
  assert.equal(queueFor(threadId).length, 0);
});

test("DAS TOR: eine Genehmigung ohne aufgeloesten Genehmigenden ist keine", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  await assert.rejects(
    () => resolveApproval({ threadId, entscheidung: { genehmigt: true } }),
    /ohne aufgelösten Genehmigenden/,
  );
  assert.equal(
    getEntwurf(threadId)?.status,
    "AWAITING_APPROVAL",
    "Ohne Genehmigenden darf nichts zugestellt sein",
  );
  assert.equal(queueFor(threadId).length, 0);
});

test("Eine ABLEHNUNG braucht keinen Genehmigenden — sie aendert nichts in der Welt", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  await resolveApproval({ threadId, entscheidung: { genehmigt: false } });
  assert.equal(getEntwurf(threadId)?.status, "AWAITING_APPROVAL");
  assert.equal(queueFor(threadId).length, 0);
});

test("DAS TOR: jede Genehmigung nennt im Audit ihren Genehmigenden", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  await resolveApproval({
    threadId,
    entscheidung: { genehmigt: true, genehmigender: OTTO },
  });

  const zeile = lies(threadId).find((z) => z.type === "run_resume");
  assert.equal(zeile.humanApproval, true);
  // Im KLARTEXT, nicht als Laenge: eine Genehmigung, deren Genehmigender nur
  // eine Zahl ist, ist kein Nachweis.
  assert.equal(zeile.genehmigender, "otto");
  assert.equal(queueFor(threadId).length, 1);
  // Und die Kette haelt ueber die Entscheidung hinweg (A6).
  assert.equal(pruefeTraceKette(threadId).ok, true);
});

// ── Der bearbeitete Entwurf ──────────────────────────────────────────────

test("DAS TOR: ein bearbeiteter Entwurf, der den Vertrag verletzt, wird NICHT zugestellt", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  // Zu kurz und ohne Verantwortliche — beides verletzt `vertrag.js`. Genau so
  // sähe der Versuch aus, den Pruefer am Tor zu umgehen.
  const ergebnis = await resolveApproval({
    threadId,
    entscheidung: {
      genehmigt: true,
      genehmigender: OTTO,
      bearbeiteterEntwurf: { aktionspunkte: [{ text: "kurz" }] },
    },
  });

  assert.equal(ergebnis.angewandt, false);
  assert.match(ergebnis.grund, /Aktionspunkt 1/);
  assert.equal(
    getEntwurf(threadId)?.status,
    "AWAITING_APPROVAL",
    "Der Lauf bleibt stehen, wo er stand",
  );
  assert.equal(queueFor(threadId).length, 0, "Nichts eingereiht");

  // Der Versuch steht im Audit — nur seine LAENGE, nicht sein Text: die
  // Begruendung zitiert den Entwurf.
  const zeile = lies(threadId).find((z) => z.type === "entscheidung_verworfen");
  assert.ok(zeile, "Ein verworfener Versuch gehoert ins Audit");
  assert.equal(typeof zeile.grund_length, "number");
  assert.equal(zeile.grund, undefined);
  assert.equal(pruefeTraceKette(threadId).ok, true);
});

test("Eine LEERE Bearbeitung ist eine Ablehnung, keine Bearbeitung", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  const ergebnis = await resolveApproval({
    threadId,
    entscheidung: {
      genehmigt: true,
      genehmigender: OTTO,
      bearbeiteterEntwurf: { aktionspunkte: [] },
    },
  });

  // Ohne diese Regel ginge die leere Fassung in die Queue und fiele erst am
  // Validierer — eingereiht statt abgelehnt.
  assert.equal(ergebnis.angewandt, false);
  assert.equal(queueFor(threadId).length, 0);
});

test("Ein gueltiger bearbeiteter Entwurf wird uebernommen — und nur als ZAHL getract", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  const bearbeitet = {
    aktionspunkte: [
      {
        text: "Rollout-Termin mit dem Betrieb abstimmen",
        verantwortlich: "otto",
      },
      {
        text: "Freigabe der Betriebshandbuecher einholen",
        verantwortlich: "mia",
      },
    ],
  };

  const ergebnis = await resolveApproval({
    threadId,
    entscheidung: {
      genehmigt: true,
      genehmigender: OTTO,
      bearbeiteterEntwurf: bearbeitet,
    },
  });

  assert.equal(ergebnis.angewandt, true);

  const aktionen = queueFor(threadId);
  assert.equal(aktionen.length, 1);
  assert.deepEqual(
    aktionen[0].payload.aktionspunkte,
    bearbeitet.aktionspunkte,
    "Die genehmigte Fassung ist die bearbeitete",
  );

  const zeile = lies(threadId).find((z) => z.type === "run_resume");
  assert.equal(typeof zeile.entwurf_geaendert, "number");
  assert.ok(zeile.entwurf_geaendert > 0, "Es hat sich etwas geaendert");

  // KEIN Volltext: nirgends im Trace steht der Text des Entwurfs.
  const roh = fs.readFileSync(path.join(traceDir, `${threadId}.jsonl`), "utf8");
  assert.equal(
    roh.includes("Betriebshandbuecher"),
    false,
    "Der Trace belegt WIE VIEL sich geaendert hat, nie WAS",
  );
});

test("Die Herkunft laesst sich am Tor nicht aendern", async () => {
  const { resolveApproval } = getRunner("besprechung");
  const threadId = await wartenderLauf();

  await resolveApproval({
    threadId,
    entscheidung: {
      genehmigt: true,
      genehmigender: OTTO,
      bearbeiteterEntwurf: {
        aktionspunkte: [
          {
            text: "Rollout-Termin mit dem Betrieb abstimmen",
            verantwortlich: "otto",
          },
        ],
        // Ein Mensch, der hier die Herkunft umschreiben koennte, haette genau
        // den Beleg entwertet, den `Ticket verweist_auf Notiz` verlangt.
        notizId: "n-erfunden",
      },
    },
  });

  assert.equal(queueFor(threadId)[0].payload.notizId, "n-frei");
});

test("Eine Domaene ohne `pruefeEntwurf` nimmt keine Bearbeitung entgegen", async () => {
  // `beispiel` ist die Referenzdomaene (ADR-0004) und hat keinen
  // Ausgabevertrag. Fail-closed: sie darf keine fremde Fassung uebernehmen,
  // die sie nicht pruefen kann.
  const { startWorkflow, resolveApproval } = getRunner("beispiel");
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: "Eine kurze Zusammenfassung.", threadId });

  await assert.rejects(
    () =>
      resolveApproval({
        threadId,
        entscheidung: {
          genehmigt: true,
          genehmigender: OTTO,
          bearbeiteterEntwurf: { irgendwas: true },
        },
      }),
    /nimmt keinen bearbeiteten Entwurf entgegen/,
  );
});
