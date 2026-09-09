// ── domains/beispiel/agents/bearbeiter.js ────────────────────────────────
// Der produzierende Agent. Er ist der einzige Knoten dieser Domäne, der ein
// LLM anfasst.
//
// Gründerlektion: Ein Agent mit EINER Verantwortung schlägt den Agenten, der
// alles macht. Getrennt lässt sich jeder für sich testen, die Prompts bleiben
// kurz, und die Berechtigung lässt sich pro Rolle vergeben.
//
// Dieser Knoten ERHÖHT `revisionCount` (liefert bei jedem Aufruf +1). Der
// Akkumulator-Reducer im Kern summiert sie; BREMSE 3 fängt das Limit ab. Das
// ist der Schutzschalter gegen eine endlose Schleife — er ist auch dann live,
// wenn diese Domäne noch keine Revisionsschleife fährt.
//
// HIER WÄCHST DIE DOMÄNE: Ein QA-Tor („prüfer") wird ein zweiter Spoke, der
// `istFreigegeben` (Reducer `lastWins`) und eine Rückmeldung schreibt. Trenn
// Produzent und Prüfer strikt — sagst du demselben Modell „schreib und
// kritisiere dich selbst", findet es seine eigene Arbeit gut.

import { llmText } from "../../../kernel/llm/adapter.js";
import { modelFor } from "../../../kernel/config/env.js";
import { prompts } from "../prompts.js";

export async function bearbeiterNode(state) {
  const ergebnis = await llmText(
    prompts.bearbeiter.system,
    prompts.bearbeiter.user(state),
    modelFor("bearbeiter"),
  );

  return {
    ergebnis: String(ergebnis),
    revisionCount: 1, // der Akkumulator-Reducer addiert +1 → Schutzschalter
    nextAgent: "orchestrator", // jeder Agent kehrt zum Hub zurück
    log: [
      `⚙️ bearbeiter: Ergebnis erzeugt (Durchgang ${state.revisionCount + 1})`,
    ],
  };
}
