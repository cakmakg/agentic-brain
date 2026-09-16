// ── domains/besprechung/ontology.js ──────────────────────────────────────
// Die Ontologie der Domäne `besprechung` (ADR-0010). Sie sagt, WAS es in
// dieser Welt gibt: welche Entitäten, welche Relationen zwischen ihnen, und
// welche Wirkung ein Agent überhaupt auslösen darf.
//
// SIE STEHT IN DER DOMÄNE, NICHT IM KERN. Der Kern kennt ein allgemeines
// Berechtigungsmodell (Mandant, Sichtbarkeit, Gruppen, Besitzer, Freigaben) —
// aber keinen einzigen Entitätstyp. Prüfkriterium:
//
//   grep -rn "besprechung" src/kernel/    # muss leer bleiben
//
// REINE DATEN PLUS PRÜFUNG, kein IO. Diese Datei importiert nichts.
//
// WOZU SIE DA IST — zwei Dinge, beide später fällig:
//
//   1. `acl.js` übersetzt die berechtigungstragenden Relationen in die
//      Envelope des Kerns. Welche das sind, steht unten ausdrücklich an der
//      Relation und nicht im Kopf desjenigen, der `acl.js` schreibt.
//   2. Ab Etappe 5 (A4) wird `actions.js` aus `AKTIONSTYPEN` ERZEUGT und
//      gegen diese Liste geprüft. Was hier nicht modelliert ist, kann dann
//      kein Agent auslösen — auch kein übernommener. Heute ist das noch eine
//      Absicht; `pruefeAktionsflaeche` unten macht sie schon jetzt prüfbar.

// ── Entitäten ────────────────────────────────────────────────────────────
// Sieben. `docs/roadmap.md` §5 setzt den Rahmen auf 5–9, und der Rahmen ist
// kein Geschmack: unter fünf ist es kein Modell, über neun bildet man das
// Unternehmen ab statt den Ablauf. `pruefeOntologie` prüft die Grenze mit.
//
// `traegtBerechtigung` markiert die drei Entitäten, an denen im Quellsystem
// wirklich eine Berechtigung hängt. Alles andere erbt oder ist Folge.
export const ENTITAETEN = {
  Person: {
    schluessel: "personId",
    felder: ["name", "tenantId"],
    traegtBerechtigung: false,
    hinweis: "Ein Mensch. Wird in Etappe 4 zum aufgelösten Principal.",
  },
  Team: {
    schluessel: "teamId",
    felder: ["name", "tenantId"],
    traegtBerechtigung: false,
    hinweis: "Die Gruppe des Berechtigungsmodells. Bildet erlaubteGruppen.",
  },
  Ordner: {
    schluessel: "ordnerId",
    felder: ["name", "tenantId"],
    traegtBerechtigung: true,
    hinweis:
      "Der Ort im Notizenlaufwerk. Trägt die Sichtbarkeit und VERERBT sie an " +
      "Unterordner — die Kette muss bis zur Wurzel gelaufen werden.",
  },
  Besprechung: {
    schluessel: "besprechungId",
    felder: ["titel", "datum", "tenantId"],
    traegtBerechtigung: true,
    hinweis:
      "Trägt die Teilnehmerliste. Sie ist der Mechanismus, der sich ÄNDERT — " +
      "daraus entsteht der Entzugsfall von Metrik 3.14.",
  },
  Notiz: {
    schluessel: "notizId",
    felder: ["titel", "text", "tenantId"],
    traegtBerechtigung: true,
    hinweis:
      "Das Dokument, das ingestiert wird. Trägt die Einzelfreigaben — die " +
      "Ausnahme, die die Ordnerregel aufhebt (ADR-0012).",
  },
  Aktionspunkt: {
    schluessel: "aktionspunktId",
    felder: ["text", "faelligAm"],
    traegtBerechtigung: false,
    hinweis:
      "Was der produzierende Agent aus einer Notiz zieht. Erbt die " +
      "Berechtigung der Notiz — er darf nie weiter reisen als seine Quelle.",
  },
  Ticket: {
    schluessel: "ticketId",
    felder: ["titel", "beschreibung", "status"],
    traegtBerechtigung: false,
    hinweis:
      "Die Außenwirkung. Entsteht NUR über die Aktions-Queue und nur nach " +
      "menschlicher Genehmigung.",
  },
};

