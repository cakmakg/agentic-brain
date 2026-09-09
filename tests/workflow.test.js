// ── tests/workflow.test.js ───────────────────────────────────────────────
// Der wertvollste Test des Gerüsts: er prüft die zentrale Zusage Ende zu Ende.
// Eine Ablehnung darf nichts zustellen UND nichts einreihen.
//
// Wenn du eine eigene Domäne baust, ist dies der Test, den du als Erstes
// übernimmst. Er ist die Mutationsprobe in ausführbarer Form: dreh die Kante
// `human_approval → terminal` auf unbedingt, und genau hier wird es rot.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { frischerZustand } from "./helpers/zustand.js";

// Eigenes Zustandsverzeichnis je Testdatei — sonst sähe der zweite
// `npm test`-Lauf den Zustand des ersten.
frischerZustand();

// Traces dürfen nicht ins Repo laufen: eigenes Verzeichnis, VOR dem Import.
const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-workflow-"));
process.env.TRACE_DIR = traceDir;

const { MOCK_LLM } = await import("../src/kernel/config/env.js");
// Die Domäne registriert sich beim Import; der Runner kommt aus der Registry.
await import("../src/domains/beispiel/domain.js");
const { getRunner } = await import("../src/kernel/registry.js");
const { startWorkflow, resolveApproval } = getRunner("beispiel");
const { getArtifact } =
  await import("../src/domains/beispiel/agents/ablage.js");
const { getQueue } = await import("../src/domains/beispiel/actions.js");
const { cost } = await import("../src/kernel/observability/costTracker.js");

const AUFGABE = "Eine kurze Zusammenfassung der Quartalszahlen.";
const queueFor = (threadId) =>
  getQueue().filter((a) => a.threadId === threadId);

before(() => {
  // Ein echter Schlüssel würde hier Geld kosten und den Test nichtdeterministisch
  // machen. Lieber laut scheitern als still eine Rechnung erzeugen.
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  );
});

after(() => fs.rmSync(traceDir, { recursive: true, force: true }));

test("Der goldene Pfad hält vor der Genehmigung an (HITL)", async () => {
  const threadId = crypto.randomUUID();
  const { interrupted } = await startWorkflow({ task: AUFGABE, threadId });

  assert.equal(interrupted, true, "Der Graph muss bei human_approval anhalten");
  assert.equal(getArtifact(threadId)?.status, "AWAITING_APPROVAL");
  assert.equal(
    queueFor(threadId).length,
    0,
    "Vor der Genehmigung darf NICHTS eingereiht sein",
  );
});

test("Eine Ablehnung stoppt die Zustellung", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: AUFGABE, threadId });
  await resolveApproval({ threadId, approved: false });

  assert.equal(
    getArtifact(threadId)?.status,
    "AWAITING_APPROVAL",
    "Nach einer Ablehnung darf das Artefakt NICHT zugestellt sein",
  );
  assert.equal(
    queueFor(threadId).length,
    0,
    "Nach einer Ablehnung bleibt die Queue für diesen Lauf leer",
  );
});

test("Eine Genehmigung stellt zu und reiht genau eine Aktion ein", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: AUFGABE, threadId });
  await resolveApproval({ threadId, approved: true });

  assert.equal(getArtifact(threadId)?.status, "ZUGESTELLT");

  const aktionen = queueFor(threadId);
  assert.equal(aktionen.length, 1, "Genau eine Aktion je zugestelltem Lauf");
  assert.equal(aktionen[0].actionType, "NOTIFY");
  assert.equal(
    aktionen[0].status,
    "PENDING",
    "Der Agent schreibt nur; ausgeführt wird erst durch den Worker",
  );
});

test("Der Budget-Kill-Switch bricht ab, bevor ein LLM-Aufruf entsteht", async () => {
  const threadId = crypto.randomUUID();
  cost.setThrottled(true);
  try {
    const { interrupted } = await startWorkflow({ task: AUFGABE, threadId });
    assert.equal(
      interrupted,
      false,
      "Gedrosselt darf kein HITL-Halt entstehen",
    );
    assert.equal(
      getArtifact(threadId),
      null,
      "Gedrosselt darf kein Artefakt entstehen",
    );
  } finally {
    cost.setThrottled(false);
  }
});

test("Jeder Lauf hinterlässt genau eine Trace-Datei", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: AUFGABE, threadId });
  await resolveApproval({ threadId, approved: true });

  const datei = path.join(traceDir, `${threadId}.jsonl`);
  assert.equal(fs.existsSync(datei), true);

  const zeilen = fs
    .readFileSync(datei, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((z) => JSON.parse(z));

  assert.equal(zeilen[0].type, "run_start");
  assert.equal(zeilen.at(-1).type, "run_end");
  assert.equal(zeilen.at(-1).status, "PUBLISHED");
  assert.equal(
    zeilen.filter((z) => z.type === "run_end").length,
    1,
    "Genau ein run_end je Lauf — sonst zählt jede spätere Auswertung doppelt",
  );
});
