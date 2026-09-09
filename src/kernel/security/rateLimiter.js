// ── kernel/security/rateLimiter.js ──────────────────────────────────────────────
// MOAT Layer 2 — Rate-Limiting, nach Endpunkt gestaffelt: teure LLM-Endpunkte
// werden strenger begrenzt.
//
// Gründerlektion: Ein einziges globales Limit reicht nicht. Steck "teure"
// (LLM-aufrufende) und "billige" (nur lesende) Endpunkte in getrennte Eimer.

import rateLimit from "express-rate-limit";

const make = (max) =>
  rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.clientId || req.ip, // Tenant wenn vorhanden, sonst IP
    message: { error: "Rate-Limit überschritten" },
  });

export const globalLimiter = make(120); // Grundlinie
export const workflowLimiter = make(10); // teurer LLM-Ablauf
export const approveLimiter = make(20); // das Genehmigungstor
