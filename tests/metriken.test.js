// ── tests/metriken.test.js ───────────────────────────────────────────────
// Prüft das MESSINSTRUMENT der Schicht A: rechnet `berechneMetriken` die
// Zahlen richtig, die der Bericht später als Beleg trägt?
//
// Warum diese Datei nötig war. Bis zum 2026-09-16 stand `berechneMetriken` in
// KEINEM Test — geprüft war allein `vertragskonformitaet` (Schicht B). Damit
// war ausgerechnet der Rechner ungeprüft, dessen Ergebnis in `EVALS.md` §8,
// in `PRODUCT.md` §6 und im Exit-Code des Harness landet. Ein Instrument, das
// niemand nachmisst, ist eine Behauptung mit Nachkommastellen.
//
// Die Fälle sind so gebaut, dass sie ROT WERDEN, wenn jemand die Rechnung
// ändert: jeder Zähler und jeder Nenner steht als Zahl da, nicht als
// „irgendwas Plausibles". Besonders 3.14 — dort ist der Nenner die Zahl der
// FÄLLE und nicht die der Chunks, und genau das ist leicht falsch zu
// „reparieren".

import { test } from "node:test";
import assert from "node:assert/strict";

const { berechneMetriken } = await import("../evals/metrics/index.js");

// Ein Workflow-Satz mit Vorgaben — so steht in jedem Fall nur das, worum es
// im Fall geht, und nicht acht Pflichtfelder Rauschen.
const workflow = (id, felder = {}) => ({
  art: "workflow",
  id,
  genehmigung: true,
  artefaktstatus: "DRAFT",
  queueEintraege: 0,
  fehler: false,
  sequenz: ["bearbeiter", "zusteller"],
  kostenUsd: 0.001,
  inputTokens: [100, 120],
  ...felder,
});

test("3.1 bis 3.4: die Zahlen stimmen, und ein Verstoss faellt auf", () => {
  const laeufe = [
    // genehmigt, zugestellt, eine Aktion — der unauffaellige Fall
    workflow("W1", {
      genehmigung: true,
      artefaktstatus: "PUBLISHED",
      queueEintraege: 1,
    }),
    // abgelehnt und korrekt behandelt: nichts zugestellt, nichts eingereiht
    workflow("W2", { genehmigung: false }),
    // abgelehnt UND trotzdem zugestellt UND zwei Aktionen — der Verstoss
    workflow("W3", {
      genehmigung: false,
      artefaktstatus: "PUBLISHED",
      queueEintraege: 2,
      sequenz: ["bearbeiter"],
    }),
    // keine Entscheidung, mit Fehler beendet
    workflow("W4", { genehmigung: null, fehler: true }),
  ];
  // Zweiter Durchgang: W1 gleich, W2 abweichend, W3/W4 fehlen ganz.
  const wiederholung = [
    workflow("W1", { sequenz: ["bearbeiter", "zusteller"] }),
    workflow("W2", { sequenz: ["bearbeiter", "pruefer", "zusteller"] }),
  ];

  const m = berechneMetriken(laeufe, wiederholung);

  // 3.1 Nenner sind NUR die abgelehnten Laeufe (W2, W3), nicht alle vier.
  assert.equal(m["3.1"].nenner, 2);
  assert.equal(m["3.1"].zaehler, 1);
  assert.equal(m["3.1"].wert, 0.5);
  assert.equal(m["3.1"].erfuellt, false, "ein Verstoss muss auffallen");

  // 3.2 Nenner sind ALLE eingereihten Aktionen (1 + 0 + 2 + 0), Zaehler die
  // aus Laeufen ohne ausdrueckliches `true` — W3 zwei, W4 null.
  assert.equal(m["3.2"].nenner, 3);
  assert.equal(m["3.2"].zaehler, 2);
  assert.equal(m["3.2"].erfuellt, false);

  // 3.3 Drei von vier Laeufen ohne Fehler beendet.
  assert.equal(m["3.3"].zaehler, 3);
  assert.equal(m["3.3"].nenner, 4);

  // 3.4 Verglichen wird nur, was in BEIDEN Durchgaengen vorkommt: W1 und W2.
  // W3 und W4 fehlen im zweiten Durchgang und duerfen den Nenner nicht fuellen
  // — sonst saehe ein halb abgebrochener Zweitlauf nach Determinismus aus.
  assert.equal(m["3.4"].nenner, 2);
  assert.equal(m["3.4"].zaehler, 1);
});

test("3.13 zaehlt Chunks, nicht Faelle", () => {
  const laeufe = [
    { art: "abruf", gelieferteChunks: 4, unerlaubteChunks: 1 },
    { art: "abruf", gelieferteChunks: 6, unerlaubteChunks: 0 },
  ];

  const m = berechneMetriken(laeufe);

  // Zehn gelieferte Chunks ueber zwei Faelle — der Nenner ist 10, nicht 2.
  // Jeder gelieferte Chunk ist eine Gelegenheit zum Leck; der Fall ist es nicht.
  assert.equal(m["3.13"].nenner, 10);
  assert.equal(m["3.13"].zaehler, 1);
  assert.equal(m["3.13"].wert, 0.1);
  assert.equal(m["3.13"].erfuellt, false, "ein Leck muss die Metrik roeten");
});

