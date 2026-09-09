// ── kernel/retrieval/suche.js ────────────────────────────────────────────
// Der Anwendungsfall „such etwas für diesen Principal". Er ist die Tür, die
// Aufrufer benutzen; den Speicher sehen sie nicht.
//
// ARBEITSTEILUNG, damit sie nicht später verwischt:
//   filter.js  reine ACL-Logik, kein IO — entscheidet WER WAS sehen darf
//   store/     Port und Adapter — führen den Filter IN der Suche mit (ADR-0008)
//   suche.js   dieser Anwendungsfall — fasst Chunks zu Dokumenten zusammen
//
// Diese Datei filtert NICHT selbst. Täte sie es, wäre das genau das
// nachgelagerte Filtern, das ADR-0008 ausschließt — und es sähe im Test
// identisch aus, solange der Speicher zufällig auch filtert. Deshalb kommt
// hier nichts an, was nicht schon erlaubt war.

// Fasst die Treffer zu Dokumenten zusammen. Ein Aufrufer, der „welche
// Dokumente darf ich sehen" fragt, soll nicht selbst Chunks gruppieren müssen —
// und die Metrik 3.13 rechnet auf doc_ids.
function fasseZusammen(treffer) {
  const proDokument = new Map();
  for (const t of treffer) {
    const bisher = proDokument.get(t.dokumentId);
    if (!bisher || t.wert > bisher.wert) {
      proDokument.set(t.dokumentId, { dokumentId: t.dokumentId, wert: t.wert });
    }
  }
  return [...proDokument.values()].sort((a, b) =>
    b.wert !== a.wert ? b.wert - a.wert : a.dokumentId < b.dokumentId ? -1 : 1,
  );
}

export function suche({ store, principal, anfrage, k = 5 }) {
  const { treffer, grund } = store.suche({ principal, anfrage, k });
  return {
    treffer,
    dokumente: fasseZusammen(treffer),
    // `grund` trägt „principal-nicht-aufloesbar" durch. Ein leeres Ergebnis
    // mit Grund ist etwas anderes als ein leeres Ergebnis ohne — fail-closed
    // sieht sonst aus wie „nichts gefunden" (ADR-0008).
    grund,
  };
}
