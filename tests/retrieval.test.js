// ── tests/retrieval.test.js ──────────────────────────────────────────────
// Die Retrieval-Ebene ③: ACL-Logik, Port, Adapter, hybride Suche.
//
// Hier hängt die zweite zentrale Zusage des Repos — die erste ist die
// HITL-Kante. Beide sind fail-closed, und beide werden hier bzw. in
// `workflow.test.js` auf genau diese Eigenschaft geprüft.
//
// Der wertvollste Test dieser Datei ist „der Speicher wird bei unauflösbarem
// Principal GAR NICHT gefragt". Er prüft nicht nur das Ergebnis, sondern den
// Weg dahin: ein leeres Ergebnis könnte auch aus einem Adapterfehler kommen.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  darfSehen,
  kompiliereFilter,
  kompiliereFilterSql,
  ZUGANGSREGELN,
  MANDANTENGRENZE,
  SPALTEN,
} from "../src/kernel/retrieval/filter.js";
import { suche } from "../src/kernel/retrieval/suche.js";
import { createStore } from "../src/kernel/context/store/index.js";
import { createMemoryAdapter } from "../src/kernel/context/store/memory.js";
import { createEmbedding } from "../src/kernel/context/embedding/index.js";
import { createHashAdapter } from "../src/kernel/context/embedding/hash.js";
import { baueStore } from "../src/kernel/context/aufbau.js";
import { ingestiere } from "../src/kernel/context/ingest/pipeline.js";

const env = (over = {}) => ({
  tenantId: "t1",
  quelle: "fixture",
  dokumentId: "d1",
  sichtbarkeit: "oeffentlich",
  erlaubteGruppen: [],
  besitzerId: "u1",
  ...over,
});

const wer = (over = {}) => ({
  tenantId: "t1",
  benutzerId: "u2",
  gruppen: [],
  ...over,
});

// Der Speicher traegt sein Embedding (ADR-0015). In den Tests wird es
// ausdruecklich gebaut, damit sichtbar bleibt, dass Dokument- und Fragevektor
// aus demselben Verfahren stammen.
const hashEmbedding = () => createEmbedding(createHashAdapter());

// ── Die ACL-Regel, Fall für Fall ─────────────────────────────────────────

test("ACL: die Mandantengrenze schlägt alles andere", () => {
  // Auch ein öffentliches Dokument des eigenen Besitzers ist über die
  // Mandantengrenze hinweg unsichtbar. Der teuerste Leckfall zuerst.
  assert.equal(
    darfSehen(wer({ tenantId: "t2", benutzerId: "u1" }), env()),
    false,
  );
});

test("ACL: der Besitzer sieht sein Dokument auf JEDER Stufe", () => {
  for (const s of ["oeffentlich", "privat"]) {
    assert.equal(
      darfSehen(wer({ benutzerId: "u1" }), env({ sichtbarkeit: s })),
      true,
    );
  }
  assert.equal(
    darfSehen(
      wer({ benutzerId: "u1" }),
      env({ sichtbarkeit: "gruppe", erlaubteGruppen: ["g9"] }),
    ),
    true,
  );
});

test("ACL: oeffentlich — jeder im Mandanten", () => {
  assert.equal(darfSehen(wer(), env()), true);
});

test("ACL: gruppe — nur Mitglieder, sonst nicht", () => {
  const e = env({ sichtbarkeit: "gruppe", erlaubteGruppen: ["finanz"] });
  assert.equal(darfSehen(wer({ gruppen: ["finanz"] }), e), true);
  assert.equal(darfSehen(wer({ gruppen: ["technik"] }), e), false);
  assert.equal(darfSehen(wer({ gruppen: [] }), e), false);
});

test("ACL: privat — niemand außer dem Besitzer", () => {
  const e = env({ sichtbarkeit: "privat" });
  assert.equal(darfSehen(wer({ gruppen: ["finanz"] }), e), false);
});

// ── Die Einzelfreigabe (ADR-0012) ────────────────────────────────────────
// Zwei Fälle, und beide sind Pflicht. Der erste zeigt, dass die Ausnahme
// wirkt; der zweite, dass sie an genau einer Grenze endet. Nur der erste zu
// prüfen hieße, die gefährlichere Hälfte ungeprüft zu lassen.

test("ACL: eine Freigabe an eine Person hebt privat auf", () => {
  const e = env({ sichtbarkeit: "privat", erlaubtePersonen: ["u2"] });
  assert.equal(darfSehen(wer({ benutzerId: "u2" }), e), true);
  // Und nur für DIESE Person, nicht für die halbe Belegschaft.
  assert.equal(darfSehen(wer({ benutzerId: "u3" }), e), false);
});

