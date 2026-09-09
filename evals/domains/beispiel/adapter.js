// ── evals/domains/beispiel/adapter.js ────────────────────────────────────
// Was der Harness über die Domäne `beispiel` wissen muss — und sonst nichts.
// Diese sieben Angaben sind der ganze Vertrag zwischen Messschicht und Domäne.
// Ohne ihn stünden sie verstreut im Runner, und ein domänenfreier Runner wäre
// unmöglich.
//
// Die Importe haben eine NEBENWIRKUNG: `domain.js` registriert die Domäne. Der
// Adapter wird deshalb erst geladen, wenn TRACE_DIR und STATE_DIR stehen
// (siehe evals/domains/index.js).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  guardrailSchwellen,
  beispielDomain,
} from "../../../src/domains/beispiel/domain.js";
import { getRunner } from "../../../src/kernel/registry.js";
import { getArtifact } from "../../../src/domains/beispiel/agents/ablage.js";
import {
  enqueueAction,
  getQueue,
  startActionWorker,
  stopActionWorker,
} from "../../../src/domains/beispiel/actions.js";

const hier = path.dirname(fileURLToPath(import.meta.url));

export const adapter = {
  name: beispielDomain.name,

  // Der Eingangsknoten. Der Runner erkennt „blockiert" STRUKTURELL — der Lauf
  // endet nach dem Eingang — und darf dafür keinen Knotennamen kennen.
  eingang: beispielDomain.entry,

  // Dieselbe Grenze wie im Code, nicht eine zweite Kopie der Zahl.
  guardrailSchwellen,

  runner: getRunner(beispielDomain.name),

  // Der Artefaktstatus ist Bedeutung der Domäne. Der Runner vergleicht nur
  // Zeichenketten — wie der Endzustand heißt, entscheidest du hier.
  artefaktstatus: (threadId) => getArtifact(threadId)?.status ?? null,

  aktionen: { enqueueAction, getQueue, startActionWorker, stopActionWorker },

  datensatz: JSON.parse(
    fs.readFileSync(path.join(hier, "golden", "tasks.json"), "utf8"),
  ),
};
