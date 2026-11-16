// ── tests/audit.test.js ──────────────────────────────────────────────────
// A6, Etappe 4d: das Audit-Log ist eine HASH-KETTE über dem bestehenden
// Trace. Diese Datei prüft die Zusage, die ADR-0022 gibt — und ebenso
// ausdrücklich die Grenze, die sie NICHT gibt.
//
// Der wertvollste Test ist „ein Fälscher, der den Hash mitzieht, bricht die
// nächste Zeile". Ohne ihn belegte die Kette nur, dass ein NACHLÄSSIGER
// Eingriff auffliegt — und das ist nicht die Gefahr, gegen die man eine Kette
// baut.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-unit-"));
process.env.TRACE_DIR = traceDir;

const { startTrace, resumeTrace, pruefeTraceKette } =
  await import("../src/kernel/governance/trace.js");
const { gliedHash, pruefeKette, KETTEN_ANFANG } =
  await import("../src/kernel/governance/audit.js");

const datei = (runId) => path.join(traceDir, `${runId}.jsonl`);

const lies = (runId) =>
  fs
    .readFileSync(datei(runId), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((z) => JSON.parse(z));

const schreib = (runId, zeilen) =>
  fs.writeFileSync(
    datei(runId),
    zeilen.map((z) => JSON.stringify(z)).join("\n") + "\n",
    "utf8",
  );

// Eine Kopie ohne ein Feld. Als Helfer und nicht als Destrukturierung mit
// Platzhalter: ein `_weg`, das niemand liest, ist genau der tote Name, den
// die Lint-Regel meint.
const ohneFeld = (obj, feld) => {
  const kopie = { ...obj };
  delete kopie[feld];
  return kopie;
};

// Ein Lauf mit drei Zeilen: Start, ein Knoten, Ende.
function lauf(runId) {
  const t = startTrace({ runId, task: "eine Aufgabe" });
  t.node("orchestrator", { nextAgent: "entwurf", log: ["x"] });
  t.end("DONE");
  return lies(runId);
}

let stderr;
before(() => {
  stderr = console.error;
  console.error = () => {};
});
after(() => {
  console.error = stderr;
  fs.rmSync(traceDir, { recursive: true, force: true });
});

test("Jede Zeile traegt ein Kettenglied, die erste zeigt auf den Anfang", () => {
  const z = lauf("kette-a");
  assert.equal(z.length, 3);
  assert.equal(z[0].prev, KETTEN_ANFANG);
  for (let i = 1; i < z.length; i++) {
    assert.equal(
      z[i].prev,
      z[i - 1].hash,
      `Zeile ${i} haengt nicht an ${i - 1}`,
    );
  }
  assert.deepEqual(pruefeTraceKette("kette-a"), {
    ok: true,
    laenge: 3,
    gebrochenBei: null,
    grund: null,
  });
});

test("Eine leere Kette ist gueltig, aber ihre Laenge sagt worauf", () => {
  // Wie der Nenner 0 in EVALS.md: nicht gruen aus Staerke, sondern mangels
  // Gegenstand. Deshalb steht die Laenge daneben.
  const k = pruefeKette([]);
  assert.equal(k.ok, true);
  assert.equal(k.laenge, 0);
  assert.equal(pruefeTraceKette("gibt-es-nicht").laenge, 0);
});

test("DAS TOR: eine geaenderte Zeile bricht die Kette und wird BENANNT", () => {
  const z = lauf("kette-b");
  // Aus einer Ablehnung eine Genehmigung machen — der Eingriff, den man
  // fuerchtet. Hier stellvertretend ein Statuswechsel in der letzten Zeile.
  z[2].status = "PUBLISHED";
  schreib("kette-b", z);

  const k = pruefeTraceKette("kette-b");
  assert.equal(k.ok, false);
  assert.equal(k.gebrochenBei, 2, "Die Pruefung muss die ZEILE nennen");
  assert.match(k.grund, /passt nicht zu ihrem Hash/);
});

test("Ein Faelscher, der den Hash mitzieht, bricht die NAECHSTE Zeile", () => {
  const z = lauf("kette-c");
  z[1].nextAgent = "ticketdienst";
  // Er ist sorgfaeltig: der Hash der geaenderten Zeile stimmt wieder.
  z[1].hash = gliedHash(ohneFeld(z[1], "hash"));
  schreib("kette-c", z);

  const k = pruefeTraceKette("kette-c");
  assert.equal(k.ok, false);
  assert.equal(
    k.gebrochenBei,
    2,
    "Zeile 1 stimmt jetzt, Zeile 2 haengt schief",
  );
  assert.match(k.grund, /prev verweist auf/);
});

test("Eine geloeschte Zeile faellt an der Luecke auf", () => {
  const z = lauf("kette-d");
  schreib("kette-d", [z[0], z[2]]);

  const k = pruefeTraceKette("kette-d");
  assert.equal(k.ok, false);
  assert.equal(k.gebrochenBei, 1);
  assert.match(k.grund, /prev verweist auf/);
});

test("Eine eingeschobene Zeile ohne Glied faellt auf", () => {
  const z = lauf("kette-e");
  schreib("kette-e", [
    z[0],
    { ts: "2026-09-20T00:00:00.000Z", run_id: "kette-e", seq: 1, type: "node" },
    z[1],
    z[2],
  ]);

  const k = pruefeTraceKette("kette-e");
  assert.equal(k.ok, false);
  assert.equal(k.gebrochenBei, 1);
  assert.match(k.grund, /ohne Kettenglied/);
});

test("Die Fortsetzung nach der Genehmigung bleibt EINE Kette", () => {
  // Der Punkt, an dem die zentrale Zusage des Repos steht. Begaenne die Kette
  // hier neu, waere genau die Naht ungeschuetzt, um die es geht.
  const t = startTrace({ runId: "kette-f", task: "x" });
  t.node("entwurf", { entworfen: true });
  t.pause("AWAITING_APPROVAL");

  const t2 = resumeTrace({ runId: "kette-f", humanApproval: true });
  t2.node("ticketdienst", { zugestellt: true });
  t2.end("PUBLISHED");

  const z = lies("kette-f");
  assert.equal(z.length, 6);
  // Die seq laeuft ueber die Fortsetzung hinweg weiter, die Kette auch.
  assert.deepEqual(
    z.map((l) => l.seq),
    [0, 1, 2, 3, 4, 5],
  );
  assert.equal(pruefeTraceKette("kette-f").ok, true);
});

test("Die BEKANNTE GRENZE: eine vollstaendig neu gehashte Datei faellt nicht auf", () => {
  // Das ist kein Mangel des Tests, sondern die Grenze der Bauart, und sie
  // steht ausdruecklich in ADR-0022 und im Kopf von audit.js. Wer sie nicht
  // pruefte, koennte spaeter glauben, die Kette leiste mehr als sie tut.
  const z = lauf("kette-g");
  z[2].status = "PUBLISHED";
  let vorher = KETTEN_ANFANG;
  for (const zeile of z) {
    zeile.prev = vorher;
    zeile.hash = gliedHash(ohneFeld(zeile, "hash"));
    vorher = zeile.hash;
  }
  schreib("kette-g", z);

  assert.equal(
    pruefeTraceKette("kette-g").ok,
    true,
    "Gegen ein vollstaendiges Neuschreiben hilft nur ein Anker AUSSERHALB der Datei",
  );
});
