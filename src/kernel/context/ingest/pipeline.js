// ── kernel/context/ingest/pipeline.js ────────────────────────────────────
// Nimmt ein bereits geholtes Dokument samt Envelope und macht Chunks daraus.
//
// ABGRENZUNG (ADR-0005): Diese Datei holt NICHTS. Aus einer Quelle holen und
// deren Berechtigungsmodell erfassen ist Ebene ① `connectors/` und kommt in
// Etappe 3. Hier beginnt alles mit einem Dokument, das seine Envelope schon
// trägt. Das ist der Grund, warum Etappe 2 ohne Vertikale auskommt.
//
// Die eigentliche Zusage dieser Datei ist eine Zeile lang: JEDER Chunk bekommt
// `erbeEnvelope(...)`. Es gibt keinen Pfad, auf dem ein Chunk ohne Envelope
// entsteht — `pruefeEnvelope` wirft, bevor der erste Chunk gebaut wird.

import { erbeEnvelope, pruefeEnvelope } from "../envelope.js";
import { einbetten, terme } from "../embedding.js";

// Zeichen je Chunk. Klein gehalten, damit ein Testdokument mehrere Chunks
// ergibt — sonst prüfte „die Envelope wird vererbt" nie mehr als einen Fall.
export const CHUNK_LAENGE = 280;

// Zerlegung an Absätzen, dann harte Kappung. Bewusst schlicht: gute Chunking-
// Strategien hängen an der Domäne und am Modell; beides ist hier nicht die
// Frage. Was hier zählt, ist, dass die Envelope jeden Chunk erreicht.
export function teile(text, laenge = CHUNK_LAENGE) {
  const stuecke = [];
  for (const absatz of String(text ?? "")
    .split(/\n\s*\n/)
    .map((a) => a.trim())
    .filter(Boolean)) {
    for (let i = 0; i < absatz.length; i += laenge) {
      stuecke.push(absatz.slice(i, i + laenge));
    }
  }
  return stuecke;
}

// Ein Dokument → Chunks, jeder mit geerbter Envelope, Vektor und Termmenge.
//
// `chunkId` wird aus Dokument-Id und Position gebildet und ist damit
// deterministisch: derselbe Ingest ergibt dieselben Ids. Ohne das wäre die
// stabile Trefferreihenfolge im Adapter nicht stabil, und der
// Determinismus-Nachweis der Schicht A fiele.
export function verarbeiteDokument({ envelope, text }) {
  pruefeEnvelope(envelope);

  return teile(text).map((stueck, i) => ({
    chunkId: `${envelope.dokumentId}#${i}`,
    text: stueck,
    // DIE VERERBUNG. Eine eigene Funktion, damit sie ein benannter Schritt ist
    // und nicht als Spread irgendwo verschwindet (ADR-0009).
    envelope: erbeEnvelope(envelope),
    vektor: einbetten(stueck),
    terme: new Set(terme(stueck)),
  }));
}

// Mehrere Dokumente in einen Speicher. Der Speicher ist ein Port; welcher
// Adapter dahinter liegt, weiß diese Datei nicht.
export function ingestiere(store, dokumente) {
  let n = 0;
  for (const dok of dokumente) {
    const chunks = verarbeiteDokument(dok);
    store.schreibe(chunks);
    n += chunks.length;
  }
  return n;
}
