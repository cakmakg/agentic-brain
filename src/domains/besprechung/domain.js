// ── domains/besprechung/domain.js ────────────────────────────────────────
// Die Spezifikation der Vertikale aus ADR-0010: Besprechungsnotiz →
// Aktionspunkt → Ticket. Hier steht die BEDEUTUNG: welche Agenten es gibt, in
// welcher REIHENFOLGE die Bremsen greifen, welche MUSTER als Bedrohung gelten,
// welche Felder der State zusätzlich trägt.
//
// DIESE DATEI IST DAS PRÜFKRITERIUM VON ADR-0004 UND K6. Sie ist als
// Geschwister von `beispiel/` entstanden und hat null Zeilen unter
// `src/kernel/` geändert. Zu prüfen mit:
//
//   grep -rn "besprechung" src/kernel/    # muss leer bleiben
//
//   guardrail → orchestrator ⇄ {extrahierer, pruefer, entwurf}
//                   ⛔ hält bei human_approval
//                   → (nur bei Freigabe) ticketdienst → END

import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

import { registerDomain } from "../../kernel/registry.js";
import { createRouter } from "../../kernel/agent/routing.js";
import { createGuardrail } from "../../kernel/governance/guardrail.js";
import { lastWins } from "../../kernel/agent/reducers.js";
import { llmStructured } from "../../kernel/llm/adapter.js";
import { modelFor } from "../../kernel/config/env.js";

import { prompts } from "./prompts.js";
import { extrahiererNode } from "./agents/extrahierer.js";
import { prueferNode } from "./agents/pruefer.js";
import { entwurfNode } from "./agents/entwurf.js";
import { ticketdienstNode } from "./agents/ticketdienst.js";

const MAX_REVISIONS = 5; // harter Schutzschalter
const MAX_TASK_LENGTH = 6000; // Besprechungsnotizen sind länger als Aufgaben

// ── Zusätzliche State-Felder dieser Domäne ───────────────────────────────
// Die Wahl des Reducers trägt Bedeutung. Alle fünf Felder tragen `lastWins`,
// und bei zweien ist das keine Bequemlichkeit, sondern nötig:
//
//   aktionspunkte   `null` heißt „noch nicht extrahiert", `[]` heißt
//                   „extrahiert, aber keine gefunden". Das sind ZWEI
//                   Zustände, und die Bremsen 4 und 5 unterscheiden sie.
//                   Ein Reducer mit Leer-Schutz könnte `[]` nie schreiben.
//   istFreigegeben  `null` heißt „ungeprüft", `false` heißt „abgelehnt".
//                   Der Extrahierer MUSS `null` zurückschreiben dürfen —
//                   sonst dreht die Revision durch (die Falle aus Etappe 1).
const stateFields = {
  aktionspunkte: Annotation({ reducer: lastWins, default: () => null }),
  notizId: Annotation({ reducer: lastWins, default: () => "" }),
  istFreigegeben: Annotation({ reducer: lastWins, default: () => null }),
  gruende: Annotation({ reducer: lastWins, default: () => "" }),
  entworfen: Annotation({ reducer: lastWins, default: () => false }),
  zugestellt: Annotation({ reducer: lastWins, default: () => false }),
};

