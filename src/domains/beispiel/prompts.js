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
    // Zwei Fassungen desselben Prompts: der erste Durchgang kennt keine
    // Rückmeldung, die Revision bekommt sie mitgegeben. Eine Schleife, deren
    // Produzent die Kritik nie zu sehen bekommt, dreht sich nur.
    user: (state) =>
      state.gruende
        ? `Aufgabe: ${state.task}\nÜberarbeite deine vorige Fassung. Rückmeldung der Prüfung: ${state.gruende}`
        : `Aufgabe: ${state.task}`,
  },

  // Das QA-Tor. EIGENER Prompt, eigener Knoten, notfalls eigenes Modell:
  // sagst du demselben Modell „schreib und kritisiere dich selbst", findet es
  // seine eigene Arbeit gut.
  pruefer: {
    system:
      "Du prüfst das Ergebnis eines anderen Agenten gegen die Aufgabe. Du hast es NICHT selbst geschrieben. " +
      "Gib es nur frei, wenn es die Aufgabe beantwortet. Begründe knapp.",
    user: (state) =>
      `Aufgabe: ${state.task}\nZu prüfendes Ergebnis: ${state.ergebnis}`,
  },

  router: {
    system:
      "Du bist ein Workflow-Router. Wähle anhand des gegebenen Zustands den nächsten Agenten.",
    user: (state) =>
      `Zustand: ergebnis=${!!state.ergebnis}, geprueft=${state.istFreigegeben}, abgelegt=${state.abgelegt}. Aufgabe: ${state.task}`,
  },
};
