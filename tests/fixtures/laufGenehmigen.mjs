// ── tests/fixtures/laufGenehmigen.mjs ────────────────────────────────────
// ZWEITER Prozess der Persistenzprüfung. Er hat den Lauf nie gesehen: kein
// gemeinsamer Arbeitsspeicher, kein Handle, nichts als dasselbe STATE_DIR.
// Findet er den wartenden Lauf wieder und bringt ihn zu Ende, ist die Zusage
// eingelöst — findet er ihn nicht, ist sie es nicht. Dazwischen gibt es nichts.
//
// Aufruf: node laufGenehmigen.mjs <threadId> <true|false>

const threadId = process.argv[2];
const genehmigt = process.argv[3] !== "false";

await import("../../src/domains/beispiel/domain.js");
const { getRunner } = await import("../../src/kernel/registry.js");
const { getArtifact } =
  await import("../../src/domains/beispiel/agents/ablage.js");
const { getQueue } = await import("../../src/domains/beispiel/actions.js");

// Was der neue Prozess VOR der Genehmigung sieht — der eigentliche Beweis, dass
// der Zustand die Prozessgrenze überlebt hat und nicht erst danach entsteht.
const davor = getArtifact(threadId)?.status ?? null;

const { resolveApproval } = getRunner("beispiel");
await resolveApproval({ threadId, approved: genehmigt });

console.log(
  JSON.stringify({
    pid: process.pid,
    davor,
    artefakt: getArtifact(threadId)?.status ?? null,
    queue: getQueue().length,
  }),
);

process.exit(0);
