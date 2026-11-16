// ── domains/besprechung/agents/ticketdienst.js ───────────────────────────
// Der terminale Knoten. Er läuft NUR nach ausdrücklicher menschlicher
// Freigabe — die fail-closed-Kante im Kern sorgt dafür.
//
// Und hier steht das Kernprinzip:
//
//   AGENTEN RUFEN NIEMALS DIREKT EINE EXTERNE API AUF.
//
// Der Ticketdienst SCHREIBT nur in die Aktions-Queue. Den echten Aufruf am
// Ticketsystem führt ein getrennter Worker aus — nach eigener Validierung.
// Ein gekaperter oder halluzinierender Agent kann damit weder Daten abfließen
// lassen noch fremde Tickets anlegen: er kann nur Aktionen einreihen, die auf
// der Whitelist stehen und schemabegrenzt sind.
//
// DIE HERKUNFT REIST MIT. `notizId` steht im Payload, weil der Validierer sie
// verlangt (Ontologie: `Ticket verweist_auf Notiz`). Fehlt sie, lehnt der
// Worker ab — und das ist der gewollte Ausgang: lieber kein Ticket als eines,
// dessen Grundlage niemand nachschlagen kann.

//
// DIE RISIKOKLASSE STEHT IM UPDATE (Etappe 4c). Die Queue trägt sie in der
// Aktion; hier landet sie zusätzlich als Zahl in der Knotenzeile des Traces,
// damit jeder Lauf, der etwas eingereiht hat, sie in seinem eigenen Nachweis
// trägt. Sie entscheidet nichts (A5).

import { klassifiziere } from "../../../kernel/policy/engine.js";
import { enqueueAction, risikoklassen } from "../actions.js";
import { markZugestellt, titelAus } from "./entwurf.js";

const AKTION = "TICKET_ANLEGEN";

export async function ticketdienstNode(state) {
  // KEIN direktes fetch — nur in die Queue schreiben.
  // AWAIT und `principal`: die Queue prüft die Befugnis, bevor sie schreibt
  // (ADR-0020). Ohne das `await` liefe der Knoten weiter, während die Prüfung
  // noch läuft — und eine Ablehnung käme nach dem Log an, das sie verschweigt.
  await enqueueAction({
    threadId: state.threadId,
    principal: state.principal,
    actionType: AKTION,
    payload: {
      titel: titelAus(state.aktionspunkte),
      notizId: state.notizId,
      aktionspunkte: state.aktionspunkte,
    },
  });
  markZugestellt(state.threadId);

  return {
    zugestellt: true,
    risikoklasse: klassifiziere({ actionType: AKTION, risikoklassen }),
    nextAgent: "END",
    log: [
      "🎫 ticketdienst: TICKET_ANLEGEN in die Queue gelegt (der Worker validiert und führt aus)",
    ],
  };
}
