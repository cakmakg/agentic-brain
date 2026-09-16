// ── tests/besprechung.test.js ────────────────────────────────────────────
// Die Vertikale aus ADR-0010: Ontologie, ACL-Übersetzung, Ausgabevertrag,
// Aktionsfläche.
//
// Diese Datei prüft die DOMÄNE, nicht den Kern. Sie ist zugleich der Beleg,
// dass eine zweite Domäne wirklich als Geschwister entsteht: sie importiert
// aus `src/domains/besprechung/` und aus dem Kern — aber der Kern importiert
// nichts von hier, und `grep -rn "besprechung" src/kernel/` bleibt leer.
//
// Der wertvollste Test ist „eine gebrochene Vererbung beendet die Kette".
// Vererbung ist ein Join, und ein Join ist die Stelle, an der ein Connector
// schweigend zu viel oder zu wenig liest.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ENTITAETEN,
  RELATIONEN,
  AKTIONSTYPEN,
  BERECHTIGUNGSKANTEN,
  RAHMEN,
  pruefeOntologie,
  pruefeAktionsflaeche,
} from "../src/domains/besprechung/ontology.js";
import {
  loeseOrdnerAuf,
  envelopeFuerNotiz,
  ORGANISATIONSWEIT,
} from "../src/domains/besprechung/acl.js";
import {
  pruefeVertrag,
  UNBESETZT,
  MIN_TEXT_LAENGE,
} from "../src/domains/besprechung/vertrag.js";
import { createNotizlaufwerk } from "../src/domains/besprechung/connectors/notizlaufwerk.js";
import { pruefeEnvelope } from "../src/kernel/context/envelope.js";

// Eine kleine Quelle, die alle drei Mechanismen einmal fährt.
const quelle = () => ({
  tenantId: "t1",
  quelle: "notizlaufwerk",
  ordner: [
    { ordnerId: "wurzel", elternId: null, sichtbarFuer: [ORGANISATIONSWEIT] },
    {
      ordnerId: "technik",
      elternId: "wurzel",
      erbt: false,
      sichtbarFuer: ["g-technik"],
    },
    { ordnerId: "archiv", elternId: "technik", sichtbarFuer: [] },
  ],
  besprechungen: [
    {
      besprechungId: "b1",
      organisatorId: "bruno",
      teilnehmer: ["bruno", "anna"],
    },
  ],
  notizen: [
    {
      notizId: "n1",
      besprechungId: "b1",
      ordnerId: "technik",
      titel: "T",
      text: "Rollout offene Punkte",
      freigegebenAn: ["dora"],
      vertraulich: false,
    },
  ],
});

// ── Ontologie ────────────────────────────────────────────────────────────

test("Ontologie: sie prueft sich selbst und haelt die Rahmen aus der Roadmap", () => {
  const { entitaeten, relationen } = pruefeOntologie();
  assert.ok(entitaeten >= RAHMEN.entitaeten.min);
  assert.ok(entitaeten <= RAHMEN.entitaeten.max);
  assert.ok(relationen >= RAHMEN.relationen.min);
  assert.ok(relationen <= RAHMEN.relationen.max);
  assert.equal(entitaeten, Object.keys(ENTITAETEN).length);
  assert.equal(relationen, RELATIONEN.length);
});

test("Ontologie: jede Relation zeigt auf bekannte Entitaeten", () => {
  const namen = Object.keys(ENTITAETEN);
  for (const r of RELATIONEN) {
    assert.ok(namen.includes(r.von), `${r.von} unbekannt`);
    assert.ok(namen.includes(r.nach), `${r.nach} unbekannt`);
  }
});

test("Ontologie: die berechtigungstragenden Kanten sind genau die, die acl.js uebersetzt", () => {
  // Vier Kanten, und `acl.js` bildet genau diese ab: Ordner-Vererbung,
  // Ordner-Gruppe, Einzelfreigabe, Teilnehmerliste. Wächst die Liste hier,
  // ohne dass `acl.js` mitwächst, entsteht eine Berechtigung, die niemand
  // übersetzt — dieser Test fällt dann auf.
  assert.deepEqual(BERECHTIGUNGSKANTEN.sort(), [
    "Besprechung.hat_teilnehmer",
    "Notiz.freigegeben_an",
    "Ordner.liegt_in",
    "Ordner.sichtbar_fuer",
  ]);
});