test("ACL: eine Freigabe an eine Person hebt die Mandantengrenze NICHT auf", () => {
  // Dieselbe benutzerId, anderer Mandant. Würde die Freigabe vor der
  // Mandantenprüfung greifen — oder als Ausnahme auch von ihr befreien —,
  // flösse hier ein Dokument ab. Eine Ausnahme darf diese Grenze nie aufheben.
  const e = env({ sichtbarkeit: "oeffentlich", erlaubtePersonen: ["u2"] });
  assert.equal(darfSehen(wer({ tenantId: "t2", benutzerId: "u2" }), e), false);
});

test("ACL: ohne erlaubtePersonen verhält sich alles wie vorher", () => {
  // Der Beweis, dass ADR-0012 nichts Bestehendes bewegt: eine Envelope ohne
  // das Feld ist unverändert gültig, und `?? []` fängt auch `null`.
  const ohne = env({ sichtbarkeit: "privat" });
  assert.equal(darfSehen(wer(), ohne), false);
  assert.equal(darfSehen(wer(), { ...ohne, erlaubtePersonen: null }), false);
});

test("ACL: eine unbekannte Sichtbarkeit führt NICHT zu Großzügigkeit", () => {
  // Käme sie je in den Speicher, wäre er beschädigt — dann ist "nichts" richtig.
  assert.equal(darfSehen(wer(), { ...env(), sichtbarkeit: "erfunden" }), false);
});

test("ACL: ein unauflösbarer Principal sieht nichts, und der Filter ist null", () => {
  assert.equal(darfSehen(null, env()), false);
  assert.equal(kompiliereFilter(null), null);
  assert.equal(kompiliereFilter({ tenantId: "t1" }), null);
  // Auflösbar → ein Prädikat, kein null. Der Unterschied ist die ganze Pointe:
  // "darf nichts sehen" ist etwas anderes als "ist nicht auflösbar".
  assert.equal(typeof kompiliereFilter(wer()), "function");
});

// ── Das SQL-Kompilat (ADR-0014) ──────────────────────────────────────────
// Dieselben Regeln, zweites Kompilat. Diese Tests brauchen KEINE Datenbank —
// sie prüfen die erzeugte Bedingung. Ob sie in Postgres auch das Richtige
// TUT, prüft die Eval-Suite gegen den Postgres-Adapter; das ist die andere
// Hälfte und keine der beiden ersetzt die andere.

test("SQL: jede Zugangsregel traegt BEIDE Kompilate", () => {
  // Der wichtigste Test dieser Gruppe. Fügt jemand eine Regel mit nur einem
  // `js` hinzu, verliert das SQL-Kompilat sie STILL — und das Leck entsteht
  // ausschließlich im Postgres-Adapter, wo es niemand sucht.
  for (const regel of [...ZUGANGSREGELN, MANDANTENGRENZE]) {
    assert.equal(typeof regel.js, "function", `${regel.name}: js fehlt`);
    assert.equal(typeof regel.sql, "function", `${regel.name}: sql fehlt`);
    assert.equal(typeof regel.name, "string");
  }
});

test("SQL: ein unaufloesbarer Principal ergibt null — wie beim Praedikat", () => {
  // Beide Kompilierer müssen bei demselben Eingang null liefern, sonst wirkt
  // die fail-closed-Kante im Port je nach Adapter anders.
  for (const kaputt of [null, undefined, { tenantId: "t1" }, {}]) {
    assert.equal(kompiliereFilter(kaputt), null);
    assert.equal(kompiliereFilterSql(kaputt), null);
  }
});

// Schließt die Klammer, die an `von` aufgeht, erst am Ende der Zeichenkette?
// Das ist die Frage, an der die Operatorrangfolge hängt — und sie lässt sich
// nicht mit einer Regex beantworten, weil die Regeln selbst geklammert sind.
function klammerReichtBisEnde(text, von) {
  if (text[von] !== "(") return false;
  let tiefe = 0;
  for (let i = von; i < text.length; i++) {
    if (text[i] === "(") tiefe++;
    else if (text[i] === ")") {
      tiefe--;
      if (tiefe === 0) return i === text.length - 1;
    }
  }
  return false;
}

