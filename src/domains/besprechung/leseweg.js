// ── domains/besprechung/leseweg.js ───────────────────────────────────────
// WOHER DIESE DOMÄNE LIEST, UND WAS SIE GELESEN HAT. Zwei Dinge in einer
// Datei, weil sie dieselbe Frage von zwei Seiten sind.
//
// ── Warum der Speicher nicht im Zustand steht ────────────────────────────
//
// Der Zustand des Graphen wird in den Checkpoint SERIALISIERT — das ist die
// Hälfte der HITL-Zusage (`agent/checkpointer.js`). Ein Chunk-Speicher im
// Zustand hieße: entweder scheitert die Serialisierung an seinen Funktionen,
// oder sie gelingt und schreibt den INHALT samt Envelopes in ein Log, das
// keine Berechtigung kennt. Das zweite wäre schlimmer als das erste, weil es
// funktioniert. Derselbe Grund schließt `configurable` aus: der Checkpointer
// legt das config jeder Zeile ins Log.
//
// Deshalb liegt der Speicher NEBEN dem Zustand, hier. Der Principal dagegen
// gehört in den Zustand: er ist kleine, unverfängliche Kennung, er muss den
// Lauf überdauern, und der Leseweg braucht ihn bei JEDEM Knoten.
//
// ── Fail-loud, nicht fail-closed ─────────────────────────────────────────
//
// Ist kein Leseweg verdrahtet, wirft `holeLeseweg`. Das ist absichtlich KEIN
// leeres Ergebnis: ein fehlender Speicher ist ein Verdrahtungsfehler, und als
// leeres Ergebnis sähe er aus wie eine verweigerte Berechtigung. Ein
// Betriebsfehler, als Sicherheitsereignis verkleidet, wird nie gefunden —
// dieselbe Linie wie in `identitaet/fixtures.js`, wo die Form beim BAU geprüft
// wird und nicht bei der Auflösung.

let speicher = null;

// Verdrahtet den Leseweg. `null` löst die Verdrahtung wieder — Tests und der
// Harness brauchen das, damit ein Lauf nicht den Speicher des vorigen sieht.
export function setzeLeseweg(store) {
  speicher = store ?? null;
}

export function holeLeseweg() {
  if (!speicher) {
    throw new Error(
      "besprechung: kein Leseweg verdrahtet. `setzeLeseweg(store)` fehlt — " +
        "ohne Speicher kann der Extrahierer nicht berechtigungstreu lesen, " +
        "und ein leeres Ergebnis würde hier wie eine verweigerte Berechtigung " +
        "aussehen.",
    );
  }
  return speicher;
}

// ── Der Beleg ────────────────────────────────────────────────────────────
// Was der Lauf aus dem Speicher bekommen HAT. Zwei Gründe, das zu behalten:
//
//   1) Fachlich: die Ontologie führt `Ticket verweist_auf Notiz`. Ein Ticket
//      ohne Beleg ist eine Behauptung.
//   2) Messbar: der Harness rechnet 3.13 auf Chunk-Ebene. Ohne diese Spur
//      könnte er den Agentenpfad nicht in den Nenner nehmen — die Naht wäre
//      gelegt und nicht gemessen.
//
// Grenze, bewusst: die Karte wächst mit der Zahl der Läufe, wie `getEntwurf`
// und `getArtifact` in dieser Domäne auch. Für ein Gerüst tragbar.
const belege = new Map();

// ANGEHÄNGT, NICHT ERSETZT. Ein Lauf kann mehrfach lesen — bei jeder Revision
// läuft der Extrahierer erneut. Würde hier ersetzt, zählte der Nenner von 3.13
// nur die LETZTE Lieferung, und ein Leck in einer früheren Runde wäre
// unsichtbar. Gezählt wird, was den Speicher verlassen hat.
export function merkeBeleg(threadId, treffer) {
  const bisher = belege.get(threadId)?.chunks ?? [];
  const chunks = [
    ...bisher,
    ...treffer.map((t) => ({ chunkId: t.chunkId, dokumentId: t.dokumentId })),
  ];
  belege.set(threadId, {
    chunks,
    dokumente: [...new Set(chunks.map((c) => c.dokumentId))].sort(),
  });
}

export function holeBeleg(threadId) {
  return belege.get(threadId) ?? { chunks: [], dokumente: [] };
}
