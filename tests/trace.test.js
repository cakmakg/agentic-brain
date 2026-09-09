// ── tests/trace.test.js ──────────────────────────────────────────────────
// Der Trace ist die Grundlage der Messschicht (I1: eine Evaluation ohne Trace
// ist teurer als gar keine). Deshalb wird hier nicht nur geprüft, DASS
// geschrieben wird, sondern auch WAS bewusst nicht drinsteht.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-unit-"));
process.env.TRACE_DIR = traceDir;

const { startTrace, resumeTrace } =
  await import("../src/kernel/governance/trace.js");

const lies = (runId) =>
  fs
    .readFileSync(path.join(traceDir, `${runId}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((z) => JSON.parse(z));

let stderr;
before(() => {
  stderr = console.error;
  console.error = () => {}; // die erwarteten Warnungen nicht in die Testausgabe
});
after(() => {
  console.error = stderr;
  fs.rmSync(traceDir, { recursive: true, force: true });
});

test("startTrace legt die Datei an und schreibt run_start", () => {
  const t = startTrace({ runId: "lauf-a", task: "12345" });
  assert.equal(t.active, true);
  const z = lies("lauf-a");
  assert.equal(z[0].type, "run_start");
  assert.equal(z[0].seq, 0);
  assert.equal(z[0].task_length, 5);
  assert.equal(z[0].run_id, "lauf-a");
});

test("Eine Knotenzeile trägt Entscheidungsfelder und Längen — keinen Volltext", () => {
  const t = startTrace({ runId: "lauf-b", task: "x" });
  t.node("bearbeiter", {
    log: ["geschrieben"],
    ergebnis: "Ein Ergebnis mit Inhalt",
    abgelegt: false,
    revisionCount: 1,
  });

  const zeile = lies("lauf-b").at(-1);
  assert.equal(zeile.type, "node");
  assert.equal(zeile.node, "bearbeiter");
  assert.equal(zeile.ergebnis_length, 23);
  assert.equal(
    zeile.ergebnis,
    undefined,
    "Der Volltext gehört NICHT in den Trace",
  );
  assert.equal(zeile.revisionCount, 1);
  assert.equal(zeile.abgelegt, false);
  assert.deepEqual(zeile.log, ["geschrieben"]);
  assert.equal(typeof zeile.duration_ms, "number");
});

test("Ein Feld, das der Knoten nicht geschrieben hat, taucht nicht auf", () => {
  const t = startTrace({ runId: "lauf-c", task: "x" });
  t.node("guardrail", { log: [], threatScore: 0 });
  const zeile = lies("lauf-c").at(-1);
  assert.equal(zeile.threatScore, 0);
  assert.equal("abgelegt" in zeile, false);
  assert.equal("ergebnis_length" in zeile, false);
});

test("Der Halt am Genehmigungstor ist run_pause, kein run_end", () => {
  const t = startTrace({ runId: "lauf-d", task: "x" });
  t.pause("AWAITING_APPROVAL");
  const zeile = lies("lauf-d").at(-1);
  assert.equal(zeile.type, "run_pause");
  assert.equal(zeile.status, "AWAITING_APPROVAL");
});

test("resumeTrace schreibt in dieselbe Datei und zählt seq weiter", () => {
  const t1 = startTrace({ runId: "lauf-e", task: "x" });
  t1.node("ablage", { abgelegt: true });
  t1.pause("AWAITING_APPROVAL");

  const t2 = resumeTrace({ runId: "lauf-e", humanApproval: true });
  t2.node("zusteller", { zugestellt: true });
  t2.end("PUBLISHED");

  const z = lies("lauf-e");
  assert.deepEqual(
    z.map((x) => x.seq),
    [0, 1, 2, 3, 4, 5],
    "seq läuft über die Fortsetzung hinweg weiter, statt bei 0 neu zu beginnen",
  );
  assert.equal(z[3].type, "run_resume");
  assert.equal(z[3].humanApproval, true);
  assert.equal(z.at(-1).status, "PUBLISHED");
  assert.equal(z.filter((x) => x.type === "run_end").length, 1);
});

test("Eine ungültige run_id wird abgelehnt — keine Datei, kein Absturz", () => {
  const t = startTrace({ runId: "../../evil", task: "x" });
  assert.equal(t.active, false);
  t.node("bearbeiter", { ergebnis: "egal" });
  t.pause("AWAITING_APPROVAL");
  t.end("PUBLISHED");

  const dateien = fs.readdirSync(traceDir);
  assert.equal(
    dateien.some((f) => f.includes("evil")),
    false,
    "Ein bereinigter Pfad wäre eine Einladung zum Verzeichniswechsel",
  );
});

test("Auch eine leere oder fehlende run_id wird abgelehnt", () => {
  assert.equal(startTrace({ runId: "", task: "x" }).active, false);
  assert.equal(startTrace({}).active, false);
  assert.equal(resumeTrace({ runId: null }).active, false);
});
