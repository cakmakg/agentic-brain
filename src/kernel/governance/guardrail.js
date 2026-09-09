// ── kernel/governance/guardrail.js ───────────────────────────────────────
// MOAT Layer 1 — die REGEX-ENGINE. Die MUSTER bringt die Domäne mit; das ist
// die zweite feine Stelle der Naht.
//
// KRITISCH: KEIN LLM. Die Sicherheitsprüfung selbst muss gegen Prompt-Injection
// immun sein. Fragst du ein LLM "ist dieser Text gefährlich?", kann die
// angreifende Person auch dieses LLM täuschen.
//
// Gründerlektion: Sanitisierung findet an ZWEI Grenzen statt — bei der
// Nutzereingabe (hier) UND bei externen Daten (Ergebnis eines Web-Scrapes).
// Auch externe Daten sind feindlich.

import { cost } from "./costTracker.js";

export function createGuardrail({
  rules,
  blockThreshold,
  sanitizeThreshold,
  sanitize,
  maxTaskLength,
}) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error("createGuardrail: die Domäne muss Muster mitbringen.");
  }

  return function guardrailNode(state) {
    // Schritt 0 — KILL-SWITCH: ist das Budget überschritten, mach nicht einmal
    // einen einzigen LLM-Aufruf.
    if (cost.isThrottled()) {
      return {
        nextAgent: "END",
        log: [
          "🛑 guardrail: Budget überschritten (throttled) — Workflow abgebrochen",
        ],
      };
    }

    const task = String(state.task || "").slice(0, maxTaskLength);
    let score = 0;
    for (const r of rules) if (r.re.test(task)) score += r.w;

    // Dreiwegentscheidung.
    if (score >= blockThreshold) {
      return {
        nextAgent: "END",
        threatScore: score,
        log: [`🛡️ guardrail: Bedrohung BLOCKIERT (Score ${score})`],
      };
    }
    if (score >= sanitizeThreshold) {
      return {
        task: sanitize(task),
        nextAgent: "orchestrator",
        threatScore: score,
        log: [`🧼 guardrail: Eingabe sanitisiert (Score ${score})`],
      };
    }
    // Den GEMESSENEN Wert melden, nicht pauschal 0. Verlöre der saubere Pfad den
    // Score, wäre jede Falschpositiv-Analyse blind: ein Text mit Score 2 sähe aus
    // wie ein Text mit Score 0.
    return {
      nextAgent: "orchestrator",
      threatScore: score,
      log: ["✅ guardrail: sauber"],
    };
  };
}
