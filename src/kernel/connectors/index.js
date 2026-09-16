// ── kernel/connectors/index.js ───────────────────────────────────────────
// EBENE ① — DER PORT EINES CONNECTORS. Er beschreibt, was eine Quelle können
// muss, damit dieses System aus ihr aufnehmen darf. Er weiß nicht, WELCHE
// Quellen es gibt: kein Notizenlaufwerk, kein Ticketsystem, keine Domäne.
//
// Bis zum 2026-09-10 war dieses Verzeichnis absichtlich leer (ADR-0005): der
// Kontext-Motor beginnt bei einem Dokument, das seine Envelope schon trägt.
// Genau deshalb kam Etappe 2 ohne Vertikale aus. Hier ist die Stelle, an der
// die Envelope ENTSTEHT — und damit die Stelle, an der ein
// Berechtigungsmodell aus der Fremdwelt in das eigene übersetzt wird.
//
// DIE EINE ZUSAGE DIESER EBENE: was ein Connector liefert, ist eine
// VOLLSTÄNDIGE MOMENTAUFNAHME dessen, was die Quelle gerade freigibt — nicht
// eine Liste von Änderungen (ADR-0011). Die Begründung in einem Satz: bei
// einem Delta hängt der Entzug an der Korrektheit des Deltas, und ein Entzug
// ist genau das, was Quellen am liebsten verschweigen.
//
// WO DIE ARBEIT WIRKLICH LIEGT. Nicht hier. Ein Connector ist zu 10 % Holen
// und zu 90 % Berechtigungserfassung: Vererbungsketten auflösen, Ausnahmen
// abbilden, Mitgliedschaften einlesen. Das ist Bedeutung und liegt deshalb in
// `src/domains/<domäne>/`. Diese Datei prüft nur, dass das Ergebnis die Form
// hat, auf die sich der Rest des Systems verlässt.

// `quelle` ist die Kennung, unter der die Chunks dieser Quelle im Speicher
// liegen. Sie ist der Namensraum, den `ersetzeQuelle` austauscht — und
// deshalb kein Schmuck, sondern die Grenze einer Synchronisation.
const PFLICHTFELDER = ["quelle", "hole"];

export function createConnector(adapter) {
  if (typeof adapter?.quelle !== "string" || adapter.quelle === "") {
    throw new Error("createConnector: der Adapter nennt keine Quelle.");
  }
  for (const feld of PFLICHTFELDER) {
    if (adapter[feld] === undefined) {
      throw new Error(
        `createConnector: der Adapter der Quelle "${adapter.quelle}" liefert kein Feld "${feld}".`,
      );
    }
  }
  if (typeof adapter.hole !== "function") {
    throw new Error(
      `createConnector: "hole" der Quelle "${adapter.quelle}" ist keine Funktion.`,
    );
  }

  return {
    quelle: adapter.quelle,

    // Die Momentaufnahme. Jedes Element ist `{ envelope, text }` — die
    // Envelope ist also schon erfasst, wenn ein Dokument diese Ebene verlässt.
    //
    // Die Etikettenprüfung steht hier und nicht in der Synchronisation, weil
    // sie eine Eigenschaft des CONNECTORS ist und nicht eine des Ablaufs: ein
    // Connector, der Dokumente mit fremder Quelle etikettiert, könnte über
    // `ersetzeQuelle` die Momentaufnahme einer anderen Quelle austauschen.
    // Das ist kein Formfehler, das ist ein Angriffsweg — er muss dort
    // scheitern, wo er entsteht.
    hole() {
      const dokumente = adapter.hole();
      if (!Array.isArray(dokumente)) {
        throw new Error(
          `Connector "${adapter.quelle}": hole() liefert keine Liste.`,
        );
      }
      for (const dok of dokumente) {
        if (dok?.envelope?.quelle !== adapter.quelle) {
          throw new Error(
            `Connector "${adapter.quelle}": Dokument "${dok?.envelope?.dokumentId}" ist mit der Quelle "${dok?.envelope?.quelle}" etikettiert.`,
          );
        }
      }
      return dokumente;
    },
  };
}
