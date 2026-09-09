// ── kernel/security/actionQueue.js ───────────────────────────────────────
// MOAT Layer 4 — AKTIONS-ISOLATION. Die QUEUE-MECHANIK; die WHITELIST bringt
// die Domäne mit. Das ist die dritte feine Stelle der Naht.
//
//   Agent → ActionQueue (SCHREIBT nur) → Worker (liest + VALIDIERT + führt aus)
//
// Zwei Tore:
//   1) enqueueAction: steht der actionType nicht auf der Whitelist, wird schon
//      VOR dem Schreiben abgelehnt.
//   2) Worker: prüft das Payload gegen Schema und Länge, nach N Versuchen FAILED.
//
// So kann selbst ein gekaperter Agent nur Aktionen in die Queue legen, die auf
// der Whitelist stehen und begrenzt sind — an die Außenwelt kommt er nicht direkt.
//
// IDEMPOTENZ. Solange der Worker nur simuliert, ist eine doppelt
// eingereihte Aktion harmlos. Sobald dort ein echter Portal-Aufruf steht, ist sie
// ein zweites Inserat. Deshalb steht die Regel HIER und nicht später:
//   · Jede Aktion trägt einen Schlüssel — mitgegeben oder aus (threadId,
//     actionType, payload) deterministisch abgeleitet.
//   · Ein bekannter Schlüssel wird nicht erneut geschrieben; enqueueAction gibt
//     die id der bereits vorhandenen Aktion zurück.
//   · Der Worker verarbeitet höchstens einen Durchgang gleichzeitig, damit ein
//     langsamer Aufruf nicht in zwei Takten zugleich läuft.
// Beides überlebt einen Neustart: die Queue und der Dedup-Index liegen hinter
// derselben Dauerhaftigkeits-Schicht wie Checkpoints und Artefakte. Die Zusage
// gilt damit nicht nur innerhalb eines Prozesslebens — ein Neustart reiht
// dieselbe Aktion nicht erneut ein.

import crypto from "node:crypto";

import { appendLog, readLog } from "../persistence/store.js";

