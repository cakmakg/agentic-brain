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
// DIE FÄLLE SIND DIE FÜNF NOTIZEN AUS SCHICHT A. Sie sind kurz (48–91 Zeichen)
// und für ACL-Fälle geschrieben, nicht für schwere Extraktion. Dieser Lauf ist
// deshalb ein Rauchtest der Kette gegen ein echtes Modell, keine Aussage über
// die Qualität bei echten Besprechungsnotizen (ADR-0024).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { llmStructured } from "../../../src/kernel/llm/adapter.js";
import {
  extrahiererSchema,
  mockExtraktion,
} from "../../../src/domains/besprechung/agents/extrahierer.js";
import { prompts } from "../../../src/domains/besprechung/prompts.js";
import { pruefeVertrag } from "../../../src/domains/besprechung/vertrag.js";
import { MAX_REVISIONS } from "../../../src/domains/besprechung/domain.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const { quellsystem } = JSON.parse(
  fs.readFileSync(path.join(hier, "golden", "acl.json"), "utf8"),
);

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
    faelle: quellsystem.notizen.map((n) => ({
      id: n.notizId,
      gegenstand: { id: n.notizId, text: n.text },
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
  };
}
