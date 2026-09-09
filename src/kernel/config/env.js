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
