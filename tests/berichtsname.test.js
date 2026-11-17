// ── tests/berichtsname.test.js ───────────────────────────────────────────
// Prüft, welcher Lauf welchen Bericht überschreibt — ohne echtes Repo.
//
// Der Fall, um den es geht, ist der letzte: zwei Läufe am selben Tag gegen
// verschiedenen Code. Bis zum 2026-11-16 ergaben sie denselben Namen, und der
// zweite löschte den Beleg des ersten (EVALS.md §8).

import { test } from "node:test";
import assert from "node:assert/strict";

const { berichtsName, berichtsNameB, codeStand } =
  await import("../evals/runners/berichtsname.js");

// Ein Git, das auf genau die zwei Fragen antwortet, die `codeStand` stellt.
function gitMit({ hash, status = "" }) {
  return (args) => {
    if (args[0] === "rev-parse") return hash;
    if (args[0] === "status") return status;
    throw new Error(`unerwarteter Git-Aufruf: ${args.join(" ")}`);
  };
}

const basis = {
  erzeugt: "2026-11-16T19:44:07.331Z",
  domaene: "besprechung",
  store: "memory",
  embedding: "hash",
};

test("sauberer Baum: der Name endet auf den Kurz-Hash", () => {
  const stand = codeStand(gitMit({ hash: "922ecaf" }));
  assert.equal(stand, "922ecaf");
  assert.equal(
    berichtsName({ ...basis, stand }),
    "2026-11-16-schicht-a-besprechung-memory-hash-922ecaf.json",
  );
});

test("uncommittete Aenderung: `-dirty`, damit ein Versuch keinen Beleg ueberschreibt", () => {
  const stand = codeStand(
    gitMit({ hash: "922ecaf", status: " M src/kernel/action/queue.js" }),
  );
  assert.equal(stand, "922ecaf-dirty");
  assert.notEqual(
    berichtsName({ ...basis, stand }),
    berichtsName({ ...basis, stand: "922ecaf" }),
  );
});

test("ohne Git: `ohne-git` statt eines Absturzes oder eines leeren Stands", () => {
  const stand = codeStand(() => {
    throw new Error("git: command not found");
  });
  assert.equal(stand, "ohne-git");
});

test("zwei Laeufe am selben Tag gegen verschiedenen Code ergeben zwei Dateien", () => {
  const frueh = berichtsName({ ...basis, stand: "cae929a" });
  const spaet = berichtsName({
    ...basis,
    erzeugt: "2026-11-16T23:10:00.000Z",
    stand: "922ecaf",
  });
  assert.notEqual(frueh, spaet, "der spaetere Lauf loeschte sonst den Beleg");
});

test("Schicht B: das Modell steht im Namen, wo bei Schicht A die Adapter stehen", () => {
  assert.equal(
    berichtsNameB({
      erzeugt: "2026-11-17T12:00:00.000Z",
      domaene: "besprechung",
      modell: "claude-haiku-4-5",
      stand: "abc1234",
    }),
    "2026-11-17-schicht-b-besprechung-claude-haiku-4-5-abc1234.json",
  );
});
