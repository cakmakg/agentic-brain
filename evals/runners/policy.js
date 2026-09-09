// ── evals/runners/policy.js ──────────────────────────────────────────────
// SCHICHT A — Richtlinien und Routing, im Mock-Modus, deterministisch und
// kostenlos. Sie misst NICHT die Qualität der LLM-Ausgabe (das ist Schicht B),
// sondern ob die Zusagen halten, die nie brechen dürfen.
//
// Die Agentenreihenfolge und der Bedrohungswert werden aus dem TRACE gelesen,
// nicht aus dem Event-Bus: der Bus zeigt an und vergisst, der Trace bleibt und
// ist nachprüfbar — wer eine Zahl anzweifelt, kann die Zeile aufschlagen.
//
// DOMÄNENFREI. Diese Datei nennt keine Domäne, keinen Agenten und keinen
// Aktionstyp. Was eine Domäne ausmacht, bringt ihr Adapter mit
// (`evals/domains/<domäne>/adapter.js`); WELCHE Domänen gefahren werden, steht
// in `evals/domains/index.js`. Damit gilt das Prüfkriterium des Gerüsts auch für
// die Messschicht: eine zweite gemessene Domäne ändert hier null Zeilen.
//
//   npm run evals                # alle registrierten Domänen
//   npm run evals -- beispiel    # nur diese

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const evalsDir = path.resolve(hier, "..");
const wurzel = path.resolve(evalsDir, "..");

// Traces dieses Laufs an einen eigenen Ort, damit sie nicht mit Demo-Läufen
// durcheinandergeraten.
const traceDir = path.join(evalsDir, "traces");
process.env.TRACE_DIR = traceDir;

// Und ein FRISCHES Zustandsverzeichnis je Lauf. Ohne das schleppte der zweite
// Durchgang den ersten mit — und der Determinismus-Nachweis wäre keiner mehr,
// sondern eine Aussage über gealterten Zustand. Nicht ins Repo:
// os.tmpdir(), damit auch ein abgebrochener Lauf nichts hinterlässt.
process.env.STATE_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "agentic-evals-zustand-"),
);

const { MOCK_LLM } = await import("../../src/kernel/config/env.js");
if (!MOCK_LLM) {
  console.error(
    "Schicht A läuft nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — " +
      "ein echtes Modell macht diese Messung nichtdeterministisch und kostenpflichtig.",
  );
  process.exit(1);
}

const { cost } = await import("../../src/kernel/governance/costTracker.js");
const { onLlmCall } = await import("../../src/kernel/llm/adapter.js");
const { berechneMetriken, vertragstreue } = await import("../metrics/index.js");
const { DOMAENEN, ladeAdapter } = await import("../domains/index.js");

// ── Einen Workflow-Fall ausführen ────────────────────────────────────────
async function laufWorkflow(aufgabe, adapter) {
  const { startWorkflow, resolveApproval } = adapter.runner;
  const threadId = crypto.randomUUID();
  const inputTokens = [];
  let kostenUsd = 0;
  // Je Aufruf summieren statt Delta eines wachsenden Zählers zu nehmen: sonst
  // weicht dieselbe Messung im zweiten Durchgang in den letzten Bits ab und
  // der Determinismus-Nachweis meldet einen Unterschied, den es nicht gibt.
  const abmelden = onLlmCall((c) => {
    inputTokens.push(c.inputTokens);
    kostenUsd += c.usd;
  });

  let fehler = null;
  let endstatus = null;

  if (aufgabe.gedrosselt) cost.setThrottled(true);
  try {
    const { interrupted } = await startWorkflow({
      task: aufgabe.task,
      threadId,
    });
    endstatus = interrupted ? "AWAITING_APPROVAL" : "DONE";

    if (interrupted && aufgabe.genehmigung !== null) {
      await resolveApproval({ threadId, approved: aufgabe.genehmigung });
      endstatus = aufgabe.genehmigung ? "PUBLISHED" : "REJECTED";
    }
  } catch (e) {
    fehler = e.message;
  } finally {
    if (aufgabe.gedrosselt) cost.setThrottled(false);
    abmelden();
  }

  // Der Trace ist die Quelle für Reihenfolge und Bedrohungswert.
  const zeilen = leseTrace(threadId);
  const sequenz = zeilen.filter((z) => z.type === "node").map((z) => z.node);
  const guardrailZeile = zeilen.find((z) => z.node === adapter.eingang);
  const threatScore = guardrailZeile?.threatScore ?? null;

  return {
    id: aufgabe.id,
    gruppe: aufgabe.gruppe,
    art: "workflow",
    genehmigung: aufgabe.genehmigung,
    sequenz,
    endstatus,
    artefaktstatus: adapter.artefaktstatus(threadId),
    queueEintraege: adapter.aktionen
      .getQueue()
      .filter((a) => a.threadId === threadId).length,
    threatScore,
    guardrail: bewerteGuardrail(sequenz, threatScore, aufgabe, adapter),
    llmAufrufe: inputTokens.length,
    inputTokens,
    kostenUsd,
    fehler,
    erwartet: aufgabe.erwartet,
    abweichungen: [],
  };
}

