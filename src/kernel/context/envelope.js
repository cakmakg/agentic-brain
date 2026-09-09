// ── kernel/context/envelope.js ───────────────────────────────────────────
// Die Envelope: was ein Chunk über seine Herkunft und seine Berechtigung mit
// sich trägt. Reine Datenstruktur plus Prüfung, kein IO.
//
// ADR-0009: die Berechtigung wird NICHT am Dokument geführt und beim Suchen
// nachgeschlagen, sondern auf JEDEN Chunk vererbt. Der Unterschied ist nicht
// Geschmack: ein Nachschlagen ist ein Join, und einen Join kann man vergessen.
// Eine mitgetragene Envelope kann man nicht vergessen — es gibt keinen Chunk
// ohne sie, das erzwingt `pruefeEnvelope` beim Ingest.
//
// Der Preis steht in derselben ADR: dieselbe Berechtigung liegt an jedem Chunk
// eines Dokuments. Ändert sie sich, müssen alle nachgezogen werden. Genau das
// misst Etappe 3 als 3.14 (Latenz des Berechtigungsentzugs).
//
// DIESE DATEI KENNT KEINE DOMÄNE. Sie beschreibt ein allgemeines
// Berechtigungsmodell — Mandant, Sichtbarkeit, Gruppen, Besitzer —, keine
// Ontologie. Welche Quelle welches Modell mitbringt, entscheidet die Domäne.

// Die drei Sichtbarkeiten. Bewusst wenige und bewusst überschneidungsfrei:
// jede Stufe ist echt enger als die vorige, damit „darf sehen" eine Ordnung
// ist und keine Sammlung von Sonderfällen.
//
//   oeffentlich  jeder Principal desselben Mandanten
//   gruppe       nur Mitglieder von `erlaubteGruppen` (und der Besitzer)
//   privat       nur der Besitzer
export const SICHTBARKEITEN = ["oeffentlich", "gruppe", "privat"];

// Ein Chunk ohne diese Felder darf nicht entstehen. Die Liste ist die
// Datenstruktur-Fassung der Zusage aus ADR-0009.
const PFLICHTFELDER = [
  "tenantId",
  "quelle",
  "dokumentId",
  "sichtbarkeit",
  "besitzerId",
];

// Wirft statt zurückzugeben: eine unvollständige Envelope ist kein Randfall,
// den der Aufrufer abwägen darf, sondern ein Programmfehler. Sie durchzulassen
// hieße, einen Chunk ohne Berechtigung in den Speicher zu schreiben — und der
// Filter hätte danach nichts, woran er ihn ablehnen könnte.
export function pruefeEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw new Error("envelope: fehlt oder ist kein Objekt.");
  }
  for (const feld of PFLICHTFELDER) {
    const wert = envelope[feld];
    if (typeof wert !== "string" || wert === "") {
      throw new Error(`envelope: Feld "${feld}" fehlt oder ist leer.`);
    }
  }
  if (!SICHTBARKEITEN.includes(envelope.sichtbarkeit)) {
    throw new Error(
      `envelope: unbekannte Sichtbarkeit "${envelope.sichtbarkeit}" (erlaubt: ${SICHTBARKEITEN.join(", ")}).`,
    );
  }
  // `gruppe` ohne Gruppen wäre eine Sichtbarkeit, die niemanden einschließt
  // außer dem Besitzer — also in Wahrheit `privat`. Zwei Schreibweisen für
  // denselben Zustand sind der Anfang von Drift; deshalb abgelehnt.
  if (envelope.sichtbarkeit === "gruppe" && !envelope.erlaubteGruppen?.length) {
    throw new Error(
      'envelope: Sichtbarkeit "gruppe" ohne erlaubteGruppen — das wäre "privat".',
    );
  }
  return envelope;
}

// Baut die Envelope eines Chunks aus der des Dokuments. Eine eigene Funktion,
// obwohl sie fast nur kopiert: hier steht die Vererbung als benannte Handlung,
// statt als Spread irgendwo in der Pipeline zu verschwinden.
export function erbeEnvelope(dokumentEnvelope) {
  pruefeEnvelope(dokumentEnvelope);
  return {
    tenantId: dokumentEnvelope.tenantId,
    quelle: dokumentEnvelope.quelle,
    dokumentId: dokumentEnvelope.dokumentId,
    sichtbarkeit: dokumentEnvelope.sichtbarkeit,
    erlaubteGruppen: [...(dokumentEnvelope.erlaubteGruppen ?? [])],
    besitzerId: dokumentEnvelope.besitzerId,
  };
}

// Der Principal: wer fragt. Bis Etappe 4 eine BEHAUPTUNG des Aufrufers, keine
// geprüfte Identität (ADR-0009) — in Schicht A kommt er aus Fixtures. Was hier
// geprüft wird, ist deshalb nicht „ist das echt", sondern „ist das überhaupt
// auflösbar". Alles andere wäre eine Zusage, die diese Ebene nicht halten kann.
export function istPrincipalAufloesbar(principal) {
  return Boolean(
    principal &&
    typeof principal.tenantId === "string" &&
    principal.tenantId !== "" &&
    typeof principal.benutzerId === "string" &&
    principal.benutzerId !== "" &&
    Array.isArray(principal.gruppen),
  );
}
