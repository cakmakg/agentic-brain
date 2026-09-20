// ── kernel/action/flaeche.js ─────────────────────────────────────────────
// MOAT Layer 4 — die AKTIONSFLÄCHE ENTSTEHT aus dem Modell der Domäne, sie
// wird nicht daneben geschrieben (A4, `docs/roadmap.md` §4). Bis hierher war
// die Whitelist eine eigene Liste, die gegen die Ontologie nur GEPRÜFT wurde;
// drei parallele Listen (Whitelist, Validierer, Befugnisse) konnten
// auseinanderlaufen, ohne dass irgendetwas rot wurde.
//
// Zwei Eingaben, zwei verschiedene Aufgaben:
//
//   modelliert  DIE DECKE. Was hier fehlt, kann NIE scharf werden — auch
//               nicht durch einen Eintrag in der Umsetzung. Das ist A4:
//               „Was nicht modelliert ist, kann kein Agent auslösen."
//   umsetzung   DER SCHALTER. Je Typ entweder `{ validator, befugnis }`
//               — dann ist er scharf — oder eine nicht-leere Zeichenkette:
//               modelliert, aber BEWUSST nicht scharf, mit Begründung.
//
// Modelliert und scharf sind damit zum ersten Mal zwei verschiedene Dinge.
// Etappe 13 braucht genau das: `TICKET_KOMMENTIEREN` entsteht zuerst in der
// Ontologie und wird erst später freigeschaltet — sonst gäbe es eine
// freigeschaltete Wirkung, die niemand modelliert hat (K9).
//
// DER KERN LIEST NUR SCHLÜSSEL. Was in den Werten von `modelliert` steht —
// Entitätsnamen, Hinweise —, rührt diese Datei nicht an. Deshalb bleibt
//
//   grep -rn "<domäne>" src/kernel/    # leer
//
// auch dann leer, wenn die Ontologie einer Domäne durch diese Funktion läuft.
//
// REINE FUNKTION, kein IO. Sie wirft beim Laden des Domänenmoduls; ein
// Prozess mit einer widersprüchlichen Aktionsfläche soll nicht starten.

// Ein Eintrag der Umsetzung ist scharf, wenn er einen Validierer UND eine
// Befugnis trägt. Die Befugnis darf — wie in ADR-0020 — eine benannte
// Ausnahme sein; der Validierer nicht. Ein Aktionstyp ohne Payload-Schema
// hätte kein zweites Tor, und die Queue würde ihn schreiben, um ihn danach
// wortlos abzulehnen: im Bericht sähe das aus wie ein kaputtes Payload.
function istScharf(eintrag) {
  return (
    typeof eintrag === "object" &&
    eintrag !== null &&
    typeof eintrag.validator === "function" &&
    (typeof eintrag.befugnis === "function" ||
      (typeof eintrag.befugnis === "string" && eintrag.befugnis.length > 0))
  );
}

export function erzeugeAktionsflaeche(modelliert, umsetzung) {
  const modell = Object.keys(modelliert ?? {});
  const genannt = Object.keys(umsetzung ?? {});

  // ── Richtung 1: die Decke ──────────────────────────────────────────────
  // Ein umgesetzter Typ ohne Modell ist die Lücke, die A4 schließt. Sie wird
  // ZUERST geprüft: sie ist die einzige der drei, die eine Wirkung in der
  // Welt freischaltet, die niemand beschrieben hat.
  const unmodelliert = genannt.filter((t) => !modell.includes(t));
  if (unmodelliert.length > 0) {
    throw new Error(
      `Aktionsfläche: [${unmodelliert.join(", ")}] ist umgesetzt, aber nicht ` +
        "modelliert — was nicht in der Ontologie steht, kann kein Agent auslösen.",
    );
  }

  // ── Richtung 2: kein Schweigen ─────────────────────────────────────────
  // Ein modellierter Typ, den die Umsetzung gar nicht erwähnt, wäre still
  // nicht scharf. Still ist hier das Problem, nicht „nicht scharf": niemand
  // könnte später unterscheiden, ob er absichtlich zu ist oder vergessen
  // wurde. Dieselbe Linie wie `ungemessen` (ADR-0017) und die benannte
  // Ausnahme der Befugnis (ADR-0020): gemessen oder benannt, aber nie
  // vergessen.
  const verschwiegen = modell.filter((t) => !genannt.includes(t));
  if (verschwiegen.length > 0) {
    throw new Error(
      `Aktionsfläche: [${verschwiegen.join(", ")}] ist modelliert, aber in der ` +
        "Umsetzung nicht genannt — erwartet wird { validator, befugnis } oder " +
        "eine benannte Begründung, warum der Typ nicht scharf ist.",
    );
  }

  // ── Richtung 3: halb umgesetzt ist nicht umgesetzt ─────────────────────
  const whitelist = [];
  const validators = {};
  const befugnisse = {};
  const nichtScharf = {};

  for (const typ of modell) {
    const eintrag = umsetzung[typ];

    if (typeof eintrag === "string" && eintrag.length > 0) {
      nichtScharf[typ] = eintrag;
      continue;
    }

    if (!istScharf(eintrag)) {
      throw new Error(
        `Aktionsfläche: der Aktionstyp "${typ}" ist halb umgesetzt — erwartet ` +
          "wird { validator: Funktion, befugnis: Funktion | nicht-leere " +
          "Zeichenkette } oder eine nicht-leere Zeichenkette als Begründung, " +
          "warum er nicht scharf ist.",
      );
    }

    whitelist.push(typ);
    validators[typ] = eintrag.validator;
    befugnisse[typ] = eintrag.befugnis;
  }

  return { whitelist, validators, befugnisse, nichtScharf };
}
