// ── tests/fixtures/laufStarten.mjs ───────────────────────────────────────
// ERSTER Prozess der Persistenzprüfung. Startet einen Workflow und LÄSST IHN
// STEHEN — bis `human_approval`, wo der Graph anhält. Danach endet der Prozess.
//
// Das ist kein Testhelfer aus Bequemlichkeit: die Zusage lautet, dass ein
// NEUSTART die wartende Genehmigung nicht verliert. Denselben Ablauf innerhalb
// eines Prozesses nachzustellen würde sie nicht prüfen, sondern umgehen — der
// Arbeitsspeicher wäre ja noch da.
//
// Aufruf: node laufStarten.mjs <threadId>   (STATE_DIR/TRACE_DIR aus der Umgebung)

const threadId = process.argv[2];

await import("../../src/domains/beispiel/domain.js");
const { getRunner } = await import("../../src/kernel/registry.js");
const { getArtifact } =
  await import("../../src/domains/beispiel/agents/ablage.js");

const { startWorkflow } = getRunner("beispiel");
const { interrupted } = await startWorkflow({
  task: "Eine kurze Zusammenfassung der offenen Punkte.",
  threadId,
});

// Eine Zeile, die der Test liest. Mehr Protokoll wäre hier nur Rauschen.
console.log(
  JSON.stringify({
    pid: process.pid,
    interrupted,
    artefakt: getArtifact(threadId)?.status ?? null,
  }),
);

process.exit(0);
