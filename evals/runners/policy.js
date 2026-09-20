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

// `--store=postgres` ist gleichwertig zu STORE_ADAPTER=postgres. Beide Wege
// existieren, weil das Setzen einer Umgebungsvariablen je nach Shell anders
// geschrieben wird — und ein Messbefehl, der auf einem Rechner anders lautet
// als auf dem anderen, wird irgendwann falsch abgetippt.
//
// Das MUSS hier oben stehen: `aufbau.js` liest die Vorgabe beim Import, und
// ein danach gesetzter Wert käme zu spät.
const storeArg = process.argv.find((a) => a.startsWith("--store="));
if (storeArg) process.env.STORE_ADAPTER = storeArg.slice("--store=".length);

const embArg = process.argv.find((a) => a.startsWith("--embedding="));
if (embArg) process.env.EMBEDDING_ADAPTER = embArg.slice("--embedding=".length);

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

// Mechanik des Kerns, keine Domäne: der Runner baut den Chunk-Speicher selbst
// und füllt ihn aus den Fixtures des Adapters. Damit bleibt der Adapter reine
// Daten und dieser Runner weiterhin domänenfrei.
const {
  baueStore,
  VORGABE: STORE_ADAPTER,
  EMBEDDING_VORGABE: EMBEDDING_ADAPTER,
} = await import("../../src/kernel/context/aufbau.js");
const { ingestiere } =
  await import("../../src/kernel/context/ingest/pipeline.js");
const { suche } = await import("../../src/kernel/retrieval/suche.js");
const { synchronisiere } =
  await import("../../src/kernel/connectors/synchronisation.js");

// ── Einen Workflow-Fall ausführen ────────────────────────────────────────
// Seit T1 (ADR-0019) kann ein Agentenlauf LESEN. Bringt der Adapter einen
// Leseweg mit, bekommt der Lauf einen frischen Speicher und einen Principal —
// und was der Agent dabei aus dem Speicher bekam, geht in den Nenner von 3.13.
// Fehlt der Leseweg (`beispiel` hat keinen Connector, ADR-0004), läuft alles
// wie bisher; der Runner bleibt damit domänenfrei.
async function laufWorkflow(aufgabe, adapter) {
  if (!adapter.leseweg) return laufWorkflowOhneLeseweg(aufgabe, adapter);

  return mitStore(async (store) => {
    await ingestiere(store, adapter.leseweg.dokumente);
    adapter.leseweg.setze(store);
    try {
      return await laufWorkflowOhneLeseweg(aufgabe, adapter);
    } finally {
      // Der Speicher wird gleich geschlossen. Bliebe er verdrahtet, läse der
      // nächste Lauf aus einem geschlossenen Speicher — und das sähe aus wie
      // eine verweigerte Berechtigung.
      adapter.leseweg.setze(null);
    }
  });
}

async function laufWorkflowOhneLeseweg(aufgabe, adapter) {
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
      // AUFGELÖST, nicht geglaubt (ADR-0018): der Fall nennt eine Person, der
      // Kanal legt ihren Nachweis vor, das Verzeichnis antwortet. Es gibt keinen
      // zweiten Weg zu einem Principal — kennt das Verzeichnis den Nachweis
      // nicht, bleibt es `null`, und der Leseweg antwortet leer mit Grund.
      principal: adapter.identitaet
        ? await adapter.identitaet.aufloeser.aufloese(
            adapter.identitaet.nachweis(aufgabe.principal),
          )
        : null,
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
    ...gelesenesZaehlen(adapter, aufgabe, threadId),
    erwartet: aufgabe.erwartet,
    abweichungen: [],
  };
}

