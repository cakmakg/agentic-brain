// ── kernel/observability/costTracker.js ──────────────────────────────────────────────
// Kostenverfolgung Token → USD + AUTOMATISCHER BUDGET-KILL-SWITCH.
//
// Gründerlektion: In einem System, das Geld ausgibt, ist Kosten ein
// SICHERHEITSTHEMA. Ein Schleifenfehler oder eine böswillige Nutzerin kann über
// Nacht eine dreistellige LLM-Rechnung erzeugen. Der Budget-Kill-Switch ist eine
// finanzielle Brandmauer. Bau ihn ab dem ersten Tag ein.

import { env } from "../config/env.js";

// Beispielpreise je 1 Mio. Token, pro Modell-ID. Ein Rollen-Override (z.B.
// billigerer Critic über MODEL_CRITIC) muss auch beim Preis ankommen — sonst
// zählt die Kostenmetrik einen Haiku-Aufruf zum Sonnet-Preis und die Einsparung ist
// unsichtbar. Unbekanntes oder fehlendes Modell fällt auf env.model zurück —
// das ist genau das bisherige Verhalten (Bestandstests bleiben unverändert).
const PRICES = {
  "claude-sonnet-4-6": { in: 3 / 1_000_000, out: 15 / 1_000_000 },
  "claude-haiku-4-5": { in: 1 / 1_000_000, out: 5 / 1_000_000 },
};
const DEFAULT_PRICE = PRICES[env.model] || PRICES["claude-sonnet-4-6"];

let monthlySpendUsd = 0;
let throttled = false; // Sobald true, bricht der Guardrail den nächsten Workflow ab.

export function trackUsage({ inputTokens = 0, outputTokens = 0, model }) {
  const price = (model && PRICES[model]) || DEFAULT_PRICE;
  const cost = inputTokens * price.in + outputTokens * price.out;
  monthlySpendUsd += cost;
  if (monthlySpendUsd >= env.monthlyBudgetUsd) throttled = true;
  return cost;
}

export const cost = {
  isThrottled: () => throttled,
  spend: () => monthlySpendUsd,
  // Manueller Kill-Switch (Admin-Knopf "throttle").
  setThrottled: (v) => {
    throttled = Boolean(v);
  },
  reset: () => {
    monthlySpendUsd = 0;
    throttled = false;
  },
};
