// ── domains/besprechung/prompts.js ───────────────────────────────────────
// Die Prompts der Domäne an einer Stelle. Sie sind BEDEUTUNG, nicht Mechanik.
//
// Warum gebündelt: ein Prompt, der in einem Agenten versteckt liegt, wird beim
// Messen übersehen. Ändert sich hier eine Zeile, ändert sich eine
// Evaluationszahl; diese Kopplung soll sichtbar sein.
//
// Der Ausgabevertrag steht im Prompt des Prüfers UND als reine Funktion in
// `agents/pruefer.js`. Das ist Absicht und kein Duplikat: der Prompt bittet,
// die Funktion entscheidet. Ein Prüfer, der nur bittet, ist kein Tor.

import { UNBESETZT, MIN_TEXT_LAENGE } from "./vertrag.js";

export const prompts = {
  extrahierer: {
    system:
      "Du ziehst aus einer Besprechungsnotiz die offenen Aktionspunkte. " +
      "Jeder Aktionspunkt nennt genau eine Handlung und genau eine verantwortliche Person. " +
      "Erfinde nichts, was nicht in der Notiz steht — ein erfundener Aktionspunkt wird zu einem echten Ticket.",
    // Die Rückmeldung des Prüfers geht in die Revision. Eine Schleife, deren
    // Produzent die Kritik nie sieht, dreht sich nur.
    user: (state) =>
      state.gruende
        ? `Notiz: ${state.task}\nÜberarbeite deine vorige Liste. Rückmeldung der Prüfung: ${state.gruende}`
        : `Notiz: ${state.task}`,
  },

  // Das QA-Tor. EIGENER Prompt, eigener Knoten, notfalls eigenes Modell:
  // sagst du demselben Modell „schreib und kritisiere dich selbst", findet es
  // seine eigene Arbeit gut.
  pruefer: {
    system:
      "Du prüfst eine Liste von Aktionspunkten gegen die Besprechungsnotiz. Du hast sie NICHT selbst geschrieben. " +
      `Der Ausgabevertrag: jeder Aktionspunkt trägt einen Text von mindestens ${MIN_TEXT_LAENGE} Zeichen ` +
      `und eine benannte verantwortliche Person — "${UNBESETZT}" gilt nicht. ` +
      "Gib die Liste nur frei, wenn JEDER Punkt beide Bedingungen erfüllt. Begründe knapp.",
    user: (state) =>
      `Notiz: ${state.task}\nZu prüfende Aktionspunkte: ${JSON.stringify(state.aktionspunkte)}`,
  },

  router: {
    system:
      "Du bist ein Workflow-Router. Wähle anhand des gegebenen Zustands den nächsten Agenten.",
    user: (state) =>
      `Zustand: aktionspunkte=${state.aktionspunkte?.length ?? "keine"}, geprueft=${state.istFreigegeben}, entworfen=${state.entworfen}. Notiz: ${state.task}`,
  },
};
