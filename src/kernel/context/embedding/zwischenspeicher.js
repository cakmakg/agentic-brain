// ── kernel/context/embedding/zwischenspeicher.js ─────────────────────────
// Ein Zwischenspeicher fuer Vektoren, der VOR einem Adapter sitzt (ADR-0016).
//
// WARUM ES IHN GIBT. ADR-0011 laesst einen Connector je Zyklus eine
// vollstaendige Momentaufnahme liefern und die ganze Quelle atomar ersetzen.
// Mit dem Hash kostet das nichts. Mit einem echten Modell kostet jeder Zyklus
// Geld — auch fuer Text, der sich seit dem letzten Zyklus nicht bewegt hat.
//
// Der naheliegende Ausweg waere ein Delta-Sync. Er ist verworfen, und zwar
// weil er das Falsche billiger macht: die Entzugszusage haengt danach an der
// Korrektheit eines Deltas statt an der Struktur (ADR-0011). Teuer ist nicht
// der Ersatz — der ist eine Speicheroperation —, teuer ist der
// Einbettungsaufruf. Also wird genau der gespart.
//
// WARUM DAS SICHER IST, UND ZWAR GENAU HIER. Ein Vektor ist eine reine
// Funktion des Textes. Er traegt KEINE Berechtigung: die steht in der
// Envelope, und die kommt in jedem Zyklus frisch aus der Momentaufnahme.
// Einen Vektor wiederzuverwenden heisst also, eine Rechnung nicht zweimal zu
// bezahlen — ein Dokument wiederzuverwenden hiesse, eine alte Berechtigung zu
// behalten. Das eine ist erlaubt, das andere ist der Leckvektor. Der
// Unterschied ist der ganze Inhalt von ADR-0016.
//
// ER AENDERT KEINE EINZIGE ZAHL. Fuer einen deterministischen Adapter ist der
// zwischengespeicherte Vektor derselbe wie der gerechnete. Die gesamte
// Schicht-A-Messung muss deshalb mit und ohne Zwischenspeicher identisch
// bleiben — dasselbe Tor wie beim asynchronen Store-Port in 3c-1.

import { env } from "../../config/env.js";

// ── Der Schluessel ───────────────────────────────────────────────────────
// Er besteht aus ART und TEXT. Beides ist noetig:
//
//   Die ART, weil ein echtes Retrieval-Modell asymmetrisch ist. Dieselbe
//   Zeichenkette ergibt als `anfrage` einen anderen Vektor als als
//   `dokument` (Voyage: `input_type`). Faellt die Art aus dem Schluessel,
//   liefert der Zwischenspeicher der Frage den Dokumentvektor — und das
//   Retrieval sucht in einem Raum, fuer den das Modell nicht trainiert
//   wurde. Es saehe aus wie schlechte Suchqualitaet, nicht wie ein Defekt.
//
//   Der ADAPTERNAME steht bewusst NICHT darin: ein Zwischenspeicher gehoert
//   genau einem Adapter, weil `mitZwischenspeicher` je Adapterinstanz einen
//   eigenen anlegt. Zwei Adapter teilen keine Map, also koennen sie sich
//   auch nicht ueberschreiben.
//
// KEIN HASH ueber den Text. Ein Hash koennte kollidieren, und eine Kollision
// hiesse: ein Chunk traegt den Vektor eines anderen. Genau den Ausfall faengt
// der Port an anderer Stelle ab (Anzahl, Breite), und hier waere er wieder
// hereingekommen — durch die Hintertuer der Ersparnis. Chunks sind auf
// CHUNK_LAENGE begrenzt; der Text selbst ist als Schluessel bezahlbar.
//
// Getrennt wird mit dem Nullbyte, weil es in keinem der beiden Artnamen
// vorkommt und in Text praktisch nie. Ein Bindestrich koennte am Wortanfang
// stehen und zwei verschiedene Paare auf denselben Schluessel legen.
const TRENNER = "\u0000";
const schluesselVon = (art, text) => `${art}${TRENNER}${text}`;

