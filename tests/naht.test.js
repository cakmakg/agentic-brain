// ── tests/naht.test.js ───────────────────────────────────────────────────
// T1 DES MVP-SCHNITTS (ADR-0019): die Naht zwischen dem gefilterten Leseweg
// und dem Agentenpfad.
//
// Bis zum 2026-09-20 rief KEIN Agentenknoten `suche` auf, und `principal` kam
// im ganzen Agentenlayer nicht vor. Ein Agent konnte deshalb einen Entwurf
// über eine Notiz schreiben, die der Fragende nicht sehen darf — und 3.13
// bemerkte es nicht, weil der Agentenpfad nicht in ihrem Nenner lag. Diese
// Datei ist die erste Probe, die das feststellt.
//
// DIE FÄLLE SIND AUS DEN REGELN ABGELEITET, nicht aus einem Lauf: der Ordner
// `o-alle` trägt `*` → Q5 „oeffentlich" → F4 sichtbar für jeden Principal des
// Mandanten; `o-eng` trägt `erbt: false` und `sichtbarFuer: ["leitung"]` →
// Q6 „gruppe" → F5 nur für Mitglieder von `leitung`. Weder `mia` noch `lea`
// ist Organisator oder einzelfreigegeben — damit trägt allein die Gruppe die
// Aussage, und nicht F2 oder F3.
//
// DER BILLIGSTE BEWEIS IST DER TEUERSTE FALL: ist die Notiz nicht sichtbar,
// darf KEIN LLM-Aufruf stattfinden. Fail-closed VOR den Kosten — dieselbe
// Regel, die das Tor von Etappe 4a verlangt.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { frischerZustand } from "./helpers/zustand.js";

frischerZustand();

const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-naht-"));
process.env.TRACE_DIR = traceDir;

const { MOCK_LLM } = await import("../src/kernel/config/env.js");
const { coreFields } = await import("../src/kernel/agent/schema.js");
const { einmalGesetzt } = await import("../src/kernel/agent/reducers.js");
const { baueStore } = await import("../src/kernel/context/aufbau.js");
const { synchronisiere } =
  await import("../src/kernel/connectors/synchronisation.js");
const { onLlmCall } = await import("../src/kernel/llm/adapter.js");

await import("../src/domains/besprechung/domain.js");
const { getRunner } = await import("../src/kernel/registry.js");
const { createNotizlaufwerk } =
  await import("../src/domains/besprechung/connectors/notizlaufwerk.js");
const { extrahiererNode } =
  await import("../src/domains/besprechung/agents/extrahierer.js");
const { setzeLeseweg, holeBeleg } =
  await import("../src/domains/besprechung/leseweg.js");
const { getEntwurf } =
  await import("../src/domains/besprechung/agents/entwurf.js");
const { getQueue } = await import("../src/domains/besprechung/actions.js");
const { createAufloeser } =
  await import("../src/kernel/governance/identitaet/index.js");
const { createFixturesAufloeser } =
  await import("../src/kernel/governance/identitaet/fixtures.js");

before(() =>
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  ),
);
after(() => fs.rmSync(traceDir, { recursive: true, force: true }));

// ── Die Quelle: zwei Notizen, zwei Sichtbarkeitsstufen ───────────────────
const QUELLE = {
  tenantId: "t1",
  quelle: "notizlaufwerk",
  ordner: [
    { ordnerId: "o-alle", name: "Alle", elternId: null, sichtbarFuer: ["*"] },
    {
      ordnerId: "o-eng",
      name: "Eng",
      elternId: "o-alle",
      erbt: false,
      sichtbarFuer: ["leitung"],
    },
  ],
  besprechungen: [
    {
      besprechungId: "b-x",
      titel: "Runde",
      datum: "2026-09-01",
      organisatorId: "otto",
      teilnehmer: ["otto"],
    },
  ],
  notizen: [
    {
      notizId: "n-frei",
      besprechungId: "b-x",
      ordnerId: "o-alle",
      titel: "Fuer alle",
      text: "Offene Punkte, die jeder im Mandanten sehen darf.",
      freigegebenAn: [],
      vertraulich: false,
    },
    {
      notizId: "n-eng",
      besprechungId: "b-x",
      ordnerId: "o-eng",
      titel: "Nur Leitung",
      text: "Offene Punkte, die nur die Gruppe leitung sehen darf.",
      freigegebenAn: [],
      vertraulich: false,
    },
  ],
};

