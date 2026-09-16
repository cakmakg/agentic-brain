// ── tests/httpAdapter.test.js ────────────────────────────────────────────
// Der erste Test gegen den HTTP-Adapter — und er existiert wegen einer Lücke,
// die kein anderer Test fangen konnte.
//
// Die HITL-Kante im Kern prüft auf exakt `true` (`agent/build.js`), und das ist
// richtig. Der Adapter wandelte den Wert aber VORHER um: `Boolean(approved)`.
// `Boolean("false")` ist `true` — ein Client, der `{"approved": "false"}`
// sendet, genehmigte damit. Die Zusage galt im Kern und nicht am Rand, und
// genau die Hälfte, die nie kaputt war, war geprüft.
//
// Deshalb prüft diese Datei den RAND, nicht die Kante: nur ein JSON-Boolean
// `true` ist eine Genehmigung, jeder Nicht-Boolean wird mit 400 abgelehnt und
// nicht umgewandelt. Dieselbe Lehre wie beim API-Schlüssel (`governance/auth.js`):
// fail-closed heißt ablehnen, nicht zurechtbiegen.
//
// Die Fälle B (`false`) und C (`true`) belegen, dass die Probe selbst misst —
// ohne sie könnte Fall A auch deshalb grün sein, weil der Aufbau nichts zustellt.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";

import { frischerZustand } from "./helpers/zustand.js";

// Eigenes Zustands- und Trace-Verzeichnis, VOR dem Import: sonst sähe der
// zweite `npm test`-Lauf den Zustand des ersten.
frischerZustand();
const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-http-"));
process.env.TRACE_DIR = traceDir;

// Der Schlüssel wird hier gesetzt, damit der Test nicht von einer `.env`
// abhängt. env.js liest process.env beim Laden.
const SCHLUESSEL = "test-http-schluessel";
process.env.API_KEY = SCHLUESSEL;

const { MOCK_LLM } = await import("../src/kernel/config/env.js");
// Der Adapter registriert die Domäne selbst; der Test nimmt denselben Runner.
const { app } = await import("../src/adapters/http/server.js");
const { getRunner } = await import("../src/kernel/registry.js");
const { getArtifact } =
  await import("../src/domains/beispiel/agents/ablage.js");
const { getQueue } = await import("../src/domains/beispiel/actions.js");

const { startWorkflow } = getRunner("beispiel");

const AUFGABE = "Eine kurze Zusammenfassung der Quartalszahlen.";
const queueFor = (threadId) =>
  getQueue().filter((a) => a.threadId === threadId);

let server;
let basis;

before(async () => {
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  );
  // Port 0 = das Betriebssystem wählt; zwei parallele Testdateien kollidieren nicht.
  server = app.listen(0);
  await once(server, "listening");
  basis = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  fs.rmSync(traceDir, { recursive: true, force: true });
});

// Eine echte HTTP-Anfrage — der Punkt der Übung. Ein direkter Aufruf von
// `resolveApproval` würde genau die Umwandlung überspringen, um die es geht.
function genehmige(koerper, schluessel = SCHLUESSEL) {
  return fetch(`${basis}/api/approve`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": schluessel },
    body: JSON.stringify(koerper),
  });
}

// Der Adapter antwortet, BEVOR die Fortsetzung durch ist (`res.json` steht vor
// dem Aufruf). Wer danach sofort misst, misst den Zeitpunkt, nicht die Zusage.
async function wartetAufZustellung(threadId, ms = 2000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (getArtifact(threadId)?.status === "ZUGESTELLT") return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

// Ein Lauf, der bei human_approval wartet — der Ausgangspunkt jedes Falls.
async function wartenderLauf() {
  const threadId = crypto.randomUUID();
  const { interrupted } = await startWorkflow({ task: AUFGABE, threadId });
  assert.equal(interrupted, true, "Der Lauf muss bei human_approval warten");
  return threadId;
}

test("Fall C: `true` stellt zu — die Probe misst wirklich", async () => {
  const threadId = await wartenderLauf();

  const res = await genehmige({ threadId, approved: true });
  assert.equal(res.status, 200);

  assert.equal(await wartetAufZustellung(threadId), true);
  assert.equal(queueFor(threadId).length, 1, "Genau eine Aktion je Zustellung");
});

test("Fall B: `false` stellt nicht zu", async () => {
  const threadId = await wartenderLauf();

  const res = await genehmige({ threadId, approved: false });
  assert.equal(res.status, 200);

  assert.equal(await wartetAufZustellung(threadId), false);
  assert.equal(
    getArtifact(threadId)?.status,
    "AWAITING_APPROVAL",
    "Nach einer Ablehnung darf das Artefakt NICHT zugestellt sein",
  );
  assert.equal(queueFor(threadId).length, 0);
});

test('Fall A: der String "false" genehmigt NICHT — 400 statt Umwandlung', async () => {
  const threadId = await wartenderLauf();

  const res = await genehmige({ threadId, approved: "false" });
  assert.equal(
    res.status,
    400,
    'Ein Nicht-Boolean wird abgelehnt, nicht mit Boolean("false") umgewandelt',
  );

  assert.equal(await wartetAufZustellung(threadId), false);
  assert.equal(getArtifact(threadId)?.status, "AWAITING_APPROVAL");
  assert.equal(queueFor(threadId).length, 0, "Nichts eingereiht");
});

test("Jeder Nicht-Boolean wird mit 400 abgelehnt, nichts wird zugestellt", async () => {
  const threadId = await wartenderLauf();

  // `"true"` und `1` sind die gefährlichsten: sie sehen aus wie eine
  // Genehmigung und wären unter `Boolean()` auch eine geworden.
  const nichtBoolean = ["true", "false", "yes", "0", 1, 0, null, {}, []];
  for (const approved of nichtBoolean) {
    const res = await genehmige({ threadId, approved });
    assert.equal(
      res.status,
      400,
      `${JSON.stringify(approved)} muss 400 ergeben`,
    );
  }

  // Ein fehlendes Feld ist ebenfalls kein Boolean — kein stiller Vorgabewert.
  const ohneFeld = await genehmige({ threadId });
  assert.equal(ohneFeld.status, 400);

  assert.equal(await wartetAufZustellung(threadId), false);
  assert.equal(getArtifact(threadId)?.status, "AWAITING_APPROVAL");
  assert.equal(queueFor(threadId).length, 0);
});

test("Ohne gültigen Schlüssel führt auch ein echtes `true` zu nichts", async () => {
  const threadId = await wartenderLauf();

  const res = await genehmige({ threadId, approved: true }, "falscher-key");
  assert.equal(res.status, 401);

  assert.equal(await wartetAufZustellung(threadId), false);
  assert.equal(queueFor(threadId).length, 0);
});

test("Fehlende threadId → 400", async () => {
  const res = await genehmige({ approved: true });
  assert.equal(res.status, 400);
});
