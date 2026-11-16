// ── kernel/persistence/stabil.js ─────────────────────────────────────────
// Stabile Serialisierung: derselbe Wert muss dieselbe Zeichenkette ergeben,
// auch wenn seine Felder in anderer Reihenfolge entstanden sind.
// `JSON.stringify` allein leistet das nicht — es schreibt in
// Einfügereihenfolge.
//
// WARUM SIE EINE EIGENE DATEI IST. Zwei Stellen brauchen genau diese Zusage,
// und beide brauchen sie aus demselben Grund:
//
//   `action/queue.js`       der Idempotenzschlüssel. Dasselbe Payload muss
//                           denselben Schlüssel ergeben, sonst entsteht aus
//                           einem Vorgang ein zweites Ticket.
//   `governance/audit.js`   das Glied der Hash-Kette. Die Prüfung
//                           serialisiert eine GELESENE Zeile neu; kommt dabei
//                           eine andere Zeichenkette heraus als beim
//                           Schreiben, meldet die Kette einen Bruch, den es
//                           nicht gibt.
//
// Zwei Kopien dieser Funktion wären genau die Drift, die dieses Repo misst —
// und die zweite fiele erst auf, wenn eine Kette grundlos rot wird oder ein
// Ticket doppelt entsteht. Dieselbe Antwort wie ADR-0014 bei den ACL-Regeln:
// eine Quelle, mehrere Verwender.
//
// REINE FUNKTION, kein IO. Sie liegt unter `persistence/`, weil sie
// Infrastruktur ist und keiner der sechs Ebenen gehört (`docs/roadmap.md` §3).

export function stabil(wert) {
  if (wert === null || typeof wert !== "object")
    return JSON.stringify(wert) ?? "null";
  if (Array.isArray(wert)) return `[${wert.map(stabil).join(",")}]`;
  return `{${Object.keys(wert)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stabil(wert[k])}`)
    .join(",")}}`;
}
