// ── kernel/governance/trace.js ───────────────────────────────────────────
// Minimaler Trace: je Lauf eine JSONL-Datei unter evals/traces/<run_id>.jsonl.
// Keine neue Abhängigkeit, kein Dienst, keine Datenbank — node:fs genügt.
//
// Gründerlektion (I1): Eine Evaluation ohne Trace ist teurer als gar keine.
// Sie zeigt einen grünen Wert, ohne dass jemand nachsehen kann, WO er entstand.
// Deshalb entsteht diese Datei VOR dem Harness, nicht danach.
//
// Drei bewusste Grenzen, damit niemand mehr hineinliest, als hier gemessen wird:
//
//   1) KEIN Volltext eines Textfeldes — nur seine Länge. Der Trace belegt
//      Routing und Richtlinien, nicht Inhalte. Braucht die Qualitätsschicht
//      den Text, ist das eine bewusste Erweiterung.
//   2) Die Dauer ist der Abstand zwischen zwei Knotenabschlüssen, NICHT die
//      instrumentierte Laufzeit eines Knotens. LangGraph meldet einen Knoten
//      erst, wenn er fertig ist; eine genauere Zahl wäre erfunden.
//   3) Eine ungültige run_id wird ABGELEHNT, nicht bereinigt. `/api/approve`
//      nimmt die threadId aus dem Request; ein bereinigter Pfad wäre eine
//      Einladung zum Verzeichniswechsel.
//
// LESEHINWEIS, sonst misst die Auswertung das Falsche: eine Knotenzeile trägt das,
// was der Knoten GESCHRIEBEN hat — das Delta —, nicht den akkumulierten State.
// Bei `lastWins`-Feldern ist beides dasselbe. Bei `revisionCount` (Reducer `sum`)
// NICHT: dort steht in jeder Zeile die 1, die dieser Knoten addiert hat. Der
// Stand ist die Summe der Zeilen, nicht der letzte Wert.

import fs from "node:fs";
import path from "node:path";

import { gliedHash, pruefeKette, KETTEN_ANFANG } from "./audit.js";

const TRACE_DIR =
  process.env.TRACE_DIR || path.join(process.cwd(), "evals", "traces");

// Nur diese Form darf zu einem Dateinamen werden (Grenze 3).
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// WELCHE Felder in den Trace wandern, entscheidet ihr TYP — nicht eine Liste
// von Namen. Eine Namensliste im Kern müsste jede Domäne kennen; sie würde bei
// der ersten neuen Domäne still unvollständig, und der Trace verlöre genau die
// Felder, für deren Nachweis er existiert.
//
//   Zeichenkette            → nur die LÄNGE (`<feld>_length`), nie der Volltext
//   Wahrheitswert/Zahl/null → der WERT selbst
//   alles andere            → gar nicht (ein Objekt im Trace ist ein Inhaltsleck)
function traceWert(entry, feld, wert) {
  if (typeof wert === "string") entry[`${feld}_length`] = wert.length;
  else if (
    typeof wert === "boolean" ||
    typeof wert === "number" ||
    wert === null
  ) {
    entry[feld] = wert;
  }
}

function traceFile(runId) {
  return path.join(TRACE_DIR, `${runId}.jsonl`);
}

// Schreibt eine Zeile. Wirft NIE: ein kaputter Trace darf keinen Lauf töten.
// Sichtbar bleibt der Ausfall trotzdem — auf stderr, und daran, dass die Datei
// am Phasentor fehlt. Diese Datei behauptet nicht selbst, dass sie funktioniert.
function writeLine(runId, entry) {
  try {
    fs.mkdirSync(TRACE_DIR, { recursive: true });
    fs.appendFileSync(traceFile(runId), JSON.stringify(entry) + "\n", "utf8");
    return true;
  } catch (err) {
    console.error(
      `[trace] Schreiben fehlgeschlagen (${runId}): ${err.message}`,
    );
    return false;
  }
}

// Liest die vorhandene Datei EINMAL und holt beides daraus: die Zahl der
// Zeilen, damit seq über eine Fortsetzung hinweg weiterläuft statt bei 0 neu
// zu beginnen, und das letzte Kettenglied, damit die Fortsetzung an die
// bestehende Kette anschließt. Ein Lauf, der auf die Genehmigung wartet, wird
// später mit derselben run_id fortgesetzt — begänne die Kette dort neu, wäre
// genau die Naht ungeschützt, an der die menschliche Entscheidung steht.
//
// Eine unlesbare oder fehlende Datei ergibt einen frischen Anfang. Das ist
// kein Verstecken: pruefeTraceKette urteilt über die Datei, die DA ist.
function bestehendeKette(runId) {
  try {
    const zeilen = fs
      .readFileSync(traceFile(runId), "utf8")
      .split("\n")
      .filter(Boolean);
    const letzte = zeilen.length ? JSON.parse(zeilen[zeilen.length - 1]) : null;
    return {
      anzahl: zeilen.length,
      letztesGlied:
        typeof letzte?.hash === "string" ? letzte.hash : KETTEN_ANFANG,
    };
  } catch {
    return { anzahl: 0, letztesGlied: KETTEN_ANFANG };
  }
}