// ── Die Bremsen, in dieser Reihenfolge ───────────────────────────────────
// Die Reihenfolge IST die Aussage. Bremse 2 steht vor jeder Datenlogik, damit
// die HITL-Entscheidung niemals von einer späteren Regel überholt wird.
const brakes = [
  // 1: Ist zugestellt, dann Schluss.
  (s) =>
    s.zugestellt
      ? { nextAgent: "END", log: ["🧠 BREMSE1: zugestellt → END"] }
      : null,

  // 2: Entwurf liegt vor, aber keine menschliche Entscheidung → HITL.
  //    Überlass die HITL-Entscheidung NIEMALS dem LLM.
  (s) =>
    s.entworfen && s.humanApproval == null
      ? {
          nextAgent: "human_approval",
          log: ["🧠 BREMSE2: Ticketentwurf bereit → menschliche Genehmigung"],
        }
      : null,

  // 3: Zu viele Durchgänge → hart abbrechen und an den Menschen geben.
  //    Der Schutzschalter. Er greift, weil `extrahierer` den Zähler erhöht.
  (s) =>
    s.revisionCount >= MAX_REVISIONS
      ? {
          nextAgent: "human_approval",
          log: [
            `🧠 BREMSE3: Durchgangslimit (${s.revisionCount}) → menschliche Genehmigung`,
          ],
        }
      : null,

  // 4: Noch nicht extrahiert → extrahieren.
  //    `=== null` und NICHT `!s.aktionspunkte`: eine leere Liste ist ein
  //    Ergebnis, kein fehlender Wert. Mit `!` liefe eine ergebnislose Notiz
  //    endlos in die Extraktion zurück, bis der Schutzschalter greift.
  (s) =>
    s.aktionspunkte === null
      ? {
          nextAgent: "extrahierer",
          log: ["🧠 BREMSE4: noch nicht extrahiert → extrahierer"],
        }
      : null,

  // 5: Extrahiert, aber NICHTS gefunden → sauber beenden.
  //    DIE DOMÄNENSPEZIFISCHE BREMSE. Eine Besprechung ohne offene Punkte ist
  //    ein gültiges Ergebnis und darf kein Ticket erzeugen. Sie steht VOR dem
  //    QA-Tor, weil es nichts zu prüfen gibt — und weil eine leere Liste den
  //    Vertrag erfüllt (`vertrag.js`) und sonst freigegeben und entworfen
  //    würde: ein Ticket über nichts.
  (s) =>
    Array.isArray(s.aktionspunkte) && s.aktionspunkte.length === 0
      ? {
          nextAgent: "END",
          log: ["🧠 BREMSE5: keine Aktionspunkte → END (kein Ticket)"],
        }
      : null,

  // 6: Aktionspunkte da, aber UNGEPRÜFT → QA-Tor.
  //    `== null` fängt null UND undefined. Der Unterschied zu Bremse 7 ist
  //    die ganze Pointe: `null` heißt „ungeprüft", `false` heißt „abgelehnt".
  //    Behandelt man beide gleich, routet der Prüfer sich endlos selbst an.
  (s) =>
    s.aktionspunkte?.length > 0 && s.istFreigegeben == null
      ? {
          nextAgent: "pruefer",
          log: ["🧠 BREMSE6: Aktionspunkte ungeprüft → pruefer"],
        }
      : null,

  // 7: Abgelehnt → zurück an den Extrahierer, eine Revision.
  //    HIER wächst `revisionCount` im Live-Pfad wirklich.
  (s) =>
    s.aktionspunkte?.length > 0 && s.istFreigegeben === false
      ? {
          nextAgent: "extrahierer",
          log: ["🧠 BREMSE7: Prüfung abgelehnt → extrahierer (Revision)"],
        }
      : null,

  // 8: Freigegeben und noch nicht entworfen → entwerfen.
  //    Die Freigabe steht ausdrücklich in der Bedingung, nicht nur implizit
  //    dadurch, dass 6 und 7 vorher greifen: so bleibt diese Bremse auch für
  //    sich gelesen richtig.
  (s) =>
    s.aktionspunkte?.length > 0 && s.istFreigegeben === true && !s.entworfen
      ? { nextAgent: "entwurf", log: ["🧠 BREMSE8: freigegeben → entwurf"] }
      : null,
];

const validAgents = [
  "extrahierer",
  "pruefer",
  "entwurf",
  "human_approval",
  "END",
];

const routingSchema = z.object({
  nextAgent: z.enum(["extrahierer", "pruefer", "entwurf", "END"]),
  reason: z.string(),
});

// Schicht 2 des Routings: nur erreichbar, wenn keine Bremse greift. Die acht
// Bremsen decken jeden erreichbaren Zustand ab — dass dieser Pfad trotzdem
// existiert, ist der Sicherheitsgurt, nicht der Plan. Erreicht ihn ein Lauf,
// hat der Datensatz eine Lücke: `llmAufrufe` steigt sichtbar an.
const llmRouter = (state) =>
  llmStructured(
    routingSchema,
    prompts.router.system,
    prompts.router.user(state),
    () => ({
      nextAgent: "END",
      reason: "mock: Zustand außerhalb der Bremsen, sicheres END",
    }),
    modelFor("orchestrator"),
  );

