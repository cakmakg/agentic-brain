// ── kernel/graph/build.js ────────────────────────────────────────────────
// Baut den StateGraph aus einer Domänen-Spezifikation. Die Topologie
// HUB-AND-SPOKE ist Mechanik und steht deshalb hier; WELCHE Agenten es gibt,
// steht in der Domäne.
//
//   START → entry → hub ⇄ {spokes}
//                    ⛔ interruptBefore: human_approval  (hier STOPPT der Graph)
//                    → (nach der Genehmigung) terminal → END
//
// Prüfkriterium: eine zweite Domäne darf an dieser Datei NULL Zeilen ändern.

import { StateGraph, START, END } from "@langchain/langgraph";
import { buildState } from "../state/schema.js";
import { DateiCheckpointer } from "../persistence/checkpointer.js";

// human_approval = LEERER Platzhalter. Seine einzige Funktion: die Stelle
// markieren, an der der Graph anhält.
const humanNode = () => ({});

export const HUMAN_NODE = "human_approval";

export function buildGraph(domain) {
  const g = new StateGraph(buildState(domain));

  g.addNode(domain.entry, domain.nodes[domain.entry]);
  g.addNode(domain.hub, domain.nodes[domain.hub]);
  for (const name of domain.spokes) g.addNode(name, domain.nodes[name]);
  g.addNode(HUMAN_NODE, humanNode);
  g.addNode(domain.terminal, domain.nodes[domain.terminal]);

  g.addEdge(START, domain.entry);

  // entry → entweder END (Bedrohung) oder hub. Bedingt.
  g.addConditionalEdges(domain.entry, (s) =>
    s.nextAgent === "END" ? END : domain.hub,
  );

  // AUSGANG DES HUBS: nicht statisch, sondern BEDINGT.
  // state.nextAgent ist direkt der Knotenname.
  const ziele = { [HUMAN_NODE]: HUMAN_NODE, [END]: END };
  for (const name of domain.spokes) ziele[name] = name;
  g.addConditionalEdges(
    domain.hub,
    (s) => (s.nextAgent === "END" ? END : s.nextAgent),
    ziele,
  );

  // Jeder produzierende Agent kehrt zum Hub zurück.
  for (const name of domain.spokes) g.addEdge(name, domain.hub);

  // Nach human_approval folgt der terminale Knoten NUR bei ausdrücklicher
  // Freigabe. FAIL-CLOSED: alles, was nicht exakt true ist — auch null —
  // endet bei END. Das ist die zentrale Zusage des Repos im Code.
  g.addConditionalEdges(
    HUMAN_NODE,
    (s) => (s.humanApproval === true ? domain.terminal : END),
    { [domain.terminal]: domain.terminal, [END]: END },
  );

  g.addEdge(domain.terminal, END);

  // Der Checkpointer trägt Pause und Fortsetzung. Er überlebt einen
  // Neustart: je Domäne ein eigenes Log, damit zwei Domänen sich nicht in die
  // Historie schreiben. interruptBefore: der Graph hält an, BEVOR er
  // human_approval betritt → HITL.
  return g.compile({
    checkpointer: new DateiCheckpointer(`checkpoints-${domain.name}`),
    interruptBefore: [HUMAN_NODE],
  });
}