// Liest den Trace eines Laufs und hält ihn gegen sich selbst (A6). Gibt
// { ok, laenge, gebrochenBei, grund } zurück; eine fehlende Datei ist eine
// leere Kette, kein Bruch.
export function pruefeTraceKette(runId) {
  let zeilen;
  try {
    zeilen = fs
      .readFileSync(traceFile(runId), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((z) => JSON.parse(z));
  } catch {
    return pruefeKette([]);
  }
  return pruefeKette(zeilen);
}

// Gleiche Form, schreibt nichts: für eine abgelehnte run_id. So braucht der
// Aufrufer keine Fallunterscheidung und der Workflow keine Sonderbehandlung.
const SILENT_TRACE = {
  runId: null,
  active: false,
  node() {},
  pause() {},
  end() {},
};

function createTrace(runId) {
  if (!RUN_ID_PATTERN.test(String(runId || ""))) {
    console.error(`[trace] run_id abgelehnt (ungültige Form): ${runId}`);
    return SILENT_TRACE;
  }

  const kette = bestehendeKette(runId);
  let seq = kette.anzahl;
  let letztesGlied = kette.letztesGlied;
  let lastTs = Date.now();

  // Jede Zeile trägt ihr Kettenglied (A6, ADR-0022). prev steht IM gehashten
  // Inhalt, hash kommt zuletzt dazu.
  //
  // Das Glied rückt NUR bei erfolgreichem Schreiben vor. Sonst zeigte die
  // nächste Zeile auf eine, die es nicht gibt — ein Kettenbruch, den nicht
  // eine Manipulation verursacht hätte, sondern eine volle Platte. Eine
  // Prüfung, die aus dem falschen Grund rot wird, wird bald nicht mehr
  // gelesen.
  const line = (entry) => {
    const ohneHash = {
      ts: new Date().toISOString(),
      run_id: runId,
      seq,
      ...entry,
      prev: letztesGlied,
    };
    const hash = gliedHash(ohneHash);
    if (!writeLine(runId, { ...ohneHash, hash })) return false;
    letztesGlied = hash;
    seq++;
    return true;
  };

  return {
    runId,
    active: true,
    line,

    // Ein Knotenübergang. `update` ist das Delta, das LangGraph meldet.
    node(name, update = {}) {
      const now = Date.now();
      const entry = {
        type: "node",
        node: name,
        duration_ms: now - lastTs,
        log: update.log || [],
      };
      for (const [feld, wert] of Object.entries(update)) {
        if (feld === "log" || wert === undefined) continue;
        traceWert(entry, feld, wert);
      }
      lastTs = now;
      line(entry);
    },

    // Halt am Genehmigungstor. Bewusst NICHT `run_end`: der Lauf ist nicht
    // vorbei, er wartet. Zwei `run_end` in einer Datei würden jede spätere
    // Zählung über die Läufe hinweg verdoppeln.
    pause(status) {
      line({ type: "run_pause", status });
    },

    end(status) {
      line({ type: "run_end", status });
    },
  };
}

// Beginn eines Laufs.
export function startTrace({ runId, task }) {
  const trace = createTrace(runId);
  if (trace.active) {
    trace.line({ type: "run_start", task_length: String(task || "").length });
  }
  return trace;
}

// Fortsetzung nach der menschlichen Entscheidung — dieselbe run_id, dieselbe
// Datei. Die Entscheidung selbst ist eine eigene Zeile: sie ist der Punkt, an
// dem die zentrale Zusage dieses Repos geprüft werden kann.
//
// SIE NENNT IHREN GENEHMIGENDEN (A12, ADR-0022). Die Kennung steht im Klartext
// und nicht als Länge — Grenze 1 oben gilt dem INHALT, den ein Lauf
// verarbeitet, nicht der Identität, die über ihn entscheidet. Eine Genehmigung,
// deren Genehmigender nur als Zahl im Audit steht, ist kein Nachweis.
//
// Vom bearbeiteten Entwurf landet dagegen NUR EINE ZAHL hier: wie viel sich
// geändert hat, nicht was. Das ist Inhalt und fällt unter Grenze 1.
export function resumeTrace({ runId, entscheidung }) {
  const trace = createTrace(runId);
  if (trace.active) {
    trace.line({
      type: "run_resume",
      humanApproval: entscheidung?.genehmigt ?? null,
      genehmigender: entscheidung?.genehmigender?.benutzerId ?? null,
      entwurf_geaendert: entscheidung?.unterschied ?? null,
    });
  }
  return trace;
}
