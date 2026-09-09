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

  // Der Datensatz für Metrik 3.13. Reine DATEN: Principale, Dokumente samt
  // Envelope und die Fälle. Der Runner baut daraus den Speicher selbst — er
  // benutzt dafür die Mechanik des Kerns und braucht deshalb kein Wissen über
  // diese Domäne.
  //
  // Eine Domäne ohne Retrieval trägt hier ausdrücklich eine leere Fallliste.
  // Das ist eine Aussage („wir messen hier nichts") und kein Versehen; die
  // Nenner-Probe meldet sie dann als ungemessen statt als 100 %.
  retrieval: JSON.parse(
    fs.readFileSync(path.join(hier, "golden", "acl.json"), "utf8"),
  ),
};