const MIA = { tenantId: "t1", benutzerId: "mia", gruppen: [] };
const LEA = { tenantId: "t1", benutzerId: "lea", gruppen: ["leitung"] };

let store = null;

beforeEach(async () => {
  if (store) await store.schliesse();
  store = await baueStore("memory");
  await synchronisiere(store, createNotizlaufwerk(QUELLE).connector);
  setzeLeseweg(store);
});

after(async () => {
  setzeLeseweg(null);
  if (store) await store.schliesse();
});

// Zählt echte Aufrufe ins Modell — im Mock-Modus ebenso wie im echten.
async function mitLlmZaehler(fn) {
  let aufrufe = 0;
  const abmelden = onLlmCall(() => (aufrufe += 1));
  try {
    return { ergebnis: await fn(), aufrufe };
  } finally {
    abmelden();
  }
}

const zustand = (task, principal) => ({
  task,
  threadId: crypto.randomUUID(),
  principal,
  revisionCount: 0,
  gruende: "",
});

// ── Der Principal im Zustand ─────────────────────────────────────────────

test("Reducer: ein gesetzter Principal wird NICHT überschrieben", () => {
  assert.deepEqual(einmalGesetzt(null, MIA), MIA, "aus leer wird gesetzt");
  assert.deepEqual(
    einmalGesetzt(MIA, LEA),
    MIA,
    "ein zweiter Principal im selben Lauf wird ignoriert — sonst wäre die " +
      "Identität mitten im Lauf tauschbar",
  );
  assert.deepEqual(einmalGesetzt(MIA, undefined), MIA);
});

test("Schema: `principal` ist ein KERNfeld, keine Zutat der Domäne", () => {
  assert.ok(
    "principal" in coreFields,
    "hängt der Principal an der Domäne, kann eine Domäne den gefilterten " +
      "Leseweg still umgehen — dieselbe Begründung wie bei `humanApproval`",
  );
});

// ── Der Extrahierer liest gefiltert ──────────────────────────────────────

test("Extrahierer: eine NICHT sichtbare Notiz erzeugt keinen Aktionspunkt und keinen LLM-Aufruf", async () => {
  const { ergebnis, aufrufe } = await mitLlmZaehler(() =>
    extrahiererNode(zustand("Aktionspunkte aus notiz:n-eng zur Sache.", MIA)),
  );

  assert.deepEqual(ergebnis.aktionspunkte, []);
  assert.equal(ergebnis.notizId, "", "ohne Beleg keine Herkunft");
  assert.equal(
    aufrufe,
    0,
    "fail-closed VOR den Kosten: ein LLM-Aufruf für eine Notiz, die der " +
      "Fragende nicht sehen darf, ist bereits der Schaden",
  );
});

test("Extrahierer: dieselbe Notiz mit berechtigtem Principal WIRD extrahiert", async () => {
  const { ergebnis, aufrufe } = await mitLlmZaehler(() =>
    extrahiererNode(zustand("Aktionspunkte aus notiz:n-eng zur Sache.", LEA)),
  );

  assert.ok(
    ergebnis.aktionspunkte.length > 0,
    "ohne diesen Fall wäre auch eine Fassung grün, die IMMER leer liefert",
  );
  assert.equal(ergebnis.notizId, "n-eng");
  assert.equal(aufrufe, 1);
});

