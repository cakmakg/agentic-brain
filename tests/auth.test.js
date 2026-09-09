// ── tests/auth.test.js ───────────────────────────────────────────────────
// MOAT Layer 3 — der Schlüssel wird GEPRÜFT, nicht bereinigt.
//
// Bereinigte man den Schlüssel statt ihn abzulehnen, würde aus
// `d!e!v!-!l!o!c!a!l!-!k!e!y` ein gültiger Schlüssel: eine Bereinigung
// vergrößert den akzeptierten Schlüsselraum still. Fail-closed heißt ablehnen,
// nicht zurechtbiegen — und `req.clientId` trägt den GESENDETEN Wert, sonst
// weichen Rate-Limit und Audit von der tatsächlichen Eingabe ab.

import { test } from "node:test";
import assert from "node:assert/strict";

// Vor dem Import setzen: env.js liest process.env beim Laden.
process.env.API_KEY = "test-schluessel-123";
const { authMiddleware } = await import("../src/kernel/governance/auth.js");

const GUELTIG = "test-schluessel-123";

// Minimaler Express-Ersatz. Der Schlüssel kommt AUSSCHLIESSLICH aus dem Header.
function lauf(key, extra = {}) {
  const req = {
    header: (n) => (n === "x-api-key" ? key : undefined),
    ...extra,
  };
  const res = {
    code: null,
    body: null,
    status(c) {
      this.code = c;
      return this;
    },
    json(o) {
      this.body = o;
      return this;
    },
  };
  let weiter = false;
  authMiddleware(req, res, () => {
    weiter = true;
  });
  return { req, res, weiter };
}

test("Gültiger Schlüssel → durchgelassen, clientId ist der gesendete Wert", () => {
  const { req, weiter } = lauf(GUELTIG);
  assert.equal(weiter, true);
  assert.equal(req.clientId, GUELTIG);
});

test("Ungültige Zeichen werden ABGELEHNT, nicht bereinigt", () => {
  const { res, weiter } = lauf("t!e!s!t!-!s!c!h!l!u!e!s!s!e!l!-!1!2!3");
  assert.equal(weiter, false);
  assert.equal(res.code, 401);
});

test("Mit Leerzeichen gepolstert → 401", () => {
  const { res, weiter } = lauf(`  ${GUELTIG}  `);
  assert.equal(weiter, false);
  assert.equal(res.code, 401);
});

test("Fehlender Header → 401", () => {
  const { res, weiter } = lauf(undefined);
  assert.equal(weiter, false);
  assert.equal(res.code, 401);
});

test("Formal gültiger, aber falscher Schlüssel → 401", () => {
  const { res, weiter } = lauf("falscher-schluessel");
  assert.equal(weiter, false);
  assert.equal(res.code, 401);
});

test("Key Smuggling: der Schlüssel in Body oder Query zählt nicht", () => {
  const { res, weiter } = lauf(undefined, {
    body: { apiKey: GUELTIG },
    query: { api_key: GUELTIG },
  });
  assert.equal(weiter, false, "Nur der Header x-api-key wird gelesen");
  assert.equal(res.code, 401);
});

test("Ein zu langer Schlüssel (129 Zeichen) → 401", () => {
  const { res, weiter } = lauf("a".repeat(129));
  assert.equal(weiter, false);
  assert.equal(res.code, 401);
});

test("Die Fehlerantwort verrät nichts über den erwarteten Schlüssel", () => {
  const { res } = lauf("falsch");
  assert.equal(typeof res.body.error, "string");
  assert.doesNotMatch(res.body.error, new RegExp(GUELTIG));
});
