// ── tests/actionQueue.test.js ────────────────────────────────────────────
// MOAT Layer 4 — Aktions-Isolation. Zwei Tore, beide werden hier geprüft:
//   Tor 1 (enqueueAction): nicht auf der Whitelist → gar nicht erst schreiben.
//   Tor 2 (Worker):        Payload gegen Schema und Länge, sonst REJECTED.
//
// Ein gekaperter Agent darf höchstens eine erlaubte, begrenzte Aktion
// einreihen — und selbst die führt er nicht selbst aus.
//
// Dazu die Idempotenz: dieselbe Aktion zweimal eingereiht bleibt eine. Solange
// der Worker simuliert, ist die doppelte Zeile harmlos; mit einem echten
// externen Aufruf wäre sie eine zweite Wirkung in der Welt. Deshalb wird sie
// hier geprüft, BEVOR es diesen Aufruf gibt.

import { test, after } from "node:test";
import assert from "node:assert/strict";

import {
  enqueueAction,
  getQueue,
  startActionWorker,
  stopActionWorker,
} from "../src/domains/beispiel/actions.js";

import { frischerZustand } from "./helpers/zustand.js";

// Eigenes Zustandsverzeichnis je Testdatei — sonst sähe der zweite
// `npm test`-Lauf den Zustand des ersten.
frischerZustand();

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const finde = (id) => getQueue().find((a) => a.id === id);

after(() => stopActionWorker());

test("TOR 1: ein Typ außerhalb der Whitelist wird nicht einmal geschrieben", async () => {
  const vorher = getQueue().length;
  // `rejects` statt `throws`: `enqueueAction` ist seit ADR-0020 asynchron, weil
  // eine Befugnis einen Lesezugriff verlangen kann.
  await assert.rejects(
    () =>
      enqueueAction({ threadId: "t1", actionType: "DELETE_ALL", payload: {} }),
    /Whitelist/,
  );
  assert.equal(
    getQueue().length,
    vorher,
    "Die Queue darf nicht gewachsen sein",
  );
});

test("TOR 1: ein erlaubter Typ landet als PENDING in der Queue", async () => {
  const id = await enqueueAction({
    threadId: "t2",
    actionType: "NOTIFY",
    payload: { text: "hallo" },
  });
  const a = finde(id);
  assert.equal(a.status, "PENDING");
  assert.equal(a.attempts, 0);
  assert.equal(a.actionType, "NOTIFY");
});

test("getQueue liefert eine Kopie — von außen ist die Queue nicht manipulierbar", () => {
  const kopie = getQueue();
  const laenge = getQueue().length;
  kopie.push({ id: 999, status: "DONE" });
  assert.equal(getQueue().length, laenge);
});

test("TOR 2: der Worker führt gültige Payloads aus und lehnt ungültige ab", async () => {
  const gueltig = await enqueueAction({
    threadId: "t3",
    actionType: "NOTIFY",
    payload: { text: "kurz" },
  });
  const zuLang = await enqueueAction({
    threadId: "t3",
    actionType: "NOTIFY",
    payload: { text: "x".repeat(1001) },
  });
  const unsicher = await enqueueAction({
    threadId: "t3",
    actionType: "WEBHOOK",
    payload: { url: "http://kein-tls.example" },
  });
  const keineMail = await enqueueAction({
    threadId: "t3",
    actionType: "EMAIL",
    payload: { to: "ohne-at-zeichen", body: "hi" },
  });

  startActionWorker(5);
  await warte(80);

  assert.equal(finde(gueltig).status, "DONE");
  assert.equal(finde(zuLang).status, "REJECTED", "Längengrenze 1000");
  assert.equal(finde(unsicher).status, "REJECTED", "nur https:// erlaubt");
  assert.equal(finde(keineMail).status, "REJECTED", "Adresse ohne @");
});

test("startActionWorker ist idempotent — ein zweiter Aufruf legt keinen zweiten Timer an", async () => {
  startActionWorker(5);
  startActionWorker(5);
  stopActionWorker();
  const id = await enqueueAction({
    threadId: "t4",
    actionType: "EMAIL",
    payload: { to: "a@b.de", body: "kurz" },
  });
  await warte(30);
  assert.equal(
    finde(id).status,
    "PENDING",
    "Nach stopActionWorker darf nichts mehr verarbeitet werden",
  );
});

// ── Idempotenz ───────────────────────────────────────────────────────────

test("Dieselbe Aktion zweimal eingereiht ergibt EINE Zeile und dieselbe id", async () => {
  const vorher = getQueue().length;
  const eingabe = {
    threadId: "t5",
    actionType: "NOTIFY",
    payload: { text: "genau einmal" },
  };
  const erste = await enqueueAction(eingabe);
  const zweite = await enqueueAction(eingabe);

  assert.equal(
    zweite,
    erste,
    "Der zweite Aufruf gibt die vorhandene id zurück",
  );
  assert.equal(
    getQueue().length,
    vorher + 1,
    "Die Queue ist nur um eins gewachsen",
  );
});

test("Die Feldreihenfolge im Payload ändert den Schlüssel nicht", async () => {
  const vorher = getQueue().length;
  const a = await enqueueAction({
    threadId: "t6",
    actionType: "EMAIL",
    payload: { to: "a@b.de", body: "kurz" },
  });
  const b = await enqueueAction({
    threadId: "t6",
    actionType: "EMAIL",
    payload: { body: "kurz", to: "a@b.de" },
  });
  assert.equal(
    b,
    a,
    "Gleicher Inhalt, andere Reihenfolge — derselbe Schlüssel",
  );
  assert.equal(getQueue().length, vorher + 1);
});

test("Ein anderes Payload ist eine andere Aktion", async () => {
  const vorher = getQueue().length;
  const a = await enqueueAction({
    threadId: "t7",
    actionType: "NOTIFY",
    payload: { text: "eins" },
  });
  const b = await enqueueAction({
    threadId: "t7",
    actionType: "NOTIFY",
    payload: { text: "zwei" },
  });
  assert.notEqual(b, a);
  assert.equal(getQueue().length, vorher + 2);
});

test("Ein mitgegebener idempotencyKey schlägt den abgeleiteten", async () => {
  const vorher = getQueue().length;
  const a = await enqueueAction({
    threadId: "t8",
    actionType: "NOTIFY",
    payload: { text: "erste Fassung" },
    idempotencyKey: "vorgang-4711",
  });
  // Anderes Payload, gleicher Schlüssel → bewusst dieselbe Aktion. Das ist der
  // Fall, den ein echter externer Aufruf braucht: der Schlüssel gehört dem
  // Vorgang, nicht dem Text.
  const b = await enqueueAction({
    threadId: "t8",
    actionType: "NOTIFY",
    payload: { text: "zweite Fassung" },
    idempotencyKey: "vorgang-4711",
  });
  assert.equal(b, a);
  assert.equal(getQueue().length, vorher + 1);
});

test("TOR 1 kommt vor der Dedup-Prüfung", async () => {
  // Ein nicht erlaubter Typ muss auch dann auffliegen, wenn er einen bereits
  // bekannten Schlüssel mitbringt.
  await assert.rejects(
    () =>
      enqueueAction({
        threadId: "t8",
        actionType: "DELETE_ALL",
        payload: {},
        idempotencyKey: "vorgang-4711",
      }),
    /Whitelist/,
  );
});
