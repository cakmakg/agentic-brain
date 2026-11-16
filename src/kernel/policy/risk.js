// ── kernel/policy/risk.js ────────────────────────────────────────────────
// Die drei Risikostufen einer Aktion (A19, `docs/roadmap.md`). Sie messen
// nicht, wie WAHRSCHEINLICH etwas schiefgeht, sondern WER es merkt und ob es
// sich zurücknehmen lässt — das sind die beiden Fragen, an denen die
// HITL-Zusage hängt:
//
//   0  nur für den Nutzer sichtbar      — ein Fehler bleibt bei dem, der fragt
//   1  intern und zurücknehmbar         — ein Fehler lässt sich zurückdrehen
//   2  für andere sichtbar oder         — ein Fehler hat jemand anderen schon
//      unumkehrbar                         erreicht, bevor er bemerkt wird
//
// WARUM ES DIE STUFEN JETZT SCHON GIBT, obwohl sie nichts entscheiden: jede
// Außenwirkung zu genehmigen hat einen Preis (Genehmigungsmüdigkeit), und
// eine Stufe darf nach A19 nur aufsteigen, wenn Daten über einen festgelegten
// Zeitraum es stützen. Daten über eine Klasse, die nie vergeben wurde, gibt es
// nicht. Deshalb wird sie ab Etappe 4c vergeben und protokolliert — wirksam
// wird sie erst in Etappe 14b.
//
// Eine unbekannte Stufe wird ABGELEHNT, nicht auf 2 hochgerundet. Ein
// Hochrunden wäre heute folgenlos und morgen eine Klasse, die niemand
// vergeben hat.
//
// REIN, kein IO, kein Import.

export const RISIKOSTUFEN = Object.freeze({
  0: "nur für den Nutzer sichtbar",
  1: "intern und zurücknehmbar",
  2: "für andere sichtbar oder unumkehrbar",
});

export function pruefeRisikoklasse(wert) {
  if (wert !== 0 && wert !== 1 && wert !== 2) {
    throw new Error(
      `Risikoklasse: ${String(wert)} ist keine — erwartet wird 0, 1 oder 2 ` +
        "als Zahl (A19).",
    );
  }
  return wert;
}
