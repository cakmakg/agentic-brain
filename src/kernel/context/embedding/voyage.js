// ── kernel/context/embedding/voyage.js ───────────────────────────────────
// Der ZWEITE Embedding-Adapter (ADR-0015): ein echtes Retrieval-Modell.
//
// WARUM VOYAGE UND NICHT ANTHROPIC. Weil es kein Anthropic-Embedding gibt.
// Die Dokumentation sagt es wörtlich: „Anthropic does not offer its own
// embedding model" — und empfiehlt Voyage AI. Das ist der Grund, warum in
// diesem sonst anthropic-reinen Repo ein zweiter Anbieter steht; es ist keine
// Vorliebe, sondern die dokumentierte Empfehlung des ersten.
//
// KEINE NEUE ABHÄNGIGKEIT. Voyage hat kein Node-SDK, aber eine HTTP-API, und
// Node bringt `fetch` mit. Ein Paket für einen einzigen POST wäre eine
// Abhängigkeit, die `npm audit` mitträgt, ohne etwas beizutragen.
//
// ER KOSTET GELD UND BRAUCHT EIN NETZ. Deshalb ist er NICHT die
// Voreinstellung: `hash` trägt Schicht A und K5 (ADR-0007, ADR-0015). Dieser
// Adapter läuft nur, wenn jemand ihn ausdrücklich verlangt.

import { env } from "../../config/env.js";

const ENDPUNKT = "https://api.voyageai.com/v1/embeddings";

// Wie viele Texte je Anfrage. Voyage begrenzt Stapelgröße und Token je
// Aufruf; 128 liegt darunter und hält eine einzelne Anfrage klein genug, dass
// ein Fehlschlag nicht einen ganzen Ingest verwirft.
const STAPEL = 128;

// Der Port kennt „dokument" und „anfrage"; Voyage nennt dieselbe
// Unterscheidung `input_type`. Sie wegzulassen wäre der häufigste Fehler mit
// diesem Modell: die Dokumentation nennt es ausdrücklich als Pflicht für
// Retrieval, weil das Modell vor die Frage und vor das Dokument je einen
// eigenen Hinweis setzt. Ein Retrieval ohne diese Unterscheidung sucht in
// einem Raum, für den es nicht trainiert wurde.
const INPUT_TYPE = { dokument: "document", anfrage: "query" };

// ── 429: warten statt abbrechen ─────────────────────────────────────────
// Ein Konto ohne hinterlegte Zahlungsart hat bei Voyage 3 Anfragen je Minute;
// ein Lauf braucht rund 480 (gezählt am 2026-11-16). Ohne Warten bricht er
// nach der dritten ab. NUR 429 wird wiederholt: 401 und 400 werden durch
// Warten nicht richtiger, und ein Wiederholen verschleierte sie.
//
// Die Obergrenze ist Absicht. Ein Lauf, der endlos wartet, sieht aus wie einer,
// der rechnet; nach MAX_VERSUCHE fällt er mit derselben Meldung wie zuvor.
const MAX_VERSUCHE = 8;
const wartezeitMs = (versuch, retryAfter) => {
  const sekunden = Number(retryAfter);
  if (Number.isFinite(sekunden) && sekunden > 0) return sekunden * 1000;
  return Math.min(60_000, 5_000 * 2 ** (versuch - 1));
};
const schlafe = (ms) => new Promise((r) => setTimeout(r, ms));

// Fragt, und wartet bei 429 — höchstens MAX_VERSUCHE Mal. Liefert die letzte
// Antwort, gleich welchen Status; die Auswertung bleibt bei `frage`.
async function holeMitGeduld({ hole, warte }, anfrage) {
  let antwort = await hole(ENDPUNKT, anfrage);
  for (
    let versuch = 1;
    antwort.status === 429 && versuch < MAX_VERSUCHE;
    versuch++
  ) {
    const ms = wartezeitMs(versuch, antwort.headers?.get?.("retry-after"));
    console.error(
      `[voyage] 429 — warte ${Math.round(ms / 1000)} s (Versuch ${versuch + 1}/${MAX_VERSUCHE})`,
    );
    await warte(ms);
    antwort = await hole(ENDPUNKT, anfrage);
  }
  return antwort;
}

