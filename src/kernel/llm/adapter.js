// ── kernel/llm/adapter.js ────────────────────────────────────────────────
// Der einzige LLM-Eingang. Alle Agenten laufen hier durch. Er leistet zweierlei:
//   1) Strukturierte Ausgabe (withStructuredOutput) — eine auf ein Zod-Schema
//      gezwungene, verlässliche Antwort.
//   2) MOCK-MODUS — ohne ANTHROPIC_API_KEY wird kein echter Aufruf gemacht.
//
// Gründerlektion: Versteck das LLM hinter einem einzigen Adapter. Willst du morgen
// Modell oder Anbieter wechseln, ändert sich eine Datei — nicht fünfzehn Agenten.

import { env, MOCK_LLM } from "../config/env.js";
import { trackUsage } from "../governance/costTracker.js";
import { estTokens, mockText } from "./mock.js";

// Beobachter je LLM-Aufruf. Ohne ihn ist das Kontextwachstum nicht
// messbar: die Eingabe-Token eines einzelnen Aufrufs sind sonst nirgends sichtbar.
// Der Kern sammelt nichts selbst — er meldet nur; wer misst, hört zu.
const beobachter = new Set();
export function onLlmCall(fn) {
  beobachter.add(fn);
  return () => beobachter.delete(fn);
}
function melde(aufruf) {
  for (const fn of beobachter) fn(aufruf);
}

// Ein ChatAnthropic je Modell-ID — Rollen mit unterschiedlichem Modell (z.B.
// billiger Critic) dürfen sich keine Instanz teilen.
const _models = new Map();
async function getModel(modelId) {
  if (_models.has(modelId)) return _models.get(modelId);
  const { ChatAnthropic } = await import("@langchain/anthropic");
  const model = new ChatAnthropic({
    model: modelId,
    apiKey: env.anthropicKey,
    temperature: 0.3,
  });
  _models.set(modelId, model);
  return model;
}

// Freitext-Antwort. `model`: welche Modell-ID läuft (Default env.model) —
// die Domäne entscheidet über modelFor(rolle), welches das ist.
export async function llmText(systemPrompt, userPrompt, model = env.model) {
  if (MOCK_LLM) {
    const inputTokens = estTokens(systemPrompt + userPrompt);
    const usd = trackUsage({ inputTokens, outputTokens: 60, model });
    melde({
      inputTokens,
      outputTokens: 60,
      usd,
      art: "text",
      mock: true,
      model,
    });
    return mockText(userPrompt);
  }
  const m = await getModel(model);
  const res = await m.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  const u = res.usage_metadata || {};
  const usd = trackUsage({
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    model,
  });
  melde({
    usd,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    art: "text",
    mock: false,
    model,
  });
  return res.content;
}

// Strukturierte Antwort (Zod-Schema). Für Routing, Critic-Entscheidung usw.
// mockFactory: erzeugt im Mock-Modus ein schemakonformes Fake-Objekt. Sie kommt
// aus der Domäne — der Kern weiß nicht, was fachlich eine gültige Antwort ist.
export async function llmStructured(
  schema,
  systemPrompt,
  userPrompt,
  mockFactory,
  model = env.model,
) {
  if (MOCK_LLM) {
    const inputTokens = estTokens(systemPrompt + userPrompt);
    const usd = trackUsage({ inputTokens, outputTokens: 40, model });
    melde({
      inputTokens,
      outputTokens: 40,
      usd,
      art: "structured",
      mock: true,
      model,
    });
    return mockFactory();
  }
  const m = await getModel(model);
  const structured = m.withStructuredOutput(schema);
  const res = await structured.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return res;
}