// ── Relationen ───────────────────────────────────────────────────────────
// Vierzehn, Rahmen 10–20 nach `docs/roadmap.md` §5.
//
// `berechtigungstragend: true` heißt: über diese Kante entsteht Sichtbarkeit.
// Genau diese vier Kanten übersetzt `acl.js` in die Envelope — und keine
// andere. Das ist der Grund, warum die Markierung hier steht und nicht dort:
// wer eine Kante hinzufügt, entscheidet an derselben Stelle mit, ob sie
// Berechtigung trägt. Nachträglich fällt so etwas niemandem auf.
export const RELATIONEN = [
  { von: "Person", name: "gehoert_zu", nach: "Team", kardinalitaet: "n:m" },

  {
    von: "Ordner",
    name: "liegt_in",
    nach: "Ordner",
    kardinalitaet: "n:1",
    berechtigungstragend: true,
    hinweis: "Die Vererbungskette. Ohne Zyklus, Wurzel hat keinen Elternteil.",
  },
  {
    von: "Ordner",
    name: "sichtbar_fuer",
    nach: "Team",
    kardinalitaet: "n:m",
    berechtigungstragend: true,
    hinweis: "Wird zu envelope.erlaubteGruppen, NACH Auflösung der Kette.",
  },
  { von: "Notiz", name: "liegt_in", nach: "Ordner", kardinalitaet: "n:1" },
  {
    von: "Notiz",
    name: "freigegeben_an",
    nach: "Person",
    kardinalitaet: "n:m",
    berechtigungstragend: true,
    hinweis: "Die Ausnahme. Wird zu envelope.erlaubtePersonen (ADR-0012).",
  },

  {
    von: "Besprechung",
    name: "hat_organisator",
    nach: "Person",
    kardinalitaet: "n:1",
  },
  {
    von: "Besprechung",
    name: "hat_teilnehmer",
    nach: "Person",
    kardinalitaet: "n:m",
    berechtigungstragend: true,
    hinweis:
      "Teilnehmer sehen die Notiz ihrer Besprechung — auch wenn der Ordner " +
      "sie ausschließt. Ändert sich am häufigsten; Quelle des Entzugsfalls.",
  },
  { von: "Besprechung", name: "erzeugt", nach: "Notiz", kardinalitaet: "1:n" },

  {
    von: "Notiz",
    name: "enthaelt",
    nach: "Aktionspunkt",
    kardinalitaet: "1:n",
  },
  {
    von: "Aktionspunkt",
    name: "verantwortlich",
    nach: "Person",
    kardinalitaet: "n:1",
  },
  { von: "Aktionspunkt", name: "betrifft", nach: "Team", kardinalitaet: "n:1" },
  {
    von: "Aktionspunkt",
    name: "wird_zu",
    nach: "Ticket",
    kardinalitaet: "1:1",
  },

  {
    von: "Ticket",
    name: "zugewiesen_an",
    nach: "Person",
    kardinalitaet: "n:1",
  },
  {
    von: "Ticket",
    name: "verweist_auf",
    nach: "Notiz",
    kardinalitaet: "n:1",
    hinweis:
      "Herkunft. Ohne sie ist ein Ticket eine Behauptung ohne Beleg — und " +
      "niemand kann prüfen, ob der Agent den Aktionspunkt erfunden hat.",
  },
];

// ── Aktionstypen ─────────────────────────────────────────────────────────
// Die erste Liste, wie `docs/roadmap.md` §5 sie für Etappe 3 verlangt. Jeder
// Typ nennt die Entität, auf die er wirkt, und ob er nach außen wirkt.
//
// `nachAussen: true` heißt: hinter der HITL-Kante, über die Aktions-Queue,
// niemals aus einem Agenten heraus. Diese Liste ist die Vorlage, aus der
// Etappe 5 `actions.js` erzeugt.
export const AKTIONSTYPEN = {
  TICKET_ANLEGEN: {
    wirktAuf: "Ticket",
    ausEntitaet: "Aktionspunkt",
    nachAussen: true,
    hinweis: "Legt ein Ticket aus einem freigegebenen Aktionspunkt an.",
  },
  TICKET_ZUWEISEN: {
    wirktAuf: "Ticket",
    ausEntitaet: "Person",
    nachAussen: true,
    hinweis: "Weist ein bestehendes Ticket einer verantwortlichen Person zu.",
  },
  ZUSAMMENFASSUNG_SENDEN: {
    wirktAuf: "Notiz",
    ausEntitaet: "Besprechung",
    nachAussen: true,
    hinweis:
      "Schickt die Zusammenfassung an die Teilnehmer. Bewusst dabei: eine " +
      "Zustellung an den falschen Verteiler ist ein Leck ohne Retrieval.",
  },
};

