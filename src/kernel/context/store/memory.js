// ── kernel/context/store/memory.js ───────────────────────────────────────
// Der `memory`-Adapter. Er trägt Mock-Modus, CI und K5 allein (ADR-0006):
// `npm run demo` und `npm run evals` laufen ohne jede Infrastruktur.
//
// ER IST KEIN SPIELZEUG. Er muss die Semantik des späteren Postgres-Adapters
// NACHBILDEN, sonst wandert jeder Unterschied als stille Verhaltensänderung
// nach Etappe 3 — wo dieselbe Eval-Suite gegen pgvector laufen soll.
//
// Die eine Stelle, an der das wehtut, ist der Filter: bequem wäre, alles zu
// durchsuchen und danach zu filtern. Das würde 3.13 grün melden und ADR-0008
// trotzdem verletzen — die Zahl wäre dann eine Aussage über den Adapter statt
// über den Entwurf. Deshalb liegt `praedikat(chunk.envelope)` HIER, in der
// Schleife, vor jeder Ähnlichkeitsrechnung: der Chunk wird nicht bewertet,
// wenn er nicht gesehen werden darf. Das ist die Übersetzung von „in die
// Abfrage kompiliert" in einen Speicher, der keine Abfragesprache hat.

import { terme } from "../embedding/index.js";

const skalarprodukt = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

// Absatzreihenfolge innerhalb eines Dokuments. `chunkId` ist
// `<dokumentId>#<i>`; nach Zeichen sortiert stünde `#10` vor `#2`, und der
// gezielte Abruf gäbe den Text eines Dokuments verdreht zurück. Der
// Postgres-Adapter sortiert dieselbe Zahl mit `split_part(chunk_id, '#', 2)::int`
// — nicht lexikalisch, sonst wäre die Reihenfolge ab dem zehnten Absatz eine
// andere als hier, und genau solche stillen Unterschiede zwischen zwei
// Adaptern misst dieses Repo.
const nachAbsatz = (a, b) =>
  Number(a.split("#").pop()) - Number(b.split("#").pop());

export function createMemoryAdapter({ embedding } = {}) {
  let chunks = [];

  return {
    name: "memory",

    schreibe(neue) {
      for (const c of neue) chunks.push(c);
      return neue.length;
    },

    // ── Atomarer Ersatz einer Quelle (ADR-0011). ────────────────────────
    // Die neue Liste wird ERST vollständig gebaut und DANN in einem einzigen
    // Schritt zugewiesen. Es gibt keinen Augenblick, in dem der Speicher
    // weder die alte noch die neue Momentaufnahme trägt — und damit keinen,
    // in dem eine gleichzeitige Suche zu wenig fände.
    //
    // Im Arbeitsspeicher ist das geschenkt, weil die Zuweisung nicht
    // unterbrochen wird. Der Postgres-Adapter (Etappe 3c) bekommt es NICHT
    // geschenkt: er muss dieselbe Eigenschaft ausdrücklich mit einer
    // Transaktion herstellen. Diese Zeile ist die Stelle, an der das steht,
    // damit es dort nicht übersehen wird.
    ersetzeQuelle(quelle, neue) {
      const fremde = chunks.filter((c) => c.envelope.quelle !== quelle);
      const entfernt = chunks.length - fremde.length;
      chunks = fremde.concat(neue);
      return { entfernt, geschrieben: neue.length };
    },

    zaehle: () => chunks.length,
    leere: () => {
      chunks = [];
    },

    // ── Hybride Suche: Vektor UND Stichwort. ────────────────────────────
    // ADR-0008 verlangt ausdrücklich, dass BEIDE Pfade filtern. Der klassische
    // Fehler ist, den Vektorpfad zu filtern, den Stichwortpfad zu vergessen
    // und die Vereinigung zurückzugeben — dann ist das Ergebnis ungefiltert,
    // obwohl an einer Stelle sichtbar gefiltert wurde.
    //
    // Hier ist das strukturell ausgeschlossen: es gibt EINE Schleife über die
    // Chunks, das Prädikat steht an ihrem Anfang, und beide Bewertungen
    // entstehen erst danach. Ein Chunk, der nicht gesehen werden darf, wird
    // von keinem der beiden Pfade je berührt.
    async suche({ praedikat, anfrage, k, dokumentId = null }) {
      // ── Die gezielte Kippe (ADR-0019, T1) ─────────────────────────────
      // Derselbe Filter, an derselben Stelle — nur wird danach nicht bewertet,
      // sondern nach Absatz geordnet. Kein Einbettungsaufruf: es gibt keine
      // Frage, und ein Vektor, den niemand vergleicht, kostet nur Geld.
      if (dokumentId) {
        return chunks
          .filter(
            (c) =>
              praedikat(c.envelope) && c.envelope.dokumentId === dokumentId,
          )
          .sort((a, b) => nachAbsatz(a.chunkId, b.chunkId))
          .map((chunk) => ({
            chunkId: chunk.chunkId,
            dokumentId: chunk.envelope.dokumentId,
            text: chunk.text,
            envelope: chunk.envelope,
            // `null` und nicht 0: hier wurde nichts bewertet. Eine 0 wäre die
            // Behauptung „ohne Relevanz", und die ist etwas anderes als
            // „ungemessen" — derselbe Unterschied wie bei den Metriken.
            wert: null,
          }));
      }

      // `"anfrage"` und nicht `"dokument"`: ein echtes Retrieval-Modell bettet
      // die Frage anders ein als den Text, den sie finden soll (ADR-0015).
      const frageVektor = await embedding.einbette(anfrage, "anfrage");
      const frageTerme = new Set(terme(anfrage));
      const bewertet = [];

      for (const chunk of chunks) {
        // DER FILTER. Vor jeder Rechnung, für beide Pfade zugleich.
        if (!praedikat(chunk.envelope)) continue;

        const vektorWert = skalarprodukt(frageVektor, chunk.vektor);

        // Lexikalischer Pfad: Anteil der Frageterme, die im Chunk vorkommen.
        // Bewusst simpel — er soll zeigen, DASS ein zweiter Pfad existiert und
        // mitgefiltert wird, nicht BM25 nachbauen.
        let getroffen = 0;
        for (const t of frageTerme) if (chunk.terme.has(t)) getroffen++;
        const lexWert = frageTerme.size === 0 ? 0 : getroffen / frageTerme.size;

        // Gleichgewichtete Vereinigung. Die Gewichtung ist im Mock ohne
        // fachliche Bedeutung (ADR-0007: der Vektor kommt aus einem Hash) —
        // sie steht hier, damit die Form der Berechnung dieselbe ist wie
        // später, nicht weil die Zahl etwas aussagt.
        const wert = 0.5 * vektorWert + 0.5 * lexWert;
        if (wert > 0) bewertet.push({ chunk, wert });
      }

      // Stabile Reihenfolge: bei gleichem Wert entscheidet die Chunk-Id.
      // Ohne das wäre die Trefferfolge von der Einfügereihenfolge abhängig und
      // der Determinismus-Nachweis der Schicht A wäre keiner mehr.
      bewertet.sort((a, b) =>
        b.wert !== a.wert
          ? b.wert - a.wert
          : a.chunk.chunkId < b.chunk.chunkId
            ? -1
            : 1,
      );

      return bewertet.slice(0, k).map(({ chunk, wert }) => ({
        chunkId: chunk.chunkId,
        dokumentId: chunk.envelope.dokumentId,
        text: chunk.text,
        envelope: chunk.envelope,
        wert,
      }));
    },
  };
}
