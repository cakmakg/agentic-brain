// ── evals/domains/besprechung/schichtB.js ────────────────────────────────
// Was die Schicht B für diese Domäne misst: hält der ECHTE Extrahierer den
// Ausgabevertrag (`vertrag.js`), und zwar im ersten Versuch?
//
// DERSELBE PROMPT, DASSELBE SCHEMA, DIESELBE GRENZE WIE IM BETRIEB. Gemessen
// wird nicht ein Nachbau, sondern genau das, was der Knoten `extrahierer`
// schickt: `prompts.extrahierer`, `extrahiererSchema`, und als Obergrenze der
// Versuche `MAX_REVISIONS` der Domäne. Eine eigene Fassung hier würde messen,
// wie gut die Fassung ist — nicht, wie gut das System ist.
//
// NICHT gemessen wird der Leseweg: die Notiz wird direkt übergeben. Dass der
// Extrahierer nur sieht, was der Principal sehen darf, ist 3.13 — Schicht A,
// ohne Modell. Hier zählt nur, was das Modell aus einem erlaubten Text macht.
//
// DIE FÄLLE STEHEN IN `golden/schichtB.json`, getrennt von `acl.json`. Bis zum
// zweiten Lauf waren es die fünf ACL-Notizen aus Schicht A — keine nannte eine
// Handlung, die richtige Antwort war fünfmal die leere Liste, und über die
// Extraktion sagte der Lauf nichts (ADR-0024). Die neuen Fälle tragen je eine
// aus Text und Regeln abgeleitete Erwartung: welche Verantwortlichen die
// offenen Punkte haben, `unbesetzt` für „die Notiz nennt niemanden".

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { llmStructured } from "../../../src/kernel/llm/adapter.js";
import {
  extrahiererSchema,
  mockExtraktion,
} from "../../../src/domains/besprechung/agents/extrahierer.js";
import { prompts } from "../../../src/domains/besprechung/prompts.js";
import {
  pruefeVertrag,
  UNBESETZT,
} from "../../../src/domains/besprechung/vertrag.js";
import { MAX_REVISIONS } from "../../../src/domains/besprechung/domain.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const { faelle } = JSON.parse(
  fs.readFileSync(path.join(hier, "golden", "schichtB.json"), "utf8"),
);

const normal = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();
const sortiert = (xs) => [...xs].map(normal).sort();

/**
 * Hält eine Ausgabe gegen die Erwartung DIESES Falls — über den Vertrag
 * hinaus, der nur die Form kennt.
 *
 * - `verantwortlicheRichtig`: dieselben Verantwortlichen wie erwartet, als
 *   Multimenge; daraus folgt auch die Zahl der Punkte.
 * - `belegt`: jeder genannte Name steht im Text der Notiz. Ein Name, der dort
 *   nicht steht, ist erfunden — das prüft der Vertrag nicht.
 * - `leereVerantwortliche`: `""` besteht den Vertrag (er prüft nur auf
 *   `unbesetzt`) und ist doch kein Name. Gezählt statt verschwiegen.
 */
export function bewerte(ausgabe, gegenstand) {
  const punkte = Array.isArray(ausgabe?.aktionspunkte)
    ? ausgabe.aktionspunkte
    : [];
  const namen = punkte.map((p) => p?.verantwortlich);
  const text = normal(gegenstand.text);
  const ungedeckt = namen.filter(
    (n) =>
      normal(n) !== "" && normal(n) !== UNBESETZT && !text.includes(normal(n)),
  );
  return {
    verantwortlicheRichtig:
      JSON.stringify(sortiert(namen)) ===
      JSON.stringify(sortiert(gegenstand.erwartet.verantwortliche)),
    belegt: ungedeckt.length === 0,
    ungedeckt,
    leereVerantwortliche: namen.filter((n) => normal(n) === "").length,
  };
}

/** Ein Text-Zustand, wie der Graph ihn dem Extrahierer gäbe. */
const zustandFuer = (gegenstand, feedback) => ({
  task: `Aktionspunkte aus notiz:${gegenstand.id}`,
  ...(feedback ? { gruende: feedback } : {}),
});

/**
 * @param {object} o
 * @param {string} o.modell  Modell-ID — der Runner wählt sie, nicht die Umgebung
 */
export function schichtB({ modell }) {
  return {
    name: "besprechung",
    faelle: faelle.map((f) => ({
      id: f.id,
      gegenstand: { id: f.id, text: f.text, erwartet: f.erwartet },
    })),
    varianten: ["standard"],
    maxVersuche: MAX_REVISIONS,

    async schreibe(gegenstand, _variante, feedback) {
      const zustand = zustandFuer(gegenstand, feedback);
      return llmStructured(
        extrahiererSchema,
        prompts.extrahierer.system,
        prompts.extrahierer.user(zustand, gegenstand),
        () => mockExtraktion(zustand),
        modell,
      );
    },

    pruefe(ausgabe) {
      const { istFreigegeben, gruende } = pruefeVertrag(ausgabe?.aktionspunkte);
      return { konform: istFreigegeben, gruende };
    },

    // Der Vertrag nimmt eine leere Liste an („keine offenen Punkte" ist eine
    // gültige Aussage). Ein Modell, das IMMER leer antwortet, wäre damit zu
    // 100 % konform. Deshalb wird „leer" eigens gezählt — eine Zahl, die nur
    // sagt, dass nichts falsch war, sagt nicht, dass etwas getan wurde.
    istLeer: (ausgabe) =>
      Array.isArray(ausgabe?.aktionspunkte) &&
      ausgabe.aktionspunkte.length === 0,

    bewerte,
  };
}
