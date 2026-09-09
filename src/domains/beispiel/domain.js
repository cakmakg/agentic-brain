// ── domains/beispiel/domain.js ───────────────────────────────────────────
// Die Spezifikation der Domäne `beispiel`. Hier steht die BEDEUTUNG: welche
// Agenten es gibt, in welcher REIHENFOLGE die Bremsen greifen, welche MUSTER
// als Bedrohung gelten, welche Felder der State zusätzlich trägt.
//
// Der Kern kennt diese Datei nicht — er kennt nur die Registry. Eine zweite
// Domäne entsteht als Geschwisterdatei und ändert null Zeilen im Kern.
//
// DIESE DOMÄNE IST DAS GERÜST, NICHT DAS PRODUKT. Sie ist so klein wie möglich
// gehalten und fährt trotzdem jeden Mechanismus einmal durch:
//
//   guardrail → orchestrator ⇄ {bearbeiter, pruefer, ablage}
//                   ⛔ hält bei human_approval
//                   → (nur bei Freigabe) zusteller → END
//
// Kopier den Ordner, benenn ihn nach deiner Domäne, trag ihn in
// `src/kernel/registry.js` und `evals/domains/index.js` ein — fertig.

import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

import { registerDomain } from "../../kernel/registry.js";
import { createRouter } from "../../kernel/agent/routing.js";
import { createGuardrail } from "../../kernel/governance/guardrail.js";
import { keepIfFilled, lastWins } from "../../kernel/agent/reducers.js";
import { llmStructured } from "../../kernel/llm/adapter.js";
import { modelFor } from "../../kernel/config/env.js";

import { prompts } from "./prompts.js";
import { bearbeiterNode } from "./agents/bearbeiter.js";
import { prueferNode } from "./agents/pruefer.js";
import { ablageNode } from "./agents/ablage.js";
import { zustellerNode } from "./agents/zusteller.js";

const MAX_REVISIONS = 5; // harter Schutzschalter
const MAX_TASK_LENGTH = 3000;

// ── Zusätzliche State-Felder dieser Domäne ───────────────────────────────
// Die Wahl des Reducers trägt Bedeutung: Datenfelder mit Leer-Schutz,
// Entscheidungsfelder mit „letzter Wert gewinnt". Verwechselt man sie, bricht
// nicht die Syntax, sondern die Logik.
const stateFields = {
  ergebnis: Annotation({ reducer: keepIfFilled, default: () => "" }),

  // Das Urteil des QA-Tors. `lastWins`, NICHT `keepIfFilled`: `null` heißt hier
  // „ungeprüft" und ist eine Aussage, kein fehlender Wert. Der Bearbeiter muss
  // dieses `null` zurückschreiben dürfen — sonst dreht die Revision durch.
  istFreigegeben: Annotation({ reducer: lastWins, default: () => null }),

  // Die Rückmeldung des Prüfers. Sie geht in den Prompt des Bearbeiters — eine
  // Revisionsschleife, deren Produzent die Kritik nie sieht, dreht sich nur.
  gruende: Annotation({ reducer: lastWins, default: () => "" }),

  abgelegt: Annotation({ reducer: lastWins, default: () => false }),
  zugestellt: Annotation({ reducer: lastWins, default: () => false }),
};

// ── Die Bremsen, in dieser Reihenfolge ───────────────────────────────────
// Die Reihenfolge IST die Aussage. Bremse 2 steht vor jeder Datenlogik, damit
// die HITL-Entscheidung niemals von einer späteren Regel überholt wird.
const brakes = [
  // 1: Ist zugestellt, dann Schluss — nach der Zustellung nicht erneut in die
  //    Schleife laufen.
  (s) =>
    s.zugestellt
      ? { nextAgent: "END", log: ["🧠 BREMSE1: zugestellt → END"] }
      : null,

  // 2: Artefakt abgelegt, aber keine menschliche Entscheidung → HITL.
  //    Überlass die HITL-Entscheidung NIEMALS dem LLM.
  (s) =>
    s.abgelegt && s.humanApproval == null
      ? {
          nextAgent: "human_approval",
          log: ["🧠 BREMSE2: Artefakt bereit → menschliche Genehmigung"],
        }
      : null,

  // 3: Zu viele Durchgänge → hart abbrechen und an den Menschen geben.
  //    Der Schutzschalter. Er greift, weil `bearbeiter` den Zähler erhöht —
  //    und seit dem QA-Tor kann er im Live-Pfad wirklich auslösen.
  (s) =>
    s.revisionCount >= MAX_REVISIONS
      ? {
          nextAgent: "human_approval",
          log: [
            `🧠 BREMSE3: Durchgangslimit (${s.revisionCount}) → menschliche Genehmigung`,
          ],
        }
      : null,

  // 4: Ohne Ergebnis zuerst bearbeiten.
  (s) =>
    !s.ergebnis
      ? {
          nextAgent: "bearbeiter",
          log: ["🧠 BREMSE4: kein Ergebnis → bearbeiter"],
        }
      : null,

  // 5: Ergebnis da, aber UNGEPRÜFT → QA-Tor.
  //    `== null` fängt null UND undefined. Der Unterschied zu Bremse 6 ist die
  //    ganze Pointe: `null` heißt „ungeprüft", `false` heißt „abgelehnt".
  //    Behandelt man beide gleich, routet der Prüfer sich endlos selbst an,
  //    bis das Rekursionslimit greift — der klassische Fehler an dieser Stelle.
  (s) =>
    s.ergebnis && s.istFreigegeben == null
      ? {
          nextAgent: "pruefer",
          log: ["🧠 BREMSE5: Ergebnis ungeprüft → pruefer"],
        }
      : null,

  // 6: Abgelehnt → zurück an den Bearbeiter, eine Revision.
  //    HIER wächst `revisionCount` im Live-Pfad wirklich. Damit wird Bremse 3
  //    vom Papier zum Schutzschalter: sie kann jetzt auslösen.
  (s) =>
    s.ergebnis && s.istFreigegeben === false
      ? {
          nextAgent: "bearbeiter",
          log: ["🧠 BREMSE6: Prüfung abgelehnt → bearbeiter (Revision)"],
        }
      : null,

  // 7: Freigegeben und noch nicht abgelegt → ablegen.
  //    Die Freigabe steht ausdrücklich in der Bedingung, nicht nur implizit
  //    dadurch, dass 5 und 6 vorher greifen: so bleibt diese Bremse auch für
  //    sich gelesen richtig.
  (s) =>
    s.ergebnis && s.istFreigegeben === true && !s.abgelegt
      ? { nextAgent: "ablage", log: ["🧠 BREMSE7: freigegeben → ablage"] }
      : null,
];

