// ── domains/besprechung/actions.js ───────────────────────────────────────
// Erlaubte Aktionstypen und ihre Payload-Schemata. Das ist BEDEUTUNG: welche
// Wirkung diese Domäne überhaupt in der Welt haben darf. Die Mechanik der
// Queue steht im Kern.
//
// Doppeltes Tor: die Whitelist verhindert das Schreiben, die Validierer
// verhindern die Ausführung. Ein gekaperter Agent kommt an beiden nicht vorbei.
//
// DIE WHITELIST WIRD GEGEN DIE ONTOLOGIE GEHALTEN. `pruefeAktionsflaeche`
// läuft beim Laden dieses Moduls und wirft, wenn hier ein Aktionstyp
// freigeschaltet ist, den `ontology.js` nicht modelliert. Das ist die
// Frühform von A4 (`docs/roadmap.md` §4): dort wird die Whitelist in Etappe 5
// aus der Ontologie ERZEUGT. Bis dahin wird sie wenigstens dagegen geprüft —
// ein Gedanke, den niemand prüft, ist keine Zusage.

import { createActionQueue } from "../../kernel/action/queue.js";
import { suche } from "../../kernel/retrieval/suche.js";
import { AKTIONSTYPEN, pruefeAktionsflaeche } from "./ontology.js";
import { holeLeseweg } from "./leseweg.js";

export const whitelist = Object.keys(AKTIONSTYPEN);

// Wirft beim Laden. Absichtlich hier und nicht in einem Test allein: ein
// Prozess, der eine unmodellierte Aktionsfläche fahren würde, soll gar nicht
// erst starten.
pruefeAktionsflaeche(whitelist);

// Je Typ ein Schema und eine Längengrenze.
export const validators = {
  // `notizId` ist PFLICHT, nicht Schmuck: die Ontologie führt die Relation
  // `Ticket verweist_auf Notiz`, und ein Ticket ohne Beleg ist eine
  // Behauptung. Findet der Extrahierer keine Herkunft, scheitert die Aktion
  // genau hier — fail-closed bis in die Aktionsfläche.
  TICKET_ANLEGEN: (p) =>
    typeof p.titel === "string" &&
    p.titel.length > 0 &&
    p.titel.length <= 200 &&
    typeof p.notizId === "string" &&
    p.notizId.length > 0 &&
    Array.isArray(p.aktionspunkte) &&
    p.aktionspunkte.length > 0,

  TICKET_ZUWEISEN: (p) =>
    typeof p.ticketId === "string" &&
    p.ticketId.length > 0 &&
    typeof p.personId === "string" &&
    p.personId.length > 0,

  // Die Empfängerliste ist begrenzt. Eine Zustellung an den falschen oder an
  // einen zu großen Verteiler ist ein Leck, das ohne jedes Retrieval
  // auskommt — deshalb steht die Grenze im Validierer und nicht im Prompt.
  ZUSAMMENFASSUNG_SENDEN: (p) =>
    Array.isArray(p.empfaenger) &&
    p.empfaenger.length > 0 &&
    p.empfaenger.length <= 50 &&
    p.empfaenger.every((e) => typeof e === "string" && e.includes("@")) &&
    typeof p.text === "string" &&
    p.text.length <= 5000,
};

// ── Die Befugnis je Aktionstyp (ADR-0020) ────────────────────────────────
// WER darf WAS an WELCHEM Ziel auslösen. Das ist Bedeutung dieser Domäne; die
// Reihenfolge der Tore steht im Kern.
//
// Jeder Typ der Whitelist steht hier — als Funktion oder als benannte
// Ausnahme. Fehlt einer, wirft `createActionQueue` beim Laden.
export const befugnisse = {
  // Befugt ist, wer die Notiz im Ziel über den gefilterten Leseweg BEKOMMT.
  // Gezielt abgerufen, also dieselbe Kompilierung desselben Regelwerks wie
  // beim Lesen (ADR-0014) — keine zweite ACL, die driften könnte.
  //
  // Und bewusst NICHT über den Beleg des Laufs: der weiß, was der Agent
  // gelesen hat, liegt im Arbeitsspeicher und beschreibt die Vergangenheit.
  // Eine Aktion, deren Ziel zwischen Lesen und Einreihen verändert wurde,
  // sähe darin unauffällig aus. Deshalb wird der Speicher neu gefragt.
  TICKET_ANLEGEN: async ({ principal, payload }) => {
    // Kein Ziel, keine Befugnis — und diese Zeile steht VOR dem Speicher. Ohne
    // sie ginge eine leere `notizId` als Ziel in den Leseweg, und ein Ziel, das
    // niemand nennt, kann niemandem gehören. (Der Port wirft dafür inzwischen;
    // dass hier trotzdem geprüft wird, ist Absicht: eine Befugnis soll nicht
    // von einer Ausnahme abhängen.)
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

  // Benannte Ausnahmen. Ihr Ziel ist kein Dokument dieses Speichers, es gibt
  // also nichts, wogegen diese Domäne heute prüfen könnte. Ein pauschales Nein
  // wäre strenger und schlechter: ZUSAMMENFASSUNG_SENDEN käme dann nie in die
  // Queue, und die Empfängergrenze im Validierer würde von keinem Fall mehr
  // geübt. Eine Zusage stillzulegen, um eine andere zu bauen, ist kein
  // Fortschritt (dieselbe Antwort wie ADR-0017).
  //
  // Sie werden frei, wenn es ein Ticketsystem gibt, gegen das man prüfen kann
  // (Etappe 10), und ein Verzeichnis für Empfänger.
  TICKET_ZUWEISEN:
    "kein Ziel im Speicher — ein Ticket ist kein Dokument dieser Quelle (Etappe 10)",
  ZUSAMMENFASSUNG_SENDEN:
    "kein Ziel im Speicher — eine Empfängerliste ist kein Dokument dieser Quelle",
};

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
