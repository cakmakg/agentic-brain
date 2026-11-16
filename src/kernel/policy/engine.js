// ── kernel/policy/engine.js ──────────────────────────────────────────────
// Die Policy-Engine. Sie KLASSIFIZIERT eine Aktion, sie ROUTET NICHT (A5).
//
// Die Bremsen bleiben die Aussage der Domäne, und die HITL-Bremse bleibt
// deterministisch und an erster Stelle. Würde diese Datei entscheiden, ob
// eine Aktion beim Menschen anhält, läge die zentrale Zusage des Repos an
// zwei Stellen — und die zweite könnte die erste still überholen. Deshalb
// gibt `klassifiziere` eine ZAHL zurück und sonst nichts; wer sie liest,
// protokolliert sie. Dass eine Klasse den Ablauf verändert, ist Etappe 14b
// und braucht dort eine eigene Entscheidung.
//
// Woher die Klasse kommt, weiß die Engine nicht: die Domäne bringt sie in
// ihrer Aktionsfläche mit. Fehlt sie, wird geworfen statt geraten — eine
// geratene Klasse sähe im Trace genauso aus wie eine vergebene.
//
// REIN, kein IO.

import { pruefeRisikoklasse } from "./risk.js";

export function klassifiziere({ actionType, risikoklassen }) {
  if (!risikoklassen || !Object.hasOwn(risikoklassen, actionType)) {
    throw new Error(
      `Policy: der Aktionstyp "${actionType}" hat keine Risikoklasse — ` +
        "jede Aktion trägt eine, und sie wird vergeben, nicht geraten.",
    );
  }
  return pruefeRisikoklasse(risikoklassen[actionType]);
}