test("Extrahierer: ein nicht auflösbarer Principal endet leer, mit Grund, ohne LLM-Aufruf", async () => {
  const { ergebnis, aufrufe } = await mitLlmZaehler(() =>
    extrahiererNode(zustand("Aktionspunkte aus notiz:n-frei zur Sache.", null)),
  );

  assert.deepEqual(ergebnis.aktionspunkte, []);
  assert.equal(aufrufe, 0);
  assert.match(
    ergebnis.log.join(" "),
    /principal-nicht-aufloesbar/,
    "ein leeres Ergebnis MIT Grund ist etwas anderes als eines ohne (ADR-0008)",
  );
});

test("Extrahierer: ohne verdrahteten Leseweg wirft er — ein Verdrahtungsfehler ist kein leeres Ergebnis", async () => {
  setzeLeseweg(null);
  await assert.rejects(
    () =>
      extrahiererNode(
        zustand("Aktionspunkte aus notiz:n-frei zur Sache.", MIA),
      ),
    /Leseweg/,
    "wäre es ein leeres Ergebnis, sähe ein fehlender Speicher aus wie eine " +
      "verweigerte Berechtigung — ein Betriebsfehler als Sicherheitsereignis",
  );
});

test("Beleg: der Extrahierer hält fest, welche Chunks er gelesen hat", async () => {
  const s = zustand("Aktionspunkte aus notiz:n-frei zur Sache.", MIA);
  await extrahiererNode(s);

  const beleg = holeBeleg(s.threadId);
  assert.ok(beleg.chunks.length > 0);
  assert.deepEqual(
    [...new Set(beleg.chunks.map((c) => c.dokumentId))],
    ["n-frei"],
    "mia darf n-eng nicht sehen — steht es im Beleg, hat der Speicher geliefert",
  );
});

// ── Die gezielte Kippe des Lesewegs ──────────────────────────────────────
// Der Grund, warum es sie gibt: die Berechtigung darf nicht an der Relevanz
// hängen. Diese beiden Fälle sind der Beweis — eine Frage ohne ein einziges
// gemeinsames Wort mit der Notiz liefert sie trotzdem, und der Unberechtigte
// bekommt sie trotzdem nicht.

test("Leseweg gezielt: eine Notiz kommt auch bei völlig unpassender Frage — Relevanz ordnet, sie schließt nicht aus", async () => {
  const { suche } = await import("../src/kernel/retrieval/suche.js");

  const ohneUeberschneidung = await suche({
    store,
    principal: LEA,
    anfrage: "Quartalszahlen Kantine Parkplatz",
    k: 100,
  });
  assert.equal(
    ohneUeberschneidung.dokumente.length,
    0,
    "die Relevanzsuche findet hier nichts — genau deshalb braucht der Agent " +
      "die gezielte Kippe",
  );

  const gezielt = await suche({ store, principal: LEA, dokumentId: "n-eng" });
  assert.deepEqual(
    gezielt.dokumente.map((d) => d.dokumentId),
    ["n-eng"],
  );
  assert.equal(
    gezielt.treffer[0].wert,
    null,
    "im gezielten Abruf wird nicht bewertet — `null`, nicht 0",
  );
});

test("Leseweg gezielt: der Unberechtigte bekommt sie auch gezielt nicht", async () => {
  const { suche } = await import("../src/kernel/retrieval/suche.js");

  const mia = await suche({ store, principal: MIA, dokumentId: "n-eng" });
  assert.deepEqual(mia.treffer, [], "die gezielte Kippe ist kein Schlupfloch");

  const kaputt = await suche({
    store,
    principal: { tenantId: "t1" },
    dokumentId: "n-frei",
  });
  assert.deepEqual(kaputt.treffer, []);
  assert.equal(kaputt.grund, "principal-nicht-aufloesbar");
});

// ── Ende zu Ende ─────────────────────────────────────────────────────────

