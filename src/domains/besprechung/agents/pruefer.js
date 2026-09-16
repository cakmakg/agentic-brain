// ── domains/besprechung/agents/pruefer.js ────────────────────────────────
// Das QA-Tor dieser Domäne — und der Grund, warum der Schutzschalter
// (BREMSE 3) überhaupt auslösen KANN: erst eine Ablehnung schickt den
// Extrahierer ein zweites Mal los, erst dann wächst `revisionCount` im
// Live-Pfad. Ein Schutzschalter, der nie auslöst, ist unbelegt.
//
// STRIKTE TRENNUNG VON PRODUZENT UND PRÜFER. Sagst du demselben Modell im
// selben Aufruf „schreib und kritisiere dich selbst", findet es seine eigene
// Arbeit gut. Deshalb: eigener Knoten, eigener Prompt, über
// `modelFor("pruefer")` die Möglichkeit eines eigenen (billigeren) Modells.
//
// DER UNTERSCHIED ZUM PRÜFER DER DOMÄNE `beispiel`, und er ist wesentlich:
// dort entscheidet im Mock-Modus ein Marker in der AUFGABE, hier entscheidet
// eine reine Funktion über der AUSGABE (`vertrag.js`). Der Prüfer urteilt
// damit über das, was tatsächlich produziert wurde, nicht über das, was
// bestellt war. Die Marker steuern nur noch den Produzenten — was ein Tor
// misst, misst es dadurch wirklich.

import { z } from "zod";

import { llmStructured } from "../../../kernel/llm/adapter.js";
import { modelFor } from "../../../kernel/config/env.js";
import { prompts } from "../prompts.js";
import { pruefeVertrag } from "../vertrag.js";

// Der Ausgabevertrag des Prüfers selbst. Strukturierte Ausgabe statt
// Freitext: ein „ja, aber…" in Prosa ist keine Entscheidung, auf die eine
// Bremse routen kann.
export const prueferSchema = z.object({
  istFreigegeben: z.boolean(),
  gruende: z.string(),
});

export async function prueferNode(state) {
  const urteil = await llmStructured(
    prueferSchema,
    prompts.pruefer.system,
    prompts.pruefer.user(state),
    // Im Mock-Modus entscheidet keine Zufallszahl, sondern der Vertrag.
    () => pruefeVertrag(state.aktionspunkte),
    modelFor("pruefer"),
  );

  return {
    istFreigegeben: urteil.istFreigegeben,
    gruende: urteil.gruende,
    nextAgent: "orchestrator", // jeder Spoke kehrt zum Hub zurück
    log: [
      urteil.istFreigegeben
        ? "🔍 pruefer: freigegeben"
        : `🔍 pruefer: abgelehnt (${urteil.gruende})`,
    ],
  };
}
