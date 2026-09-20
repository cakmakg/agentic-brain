// ── bin/fragen.js ────────────────────────────────────────────────────────
// DER KANAL DES MVP (T3, ADR-0019). Ein Mensch fragt mit seiner Identität, sieht
// den Entwurf und entscheidet SELBST — der Ablauf hält an und wartet.
//
//   npm run fragen
//   npm run fragen -- "Aktionspunkte aus notiz:n-sprint zum Rollout."
//
// Aus einer Pipe gelesen, ist es ein Tor. Die Reihenfolge der Zeilen ist die
// Reihenfolge der Fragen — Nachweis, Aufgabe, Entscheidung —, und eine LEERE
// Zeile bei der Aufgabe nimmt die Vorgabe:
//
//   printf 'nachweis-dora\n\nja\n'   | npm run fragen   # → genau eine Aktion
//   printf 'nachweis-dora\n\nnein\n' | npm run fragen   # → Queue bleibt leer
//
// WARUM ES NICHT `npm run demo` IST. Jener Befehl ist das Erfolgskriterium K5
// und läuft ohne jede Eingabe durch; eine Frage darin würde ihn in CI hängen
// lassen. Und `demo-besprechung.js` GENEHMIGT SICH SELBST
// (`resolveApproval({ approved: true })` steht dort im Skript) — das ist eine
// Vorführung des Ablaufs, kein Beweis, dass ein Mensch entscheidet. Dieser
// Einstiegspunkt tritt DANEBEN, wie der zweite Store-Adapter neben den ersten.
//
// ── Die eine Regel, die dieser Kanal nicht brechen darf ──────────────────
//
// Die Kante im Kern prüft auf exakt `true` (`agent/build.js`), und der HTTP-Rand
// wandelt nichts um: `{"approved": "false"}` ist eine ABLEHNUNG, keine
// Genehmigung. Dieselbe Regel gilt hier. Deshalb:
//
//   * Nur „ja" oder „j" genehmigt — beides wird zu einem echten `true`.
//   * ALLES andere lehnt ab: eine leere Zeile, ein Tippfehler, ein Abbruch,
//     ein Ende der Eingabe. Fail-closed heißt: im Zweifel nicht.
//   * Es wird EINMAL gefragt. Eine Schleife „bitte nochmal" könnte bei
//     beendeter Eingabe nie enden — ein Tor, das hängt, ist keines.
//
// Der Wert, der an `resolveApproval` geht, ist ein Boolean. Eine Zeichenkette
// „true" dürfte hier nie entstehen; die Prüfung darauf steht unten und ist
// absichtlich eine Behauptung über den eigenen Code.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { getRunner } from "../kernel/registry.js";
import { agentEventBus } from "../kernel/governance/eventBus.js";
import { baueStore } from "../kernel/context/aufbau.js";
import { synchronisiere } from "../kernel/connectors/synchronisation.js";
import { createAufloeser } from "../kernel/governance/identitaet/index.js";
import { createFixturesAufloeser } from "../kernel/governance/identitaet/fixtures.js";
import { istPrincipalAufloesbar } from "../kernel/context/envelope.js";
import { besprechungDomain } from "../domains/besprechung/domain.js";
import { setzeLeseweg } from "../domains/besprechung/leseweg.js";
import { createNotizlaufwerk } from "../domains/besprechung/connectors/notizlaufwerk.js";
import { getEntwurf } from "../domains/besprechung/agents/entwurf.js";
import { getQueue } from "../domains/besprechung/actions.js";

const hier = path.dirname(fileURLToPath(import.meta.url));

// Dieselbe Quelle wie `demo-besprechung.js` und der Harness. Eine zweite Kopie
// des Quellsystems wäre eine zweite Wahrheit: sie driftet, und dann zeigt der
// Kanal etwas anderes als die Messung.
const datensatz = JSON.parse(
  fs.readFileSync(
    path.resolve(hier, "../../evals/domains/besprechung/golden/acl.json"),
    "utf8",
  ),
);

// ── Fragen, für einen Menschen UND für ein Tor ───────────────────────────
// Am Terminal liest `readline`. Kommt die Eingabe aus einer Pipe, wird sie
// vorher ganz gelesen und Zeile für Zeile verbraucht — sonst wartete
// `question()` auf ein Ende, das schon da ist, und der Lauf hinge. Ein Tor ist
// ein Befehl; ein Befehl, der hängt, ist keines.
function baueFrager() {
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return {
      frage: (text) => rl.question(text),
      schliesse: () => rl.close(),
    };
  }

  const zeilen = fs.readFileSync(0, "utf8").split(/\r?\n/);
  return {
    // Ist die Eingabe erschöpft, kommt eine leere Zeile — und eine leere Zeile
    // ist eine Ablehnung, keine Nachfrage.
    frage: async (text) => {
      const antwort = zeilen.shift() ?? "";
      process.stdout.write(`${text}${antwort}\n`);
      return antwort;
    },
    schliesse: () => {},
  };
}

// „ja" genehmigt. Sonst nichts. Der Rückgabewert ist ein Boolean, kein Wort.
const GENEHMIGT = /^(ja|j)$/i;
const istGenehmigung = (antwort) => GENEHMIGT.test(String(antwort).trim());

const frager = baueFrager();
const abschluss = (feld) => {
  // Die letzte Zeile ist maschinenlesbar: so kann ein Test dieses Tor fahren,
  // ohne den Fließtext zu lesen. Dieselbe Form wie die Fixtures der
  // Persistenzprüfung.
  console.log(JSON.stringify(feld));
  frager.schliesse();
  process.exit(0);
};

// ── Die Quelle aufnehmen, den Leseweg verdrahten ─────────────────────────
const store = await baueStore("memory");
await synchronisiere(
  store,
  createNotizlaufwerk(datensatz.quellsystem).connector,
);
setzeLeseweg(store);