// Stabile Serialisierung: dasselbe Payload muss denselben Schlüssel ergeben,
// auch wenn seine Felder in anderer Reihenfolge entstanden sind. JSON.stringify
// allein leistet das nicht — es schreibt in Einfügereihenfolge.
function stabil(wert) {
  if (wert === null || typeof wert !== "object") return JSON.stringify(wert) ?? "null";
  if (Array.isArray(wert)) return `[${wert.map(stabil).join(",")}]`;
  return `{${Object.keys(wert)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stabil(wert[k])}`)
    .join(",")}}`;
}

function schluesselAus({ threadId, actionType, payload }) {
  // Längenpräfixe statt eines Trennzeichens: so kann kein Feldinhalt die Grenze
  // zwischen zwei Feldern nachbilden. String() davor, weil eine fehlende
  // threadId hier keinen Absturz wert ist — sie ergibt einen eigenen Schlüssel.
  const felder = [String(threadId), String(actionType), stabil(payload)];
  return crypto
    .createHash("sha256")
    .update(felder.map((f) => `${f.length}:${f}`).join(""))
    .digest("hex")
    .slice(0, 32);
}

export function createActionQueue({ whitelist, validators, logName }) {
  const erlaubt = new Set(whitelist);
  const queue = []; // { id, threadId, actionType, payload, status, attempts, idempotencyKey }
  const nachSchluessel = new Map(); // idempotencyKey -> id
  let _id = 0;
  let timer = null;
  let laeuft = false; // ein Worker-Durchgang zur Zeit
  let geladen = false;

  // Erst beim ersten Zugriff, nicht beim Import: das Laden eines Moduls soll
  // keine Dateien anfassen. Ohne logName bleibt die Queue flüchtig — so kann
  // ein Aufrufer, der bewusst keinen dauerhaften Zustand will, ihn auch nicht
  // versehentlich bekommen.
  function laden() {
    if (geladen || !logName) return;
    geladen = true;
    for (const e of readLog(logName)) {
      if (e.art === "enqueue") {
        queue.push({ ...e.action });
        nachSchluessel.set(e.action.idempotencyKey, e.action.id);
      } else if (e.art === "status") {
        const a = queue.find((x) => x.id === e.id);
        if (a) {
          a.status = e.status;
          a.attempts = e.attempts;
        }
      }
    }
    // Der Zähler setzt ÜBER der höchsten bekannten id auf. Bei 0 zu beginnen
    // vergäbe eine id zweimal, und `finde(id)` träfe dann die falsche Aktion.
    _id = queue.reduce((max, a) => Math.max(max, a.id), 0);
  }

  // Statuswechsel gehören ins Log, sonst führte ein Neustart eine bereits
  // erledigte Aktion erneut aus — genau das, was die Idempotenz verhindern soll.
  function statusSetzen(action, status) {
    action.status = status;
    if (logName) {
      appendLog(logName, {
        art: "status",
        id: action.id,
        status,
        attempts: action.attempts,
      });
    }
  }

  function enqueueAction({ threadId, actionType, payload, idempotencyKey }) {
    // TOR 1 bleibt das erste Tor: nicht auf der Whitelist → nicht einmal
    // schreiben. Die Dedup-Prüfung kommt DANACH, damit ein nicht erlaubter Typ
    // auch dann auffliegt, wenn er einen bekannten Schlüssel mitbringt.
    if (!erlaubt.has(actionType)) {
      throw new Error(
        `actionType steht nicht auf der Whitelist: ${actionType}`,
      );
    }
    laden();

    const schluessel =
      idempotencyKey ?? schluesselAus({ threadId, actionType, payload });

    // Schon bekannt → keine zweite Zeile, sondern dieselbe id. Auch dann, wenn
    // die erste REJECTED oder FAILED endete: gleiche Eingabe, gleiches Ergebnis.
    // Ein neuer Versuch ist ein neuer Schlüssel, keine stille Wiederholung.
    const vorhanden = nachSchluessel.get(schluessel);
    if (vorhanden !== undefined) return vorhanden;

    const action = {
      id: ++_id,
      threadId,
      actionType,
      payload,
      idempotencyKey: schluessel,
      status: "PENDING",
      attempts: 0,
    };
    queue.push(action);
    nachSchluessel.set(schluessel, action.id);
    if (logName) appendLog(logName, { art: "enqueue", action });
    return action.id;
  }

  // Worker: läuft periodisch. Atomar übernehmen → validieren → ausführen → retry/fail.
  async function processOne(action) {
    action.attempts++;
    // PROCESSING wandert bewusst NICHT ins Log: es ist ein Durchgangszustand.
    // Stünde er dort und stürbe der Prozess mitten im Aufruf, käme die Aktion
    // als PROCESSING zurück und der Worker rührte sie nie wieder an. So bleibt
    // sie PENDING und wird erneut versucht — bei einem simulierten Aufruf
    // folgenlos, bei einem echten die richtige Wahl (lieber ein zweiter
    // Versuch als eine stehengebliebene Aktion; die Idempotenz trägt ihn).
    action.status = "PROCESSING";

    // TOR 2: Payload-Validierung.
    const ok = validators[action.actionType]?.(action.payload);
    if (!ok) {
      statusSetzen(action, "REJECTED");
      return;
    }

    try {
      // HIER fände der echte externe Aufruf statt (fetch + hartes Timeout).
      // Im Starter nur simuliert.
      // await fetch(...);
      statusSetzen(action, "DONE");
    } catch {
      if (action.attempts >= 3) statusSetzen(action, "FAILED");
      else statusSetzen(action, "PENDING"); // wird erneut versucht
    }
  }

  function startActionWorker(intervalMs = 5000) {
    if (timer) return;
    timer = setInterval(async () => {
      // Ohne diese Sperre kann der nächste Takt starten, während der vorige noch
      // auf einen Aufruf wartet — und dieselbe PENDING-Aktion ein zweites Mal
      // aufnehmen. Heute simuliert der Aufruf nur; morgen dauert er.
      if (laeuft) return;
      laeuft = true;
      try {
        laden();
        const pending = queue.filter((a) => a.status === "PENDING");
        for (const a of pending) await processOne(a);
      } finally {
        laeuft = false;
      }
    }, intervalMs);
    timer.unref?.();
  }

  function stopActionWorker() {
    clearInterval(timer);
    timer = null;
  }

  // Eine Kopie: von außen ist die Queue nicht manipulierbar.
  function getQueue() {
    laden();
    return queue.slice();
  }

  return { enqueueAction, getQueue, startActionWorker, stopActionWorker };
}
