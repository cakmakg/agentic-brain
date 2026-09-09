// ── kernel/retrieval/filter.js ───────────────────────────────────────────
// Die ACL-Logik. REINE FUNKTIONEN: kein IO, kein Import aus `store/`, kein
// `node:fs`. Das ist keine Stilregel, sondern der Grund, warum diese Datei
// erschöpfend testbar ist — die wichtigste Zusage des Repos hängt an ihr.
//
// ADR-0008: der Filter wird IN DIE ABFRAGE KOMPILIERT, nicht nachgelagert
// angewandt. Deshalb gibt diese Datei kein „filtere diese Liste" heraus,
// sondern ein PRÄDIKAT, das der Adapter beim Durchsuchen anlegt. Der
// Unterschied ist der ganze Punkt: ein unberechtigter Chunk wird nicht
// weggeworfen, nachdem er den Speicher verlassen hat — er verlässt ihn nie.
//
// FAIL-CLOSED, wörtlich wie an der HITL-Kante: lässt sich der Principal nicht
// auflösen, gibt `kompiliereFilter` **null** zurück. Der Port fragt den
// Speicher dann gar nicht erst. Kein Ergebnis ist die sichere Antwort; ein
// ungefiltertes Ergebnis wäre die gefährliche.

import { istPrincipalAufloesbar } from "../context/envelope.js";

// Darf dieser Principal diesen Chunk sehen? Die Regel steht EINMAL, hier.
//
// Die Reihenfolge der Prüfungen ist Absicht: der Mandant zuerst. Ein
// Cross-Tenant-Treffer ist der teuerste Leckfall, und er darf nicht davon
// abhängen, dass eine spätere Zeile richtig ist.
export function darfSehen(principal, envelope) {
  if (!istPrincipalAufloesbar(principal)) return false;
  if (!envelope) return false;

  // 1) Mandantengrenze. Absolut, vor allem anderen, ohne Ausnahme.
  if (envelope.tenantId !== principal.tenantId) return false;

  // 2) Der Besitzer sieht sein Dokument immer — auf jeder Stufe.
  if (envelope.besitzerId === principal.benutzerId) return true;

  // 3) Danach die Sichtbarkeitsstufen, von weit nach eng.
  switch (envelope.sichtbarkeit) {
    case "oeffentlich":
      return true;
    case "gruppe":
      return (envelope.erlaubteGruppen ?? []).some((g) =>
        principal.gruppen.includes(g),
      );
    case "privat":
      // Der Besitzer ist oben schon durch. Bleibt: niemand.
      return false;
    default:
      // Eine unbekannte Sichtbarkeit ist kein Grund, großzügig zu sein.
      // `pruefeEnvelope` lässt sie beim Ingest nicht durch; käme sie doch
      // hierher, wäre der Speicher beschädigt — und dann ist „nichts" richtig.
      return false;
  }
}

// Kompiliert den Filter für einen Principal zu einem Prädikat.
//
// Rückgabe `null` heißt: NICHT AUFLÖSBAR, also nicht suchen. Bewusst kein
// Prädikat, das immer `false` liefert — der Aufrufer soll den Unterschied
// zwischen „darf nichts sehen" und „ist gar nicht auflösbar" sehen und
// unterscheidbar protokollieren können. ADR-0008 nennt genau das als
// eingehandelten Preis: fail-closed sieht aus wie ein Angriff, und wer den
// Unterschied nicht loggt, sucht stundenlang den falschen Fehler.
export function kompiliereFilter(principal) {
  if (!istPrincipalAufloesbar(principal)) return null;
  return (envelope) => darfSehen(principal, envelope);
}
