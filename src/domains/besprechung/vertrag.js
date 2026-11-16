// ── domains/besprechung/vertrag.js ───────────────────────────────────────
// DER AUSGABEVERTRAG dieser Domäne: wann ist eine Liste von Aktionspunkten
// brauchbar? Reine Funktionen, keine Importe, kein IO.
//
// WARUM EINE EIGENE DATEI — zwei Gründe, beide praktisch.
//
// 1. Der Vertrag hat DREI Leser: den Prompt des Produzenten (er bittet
//    darum), den Prompt des Prüfers (er nennt ihn) und den Prüfknoten (er
//    entscheidet damit). Stünde er in einem der drei, importierten die
//    anderen beiden ihn von dort — `prompts.js` und `agents/extrahierer.js`
//    ergäben dann einen Importzyklus, und ein Zyklus über `const`-Bindungen
//    ist in ESM kein Stilproblem, sondern ein ReferenceError beim Laden.
//
// 2. `EVALS.md` §5 verlangt für Schicht B ein `pruefe(text, gegenstand)`
//    OHNE LLM: „ein Prüfer, der selbst ein Modell fragt, misst zwei
//    Unbekannte gegeneinander." Genau das steht hier und ist damit ohne
//    Schlüssel prüfbar.
//
// DER VERTRAG IST BEWUSST KLEIN. Zwei Bedingungen, beide mit `true`/`false`
// beantwortbar. „Gut formuliert" wäre keine Bedingung, sondern eine Meinung.

// Ein Aktionspunkt ohne Verantwortliche. Ein benannter Wert statt des leeren
// Strings: „niemand ist zuständig" ist eine AUSSAGE der Notiz und darf nicht
// wie ein vergessenes Feld aussehen.
export const UNBESETZT = "unbesetzt";

// Kürzer als das ist keine Handlung, sondern ein Stichwort. Die Zahl ist
// gegriffen, aber sie steht an EINER Stelle — und der Prompt zitiert sie von
// hier, statt sie ein zweites Mal zu nennen.
export const MIN_TEXT_LAENGE = 10;

/**
 * Hält eine Liste von Aktionspunkten gegen den Vertrag.
 *
 * Gibt `{ istFreigegeben, gruende }` zurück — dieselbe Form, die der
 * Prüfknoten als strukturierte Ausgabe erwartet, und dieselbe, die der
 * Schicht-B-Runner braucht.
 *
 * Eine LEERE Liste ist vertragskonform. Das ist Absicht: „diese Besprechung
 * hat keine offenen Punkte" ist ein gültiges Ergebnis, kein Mangel. Der
 * Ablauf endet dann vor dem Entwurf (BREMSE 5), nicht an dieser Prüfung —
 * sonst liefe eine ergebnislose Notiz fünf Revisionen lang im Kreis.
 */
export function pruefeVertrag(aktionspunkte) {
  const maengel = [];

  if (!Array.isArray(aktionspunkte)) {
    return {
      istFreigegeben: false,
      gruende: "Aktionspunkte fehlen oder sind keine Liste.",
    };
  }

  aktionspunkte.forEach((a, i) => {
    const nummer = i + 1;
    if (typeof a?.text !== "string" || a.text.length < MIN_TEXT_LAENGE) {
      maengel.push(
        `Aktionspunkt ${nummer}: Text kuerzer als ${MIN_TEXT_LAENGE} Zeichen.`,
      );
    }
    if (
      typeof a?.verantwortlich !== "string" ||
      a.verantwortlich === UNBESETZT
    ) {
      maengel.push(`Aktionspunkt ${nummer}: keine verantwortliche Person.`);
    }
  });

  return {
    istFreigegeben: maengel.length === 0,
    gruende:
      maengel.length === 0 ? "Ausgabevertrag erfuellt." : maengel.join(" "),
  };
}

// ── Der bearbeitete Entwurf (A12, ADR-0022) ──────────────────────────────
// Ein Mensch darf am Genehmigungstor nicht nur ja oder nein sagen, sondern
// den Entwurf BEARBEITEN. Diese Fassung hat der Pruefer nie gesehen — sie
// laeuft deshalb erneut durch denselben Vertrag, und danach ohnehin durch die
// Validierer der Queue.
//
// WARUM EINE LEERE BEARBEITUNG ABGELEHNT WIRD, obwohl `pruefeVertrag` sie
// durchlaesst: dort heisst die leere Liste „diese Besprechung hat keine
// offenen Punkte" — eine Aussage des Extrahierers, die BREMSE 5 vor dem
// Entwurf beendet. Hier gibt es den Entwurf schon. Eine Bearbeitung, die
// alles streicht, ist keine Bearbeitung, sondern eine Ablehnung; und fuer die
// gibt es den anderen Knopf. Ohne diese Zeile ginge sie in die Queue und
// fiele erst am Validierer — eingereiht statt abgelehnt.
export function pruefeEntwurf({ bearbeiteterEntwurf, zustand }) {
  const neu = bearbeiteterEntwurf?.aktionspunkte;

  if (!Array.isArray(neu) || neu.length === 0) {
    return {
      ok: false,
      gruende:
        "Der bearbeitete Entwurf hat keine Aktionspunkte. Eine leere " +
        "Bearbeitung ist eine Ablehnung — dafuer gibt es den anderen Weg.",
    };
  }

  const urteil = pruefeVertrag(neu);
  if (!urteil.istFreigegeben) {
    return { ok: false, gruende: urteil.gruende };
  }

  return {
    ok: true,
    gruende: urteil.gruende,
    // Was in den Zustand zurueckfliesst. NUR die Aktionspunkte: Herkunft
    // (`notizId`) und Freigabe bleiben, wie der Lauf sie erarbeitet hat. Ein
    // Mensch, der am Genehmigungstor die Herkunft aendern koennte, haette
    // genau den Beleg entwertet, den `Ticket verweist_auf Notiz` verlangt.
    patch: { aktionspunkte: neu },
    unterschied: zaehleUnterschied(zustand?.aktionspunkte, neu),
  };
}

// EINE ZAHL, nicht der Text. Der Trace belegt, DASS und WIE VIEL ein Mensch
// geaendert hat, nie WAS — sonst stuende der Entwurf im Klartext im Audit
// (`ARCHITECTURE.md` §5).
//
// Gezaehlt werden Stellen, nicht Zeichen: eine umformulierte Zeile und eine
// geloeschte zaehlen gleich, weil beide eine menschliche Entscheidung sind.
export function zaehleUnterschied(vorher, nachher) {
  const a = Array.isArray(vorher) ? vorher : [];
  const b = Array.isArray(nachher) ? nachher : [];
  let unterschiedlich = Math.abs(a.length - b.length);

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (
      a[i]?.text !== b[i]?.text ||
      a[i]?.verantwortlich !== b[i]?.verantwortlich
    ) {
      unterschiedlich++;
    }
  }

  return unterschiedlich;
}
