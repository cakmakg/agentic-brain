// ── kernel/context/store/index.js ────────────────────────────────────────
// DER PORT. Er beschreibt, was ein Chunk-Speicher können muss, und prüft, dass
// ein übergebener Adapter es kann. Er weiß nicht, WELCHE Adapter es gibt.
//
// ADR-0006: `store/index.js` importiert keinen Adapter. Verdrahtet wird in
// `context/aufbau.js`. Die Regel ist mechanisiert (dependency-cruiser,
// `*/store/index.js ✗→ */store/*.js`) und ihr Prüfkriterium ist ein grep.
//
// Warum ein Port, solange es nur einen Adapter gibt: sobald der Ablauf eine
// laufende Datenbank braucht, ist K5 gebrochen und Schicht A läuft nicht mehr
// in CI. Der `memory`-Adapter trägt Mock-Modus, CI und K5 allein; pgvector
// tritt in Etappe 3 DANEBEN. Ehrlich dazugesagt: ein Adapter beweist kein Port.
// Erst der zweite zeigt, ob die Grenze richtig liegt.
//
// DER PORT IST DIE ASYNCHRONE GRENZE (seit Etappe 3c). Jede Methode hier gibt
// ein Promise zurück, auch wenn der `memory`-Adapter synchron antwortet —
// `await` auf einen Nicht-Promise kostet nichts. Der Grund steht im Wort
// „Port": ein Speicher hinter einem Netz kann nicht synchron antworten, und
// eine Signatur, die das erst beim zweiten Adapter lernt, zwingt genau dann
// zu einem Umbau, wenn ohnehin alles neu ist. Die Umstellung wurde deshalb
// VOR dem Postgres-Adapter gemacht, allein, mit dem Tor „alle Zahlen
// identisch" — dieselbe Disziplin wie beim Ebenenumbau in Etappe 0b.

import {
  kompiliereFilter,
  kompiliereFilterSql,
} from "../../retrieval/filter.js";

// Was ein Adapter mitbringen muss. Dieselbe Idee wie die Pflichtfelder in
// `registry.js`: ein fehlendes Stück muss LAUT sein, nicht still zu einem
// leeren Ergebnis führen — ein Speicher, der schweigend nichts findet, ist von
// einem korrekt filternden Speicher nicht zu unterscheiden.
const PFLICHTMETHODEN = [
  "schreibe",
  "ersetzeQuelle",
  "suche",
  "zaehle",
  "leere",
];

