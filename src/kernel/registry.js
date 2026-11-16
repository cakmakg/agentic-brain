// ── kernel/registry.js ───────────────────────────────────────────────────
// Domänen-Registrierung — Konfiguration, kein Code.
//
// Der Kern kennt KEINE einzelne Domäne; er kennt nur diese Registry. Hier hängt
// das Prüfkriterium des Gerüsts: eine zweite Domäne kommt als Eintrag hinzu und
// ändert sonst null Zeilen im Kern.
//
// Ein Eintrag in einer Registry ist Konfiguration, kein Kernwissen — deshalb
// zählt er beim Prüfkriterium nicht mit.

import { createRunner } from "./agent/runner.js";

const specs = new Map();
const runners = new Map();

const PFLICHTFELDER = ["name", "nodes", "entry", "hub", "spokes", "terminal"];

export function registerDomain(spec) {
  for (const feld of PFLICHTFELDER) {
    if (spec?.[feld] === undefined) {
      throw new Error(
        `registerDomain: Feld "${feld}" fehlt in der Spezifikation.`,
      );
    }
  }
  for (const knoten of [spec.entry, spec.hub, spec.terminal, ...spec.spokes]) {
    if (typeof spec.nodes[knoten] !== "function") {
      throw new Error(
        `registerDomain: Domäne "${spec.name}" nennt den Knoten "${knoten}", liefert aber keine Funktion dafür.`,
      );
    }
  }
  specs.set(spec.name, spec);
  return spec;
}

export function getDomain(name) {
  const spec = specs.get(name);
  if (!spec) {
    throw new Error(
      `getDomain: Domäne "${name}" ist nicht registriert (bekannt: ${listDomains().join(", ") || "keine"}).`,
    );
  }
  return spec;
}

// Ein Runner je Domäne. Der Checkpointer lebt im Arbeitsspeicher; zwei Runner
// derselben Domäne hätten getrennte Zustände und die Genehmigung liefe ins Leere.
//
// `optionen` (Uhr, Genehmigungsfrist) wirken nur beim ERSTEN Bau. Kommen sie
// bei einem schon gebauten Runner an, wird geworfen statt still ignoriert:
// sonst glaubte ein Aufrufer, mit seiner Frist zu laufen, und liefe mit der
// eines anderen — und ein Test für die Frist bestünde aus dem falschen Grund.
export function getRunner(name, optionen) {
  if (runners.has(name)) {
    if (optionen !== undefined) {
      throw new Error(
        `getRunner: der Runner der Domäne "${name}" ist schon gebaut — ` +
          "Optionen wirken nur beim ersten Aufruf.",
      );
    }
    return runners.get(name);
  }
  const runner = createRunner(getDomain(name), optionen);
  runners.set(name, runner);
  return runner;
}

export function listDomains() {
  return [...specs.keys()];
}
