// ── kernel/governance/identitaet/fixtures.js ─────────────────────────────
// DER ADAPTER, DER SCHICHT A UND K5 TRÄGT. Kein Netz, kein Schlüssel, kein
// Zufall: ein Verzeichnis als Tabelle. Dieselbe Rolle wie `memory` beim Store
// (ADR-0013) und `hash` beim Embedding (ADR-0015) — die Voreinstellung, unter
// der `clone → install → demo` ohne Infrastruktur durchläuft.
//
// WARUM HIER NOCH KEIN ECHTER ANBIETER STEHT. Die Lektion des Voyage-Adapters
// (ADR-0015, offenes Thema seit dem 2026-09-11): ein Adapter, der nie gegen
// den echten Dienst gelaufen ist, ist gebaut und nicht gemessen — und bis zum
// ersten echten Lauf ist jede Aussage über ihn eine Vorhersage. Ein
// OIDC-Adapter ohne erreichbaren Anbieter wäre dieselbe Schuld ein zweites
// Mal. Er kommt, wenn es etwas gibt, wogegen er laufen kann (Etappe 7 und 11).
//
// Der Port verlangt nichts weiter als `aufloese` und `name`; dass hier ein
// Objekt und dort ein Netzaufruf steht, sieht der Aufrufer nicht. Genau das
// ist der Zweck der Naht.

import { istPrincipalAufloesbar } from "../../context/envelope.js";

// `verzeichnis` bildet Nachweis → Principal ab. Der Nachweis ist hier eine
// undurchsichtige Zeichenkette; was ein echter Anbieter damit tut (Token
// prüfen, Signatur rechnen, Sitzung nachschlagen), geht den Port nichts an.
export function createFixturesAufloeser({ verzeichnis = {} } = {}) {
  // Die Form wird beim BAU geprüft, nicht bei der Auflösung. Ein Fixture mit
  // fehlendem Mandanten würde sonst erst im Lauf auffallen und dort aussehen
  // wie eine abgelehnte Identität — ein Datenfehler, als Sicherheitsereignis
  // verkleidet.
  for (const [nachweis, principal] of Object.entries(verzeichnis)) {
    if (!istPrincipalAufloesbar(principal)) {
      throw new Error(
        `Fixtures-Verzeichnis: der Eintrag "${nachweis}" ist kein auflösbarer ` +
          "Principal (tenantId, benutzerId, gruppen[] erforderlich).",
      );
    }
  }

  return {
    name: "fixtures",
    // Async, obwohl eine Tabelle synchron antworten könnte: ein Verzeichnis
    // hinter einem Netz kann es nicht, und der Port darf nicht die billigere
    // der beiden Welten abbilden. Dieselbe Begründung wie beim Store-Port in
    // Etappe 3c — die Umstellung kam dort VOR dem zweiten Adapter.
    async aufloese(nachweis) {
      return verzeichnis[nachweis] ?? null;
    },
  };
}
