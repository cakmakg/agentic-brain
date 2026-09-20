// ── kernel/governance/identitaet/index.js ────────────────────────────────
// DER PORT DER IDENTITÄT. Er beschreibt, was ein Verzeichnis können muss, und
// prüft, dass ein übergebener Adapter es kann. Er weiß nicht, WELCHE Adapter
// es gibt — dieselbe Linie wie beim Store (ADR-0006) und beim Embedding
// (ADR-0015).
//
// WAS SICH HIER ÄNDERT (ADR-0018). Bis heute war `principal` eine BEHAUPTUNG
// des Aufrufers: `istPrincipalAufloesbar` in `context/envelope.js` prüft die
// FORM — Mandant da, Benutzer da, Gruppen ein Array — und nichts sonst. Wer
// ein passend geformtes Objekt schickt, ist, wen er zu sein behauptet. Ab hier
// wird der Principal AUFGELÖST: der Aufrufer bringt einen Nachweis mit, das
// Verzeichnis sagt, wer das ist, und nur das Ergebnis zählt.
//
// DAS NICHT-ZIEL BLEIBT. „Kein eigener Identitätsanbieter" (PRODUCT.md §3.2):
// die Identität wird aufgelöst, nicht verwaltet. Hier entsteht kein Benutzer,
// kein Passwort, keine Gruppe — hier wird gefragt.
//
// ── Warum überhaupt ein Zwischenspeicher, und warum ein befristeter ──────
//
// OHNE Zwischenspeicher liegt bei jedem Lauf ein Netzaufruf auf dem heißen
// Pfad, vor jeder Datenlogik. Das ist der Grund für den Zwischenspeicher.
//
// MIT einem unbefristeten wäre er der Fehler, den dieses Repo an anderer
// Stelle schon einmal benannt hat: bei 3.14 überlebt die KOPIE die
// Berechtigung. Ein ewig zwischengespeicherter Principal ist dasselbe eine
// Ebene höher — die Gruppenzugehörigkeit von gestern entscheidet über den
// Zugriff von heute, und ein Entzug im Verzeichnis wirkt nie. Deshalb: ein
// Zwischenspeicher ja, ein dauerhafter nein.
//
// NEGATIVE ERGEBNISSE WERDEN NICHT ZWISCHENGESPEICHERT. Wäre „nicht
// auflösbar" eine Zeile im Speicher, würde eine Störung des Verzeichnisses für
// die Dauer der Frist zu einer Berechtigungsentscheidung — der Ausfall sähe
// aus wie ein Nein. Ein Nein muss teuer bleiben: es wird bei jedem Versuch neu
// erfragt.
//
// `jetzt` ist einspeisbar, damit der Ablauf einer Frist PRÜFBAR ist, ohne zu
// warten. Ein Test, der schläft, misst die Uhr und nicht die Regel.

// Ein Adapter muss genau eines können: aus einem Nachweis einen Principal
// machen — oder null, wenn er es nicht kann. Mehr verlangt der Port nicht;
// alles Weitere wäre eine Annahme über das Verzeichnis.
export function pruefeAdapter(adapter) {
  if (!adapter || typeof adapter.aufloese !== "function") {
    throw new Error(
      "Identitäts-Adapter: die Methode `aufloese(nachweis)` fehlt.",
    );
  }
  if (typeof adapter.name !== "string" || adapter.name === "") {
    throw new Error(
      "Identitäts-Adapter: `name` fehlt — er steht im Trace und im Bericht, " +
        "sonst ist ein Lauf gegen ein Testdouble von einem echten nicht zu " +
        "unterscheiden.",
    );
  }
  return adapter;
}

// Die Standardfrist. Kurz genug, dass ein Entzug im Verzeichnis innerhalb
// einer Sitzung wirkt; lang genug, dass ein Lauf nicht je Knoten fragt.
export const FRIST_MS = 5 * 60 * 1000;

export function createAufloeser({
  adapter,
  fristMs = FRIST_MS,
  jetzt = () => Date.now(),
} = {}) {
  pruefeAdapter(adapter);
  if (!Number.isFinite(fristMs) || fristMs <= 0) {
    throw new Error(
      "createAufloeser: `fristMs` muss positiv und endlich sein. Eine Frist " +
        "von null oder unendlich wäre kein Zwischenspeicher, sondern keiner " +
        "oder ein dauerhafter — beides ausdrücklich nicht gewollt.",
    );
  }

  const speicher = new Map();
  // Zählt die Aufrufe ins Verzeichnis. Das ist der Messpunkt, an dem sich
  // „abgelaufen und neu aufgelöst" von „weiterverwendet" unterscheiden lässt —
  // am Principal selbst sieht man den Unterschied nicht.
  const statistik = { verzeichnisAufrufe: 0, treffer: 0 };

  async function aufloese(nachweis) {
    if (typeof nachweis !== "string" || nachweis === "") return null;

    const eintrag = speicher.get(nachweis);
    if (eintrag && eintrag.gueltigBis > jetzt()) {
      statistik.treffer += 1;
      return eintrag.principal;
    }
    // Abgelaufen: die Zeile fliegt raus, BEVOR gefragt wird. Bleibt sie liegen
    // und die Frage scheitert, wäre der alte Principal noch im Speicher.
    if (eintrag) speicher.delete(nachweis);

    statistik.verzeichnisAufrufe += 1;
    const principal = await adapter.aufloese(nachweis);
    if (!principal) return null; // negatives Ergebnis: nicht speichern

    speicher.set(nachweis, { principal, gueltigBis: jetzt() + fristMs });
    return principal;
  }

  // Für den Entzug innerhalb einer laufenden Sitzung: ohne diesen Weg müsste
  // man die Frist abwarten, und ein Entzug, auf den man warten muss, ist in
  // einem Sicherheitsmodell keiner.
  function vergiss(nachweis) {
    return speicher.delete(nachweis);
  }

  return { aufloese, vergiss, statistik, name: adapter.name };
}
