// ── kernel/persistence/checkpointer.js ───────────────────────────────────
// Der Checkpointer, der einen Neustart überlebt. Er ist die Hälfte der
// HITL-Zusage: der Graph hält bei `human_approval` an und lebt DANN zwischen
// zwei HTTP-Anfragen weiter. Lag er im Arbeitsspeicher, war „zwischen zwei
// Anfragen" stillschweigend auf „solange der Prozess lebt" begrenzt.
//
// ENTSCHEIDENDER ENTWURF: Dies ist KEINE eigene Checkpointer-Implementierung.
// Das Protokoll (getTuple, list, put, putWrites, Kanalversionen, Elternkette)
// korrekt nachzubauen wäre die riskanteste Zeile dieses Repos — ein Fehler
// darin verliert genau die Läufe, die dieses Kriterium retten soll.
//
// Stattdessen ERBT die Klasse von `MemorySaver`: die bewährte Logik bleibt
// unangetastet, ergänzt wird nur, was fehlt — ANHÄNGEN beim Schreiben,
// ABSPIELEN beim ersten Zugriff. Berührt werden ausschließlich dokumentierte
// Schnittstellen (`super.*`, `this.serde`); die internen Felder `storage` und
// `writes` fasst diese Datei NICHT an.
//
// WARUM DAS ABSPIELEN NICHT IM KONSTRUKTOR STEHT: `serde.loadsTyped` ist
// asynchron. Ein Konstruktor kann nicht warten — er hätte ein Promise statt
// eines Checkpoints weitergereicht, und der Speicher wäre still leer geblieben.
// Genau das ist beim Bauen passiert: der zweite Prozess fand das Artefakt,
// aber keinen Lauf. Deshalb läuft das Abspielen einmalig beim ersten Zugriff,
// wo gewartet werden darf. (Nebeneffekt, der ohnehin erwünscht war: das bloße
// Laden eines Moduls liest keine Datei.)
//
// Grenzen: die des Logs aus `store.js` (unbegrenztes Wachstum, keine Sperre
// zwischen Prozessen) plus eine eigene — abgespielt wird die GANZE Historie,
// nicht nur der letzte Checkpoint. Bei einem Starter gewollt (die Elternkette
// bleibt vollständig), ins Unendliche skaliert es nicht.

import { MemorySaver } from "@langchain/langgraph";

import { appendLog, readLog } from "./store.js";

// Die serialisierte Form ist ein Byte-Array; JSONL trägt Text. Base64 ist der
// kleinste ehrliche Übersetzer dazwischen.
const zuText = (bytes) => Buffer.from(bytes).toString("base64");
const zuBytes = (text) => new Uint8Array(Buffer.from(text, "base64"));

export class DateiCheckpointer extends MemorySaver {
  #logName;
  #bereit = null;
  #spieltAb = false;

  constructor(logName = "checkpoints", serde) {
    super(serde);
    this.#logName = logName;
  }

  // Einmalig, und alle Wartenden teilen sich dasselbe Promise.
  #sicherstellen() {
    if (!this.#bereit) this.#bereit = this.#abspielen();
    return this.#bereit;
  }

  // Historie zurück in den Arbeitsspeicher. Schreibt dabei NICHT ins Log —
  // sonst verdoppelte jeder Neustart die Historie und die Datei wüchse
  // exponentiell.
  async #abspielen() {
    this.#spieltAb = true;
    try {
      for (const e of readLog(this.#logName)) {
        try {
          if (e.art === "put") {
            const checkpoint = await this.serde.loadsTyped(
              e.cpTyp,
              zuBytes(e.cp),
            );
            const metadata = await this.serde.loadsTyped(
              e.metaTyp,
              zuBytes(e.meta),
            );
            // Das URSPRÜNGLICHE config, nicht das zurückgegebene: nur darin
            // steht die Eltern-Checkpoint-Id, an der die Kette hängt.
            await super.put(e.config, checkpoint, metadata);
          } else if (e.art === "writes") {
            const writes = [];
            for (const [kanal, typ, wert] of e.writes) {
              writes.push([
                kanal,
                await this.serde.loadsTyped(typ, zuBytes(wert)),
              ]);
            }
            await super.putWrites(e.config, writes, e.taskId);
          }
        } catch (err) {
          // Eine unlesbare Zeile kostet einen Checkpoint, nicht den ganzen
          // Speicher. Laut, aber nicht tödlich.
          console.error(`[checkpointer] Eintrag übersprungen: ${err.message}`);
        }
      }
    } finally {
      this.#spieltAb = false;
    }
  }

  async getTuple(config) {
    await this.#sicherstellen();
    return super.getTuple(config);
  }

  async *list(config, options) {
    await this.#sicherstellen();
    yield* super.list(config, options);
  }

  async put(config, checkpoint, metadata, newVersions) {
    if (!this.#spieltAb) await this.#sicherstellen();
    const ergebnis = await super.put(config, checkpoint, metadata, newVersions);
    if (this.#spieltAb) return ergebnis;

    const [cpTyp, cp] = this.serde.dumpsTyped(checkpoint);
    const [metaTyp, meta] = this.serde.dumpsTyped(metadata);
    appendLog(this.#logName, {
      art: "put",
      config,
      cpTyp,
      cp: zuText(cp),
      metaTyp,
      meta: zuText(meta),
    });
    return ergebnis;
  }

  async putWrites(config, writes, taskId) {
    if (!this.#spieltAb) await this.#sicherstellen();
    await super.putWrites(config, writes, taskId);
    if (this.#spieltAb) return;

    appendLog(this.#logName, {
      art: "writes",
      config,
      taskId,
      writes: writes.map(([kanal, wert]) => {
        const [typ, bytes] = this.serde.dumpsTyped(wert);
        return [kanal, typ, zuText(bytes)];
      }),
    });
  }
}
