// ── tests/kanal.test.js ──────────────────────────────────────────────────
// T3 DES MVP-SCHNITTS (ADR-0019): die Genehmigung kommt vom MENSCHEN, nicht vom
// Skript. Geprüft wird der Kanal `src/bin/fragen.js` — von außen, als Prozess,
// mit der Eingabe in einer Pipe.
//
// WARUM ALS PROZESS UND NICHT ALS FUNKTIONSAUFRUF. Der Beweis von T3 ist nicht,
// dass eine Funktion einen Boolean weiterreicht — das prüft
// `tests/workflow.test.js` seit Etappe 0. Der Beweis ist, dass die Entscheidung
// von DRAUSSEN kommt und der Ablauf dazwischen wirklich anhält. Ein Test, der
// `resolveApproval` selbst aufruft, hätte genau die Zeile ersetzt, um die es
// geht — dieselbe Selbstgenehmigung wie in `demo-besprechung.js`, nur in einem
// Testmantel.
//
// Die letzte Zeile der Ausgabe ist maschinenlesbar (dieselbe Form wie die
// Fixtures der Persistenzprüfung). Alles davor ist für den Menschen.
//
// DIE FÄLLE HÄNGEN AN DER REGEL DES KANALS, nicht an einem beobachteten Lauf:
// nur „ja" oder „j" genehmigt, alles andere lehnt ab — dieselbe Strenge, die
// der HTTP-Rand seit dem 2026-09-14 hat (`{"approved": "false"}` genehmigt
// nicht). Ein Kanal, der „true" oder eine leere Zeile als Zustimmung liest,
// wäre die Lücke ein zweites Mal.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const wurzel = path.resolve(import.meta.dirname, "..");
const zustand = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-kanal-"));
const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-kanal-"));

// Ein Lauf des Kanals. `eingabe` ist genau das, was ein Mensch tippen würde:
// Nachweis, Aufgabe (leer = Vorgabe), Entscheidung.
function fragen(eingabe) {
  const ausgabe = execFileSync(
    process.execPath,
    [path.join(wurzel, "src", "bin", "fragen.js")],
    {
      cwd: wurzel,
      input: eingabe,
      encoding: "utf8",
      env: { ...process.env, STATE_DIR: zustand, TRACE_DIR: traceDir },
    },
  );
  const zeilen = ausgabe.trim().split(/\r?\n/);
  return { bericht: JSON.parse(zeilen.at(-1)), ausgabe };
}

test("ABLEHNUNG von Hand: nichts zugestellt, nichts eingereiht", () => {
  const { bericht, ausgabe } = fragen("nachweis-dora\n\nnein\n");

  assert.equal(bericht.genehmigt, false);
  assert.equal(bericht.queue, 0, "eine Ablehnung reiht NICHTS ein");
  assert.notEqual(
    bericht.entwurf,
    "ZUGESTELLT",
    "eine Ablehnung stellt NICHTS zu",
  );
  // Der Ablauf muss wirklich angehalten haben — sonst gäbe es nichts zu
  // entscheiden, und der Fall belegte nur, dass nichts passiert ist.
  assert.match(ausgabe, /Der Ablauf HÄLT AN/);
});

test("GENEHMIGUNG von Hand: genau eine Aktion", () => {
  const { bericht } = fragen("nachweis-dora\n\nja\n");

  assert.equal(bericht.genehmigt, true);
  assert.equal(bericht.queue, 1, "genau eine — nicht keine und nicht zwei");
  assert.deepEqual(bericht.aktionen, ["TICKET_ANLEGEN"]);
  assert.equal(bericht.entwurf, "ZUGESTELLT");
});

test('Nur "ja" genehmigt: "true" ist eine ABLEHNUNG, keine Zustimmung', () => {
  // Die Lücke, die der HTTP-Rand bis zum 2026-09-14 hatte, in diesem Kanal
  // ausgeschlossen: ein Wort, das wie Zustimmung AUSSIEHT, ist keine.
  for (const antwort of ["true", "yes", "jaa", "1", ""]) {
    const { bericht } = fragen(`nachweis-dora\n\n${antwort}\n`);
    assert.equal(
      bericht.genehmigt,
      false,
      `„${antwort}" darf nicht genehmigen`,
    );
    assert.equal(bericht.queue, 0);
  }
});

test("Ein unbekannter Nachweis wird an der TÜR abgelehnt — kein Lauf", () => {
  const { bericht, ausgabe } = fragen("nachweis-gibtsnicht\n\nja\n");

  assert.equal(bericht.identitaet, null);
  assert.equal(bericht.threadId, null, "es gibt keinen Lauf");
  assert.equal(bericht.queue, 0);
  // Das „ja" in der Eingabe wird nie gelesen: es gibt nichts zu genehmigen.
  assert.equal(bericht.genehmigt, null);
  assert.match(ausgabe, /nicht auflösbar/);
});

test("Eine unberechtigte Notiz fragt den Menschen GAR NICHT", () => {
  // clara ist in der Gruppe `leitung`; n-sprint gehört `technik` und ist ihr
  // nicht freigegeben (acl.json). Ohne Entwurf gibt es keine Entscheidung —
  // und keine Frage, die ein Mensch versehentlich mit „ja" beantworten könnte.
  const { bericht, ausgabe } = fragen(
    "nachweis-clara\nAktionspunkte aus notiz:n-sprint zum Rollout.\nja\n",
  );

  assert.equal(bericht.identitaet, "clara");
  assert.equal(bericht.entwurf, null);
  assert.equal(bericht.genehmigt, null, "es wurde nicht gefragt");
  assert.equal(bericht.queue, 0);
  assert.doesNotMatch(ausgabe, /Genehmigen\?/);
});
