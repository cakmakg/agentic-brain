// ── domains/besprechung/connectors/notizlaufwerk.js ──────────────────────
// Der erste Connector des Repos (ADR-0010): ein geteiltes Notizenlaufwerk.
// Er füllt Ebene ① und ist die Stelle, an der ein fremdes
// Berechtigungsmodell in das eigene übersetzt wird — über `acl.js`, das die
// Regeln trägt, damit sie prüfbar bleiben.
//
// WARUM DIE QUELLE HIER EIN OBJEKT IST UND KEIN NETZZUGRIFF. Schicht A ist
// deterministisch, kostenlos und läuft in CI ohne Infrastruktur (K5). Ein
// Connector, der ein Netz braucht, nimmt `npm run evals` alle drei
// Eigenschaften auf einmal. Diese Datei nimmt die Momentaufnahme deshalb als
// Datenstruktur entgegen; wo sie herkommt — HTTP, Dateisystem, SDK — ist die
// Frage eines späteren Adapters und ändert an der Übersetzung keine Zeile.
// Was diese Etappe damit NICHT zeigt, ist das Aushandeln eines echten
// Protokolls. Was sie zeigt, ist die Übersetzung und die Ausbreitung eines
// Entzugs — und das ist die Zusage, um die es geht.
//
// DIE ÄNDERUNGSSCHNITTSTELLE IST NICHT TEIL DES CONNECTORS. `aendere` liegt
// bewusst NEBEN dem Connector und nicht in ihm: ein Connector liest eine
// Quelle, er verändert sie nie. Sie existiert, damit ein Entzug in der Quelle
// überhaupt herbeigeführt und die Ausbreitung dann gemessen werden kann —
// eine Quelle, die sich nie ändert, kann keinen Entzug belegen.

import { createConnector } from "../../../kernel/connectors/index.js";
import { envelopeFuerNotiz } from "../acl.js";

// ── Die Änderungen, die eine Quelle an einer Berechtigung vornehmen kann ──
// Je Art eine kleine benannte Funktion, nicht ein Zweig in einem grossen
// switch: so ist jede für sich lesbar, und die Liste der erlaubten Arten
// entsteht aus den Schlüsseln statt ein zweites Mal geschrieben zu werden.
//
// JEDE ÄNDERUNG, DIE NICHTS ÄNDERT, WIRFT. Das ist der wichtigste Zug dieser
// Datei: ein Entzugsfall, der gar keinen Entzug ausgelöst hat, meldet sonst
// fröhlich 0 % und hat nichts geprüft.

function finde(quelle, liste, feld, wert, was) {
  const treffer = quelle[liste]?.find((e) => e[feld] === wert);
  if (!treffer) {
    throw new Error(`notizlaufwerk: ${was} "${wert}" gibt es nicht.`);
  }
  return treffer;
}

// Entfernt `wert` aus `traeger[feld]` und wirft, wenn er gar nicht drin war.
function entferneAus(traeger, feld, wert, klage) {
  const vorher = (traeger[feld] ?? []).length;
  traeger[feld] = (traeger[feld] ?? []).filter((e) => e !== wert);
  if (traeger[feld].length === vorher) {
    throw new Error(`notizlaufwerk: ${klage} — der Fall belegt nichts.`);
  }
}

const AENDERUNGEN = {
  "teilnehmer-entfernen": (quelle, a) =>
    entferneAus(
      finde(
        quelle,
        "besprechungen",
        "besprechungId",
        a.besprechungId,
        "Besprechung",
      ),
      "teilnehmer",
      a.personId,
      `"${a.personId}" war kein Teilnehmer von "${a.besprechungId}"`,
    ),

  "freigabe-entziehen": (quelle, a) =>
    entferneAus(
      finde(quelle, "notizen", "notizId", a.notizId, "Notiz"),
      "freigegebenAn",
      a.personId,
      `"${a.personId}" hatte keine Freigabe auf "${a.notizId}"`,
    ),

  "ordnergruppe-entziehen": (quelle, a) =>
    entferneAus(
      finde(quelle, "ordner", "ordnerId", a.ordnerId, "Ordner"),
      "sichtbarFuer",
      a.gruppe,
      `Ordner "${a.ordnerId}" war nicht für "${a.gruppe}" sichtbar`,
    ),

  "notiz-loeschen": (quelle, a) => {
    finde(quelle, "notizen", "notizId", a.notizId, "Notiz");
    quelle.notizen = quelle.notizen.filter((n) => n.notizId !== a.notizId);
  },

  "vererbung-brechen": (quelle, a) => {
    const o = finde(quelle, "ordner", "ordnerId", a.ordnerId, "Ordner");
    if (o.erbt === false) {
      throw new Error(
        `notizlaufwerk: Ordner "${a.ordnerId}" erbte ohnehin nicht — der Fall belegt nichts.`,
      );
    }
    o.erbt = false;
  },
};

export const AENDERUNGSARTEN = Object.keys(AENDERUNGEN);

export function createNotizlaufwerk(rohquelle) {
  // Eigene Kopie. Zwei Läufe über dieselben Fixtures dürfen sich nicht
  // gegenseitig sehen, sonst misst der zweite Durchgang gealterten Zustand
  // statt derselben Frage — dieselbe Begründung wie beim frischen
  // Zustandsverzeichnis des Harness.
  const quelle = structuredClone(rohquelle);

  const connector = createConnector({
    quelle: quelle.quelle,

    // Die vollständige Momentaufnahme (ADR-0011): jede Notiz, die die Quelle
    // gerade führt, mit der Envelope, die sich JETZT aus ihrem Modell ergibt.
    // Es gibt keinen zweiten Weg, der einzelne Notizen nachliefert.
    hole: () =>
      quelle.notizen.map((notiz) => ({
        envelope: envelopeFuerNotiz(quelle, notiz),
        // Titel und Text als zwei Absätze: die Zerlegung des Kerns trennt an
        // Absätzen, und ein Dokument mit mehreren Chunks ist der einzige
        // Fall, in dem „die Envelope erreicht JEDEN Chunk" wirklich geprüft
        // wird.
        text: `${notiz.titel}\n\n${notiz.text}`,
      })),
  });

  // Ein Entzug in der Quelle. Er ändert NUR die Quelle — der Speicher erfährt
  // davon erst beim nächsten Synchronisationszyklus. Genau diese Lücke misst
  // Metrik 3.14.
  function aendere(anweisung) {
    const handler = AENDERUNGEN[anweisung?.art];
    if (!handler) {
      throw new Error(
        `notizlaufwerk: unbekannte Änderungsart "${anweisung?.art}" (bekannt: ${AENDERUNGSARTEN.join(", ")}).`,
      );
    }
    handler(quelle, anweisung);
  }

  // `lies` gibt die Quelle heraus, nicht den Speicher. Ausschliesslich für
  // Tests und den Harness: der Leseweg des Systems bleibt `store.suche`, und
  // es gibt keinen zweiten.
  return { connector, aendere, lies: () => structuredClone(quelle) };
}