// ── Ein Stapel wird zerlegt, bevor er gefragt wird ───────────────────────
// Eigene Funktion, weil das Zerlegen und das Fragen zwei Schritte sind und
// nur der zweite Geld kostet. Sie liefert drei Dinge:
//
//   `ergebnis` — schon gefuellt an allen Positionen, die der Speicher kannte
//   `fehlend`  — die Texte, die der Adapter sehen muss, ohne Duplikate
//   `ziele`    — je Schluessel ALLE Positionen, an die seine Antwort gehoert
//
// `ziele` ist der Grund, warum ein zweimal vorkommender Text im selben Stapel
// einmal gefragt und zweimal eingesetzt wird.
function zerlege(eintraege, texte, art, statistik) {
  const ergebnis = new Array(texte.length);
  const fehlend = [];
  const ziele = new Map();

  for (const [i, text] of texte.entries()) {
    const schluessel = schluesselVon(art, text);
    if (eintraege.has(schluessel)) {
      ergebnis[i] = eintraege.get(schluessel);
      statistik.treffer++;
      continue;
    }
    const bekannt = ziele.get(schluessel);
    if (bekannt) {
      bekannt.push(i);
      continue;
    }
    ziele.set(schluessel, [i]);
    fehlend.push(text);
  }

  return { ergebnis, fehlend, ziele };
}

export function mitZwischenspeicher(
  adapter,
  { max = env.embeddingCacheMax } = {},
) {
  // Eine Map haelt die Einfuegereihenfolge fest. Die Verdraengung ist deshalb
  // FIFO und braucht keine Buchfuehrung — ein LRU muesste bei JEDEM Treffer
  // schreiben. Fuer das Zugriffsmuster eines Ingest-Zyklus (ein Durchlauf
  // ueber dieselbe Menge) verhalten sich beide gleich.
  //
  // DIE GRENZE, WOERTLICH: ist die Arbeitsmenge groesser als `max`, ist jeder
  // Eintrag verdraengt, bevor er wiederverwendet wird — die Trefferquote
  // faellt dann auf null, nicht auf „etwas weniger". Wer eine grosse Quelle
  // faehrt, hebt `EMBEDDING_CACHE_MAX` oder zahlt jeden Zyklus voll.
  const eintraege = new Map();

  // Zwei Zahlen, und sie messen Verschiedenes. `treffer` ist, was der
  // Zwischenspeicher beantwortet hat; `gefragt` ist, was den Adapter
  // erreicht hat — und nur das kostet Geld. Die Differenz zur Textzahl sind
  // Duplikate innerhalb eines Stapels.
  const statistik = { treffer: 0, gefragt: 0, stapel: 0, verdraengt: 0 };

  function speichere(schluessel, vektor) {
    if (max <= 0) return;
    if (eintraege.size >= max) {
      eintraege.delete(eintraege.keys().next().value);
      statistik.verdraengt++;
    }
    eintraege.set(schluessel, vektor);
  }

  return {
    name: adapter.name,
    dimensionen: adapter.dimensionen,

    // Lesbar von aussen, damit das Tor dieser Etappe eine Zahl hat und keine
    // Behauptung: ein zweiter Zyklus ueber unveraenderte Dokumente darf
    // `gefragt` NICHT erhoehen.
    zwischenspeicher: {
      statistik: () => ({ ...statistik, eintraege: eintraege.size, max }),
      leere: () => {
        eintraege.clear();
      },
    },

    async einbetteViele(texte, art) {
      const { ergebnis, fehlend, ziele } = zerlege(
        eintraege,
        texte,
        art,
        statistik,
      );

      if (fehlend.length > 0) {
        statistik.stapel++;
        statistik.gefragt += fehlend.length;
        const neue = await adapter.einbetteViele(fehlend, art);

        // ── Die Pruefung MUSS hier stehen, nicht erst im Port. ──────────
        // Der Port vergleicht die Antwort mit dem, was IHM hineingegeben
        // wurde — das sind alle Texte, auch die aus dem Zwischenspeicher.
        // Liefert der Adapter auf die Teilmenge zu wenige Vektoren, waere
        // das Zusammensetzen schon verschoben, bevor der Port hinsieht,
        // und die Gesamtzahl staende trotzdem. Also hier, sofort.
        if (!Array.isArray(neue) || neue.length !== fehlend.length) {
          throw new Error(
            `Zwischenspeicher "${adapter.name}": ${fehlend.length} Texte nachgefragt, ${neue?.length} Vektoren zurueck.`,
          );
        }

        for (const [j, text] of fehlend.entries()) {
          const schluessel = schluesselVon(art, text);
          for (const i of ziele.get(schluessel)) ergebnis[i] = neue[j];
          speichere(schluessel, neue[j]);
        }
      }

      return ergebnis;
    },
  };
}
