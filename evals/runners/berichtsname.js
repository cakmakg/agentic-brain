// ── evals/runners/berichtsname.js ────────────────────────────────────────
// Der Name eines Berichts — und damit, welcher Lauf welchen überschreibt.
//
// WARUM DER COMMIT IM NAMEN STEHT. Bis zum 2026-11-16 trug der Name nur das
// Datum. Zwei Etappen an einem Tag teilten sich also eine Datei, und der
// spätere Lauf löschte den Beleg des früheren (EVALS.md §8 — am 2026-09-20
// dreimal). Und jeder lokale Lauf überschrieb den committeten Bericht des
// Tages.
//
// Zwei Alternativen wurden verworfen: die Uhrzeit (mechanisch, aber der Name
// sagt nicht, WAS gemessen wurde) und eine Etappenmarke per Flag (lesbar, aber
// von Hand gesetzt — vergessen oder falsch gesetzt sieht sie aus wie richtig).
// Der Kurz-Hash ist beides nicht: er bindet die Zahlen an den Code, gegen den
// sie entstanden. Derselbe Commit ergibt denselben Namen — das ist harmlos,
// denn Schicht A ist deterministisch: derselbe Code, dieselben Zahlen.
//
// `-dirty` trennt den lokalen Versuch vom Beleg. Ein Lauf mit uncommitteten
// Änderungen kann so den Bericht eines sauberen Stands nie überschreiben.
//
// Rein bis auf den Git-Aufruf, und der ist einspeisbar — der Test fragt kein
// echtes Repo.

import { execFileSync } from "node:child_process";

const gitAufruf = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

/**
 * Der Code-Stand, gegen den gemessen wurde.
 *
 * @param {(args: string[]) => string} [git]  liefert die Ausgabe eines Git-Befehls
 * @returns {string}  `<hash>`, `<hash>-dirty` oder `ohne-git`
 */
export function codeStand(git = gitAufruf) {
  try {
    const hash = git(["rev-parse", "--short=7", "HEAD"]);
    // Nur verfolgte Dateien zählen: Berichte und Traces sind ignoriert, ein
    // früherer Lauf macht den Baum also nicht „dreckig".
    const dreckig =
      git(["status", "--porcelain", "--untracked-files=no"]) !== "";
    return dreckig ? `${hash}-dirty` : hash;
  } catch {
    // Kein Git (etwa ein entpacktes Archiv). Der Lauf soll trotzdem messen —
    // aber sein Bericht darf nicht aussehen wie einer mit bekanntem Stand.
    return "ohne-git";
  }
}

/**
 * @param {object} o
 * @param {string} o.erzeugt    ISO-Zeitstempel des Berichts
 * @param {string} o.domaene
 * @param {string} o.store      STORE_ADAPTER
 * @param {string} o.embedding  EMBEDDING_ADAPTER
 * @param {string} o.stand      Ergebnis von `codeStand()`
 * @returns {string}
 */
export function berichtsName({ erzeugt, domaene, store, embedding, stand }) {
  return `${erzeugt.slice(0, 10)}-schicht-a-${domaene}-${store}-${embedding}-${stand}.json`;
}
