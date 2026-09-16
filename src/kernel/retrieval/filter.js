// ── kernel/retrieval/filter.js ───────────────────────────────────────────
// Die ACL-Logik. REINE FUNKTIONEN: kein IO, kein Import aus `store/`, kein
// `node:fs`. Das ist keine Stilregel, sondern der Grund, warum diese Datei
// erschöpfend testbar ist — die wichtigste Zusage des Repos hängt an ihr.
//
// ADR-0008: der Filter wird IN DIE ABFRAGE KOMPILIERT, nicht nachgelagert
// angewandt. Ein unberechtigter Chunk wird nicht weggeworfen, nachdem er den
// Speicher verlassen hat — er verlässt ihn nie.
//
// ADR-0014, seit Etappe 3c: DIE REGELN STEHEN EINMAL, ES GIBT ZWEI KOMPILATE.
// Ein Speicher im Arbeitsspeicher braucht ein JavaScript-Prädikat, eine
// Datenbank braucht ein SQL-`WHERE`. Zwei getrennte Implementierungen wären
// die naheliegende Lösung und die gefährlichste: sie driften auseinander, und
// die Zahl, die das aufdecken müsste (3.13), misst je Adapter nur ihre eigene
// Hälfte. Deshalb trägt jede Regel unten BEIDE Kompilate in derselben
// Deklaration — nebeneinander, in einem Blick prüfbar.
//
// FAIL-CLOSED, wörtlich wie an der HITL-Kante: lässt sich der Principal nicht
// auflösen, geben BEIDE Kompilierer **null** zurück. Der Port fragt den
// Speicher dann gar nicht erst. Kein Ergebnis ist die sichere Antwort; ein
// ungefiltertes Ergebnis wäre die gefährliche.

import { istPrincipalAufloesbar } from "../context/envelope.js";

// ── Die Spaltennamen des SQL-Kompilats ───────────────────────────────────
// Sie stehen HIER und nicht im Adapter, damit die Regel und das Schema nicht
// auseinanderlaufen können: der Adapter baut sein `CREATE TABLE` aus diesen
// Konstanten, nicht umgekehrt. Die Alternative — der Adapter benennt seine
// Spalten selbst und die Regel rät sie — wäre ein Tippfehler, der sich als
// leeres Suchergebnis tarnt.
export const SPALTEN = {
  tenantId: "tenant_id",
  besitzerId: "besitzer_id",
  erlaubtePersonen: "erlaubte_personen",
  erlaubteGruppen: "erlaubte_gruppen",
  sichtbarkeit: "sichtbarkeit",
};

// ── Die Mandantengrenze ──────────────────────────────────────────────────
// Sie steht bewusst NICHT in der Regelliste unten, denn sie ist ein UND, kein
// ODER: sie muss gelten, egal welche Zugangsregel greift. Der teuerste
// Leckfall des Systems ist ein Cross-Tenant-Treffer, und er darf nicht davon
// abhängen, dass eine spätere Zeile richtig ist.
export const MANDANTENGRENZE = {
  name: "mandant",
  js: (p, e) => e.tenantId === p.tenantId,
  sql: (p, binde) => `${SPALTEN.tenantId} = ${binde(p.tenantId)}`,
};

// ── Die Zugangsregeln ────────────────────────────────────────────────────
// Eine DISJUNKTION: greift eine, ist der Chunk sichtbar. Ihre Reihenfolge ist
// deshalb — anders als bei den Bremsen einer Domäne — ohne Bedeutung.
//
// Das war nicht immer so. Bis Etappe 3c war dies eine geordnete Kette aus
// `if`-Rückgaben mit einem `switch` am Ende. Die Umformung in
// `Mandant UND (A ODER B ODER C ODER D)` ist beweisbar gleichwertig: die
// Stufen `privat` und „unbekannt" trugen dort nie zu einer Erlaubnis bei, und
// Besitzer wie Freigabe standen ohnehin vor dem `switch`. Der Beweis, dass
// die Umformung nichts verschoben hat, sind die unveränderten Testfälle in
// `tests/retrieval.test.js` und die unveränderte 3.13.
export const ZUGANGSREGELN = [
  {
    name: "besitzer",
    warum: "Der Besitzer sieht sein Dokument auf JEDER Stufe.",
    js: (p, e) => e.besitzerId === p.benutzerId,
    sql: (p, binde) => `${SPALTEN.besitzerId} = ${binde(p.benutzerId)}`,
  },
  {
    name: "freigabe",
    warum:
      "Eine ausdrückliche Freigabe an DIESE Person (ADR-0012). Sie hebt " +
      "`privat` auf — aber niemals die Mandantengrenze, weil die ein UND ist.",
    js: (p, e) => (e.erlaubtePersonen ?? []).includes(p.benutzerId),
    sql: (p, binde) =>
      `${binde(p.benutzerId)} = ANY(${SPALTEN.erlaubtePersonen})`,
  },
  {
    name: "oeffentlich",
    warum: "Sichtbarkeit `oeffentlich`: jeder Principal desselben Mandanten.",
    js: (p, e) => e.sichtbarkeit === "oeffentlich",
    sql: () => `${SPALTEN.sichtbarkeit} = 'oeffentlich'`,
  },
  {
    name: "gruppe",
    warum:
      "Sichtbarkeit `gruppe` UND eine gemeinsame Gruppe. Die Stufenprüfung " +
      "gehört zwingend dazu: ohne sie würde ein `privat`-Dokument sichtbar, " +
      "nur weil jemand `erlaubteGruppen` daran vergessen hat zu leeren.",
    js: (p, e) =>
      e.sichtbarkeit === "gruppe" &&
      (e.erlaubteGruppen ?? []).some((g) => p.gruppen.includes(g)),
    // `&&` ist der Überlappungsoperator für Arrays. Eine LEERE Gruppenliste
    // überlappt mit nichts — dasselbe Ergebnis wie `.some()` über eine leere
    // Liste in JavaScript. Der Randfall ist also in beiden Kompilaten gleich,
    // ohne dass er eigens behandelt werden müsste.
    sql: (p, binde) =>
      `${SPALTEN.sichtbarkeit} = 'gruppe' AND ${SPALTEN.erlaubteGruppen} && ${binde(p.gruppen)}::text[]`,
  },
];

