// ── evals/runners/quality.js ─────────────────────────────────────────────
// SCHICHT B — misst, ob ein ECHTES Modell den Ausgabevertrag einer Domäne
// hält. Das Gegenstück zu `policy.js`: jene läuft nur im Mock und misst Regeln,
// diese läuft nur gegen ein Modell und misst dessen Ausgabe (EVALS.md §5,
// ADR-0024).
//
//   npm run evals:b -- besprechung
//   npm run evals:b -- besprechung --model=claude-haiku-4-5 --max-usd=0.50
//
// DAS MODELL WÄHLT DIESER AUFRUF, NICHT DIE UMGEBUNG. Stünde es in `.env`
// (`MODEL=…`), verschöbe es auch die Mock-Kostenschätzung der Schicht A (3.6).
// Hier steht es im Argument und im Bericht.
//
// DIE GRENZE GREIFT VOR DEM AUFRUF (`messung.js`). Und sie sieht echte Kosten:
// seit 2026-11-17 zählt auch `llmStructured` seine Token — vorher sah der
// Budget-Zähler im echten Betrieb 0 USD.
//
// Domänenfrei: was eine Domäne misst, steht in `evals/domains/<d>/schichtB.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { berichtsNameB, codeStand } from "./berichtsname.js";
import { messeEntwuerfe } from "./messung.js";
import { vertragskonformitaet } from "../metrics/index.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const evalsDir = path.resolve(hier, "..");

const { MOCK_LLM } = await import("../../src/kernel/config/env.js");
const { cost } = await import("../../src/kernel/governance/costTracker.js");

const arg = (name, vorgabe) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? vorgabe;
const domaene = process.argv.slice(2).find((a) => !a.startsWith("-"));
const modell = arg("model", "claude-haiku-4-5");
const maxUsd = Number(arg("max-usd", "0.50"));

function abbruch(meldung) {
  console.error(meldung);
  process.exit(1);
}

if (MOCK_LLM) {
  abbruch(
    "Schicht B braucht ein echtes Modell: ANTHROPIC_API_KEY fehlt. Im Mock-Modus " +
      "misst sie nur die eigene Attrappe — ein grüner Lauf hieße nichts.",
  );
}
if (!domaene)
  abbruch("Aufruf: npm run evals:b -- <domäne> [--model=…] [--max-usd=…]");
if (!(maxUsd > 0))
  abbruch(`--max-usd muss positiv sein, nicht "${arg("max-usd")}".`);

let messbar;
try {
  messbar = (await import(`../domains/${domaene}/schichtB.js`)).schichtB({
    modell,
  });
} catch (e) {
  abbruch(`Domäne "${domaene}" hat keine Schicht B (${e.message}).`);
}

console.log(
  `\nSchicht B · Domäne ${domaene} · ${messbar.faelle.length} Fälle · ` +
    `Modell ${modell} · höchstens ${messbar.maxVersuche} Versuche · Grenze ${maxUsd.toFixed(2)} USD\n`,
);

cost.reset();
const { entwuerfe, abgebrochen } = await messeEntwuerfe({
  schichtB: messbar,
  faelle: messbar.faelle,
  varianten: messbar.varianten,
  maxUsd,
  verbrauch: cost.spend,
  melde: (e) =>
    console.log(
      `  ${e.fehler ? "⚠" : e.konformImErstenVersuch ? "🟢" : "🔴"} ${e.id.padEnd(14)} ` +
        `Versuche ${e.versuche} · ${e.fehler ?? (e.konformAmEnde ? "konform" : e.gruendeErsterVersuch)}`,
    ),
});

const gemessen = entwuerfe.filter((e) => e.text);
const leer = gemessen.filter((e) => messbar.istLeer(e.text));
const fehler = entwuerfe.filter((e) => e.fehler);

