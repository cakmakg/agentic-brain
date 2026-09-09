// ── tests/integration/persistence.test.js ────────────────────────────────
// DIE PRÜFUNG DER ZUSAGE: „Ein Neustart verliert keine wartende Genehmigung."
//
// Sie läuft in zwei echten Kindprozessen und vergleicht am Ende sogar die PIDs:
// derselbe Prozess wäre kein Neustart, sondern eine Behauptung.
//
// Der zweite Prozess teilt mit dem ersten nichts als das Verzeichnis. Kein
// Modulzustand, kein Handle, keine offene Verbindung. Findet er den wartenden
// Lauf trotzdem, liegt es am Speicher — und nur daran.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(hier, "..", "fixtures");

// Ein Prozess je Aufruf. `execFileSync` wartet auf sein Ende — genau das ist
// hier erwünscht: der erste muss TOT sein, bevor der zweite beginnt.
function starteProzess(skript, args, stateDir) {
  const ausgabe = execFileSync(
    process.execPath,
    [path.join(fixtures, skript), ...args],
    {
      cwd: path.resolve(hier, "..", ".."),
      encoding: "utf8",
      env: {
        ...process.env,
        STATE_DIR: stateDir,
        TRACE_DIR: path.join(stateDir, "traces"),
        // Kein Schlüssel: Mock-Modus, deterministisch und kostenlos.
        ANTHROPIC_API_KEY: "",
      },
    },
  );
  // Die Fixtures schreiben genau eine JSON-Zeile; davor kann Protokoll stehen.
  const zeilen = ausgabe.trim().split("\n");
  return JSON.parse(zeilen[zeilen.length - 1]);
}

function frischesVerzeichnis() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentic-neustart-"));
}

test("Ein Neustart verliert die wartende Genehmigung nicht", () => {
  const stateDir = frischesVerzeichnis();
  const threadId = "neustart-genehmigt";

  const erst = starteProzess("laufStarten.mjs", [threadId], stateDir);
  assert.equal(
    erst.interrupted,
    true,
    "Der Lauf muss bei human_approval halten",
  );
  assert.equal(erst.artefakt, "AWAITING_APPROVAL");

  // ── Hier endet der erste Prozess. Alles im Arbeitsspeicher ist weg. ──

  const zweit = starteProzess(
    "laufGenehmigen.mjs",
    [threadId, "true"],
    stateDir,
  );

  assert.notEqual(
    zweit.pid,
    erst.pid,
    "Ohne zwei verschiedene Prozesse prüft dieser Test nichts",
  );
  assert.equal(
    zweit.davor,
    "AWAITING_APPROVAL",
    "Der neue Prozess muss das wartende Artefakt VOR der Genehmigung finden",
  );
  assert.equal(zweit.artefakt, "ZUGESTELLT");
  assert.equal(zweit.queue, 1, "Die freigegebene Aktion ist eingereiht");
});

test("Fail-closed: eine Ablehnung nach dem Neustart stellt nichts zu", () => {
  // Die wichtigste Zusage des Gerüsts darf über eine Prozessgrenze hinweg nicht
  // aufweichen. Ein Speicher, der den Lauf wiederfindet, aber die Ablehnung
  // verliert, wäre schlimmer als gar keiner.
  const stateDir = frischesVerzeichnis();
  const threadId = "neustart-abgelehnt";

  const erst = starteProzess("laufStarten.mjs", [threadId], stateDir);
  assert.equal(erst.artefakt, "AWAITING_APPROVAL");

  const zweit = starteProzess(
    "laufGenehmigen.mjs",
    [threadId, "false"],
    stateDir,
  );

  assert.equal(zweit.davor, "AWAITING_APPROVAL");
  assert.equal(
    zweit.artefakt,
    "AWAITING_APPROVAL",
    "Nach einer Ablehnung bleibt das Artefakt stehen",
  );
  assert.equal(zweit.queue, 0, "Und die Queue bleibt leer");
});

test("Ein leeres Zustandsverzeichnis ist der Anfangszustand, kein Fehler", () => {
  // Wer `.zustand/` löscht, darf keinen Absturz bekommen. Das ist die andere
  // Hälfte der Zusage: der Speicher ist eine Stütze, keine Voraussetzung.
  const stateDir = frischesVerzeichnis();
  const erst = starteProzess("laufStarten.mjs", ["frisch-1"], stateDir);
  assert.equal(erst.artefakt, "AWAITING_APPROVAL");
});
