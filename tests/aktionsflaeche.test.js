// ── tests/aktionsflaeche.test.js ─────────────────────────────────────────
// A4, Etappe 5: die Aktionsfläche ENTSTEHT aus dem Modell der Domäne.
//
// Diese Datei prüft den KERN — `erzeugeAktionsflaeche` ist eine reine
// Funktion über zwei Schlüsselmengen und kennt keine Domäne. Deshalb
// arbeiten die Fälle hier mit erfundenen Typnamen: was die Funktion über
// `TICKET_ANLEGEN` weiß, ist genau nichts.
//
// Der wertvollste Test ist „modelliert, aber verschwiegen wirft". Die anderen
// beiden Richtungen fangen laute Fehler; diese fängt den stillen: ein
// modellierter Typ, den die Umsetzung gar nicht erwähnt, wäre nicht scharf —
// und niemand könnte später sagen, ob das Absicht war oder ein Versehen.

import { test } from "node:test";
import assert from "node:assert/strict";

import { erzeugeAktionsflaeche } from "../src/kernel/action/flaeche.js";
import { createActionQueue } from "../src/kernel/action/queue.js";

const MODELL = {
  A_TUN: { hinweis: "egal — der Kern liest die Werte nicht" },
  B_TUN: { hinweis: "egal" },
};

const scharf = { validator: () => true, befugnis: () => true };

test("Decke: ein umgesetzter Typ ohne Modell wird abgelehnt", () => {
  // DAS IST A4. Was nicht modelliert ist, darf nicht scharf werden — auch
  // nicht dadurch, dass jemand es in der Umsetzung einträgt.
  assert.throws(
    () =>
      erzeugeAktionsflaeche(MODELL, {
        A_TUN: scharf,
        B_TUN: scharf,
        C_TUN: scharf,
      }),
    /C_TUN.*nicht.*modelliert/s,
  );
});

test("Schweigen: ein modellierter Typ ohne Eintrag wird abgelehnt", () => {
  // Nicht „nicht scharf" ist das Problem, sondern STILL nicht scharf.
  // Dieselbe Linie wie `ungemessen` (ADR-0017) und die benannte Ausnahme der
  // Befugnis (ADR-0020): gemessen oder benannt, aber nie vergessen.
  assert.throws(
    () => erzeugeAktionsflaeche(MODELL, { A_TUN: scharf }),
    /B_TUN.*nicht genannt/s,
  );
});

test("Halb umgesetzt ist nicht umgesetzt", () => {
  const ohneValidierer = { befugnis: () => true };
  assert.throws(
    () =>
      erzeugeAktionsflaeche(MODELL, { A_TUN: scharf, B_TUN: ohneValidierer }),
    /B_TUN.*halb umgesetzt/s,
  );

  // Ein Typ ohne Payload-Schema hätte kein zweites Tor: die Queue schriebe
  // ihn und lehnte ihn danach wortlos ab. Im Bericht sähe das aus wie ein
  // kaputtes Payload, nicht wie eine fehlende Zusage.
  const ohneBefugnis = { validator: () => true };
  assert.throws(
    () => erzeugeAktionsflaeche(MODELL, { A_TUN: scharf, B_TUN: ohneBefugnis }),
    /B_TUN.*halb umgesetzt/s,
  );

  // Eine LEERE Begründung ist keine Begründung.
  assert.throws(
    () => erzeugeAktionsflaeche(MODELL, { A_TUN: scharf, B_TUN: "" }),
    /B_TUN.*halb umgesetzt/s,
  );
});

test("Modelliert und scharf sind zwei verschiedene Dinge", () => {
  const { whitelist, validators, befugnisse, nichtScharf } =
    erzeugeAktionsflaeche(MODELL, {
      A_TUN: scharf,
      B_TUN: "noch kein Zielsystem, gegen das geprüft werden könnte",
    });

  assert.deepEqual(whitelist, ["A_TUN"]);
  assert.deepEqual(Object.keys(validators), ["A_TUN"]);
  assert.deepEqual(Object.keys(befugnisse), ["A_TUN"]);
  assert.deepEqual(Object.keys(nichtScharf), ["B_TUN"]);
  assert.match(nichtScharf.B_TUN, /kein Zielsystem/);
});

test("Eine benannte Befugnis-Ausnahme macht den Typ trotzdem scharf", () => {
  // ADR-0020: die Befugnis darf eine Zeichenkette sein, der Validierer nicht.
  const { whitelist, befugnisse } = erzeugeAktionsflaeche(MODELL, {
    A_TUN: scharf,
    B_TUN: { validator: () => true, befugnis: "kein Ziel im Speicher" },
  });
  assert.deepEqual(whitelist.sort(), ["A_TUN", "B_TUN"]);
  assert.equal(befugnisse.B_TUN, "kein Ziel im Speicher");
});

test("DAS TOR VON ETAPPE 5: ein nicht scharfer Typ wird nicht einmal geschrieben", async () => {
  // Der Befund, den `docs/roadmap.md` §5 verlangt — und zwar durch die Queue
  // hindurch, nicht nur an der reinen Funktion. Ohne `logName` bleibt diese
  // Queue flüchtig und fasst keine Datei an.
  const { whitelist, validators, befugnisse } = erzeugeAktionsflaeche(MODELL, {
    A_TUN: scharf,
    B_TUN: "modelliert, aber nicht freigeschaltet",
  });
  const { enqueueAction, getQueue } = createActionQueue({
    whitelist,
    validators,
    befugnisse,
  });

  await assert.rejects(
    () => enqueueAction({ threadId: "t", actionType: "B_TUN", payload: {} }),
    /Whitelist/,
  );
  assert.equal(getQueue().length, 0, "Die Queue darf nicht gewachsen sein");

  // Und die Gegenprobe: ohne sie belegte der Fall oben nichts. Eine Fläche,
  // die alles ablehnt, bestünde ihn auch.
  await enqueueAction({ threadId: "t", actionType: "A_TUN", payload: {} });
  assert.equal(getQueue().length, 1);
});
