// ── kernel/persistence/store.js ──────────────────────────────────────────
// Die gemeinsame Dauerhaftigkeits-Schicht. Ein append-only JSONL-Log je
// Name, mehr nicht: node:fs genügt, wie schon beim Trace. KEINE neue
// Abhängigkeit, kein Dienst, keine Datenbank.
//
// Warum eine eigene Datei statt eines fertigen Checkpoint-Pakets: das
// SQLite-Paket zieht `better-sqlite3` nach, also eine native Übersetzung. Auf
// einer frischen Maschine wäre `clone → install → demo` dann von einer
// Build-Toolchain abhängig — und genau diese Zusage ist ein Prüfkriterium
// dieses Repos. Die Begründung gehört als ADR nach `DECISIONS.md`.
//
// MANDANT. Jede Zeile trägt `tenantId`, und JEDE Lesung filtert
// danach. Es gibt heute genau einen Mandanten; die Regel gilt trotzdem, weil
// sie sonst später jede einzelne Abfrage kostet. Eine Lesung ohne Filter ist
// ab sofort ein Defekt, kein Stilfehler.
//
// Zwei bewusste Grenzen, damit niemand mehr hineinliest:
//   1) Das Log WÄCHST UNBEGRENZT. Keine Verdichtung, keine Rotation. Für einen
//      Starter mit einem Mandanten ist das tragbar; für Dauerbetrieb nicht.
//      Gehört als eigene Zeile unter die bekannten Grenzen in `ARCHITECTURE.md`.
//   2) Kein Sperrmechanismus zwischen Prozessen. Zwei gleichzeitig schreibende
//      Prozesse können sich überlappen. Der Ablauf dieses Repos ist seriell
//      (ein Lauf, dann die Genehmigung); mehr wird hier nicht behauptet.

import fs from "node:fs";
import path from "node:path";

import { env } from "../config/env.js";

// Beides wird bei JEDEM Aufruf gelesen, nicht beim Laden des Moduls: sonst
// friert die erste Import-Reihenfolge den Ort ein und ein Test, der STATE_DIR
// später setzt, schriebe still ins falsche Verzeichnis.
function stateDir() {
  return process.env.STATE_DIR || env.stateDir;
}

function tenant() {
  return process.env.TENANT_ID || env.tenantId;
}

// Nur diese Form darf zu einem Dateinamen werden. ABGELEHNT statt bereinigt —
// dieselbe Lehre wie beim API-Schlüssel und der run_id im Trace: ein
// bereinigter Pfad ist eine Einladung zum Verzeichniswechsel.
const NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function logPfad(name) {
  if (!NAME_PATTERN.test(String(name))) {
    throw new Error(`store: ungültiger Log-Name: ${name}`);
  }
  return path.join(stateDir(), `${name}.jsonl`);
}

// Schreibt eine Zeile. Wirft NIE — ein kaputter Speicher darf keinen Lauf
// töten. Sichtbar bleibt der Ausfall trotzdem: auf stderr, und daran, dass ein
// Neustart den Zustand nicht wiederfindet. Diese Datei behauptet nicht selbst,
// dass sie funktioniert; das tut `tests/persistence.test.js`.
export function appendLog(name, eintrag) {
  const pfad = logPfad(name);
  try {
    fs.mkdirSync(path.dirname(pfad), { recursive: true });
    fs.appendFileSync(
      pfad,
      JSON.stringify({ tenantId: tenant(), ...eintrag }) + "\n",
      "utf8",
    );
    return true;
  } catch (err) {
    console.error(`[store] Schreiben fehlgeschlagen (${name}): ${err.message}`);
    return false;
  }
}

// Liest alle Zeilen dieses Mandanten. Eine fehlende Datei ist KEIN Fehler,
// sondern der Anfangszustand. Eine beschädigte Zeile wird übersprungen und
// gemeldet: ein halb geschriebener letzter Eintrag (Absturz mitten im Schreiben)
// darf nicht den gesamten davor liegenden Zustand unlesbar machen.
export function readLog(name) {
  const pfad = logPfad(name);
  let roh;
  try {
    roh = fs.readFileSync(pfad, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`[store] Lesen fehlgeschlagen (${name}): ${err.message}`);
    }
    return [];
  }

  const meiner = tenant();
  const zeilen = [];
  let beschaedigt = 0;

  for (const zeile of roh.split("\n")) {
    if (!zeile.trim()) continue;
    let eintrag;
    try {
      eintrag = JSON.parse(zeile);
    } catch {
      beschaedigt++;
      continue;
    }
    // DER MANDANTENFILTER. Er steht hier und nicht bei den Aufrufern, damit ihn
    // niemand vergessen kann.
    if (eintrag.tenantId !== meiner) continue;
    zeilen.push(eintrag);
  }

  if (beschaedigt > 0) {
    console.error(
      `[store] ${beschaedigt} beschädigte Zeile(n) in ${name} übersprungen`,
    );
  }
  return zeilen;
}

// ── Artefakt-Speicher ────────────────────────────────────────────────────
// Ersetzt die `new Map()` in den Domänen. Die Semantik bleibt exakt dieselbe —
// im Arbeitsspeicher eine Map, damit nichts langsamer wird —, sie überlebt nur
// zusätzlich einen Neustart. Deshalb ändert sich in den Domänen keine einzige
// nach außen sichtbare Signatur.
export function createArtifactStore(name) {
  const map = new Map();
  let geladen = false;

  // Erst beim ersten Zugriff, nicht beim Import: sonst legt schon das Laden
  // eines Moduls Dateien an, auch wenn der Prozess gar nichts speichern will.
  function laden() {
    if (geladen) return;
    geladen = true;
    for (const e of readLog(name)) {
      if (e.art === "set") map.set(e.id, e.wert);
      else if (e.art === "patch" && map.has(e.id)) {
        map.set(e.id, { ...map.get(e.id), ...e.teil });
      }
    }
  }

  return {
    set(id, wert) {
      laden();
      map.set(id, wert);
      appendLog(name, { art: "set", id, wert });
    },

    // Für Statuswechsel wie markPublished. Bewusst KEIN Mutieren des von get()
    // gelieferten Objekts: eine Änderung, die nur im Arbeitsspeicher stattfindet,
    // wäre nach einem Neustart verschwunden — und niemandem fiele es auf.
    patch(id, teil) {
      laden();
      const vorhanden = map.get(id);
      if (!vorhanden) return false;
      map.set(id, { ...vorhanden, ...teil });
      appendLog(name, { art: "patch", id, teil });
      return true;
    },

    get(id) {
      laden();
      return map.get(id) || null;
    },

    alle() {
      laden();
      return [...map.entries()].map(([id, wert]) => ({ id, ...wert }));
    },
  };
}