// Was der Agent aus dem Speicher bekam — und wie viel davon er nicht hätte
// bekommen dürfen. Der Nenner von 3.13 wächst genau hier um den Agentenpfad.
//
// Erlaubt ist, was der ACL-Datensatz für DIESEN Principal führt: eine
// Projektion seiner Fälle, keine zweite Kopie. Nennt ein Fall keinen Principal,
// ist die erlaubte Menge leer — dann zählt jeder gelieferte Chunk als Leck, und
// das ist die richtige Richtung.
function gelesenesZaehlen(adapter, aufgabe, threadId) {
  if (!adapter.leseweg) return {};
  const beleg = adapter.leseweg.beleg(threadId);
  const erlaubt = new Set(adapter.leseweg.erlaubt[aufgabe.principal] ?? []);
  return {
    gelieferteChunks: beleg.chunks.length,
    unerlaubteChunks: beleg.chunks.filter((c) => !erlaubt.has(c.dokumentId))
      .length,
    gelesenDokumente: beleg.dokumente,
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

// ── Ein Speicher je Fall, adapterunabhaengig ─────────────────────────────
// Der Speicher wird gebaut, GELEERT und am Ende geschlossen.
//
// Das Leeren ist seit Etappe 3c nötig und war es vorher nicht: ein frischer
// `memory`-Adapter ist leer, eine Postgres-Tabelle nicht. Ohne diese Zeile
// säahe Fall 2 die Zeilen von Fall 1 — und der Determinismus-Nachweis wäre
// eine Aussage über gealterten Zustand statt über dieselbe Frage. Genau die
// Art Unterschied, die ein zweiter Adapter aufdeckt.
//
// Das Schließen ebenso: ein Verbindungspool hält den Prozess offen, und ein
// Eval-Lauf, der nie endet, meldet auch nie ein Ergebnis.
async function mitStore(fn) {
  const store = await baueStore();
  await store.leere();
  try {
    return await fn(store);
  } finally {
    await store.schliesse();
  }
}

// ── Einen Abruf-Fall ausführen (Metrik 3.13) ─────────────────────────────
// Ein frischer Speicher je Fall. Teurer als einer für alle, aber ein Fall darf
// nicht davon abhängen, was ein vorheriger hineingeschrieben hat — sonst misst
// der zweite Durchgang gealterten Zustand statt derselben Frage.
async function laufAbruf(fall, adapter) {
  const { principale, dokumente } = adapter.retrieval;
  return mitStore(async (store) => {
    await ingestiere(store, dokumente);

    const principal = principale[fall.principal] ?? null;
    const {
      treffer,
      dokumente: gefunden,
      grund,
    } = await suche({
      store,
      principal,
      anfrage: fall.anfrage,
      // Bewusst hoch: ein Leck darf nicht deshalb unsichtbar bleiben, weil es
      // auf Platz sechs stand. Die Metrik misst Berechtigung, nicht Rangfolge.
      k: 100,
    });

    const erlaubt = new Set(fall.erwartet?.sichtbareDokumente ?? []);
    const gelieferteIds = gefunden.map((d) => d.dokumentId).sort();

    return {
      id: fall.id,
      gruppe: fall.gruppe,
      art: "abruf",
      genehmigung: null,
      sequenz: [],
      endstatus: null,
      artefaktstatus: null,
      queueEintraege: 0,
      threatScore: null,
      guardrail: null,
      llmAufrufe: 0,
      inputTokens: [],
      kostenUsd: 0,
      fehler: null,

      // Zähler und Nenner von 3.13 entstehen HIER, auf Chunk-Ebene: ein Dokument
      // kann mehrere Chunks liefern, und jeder unerlaubte davon ist ein Leck.
      gelieferteChunks: treffer.length,
      unerlaubteChunks: treffer.filter((t) => !erlaubt.has(t.dokumentId))
        .length,

      gelieferteDokumente: gelieferteIds,
      // Was FEHLT, ist kein Leck und gehört nicht in 3.13 — aber ein stiller
      // Ausfall des Retrievals. Die Vertragstreue fängt ihn ab.
      fehlendeDokumente: [...erlaubt].filter((d) => !gelieferteIds.includes(d)),
      grund,
      erwartet: fall.erwartet,
      abweichungen: [],
    };
  });
}

// ── Einen Entzugs-Fall ausführen (Metrik 3.14) ───────────────────────────
// Der Ablauf ist die Metrikdefinition, in fünf Schritten:
//
//   1) frische Quelle, erster Synchronisationszyklus
//   2) suchen  → muss `vorher` entsprechen, sonst belegt der Fall nichts
//   3) den Entzug IN DER QUELLE vornehmen — der Speicher weiß noch nichts
//   4) EIN weiterer Zyklus
//   5) suchen  → muss `nachher` entsprechen; was darüber hinaus kommt, ist
//      ein VERALTETER Chunk und geht in den Zähler von 3.14
//
// Schritt 2 ist der Grund, warum diese Zahl etwas aussagt. Ohne ihn wäre ein
// Fall, dessen Dokument schon vorher unsichtbar war, ein grüner Fall ohne
// Aussage — und ein Speicher, der bei jedem Zyklus alles verwirft, hätte eine
// makellose 3.14.
//
// DOMÄNENFREI wie die anderen Läufe: der Runner kennt weder die Form der
// Quelle noch die Arten des Entzugs. `baue()` liefert einen Connector und
// eine Funktion `aendere`, die die Anweisung des Datensatzes ausführt; was in
// ihr steht, deutet allein die Domäne.
async function laufEntzug(fall, adapter) {
  const { principale, baue } = adapter.entzug;
  return mitStore(async (store) => {
    const quelle = baue();
    const principal = principale[fall.principal] ?? null;

    const frage = { store, principal, anfrage: fall.anfrage, k: 100 };
    const ids = (treffer) => treffer.map((d) => d.dokumentId).sort();

    // 1) und 2)
    await synchronisiere(store, quelle.connector);
    const vorher = await suche(frage);

    // 3) und 4) — genau EIN Zyklus. Mehr zu fahren hieße, die Latenz zu
    // verstecken, die gemessen werden soll.
    quelle.aendere(fall.entzug);
    const ZYKLEN = 1;
    await synchronisiere(store, quelle.connector);

    // 5)
    const nachher = await suche(frage);

    const erlaubtNachher = new Set(fall.nachher?.sichtbareDokumente ?? []);
    const gelieferteIdsNachher = ids(nachher.dokumente);

    return {
      id: fall.id,
      gruppe: fall.gruppe,
      art: "entzug",
      genehmigung: null,
      sequenz: [],
      endstatus: null,
      artefaktstatus: null,
      queueEintraege: 0,
      threatScore: null,
      guardrail: null,
      llmAufrufe: 0,
      inputTokens: [],
      kostenUsd: 0,
      fehler: null,

      zyklen: ZYKLEN,

      // Der Zustand VOR dem Entzug. Er ist Teil der Erwartung, nicht Beiwerk.
      gelieferteDokumenteVorher: ids(vorher.dokumente),

      // Zähler und Nenner von 3.14. Der Nenner sind die FÄLLE, nicht die
      // Chunks: liefert ein dichter Fall null Chunks, wäre ein Chunk-Nenner
      // null und die Metrik ausgerechnet im Idealfall „nicht messbar".
      gelieferteChunks: nachher.treffer.length,
      veralteteChunks: nachher.treffer.filter(
        (t) => !erlaubtNachher.has(t.dokumentId),
      ).length,

      gelieferteDokumente: gelieferteIdsNachher,
      fehlendeDokumente: [...erlaubtNachher].filter(
        (d) => !gelieferteIdsNachher.includes(d),
      ),
      grund: nachher.grund,
      erwartet: fall,
      abweichungen: [],
    };
  });
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

  if (lauf.art === "entzug") {
    // DREI Richtungen, und alle drei sind nötig.
    //
    // `vorher`: war das Dokument überhaupt sichtbar? Ein Fall, der schon vor
    // dem Entzug nichts lieferte, belegt nichts — er meldete grün und hätte
    // nie etwas geprüft.
    const vorherErwartet = [...(e.vorher?.sichtbareDokumente ?? [])].sort();
    if (
      JSON.stringify(lauf.gelieferteDokumenteVorher) !==
      JSON.stringify(vorherErwartet)
    ) {
      ab.push(
        `vorher: [${lauf.gelieferteDokumenteVorher.join(", ")}] statt [${vorherErwartet.join(", ")}] — der Fall belegt nichts`,
      );
    }

    // `veraltet`: das eigentliche Leck. Nach einem Zyklus noch da.
    if (lauf.veralteteChunks > 0) {
      const veraltete = lauf.gelieferteDokumente.filter(
        (d) => !(e.nachher?.sichtbareDokumente ?? []).includes(d),
      );
      ab.push(
        `VERALTET nach ${lauf.zyklen} Zyklus: ${lauf.veralteteChunks} Chunks aus [${veraltete.join(", ")}]`,
      );
    }

    // `fehlend`: die Gegenrichtung. Ohne sie wäre ein Speicher, der bei jedem
    // Zyklus alles verwirft, in 3.14 makellos.
    if (lauf.fehlendeDokumente.length > 0) {
      ab.push(
        `fehlend nach dem Entzug: [${lauf.fehlendeDokumente.join(", ")}]`,
      );
    }
    return lauf;
  }

  if (lauf.art === "abruf") {
    // BEIDE Richtungen prüfen. Nur auf Lecks zu schauen ließe ein Retrieval
    // durchgehen, das gar nichts liefert — 3.13 wäre 0 % und die Zahl wertlos.
    const erwarteteDokumente = [...(e.sichtbareDokumente ?? [])].sort();
    if (lauf.unerlaubteChunks > 0) {
      ab.push(
        `LECK: ${lauf.unerlaubteChunks} unerlaubte Chunks aus [${lauf.gelieferteDokumente.filter((d) => !erwarteteDokumente.includes(d)).join(", ")}]`,
      );
    }
    if (lauf.fehlendeDokumente.length > 0) {
      ab.push(`fehlend: [${lauf.fehlendeDokumente.join(", ")}]`);
    }
    if (e.grund !== undefined && lauf.grund !== e.grund) {
      ab.push(`grund: ${lauf.grund} statt ${e.grund}`);
    }
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

  // ── Was der AGENT gelesen hat (T1, ADR-0019) ───────────────────────────
  // Dieselben zwei Richtungen wie beim Abruf-Fall, aus demselben Grund: nur
  // auf Lecks zu schauen ließe eine Fassung durchgehen, die dem Agenten nie
  // etwas gibt — 3.13 wäre 0 % und die Zahl wertlos.
  if (lauf.unerlaubteChunks > 0) {
    const zuviel = lauf.gelesenDokumente.filter(
      (d) => !(e.gelesenDokumente ?? []).includes(d),
    );
    ab.push(
      `LECK im Agentenpfad: ${lauf.unerlaubteChunks} unerlaubte Chunks aus [${zuviel.join(", ")}]`,
    );
  }
  if (e.gelesenDokumente !== undefined) {
    const erwartetGelesen = [...e.gelesenDokumente].sort();
    if (
      JSON.stringify(lauf.gelesenDokumente) !== JSON.stringify(erwartetGelesen)
    )
      ab.push(
        `gelesen: [${(lauf.gelesenDokumente ?? []).join(", ")}] statt [${erwartetGelesen.join(", ")}]`,
      );
  }

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

  // Die Abruf-Fälle laufen im selben Durchgang: nur so trägt der
  // Determinismus-Nachweis (zwei Durchgänge) auch 3.13.
  for (const fall of adapter.retrieval.faelle ?? []) {
    laeufe.push(
      pruefe(await laufAbruf(fall, adapter), adapter.datensatz.sequenzen),
    );
  }

  // Ebenso die Entzugs-Fälle, aus demselben Grund für 3.14. Jeder baut sich
  // seine eigene Quelle; zwei Durchgänge müssen deshalb identisch sein.
  for (const fall of adapter.entzug.faelle ?? []) {
    laeufe.push(
      pruefe(await laufEntzug(fall, adapter), adapter.datensatz.sequenzen),
    );
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
    // WELCHER Speicher gemessen wurde, gehört in den Bericht. Ohne diese
    // Zeile wäre ein Lauf, bei dem STORE_ADAPTER still verschluckt wurde,
    // von einem echten Postgres-Lauf nicht zu unterscheiden — und er meldete
    // grün. Genau der Ausfall, um den dieses Repo gebaut ist.
    storeAdapter: STORE_ADAPTER,
    // Ebenso das Embedding. Ein Lauf mit `hash` ist kostenlos und
    // deterministisch, einer mit `voyage` weder noch — die beiden duerfen im
    // Bericht nicht gleich aussehen.
    embeddingAdapter: EMBEDDING_ADAPTER,
    // Und woher die Identitäten kamen (ADR-0018). Er steht NICHT im
    // Dateinamen: die beiden Adapter dort sind die, die die Zahlen bewegen —
    // dieser bewegt keine, er ändert nur, wer der Fragende ist. Ohne die Zeile
    // wäre ein Lauf gegen ein Verzeichnis aus Fixtures von einem gegen einen
    // echten Anbieter nicht zu unterscheiden.
    identitaetAdapter: adapter.identitaet?.aufloeser.name ?? "keiner",
    aufgaben: adapter.datensatz.aufgaben.length,
    abrufe: (adapter.retrieval.faelle ?? []).length,
    entzuege: (adapter.entzug.faelle ?? []).length,
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
    // Der Adaptername steht im Dateinamen, sonst überschriebe der
    // Postgres-Lauf den Beleg des memory-Laufs — und übrig bliebe genau der
    // Vergleich nicht mehr, um den es in dieser Etappe geht.
    `${bericht.erzeugt.slice(0, 10)}-schicht-a-${adapter.name}-${STORE_ADAPTER}-${EMBEDDING_ADAPTER}.json`,
  );
  fs.writeFileSync(datei, JSON.stringify(bericht, null, 2) + "\n");

  // ── Konsolenausgabe ────────────────────────────────────────────────────
  const proz = (w) =>
    w === null ? "nicht messbar" : `${(w * 100).toFixed(1)} %`;
  const zeile = (m) =>
    `  ${m.name.padEnd(38)} ${proz(m.wert).padStart(13)}   (${m.zaehler}/${m.nenner})`;

  console.log(
    `\nSchicht A · Domäne ${bericht.domaene} · ${bericht.aufgaben} Aufgaben · ${bericht.abrufe} Abrufe · ${bericht.entzuege} Entzüge · Mock · Store: ${bericht.storeAdapter} · Embedding: ${bericht.embeddingAdapter}\n`,
  );
  console.log(zeile(metriken["3.1"]));
  console.log(zeile(metriken["3.2"]));
  console.log(zeile(metriken["3.13"]));
  // Die Zyklenzahl steht in derselben Zeile: „0,0 %" allein ließe offen,
  // worauf sich die Dichtheit bezieht — und die Antwort ist nicht „Sekunden".
  console.log(
    `${zeile(metriken["3.14"])}  ${
      metriken["3.14"].nenner === 0
        ? ""
        : `· ${metriken["3.14"].zyklen} Zyklus · ${metriken["3.14"].veralteteChunks} veraltete Chunks`
    }`,
  );
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
  // Bis zum 2026-09-16 stand hier sechsmal `erfuellt !== false`. Der
  // Unterschied zu heute ist genau EIN Zustand: `null`. Eine Metrik mit
  // Nenner 0 ist ungemessen, `erfuellt` wird `null`, und `null !== false` ist
  // wahr — der Lauf blieb grün. Damit war die Metrik gegen Verschlechterung
  // geschützt, aber nicht gegen Verschwinden: wer die Fälle aus dem
  // Golden-Datensatz löscht, senkt den Nenner auf null und bekommt weiterhin
  // Exit-Code 0. Kaputtmachen fiel auf, Abschaffen nicht (ADR-0017).
  //
  // Jetzt muss jede Pflichtmetrik gemessen UND erfüllt sein — es sei denn, die
  // Domäne hat sie in `ungemessen` mit Grund benannt. Und eine Erklärung, die
  // nicht mehr zutrifft, ist selbst ein Befund: sonst bliebe sie stehen,
  // nachdem die Domäne einen Connector bekommen hat, und deckte von da an
  // genau den Ausfall wieder zu, gegen den sie geschrieben wurde.
  const PFLICHTMETRIKEN = ["3.1", "3.2", "3.3", "3.4", "3.13", "3.14"];
  const befunde = PFLICHTMETRIKEN.map((schluessel) => {
    const { erfuellt, nenner } = metriken[schluessel];
    const grund = adapter.ungemessen[schluessel];
    if (grund !== undefined && nenner > 0)
      return `${schluessel}: als ungemessen erklärt, ist aber gemessen (Nenner ${nenner}) — die Erklärung in adapter.ungemessen ist veraltet`;
    if (erfuellt === true) return null;
    if (erfuellt === null && grund !== undefined) return null;
    if (erfuellt === null)
      return `${schluessel}: ungemessen (Nenner 0) und in adapter.ungemessen nicht erklärt — der Datensatz misst diese Zusage nicht mehr`;
    return `${schluessel}: nicht erfüllt (${metriken[schluessel].zaehler}/${nenner}, Ziel ${metriken[schluessel].ziel})`;
  }).filter(Boolean);

  for (const befund of befunde) console.log(`  🔴 ${befund}`);

  const bestanden =
    deterministisch && treue.zaehler === treue.nenner && befunde.length === 0;

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
