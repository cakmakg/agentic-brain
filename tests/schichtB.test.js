// ── tests/schichtB.test.js ───────────────────────────────────────────────
// Prüft das MESSINSTRUMENT der Schicht B, nicht das Modell.
//
// Die Unterscheidung ist der ganze Punkt dieser Datei. Was ein echtes Modell
// schreibt, kann ohne Schlüssel niemand messen — das ist keine Lücke, sondern
// die Definition von Schicht B. Was sehr wohl ohne
// Schlüssel prüfbar ist: ob der Harness, gefüttert mit bekannten Texten, die
// RICHTIGEN Zahlen ausgibt.
//
// Ein Instrument, von dem man nur weiß, dass es nichts anzeigen kann, ist kein
// Instrument. Hier steht der Gegenbeweis: mit einem Skript-Writer erzeugt
// derselbe Code grüne, gelbe und rote Ergebnisse — und die beiden Zahlen gehen
// auseinander, wie sie sollen.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { messeEntwuerfe } = await import("../evals/runners/messung.js");
const { vertragskonformitaet } = await import("../evals/metrics/index.js");

// ── Ein Skript-Writer statt eines Modells ────────────────────────────────
// `drehbuch` sagt je Fall, welche Versuche konform sind. Damit ist jeder Pfad
// der Schleife gezielt ansteuerbar — ohne Netz, ohne Kosten, ohne Streuung.
function skriptWriter(drehbuch, { maxVersuche = 5 } = {}) {
  const aufrufe = [];
  return {
    aufrufe,
    maxVersuche,
    async schreibe(gegenstand, variante, feedback) {
      const eintrag = { id: gegenstand.id, variante, feedback };
      aufrufe.push(eintrag);
      const plan = drehbuch[gegenstand.id];
      if (plan.wirft) throw new Error("Modellfehler (simuliert)");
      const n = aufrufe.filter(
        (a) => a.id === gegenstand.id && a.variante === variante,
      ).length;
      return `Text ${gegenstand.id}/${variante} Versuch ${n}`;
    },
    pruefe(text, gegenstand) {
      const plan = drehbuch[gegenstand.id];
      const versuch = Number(text.match(/Versuch (\d+)$/)[1]);
      const konform = plan.konformAb !== null && versuch >= plan.konformAb;
      return {
        konform,
        gruende: konform ? "" : `unbelegte Zahl "${versuch}"`,
      };
    },
  };
}

const gratis = () => 0;

// ── Die drei Wege durch die Schleife ─────────────────────────────────────

test("Erstversuch konform: ein Aufruf, beide Zahlen grün", async () => {
  const b = skriptWriter({ A: { konformAb: 1 } });
  const { entwuerfe, abgebrochen } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(abgebrochen, null);
  assert.equal(entwuerfe.length, 1);
  assert.equal(entwuerfe[0].versuche, 1, "kein zweiter Schreibversuch");
  assert.equal(entwuerfe[0].konformImErstenVersuch, true);
  assert.equal(entwuerfe[0].konformAmEnde, true);
  assert.equal(b.aufrufe.length, 1);
});

test("Erst nach Revision konform: erster Versuch rot, nachRevision grün", async () => {
  // Der Fall, für den die Unterscheidung überhaupt existiert. Wer nach der
  // Schleife zählt, sieht hier 100 % und hält den Writer für fehlerfrei.
  const b = skriptWriter({ A: { konformAb: 2 } });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(entwuerfe[0].versuche, 2);
  assert.equal(
    entwuerfe[0].konformImErstenVersuch,
    false,
    "der erste Versuch muss rot sein",
  );
  assert.equal(entwuerfe[0].konformAmEnde, true);
  assert.match(entwuerfe[0].gruendeErsterVersuch, /unbelegte Zahl/);

  // Das Feedback des Tors muss beim zweiten Schreiben tatsächlich ankommen —
  // sonst misst „nachRevision" nur, dass ein zweiter Wurf zufällig traf.
  assert.equal(b.aufrufe[0].feedback, "");
  assert.match(b.aufrufe[1].feedback, /unbelegte Zahl/);
});

