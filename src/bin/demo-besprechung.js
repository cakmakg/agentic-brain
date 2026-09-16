// ── bin/demo-besprechung.js ──────────────────────────────────────────────
// Die Vertikale aus ADR-0010 in einem Befehl: npm run demo:besprechung
//
//   Connector → Synchronisation → Suche als Principal
//   guardrail → extrahierer → pruefer → entwurf → (HITL HÄLT AN)
//             → Genehmigung → ticketdienst → END
//
// WARUM DAS NICHT `npm run demo` IST. Jener Befehl ist das Erfolgskriterium K5
// und misst „clone → install → demo läuft durch". Ihn auf eine andere Domäne
// umzustellen hieße, die Zahl zu ändern und dabei zu behaupten, dieselbe
// gemessen zu haben. Er bleibt deshalb auf `beispiel`; dieser hier tritt
// DANEBEN — dieselbe Regel wie beim Store-Adapter (ADR-0006).
//
// Ohne ANTHROPIC_API_KEY läuft alles im Mock-Modus vollständig durch,
// kostenlos und deterministisch.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { getRunner } from "../kernel/registry.js";
import { agentEventBus } from "../kernel/governance/eventBus.js";
import { baueStore } from "../kernel/context/aufbau.js";
import { synchronisiere } from "../kernel/connectors/synchronisation.js";
import { suche } from "../kernel/retrieval/suche.js";
import { besprechungDomain } from "../domains/besprechung/domain.js";
import { createNotizlaufwerk } from "../domains/besprechung/connectors/notizlaufwerk.js";
import { getEntwurf } from "../domains/besprechung/agents/entwurf.js";
import { getQueue } from "../domains/besprechung/actions.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const datensatz = JSON.parse(
  fs.readFileSync(
    path.resolve(hier, "../../evals/domains/besprechung/golden/acl.json"),
    "utf8",
  ),
);

// ── Teil 1: Kontext aufnehmen und berechtigungstreu abfragen ─────────────
console.log("\n▶  Connector: das Notizenlaufwerk wird synchronisiert...\n");

const store = await baueStore("memory");
const laufwerk = createNotizlaufwerk(datensatz.quellsystem);
const bericht = await synchronisiere(store, laufwerk.connector);
console.log(
  `   ${bericht.dokumente} Notizen → ${bericht.chunks} Chunks, jeder mit erfasster Envelope`,
);

const zeige = async (name) => {
  const principal = datensatz.principale[name];
  const { dokumente, grund } = await suche({
    store,
    principal,
    anfrage: "Offene Punkte Rollout",
    k: 100,
  });
  const ids = dokumente.map((d) => d.dokumentId).sort();
  console.log(
    `   ${name.padEnd(12)} sieht ${ids.length ? ids.join(", ") : "— nichts —"}${
      grund ? `  (${grund})` : ""
    }`,
  );
};

console.log("\n▶  Dieselbe Frage, verschiedene Berechtigungen:\n");
for (const name of ["anna", "bruno", "clara", "dora", "egon", "kaputt"])
  await zeige(name);

// ── Teil 2: Ein Entzug in der Quelle breitet sich aus ────────────────────
console.log(
  "\n▶  Anna wird aus der Besprechung b-sprint entfernt (Entzug IN DER QUELLE)...\n",
);
laufwerk.aendere({
  art: "teilnehmer-entfernen",
  besprechungId: "b-sprint",
  personId: "anna",
});
console.log("   vor der Synchronisation — der Speicher weiss noch nichts:");
await zeige("anna");
await synchronisiere(store, laufwerk.connector);
console.log("   nach EINEM Synchronisationszyklus:");
await zeige("anna");

// ── Teil 3: Der Ablauf bis zur menschlichen Genehmigung ──────────────────
const { startWorkflow, resolveApproval } = getRunner(besprechungDomain.name);
const threadId = crypto.randomUUID();

agentEventBus.on(threadId, (ev) => {
  if (ev.type === "agent_log") console.log("   " + ev.line);
});

console.log("\n▶  Workflow startet: Aktionspunkte aus notiz:n-sprint...\n");
const { interrupted } = await startWorkflow({
  task: "Aktionspunkte aus notiz:n-sprint zum Rollout.",
  threadId,
});

if (interrupted) {
  console.log(
    "\n⏸  Der Graph HÄLT bei human_approval (interruptBefore). Entwurf:",
  );
  console.log("   status:", getEntwurf(threadId)?.status);
  console.log("   titel :", getEntwurf(threadId)?.titel);
  console.log("\n▶  Der Mensch GENEHMIGT → ticketdienst läuft...\n");
  await resolveApproval({ threadId, approved: true });
  console.log("✓ Entwurfsstatus:", getEntwurf(threadId)?.status);
  console.log(
    "✓ Aktions-Queue:",
    getQueue()
      .filter((a) => a.threadId === threadId)
      .map((a) => `${a.actionType} (${a.status})`)
      .join(", ") || "leer",
  );
}
process.exit(0);
