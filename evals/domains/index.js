// ── evals/domains/index.js ───────────────────────────────────────────────
// Die Registrierung der Domänen für den Harness — dasselbe Muster wie
// src/kernel/registry.js, eine Ebene höher: der Runner kennt KEINE Domäne, er
// kennt nur diese Liste. Ein Eintrag hier ist Konfiguration, kein Wissen im
// Runner.
//
// Bewusst eine EXPLIZITE Liste statt eines Verzeichnis-Scans. Ein Scan nähme
// eine Domäne still aus der Messung, sobald ihre Datei anders heißt — und der
// Harness meldete weiter grün. Genau dieser Ausfall („es läuft, aber es misst
// nichts mehr") ist der Fehler, den dieses Gerüst behandelt. Ein fehlender
// Adapter muss laut sein.

export const DOMAENEN = ["beispiel"];

// Was ein Adapter mitbringen muss, damit der Runner ohne Domänenwissen fährt.
const PFLICHTFELDER = [
  "name",
  "eingang",
  "guardrailSchwellen",
  "runner",
  "artefaktstatus",
  "aktionen",
  "datensatz",
  // Seit Etappe 2 Pflicht. Eine Domäne ohne Retrieval trägt eine leere
  // Fallliste — das ist eine Aussage, kein Versehen. Optional wäre schlimmer:
  // dann fiele 3.13 still weg und der Bericht meldete weiter grün.
  "retrieval",
];

export async function ladeAdapter(name) {
  if (!DOMAENEN.includes(name)) {
    throw new Error(
      `Unbekannte Domäne "${name}" (bekannt: ${DOMAENEN.join(", ")}).`,
    );
  }
  // Dynamisch, nicht statisch: ein Adapter zieht seine Domäne mit und damit
  // deren Registrierung. Das darf erst geschehen, wenn der Runner TRACE_DIR und
  // STATE_DIR gesetzt hat — sonst schriebe der erste Lauf neben das Ziel.
  const { adapter } = await import(`./${name}/adapter.js`);
  for (const feld of PFLICHTFELDER) {
    if (adapter?.[feld] === undefined) {
      throw new Error(`Adapter der Domäne "${name}": Feld "${feld}" fehlt.`);
    }
  }
  if (adapter.name !== name) {
    throw new Error(
      `Adapter unter evals/domains/${name}/ nennt sich "${adapter.name}".`,
    );
  }
  return adapter;
}
