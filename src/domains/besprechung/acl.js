// ── domains/besprechung/acl.js ───────────────────────────────────────────
// Das Berechtigungsmodell der Quelle, übersetzt in die Envelope des Kerns.
//
// HIER LIEGT DIE EIGENTLICHE ARBEIT EINES CONNECTORS. Holen ist ein
// Zehntel; das Neuntel ist diese Datei. Der Kern kennt ein allgemeines Modell
// — Mandant, Sichtbarkeit, Gruppen, Besitzer, Einzelfreigaben. Das
// Notizenlaufwerk kennt Ordner, Vererbung, geteilte Links und
// Teilnehmerlisten. Zwischen beiden steht genau ein Regelwerk, und es steht
// hier, in der Domäne, vollständig und an einer Stelle.
//
// REINE FUNKTIONEN, KEIN IO. Aus demselben Grund wie `kernel/retrieval/
// filter.js`: an dieser Datei hängt die wichtigste Zusage des Systems, also
// muss sie erschöpfend testbar sein.
//
// DAS REGELWERK — dieselben acht Regeln stehen im Datensatz
// `evals/domains/besprechung/golden/acl.json`, damit die Erwartungen dort aus
// REGELN abgeleitet werden und nicht aus einem beobachteten Lauf (EVALS.md §4).
// Weichen die beiden Listen voneinander ab, ist das ein Defekt, kein Stilfehler.
//
//   1. besitzerId = Organisator der Besprechung.
//   2. erlaubtePersonen = Teilnehmer der Besprechung ∪ Einzelfreigaben der
//      Notiz. Der Organisator wird ausgelassen — er ist schon Besitzer.
//   3. Ordnergruppen = sichtbarFuer des Ordners; erbt der Ordner, zusätzlich
//      die AUFGELÖSTEN Gruppen des Elternordners. Die Kette endet an der
//      Wurzel oder dort, wo die Vererbung gebrochen ist (erbt: false).
//   4. vertraulich: true → sichtbarkeit "privat", die Ordnergruppen werden
//      VERWORFEN. Eine vertrauliche Notiz in einem offenen Ordner bleibt
//      vertraulich.
//   5. sonst, enthalten die Ordnergruppen "*" → sichtbarkeit "oeffentlich".
//   6. sonst, sind Ordnergruppen da → "gruppe" mit genau diesen Gruppen.
//   7. sonst → "privat".
//   8. tenantId kommt aus der Quelle, nie aus dem Dokument.
//
// Die Reihenfolge von 4 vor 5 ist die einzige Stelle, an der dieses Regelwerk
// eine echte Entscheidung trifft, und sie geht in die restriktive Richtung.
// Andersherum gelesen wäre sie ein Leck mit Ansage.

// Der organisationsweite geteilte Link. Ein echtes Laufwerk kennt ihn als
// „jeder in der Organisation, der den Link hat"; im Modell ist er ein Eintrag
// in `sichtbarFuer` und keine Sonderfahne — sonst gäbe es zwei Wege, dasselbe
// zu sagen.
export const ORGANISATIONSWEIT = "*";

// ── Regel 3: die Vererbungskette auflösen ────────────────────────────────
// Ein Join, und deshalb die Stelle, an der ein Connector schweigend falsch
// liest. Zwei Fehler sind hier üblich und beide sind hier ausgeschlossen:
// die Kette nicht bis zum Ende zu laufen (zu wenig), und eine gebrochene
// Vererbung zu übersehen (zu viel).
//
// Der Zyklusschutz wirft, statt abzubrechen. Ein Ordnerbaum mit einem Zyklus
// ist eine kaputte Quelle; still das halb gelaufene Ergebnis zu nehmen hieße,
// eine Berechtigung zu erfinden.
export function loeseOrdnerAuf(ordner, ordnerId) {
  const nachId = new Map(ordner.map((o) => [o.ordnerId, o]));
  const gruppen = new Set();
  const gesehen = new Set();

  let aktuell = nachId.get(ordnerId);
  if (!aktuell) {
    throw new Error(`acl: Ordner "${ordnerId}" existiert in der Quelle nicht.`);
  }

  while (aktuell) {
    if (gesehen.has(aktuell.ordnerId)) {
      throw new Error(
        `acl: Zyklus in der Ordnerkette bei "${aktuell.ordnerId}".`,
      );
    }
    gesehen.add(aktuell.ordnerId);

    for (const g of aktuell.sichtbarFuer ?? []) gruppen.add(g);

    // Gebrochene Vererbung beendet die Kette — der Elternteil zählt dann
    // NICHT mehr. Das ist der Mechanismus, mit dem ein „Finanz"-Ordner in
    // einem für alle offenen Laufwerk überhaupt eng sein kann.
    if (aktuell.erbt === false) break;

    aktuell = aktuell.elternId ? nachId.get(aktuell.elternId) : null;
  }

  return [...gruppen];
}

// ── Regel 1, 2 und 4 bis 8: eine Notiz zu einer Envelope ─────────────────
// Gibt NUR die Envelope zurück, nicht den Text. Wer beides zusammen braucht,
// ruft den Connector — diese Funktion soll für sich prüfbar bleiben.
export function envelopeFuerNotiz(quelle, notiz) {
  const besprechung = (quelle.besprechungen ?? []).find(
    (b) => b.besprechungId === notiz.besprechungId,
  );
  if (!besprechung) {
    throw new Error(
      `acl: Notiz "${notiz.notizId}" verweist auf die unbekannte Besprechung "${notiz.besprechungId}".`,
    );
  }

  // Regel 1.
  const besitzerId = besprechung.organisatorId;

  // Regel 2. Die Menge entdoppelt, der Besitzer fällt heraus: ein Besitzer,
  // der zusätzlich in `erlaubtePersonen` steht, wäre dieselbe Aussage zweimal
  // — und beim Entzug müsste man dann an zwei Stellen denken.
  const personen = new Set([
    ...(besprechung.teilnehmer ?? []),
    ...(notiz.freigegebenAn ?? []),
  ]);
  personen.delete(besitzerId);

  // Regel 3.
  const ordnergruppen = loeseOrdnerAuf(quelle.ordner ?? [], notiz.ordnerId);

  // Regeln 4 bis 7, in genau dieser Reihenfolge.
  let sichtbarkeit;
  let erlaubteGruppen = [];
  if (notiz.vertraulich) {
    sichtbarkeit = "privat";
  } else if (ordnergruppen.includes(ORGANISATIONSWEIT)) {
    sichtbarkeit = "oeffentlich";
  } else if (ordnergruppen.length > 0) {
    sichtbarkeit = "gruppe";
    erlaubteGruppen = ordnergruppen;
  } else {
    sichtbarkeit = "privat";
  }

  return {
    // Regel 8.
    tenantId: quelle.tenantId,
    quelle: quelle.quelle,
    dokumentId: notiz.notizId,
    sichtbarkeit,
    erlaubteGruppen,
    erlaubtePersonen: [...personen],
    besitzerId,
  };
}
