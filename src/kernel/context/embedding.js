// ── kernel/context/embedding.js ──────────────────────────────────────────
// Das Embedding der Schicht A: ein Vektor aus dem Inhalts-Hash, kein
// Modellaufruf (ADR-0007).
//
// WARUM DAS KEINE ABKÜRZUNG IST. Schicht A misst nicht, ob die Einbettung gut
// ist, sondern ob kein unberechtigter Chunk zurückkommt. Für diese Frage
// entscheidet der Vektor nur die Reihenfolge der ERLAUBTEN Treffer — nicht, ob
// ein verbotener dabei ist. Ein echtes Modell würde die Messung teuer,
// schlüsselpflichtig und nichtdeterministisch machen und dafür nichts
// beitragen, was 3.13 misst.
//
// DIE GRENZE, WÖRTLICH: dieser Aufbau kann NICHT zeigen, dass die Suche gute
// Treffer liefert. Er zeigt, dass sie keine verbotenen liefert. Ein Test, der
// sich auf „das relevanteste Dokument steht oben" stützt, misst den Hash.
//
// Etappe 3 tauscht das Embedding gegen ein echtes und DARF 3.13 nicht bewegen.
// Bewegt sie es doch, hing die Autorisierung an der Rangfolge — ein Defekt.

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

// Zerlegung in Terme. Dieselbe Funktion benutzt der lexikalische Pfad der
// Suche — zwei Zerlegungen wären zwei Vorstellungen davon, was ein Wort ist,
// und die Suche fände Begriffe, die das Embedding nie gesehen hat.
export function terme(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

// Bag-of-words auf feste Dimensionen, dann L2-normiert. Normiert, damit das
// Skalarprodukt in `suche.js` direkt die Kosinus-Ähnlichkeit ist und lange
// Texte nicht allein durch ihre Länge oben stehen.
export function einbetten(text) {
  const v = new Array(DIMENSIONEN).fill(0);
  for (const t of terme(text)) v[hash(t) % DIMENSIONEN] += 1;

  const laenge = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  // Ein Text ohne Terme ergibt den Nullvektor. Er wird NICHT durch null
  // geteilt und bleibt null: seine Ähnlichkeit zu allem ist 0. Das ist die
  // ehrliche Antwort — nicht ein künstlicher Wert, der ihn irgendwo einsortiert.
  if (laenge === 0) return v;
  return v.map((x) => x / laenge);
}
