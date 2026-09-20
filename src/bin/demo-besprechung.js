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
import { setzeLeseweg } from "../domains/besprechung/leseweg.js";
import { createAufloeser } from "../kernel/governance/identitaet/index.js";
import { createFixturesAufloeser } from "../kernel/governance/identitaet/fixtures.js";
import { istPrincipalAufloesbar } from "../kernel/context/envelope.js";
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

// ── Teil 3: Die Naht — der Agent liest als der, der fragt ────────────────
// Bis zum 2026-09-20 fehlte hier der Zusammenhang: Teil 1 fragte als Principal,
// Teil 3 startete den Ablauf ohne einen. Der Agent schrieb über eine Notiz, die
// er nie gelesen hatte. Seit T1 (ADR-0019) ist es EIN Vorgang, und man sieht es
// an zwei Läufen mit derselben Aufgabe.
setzeLeseweg(store);

// ── Die Identität dieses Kanals (T2, ADR-0018) ───────────────────────────
// Der Kanal legt einen NACHWEIS vor und glaubt keinen Principal. Das
// Verzeichnis ist eine Projektion der Principale des Datensatzes; `kaputt`
// fällt heraus, weil ein missgestalteter Principal dort nicht eingetragen
// werden kann — `fixtures.js` prüft beim Bau, nicht im Lauf.
const aufloeser = createAufloeser({
  adapter: createFixturesAufloeser({
    verzeichnis: Object.fromEntries(
      Object.entries(datensatz.principale)
        .filter(([, p]) => istPrincipalAufloesbar(p))
        .map(([name, p]) => [`nachweis-${name}`, p]),
    ),
  }),
});

// Gibt es den Nachweis nicht, ist das Ergebnis `null` — und `null` heißt für den
// Leseweg „leer mit Grund", nicht „alles". Fail-closed ist die Voreinstellung.
const alsWer = (nachweis) => aufloeser.aufloese(nachweis);

const { startWorkflow, resolveApproval } = getRunner(besprechungDomain.name);
const AUFGABE = "Aktionspunkte aus notiz:n-sprint zum Rollout.";

const lausche = (threadId) =>
  agentEventBus.on(threadId, (ev) => {
    if (ev.type === "agent_log") console.log("   " + ev.line);
  });

// clara ist in der Gruppe `leitung`; n-sprint gehört der Gruppe `technik`, und
// clara steht auch nicht auf ihren Freigaben. Sie darf die Notiz nicht sehen.
console.log(
  `\n▶  ${"clara".padEnd(5)} fragt: „${AUFGABE}" — sie darf n-sprint NICHT sehen\n`,
);
const claraId = crypto.randomUUID();
lausche(claraId);
await startWorkflow({
  task: AUFGABE,
  threadId: claraId,
  principal: await alsWer("nachweis-clara"),
});
console.log(
  `   → Entwurf: ${getEntwurf(claraId)?.status ?? "keiner"} · Queue: ${
    getQueue().filter((a) => a.threadId === claraId).length
  } Eintrag(e) — und KEIN Modellaufruf, das Ergebnis stand vor den Kosten fest`,
);

// Ein Nachweis, den das Verzeichnis nicht kennt. DIE KANTE VON T2: keine
// Identität heißt leeres Ergebnis und kein Modellaufruf — nicht „alles sehen".
console.log(
  `\n▶  ein unbekannter Nachweis fragt dasselbe — niemand löst ihn auf\n`,
);
const fremdId = crypto.randomUUID();
lausche(fremdId);
await startWorkflow({
  task: AUFGABE,
  threadId: fremdId,
  principal: await alsWer("nachweis-gibtsnicht"),
});
console.log(
  `   → Entwurf: ${getEntwurf(fremdId)?.status ?? "keiner"} · Queue: ${
    getQueue().filter((a) => a.threadId === fremdId).length
  } Eintrag(e) — Verzeichnisaufrufe: ${aufloeser.statistik.verzeichnisAufrufe}, Treffer: ${aufloeser.statistik.treffer}`,
);

// dora sieht n-sprint über eine Einzelfreigabe (ADR-0012), nicht über eine
// Gruppe. Dieselbe Aufgabe, dieselbe Notiz, anderer Ausgang.
console.log(
  `\n▶  ${"dora".padEnd(5)} fragt dasselbe — sie ist einzeln freigegeben\n`,
);
const threadId = crypto.randomUUID();
lausche(threadId);
const { interrupted } = await startWorkflow({
  task: AUFGABE,
  threadId,
  principal: await alsWer("nachweis-dora"),
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
