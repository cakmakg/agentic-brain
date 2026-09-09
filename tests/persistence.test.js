// ── tests/persistence.test.js ────────────────────────────────────────────
// Die Dauerhaftigkeits-Schicht selbst. Der Ablauf Ende zu Ende
// steht in `tests/integration/persistence.test.js` und läuft dort in zwei echten
// Prozessen; hier stehen die Zusagen, die man einzeln prüfen muss:
//
//   · Der MANDANTENFILTER greift bei jeder Lesung. Eine Zeile eines
//     fremden Mandanten darf nie zurückkommen — heute gibt es nur einen, und
//     genau deshalb würde ein Fehler hier sonst jahrelang unbemerkt bleiben.
//   · Ein beschädigter Speicher tötet keinen Lauf, macht sich aber bemerkbar.
//   · Ein ungültiger Log-Name wird ABGELEHNT, nicht bereinigt.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { frischerZustand } from "./helpers/zustand.js";

const stateDir = frischerZustand();

const { appendLog, readLog, createArtifactStore } =
  await import("../src/kernel/persistence/store.js");

const pfad = (name) => path.join(process.env.STATE_DIR, `${name}.jsonl`);

test("Ein fehlendes Log ist der Anfangszustand, kein Fehler", () => {
  assert.deepEqual(readLog("gibt-es-nicht"), []);
});

test("Geschriebenes kommt zurück — und trägt den Mandanten", () => {
  appendLog("probe-1", { art: "set", id: "a", wert: 1 });
  const zeilen = readLog("probe-1");
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].id, "a");
  assert.equal(zeilen[0].tenantId, "default", "jede Zeile ist gestempelt");
});

test("MANDANTENFILTER: die Zeile eines fremden Mandanten kommt nicht zurück", () => {
  // Von Hand geschrieben, weil appendLog immer den eigenen Mandanten stempelt —
  // der Fremdfall entsteht sonst gar nicht. Genau er ist aber der Punkt: der
  // Filter muss auch dann greifen, wenn die Datei etwas anderes enthält.
  fs.appendFileSync(
    pfad("probe-2"),
    JSON.stringify({ tenantId: "jemand-anderes", art: "set", id: "fremd" }) +
      "\n",
    "utf8",
  );
  appendLog("probe-2", { art: "set", id: "eigen" });

  const ids = readLog("probe-2").map((z) => z.id);
  assert.deepEqual(ids, ["eigen"], "nur der eigene Mandant");
});

test("Eine beschädigte Zeile wird übersprungen, der Rest überlebt", () => {
  appendLog("probe-3", { art: "set", id: "vorher" });
  fs.appendFileSync(pfad("probe-3"), "{kein gültiges JSON\n", "utf8");
  appendLog("probe-3", { art: "set", id: "nachher" });

  // Der entscheidende Punkt: die Zeile NACH dem Schaden ist noch da. Ein
  // Abbruch beim ersten Fehler würde einen halb geschriebenen letzten Eintrag
  // (Absturz mitten im Schreiben) zum Totalverlust machen.
  const ids = readLog("probe-3").map((z) => z.id);
  assert.deepEqual(ids, ["vorher", "nachher"]);
});

test("Ein ungültiger Log-Name wird abgelehnt, nicht bereinigt", () => {
  // Dieselbe Lehre wie beim API-Schlüssel und der run_id im Trace: ein
  // bereinigter Pfad ist eine Einladung zum Verzeichniswechsel.
  assert.throws(() => appendLog("../entkommen", {}), /ungültiger Log-Name/);
  assert.throws(() => readLog("mit/schrägstrich"), /ungültiger Log-Name/);
});

test("Ein nicht schreibbarer Ort tötet den Lauf nicht", () => {
  // appendLog gibt false zurück und meldet auf stderr, statt zu werfen: ein
  // kaputter Speicher darf einen laufenden Workflow nicht abbrechen.
  const vorher = process.env.STATE_DIR;
  // Eine Datei als Verzeichnis vorgeben — mkdirSync scheitert daran verlässlich.
  const blocker = path.join(os.tmpdir(), `blocker-${process.pid}`);
  fs.writeFileSync(blocker, "keine Datei zum Hineinschreiben");
  process.env.STATE_DIR = blocker;
  try {
    assert.equal(appendLog("egal", { art: "set" }), false);
    assert.deepEqual(readLog("egal"), [], "Lesen ergibt leer, kein Wurf");
  } finally {
    process.env.STATE_DIR = vorher;
  }
});

// ── Artefakt-Speicher ────────────────────────────────────────────────────

test("Der Artefakt-Speicher verhält sich wie die Map, die er ersetzt", () => {
  const s = createArtifactStore("artefakte-probe");
  assert.equal(s.get("fehlt"), null);

  s.set("t1", { status: "AWAITING_APPROVAL", inhalt: "x" });
  assert.equal(s.get("t1").status, "AWAITING_APPROVAL");

  assert.equal(s.patch("t1", { status: "PUBLISHED" }), true);
  assert.equal(s.get("t1").status, "PUBLISHED");
  assert.equal(s.get("t1").inhalt, "x", "patch ersetzt nicht, es ergänzt");

  assert.equal(s.patch("gibt-es-nicht", { status: "X" }), false);
});

test("Ein zweiter Speicher auf demselben Log sieht denselben Stand", () => {
  // Das ist der Neustart im Kleinen: eine NEUE Instanz, dieselbe Datei. Der
  // große Fall — zwei Prozesse — steht in tests/integration/persistence.test.js.
  const a = createArtifactStore("artefakte-neustart");
  a.set("t9", { status: "AWAITING_APPROVAL" });
  a.patch("t9", { status: "PUBLISHED" });

  const b = createArtifactStore("artefakte-neustart");
  assert.equal(b.get("t9")?.status, "PUBLISHED");
  assert.deepEqual(b.alle(), [{ id: "t9", status: "PUBLISHED" }]);
});

test("Der Speicher legt beim Anlegen noch keine Datei an", () => {
  // Erst der Zugriff schreibt. Sonst hinterließe schon das Importieren eines
  // Moduls Dateien — auch in einem Prozess, der gar nichts speichern will.
  createArtifactStore("nie-benutzt");
  assert.equal(fs.existsSync(pfad("nie-benutzt")), false);
  assert.ok(stateDir.length > 0);
});
