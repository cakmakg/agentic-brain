// ── domains/besprechung/actions.js ───────────────────────────────────────
// Die Aktionsfläche dieser Domäne. Das ist BEDEUTUNG: welche Wirkung sie
// überhaupt in der Welt haben darf. Die Mechanik der Queue steht im Kern.
//
// SIE WIRD NICHT GESCHRIEBEN, SIE ENTSTEHT (A4, Etappe 5). `ontology.js` ist
// die Decke, diese Datei der Schalter; `erzeugeAktionsflaeche` hält beide
// gegeneinander und wirft beim Laden. Vorher standen hier drei parallele
// Listen — Whitelist, Validierer, Befugnisse —, von denen nur die erste an
// der Ontologie hing. Eine davon konnte einen Typ vergessen, ohne dass etwas
// rot wurde: die Aktion wäre geschrieben und danach wortlos abgelehnt worden.
//
// Doppeltes Tor bleibt: die Whitelist verhindert das Schreiben, die
// Validierer verhindern die Ausführung. Ein gekaperter Agent kommt an beiden
// nicht vorbei.

import { createActionQueue } from "../../kernel/action/queue.js";
import { erzeugeAktionsflaeche } from "../../kernel/action/flaeche.js";
import { suche } from "../../kernel/retrieval/suche.js";
import { AKTIONSTYPEN } from "./ontology.js";
import { holeLeseweg } from "./leseweg.js";

// ── Die Umsetzung je modelliertem Aktionstyp ─────────────────────────────
// Entweder `{ validator, befugnis }` — dann ist der Typ scharf — oder eine
// benannte Begründung, warum er es (noch) nicht ist. Ein modellierter Typ,
// den diese Liste verschweigt, lässt den Prozess gar nicht erst starten.
const umsetzung = {
  TICKET_ANLEGEN: {
    // `notizId` ist PFLICHT, nicht Schmuck: die Ontologie führt die Relation
    // `Ticket verweist_auf Notiz`, und ein Ticket ohne Beleg ist eine
    // Behauptung. Findet der Extrahierer keine Herkunft, scheitert die Aktion
    // genau hier — fail-closed bis in die Aktionsfläche.
    validator: (p) =>
      typeof p.titel === "string" &&
      p.titel.length > 0 &&
      p.titel.length <= 200 &&
      typeof p.notizId === "string" &&
      p.notizId.length > 0 &&
      Array.isArray(p.aktionspunkte) &&
      p.aktionspunkte.length > 0,

    // Befugt ist, wer die Notiz im Ziel über den gefilterten Leseweg BEKOMMT
    // (ADR-0020). Gezielt abgerufen, also dieselbe Kompilierung desselben
    // Regelwerks wie beim Lesen (ADR-0014) — keine zweite ACL, die driften
    // könnte.
    //
    // Und bewusst NICHT über den Beleg des Laufs: der weiß, was der Agent
    // gelesen hat, liegt im Arbeitsspeicher und beschreibt die Vergangenheit.
    // Eine Aktion, deren Ziel zwischen Lesen und Einreihen verändert wurde,
    // sähe darin unauffällig aus. Deshalb wird der Speicher neu gefragt.
    befugnis: async ({ principal, payload }) => {
      // Kein Ziel, keine Befugnis — und diese Zeile steht VOR dem Speicher.
      // Ohne sie ginge eine leere `notizId` als Ziel in den Leseweg, und ein
      // Ziel, das niemand nennt, kann niemandem gehören. (Der Port wirft
      // dafür inzwischen; dass hier trotzdem geprüft wird, ist Absicht: eine
      // Befugnis soll nicht von einer Ausnahme abhängen.)
      if (typeof payload?.notizId !== "string" || payload.notizId === "") {
        return false;
      }

      const { treffer } = await suche({
        store: holeLeseweg(),
        principal,
        dokumentId: payload?.notizId,
      });
      return treffer.length > 0;
    },
  },

  // MODELLIERT, NICHT SCHARF. Es gibt kein Ticketsystem, gegen das zugewiesen
  // werden könnte — ein Ticket entsteht erst über die Queue, und den echten
  // Aufruf bringt Etappe 10 (A16). Bis dahin war dieser Typ freigeschaltet,
  // hatte eine benannte Befugnis-Ausnahme und wurde von keinem einzigen Fall
  // geübt: eine offene Wirkung, die niemand misst. Genau dafür ist die
  // Trennung zwischen modelliert und scharf da. Der Validierer steht deshalb
  // hier nicht mehr — er wird mit dem Ausführer zusammen geschrieben, gegen
  // ein Zielsystem, das es dann gibt.
  TICKET_ZUWEISEN:
    "kein Ticketsystem, gegen das zugewiesen werden könnte (Etappe 10)",

  ZUSAMMENFASSUNG_SENDEN: {
    // Die Empfängerliste ist begrenzt. Eine Zustellung an den falschen oder an
    // einen zu großen Verteiler ist ein Leck, das ohne jedes Retrieval
    // auskommt — deshalb steht die Grenze im Validierer und nicht im Prompt.
    validator: (p) =>
      Array.isArray(p.empfaenger) &&
      p.empfaenger.length > 0 &&
      p.empfaenger.length <= 50 &&
      p.empfaenger.every((e) => typeof e === "string" && e.includes("@")) &&
      typeof p.text === "string" &&
      p.text.length <= 5000,

    // Benannte Ausnahme (ADR-0020): ihr Ziel ist kein Dokument dieses
    // Speichers, es gibt also nichts, wogegen diese Domäne heute prüfen
    // könnte. Ein pauschales Nein wäre strenger und schlechter — der Typ käme
    // nie in die Queue, und die Empfängergrenze im Validierer würde von keinem
    // Fall mehr geübt. Eine Zusage stillzulegen, um eine andere zu bauen, ist
    // kein Fortschritt (dieselbe Antwort wie ADR-0017).
    befugnis:
      "kein Ziel im Speicher — eine Empfängerliste ist kein Dokument dieser Quelle",
  },
};

// Wirft beim Laden, absichtlich hier und nicht in einem Test allein: ein
// Prozess, der eine widersprüchliche Aktionsfläche fahren würde, soll gar
// nicht erst starten.
export const { whitelist, validators, befugnisse, nichtScharf } =
  erzeugeAktionsflaeche(AKTIONSTYPEN, umsetzung);

// Eine Queue je Domäne. Sie ist ein Modul-Singleton, weil der Worker und die
// Beobachtung über /api/queue dieselbe Liste sehen müssen.
export const besprechungQueue = createActionQueue({
  whitelist,
  validators,
  befugnisse,
  logName: "aktionen-besprechung",
});

export const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
  besprechungQueue;
