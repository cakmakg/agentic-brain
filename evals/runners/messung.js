// ── evals/runners/messung.js ─────────────────────────────────────────────
// Die Messschleife der Schicht B, herausgelöst aus `quality.js`.
//
// WARUM EINE EIGENE DATEI. `quality.js` ist ein Skript: es liest Argumente,
// ruft ein echtes Modell und beendet den Prozess. Nichts davon lässt sich
// prüfen, ohne Geld auszugeben — und ein Messinstrument, von dem niemand
// zeigen kann, dass es überhaupt etwas anderes als „nicht messbar" ausgeben
// kann, ist kein Instrument, sondern eine Behauptung.
//
// Hier steht deshalb nur die Schleife, mit zwei injizierten Abhängigkeiten:
// `schreibe`/`pruefe` (in `quality.js` das echte Modell, im Test ein Skript)
// und `verbrauch` (die laufenden Kosten). Damit ist der ganze Ablauf —
// Erstversuch, Revisionsschleife, Fehlerfall, Ausgabengrenze — deterministisch
// und kostenlos prüfbar. Was NICHT prüfbar bleibt, ist die einzige Frage, für
// die Schicht B existiert: was ein echtes Modell schreibt.

/**
 * Fährt alle Fälle × Varianten und liefert je Entwurf einen Datensatz.
 *
 * @param {object} o
 * @param {object} o.schichtB       `schreibe(gegenstand, variante, feedback)`, `pruefe(text, gegenstand)`, `maxVersuche`
 * @param {Array}  o.faelle         `{ id, gegenstand }`
 * @param {Array}  o.varianten      z. B. die Zielportale
 * @param {number} o.maxUsd         Ausgabengrenze
 * @param {Function} o.verbrauch    `() => number` — die bisher aufgelaufenen Kosten
 * @param {Function} [o.melde]      `(eintrag) => void` — Fortschritt, rein zur Anzeige
 */
export async function messeEntwuerfe({
  schichtB,
  faelle,
  varianten,
  maxUsd,
  verbrauch,
  melde = () => {},
}) {
  const entwuerfe = [];
  let abgebrochen = null;

  for (const fall of faelle) {
    for (const variante of varianten) {
      // Die Grenze wird VOR dem Aufruf geprüft, nicht danach: eine Grenze,
      // die erst nach dem Ausgeben greift, ist keine.
      if (verbrauch() >= maxUsd) {
        abgebrochen = `Ausgabengrenze erreicht (${verbrauch().toFixed(4)} USD ≥ ${maxUsd.toFixed(2)})`;
        break;
      }

      const eintrag = {
        id: fall.id,
        variante,
        text: null,
        versuche: 0,
        konformImErstenVersuch: false,
        konformAmEnde: false,
        gruendeErsterVersuch: "",
        fehler: null,
      };

      try {
        // ── Versuch 1: DAS ist die gemessene Zahl ────────────────────────
        let text = await schichtB.schreibe(fall.gegenstand, variante, "");
        eintrag.versuche = 1;
        eintrag.text = text;

        let urteil = schichtB.pruefe(text, fall.gegenstand);
        eintrag.konformImErstenVersuch = urteil.konform;
        eintrag.gruendeErsterVersuch = urteil.gruende;
        eintrag.konformAmEnde = urteil.konform;

        // ── Die Revisionsschleife, wie BREMSE6b sie fährt ────────────────
        // Eigene Zahl, nicht die gemessene: sie sagt, ob das Feedback des
        // Tors den Writer tatsächlich auf den Vertrag zieht.
        while (
          !urteil.konform &&
          eintrag.versuche < schichtB.maxVersuche &&
          verbrauch() < maxUsd
        ) {
          text = await schichtB.schreibe(
            fall.gegenstand,
            variante,
            urteil.gruende,
          );
          eintrag.versuche += 1;
          eintrag.text = text;
          urteil = schichtB.pruefe(text, fall.gegenstand);
          eintrag.konformAmEnde = urteil.konform;
        }
      } catch (e) {
        // Ein Netz- oder Modellfehler beendet nicht den ganzen Lauf: was
        // bereits gemessen wurde, ist bezahlt und gehört in den Bericht.
        eintrag.fehler = e.message;
      }

      entwuerfe.push(eintrag);
      melde(eintrag);
    }
    if (abgebrochen) break;
  }

  return { entwuerfe, abgebrochen };
}
