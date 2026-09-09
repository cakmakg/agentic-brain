// ── domains/beispiel/prompts.js ──────────────────────────────────────────
// Die Prompts der Domäne an einer Stelle. Sie sind BEDEUTUNG, nicht Mechanik —
// deshalb stehen sie hier und nicht im Kern.
//
// Warum gebündelt: ein Prompt, der in einem Agenten versteckt liegt, wird beim
// Messen übersehen. Ändert sich hier eine Zeile, ändert sich eine
// Evaluationszahl; diese Kopplung soll sichtbar sein.

export const prompts = {
  bearbeiter: {
    system:
      "Du bearbeitest eine Aufgabe. Antworte knapp, sachlich und ohne Ausschmückung.",
    user: (state) => `Aufgabe: ${state.task}`,
  },

  router: {
    system:
      "Du bist ein Workflow-Router. Wähle anhand des gegebenen Zustands den nächsten Agenten.",
    user: (state) =>
      `Zustand: ergebnis=${!!state.ergebnis}, abgelegt=${state.abgelegt}. Aufgabe: ${state.task}`,
  },
};
