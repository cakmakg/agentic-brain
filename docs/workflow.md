# Ablauf

Wie ein Lauf durch den Graphen geht — Knotenreihenfolge, Pause und Fortsetzung.

## Die Topologie

```
START
  │
  ▼
guardrail ──(Bedrohung / Budget)──▶ END
  │
  ▼
orchestrator ◀────────────┐
  │  ├── bearbeiter ──────┤   jeder Spoke kehrt zum Hub zurück
  │  ├── pruefer ─────────┤   das QA-Tor; lehnt es ab, geht es zurück zum
  │  └── ablage ──────────┘   bearbeiter — die Revisionsschleife
  │
  ├──▶ END
  │
  ▼
human_approval        ⛔ interruptBefore — HIER HÄLT DER GRAPH AN
  │
  ├── humanApproval === true ──▶ zusteller ──▶ END
  └── alles andere (auch null) ──────────────▶ END
```

Die letzte Verzweigung ist die zentrale Zusage. Sie ist **fail-closed**: nur ein exaktes
`true` führt zum terminalen Knoten. `false`, `null`, `undefined` — alles endet bei `END`.

## Der goldene Pfad, Schritt für Schritt

| #   | Knoten           | Was passiert                                                                  | LLM?   |
| --- | ---------------- | ----------------------------------------------------------------------------- | ------ |
| 1   | `guardrail`      | Kill-Switch prüfen, Muster bewerten, drei Wege                                | nein   |
| 2   | `orchestrator`   | BREMSE 4 greift: kein Ergebnis                                                | nein   |
| 3   | `bearbeiter`     | erzeugt `ergebnis`, erhöht `revisionCount`, setzt `istFreigegeben` auf `null` | **ja** |
| 4   | `orchestrator`   | BREMSE 5 greift: Ergebnis da, aber ungeprüft                                  | nein   |
| 5   | `pruefer`        | urteilt `{ istFreigegeben, gruende }`                                         | **ja** |
| 6   | `orchestrator`   | BREMSE 7 greift: freigegeben, nicht abgelegt                                  | nein   |
| 7   | `ablage`         | schreibt das Artefakt, setzt `abgelegt`                                       | nein   |
| 8   | `orchestrator`   | BREMSE 2 greift: abgelegt, keine Entscheidung                                 | nein   |
| 9   | `human_approval` | **Der Graph hält an.**                                                        | —      |
| 10  | `zusteller`      | nur bei `true`: reiht eine Aktion ein                                         | nein   |

Zwei LLM-Aufrufe für den ganzen Lauf — einer je produzierendem Spoke. Alle sechs
Routing-Entscheidungen dazwischen kosten nichts: das ist die Aussage der Bremsen.

**Lehnt der Prüfer ab**, tritt zwischen 5 und 6 eine Runde dazu: BREMSE 6 schickt zurück
zum `bearbeiter`, der eine neue Fassung liefert und `istFreigegeben` wieder auf `null`
setzt. Erst dadurch wächst `revisionCount` im Live-Pfad — und erst dadurch kann BREMSE 3
überhaupt auslösen.

## Die HITL-Mechanik

Das ist eine **Zustandsmaschine, die zwischen zwei HTTP-Anfragen lebt.**

1. `POST /api/run` startet den Workflow. Er läuft bis `human_approval` und hält dort an.
   Die Antwort enthält die `threadId`.
2. Dazwischen kann der Prozess **sterben**. Der Checkpoint liegt auf der Platte.
3. `POST /api/approve` schreibt die Entscheidung in denselben Checkpoint und setzt fort.

**Das Geheimnis ist: dieselbe `thread_id`.** Ein `stream(null, config)` heißt „vom
Checkpoint fortsetzen". Ohne dieselbe `thread_id` beginnt stattdessen ein neuer Lauf, und
niemand merkt es — die Genehmigung läuft ins Leere.

Je Domäne existiert **ein** Runner (Modul-Singleton). Zwei Runner derselben Domäne hätten
getrennte Zustände.

## Die Bremsen

Schicht 1 des Routings. Eine Bremse ist `(state) => Teilzustand | null`. Die erste, die
etwas zurückgibt, entscheidet — alles danach läuft nicht mehr.

**Die Reihenfolge ist die Aussage der Domäne.** Für `beispiel`:

| #   | Bedingung                                          | Ziel             | Warum an dieser Stelle                           |
| --- | -------------------------------------------------- | ---------------- | ------------------------------------------------ |
| 1   | `zugestellt`                                       | `END`            | nach der Zustellung nicht erneut in die Schleife |
| 2   | `abgelegt && humanApproval == null`                | `human_approval` | **vor jeder Datenlogik**                         |
| 3   | `revisionCount >= 5`                               | `human_approval` | Schutzschalter                                   |
| 4   | `!ergebnis`                                        | `bearbeiter`     |                                                  |
| 5   | `ergebnis && istFreigegeben == null`               | `pruefer`        | **ungeprüft**                                    |
| 6   | `ergebnis && istFreigegeben === false`             | `bearbeiter`     | **abgelehnt** — Revision                         |
| 7   | `ergebnis && istFreigegeben === true && !abgelegt` | `ablage`         |                                                  |

Bremse 2 steht bewusst so weit oben: die HITL-Entscheidung darf niemals von einer späteren
Regel überholt und niemals einem Modell überlassen werden. Der Test
„BREMSE 2 geht der Datenlogik VOR" hält genau das fest.

**Bremse 5 und 6 sind zwei Bremsen, nicht eine.** `null` heißt „ungeprüft", `false` heißt
„abgelehnt" — das sind verschiedene Zustände. Behandelt man sie gleich, routet ein
abgelehntes Ergebnis wieder zum Prüfer, der sich damit endlos selbst anruft, bis das
Rekursionslimit greift. Der Test „null ist NICHT false" hält den Unterschied fest.

Dass Bremse 3 im Live-Pfad wirklich auslöst, ist kein Argument, sondern ein Lauf: der Fall
`SS-1` im Golden-Datensatz und der Test „Dauerablehnung löst BREMSE 3 aus".

## Schicht 2 und 3

Greift **keine** Bremse, fragt der Orchestrator ein Modell (strukturierte Ausgabe, Zod). Das
ist ein seltener Pfad — deshalb ein guter Kandidat für ein billigeres Modell über
`MODEL_ORCHESTRATOR`.

Danach kommt Schicht 3: was nicht im Enum steht, wird auf `END` überschrieben. Ein
halluzinierter Knotenname bringt den Graphen damit nicht zum Absturz und führt ihn auch
nirgendwohin.

## Was der Lauf hinterlässt

| Ort                                   | Inhalt                | Lebensdauer                |
| ------------------------------------- | --------------------- | -------------------------- |
| Event-Bus                             | Live-Anzeige (SSE)    | flüchtig, Puffer 5 Minuten |
| `evals/traces/<threadId>.jsonl`       | eine Zeile je Knoten  | bleibt, ist die Messquelle |
| `.zustand/checkpoints-<domäne>.jsonl` | Graph-Checkpoints     | bleibt, überlebt Neustart  |
| `.zustand/artefakte-<domäne>.jsonl`   | das Artefakt          | bleibt                     |
| `.zustand/aktionen-<domäne>.jsonl`    | Queue und Dedup-Index | bleibt                     |

Der Ort ist über `STATE_DIR` und `TRACE_DIR` überschreibbar. Tests und Harness zeigen auf
ein Temp-Verzeichnis — sonst schleppt der zweite Lauf den ersten mit, und der
Determinismus-Nachweis wäre keiner mehr.
