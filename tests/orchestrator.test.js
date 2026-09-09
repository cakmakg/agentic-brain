// ── tests/orchestrator.test.js ───────────────────────────────────────────
// Die deterministischen Bremsen, jede einzeln. Sie lösen den Grossteil der
// Routing-Fälle ohne LLM-Kosten; brechen sie, wird das System teuer UND
// nichtdeterministisch.
//
// Ein Test je Bremse ist kein Zeremoniell: die Reihenfolge der Bremsen IST die
// Aussage der Domäne. Wer eine Bremse verschiebt, verschiebt eine Zusage — und
// genau das soll hier auffallen.

import { test, before } from "node:test";
import assert from "node:assert/strict";

import { MOCK_LLM } from "../src/kernel/config/env.js";
import { orchestratorNode } from "../src/domains/beispiel/domain.js";

import { frischerZustand } from "./helpers/zustand.js";

// Eigenes Zustandsverzeichnis je Testdatei — sonst sähe der zweite
// `npm test`-Lauf den Zustand des ersten.
frischerZustand();

// Ein Zustand, in dem KEINE Bremse greift, als Ausgangspunkt zum Verbiegen.
const zustand = (over = {}) => ({
  task: "Aufgabe",
  ergebnis: "",
  istFreigegeben: null, // „ungeprüft" — nicht „abgelehnt"
  gruende: "",
  revisionCount: 0,
  abgelegt: false,
  humanApproval: null,
  zugestellt: false,
  ...over,
});

before(() => {
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  );
});

test("BREMSE 1: zugestellt → END", async () => {
  const r = await orchestratorNode(zustand({ zugestellt: true }));
  assert.equal(r.nextAgent, "END");
});

test("BREMSE 2: abgelegt, keine menschliche Entscheidung → human_approval", async () => {
  const r = await orchestratorNode(
    zustand({ abgelegt: true, humanApproval: null }),
  );
  assert.equal(r.nextAgent, "human_approval");
});

test("BREMSE 2 geht der Datenlogik VOR: auch ohne Ergebnis zum Menschen", async () => {
  // Reihenfolge ist Bedeutung: die HITL-Entscheidung wird niemals dem LLM
  // überlassen und niemals von einer späteren Bremse überholt.
  const r = await orchestratorNode(zustand({ abgelegt: true, ergebnis: "" }));
  assert.equal(r.nextAgent, "human_approval");
});

test("BREMSE 3: Durchgangslimit erreicht → human_approval (Schutzschalter)", async () => {
  const r = await orchestratorNode(
    zustand({ revisionCount: 5, ergebnis: "da" }),
  );
  assert.equal(r.nextAgent, "human_approval");
  assert.match(r.log[0], /BREMSE3/);
});

test("BREMSE 4: kein Ergebnis → bearbeiter", async () => {
  const r = await orchestratorNode(zustand());
  assert.equal(r.nextAgent, "bearbeiter");
});

test("BREMSE 5: Ergebnis da, aber ungeprüft → pruefer (QA-Tor)", async () => {
  const r = await orchestratorNode(zustand({ ergebnis: "da" }));
  assert.equal(r.nextAgent, "pruefer");
});

test("BREMSE 6: Prüfung abgelehnt → zurück an den bearbeiter", async () => {
  const r = await orchestratorNode(
    zustand({ ergebnis: "da", istFreigegeben: false }),
  );
  assert.equal(r.nextAgent, "bearbeiter");
  assert.match(r.log[0], /BREMSE6/);
});

test("BREMSE 7: freigegeben, noch nicht abgelegt → ablage", async () => {
  const r = await orchestratorNode(
    zustand({ ergebnis: "da", istFreigegeben: true }),
  );
  assert.equal(r.nextAgent, "ablage");
});

test("null ist NICHT false: der dokumentierte Fehler an dieser Stelle", async () => {
  // Der klassische Fehler ist, beide Werte gleich zu behandeln. Dann routet
  // ein abgelehntes Ergebnis wieder zum Prüfer statt zum Bearbeiter — der
  // Prüfer ruft sich endlos selbst an, bis das Rekursionslimit greift.
  // `null` heißt „ungeprüft", `false` heißt „abgelehnt": zwei Zustände.
  const ungeprueft = await orchestratorNode(zustand({ ergebnis: "da" }));
  const abgelehnt = await orchestratorNode(
    zustand({ ergebnis: "da", istFreigegeben: false }),
  );
  assert.equal(ungeprueft.nextAgent, "pruefer");
  assert.equal(abgelehnt.nextAgent, "bearbeiter");
  assert.notEqual(
    ungeprueft.nextAgent,
    abgelehnt.nextAgent,
    "Behandelt eine Änderung null und false wieder gleich, wird genau hier rot",
  );
});

test("BREMSE 2 geht dem QA-Tor VOR: abgelegt und ungeprüft → trotzdem Mensch", async () => {
  // Sonst könnte ein späteres Urteil des Prüfers die HITL-Entscheidung
  // überholen. Die Reihenfolge ist die Zusage.
  const r = await orchestratorNode(
    zustand({ ergebnis: "da", abgelegt: true, istFreigegeben: null }),
  );
  assert.equal(r.nextAgent, "human_approval");
});

test("SCHICHT 2: greift keine Bremse, entscheidet das LLM — im Mock sicher END", async () => {
  // Alle Bremsen umgangen: abgelegt, geprüft UND freigegeben, menschlich
  // entschieden, noch nicht zugestellt.
  const r = await orchestratorNode(
    zustand({
      ergebnis: "da",
      istFreigegeben: true,
      abgelegt: true,
      humanApproval: true,
    }),
  );
  assert.equal(r.nextAgent, "END");
  assert.match(r.log[0], /LLM-Routing/);
});

// Nicht abgedeckt: SCHICHT 3 (Override eines ungültigen Agenten). Sie ist nur
// erreichbar, wenn ein echtes Modell einen Agenten außerhalb des Enums liefert;
// im Mock-Modus erzwingt der mockFactory bereits ein gültiges END. Diese Lücke
// gehört zur Qualitätsschicht, nicht hierher.
