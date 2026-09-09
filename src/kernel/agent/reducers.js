// ── kernel/agent/reducers.js ─────────────────────────────────────────────
// Die vier Reducer als Mechanik: hier steht nur, wie sie rechnen. Welches Feld
// welchen bekommt, entscheidet die Domäne — und genau diese Zuordnung ist eine
// fachliche Aussage, keine Formalie. Sie gehört als ADR nach `DECISIONS.md`.

// Leer-Schutz: schreibe den neuen Wert nur, wenn er nicht leer ist. Damit darf
// ein Agent "" liefern, ohne die Arbeit seines Vorgängers zu löschen.
export const keepIfFilled = (x, y) => (y !== undefined && y !== "" ? y : x);

// Letzter Wert gewinnt — auch null. null ist bei Entscheidungsfeldern eine
// Aussage ("ungeprüft"), kein fehlender Wert.
export const lastWins = (x, y) => (y !== undefined ? y : x);

// Akkumulator: der Mechanismus des Schutzschalters. Ohne ihn wächst kein
// Zähler und keine Bremse greift.
export const sum = (x, y) => (y !== undefined ? x + y : x);

// Anhängen statt ersetzen — für Protokollzeilen.
export const append = (x, y) => (y ? [...x, ...y] : x);