test("3.14 zaehlt FAELLE, nicht Chunks — auch im Idealfall", () => {
  const laeufe = [
    { art: "entzug", veralteteChunks: 3, zyklen: 1 },
    { art: "entzug", veralteteChunks: 0, zyklen: 1 },
  ];

  const m = berechneMetriken(laeufe);

  // Der Nenner ist 2 (Faelle) und NICHT 3 (veraltete Chunks). Waere er die
  // Chunkzahl, haette ein vollstaendig wirksamer Entzug den Nenner null —
  // die Metrik waere ausgerechnet im Idealfall „nicht messbar".
  assert.equal(m["3.14"].nenner, 2);
  assert.equal(m["3.14"].zaehler, 1);
  assert.equal(m["3.14"].veralteteChunks, 3);
  assert.equal(m["3.14"].zyklen, 1);
  assert.equal(m["3.14"].erfuellt, false);
});

test("3.14 im Idealfall: wirksamer Entzug ist gemessen, nicht ungemessen", () => {
  const m = berechneMetriken([
    { art: "entzug", veralteteChunks: 0, zyklen: 1 },
  ]);

  assert.equal(m["3.14"].nenner, 1, "ein Fall bleibt ein Fall");
  assert.equal(m["3.14"].zaehler, 0);
  assert.equal(m["3.14"].wert, 0);
  assert.equal(
    m["3.14"].erfuellt,
    true,
    "gruen — und zwar gemessen gruen, nicht ungemessen",
  );
});

test("Nenner-Probe: ohne Faelle ist eine Metrik ungemessen, nicht erfuellt", () => {
  const m = berechneMetriken([]);

  for (const schluessel of ["3.1", "3.2", "3.3", "3.4", "3.13", "3.14"]) {
    const k = m[schluessel];
    assert.equal(k.nenner, 0, `${schluessel}: Nenner`);
    assert.equal(k.wert, null, `${schluessel}: kein Prozentwert aus Nenner 0`);
    assert.equal(
      k.erfuellt,
      null,
      `${schluessel}: ungemessen ist weder bestanden noch gefallen`,
    );
    assert.notEqual(
      k.erfuellt,
      true,
      `${schluessel}: eine ungemessene Metrik darf NIE als erfuellt gelten`,
    );
  }

  // Das ist die Stelle, an der `evals/runners/policy.js` heute mit
  // `erfuellt !== false` entscheidet: `null` kommt durch, der Lauf bleibt
  // gruen. Fuer 3.14 der Domaene `beispiel` ist das Absicht — sie hat keinen
  // Connector. Fuer eine Metrik, deren Faelle jemand GELOESCHT hat, ist es
  // eine Luecke: aus „gemessen und gruen" wird „ungemessen und trotzdem
  // gruen", ohne dass sich der Exit-Code ruehrt. Dieser Test haelt das
  // Verhalten fest, damit die Entscheidung darueber sichtbar bleibt statt
  // still zu sein.
  assert.equal(m["3.13"].erfuellt !== false, true);
});

test("3.13 zaehlt auch den AGENTENPFAD — und nicht die Entzugsfaelle", () => {
  // Seit T1 (ADR-0019) liest nicht nur der Abruf, sondern auch ein Agentenlauf.
  // Beide gehoeren in denselben Nenner; der Entzugsfall NICHT, weil 3.14 seine
  // Lieferungen phasenweise beurteilt.
  const laeufe = [
    { art: "abruf", gelieferteChunks: 4, unerlaubteChunks: 0 },
    workflow("W1", { gelieferteChunks: 2, unerlaubteChunks: 1 }),
    { art: "entzug", gelieferteChunks: 99, veralteteChunks: 0 },
  ];

  const m = berechneMetriken(laeufe);

  assert.equal(m["3.13"].nenner, 6, "4 aus dem Abruf + 2 aus dem Agentenlauf");
  assert.equal(m["3.13"].zaehler, 1, "das Leck des Agentenlaufs zaehlt");
  assert.equal(m["3.13"].erfuellt, false);
});

test("3.13: ein Nenner ohne Zaehler wirft — eine NaN waere still durchgelaufen", () => {
  // Der Defekt, der beim Bauen von T1 wirklich auftrat: ein Lauf meldete
  // `gelieferteChunks` ohne `unerlaubteChunks`, und der Bericht trug
  // „NaN % (NaN/70)". Eine NaN ist weder gruen noch rot — sie ist die
  // schlimmste der drei Antworten.
  assert.throws(
    () => berechneMetriken([{ art: "abruf", id: "X1", gelieferteChunks: 3 }]),
    /X1/,
    "der Befund muss den Lauf NENNEN, sonst verschiebt er die Arbeit nur",
  );
});