const validAgents = [
  "bearbeiter",
  "pruefer",
  "ablage",
  "human_approval",
  "END",
];

const routingSchema = z.object({
  nextAgent: z.enum(["bearbeiter", "pruefer", "ablage", "END"]),
  reason: z.string(),
});

// Schicht 2 des Routings: nur erreichbar, wenn keine Bremse greift — seltener
// Pfad, deshalb ein guter Kandidat für ein billigeres Modell (modelFor).
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
// Gewichtete Bewertung; die Stufe entspricht dem Schweregrad. Aus den Gewichten
// ergeben sich drei Bänder, und die Schwellen unten benennen sie:
//
//   ≥ 3  eine ernsthafte Injection für sich allein  → BLOCKIERT
//     2  Rollenübernahme, fremde Prompt-Marker      → sanitisiert
//     1  Angriffsvokabular als Thema                → durchgelassen
//
// Das dritte Band ist Absicht: „malware" oder „sql injection" können legitime
// Themen sein. Wer sie blockiert, kauft Trefferquote mit Falschpositiven — die
// Guardrail-Metrik misst beide Seiten, nicht nur eine.
const guardrailRules = [
  {
    w: 3,
    re: /ignore (previous|all) instructions|jailbreak|DAN mode|<\/?system>/i,
  },
  { w: 2, re: /you are now (a|an)|pretend to be|act as (a|an)/i },
  { w: 2, re: /\[INST\]|###\s*system|<\|.*?\|>/i },
  { w: 1, re: /malware|sql injection|xss|drop table/i },
];

// Die Schwellen sind exportiert, weil der Harness dieselbe Grenze kennen muss:
// „sanitisiert" gegen „durchgelassen" wird dort aus dem threatScore abgeleitet.
// Zwei Kopien derselben Zahl wären genau die Drift, die dieses Gerüst misst.
export const guardrailSchwellen = { blockieren: 3, sanitisieren: 2 };

export const beispielDomain = registerDomain({
  name: "beispiel",
  stateFields,
  nodes: {
    guardrail: createGuardrail({
      rules: guardrailRules,
      blockThreshold: guardrailSchwellen.blockieren,
      sanitizeThreshold: guardrailSchwellen.sanitisieren,
      // Sanitisiert wird, was im 2er-Band greift — sonst behauptet das Log
      // „sanitisiert", ohne dass ein Zeichen des Textes anders wäre. Das
      // 3er-Muster bleibt vorsichtshalber drin (heute blockiert es ohnehin);
      // das 1er-Band bleibt unangetastet, es ist legitimes Thema.
      sanitize: (task) =>
        task
          .replace(/ignore (previous|all) instructions/gi, "[filtered]")
          .replace(
            /you are now (a|an)|pretend to be|act as (a|an)/gi,
            "[filtered]",
          )
          .replace(/\[INST\]|###\s*system|<\|.*?\|>/gi, "[filtered]"),
      maxTaskLength: MAX_TASK_LENGTH,
    }),
    orchestrator: createRouter({ brakes, validAgents, llmRouter }),
    bearbeiter: bearbeiterNode,
    pruefer: prueferNode,
    ablage: ablageNode,
    zusteller: zustellerNode,
  },
  entry: "guardrail",
  hub: "orchestrator",
  spokes: ["bearbeiter", "pruefer", "ablage"],
  terminal: "zusteller",
});

// Für Tests und Evaluationen: die Bausteine einzeln prüfbar halten.
export const guardrailNode = beispielDomain.nodes.guardrail;
export const orchestratorNode = beispielDomain.nodes.orchestrator;
export { brakes, validAgents, guardrailRules, MAX_REVISIONS, stateFields };
