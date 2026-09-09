// ── kernel/state/schema.js ───────────────────────────────────────────────
// Kernfelder + Erweiterungspunkt der Domäne.
//
// Die Trennlinie: im Kern steht, was JEDE Domäne braucht — die Aufgabe, der
// Faden, der nächste Agent, der Bedrohungswert, der Revisionszähler, die
// menschliche Entscheidung, das Protokoll. Alles Fachliche (Recherche, Entwurf,
// Kritik) bringt die Domäne mit.
//
// `humanApproval` steht bewusst im KERN und nicht in der Domäne: an ihm hängt
// die fail-closed-Kante des Graphen. Die zentrale Zusage dieses Repos darf
// nicht davon abhängen, dass eine Domäne daran denkt.

import { Annotation } from "@langchain/langgraph";
import { lastWins, sum, append } from "./reducers.js";

const coreFields = {
  // Eingabe
  task: Annotation({ reducer: lastWins, default: () => "" }),
  threadId: Annotation({ reducer: lastWins, default: () => "" }),

  // Routing
  nextAgent: Annotation({ reducer: lastWins, default: () => "" }),

  // Zähler — AKKUMULATOR (Schutzschalter)
  revisionCount: Annotation({ reducer: sum, default: () => 0 }),

  // HITL — die Entscheidung des Menschen. true / false / null
  humanApproval: Annotation({ reducer: lastWins, default: () => null }),

  // Sicherheit
  threatScore: Annotation({ reducer: lastWins, default: () => 0 }),

  // Beobachtbarkeit
  log: Annotation({ reducer: append, default: () => [] }),
};

// Baut das State-Schema aus Kernfeldern und den Feldern der Domäne.
// Eine Domäne darf Kernfelder NICHT überschreiben — sonst könnte sie die
// fail-closed-Kante still aushebeln.
export function buildState(domain) {
  const eigene = domain.stateFields ?? {};
  for (const name of Object.keys(eigene)) {
    if (name in coreFields) {
      throw new Error(
        `Domäne "${domain.name}" überschreibt das Kernfeld "${name}" — nicht erlaubt.`,
      );
    }
  }
  return Annotation.Root({ ...coreFields, ...eigene });
}

export { coreFields };
