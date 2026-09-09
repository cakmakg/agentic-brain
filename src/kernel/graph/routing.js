// ── kernel/graph/routing.js ──────────────────────────────────────────────
// Das VERFAHREN des dreischichtigen Routings. Die REIHENFOLGE der Bremsen
// bringt die Domäne mit — das ist die feinste Stelle der Naht.
//
//   1) Deterministische Bremsen → lösen 90 % der Fälle mit NULL LLM-Kosten.
//   2) LLM (strukturierte Ausgabe) → nur wenn keine Bremse greift.
//   3) Post-LLM-Validierung → ungültiger Agent ⇒ sicheres Override auf END.
//
// Gründerlektion: Die Routing-Intelligenz sitzt an EINEM Punkt, nicht in den
// Kanten. Ein einziger Punkt heißt: prüfbar.

// Eine Bremse ist eine Funktion (state) => Teilzustand | null.
// Gibt sie etwas zurück, ist die Entscheidung gefallen und nichts danach läuft.
export function createRouter({ brakes, validAgents, llmRouter }) {
  if (!Array.isArray(brakes) || brakes.length === 0) {
    throw new Error("createRouter: die Domäne muss Bremsen mitbringen.");
  }
  if (!Array.isArray(validAgents) || validAgents.length === 0) {
    throw new Error("createRouter: validAgents fehlt.");
  }

  return async function routerNode(state) {
    // ── SCHICHT 1: die Bremsen, in der Reihenfolge der Domäne.
    for (const brake of brakes) {
      const entscheidung = brake(state);
      if (entscheidung) return entscheidung;
    }

    // ── SCHICHT 2: keine Bremse greift → das LLM fragen.
    const decision = await llmRouter(state);

    // ── SCHICHT 3: Post-LLM-Validierung. Was nicht im Enum steht, endet bei END.
    const next = decision?.nextAgent;
    if (!validAgents.includes(next)) {
      return {
        nextAgent: "END",
        log: [
          `⚠️ orchestrator: LLM lieferte einen ungültigen Agenten (${next}) → Override auf END`,
        ],
      };
    }
    return {
      nextAgent: next,
      log: [`🧠 LLM-Routing → ${next} (${decision.reason})`],
    };
  };
}