test("SQL: die Mandantengrenze steht als UND VOR der geklammerten Disjunktion", () => {
  // Ohne das äußere Klammerpaar bände AND stärker als OR und die
  // Mandantengrenze gälte nur für die ERSTE Zugangsregel — ein
  // Cross-Tenant-Leck aus reiner Operatorrangfolge, das in jedem Test mit nur
  // einem Mandanten grün bleibt.
  //
  // Die erste Fassung dieses Tests prüfte „beginnt nach AND eine Klammer und
  // endet die Zeichenkette auf einer". Beides bleibt wahr, wenn man die äußere
  // Klammer entfernt, weil die Regeln ihre eigenen mitbringen — die
  // Mutationsprobe zeigte den Test grün, obwohl der Defekt drin war. Deshalb
  // wird hier wirklich GEZÄHLT, wo die geöffnete Klammer wieder zugeht.
  const { where } = kompiliereFilterSql(wer());
  const trenner = " AND ";
  const schnitt = where.indexOf(trenner);

  assert.ok(schnitt > 0, "die Mandantengrenze muss vorne stehen");
  assert.match(
    where.slice(0, schnitt),
    new RegExp("^" + SPALTEN.tenantId + " = \\$\\d+$"),
    "vor dem UND steht ausschließlich die Mandantengrenze",
  );
  assert.ok(
    klammerReichtBisEnde(where, schnitt + trenner.length),
    "die ganze Disjunktion muss in EINEM Klammerpaar stehen",
  );
  // Und die Disjunktion enthält wirklich alle Regeln.
  assert.equal(where.split(" OR ").length, ZUGANGSREGELN.length);
});

test("SQL: kein Wert steht in der Zeichenkette, alle sind gebunden", () => {
  // Der Principal ist bis Etappe 4 eine BEHAUPTUNG des Aufrufers (ADR-0009).
  // Wer ihn interpoliert, hat eine Injektion gebaut.
  const boese = {
    tenantId: "t1' OR '1'='1",
    benutzerId: "anna'; DROP TABLE chunks; --",
    gruppen: ["finanz'"],
  };
  const { where, params } = kompiliereFilterSql(boese);
  assert.ok(!where.includes("DROP TABLE"), "der Wert darf nicht im SQL stehen");
  assert.ok(!where.includes("1'='1"));
  assert.ok(params.includes(boese.benutzerId), "er gehört in die Parameter");
  assert.ok(params.includes(boese.tenantId));
});

test("SQL: der Parameterindex laesst sich versetzen", () => {
  // Der Adapter vergibt vor dem Filter schon Parameter (Anfragevektor,
  // Termliste). Ohne Versatz kollidierten die Nummern lautlos.
  const a = kompiliereFilterSql(wer());
  const b = kompiliereFilterSql(wer(), 4);
  assert.match(a.where, /\$1\b/);
  assert.match(b.where, /\$4\b/);
  assert.ok(!b.where.includes("$1"));
  assert.deepEqual(a.params, b.params);
});

test("SQL: gebunden wird genau einmal je Wert, in Reihenfolge", () => {
  const { where, params } = kompiliereFilterSql(
    wer({ tenantId: "t9", benutzerId: "u9", gruppen: ["g1", "g2"] }),
  );
  assert.deepEqual(params, ["t9", "u9", "u9", ["g1", "g2"]]);
  // Jeder Platzhalter, den die Bedingung nennt, existiert auch.
  for (const treffer of where.matchAll(/\$(\d+)/g)) {
    assert.ok(Number(treffer[1]) <= params.length);
  }
});

// ── Der Port ─────────────────────────────────────────────────────────────

test("Port: ein unvollständiger Adapter wird LAUT abgelehnt", () => {
  // Ein Speicher, der schweigend nichts findet, ist von einem korrekt
  // filternden Speicher nicht zu unterscheiden.
  //
  // JEDE Pflichtmethode einzeln, nicht nur die erste fehlende: prüfte der
  // Test nur ein unvollständiges Objekt, verschöbe das Hinzufügen einer
  // weiteren Pflichtmethode still, welche Methode überhaupt geprüft wird.
  // Genau das ist beim Hinzufügen von `ersetzeQuelle` (ADR-0011) passiert.
  for (const fehlt of [
    "schreibe",
    "ersetzeQuelle",
    "suche",
    "zaehle",
    "leere",
  ]) {
    const adapter = createMemoryAdapter({ embedding: hashEmbedding() });
    delete adapter[fehlt];
    assert.throws(
      () => createStore(adapter, hashEmbedding()),
      new RegExp(fehlt),
    );
  }
});

test("Port: bei unauflösbarem Principal wird der Adapter GAR NICHT gefragt", async () => {
  // Der wertvollste Test der Datei: fail-closed VOR dem Speicher, nicht darin.
  let gefragt = 0;
  const store = createStore(
    {
      name: "zaehler",
      schreibe: () => 0,
      ersetzeQuelle: () => ({ entfernt: 0, geschrieben: 0 }),
      zaehle: () => 0,
      leere: () => {},
      suche: () => {
        gefragt++;
        return [];
      },
    },
    hashEmbedding(),
  );

  const r = await store.suche({ principal: null, anfrage: "irgendwas" });
  assert.equal(gefragt, 0, "der Adapter darf nicht aufgerufen worden sein");
  assert.deepEqual(r.treffer, []);
  assert.equal(r.grund, "principal-nicht-aufloesbar");
});

