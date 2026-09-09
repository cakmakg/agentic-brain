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

import { kompiliereFilter } from "../../retrieval/filter.js";

// Was ein Adapter mitbringen muss. Dieselbe Idee wie die Pflichtfelder in
// `registry.js`: ein fehlendes Stück muss LAUT sein, nicht still zu einem
// leeren Ergebnis führen — ein Speicher, der schweigend nichts findet, ist von
// einem korrekt filternden Speicher nicht zu unterscheiden.
const PFLICHTMETHODEN = ["schreibe", "suche", "zaehle", "leere"];

export function createStore(adapter) {
  for (const methode of PFLICHTMETHODEN) {
    if (typeof adapter?.[methode] !== "function") {
      throw new Error(
        `createStore: der Adapter liefert keine Methode "${methode}".`,
      );
    }
  }

  return {
    name: adapter.name ?? "unbenannt",

    // Schreiben geht ohne Principal: Ingest ist eine Systemhandlung, kein
    // Lesezugriff. Die Berechtigung reist in der Envelope mit (ADR-0009).
    schreibe: (chunks) => adapter.schreibe(chunks),

    zaehle: () => adapter.zaehle(),
    leere: () => adapter.leere(),

    // ── Der einzige Leseweg. ────────────────────────────────────────────
    // Hier steht die fail-closed-Kante des Retrievals, und sie steht VOR dem
    // Adapter: ist der Principal nicht auflösbar, wird der Speicher gar nicht
    // erst gefragt. Kein Aufruf, keine Treffer, keine Chance auf ein Leck
    // durch einen Adapterfehler.
    //
    // Es gibt bewusst KEINEN zweiten Leseweg ohne Principal. Ein solcher wäre
    // die Abkürzung, über die jedes Leck später hereinkäme.
    suche({ principal, anfrage, k = 5 }) {
      const praedikat = kompiliereFilter(principal);
      if (!praedikat) {
        // Unterscheidbar protokolliert: „nicht auflösbar" ist etwas anderes
        // als „darf nichts sehen". Beides ergibt null Treffer — wer den
        // Unterschied nicht sieht, sucht den falschen Fehler (ADR-0008).
        return { treffer: [], grund: "principal-nicht-aufloesbar" };
      }
      return {
        treffer: adapter.suche({ praedikat, anfrage, k }),
        grund: null,
      };
    },
  };
}