export function createStore(adapter, embedding) {
  for (const methode of PFLICHTMETHODEN) {
    if (typeof adapter?.[methode] !== "function") {
      throw new Error(
        `createStore: der Adapter liefert keine Methode "${methode}".`,
      );
    }
  }

  if (!embedding?.dimensionen) {
    throw new Error(
      "createStore: ohne Embedding kein Speicher — der Vektor eines Chunks entsteht beim Ingest, nicht beim Suchen.",
    );
  }

  return {
    name: adapter.name ?? "unbenannt",

    // Der Speicher traegt das Embedding, mit dem er gebaut wurde. Damit
    // muessen `ingestiere` und `synchronisiere` es nicht durch jede Signatur
    // reichen — und es ist ausgeschlossen, dass ein Dokument mit einem
    // anderen Verfahren eingebettet wird als die Frage, die es finden soll.
    // Zwei Verfahren in einem Speicher waeren keine schlechte Suche, sondern
    // eine sinnlose: die Vektoren lebten in verschiedenen Raeumen.
    embedding,

    // Schreiben geht ohne Principal: Ingest ist eine Systemhandlung, kein
    // Lesezugriff. Die Berechtigung reist in der Envelope mit (ADR-0009).
    schreibe: async (chunks) => adapter.schreibe(chunks),

    // ── Der Schreibweg der Synchronisation (ADR-0011). ──────────────────
    // Ersetzt ALLES, was zu dieser Quelle im Speicher liegt, durch die
    // übergebene Momentaufnahme — in einem Schritt. Dadurch ist der Entzug
    // strukturell: ein Dokument, das nicht mehr in der Momentaufnahme steht,
    // verschwindet, weil es nicht mehr da ist, und nicht weil jemand ein
    // Löschereignis richtig verarbeitet hat.
    //
    // Die Prüfung steht HIER im Port und nicht im Adapter, damit sie für
    // jeden Adapter gilt: ein Connector, der Chunks mit fremder Quelle
    // liefert, würde sonst in den Namensraum einer anderen Quelle schreiben —
    // und beim nächsten Zyklus jener Quelle spurlos verschwinden oder
    // fälschlich überleben. Laut statt still.
    async ersetzeQuelle(quelle, chunks) {
      for (const c of chunks) {
        if (c?.envelope?.quelle !== quelle) {
          throw new Error(
            `ersetzeQuelle: Chunk "${c?.chunkId}" traegt die Quelle "${c?.envelope?.quelle}", ersetzt wird aber "${quelle}".`,
          );
        }
      }
      return adapter.ersetzeQuelle(quelle, chunks);
    },

    zaehle: async () => adapter.zaehle(),
    leere: async () => adapter.leere(),

    // OPTIONAL, deshalb nicht in PFLICHTMETHODEN: ein Speicher im
    // Arbeitsspeicher hat nichts zu schließen. Ein Adapter mit
    // Verbindungspool hat es sehr wohl — ohne diesen Aufruf endete ein
    // Eval-Lauf nie von selbst.
    schliesse: async () => adapter.schliesse?.(),

    // ── Der einzige Leseweg. ────────────────────────────────────────────
    // Hier steht die fail-closed-Kante des Retrievals, und sie steht VOR dem
    // Adapter: ist der Principal nicht auflösbar, wird der Speicher gar nicht
    // erst gefragt. Kein Aufruf, keine Treffer, keine Chance auf ein Leck
    // durch einen Adapterfehler.
    //
    // Es gibt bewusst KEINEN zweiten Leseweg ohne Principal. Ein solcher wäre
    // die Abkürzung, über die jedes Leck später hereinkäme.
    //
    // ── ZWEI KIPPEN, EIN WEG (ADR-0019, T1) ─────────────────────────────
    // Ohne `dokumentId`: die Relevanzsuche — die k besten SICHTBAREN Chunks
    // zu einer Frage. Mit `dokumentId`: der gezielte Abruf — ALLE sichtbaren
    // Chunks genau dieses Dokuments, in ihrer Reihenfolge, ohne Relevanz.
    //
    // WARUM DAS NICHT ZWEI METHODEN SIND. Die fail-closed-Kante darf nur an
    // EINER Stelle stehen; eine zweite Lesemethode wäre eine zweite Stelle,
    // an der man sie vergessen kann. Beide Kippen gehen durch dieselbe
    // Kompilierung desselben Regelwerks.
    //
    // WARUM ES DIE ZWEITE KIPPE ÜBERHAUPT GIBT. Ein Agent, der eine BENANNTE
    // Notiz bearbeiten soll, darf nicht davon abhängen, dass sie auch
    // relevant genug bewertet wird: `memory` verwirft Chunks mit `wert = 0`,
    // und ein Hash-Embedding (ADR-0007) sagt über Relevanz ohnehin nichts.
    // Sonst entschied am Ende die Rangfolge über die Berechtigung — und eine
    // berechtigte Notiz wäre „nicht sichtbar", weil sie schlecht bewertet
    // wurde. Relevanz darf ORDNEN, ausschließen darf nur die ACL.
    //
    // `k` gilt nur in der ersten Kippe. Ein Dokument ist keine Rangliste; es
    // abzuschneiden hieße, dem Agenten die Hälfte seiner Notiz zu geben.
    async suche({ principal, anfrage = "", k = 5, dokumentId = null }) {
      const praedikat = kompiliereFilter(principal);
      if (!praedikat) {
        // Unterscheidbar protokolliert: „nicht auflösbar" ist etwas anderes
        // als „darf nichts sehen". Beides ergibt null Treffer — wer den
        // Unterschied nicht sieht, sucht den falschen Fehler (ADR-0008).
        return { treffer: [], grund: "principal-nicht-aufloesbar" };
      }
      // BEIDE Kompilate desselben Regelwerks (ADR-0014). Der Adapter nimmt,
      // was zu ihm passt: `memory` das Prädikat, `postgres` die Bedingung.
      // Der Principal selbst wird NICHT durchgereicht — ein Adapter soll
      // keine eigene ACL-Regel formulieren können, sondern nur eine
      // anwenden.
      const sqlFilter = (ab) => kompiliereFilterSql(principal, ab);
      return {
        treffer: await adapter.suche({
          praedikat,
          sqlFilter,
          anfrage,
          k,
          dokumentId,
        }),
        grund: null,
      };
    },
  };
}