test("Aufbau: ein unbekannter Adaptername wirft, statt still auf memory zu fallen", async () => {
  await assert.rejects(
    () => baueStore("pgvector"),
    /unbekannter Store-Adapter/,
  );
  assert.equal((await baueStore("memory")).name, "memory");
});

// ── Hybride Suche, beide Pfade ───────────────────────────────────────────

// Zwei Dokumente mit demselben Wortschatz, aber verschiedener Berechtigung.
// Gleicher Wortschatz ist Absicht: beide Pfade — der vektorielle wie der
// lexikalische — würden ohne Filter BEIDE anschlagen.
const dokumente = [
  {
    envelope: env({ dokumentId: "oeffentlich-1" }),
    text: "Quartalszahlen und Umsatz im dritten Quartal.",
  },
  {
    envelope: env({
      dokumentId: "geheim-1",
      sichtbarkeit: "privat",
      besitzerId: "chef",
    }),
    text: "Quartalszahlen und Umsatz im dritten Quartal.",
  },
  {
    envelope: env({
      dokumentId: "fremder-mandant",
      tenantId: "t2",
      besitzerId: "x",
    }),
    text: "Quartalszahlen und Umsatz im dritten Quartal.",
  },
];

async function frischerStore() {
  const embedding = hashEmbedding();
  const s = createStore(createMemoryAdapter({ embedding }), embedding);
  await ingestiere(s, dokumente);
  return s;
}

test("Suche: der Cross-User-Fall — das private Dokument taucht NICHT auf", async () => {
  const { dokumente: gefunden } = await suche({
    store: await frischerStore(),
    principal: wer(),
    anfrage: "Quartalszahlen Umsatz",
    k: 20,
  });
  const ids = gefunden.map((d) => d.dokumentId);
  assert.ok(ids.includes("oeffentlich-1"), "das erlaubte muss gefunden werden");
  assert.ok(!ids.includes("geheim-1"), "das private darf NICHT auftauchen");
});

test("Suche: der Cross-Tenant-Fall — der fremde Mandant taucht NICHT auf", async () => {
  const { dokumente: gefunden } = await suche({
    store: await frischerStore(),
    principal: wer(),
    anfrage: "Quartalszahlen Umsatz",
    k: 20,
  });
  assert.ok(!gefunden.map((d) => d.dokumentId).includes("fremder-mandant"));
});

test("Suche: der Besitzer findet sein privates Dokument sehr wohl", async () => {
  // Gegenprobe. Ohne sie könnte der Filter einfach alles ablehnen und alle
  // Leck-Tests blieben grün — eine Messung, die nichts misst.
  const { dokumente: gefunden } = await suche({
    store: await frischerStore(),
    principal: wer({ benutzerId: "chef" }),
    anfrage: "Quartalszahlen Umsatz",
    k: 20,
  });
  assert.ok(gefunden.map((d) => d.dokumentId).includes("geheim-1"));
});

test("Suche: BEIDE Pfade filtern — auch ein reiner Stichworttreffer bleibt draußen", async () => {
  // Der klassische halbe Leckfall: Vektorpfad gefiltert, Stichwortpfad nicht.
  // Die Anfrage ist wortgleich mit dem verbotenen Dokument, also schlägt der
  // lexikalische Pfad maximal an. Kommt es trotzdem nicht zurück, filtert er.
  const { treffer } = await suche({
    store: await frischerStore(),
    principal: wer(),
    anfrage: "Quartalszahlen und Umsatz im dritten Quartal.",
    k: 20,
  });
  for (const t of treffer) {
    assert.equal(t.envelope.tenantId, "t1");
    assert.notEqual(t.dokumentId, "geheim-1");
  }
});

test("Suche: fail-closed liefert leer MIT Grund, nicht ungefiltert", async () => {
  const r = await suche({
    store: await frischerStore(),
    principal: { tenantId: "t1" }, // unvollständig
    anfrage: "Quartalszahlen",
    k: 20,
  });
  assert.deepEqual(r.treffer, []);
  assert.deepEqual(r.dokumente, []);
  assert.equal(r.grund, "principal-nicht-aufloesbar");
});

test("Suche: zwei Durchgänge liefern dieselbe Reihenfolge", async () => {
  // Ohne stabile Sortierung wäre der Determinismus-Nachweis der Schicht A
  // keiner mehr, sondern eine Aussage über die Einfügereihenfolge.
  const store = await frischerStore();
  const a = await suche({
    store,
    principal: wer(),
    anfrage: "Quartalszahlen",
    k: 20,
  });
  const b = await suche({
    store,
    principal: wer(),
    anfrage: "Quartalszahlen",
    k: 20,
  });
  assert.deepEqual(
    a.treffer.map((t) => t.chunkId),
    b.treffer.map((t) => t.chunkId),
  );
});