// ── Kompilat 1: das JavaScript-Prädikat ──────────────────────────────────

// Darf dieser Principal diesen Chunk sehen?
export function darfSehen(principal, envelope) {
  if (!istPrincipalAufloesbar(principal)) return false;
  if (!envelope) return false;
  if (!MANDANTENGRENZE.js(principal, envelope)) return false;
  return ZUGANGSREGELN.some((r) => r.js(principal, envelope));
}

// Kompiliert den Filter für einen Principal zu einem Prädikat.
//
// Rückgabe `null` heißt: NICHT AUFLÖSBAR, also nicht suchen. Bewusst kein
// Prädikat, das immer `false` liefert — der Aufrufer soll den Unterschied
// zwischen „darf nichts sehen" und „ist gar nicht auflösbar" sehen und
// unterscheidbar protokollieren können. ADR-0008 nennt genau das als
// eingehandelten Preis: fail-closed sieht aus wie ein Angriff, und wer den
// Unterschied nicht loggt, sucht stundenlang den falschen Fehler.
export function kompiliereFilter(principal) {
  if (!istPrincipalAufloesbar(principal)) return null;
  return (envelope) => darfSehen(principal, envelope);
}

// ── Kompilat 2: die SQL-Bedingung ────────────────────────────────────────

/**
 * Kompiliert denselben Filter zu einer SQL-`WHERE`-Bedingung.
 *
 * Gibt `{ where, params }` zurück — oder **null**, wenn der Principal nicht
 * auflösbar ist. Dass beide Kompilierer bei demselben Eingang `null` liefern,
 * ist kein Zufall, sondern die Bedingung dafür, dass die fail-closed-Kante im
 * Port für jeden Adapter gleich wirkt.
 *
 * AUSSCHLIESSLICH GEBUNDENE PARAMETER. Kein Wert wird je in die
 * Zeichenkette interpoliert; `binde` legt ihn in `params` und gibt `$n`
 * zurück. Das ist hier nicht nur Hygiene: die Werte kommen aus dem Principal,
 * und ein Principal ist bis Etappe 4 eine **Behauptung des Aufrufers**
 * (ADR-0009). Wer ihn in SQL einsetzt, hat eine Injektion gebaut.
 *
 * @param {object} principal
 * @param {number} [ab] Erster Parameterindex — der Adapter hat oft schon
 *   welche vergeben (Anfragevektor, Termliste), bevor der Filter drankommt.
 */
export function kompiliereFilterSql(principal, ab = 1) {
  if (!istPrincipalAufloesbar(principal)) return null;

  const params = [];
  const binde = (wert) => {
    params.push(wert);
    return `$${ab + params.length - 1}`;
  };

  const grenze = MANDANTENGRENZE.sql(principal, binde);
  const zugang = ZUGANGSREGELN.map((r) => `(${r.sql(principal, binde)})`).join(
    " OR ",
  );

  // Die Klammern um die Disjunktion sind nicht kosmetisch: ohne sie bände
  // `AND` stärker als `OR` und die Mandantengrenze gälte nur noch für die
  // erste Zugangsregel. Das wäre ein Cross-Tenant-Leck aus einem fehlenden
  // Klammerpaar — und es sähe in jedem Test grün aus, der nur einen Mandanten
  // kennt.
  return { where: `${grenze} AND (${zugang})`, params };
}
