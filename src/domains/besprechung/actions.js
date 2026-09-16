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
import { AKTIONSTYPEN, pruefeAktionsflaeche } from "./ontology.js";

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

// Eine Queue je Domäne. Sie ist ein Modul-Singleton, weil der Worker und die
// Beobachtung über /api/queue dieselbe Liste sehen müssen.
export const besprechungQueue = createActionQueue({
  whitelist,
  validators,
  logName: "aktionen-besprechung",
});

export const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
  besprechungQueue;
