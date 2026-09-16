// ── evals/domains/besprechung/adapter.js ─────────────────────────────────
// Was der Harness über die Domäne `besprechung` wissen muss — und sonst
// nichts. Dieselben acht Angaben wie bei `beispiel`; der Runner bleibt
// domänenfrei. Dass diese Datei entstehen konnte, ohne eine Zeile in
// `evals/runners/policy.js` zu ändern, ist das Prüfkriterium des Gerüsts auf
// der Messschicht.
//
// Die Importe haben eine NEBENWIRKUNG: `domain.js` registriert die Domäne. Der
// Adapter wird deshalb erst geladen, wenn TRACE_DIR und STATE_DIR stehen
// (siehe evals/domains/index.js).
//
// EIN UNTERSCHIED ZU `beispiel`, UND ER IST BEABSICHTIGT. Dort stehen die
// Envelopes des Retrieval-Datensatzes von Hand in der JSON-Datei. Hier steht
// das QUELLSYSTEM, und die Envelopes entstehen durch den echten Connector über
// `acl.js`. Gemessen wird damit die ganze Kette — Quelle, Übersetzung,
// Envelope, Filter — statt nur des Filters. Von Hand geschriebene Envelopes
// hätten die Übersetzung ungemessen gelassen, und genau dort liegt bei einem
// Connector die Arbeit.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  guardrailSchwellen,
  besprechungDomain,
} from "../../../src/domains/besprechung/domain.js";
import { getRunner } from "../../../src/kernel/registry.js";
import { getEntwurf } from "../../../src/domains/besprechung/agents/entwurf.js";
import { createNotizlaufwerk } from "../../../src/domains/besprechung/connectors/notizlaufwerk.js";
import {
  enqueueAction,
  getQueue,
  startActionWorker,
  stopActionWorker,
} from "../../../src/domains/besprechung/actions.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (datei) =>
  JSON.parse(fs.readFileSync(path.join(hier, "golden", datei), "utf8"));

const aclDatensatz = lies("acl.json");
const entzugDatensatz = lies("entzug.json");

// Die Dokumente des Retrieval-Datensatzes: EINMAL durch den echten Connector
// gezogen. Kein zweiter Weg, keine Handarbeit.
const { connector: aclConnector } = createNotizlaufwerk(
  aclDatensatz.quellsystem,
);

export const adapter = {
  name: besprechungDomain.name,

  // Der Eingangsknoten. Der Runner erkennt „blockiert" STRUKTURELL — der Lauf
  // endet nach dem Eingang — und darf dafür keinen Knotennamen kennen.
  eingang: besprechungDomain.entry,

  // Dieselbe Grenze wie im Code, nicht eine zweite Kopie der Zahl.
  guardrailSchwellen,

  runner: getRunner(besprechungDomain.name),

  // Der Artefaktstatus ist Bedeutung der Domäne. Der Runner vergleicht nur
  // Zeichenketten — wie der Endzustand heißt, entscheidet die Domäne.
  artefaktstatus: (threadId) => getEntwurf(threadId)?.status ?? null,

  aktionen: { enqueueAction, getQueue, startActionWorker, stopActionWorker },

  datensatz: lies("tasks.json"),

  // Der Datensatz für Metrik 3.13.
  retrieval: {
    principale: aclDatensatz.principale,
    dokumente: aclConnector.hole(),
    faelle: aclDatensatz.faelle,
  },

  // Der Datensatz für Metrik 3.14. Er teilt sich Quellsystem und Principale
  // mit dem Retrieval-Datensatz — zwei Kopien liefen auseinander, und dann
  // misst 3.14 etwas anderes als 3.13.
  //
  // `baue()` liefert je Fall eine FRISCHE Quelle. Teurer als eine für alle,
  // aber ein Entzugsfall darf nicht davon abhängen, was ein vorheriger
  // zurückgenommen hat.
  entzug: {
    principale: aclDatensatz.principale,
    faelle: entzugDatensatz.faelle,
    baue: () => createNotizlaufwerk(aclDatensatz.quellsystem),
  },

  // Keine Ausnahme: diese Domäne hat einen Connector und beide Datensätze,
  // also müssen alle Pflichtmetriken gemessen und erfüllt sein (ADR-0017).
  // Das leere Objekt ist die Aussage. Verschwänden die Fälle aus `retrieval`
  // oder `entzug`, fiele der jeweilige Nenner auf null und der Lauf würde rot
  // — vorher blieb er grün, weil „ungemessen" als „nicht gefallen" durchging.
  ungemessen: {},
};