test("Nie konform: die Schleife stoppt am Revisionslimit", async () => {
  const b = skriptWriter({ A: { konformAb: null } }, { maxVersuche: 3 });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(entwuerfe[0].versuche, 3, "genau maxVersuche, nicht mehr");
  assert.equal(entwuerfe[0].konformImErstenVersuch, false);
  assert.equal(entwuerfe[0].konformAmEnde, false);
});

// ── Die beiden Schutzmechanismen ─────────────────────────────────────────

test("Ein Modellfehler beendet den Lauf nicht", async () => {
  // Was bereits gemessen wurde, ist bezahlt und gehört in den Bericht.
  const b = skriptWriter({
    A: { konformAb: 1 },
    B: { wirft: true },
    C: { konformAb: 1 },
  });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: ["A", "B", "C"].map((id) => ({ id, gegenstand: { id } })),
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(entwuerfe.length, 3, "C wurde trotz des Fehlers bei B gemessen");
  assert.match(entwuerfe[1].fehler, /simuliert/);
  assert.equal(entwuerfe[1].text, null);
  assert.equal(entwuerfe[2].konformImErstenVersuch, true);
});

test("Die Ausgabengrenze greift VOR dem nächsten Aufruf", async () => {
  // Eine Grenze, die erst nach dem Ausgeben greift, ist keine Grenze.
  let verbraucht = 0;
  const b = skriptWriter({
    A: { konformAb: 1 },
    B: { konformAb: 1 },
    C: { konformAb: 1 },
  });
  const teuer = {
    ...b,
    async schreibe(...args) {
      verbraucht += 0.4;
      return b.schreibe(...args);
    },
  };

  const { entwuerfe, abgebrochen } = await messeEntwuerfe({
    schichtB: teuer,
    faelle: ["A", "B", "C"].map((id) => ({ id, gegenstand: { id } })),
    varianten: ["portal1"],
    maxUsd: 0.5,
    verbrauch: () => verbraucht,
  });

  assert.equal(
    entwuerfe.length,
    2,
    "nach 0,8 USD wird der dritte nicht mehr gefahren",
  );
  assert.match(abgebrochen, /Ausgabengrenze erreicht/);
});

// ── Die Metrik: die beiden Zahlen müssen auseinandergehen ────────────────

test("3.8 zählt den ersten Versuch, nachRevision das Ende", async () => {
  const b = skriptWriter({
    A: { konformAb: 1 }, // sofort konform
    B: { konformAb: 2 }, // erst nach Revision
    C: { konformAb: null }, // nie
  });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: ["A", "B", "C"].map((id) => ({ id, gegenstand: { id } })),
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  const m = vertragskonformitaet(entwuerfe);
  assert.equal(m["3.8"].zaehler, 1, "nur A war im ersten Versuch konform");
  assert.equal(m["3.8"].nenner, 3);
  assert.equal(
    m["3.8"].erfuellt,
    false,
    "die Zahl ist rot — und muss es hier sein",
  );
  assert.equal(m.nachRevision.zaehler, 2, "A und B nach der Schleife");
  assert.notEqual(
    m["3.8"].wert,
    m.nachRevision.wert,
    "gingen beide Zahlen nie auseinander, wäre die Unterscheidung folgenlos",
  );
  assert.equal(m.verletzungen.length, 2);
});

test("Ohne Entwurf ist die Metrik nicht messbar, nicht 100 %", async () => {
  // Die Nenner-Probe an der Stelle, an der sie zuschlägt:
  // ein Lauf, in dem jeder Modellaufruf scheitert, darf nicht grün melden.
  const b = skriptWriter({ A: { wirft: true } });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  const m = vertragskonformitaet(entwuerfe);
  assert.equal(m["3.8"].nenner, 0);
  assert.equal(
    m["3.8"].wert,
    null,
    "kein Prozentwert aus einem Nenner von null",
  );
  assert.equal(m["3.8"].erfuellt, null, "weder bestanden noch gefallen");
});
