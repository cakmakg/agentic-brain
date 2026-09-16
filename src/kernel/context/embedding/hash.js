// ── kernel/context/embedding/hash.js ─────────────────────────────────────
// Das Embedding der Schicht A: ein Vektor aus dem Inhalts-Hash, kein
// Modellaufruf (ADR-0007). Voreinstellung, und Träger von K5 und CI.
//
// WARUM DAS KEINE ABKÜRZUNG IST. Schicht A misst nicht, ob die Einbettung gut
// ist, sondern ob kein unberechtigter Chunk zurückkommt. Für diese Frage
// entscheidet der Vektor nur die Reihenfolge der ERLAUBTEN Treffer — nicht, ob
// ein verbotener dabei ist. Ein echtes Modell würde die Messung teuer,
// schlüsselpflichtig und nichtdeterministisch machen und dafür nichts
// beitragen, was 3.13 misst.
//
// DIE GRENZE, WÖRTLICH: dieser Adapter kann NICHT zeigen, dass die Suche gute
// Treffer liefert. Er zeigt, dass sie keine verbotenen liefert. Ein Test, der
// sich auf „das relevanteste Dokument steht oben" stützt, misst den Hash.
//
// ER IST SYMMETRISCH und ignoriert deshalb `art`. Eine Frage und ein Dokument
// mit demselben Wortlaut ergeben denselben Vektor. Ein echtes
// Retrieval-Modell tut das nicht — und genau darin liegt der Unterschied, den
// Etappe 3d messbar macht.

import { terme } from "./index.js";

// 64 Dimensionen: groß genug, dass verschiedene Texte selten kollidieren,
// klein genug, dass ein Vektor im Trace noch lesbar bleibt.
export const DIMENSIONEN = 64;

// FNV-1a, 32 Bit. Gewählt, weil er in vier Zeilen passt und ohne Abhängigkeit
// auskommt — kryptografische Eigenschaften braucht diese Stelle nicht, nur
// Determinismus und eine brauchbare Streuung.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Bag-of-words auf feste Dimensionen, dann L2-normiert. Normiert, damit das
// Skalarprodukt direkt die Kosinus-Ähnlichkeit ist und lange Texte nicht
// allein durch ihre Länge oben stehen.
//
// Dieselbe Eigenschaft hat ein echtes Retrieval-Modell in der Regel auch —
// Voyage-Vektoren sind ebenfalls auf Länge 1 normiert. Deshalb bleiben der
// `memory`-Adapter (Skalarprodukt) und der Postgres-Adapter (Kosinusdistanz)
// bei einem Adaptertausch unverändert richtig.
export function einbetteEinen(text) {
  const v = new Array(DIMENSIONEN).fill(0);
  for (const t of terme(text)) v[hash(t) % DIMENSIONEN] += 1;

  const laenge = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  // Ein Text ohne Terme ergibt den Nullvektor. Er wird NICHT durch null
  // geteilt und bleibt null: seine Ähnlichkeit zu allem ist 0. Das ist die
  // ehrliche Antwort — nicht ein künstlicher Wert, der ihn irgendwo einsortiert.
  if (laenge === 0) return v;
  return v.map((x) => x / laenge);
}

export function createHashAdapter() {
  return {
    name: "hash",
    dimensionen: DIMENSIONEN,
    // `art` wird bewusst ignoriert — siehe Dateikopf. Der Parameter steht in
    // der Signatur, damit sichtbar bleibt, dass der Port ihn liefert und
    // dieser Adapter ihn nicht braucht.
    einbetteViele: (texte) => texte.map(einbetteEinen),
  };
}
