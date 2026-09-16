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

export const DOMAENEN = ["beispiel", "besprechung"];

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
  // Seit Etappe 3b Pflicht, aus demselben Grund. Eine Domäne ohne Connector
  // trägt `{ faelle: [] }`; die Nenner-Probe meldet 3.14 dann als ungemessen
  // statt als 0 %. Ein optionales Feld hätte hier zur Folge, dass eine
  // Domäne ihren Entzug still nie prüft und der Bericht trotzdem grün meldet.
  "entzug",
  // Seit dem 2026-09-16 Pflicht (ADR-0017). Die beiden Felder oben fangen die
  // FEHLENDE Fallliste. Was sie nicht fangen: eine Liste, die erst da war und
  // dann leer wird. Der Nenner fällt auf null, `erfuellt` wird `null`, und
  // `null` galt im Urteil als „nicht gefallen" — der Lauf blieb grün, obwohl
  // die Metrik nichts mehr misst. Genau der stille Ausfall, gegen den dieses
  // Gerüst gebaut ist.
  //
  // `ungemessen` ist die Gegenmaßnahme und ein Objekt `{ "3.14": "Grund" }`:
  // die Domäne benennt, welche Pflichtmetrik bei ihr **nicht** messbar ist und
  // warum. Alles, was nicht hier steht, muss gemessen UND erfüllt sein, sonst
  // ist der Lauf rot. Eine Domäne ohne Ausnahmen trägt `{}` — auch das eine
  // Aussage, kein Versehen.
  "ungemessen",
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
