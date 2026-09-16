// ── kernel/config/env.js ────────────────────────────────────────────────────────
// Umgebungsvariablen an einer einzigen Stelle einlesen und prüfen. Regel: greif
// im Code NICHT überall auf process.env zu, sondern importiere aus dieser Datei.
// So gibt es auf die Frage "welche Umgebungsvariablen gibt es?" genau eine Antwort.

import fs from "node:fs";
import path from "node:path";

// Winziger .env-Loader (ohne zusätzliche Abhängigkeit). In Produktion dotenv verwenden.
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export const env = {
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.MODEL || "claude-sonnet-4-6",
  apiKey: process.env.API_KEY || "dev-local-key",
  monthlyBudgetUsd: Number(process.env.MONTHLY_BUDGET_USD || 5),
  port: Number(process.env.PORT || 3000),

  // Ein einziger Mandant — aber das Feld steht vom ersten
  // persistenten Schema an da und wird in JEDER Abfrage gefiltert. Eine Abfrage
  // ohne Mandantenfilter gilt als Defekt, auch solange es nur einen gibt.
  // Kommen später mehrere hinzu, ändert sich keine einzige Abfrage.
  tenantId: process.env.TENANT_ID || "default",

  // ── Der Chunk-Speicher (ab Etappe 3c) ──────────────────────────────────
  // Welcher Store-Adapter laeuft. Voreinstellung `memory`: das ist die Zusage
  // K5 (ADR-0013) — `clone -> install -> demo` und die gesamte Schicht-A-
  // Messung laufen ohne jede Infrastruktur. `postgres` wird ausdruecklich
  // verlangt, nie geraten.
  storeAdapter: process.env.STORE_ADAPTER || "memory",

  // ── Das Embedding (ab Etappe 3d) ───────────────────────────────────────
  // Welcher Embedding-Adapter laeuft. Voreinstellung `hash`: deterministisch,
  // kostenlos, ohne Schluessel — das traegt Schicht A und K5 (ADR-0015).
  // `voyage` wird ausdruecklich verlangt und kostet je Aufruf Geld.
  embeddingAdapter: process.env.EMBEDDING_ADAPTER || "hash",

  // Der Schluessel des Voyage-Adapters. Anthropic bietet KEIN eigenes
  // Embedding-Modell an und empfiehlt Voyage AI; das ist der Grund, warum
  // hier ein zweiter Anbieter steht. Leer heisst: der Adapter wirft, statt
  // ohne Schluessel zu starten. Gehoert in `.env`, nie in den Quellcode.
  voyageApiKey: process.env.VOYAGE_API_KEY || "",
  voyageModell: process.env.VOYAGE_MODEL || "voyage-4",
  // Die Vektorbreite. `voyage-4` kann 256, 512, 1024 (Vorgabe) und 2048; die
  // kuerzeren sind Praefixe der laengeren. Die Zahl steht im Vertrag mit dem
  // Postgres-Schema (`vector(n)`) — ein Wechsel braucht eine neue Tabelle.
  voyageDimensionen: Number(process.env.VOYAGE_DIMENSION || 1024),

  // Wie viele Vektoren der Zwischenspeicher haelt (ADR-0016). Er spart genau
  // das, was Geld kostet: den Einbettungsaufruf fuer Text, der sich seit dem
  // letzten Synchronisationszyklus nicht bewegt hat. Die Momentaufnahme
  // bleibt vollstaendig, die Entzugszusage bleibt strukturell (ADR-0011).
  //
  // 5000 Eintraege sind bei voyage-4 (1024 Dimensionen, float64) rund 40 MB.
  // Wer eine groessere Quelle faehrt, hebt die Zahl — bei einer Arbeitsmenge
  // ueber `max` faellt die Trefferquote auf null, nicht auf „etwas weniger".
  // `0` schaltet ihn ab: dann zahlt jeder Zyklus voll.
  embeddingCacheMax: Number(process.env.EMBEDDING_CACHE_MAX ?? 5000),

  // Die Verbindung des Postgres-Adapters. Leer heisst: es gibt keine, und der
  // Adapter wirft, statt eine zu raten. Ein Lauf gegen die falsche Datenbank
  // ist schlimmer als einer, der nicht startet. Gehoert in `.env`, nie in den
  // Quellcode.
  databaseUrl: process.env.DATABASE_URL || "",

  // Wohin der dauerhafte Zustand geschrieben wird. Überschreibbar wie
  // TRACE_DIR in governance/trace.js — Tests und der Harness zeigen damit
  // auf ein frisches Verzeichnis, sonst schleppt ein Lauf den vorigen mit und
  // der Determinismus-Nachweis wäre keiner mehr.
  stateDir: process.env.STATE_DIR || path.join(process.cwd(), ".zustand"),
};

// Fehlt der LLM-Schlüssel, greift der "Mock-Modus": es wird kein echter Aufruf
// gemacht. So läuft das System auch ohne API-Schlüssel Ende zu Ende — die
// Grundlage für deterministische Tests und Evaluationen.
export const MOCK_LLM = !env.anthropicKey;

// Erlaubt ein eigenes Modell pro Rolle (z.B. MODEL_CRITIC=claude-haiku-4-5),
// damit ein billigerer Grader nicht denselben Preis zahlt wie der Autor. Kennt
// bewusst KEINE Rollennamen — die Domäne entscheidet, wie ihre Rollen heißen
// (der Kern bleibt domänen-unwissend). Ohne Override greift env.model.
export function modelFor(role) {
  return process.env[`MODEL_${role.toUpperCase()}`] || env.model;
}
