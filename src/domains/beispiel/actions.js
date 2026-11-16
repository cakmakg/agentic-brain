// ── domains/beispiel/actions.js ──────────────────────────────────────────
// Erlaubte Aktionstypen und ihre Payload-Schemata. Das ist BEDEUTUNG: welche
// Wirkung diese Domäne überhaupt in der Welt haben darf. Die Mechanik der
// Queue steht im Kern.
//
// Doppeltes Tor: die Whitelist verhindert das Schreiben, die Validierer
// verhindern die Ausführung. Ein gekaperter Agent kommt an beiden nicht vorbei.
//
// HIER WÄCHST DIE DOMÄNE: Trag ein, was dein System nach außen tun darf — und
// nichts darüber hinaus. Was nicht auf dieser Liste steht, kann kein Agent
// auslösen, auch kein übernommener.

import { createActionQueue } from "../../kernel/action/queue.js";

export const whitelist = ["NOTIFY", "WEBHOOK", "EMAIL"];

// Je Typ ein Schema und eine Längengrenze.
export const validators = {
  NOTIFY: (p) => typeof p.text === "string" && p.text.length <= 1000,
  WEBHOOK: (p) => typeof p.url === "string" && p.url.startsWith("https://"),
  EMAIL: (p) =>
    typeof p.to === "string" &&
    p.to.includes("@") &&
    (p.body || "").length <= 5000,
};

// Je Typ eine Risikoklasse (A19, Etappe 4c). Alle drei tragen 2: eine
// Benachrichtigung, ein Webhook, eine Mail erreichen jemand anderen, bevor
// ein Fehler bemerkt wird. Ausdrücklich und je Typ geschrieben, nicht als
// Voreinstellung — diese Domäne hat keine Ontologie, aus der die Klasse
// käme, und eine Voreinstellung sähe im Log aus wie eine vergebene Klasse.
// Die Klasse routet nicht; die HITL-Kante gilt unverändert.
export const risikoklassen = { NOTIFY: 2, WEBHOOK: 2, EMAIL: 2 };

// Eine Queue je Domäne. Sie ist ein Modul-Singleton, weil der Worker und die
// Beobachtung über /api/queue dieselbe Liste sehen müssen.
export const beispielQueue = createActionQueue({
  whitelist,
  validators,
  risikoklassen,
  logName: "aktionen-beispiel",
});

export const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
  beispielQueue;
