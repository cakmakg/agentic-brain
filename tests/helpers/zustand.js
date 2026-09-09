// ── tests/helpers/zustand.js ─────────────────────────────────────────────
// Ein Lauf hinterlässt Dateien. Ohne Isolierung wäre das ein stiller
// Testfehler ZWEITER Ordnung: `npm test` liefe einmal grün und beim zweiten Mal
// rot, weil die Aktion aus dem vorigen Lauf im Dedup-Index steht und
// „dieselbe Aktion zweimal ergibt eine Zeile" plötzlich null Zeilen ergibt.
//
// Deshalb bekommt jede Testdatei ein FRISCHES Verzeichnis. Node führt jede
// Datei in einem eigenen Prozess aus, also genügt ein Aufruf im Modulrumpf:
// die Quelldateien fassen beim Import noch keine Datei an (Laden geschieht erst
// beim ersten Zugriff), und `store.js` liest STATE_DIR bei jedem Aufruf neu.
//
// Aufgeräumt wird bewusst NICHT automatisch: liegt ein Testfehler am Zustand,
// will man ihn danach ansehen können. Das Betriebssystem räumt sein
// Temp-Verzeichnis selbst.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function frischerZustand() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-zustand-"));
  process.env.STATE_DIR = dir;
  return dir;
}
