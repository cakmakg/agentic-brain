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
// `memory` ist die Voreinstellung und bleibt es für `npm run demo`,
// `npm test` und `npm run evals`: das ist die Zusage K5, und ADR-0013 hat sie
// nach dem zweiten Adapter ausdrücklich bestätigt. Postgres tritt DANEBEN und
// wird nur gefahren, wenn jemand ihn ausdrücklich verlangt.
//
// WARUM DIE FABRIKEN DYNAMISCH GELADEN WERDEN. `postgres.js` importiert `pg`.
// Würde diese Datei es statisch einbinden, lüde jeder Testlauf und jede Demo
// den Datenbanktreiber mit — und ein Ladefehler in `pg` bräche ausgerechnet
// die Pfade, die mit Datenbanken nichts zu tun haben. Der `memory`-Pfad soll
// von der Existenz des zweiten Adapters NICHTS merken.

import { env } from "../config/env.js";
import { createStore } from "./store/index.js";
import { createEmbedding } from "./embedding/index.js";
import { mitZwischenspeicher } from "./embedding/zwischenspeicher.js";

// Name → wie man an die Fabrik kommt. Der Wert ist bewusst eine Funktion und
// kein Modul: erst der Aufruf lädt.
const ADAPTER = {
  memory: async () => (await import("./store/memory.js")).createMemoryAdapter,
  postgres: async () =>
    (await import("./store/postgres.js")).createPostgresAdapter,
};

// Dieselbe Bauart fuer das Embedding (ADR-0015). `hash` ist die
// Voreinstellung und traegt Schicht A und K5; `voyage` kostet je Aufruf Geld
// und wird ausdruecklich verlangt.
const EMBEDDING_ADAPTER = {
  hash: async () => (await import("./embedding/hash.js")).createHashAdapter,
  voyage: async () =>
    (await import("./embedding/voyage.js")).createVoyageAdapter,
};

export const ADAPTERNAMEN = Object.keys(ADAPTER);
export const EMBEDDINGNAMEN = Object.keys(EMBEDDING_ADAPTER);
export const EMBEDDING_VORGABE = env.embeddingAdapter;

// Ein unbekannter Name wirft — dieselbe Begruendung wie beim Store: ein
// stiller Rueckfall auf `hash` liefe weiter und maesse etwas anderes als das,
// was jemand konfiguriert hat.
export async function baueEmbedding(name = EMBEDDING_VORGABE, optionen = {}) {
  const hole = EMBEDDING_ADAPTER[name];
  if (!hole) {
    throw new Error(
      `baueEmbedding: unbekannter Embedding-Adapter "${name}" (bekannt: ${EMBEDDINGNAMEN.join(", ")}).`,
    );
  }
  const fabrik = await hole();

  // ── Der Zwischenspeicher liegt IMMER dazwischen (ADR-0016). ───────────
  // Er ist keine Option, weil die Zusage „ein zweiter Zyklus ueber
  // unveraenderte Dokumente fragt den Adapter nicht noch einmal" eine
  // Eigenschaft des Systems sein soll und nicht eine der Konfiguration. Fuer
  // einen deterministischen Adapter aendert er nichts Beobachtbares — genau
  // deshalb darf er ueberall liegen; abschalten laesst er sich mit
  // `EMBEDDING_CACHE_MAX=0`.
  //
  // Er sitzt VOR `createEmbedding`, damit die Pruefungen des Ports (Anzahl,
  // Breite) ueber das Ergebnis laufen, das der Aufrufer bekommt — und nicht
  // ueber das, was der Adapter vor dem Zusammensetzen geliefert hat.
  return createEmbedding(
    mitZwischenspeicher(fabrik(optionen), {
      max: optionen.cacheMax ?? env.embeddingCacheMax,
    }),
  );
}

// Welcher Adapter ohne ausdrückliche Angabe läuft. Über `STORE_ADAPTER`
// umstellbar — das ist der Weg, auf dem dieselbe Eval-Suite gegen Postgres
// gefahren wird, ohne dass irgendein Aufrufer geändert werden müsste.
export const VORGABE = env.storeAdapter;

// Ein unbekannter Name wirft, statt still auf `memory` zurückzufallen. Ein
// stiller Rückfall wäre genau der Ausfall, den dieses Repo behandelt: es läuft
// weiter, misst aber etwas anderes als das, was jemand konfiguriert hat.
export async function baueStore(name = VORGABE, optionen = {}) {
  const hole = ADAPTER[name];
  if (!hole) {
    throw new Error(
      `baueStore: unbekannter Store-Adapter "${name}" (bekannt: ${ADAPTERNAMEN.join(", ")}).`,
    );
  }
  // Das Embedding wird HIER gebaut und in denselben Speicher gereicht, in dem
  // die Chunks landen. Ein Aufrufer kann eines mitgeben (Tests tun das), aber
  // keiner muss — und keiner kann zwei verschiedene in einen Speicher bringen.
  const embedding = optionen.embedding ?? (await baueEmbedding());
  const fabrik = await hole();
  return createStore(fabrik({ ...optionen, embedding }), embedding);
}
