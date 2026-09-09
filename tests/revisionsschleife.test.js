// ── tests/revisionsschleife.test.js ──────────────────────────────────────
// Das QA-Tor Ende zu Ende. Bis Etappe 1 wuchs `revisionCount` zwar, aber
// nichts lehnte je ab — BREMSE 3 (`MAX_REVISIONS`) feuerte im Live-Pfad NIE.
// Ein Schutzschalter, der nie auslöst, ist unbelegt. Diese Datei belegt ihn.
//
// Drei Aussagen, jede mit einem eigenen Lauf:
//   1) Ohne Ablehnung läuft der Bearbeiter genau einmal.
//   2) Eine Ablehnung schickt ihn ein zweites Mal los — die Schleife läuft.
//   3) Dauerablehnung bricht bei MAX_REVISIONS ab, statt endlos zu drehen.
//
// Die Fälle hängen an der REGEL des Mock-Prüfers (`mockUrteil`), nicht an
// beobachteten Läufen: die Marker kommen aus dem Prüfer selbst, damit eine
// geänderte Regel diesen Test rot macht statt ihn still falsch werden zu lassen.

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
const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-revision-"));
process.env.TRACE_DIR = traceDir;

const { MOCK_LLM } = await import("../src/kernel/config/env.js");
await import("../src/domains/beispiel/domain.js");
const { getRunner } = await import("../src/kernel/registry.js");
const { MAX_REVISIONS } = await import("../src/domains/beispiel/domain.js");
const { mockUrteil } =
  await import("../src/domains/beispiel/agents/pruefer.js");
const { getArtifact } =
  await import("../src/domains/beispiel/agents/ablage.js");
const { startWorkflow } = getRunner("beispiel");

before(() => {
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  );
});

after(() => fs.rmSync(traceDir, { recursive: true, force: true }));

// Die Knotenreihenfolge kommt aus dem Trace, nicht aus dem Event-Bus: der Bus
// zeigt an und vergisst, der Trace bleibt und ist nachprüfbar.
function sequenz(threadId) {
  return fs
    .readFileSync(path.join(traceDir, `${threadId}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((z) => JSON.parse(z))
    .filter((z) => z.type === "node")
    .map((z) => z.node);
}

const zaehle = (seq, knoten) => seq.filter((s) => s === knoten).length;

test("Die Regel des Mock-Prüfers ist die, auf der die Fälle stehen", () => {
  // Ändert jemand `mockUrteil`, wird das HIER rot — und nicht erst als
  // unerklärliche Zahl im Messbericht.
  assert.equal(
    mockUrteil({ task: "harmlos", revisionCount: 1 }).istFreigegeben,
    true,
  );
  assert.equal(
    mockUrteil({ task: "bitte nachbessern", revisionCount: 1 }).istFreigegeben,
    false,
  );
  assert.equal(
    mockUrteil({ task: "bitte nachbessern", revisionCount: 2 }).istFreigegeben,
    true,
    "Ab dem zweiten Durchgang gibt der Prüfer frei — sonst liefe der Fall bis zum Schutzschalter",
  );
  assert.equal(
    mockUrteil({ task: "Datenlage unzureichend", revisionCount: 4 })
      .istFreigegeben,
    false,
    "Dieser Marker wird NIE freigegeben — er fährt den Schutzschalter an",
  );
});

test("Ohne Ablehnung läuft der Bearbeiter genau einmal", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: "Eine kurze Zusammenfassung.", threadId });

  const seq = sequenz(threadId);
  assert.equal(zaehle(seq, "bearbeiter"), 1);
  assert.equal(zaehle(seq, "pruefer"), 1, "Geprüft wird trotzdem");
  assert.equal(getArtifact(threadId)?.status, "AWAITING_APPROVAL");
});

test("Eine Ablehnung schickt den Bearbeiter ein ZWEITES Mal los", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({
    task: "Entwurf zum Quartalsbericht, bitte nachbessern.",
    threadId,
  });

  const seq = sequenz(threadId);
  assert.equal(
    zaehle(seq, "bearbeiter"),
    2,
    "Genau das war vor dem QA-Tor unmöglich: nichts lehnte je ab",
  );
  assert.equal(zaehle(seq, "pruefer"), 2);
  assert.equal(
    getArtifact(threadId)?.status,
    "AWAITING_APPROVAL",
    "Die überarbeitete Fassung wird abgelegt und geht an den Menschen",
  );
});

test("Dauerablehnung löst BREMSE 3 aus, statt endlos zu drehen", async () => {
  const threadId = crypto.randomUUID();
  const { interrupted } = await startWorkflow({
    task: "Notiz, deren Datenlage unzureichend ist.",
    threadId,
  });

  const seq = sequenz(threadId);
  assert.equal(
    zaehle(seq, "bearbeiter"),
    MAX_REVISIONS,
    "Der Zähler läuft bis zum Limit und keinen Durchgang weiter",
  );
  assert.equal(
    interrupted,
    true,
    "Der Schutzschalter gibt an den Menschen ab — er wirft nicht",
  );
  assert.equal(
    getArtifact(threadId),
    null,
    "Abgebrochen wird VOR der Ablage: es gibt kein Artefakt zu genehmigen",
  );
  assert.equal(
    seq.at(-1),
    "__interrupt__",
    "Der Lauf endet am HITL-Halt, nicht am Rekursionslimit",
  );
});