test("Aktionsflaeche: ein Typ ohne Modell wird abgelehnt", () => {
  // Die Frühform von A4. Ab Etappe 5 wird die Whitelist erzeugt; bis dahin
  // wird sie wenigstens dagegen gehalten.
  assert.throws(
    () =>
      pruefeAktionsflaeche([...Object.keys(AKTIONSTYPEN), "TICKET_LOESCHEN"]),
    /nicht in der Ontologie modelliert/,
  );
  // Die andere Richtung ist harmlos: modelliert, aber nicht freigeschaltet.
  assert.doesNotThrow(() => pruefeAktionsflaeche(["TICKET_ANLEGEN"]));
});

test("Aktionsflaeche: die Whitelist der Domaene haelt der Ontologie stand", async () => {
  // Der Import selbst ist der Test: `actions.js` ruft `pruefeAktionsflaeche`
  // beim Laden und wirft, wenn die Whitelist über die Ontologie hinausgeht.
  const { whitelist } = await import("../src/domains/besprechung/actions.js");
  assert.deepEqual(whitelist.sort(), Object.keys(AKTIONSTYPEN).sort());
});

// ── ACL-Uebersetzung: die Vererbungskette ────────────────────────────────

test("ACL: ein Ordner ohne eigene Gruppe erbt die des Elternteils", () => {
  assert.deepEqual(loeseOrdnerAuf(quelle().ordner, "archiv"), ["g-technik"]);
});

test("ACL: eine gebrochene Vererbung beendet die Kette", () => {
  // `technik` trägt erbt: false. Der organisationsweite Eintrag der Wurzel
  // darf deshalb NICHT durchschlagen — sonst wäre jeder Unterordner eines
  // offenen Laufwerks offen, und die ganze Ordnerlogik wäre wirkungslos.
  const gruppen = loeseOrdnerAuf(quelle().ordner, "technik");
  assert.deepEqual(gruppen, ["g-technik"]);
  assert.ok(!gruppen.includes(ORGANISATIONSWEIT));
});

test("ACL: ein unbekannter Ordner wirft, statt leere Gruppen zu liefern", () => {
  // Leere Gruppen wären hier kein sicherer Wert, sondern ein erfundener:
  // die Notiz würde still „privat" und verschwände aus jeder Suche.
  assert.throws(
    () => loeseOrdnerAuf(quelle().ordner, "gibtsnicht"),
    /existiert/,
  );
});

test("ACL: ein Zyklus in der Ordnerkette wirft", () => {
  const q = quelle();
  q.ordner = [
    { ordnerId: "a", elternId: "b", sichtbarFuer: [] },
    { ordnerId: "b", elternId: "a", sichtbarFuer: [] },
  ];
  assert.throws(() => loeseOrdnerAuf(q.ordner, "a"), /Zyklus/);
});

// ── ACL-Uebersetzung: die Envelope ───────────────────────────────────────

test("ACL: Organisator wird Besitzer, Teilnehmer und Freigaben werden Personen", () => {
  const e = envelopeFuerNotiz(quelle(), quelle().notizen[0]);
  assert.equal(e.besitzerId, "bruno");
  assert.deepEqual(e.erlaubtePersonen.sort(), ["anna", "dora"]);
  // Der Organisator steht NICHT zusätzlich in den Personen: zwei Wege zu
  // derselben Aussage hieße, beim Entzug an zwei Stellen denken zu müssen.
  assert.ok(!e.erlaubtePersonen.includes("bruno"));
});

test("ACL: die uebersetzte Envelope ist fuer den Kern gueltig", () => {
  assert.doesNotThrow(() =>
    pruefeEnvelope(envelopeFuerNotiz(quelle(), quelle().notizen[0])),
  );
});

test("ACL: vertraulich schlaegt die Ordnergruppe — Q4 vor Q6", () => {
  // Die einzige Stelle, an der das Regelwerk eine echte Entscheidung trifft,
  // und sie geht in die restriktive Richtung. Andersherum wäre sie ein Leck
  // mit Ansage: die ganze Gruppe technik sähe eine vertrauliche Notiz.
  const q = quelle();
  q.notizen[0].vertraulich = true;
  const e = envelopeFuerNotiz(q, q.notizen[0]);
  assert.equal(e.sichtbarkeit, "privat");
  assert.deepEqual(e.erlaubteGruppen, []);
});

test("ACL: der organisationsweite Eintrag wird zu oeffentlich", () => {
  const q = quelle();
  q.notizen[0].ordnerId = "wurzel";
  assert.equal(envelopeFuerNotiz(q, q.notizen[0]).sichtbarkeit, "oeffentlich");
});

