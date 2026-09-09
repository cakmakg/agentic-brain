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

import { darfSehen, kompiliereFilter } from "../src/kernel/retrieval/filter.js";
import { suche } from "../src/kernel/retrieval/suche.js";
import { createStore } from "../src/kernel/context/store/index.js";
import { createMemoryAdapter } from "../src/kernel/context/store/memory.js";
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

// ── Der Port ─────────────────────────────────────────────────────────────

test("Port: ein unvollständiger Adapter wird LAUT abgelehnt", () => {
  // Ein Speicher, der schweigend nichts findet, ist von einem korrekt
  // filternden Speicher nicht zu unterscheiden.
  assert.throws(() => createStore({ schreibe: () => {} }), /suche/);
});

test("Port: bei unauflösbarem Principal wird der Adapter GAR NICHT gefragt", () => {
  // Der wertvollste Test der Datei: fail-closed VOR dem Speicher, nicht darin.
  let gefragt = 0;
  const store = createStore({
    name: "zaehler",
    schreibe: () => 0,
    zaehle: () => 0,
    leere: () => {},
    suche: () => {
      gefragt++;
      return [];
    },
  });

  const r = store.suche({ principal: null, anfrage: "irgendwas" });
  assert.equal(gefragt, 0, "der Adapter darf nicht aufgerufen worden sein");
  assert.deepEqual(r.treffer, []);
  assert.equal(r.grund, "principal-nicht-aufloesbar");
});

test("Aufbau: ein unbekannter Adaptername wirft, statt still auf memory zu fallen", () => {
  assert.throws(() => baueStore("pgvector"), /unbekannter Store-Adapter/);
  assert.equal(baueStore().name, "memory");
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

function frischerStore() {
  const s = createStore(createMemoryAdapter());
  ingestiere(s, dokumente);
  return s;
}

test("Suche: der Cross-User-Fall — das private Dokument taucht NICHT auf", () => {
  const { dokumente: gefunden } = suche({
    store: frischerStore(),
    principal: wer(),
    anfrage: "Quartalszahlen Umsatz",
    k: 20,
  });
  const ids = gefunden.map((d) => d.dokumentId);
  assert.ok(ids.includes("oeffentlich-1"), "das erlaubte muss gefunden werden");
  assert.ok(!ids.includes("geheim-1"), "das private darf NICHT auftauchen");
});

test("Suche: der Cross-Tenant-Fall — der fremde Mandant taucht NICHT auf", () => {
  const { dokumente: gefunden } = suche({
    store: frischerStore(),
    principal: wer(),
    anfrage: "Quartalszahlen Umsatz",
    k: 20,
  });
  assert.ok(!gefunden.map((d) => d.dokumentId).includes("fremder-mandant"));
});

test("Suche: der Besitzer findet sein privates Dokument sehr wohl", () => {
  // Gegenprobe. Ohne sie könnte der Filter einfach alles ablehnen und alle
  // Leck-Tests blieben grün — eine Messung, die nichts misst.
  const { dokumente: gefunden } = suche({
    store: frischerStore(),
    principal: wer({ benutzerId: "chef" }),
    anfrage: "Quartalszahlen Umsatz",
    k: 20,
  });
  assert.ok(gefunden.map((d) => d.dokumentId).includes("geheim-1"));
});

test("Suche: BEIDE Pfade filtern — auch ein reiner Stichworttreffer bleibt draußen", () => {
  // Der klassische halbe Leckfall: Vektorpfad gefiltert, Stichwortpfad nicht.
  // Die Anfrage ist wortgleich mit dem verbotenen Dokument, also schlägt der
  // lexikalische Pfad maximal an. Kommt es trotzdem nicht zurück, filtert er.
  const { treffer } = suche({
    store: frischerStore(),
    principal: wer(),
    anfrage: "Quartalszahlen und Umsatz im dritten Quartal.",
    k: 20,
  });
  for (const t of treffer) {
    assert.equal(t.envelope.tenantId, "t1");
    assert.notEqual(t.dokumentId, "geheim-1");
  }
});

test("Suche: fail-closed liefert leer MIT Grund, nicht ungefiltert", () => {
  const r = suche({
    store: frischerStore(),
    principal: { tenantId: "t1" }, // unvollständig
    anfrage: "Quartalszahlen",
    k: 20,
  });
  assert.deepEqual(r.treffer, []);
  assert.deepEqual(r.dokumente, []);
  assert.equal(r.grund, "principal-nicht-aufloesbar");
});

test("Suche: zwei Durchgänge liefern dieselbe Reihenfolge", () => {
  // Ohne stabile Sortierung wäre der Determinismus-Nachweis der Schicht A
  // keiner mehr, sondern eine Aussage über die Einfügereihenfolge.
  const store = frischerStore();
  const a = suche({
    store,
    principal: wer(),
    anfrage: "Quartalszahlen",
    k: 20,
  });
  const b = suche({
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