// ── Je Fall gegen seine Erwartung, falls die Domäne eine trägt ──────────
// Der Vertrag kennt nur die Form. Ob die RICHTIGEN Punkte kamen und ob ein
// Name erfunden ist, sagt erst die Erwartung des Falls. Gemessen am ersten
// Versuch (die eigentliche Zahl) und an der letzten Fassung: wird ein Name
// erst in der Revision erfunden, ist das ein Befund über die Schleife.
const zaehle = (bewertungen, feld) => ({
  zaehler: bewertungen.filter((b) => b[feld]).length,
  nenner: bewertungen.length,
});
const nachFall = messbar.bewerte
  ? (() => {
      const fallVon = (e) =>
        messbar.faelle.find((f) => f.id === e.id).gegenstand;
      const erste = gemessen.map((e) =>
        messbar.bewerte(e.textErsterVersuch, fallVon(e)),
      );
      const letzte = gemessen.map((e) => messbar.bewerte(e.text, fallVon(e)));
      gemessen.forEach((e, i) => {
        e.bewertungErsterVersuch = erste[i];
        e.bewertungAmEnde = letzte[i];
      });
      return {
        verantwortlicheRichtig: zaehle(erste, "verantwortlicheRichtig"),
        belegtErsterVersuch: zaehle(erste, "belegt"),
        belegtAmEnde: zaehle(letzte, "belegt"),
        leereVerantwortliche: erste.reduce(
          (s, b) => s + b.leereVerantwortliche,
          0,
        ),
      };
    })()
  : null;

const bericht = {
  erzeugt: new Date().toISOString(),
  stand: codeStand(),
  schicht: "B",
  domaene,
  modell,
  // Was die Anfrage NICHT setzt, gehört ebenso hierher: ein späterer Lauf mit
  // Effort oder Thinking sähe sonst gleich aus und mäße etwas anderes.
  anfrage: { effort: "nicht gesetzt", thinking: "nicht gesetzt" },
  faelle: messbar.faelle.length,
  maxVersuche: messbar.maxVersuche,
  maxUsd,
  kostenUsd: cost.spend(),
  abgebrochen,
  metriken: {
    ...vertragskonformitaet(entwuerfe),
    leereListen: { zaehler: leer.length, nenner: gemessen.length },
    ...(nachFall ?? {}),
  },
  fehler: fehler.map((e) => ({ id: e.id, fehler: e.fehler })),
  // Die Ausgaben selbst: wer eine Zahl anzweifelt, soll lesen können, was das
  // Modell geschrieben hat.
  entwuerfe,
};

const berichtDir = path.join(evalsDir, "reports");
fs.mkdirSync(berichtDir, { recursive: true });
const datei = path.join(
  berichtDir,
  berichtsNameB({
    erzeugt: bericht.erzeugt,
    domaene,
    modell,
    stand: bericht.stand,
  }),
);
fs.writeFileSync(datei, JSON.stringify(bericht, null, 2) + "\n");

const k = bericht.metriken;
const anteil = (m) =>
  m.nenner === 0
    ? "nicht messbar"
    : `${((m.zaehler / m.nenner) * 100).toFixed(1)} %   (${m.zaehler}/${m.nenner})`;
console.log(`
  Vertragskonformität (erster Versuch)   ${anteil(k[3.8])}
  Konform nach der Revisionsschleife     ${anteil(k.nachRevision)}
  Leere Listen                           ${anteil(k.leereListen)}${
    nachFall
      ? `
  Verantwortliche wie erwartet           ${anteil(k.verantwortlicheRichtig)}
  Namen belegt (erster Versuch)          ${anteil(k.belegtErsterVersuch)}
  Namen belegt (nach Revision)           ${anteil(k.belegtAmEnde)}
  Leere Verantwortliche ("")             ${k.leereVerantwortliche}`
      : ""
  }
  Versuche (Median)                      ${k.versucheMedian ?? "—"}
  Kosten                                 ${bericht.kostenUsd.toFixed(6)} USD
  Fehler                                 ${fehler.length}${abgebrochen ? `\n  ABGEBROCHEN: ${abgebrochen}` : ""}

  Bericht: ${path.relative(process.cwd(), datei)}
`);

// Rot heißt hier: nicht vollständig gemessen. Eine niedrige Konformität ist
// ein BEFUND, kein Fehler des Laufs — für Schicht B gibt es noch keine Baseline.
process.exit(fehler.length || abgebrochen ? 1 : 0);