const aufloeser = createAufloeser({
  adapter: createFixturesAufloeser({
    verzeichnis: Object.fromEntries(
      Object.entries(datensatz.principale)
        .filter(([, p]) => istPrincipalAufloesbar(p))
        .map(([name, p]) => [`nachweis-${name}`, p]),
    ),
  }),
});

const bekannte = Object.keys(datensatz.principale)
  .filter((n) => istPrincipalAufloesbar(datensatz.principale[n]))
  .map((n) => `nachweis-${n}`)
  .join(", ");

console.log("\nDer Kanal dieses Repos: fragen, sehen, selbst entscheiden.\n");
console.log(`  Bekannte Nachweise: ${bekannte}\n`);

// ── 1. Wer fragt? ────────────────────────────────────────────────────────
const nachweis = (await frager.frage("Nachweis: ")).trim();
const principal = await aufloeser.aufloese(nachweis);

if (!principal) {
  // An der Tür abgelehnt. Im Ablauf wäre es ebenso ausgegangen — ein nicht
  // auflösbarer Principal bekommt ein leeres Ergebnis mit Grund (ADR-0008 F7) —,
  // aber ein Kanal, der eine unbekannte Identität erst arbeiten lässt, verbrennt
  // dafür Rechenzeit und im Ernstfall Geld.
  console.log(
    `\n⛔ Dieser Nachweis ist nicht auflösbar. Kein Lauf, kein Modellaufruf.\n` +
      `   (Auch im Ablauf käme nichts: ohne Principal antwortet der Leseweg leer.)\n`,
  );
  abschluss({
    nachweis,
    identitaet: null,
    threadId: null,
    entwurf: null,
    genehmigt: null,
    queue: 0,
  });
}

console.log(
  `\n✓ Aufgelöst: ${principal.benutzerId} (Mandant ${principal.tenantId}, Gruppen: ${
    principal.gruppen.length ? principal.gruppen.join(", ") : "keine"
  })\n`,
);

// ── 2. Was soll geschehen? ───────────────────────────────────────────────
const VORGABE = "Aktionspunkte aus notiz:n-sprint zum Rollout.";
const ausArgument = process.argv.slice(2).join(" ").trim();
const task =
  ausArgument ||
  (await frager.frage(`Aufgabe [${VORGABE}]: `)).trim() ||
  VORGABE;

const { startWorkflow, resolveApproval } = getRunner(besprechungDomain.name);
const threadId = crypto.randomUUID();

agentEventBus.on(threadId, (ev) => {
  if (ev.type === "agent_log") console.log("   " + ev.line);
});

console.log(`\n▶  Lauf startet als ${principal.benutzerId}...\n`);
const { interrupted } = await startWorkflow({ task, threadId, principal });

// ── 3. Gibt es überhaupt etwas zu entscheiden? ───────────────────────────
if (!interrupted) {
  // Kein Entwurf heißt: nichts zu genehmigen. Das ist der häufigste Weg, wenn
  // die Notiz für diesen Principal nicht sichtbar ist — und er endet ohne jede
  // Frage an den Menschen.
  console.log(
    `\n✓ Es gibt nichts zu genehmigen. Entwurf: ${
      getEntwurf(threadId)?.status ?? "keiner"
    }, Queue: ${getQueue().filter((a) => a.threadId === threadId).length}\n`,
  );
  abschluss({
    nachweis,
    identitaet: principal.benutzerId,
    threadId,
    entwurf: getEntwurf(threadId)?.status ?? null,
    genehmigt: null,
    queue: getQueue().filter((a) => a.threadId === threadId).length,
  });
}

// ── 4. Der Entwurf, und die Entscheidung des Menschen ────────────────────
const entwurf = getEntwurf(threadId);
console.log("\n⏸  Der Ablauf HÄLT AN. Das ist der Entwurf:\n");
console.log(`   Titel   : ${entwurf?.titel ?? "—"}`);
console.log(`   Herkunft: notiz:${entwurf?.notizId ?? "—"}`);
for (const p of entwurf?.aktionspunkte ?? []) {
  console.log(`   • ${p.text}  →  ${p.verantwortlich}`);
}

const antwort = await frager.frage(
  "\nGenehmigen? (ja genehmigt, alles andere lehnt ab) ",
);
const genehmigt = istGenehmigung(antwort);

// Eine Behauptung über den eigenen Code: was hier hinausgeht, ist ein Boolean.
// Entstünde je eine Zeichenkette, wäre die Kante im Kern zwar weiter dicht
// (`=== true`), aber dieser Kanal hätte still ein „nein" aus einem „ja" gemacht.
if (typeof genehmigt !== "boolean") {
  throw new Error("fragen: die Entscheidung muss ein Boolean sein.");
}

console.log(
  genehmigt
    ? "\n▶  GENEHMIGT — der Ticketdienst läuft...\n"
    : "\n▶  ABGELEHNT — es wird nichts zugestellt und nichts eingereiht.\n",
);
await resolveApproval({ threadId, approved: genehmigt });

const aktionen = getQueue().filter((a) => a.threadId === threadId);
console.log(
  `\n✓ Entwurf: ${getEntwurf(threadId)?.status ?? "—"} · Queue: ${aktionen.length} Eintrag(e)${
    aktionen.length ? ` (${aktionen.map((a) => a.actionType).join(", ")})` : ""
  }\n`,
);

abschluss({
  nachweis,
  identitaet: principal.benutzerId,
  threadId,
  entwurf: getEntwurf(threadId)?.status ?? null,
  genehmigt,
  queue: aktionen.length,
  aktionen: aktionen.map((a) => a.actionType),
});