test("ACL: ohne jede Gruppe wird die Notiz privat, nicht oeffentlich", () => {
  // Die Voreinstellung geht nach unten. Ein Fehlschluss in die andere
  // Richtung wäre der teuerste, den dieses Regelwerk machen könnte.
  const q = quelle();
  q.ordner = [{ ordnerId: "leer", elternId: null, sichtbarFuer: [] }];
  q.notizen[0].ordnerId = "leer";
  assert.equal(envelopeFuerNotiz(q, q.notizen[0]).sichtbarkeit, "privat");
});

test("ACL: eine Notiz ohne Besprechung wirft", () => {
  const q = quelle();
  q.notizen[0].besprechungId = "gibtsnicht";
  assert.throws(
    () => envelopeFuerNotiz(q, q.notizen[0]),
    /unbekannte Besprechung/,
  );
});

// ── Der Connector ────────────────────────────────────────────────────────

test("Connector: er arbeitet auf einer KOPIE der Quelle", () => {
  // Zwei Läufe über dieselben Fixtures dürfen sich nicht sehen — sonst misst
  // der zweite Durchgang gealterten Zustand statt derselben Frage.
  const roh = quelle();
  const a = createNotizlaufwerk(roh);
  a.aendere({ art: "notiz-loeschen", notizId: "n1" });
  assert.equal(roh.notizen.length, 1, "das Original darf sich nicht ändern");
  assert.equal(createNotizlaufwerk(roh).connector.hole().length, 1);
});

test("Connector: eine unbekannte Aenderungsart wirft", () => {
  const { aendere } = createNotizlaufwerk(quelle());
  assert.throws(
    () => aendere({ art: "gibtsnicht" }),
    /unbekannte Änderungsart/,
  );
});

test("Connector: eine Aenderung ohne Wirkung wirft — der Fall belegt sonst nichts", () => {
  // Ein Entzugsfall, der gar nichts entzieht, meldete grün und hätte nichts
  // geprüft. Deshalb ist „war nicht drin" hier ein Fehler, kein No-op.
  const { aendere } = createNotizlaufwerk(quelle());
  assert.throws(
    () =>
      aendere({ art: "freigabe-entziehen", notizId: "n1", personId: "egon" }),
    /belegt nichts/,
  );
  assert.throws(
    () =>
      aendere({
        art: "teilnehmer-entfernen",
        besprechungId: "b1",
        personId: "egon",
      }),
    /belegt nichts/,
  );
  assert.throws(
    () => aendere({ art: "vererbung-brechen", ordnerId: "technik" }),
    /erbte ohnehin nicht/,
  );
});

test("Connector: jede Notiz wird zu einem Dokument mit erfasster Envelope", () => {
  const { connector } = createNotizlaufwerk(quelle());
  const dokumente = connector.hole();
  assert.equal(dokumente.length, 1);
  assert.equal(dokumente[0].envelope.quelle, "notizlaufwerk");
  assert.equal(dokumente[0].envelope.dokumentId, "n1");
  assert.match(dokumente[0].text, /Rollout offene Punkte/);
});

// ── Der Ausgabevertrag ───────────────────────────────────────────────────

test("Vertrag: eine vollstaendige Liste ist konform", () => {
  const urteil = pruefeVertrag([
    { text: "Rollout-Termin abstimmen", verantwortlich: "team-technik" },
  ]);
  assert.equal(urteil.istFreigegeben, true);
});

test("Vertrag: ein Punkt ohne Verantwortliche faellt durch", () => {
  const urteil = pruefeVertrag([
    { text: "Rollout-Termin abstimmen", verantwortlich: UNBESETZT },
  ]);
  assert.equal(urteil.istFreigegeben, false);
  assert.match(urteil.gruende, /verantwortliche Person/);
});

test("Vertrag: ein zu kurzer Text faellt durch", () => {
  const urteil = pruefeVertrag([
    { text: "x".repeat(MIN_TEXT_LAENGE - 1), verantwortlich: "team-technik" },
  ]);
  assert.equal(urteil.istFreigegeben, false);
  assert.match(urteil.gruende, /kuerzer/);
});

test("Vertrag: eine LEERE Liste ist konform — sie ist ein Ergebnis, kein Mangel", () => {
  // Wäre sie es nicht, liefe eine ergebnislose Besprechung fünf Revisionen
  // lang im Kreis, bis der Schutzschalter greift. BREMSE5 beendet sie vorher.
  assert.equal(pruefeVertrag([]).istFreigegeben, true);
});

test("Vertrag: gar keine Liste ist NICHT konform", () => {
  assert.equal(pruefeVertrag(undefined).istFreigegeben, false);
  assert.equal(pruefeVertrag(null).istFreigegeben, false);
});