// ── Prüfung ──────────────────────────────────────────────────────────────
// Eine Ontologie, die niemand prüft, driftet von dem ab, was der Code tut.
// Diese Funktion wirft; sie wird im Test aufgerufen. Sie prüft drei Dinge,
// die man beim Erweitern wirklich falsch macht:
//
//   1. eine Relation zeigt auf eine Entität, die es nicht (mehr) gibt
//   2. die Rahmen aus `docs/roadmap.md` §5 werden verlassen
//   3. ein Aktionstyp nennt eine Entität, die es nicht gibt
export const RAHMEN = {
  entitaeten: { min: 5, max: 9 },
  relationen: { min: 10, max: 20 },
};

export function pruefeOntologie() {
  const namen = Object.keys(ENTITAETEN);

  const anzahlE = namen.length;
  if (anzahlE < RAHMEN.entitaeten.min || anzahlE > RAHMEN.entitaeten.max) {
    throw new Error(
      `Ontologie: ${anzahlE} Entitäten, erlaubt sind ${RAHMEN.entitaeten.min}–${RAHMEN.entitaeten.max}.`,
    );
  }

  const anzahlR = RELATIONEN.length;
  if (anzahlR < RAHMEN.relationen.min || anzahlR > RAHMEN.relationen.max) {
    throw new Error(
      `Ontologie: ${anzahlR} Relationen, erlaubt sind ${RAHMEN.relationen.min}–${RAHMEN.relationen.max}.`,
    );
  }

  for (const r of RELATIONEN) {
    for (const seite of ["von", "nach"]) {
      if (!namen.includes(r[seite])) {
        throw new Error(
          `Ontologie: Relation "${r.von} ${r.name} ${r.nach}" zeigt auf unbekannte Entität "${r[seite]}".`,
        );
      }
    }
  }

  return { entitaeten: anzahlE, relationen: anzahlR };
}

// Die Aktionsfläche gegen die Ontologie halten. Ab Etappe 5 wird `actions.js`
// hieraus erzeugt; bis dahin ist das die Brücke, die den Gedanken schon jetzt
// prüfbar macht statt ihn nur zu behaupten.
export function pruefeAktionsflaeche(whitelist) {
  const namen = Object.keys(ENTITAETEN);
  const modelliert = Object.keys(AKTIONSTYPEN);

  for (const [typ, def] of Object.entries(AKTIONSTYPEN)) {
    for (const seite of ["wirktAuf", "ausEntitaet"]) {
      if (!namen.includes(def[seite])) {
        throw new Error(
          `Ontologie: Aktionstyp "${typ}" nennt unbekannte Entität "${def[seite]}".`,
        );
      }
    }
  }

  // Die Richtung ist Absicht: geprüft wird, ob die WHITELIST über die
  // Ontologie hinausgeht — nicht umgekehrt. Ein modellierter Typ, den noch
  // niemand freigeschaltet hat, ist harmlos; ein freigeschalteter Typ ohne
  // Modell ist genau die Lücke, die A4 schließen soll.
  const unmodelliert = whitelist.filter((t) => !modelliert.includes(t));
  if (unmodelliert.length > 0) {
    throw new Error(
      `Aktionsfläche: [${unmodelliert.join(", ")}] steht auf der Whitelist, ist aber nicht in der Ontologie modelliert.`,
    );
  }

  return { modelliert: modelliert.length, freigeschaltet: whitelist.length };
}

// Die berechtigungstragenden Kanten, die `acl.js` übersetzen muss. Als
// abgeleitete Liste, damit sie nicht zweimal geschrieben wird und
// auseinanderlaufen kann.
export const BERECHTIGUNGSKANTEN = RELATIONEN.filter(
  (r) => r.berechtigungstragend,
).map((r) => `${r.von}.${r.name}`);
