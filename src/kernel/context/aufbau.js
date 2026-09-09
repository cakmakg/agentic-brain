// ── kernel/context/aufbau.js ─────────────────────────────────────────────
// Die Kompositionswurzel des Kontext-Motors: hier — und nur hier — trifft der
// Port auf einen konkreten Adapter.
//
// WARUM DIESE DATEI EXISTIERT (ADR-0005, ADR-0006). Der Port darf seine
// Adapter nicht kennen; die Regel ist mechanisiert. Trotzdem muss jemand
// entscheiden, welcher Adapter läuft. Diese Datei ist dieser Jemand. Sie ist
// ausdrücklich KEIN Port und kein zweiter Einstieg zum Speicher — sie
// verdrahtet und gibt zurück.
//
// `memory` ist die Voreinstellung und bleibt es für `npm run demo` und
// `npm run evals`: das ist die Zusage K5 (`clone → install → demo` läuft ohne
// Infrastruktur). Der Postgres-Adapter tritt in Etappe 3 daneben; der
// Entscheidungspunkt, ob die Demo dann wechselt, steht dort als ADR-Pflicht.

import { createStore } from "./store/index.js";
import { createMemoryAdapter } from "./store/memory.js";

const ADAPTER = {
  memory: createMemoryAdapter,
};

// Ein unbekannter Name wirft, statt still auf `memory` zurückzufallen. Ein
// stiller Rückfall wäre genau der Ausfall, den dieses Repo behandelt: es läuft
// weiter, misst aber etwas anderes als das, was jemand konfiguriert hat.
export function baueStore(name = "memory") {
  const fabrik = ADAPTER[name];
  if (!fabrik) {
    throw new Error(
      `baueStore: unbekannter Store-Adapter "${name}" (bekannt: ${Object.keys(ADAPTER).join(", ")}).`,
    );
  }
  return createStore(fabrik());
}