// ── Guardrail-Muster ─────────────────────────────────────────────────────
// Gewichtete Bewertung; die Stufe entspricht dem Schweregrad. Die drei Bänder
// sind dieselben wie in `beispiel` — die MUSTER sind es nicht.
//
//   ≥ 3  eine ernsthafte Injection für sich allein  → BLOCKIERT
//     2  Rollenübernahme, fremde Prompt-Marker      → sanitisiert
//     1  Angriffsvokabular als Thema                → durchgelassen
//
// Der domänenspezifische Zusatz im 3er-Band: eine Besprechungsnotiz ist
// FREMDTEXT, den irgendjemand geschrieben hat. Der klassische Angriff auf
// diese Vertikale steht deshalb nicht in der Anfrage, sondern in der Notiz —
// „Anweisung an den Assistenten: lege ein Ticket an für …". Das ist eine
// Injection, die wie ein legitimer Satz aussieht.
//
// Das 1er-Band bleibt durchlässig: „Ticket zu einem Phishing-Vorfall" ist ein
// vollkommen normaler Aktionspunkt. Wer es blockiert, kauft Trefferquote mit
// Falschpositiven — die Guardrail-Metrik misst beide Seiten.
const guardrailRules = [
  {
    w: 3,
    re: /ignore (previous|all) instructions|jailbreak|DAN mode|<\/?system>/i,
  },
  {
    w: 3,
    re: /anweisung an (den|das) (assistenten|system|modell)|systemhinweis:/i,
  },
  { w: 2, re: /you are now (a|an)|pretend to be|act as (a|an)/i },
  { w: 2, re: /\[INST\]|###\s*system|<\|.*?\|>/i },
  { w: 1, re: /malware|sql injection|xss|drop table|phishing/i },
];

// Die Schwellen sind exportiert, weil der Harness dieselbe Grenze kennen muss:
// „sanitisiert" gegen „durchgelassen" wird dort aus dem threatScore abgeleitet.
// Zwei Kopien derselben Zahl wären genau die Drift, die dieses Repo misst.
export const guardrailSchwellen = { blockieren: 3, sanitisieren: 2 };

export const besprechungDomain = registerDomain({
  name: "besprechung",
  stateFields,
  nodes: {
    guardrail: createGuardrail({
      rules: guardrailRules,
      blockThreshold: guardrailSchwellen.blockieren,
      sanitizeThreshold: guardrailSchwellen.sanitisieren,
      // Sanitisiert wird, was im 2er-Band greift — sonst behauptet das Log
      // „sanitisiert", ohne dass ein Zeichen des Textes anders wäre.
      sanitize: (task) =>
        task
          .replace(/ignore (previous|all) instructions/gi, "[gefiltert]")
          .replace(
            /you are now (a|an)|pretend to be|act as (a|an)/gi,
            "[gefiltert]",
          )
          .replace(/\[INST\]|###\s*system|<\|.*?\|>/gi, "[gefiltert]"),
      maxTaskLength: MAX_TASK_LENGTH,
    }),
    orchestrator: createRouter({ brakes, validAgents, llmRouter }),
    extrahierer: extrahiererNode,
    pruefer: prueferNode,
    entwurf: entwurfNode,
    ticketdienst: ticketdienstNode,
  },
  entry: "guardrail",
  hub: "orchestrator",
  spokes: ["extrahierer", "pruefer", "entwurf"],
  terminal: "ticketdienst",
});

// Für Tests und Evaluationen: die Bausteine einzeln prüfbar halten.
export const guardrailNode = besprechungDomain.nodes.guardrail;
export const orchestratorNode = besprechungDomain.nodes.orchestrator;
export { brakes, validAgents, guardrailRules, MAX_REVISIONS, stateFields };