// Eine Anfrage an Voyage. Ausserhalb der Fabrik, damit die Fabrik klein
// bleibt und diese Funktion fuer sich lesbar ist — sie ist der einzige Ort im
// Repo, der ein fremdes Netz anspricht.
async function frage(zugang, texte, art) {
  const { schluessel, name, breite } = zugang;
  const anfrage = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${schluessel}`,
    },
    body: JSON.stringify({
      input: texte,
      model: name,
      input_type: INPUT_TYPE[art],
      output_dimension: breite,
    }),
  };

  const antwort = await holeMitGeduld(zugang, anfrage);

  if (!antwort.ok) {
    // Der Statuscode gehört in die Meldung: 401 ist ein falscher Schlüssel,
    // 429 ein Ratenlimit, 400 meist ein zu großer Stapel. Ein „Fehler beim
    // Einbetten" ohne Code schickt den Nächsten auf die falsche Fährte.
    const koerper = await antwort.text().catch(() => "");
    throw new Error(
      `Voyage ${antwort.status}: ${koerper.slice(0, 300) || antwort.statusText}`,
    );
  }

  const daten = (await antwort.json())?.data;
  if (!Array.isArray(daten)) {
    throw new Error("Voyage: Antwort ohne `data`-Liste.");
  }

  // ── NACH `index` SORTIEREN, nicht der Reihenfolge vertrauen. ────────
  // Die Antwort trägt je Eintrag ein `index`-Feld — es gäbe keinen Grund
  // dafür, wenn die Reihenfolge garantiert wäre. Vertraut man ihr trotzdem
  // und sie stimmt einmal nicht, trägt jeder Chunk den Vektor eines
  // anderen. Die Anzahl stimmt dabei, also fängt die Prüfung im Port das
  // NICHT ab — und keine Metrik dieses Repos auch nicht.
  const sortiert = [...daten].sort((a, b) => a.index - b.index);
  for (const [i, e] of sortiert.entries()) {
    if (e.index !== i) {
      throw new Error(
        `Voyage: Antwort ist lückenhaft — erwartet Index ${i}, bekommen ${e.index}.`,
      );
    }
  }
  return sortiert.map((e) => e.embedding);
}

export function createVoyageAdapter({
  apiKey,
  modell,
  dimensionen,
  fetchImpl,
  warte = schlafe,
} = {}) {
  // `??`, nicht `||`: ein ausdrücklich leerer Schlüssel heißt „keiner" und
  // fällt NICHT auf die Umgebung zurück. Mit `||` bestand der Test „ohne
  // Schlüssel wirft" nur, solange in der `.env` zufällig keiner stand.
  const schluessel = apiKey ?? env.voyageApiKey;
  if (!schluessel) {
    throw new Error(
      "createVoyageAdapter: VOYAGE_API_KEY fehlt. Der Adapter rät keinen Schlüssel — " +
        "ein Lauf, der still auf `hash` zurückfiele, würde etwas anderes messen als angefordert.",
    );
  }

  const name = modell || env.voyageModell;
  // `voyage-4` liefert standardmäßig 1024 Dimensionen und beherrscht auch
  // 256, 512 und 2048 (Matryoshka: die kürzeren sind Präfixe der längeren).
  // Die Zahl steht im Vertrag mit dem Postgres-Schema — `vector(n)` — und
  // wird deshalb ausdrücklich mitgeführt statt aus der ersten Antwort geraten.
  const breite = Number(dimensionen || env.voyageDimensionen || 1024);
  const zugang = {
    hole: fetchImpl || globalThis.fetch,
    schluessel,
    name,
    breite,
    warte,
  };

  return {
    name,
    dimensionen: breite,

    async einbetteViele(texte, art) {
      const alle = [];
      for (let i = 0; i < texte.length; i += STAPEL) {
        alle.push(...(await frage(zugang, texte.slice(i, i + STAPEL), art)));
      }
      return alle;
    },
  };
}
