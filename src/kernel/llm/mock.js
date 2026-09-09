// ── kernel/llm/mock.js ───────────────────────────────────────────────────
// Der Mock-Modus ist Fundament, nicht Bequemlichkeit. Ohne ihn wären
// Tests und die Evaluationen der Schicht A weder deterministisch noch kostenlos
// noch in CI ausführbar.
//
// Was hier NICHT passiert: fachliche Antworten. Die schemakonforme Fake-Antwort
// bringt die Domäne als `mockFactory` mit — der Kern kennt ihren Inhalt nicht.

// Grobe Token-Schätzung (für die Kostensimulation im Mock-Modus).
// Die Grenze ist bekannt und gehört nach `EVALS.md`: sie taugt für Trend und
// Ausreißer, nicht für eine Abrechnung.
export const estTokens = (s) => Math.ceil((s || "").length / 4);

// Deterministische Freitext-Antwort: dieselbe Eingabe ergibt dieselbe Ausgabe.
export function mockText(userPrompt) {
  return `[MOCK] ${userPrompt.slice(0, 80)} ... (Mock-Antwort; für ein echtes LLM ANTHROPIC_API_KEY setzen)`;
}
