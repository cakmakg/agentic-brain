// ── kernel/governance/audit.js ───────────────────────────────────────────
// A6: Das Audit-Log ist eine HASH-KETTE ÜBER DEM BESTEHENDEN TRACE — kein
// zweites Log. Jede Trace-Zeile trägt das Glied der vorigen (`prev`) und ihr
// eigenes (`hash`). Wer eine Zeile ändert, ändert ihren Hash; wer ihn
// mitändert, bricht das `prev` der nächsten. Ein konkreter Schritt Richtung
// EU AI Act Art. 12, ohne eine einzige neue Abhängigkeit: `node:crypto`.
//
// WARUM ÜBER DEM TRACE UND NICHT DANEBEN. Ein zweites Log wäre eine zweite
// Wahrheit: es müsste dieselben Ereignisse noch einmal aufschreiben, und ab
// dem ersten Tag könnten beide auseinanderlaufen, ohne dass etwas rot wird.
// Der Trace hält bereits genau das, was ein Audit braucht — Routing,
// Richtlinienentscheidungen, die menschliche Genehmigung. Ihm fehlte nur die
// Unversehrtheit.
//
// WAS DIE KETTE LEISTET UND WAS NICHT — das gehört hierher, nicht in eine
// Broschüre:
//
//   SIE ERKENNT   das Ändern, Einfügen oder Löschen einzelner Zeilen. Genau
//                 das ist der nachträgliche Eingriff, den man fürchtet: eine
//                 Ablehnung zur Genehmigung machen, einen Genehmigenden
//                 austauschen, eine Zeile verschwinden lassen.
//   SIE ERKENNT NICHT  das vollständige Neuschreiben der Datei. Wer alle
//                 Zeilen ab der geänderten neu hasht, erhält eine in sich
//                 stimmige Kette. Dagegen hilft nur ein Anker AUSSERHALB der
//                 Datei — ein anderswo notiertes letztes Glied. Solange der
//                 Anker fehlt, wird diese Grenze BENANNT und nicht behauptet.
//
// REINE FUNKTIONEN, kein IO. Das Lesen der Datei ist Sache von `trace.js`;
// diese Datei bekommt gelesene Zeilen und urteilt.

import crypto from "node:crypto";

import { stabil } from "../persistence/stabil.js";

// Das Glied vor der ersten Zeile. Ein benannter Wert statt einer leeren
// Zeichenkette: „es gab keinen Vorgänger" ist eine AUSSAGE und darf nicht wie
// ein vergessenes Feld aussehen — dieselbe Linie wie `UNBESETZT` im Vertrag
// der Domäne.
export const KETTEN_ANFANG = "0".repeat(64);

/**
 * Das Glied einer Zeile. `prev` steht IM gehashten Inhalt, nicht daneben:
 * sonst ließe sich eine Zeile an eine andere Stelle der Kette hängen, ohne
 * dass ihr eigener Hash sich ändert.
 *
 * `stabil` statt `JSON.stringify`, weil die Prüfung eine GELESENE Zeile neu
 * serialisiert. Käme dabei eine andere Reihenfolge heraus, meldete die Kette
 * einen Bruch, den es nicht gibt (siehe Kopf von `persistence/stabil.js`).
 */
export function gliedHash(zeileOhneHash) {
  return crypto
    .createHash("sha256")
    .update(stabil(zeileOhneHash))
    .digest("hex");
}

/**
 * Hält eine gelesene Kette gegen sich selbst.
 *
 * Gibt `{ ok, laenge, gebrochenBei, grund }` zurück. `gebrochenBei` ist der
 * INDEX der ersten schadhaften Zeile, nicht ein Wahrheitswert: „irgendwo
 * kaputt" ist für den, der nachsehen muss, keine Auskunft.
 *
 * Eine leere Kette ist gültig — es gibt nichts, was gebrochen sein könnte.
 * Das ist derselbe Gedanke wie der Nenner 0 in `EVALS.md`: nicht grün, aber
 * auch nicht rot; `laenge` sagt, worauf sich das `ok` stützt.
 */
export function pruefeKette(zeilen) {
  let vorher = KETTEN_ANFANG;

  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i];

    if (typeof zeile?.hash !== "string" || typeof zeile?.prev !== "string") {
      return {
        ok: false,
        laenge: zeilen.length,
        gebrochenBei: i,
        grund: "Zeile ohne Kettenglied (prev oder hash fehlt).",
      };
    }

    // Zuerst die VERKETTUNG. Sie fängt das Einfügen und das Löschen: beides
    // lässt die einzelne Zeile unversehrt und nur ihre Nachbarschaft falsch.
    if (zeile.prev !== vorher) {
      return {
        ok: false,
        laenge: zeilen.length,
        gebrochenBei: i,
        grund: `prev verweist auf ${zeile.prev.slice(0, 12)}…, erwartet war ${vorher.slice(0, 12)}…`,
      };
    }

    // Dann die UNVERSEHRTHEIT der Zeile selbst. Sie fängt das Ändern.
    const { hash, ...ohneHash } = zeile;
    if (gliedHash(ohneHash) !== hash) {
      return {
        ok: false,
        laenge: zeilen.length,
        gebrochenBei: i,
        grund: "Inhalt der Zeile passt nicht zu ihrem Hash.",
      };
    }

    vorher = hash;
  }

  return { ok: true, laenge: zeilen.length, gebrochenBei: null, grund: null };
}
