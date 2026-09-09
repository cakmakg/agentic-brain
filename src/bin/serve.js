// ── bin/serve.js ─────────────────────────────────────────────────────────
// Einstiegspunkt des HTTP-Servers: startet den Action-Worker und lauscht.
// Getrennt vom Adapter, damit `server.js` ohne Seiteneffekt importierbar bleibt —
// das ist die Voraussetzung dafür, dass die HTTP-Schicht je testbar wird.

import { env } from "../kernel/config/env.js";
import { app } from "../adapters/http/server.js";
import { startActionWorker } from "../domains/beispiel/actions.js";

startActionWorker();
app.listen(env.port, () =>
  console.log(
    `agentic-brain läuft → http://localhost:${env.port}  (LLM: ${env.anthropicKey ? "echt" : "MOCK"})`,
  ),
);