function leseTrace(threadId) {
  try {
    return fs
      .readFileSync(path.join(traceDir, `${threadId}.jsonl`), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((z) => JSON.parse(z));
  } catch {
    return [];
  }
}

// Drei Wege des Guardrails, aus dem Trace abgeleitet.
function bewerteGuardrail(sequenz, threatScore, aufgabe, adapter) {
  if (aufgabe.gedrosselt) return "gedrosselt";
  // Blockiert wird STRUKTURELL erkannt: der Lauf endet nach dem Eingangsknoten.
  // Die zweite Grenze kommt aus der Domäne, nicht aus einer Zahl an dieser
  // Stelle — sonst misst der Harness eine Schwelle, die das System nicht hat.
  if (sequenz.length === 1 && sequenz[0] === adapter.eingang)
    return "blockiert";
  if (threatScore >= adapter.guardrailSchwellen.sanitisieren)
    return "sanitisiert";
  return "durchgelassen";
}

// ── Einen Aktions-Fall ausführen ─────────────────────────────────────────
async function laufAktion(aufgabe, adapter) {
  const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
    adapter.aktionen;
  const threadId = crypto.randomUUID();
  let eingereiht = true;
  let id = null;
  try {
    id = enqueueAction({
      threadId,
      actionType: aufgabe.actionType,
      payload: aufgabe.payload,
    });
  } catch {
    eingereiht = false; // TOR 1 hat vor dem Schreiben abgelehnt
  }

  if (eingereiht) {
    startActionWorker(5);
    await new Promise((r) => setTimeout(r, 60));
    stopActionWorker();
  }

  return {
    id: aufgabe.id,
    gruppe: aufgabe.gruppe,
    art: "aktion",
    genehmigung: null,
    sequenz: [],
    endstatus: getQueue().find((a) => a.id === id)?.status ?? null,
    artefaktstatus: null,
    queueEintraege: 0, // zählt nicht als Workflow-Aktion
    threatScore: null,
    guardrail: null,
    llmAufrufe: 0,
    inputTokens: [],
    kostenUsd: 0,
    fehler: null,
    eingereiht,
    erwartet: aufgabe.erwartet,
    abweichungen: [],
  };
}

// ── Ergebnis gegen die Erwartung halten ──────────────────────────────────
function pruefe(lauf, sequenzen) {
  const e = lauf.erwartet ?? {};
  const ab = lauf.abweichungen;

  if (lauf.art === "aktion") {
    if (e.eingereiht !== undefined && lauf.eingereiht !== e.eingereiht)
      ab.push(`eingereiht: ${lauf.eingereiht} statt ${e.eingereiht}`);
    if (e.endstatus !== undefined && lauf.endstatus !== e.endstatus)
      ab.push(`endstatus: ${lauf.endstatus} statt ${e.endstatus}`);
    return lauf;
  }

  const erwarteteSequenz = sequenzen[e.sequenz];
  if (
    erwarteteSequenz &&
    JSON.stringify(lauf.sequenz) !== JSON.stringify(erwarteteSequenz)
  ) {
    ab.push(
      `Sequenz weicht ab: [${lauf.sequenz.join(" → ")}] statt [${erwarteteSequenz.join(" → ")}]`,
    );
  }
  if (e.endstatus !== undefined && lauf.endstatus !== e.endstatus)
    ab.push(`endstatus: ${lauf.endstatus} statt ${e.endstatus}`);
  if (
    e.artefaktstatus !== undefined &&
    lauf.artefaktstatus !== e.artefaktstatus
  )
    ab.push(`artefaktstatus: ${lauf.artefaktstatus} statt ${e.artefaktstatus}`);
  if (
    e.queueEintraege !== undefined &&
    lauf.queueEintraege !== e.queueEintraege
  )
    ab.push(`queueEintraege: ${lauf.queueEintraege} statt ${e.queueEintraege}`);
  if (e.threatScore !== undefined && lauf.threatScore !== e.threatScore)
    ab.push(`threatScore: ${lauf.threatScore} statt ${e.threatScore}`);
  if (e.guardrail !== undefined && lauf.guardrail !== e.guardrail)
    ab.push(`guardrail: ${lauf.guardrail} statt ${e.guardrail}`);
  if (e.llmAufrufe !== undefined && lauf.llmAufrufe !== e.llmAufrufe)
    ab.push(`llmAufrufe: ${lauf.llmAufrufe} statt ${e.llmAufrufe}`);

  // Knotenzählungen generisch: jede Erwartung `<knoten>Aufrufe` zählt, wie oft
  // der Knoten in der Sequenz steht. Feste Agentennamen an dieser Stelle wären
  // Domänenwissen mitten im Runner — der Datensatz nennt sie, der Runner nicht.
  for (const [schluessel, erwartet] of Object.entries(e)) {
    const treffer = /^(.+)Aufrufe$/.exec(schluessel);
    if (!treffer || treffer[1] === "llm") continue;
    const n = lauf.sequenz.filter((s) => s === treffer[1]).length;
    if (n !== erwartet) ab.push(`${schluessel}: ${n} statt ${erwartet}`);
  }
  return lauf;
}

async function durchgang(adapter) {
  const laeufe = [];
  for (const aufgabe of adapter.datensatz.aufgaben) {
    const lauf =
      aufgabe.art === "aktion"
        ? await laufAktion(aufgabe, adapter)
        : await laufWorkflow(aufgabe, adapter);
    laeufe.push(pruefe(lauf, adapter.datensatz.sequenzen));
  }
  return laeufe;
}

// ── Eine Domäne messen: zwei Durchgänge, weil Determinismus beweispflichtig ist
async function fahreDomaene(adapter) {
  // Jede Domäne beginnt bei null. Ohne das trüge die zweite den Verbrauch der
  // ersten mit — und die Kostenmetrik meldete für sie eine Zahl, die zur Hälfte einer
  // anderen Domäne gehört. Der Kill-Switch ist ein Prozesszustand, kein
  // Laufzustand: er muss ausdrücklich zurückgesetzt werden.
  cost.reset();

  const erster = await durchgang(adapter);
  const zweiter = await durchgang(adapter);

  const metriken = berechneMetriken(erster, zweiter);
  const treue = vertragstreue(erster);

  // Der Determinismus-Nachweis vergleicht die MESSWERTE beider Durchgänge —
  // nicht den Bericht, der einen Zeitstempel trägt.
  const metrikenZweiter = berechneMetriken(zweiter, erster);
  const deterministisch =
    JSON.stringify(metriken) === JSON.stringify(metrikenZweiter);

  const bericht = {
    erzeugt: new Date().toISOString(),
    schicht: "A",
    modus: "mock",
    domaene: adapter.name,
    aufgaben: adapter.datensatz.aufgaben.length,
    deterministisch,
    vertragstreue: treue,
    metriken,
  };

  // Je Domäne eine Berichtsdatei. Ein gemeinsamer Name überschriebe die erste
  // Domäne mit der zweiten — der Bericht hieße dann „Schicht A" und meinte nur
  // die letzte.
  const berichtDir = path.join(evalsDir, "reports");
  fs.mkdirSync(berichtDir, { recursive: true });
  const datei = path.join(
    berichtDir,
    `${bericht.erzeugt.slice(0, 10)}-schicht-a-${adapter.name}.json`,
  );
  fs.writeFileSync(datei, JSON.stringify(bericht, null, 2) + "\n");

  // ── Konsolenausgabe ────────────────────────────────────────────────────
  const proz = (w) =>
    w === null ? "nicht messbar" : `${(w * 100).toFixed(1)} %`;
  const zeile = (m) =>
    `  ${m.name.padEnd(38)} ${proz(m.wert).padStart(13)}   (${m.zaehler}/${m.nenner})`;

  console.log(
    `\nSchicht A · Domäne ${bericht.domaene} · ${bericht.aufgaben} Aufgaben · Mock\n`,
  );
  console.log(zeile(metriken["3.1"]));
  console.log(zeile(metriken["3.2"]));
  console.log(zeile(metriken["3.3"]));
  console.log(zeile(metriken["3.4"]));
  console.log(
    `  ${metriken["3.5"].name.padEnd(38)} P ${proz(metriken["3.5"].praezision)} · R ${proz(metriken["3.5"].trefferquote)}   (TP ${metriken["3.5"].tp} · FP ${metriken["3.5"].fp} · FN ${metriken["3.5"].fn})`,
  );
  console.log(
    `  ${metriken["3.6"].name.padEnd(38)} Median ${metriken["3.6"].median?.toFixed(6)} USD   (${metriken["3.6"].nenner})`,
  );
  console.log(
    `  ${metriken["3.12"].name.padEnd(38)} Median ×${metriken["3.12"].medianVerhaeltnis?.toFixed(2)} · p90 ×${metriken["3.12"].p90Verhaeltnis?.toFixed(2)} · Spitze ${metriken["3.12"].p90SpitzeTokens} Token`,
  );

  console.log(
    `\n  Vertragstreue: ${treue.zaehler}/${treue.nenner} Aufgaben wie erwartet`,
  );
  for (const a of treue.abweichungen) {
    console.log(`   🔴 ${a.id} (${a.gruppe})`);
    for (const p of a.punkte) console.log(`      ${p}`);
  }
  console.log(
    `  Determinismus (zwei Durchgänge): ${deterministisch ? "🟢 identisch" : "🔴 abweichend"}`,
  );
  console.log(`\n  Bericht: ${path.relative(wurzel, datei)}\n`);

  // Ein Harness, der immer grün meldet, misst nichts. Rot ist ein Ergebnis,
  // kein Absturz — der Exit-Code trägt es nach CI.
  const bestanden =
    deterministisch &&
    treue.zaehler === treue.nenner &&
    metriken["3.1"].erfuellt !== false &&
    metriken["3.2"].erfuellt !== false &&
    metriken["3.3"].erfuellt !== false &&
    metriken["3.4"].erfuellt !== false;

  return bestanden;
}

// ── Ausführen ────────────────────────────────────────────────────────────
fs.mkdirSync(traceDir, { recursive: true });

// Ohne Argument alle registrierten Domänen. Eine einzelne zu fahren ist für die
// Entwicklung gedacht — in CI läuft immer der volle Satz, sonst bliebe eine
// Domäne ungemessen, während der Befehl grün meldet.
const gewaehlt = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const zuFahren = gewaehlt.length ? gewaehlt : DOMAENEN;

const ergebnisse = [];
for (const name of zuFahren) {
  const adapter = await ladeAdapter(name);
  ergebnisse.push([name, await fahreDomaene(adapter)]);
}

if (ergebnisse.length > 1) {
  console.log(
    `  Gesamt: ${ergebnisse
      .map(([n, ok]) => `${n} ${ok ? "🟢" : "🔴"}`)
      .join(" · ")}\n`,
  );
}

process.exit(ergebnisse.every(([, ok]) => ok) ? 0 : 1);
