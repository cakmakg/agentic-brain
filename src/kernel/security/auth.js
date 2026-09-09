// ── kernel/security/auth.js ─────────────────────────────────────────────────────
// MOAT Layer 3 — Authentifizierung. FAIL-CLOSED.
//
// Regeln:
//  • Der API-Key wird AUSSCHLIESSLICH aus dem Header x-api-key gelesen
//    (NICHT aus Body oder Query — das verhindert "Key Smuggling").
//  • Format: [A-Za-z0-9-_.], 1 bis 128 Zeichen. Was nicht passt, wird
//    ABGELEHNT — nicht bereinigt.
//  • Der Vergleich läuft laufzeitkonstant.
//  • Unbekannter Key → 401 (KEIN automatisches Anlegen eines Tenants).
//
// Warum prüfen statt bereinigen: eine Bereinigung vergrößert den
// akzeptierten Schlüsselraum still. Aus "d!e!v!-!l!o!c!a!l!-!k!e!y" wurde vorher ein
// gültiger Schlüssel, ebenso aus einem mit Leerzeichen gepolsterten. Zudem trug
// req.clientId den bereinigten statt den gesendeten Wert, wodurch Rate-Limit und
// Audit von der tatsächlichen Eingabe abwichen. Fail-closed heißt ablehnen, nicht
// zurechtbiegen.

import crypto from "node:crypto";
import { env } from "../config/env.js";

const API_KEY_MUSTER = /^[A-Za-z0-9\-_.]{1,128}$/;

// Prüft das FORMAT und verändert dabei nichts.
function hatGueltigesFormat(k) {
  return typeof k === "string" && API_KEY_MUSTER.test(k);
}

// Laufzeitkonstanter Vergleich. Beide Seiten werden zuerst gehasht, damit auch die
// LÄNGE nichts verrät — timingSafeEqual allein verlangt gleich lange Puffer und
// würde bei ungleicher Länge früh abbrechen.
function sindGleich(a, b) {
  const h = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest();
  return crypto.timingSafeEqual(h(a), h(b));
}

export function authMiddleware(req, res, next) {
  const key = req.header("x-api-key");
  if (!hatGueltigesFormat(key) || !sindGleich(key, env.apiKey)) {
    return res.status(401).json({ error: "x-api-key ungültig oder fehlt" });
  }
  req.clientId = key; // der GESENDETE Wert, nicht ein bereinigter
  next();
}
