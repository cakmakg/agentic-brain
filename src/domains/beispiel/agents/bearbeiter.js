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
// Seit dem QA-Tor (`pruefer`) ist dieser Knoten der Produzent EINER
// Revisionsschleife: er läuft erneut, wenn der Prüfer abgelehnt hat, und
// bekommt dessen Rückmeldung über `state.gruende` in den Prompt.

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
    // Eine NEUE Fassung ist ungeprüft. Ohne dieses Zurücksetzen bliebe
    // `istFreigegeben` auf `false` stehen, BREMSE 6 griffe sofort wieder, und
    // der Bearbeiter riefe sich selbst auf, bis der Schutzschalter kommt.
    // Das ist die Stelle, an der `lastWins` gebraucht wird: `keepIfFilled`
    // könnte dieses `null` nicht schreiben.
    istFreigegeben: null,
    revisionCount: 1, // der Akkumulator-Reducer addiert +1 → Schutzschalter
    nextAgent: "orchestrator", // jeder Agent kehrt zum Hub zurück
    log: [
      `⚙️ bearbeiter: Ergebnis erzeugt (Durchgang ${state.revisionCount + 1})`,
    ],
  };
}