test("Ende zu Ende: eine unberechtigte Notiz stellt nichts zu und reiht nichts ein", async () => {
  const { startWorkflow } = getRunner("besprechung");
  const threadId = crypto.randomUUID();

  const { interrupted } = await startWorkflow({
    task: "Aktionspunkte aus notiz:n-eng zum Rollout.",
    threadId,
    principal: MIA,
  });

  assert.equal(
    interrupted,
    false,
    "es gibt nichts zu genehmigen — BREMSE5 beendet den Lauf",
  );
  assert.equal(getEntwurf(threadId)?.status ?? null, null, "kein Entwurf");
  assert.equal(getQueue().filter((a) => a.threadId === threadId).length, 0);
});

test("Ende zu Ende: dieselbe Notiz mit Berechtigung läuft bis zur Genehmigung", async () => {
  const { startWorkflow } = getRunner("besprechung");
  const threadId = crypto.randomUUID();

  const { interrupted } = await startWorkflow({
    task: "Aktionspunkte aus notiz:n-eng zum Rollout.",
    threadId,
    principal: LEA,
  });

  assert.equal(interrupted, true, "der Graph hält bei human_approval");
  assert.equal(getEntwurf(threadId)?.status, "AWAITING_APPROVAL");
});

// ── Der Kanal legt einen Nachweis vor (T2, ADR-0018) ─────────────────────
// Bis T2 reichte der Aufrufer einen Principal herein und wurde geglaubt. Jetzt
// reicht er einen NACHWEIS, und ein Verzeichnis antwortet. Geprüft wird die
// Verdrahtung, nicht der Port — der steht in `tests/identitaet.test.js`.
//
// Das Verzeichnis enthält LEA, aber nicht MIA: so trägt derselbe Lauf beide
// Enden der Kante, und ein Verzeichnis, das alles beantwortet, fiele auf.

const kanal = () =>
  createAufloeser({
    adapter: createFixturesAufloeser({
      verzeichnis: { "nachweis-lea": LEA },
    }),
  });

test("Kanal: ein bekannter Nachweis wird zum Principal, und der Agent liest damit", async () => {
  const aufloeser = kanal();
  const { startWorkflow } = getRunner("besprechung");
  const threadId = crypto.randomUUID();

  const principal = await aufloeser.aufloese("nachweis-lea");
  assert.deepEqual(principal, LEA, "das Verzeichnis antwortet");

  const { interrupted } = await startWorkflow({
    task: "Aktionspunkte aus notiz:n-eng zum Rollout.",
    threadId,
    principal,
  });

  assert.equal(interrupted, true);
  assert.equal(getEntwurf(threadId)?.status, "AWAITING_APPROVAL");
  assert.equal(aufloeser.statistik.verzeichnisAufrufe, 1);
});

test("Kanal: ein unbekannter Nachweis endet leer, ohne Entwurf und ohne LLM-Aufruf", async () => {
  const aufloeser = kanal();
  const { startWorkflow } = getRunner("besprechung");
  const threadId = crypto.randomUUID();

  const { ergebnis, aufrufe } = await mitLlmZaehler(async () => {
    // `null` — und `null` heißt für den Leseweg „leer mit Grund", nicht „alles".
    const principal = await aufloeser.aufloese("nachweis-gibtsnicht");
    assert.equal(principal, null);
    return startWorkflow({
      task: "Aktionspunkte aus notiz:n-frei zum Rollout.",
      threadId,
      principal,
    });
  });

  assert.equal(ergebnis.interrupted, false);
  assert.equal(getEntwurf(threadId)?.status ?? null, null);
  assert.equal(getQueue().filter((a) => a.threadId === threadId).length, 0);
  assert.equal(
    aufrufe,
    0,
    "das Tor von T2: keine Identität heißt kein Modellaufruf — fail-closed vor den Kosten",
  );
  // Ein Nein wird NICHT zwischengespeichert: es muss teuer bleiben, sonst wird
  // eine Störung des Verzeichnisses für die Dauer der Frist zu einem Nein.
  await aufloeser.aufloese("nachweis-gibtsnicht");
  assert.equal(aufloeser.statistik.verzeichnisAufrufe, 2);
});
