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
  │  └── ablage ──────────┘
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

| # | Knoten | Was passiert | LLM? |
| --- | --- | --- | --- |
| 1 | `guardrail` | Kill-Switch prüfen, Muster bewerten, drei Wege | nein |
| 2 | `orchestrator` | BREMSE 4 greift: kein Ergebnis | nein |
| 3 | `bearbeiter` | erzeugt `ergebnis`, erhöht `revisionCount` | **ja** |
| 4 | `orchestrator` | BREMSE 5 greift: Ergebnis da, nicht abgelegt | nein |
| 5 | `ablage` | schreibt das Artefakt, setzt `abgelegt` | nein |
| 6 | `orchestrator` | BREMSE 2 greift: abgelegt, keine Entscheidung | nein |
| 7 | `human_approval` | **Der Graph hält an.** | — |
| 8 | `zusteller` | nur bei `true`: reiht eine Aktion ein | nein |

Ein LLM-Aufruf für den ganzen Lauf. Das ist kein Zufall: die Bremsen lösen den Grossteil
der Routing-Entscheidungen mit null Kosten.

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

| # | Bedingung | Ziel | Warum an dieser Stelle |
| --- | --- | --- | --- |
| 1 | `zugestellt` | `END` | nach der Zustellung nicht erneut in die Schleife |
| 2 | `abgelegt && humanApproval == null` | `human_approval` | **vor jeder Datenlogik** |
| 3 | `revisionCount >= 5` | `human_approval` | Schutzschalter |
| 4 | `!ergebnis` | `bearbeiter` | |
| 5 | `ergebnis && !abgelegt` | `ablage` | |

Bremse 2 steht bewusst so weit oben: die HITL-Entscheidung darf niemals von einer späteren
Regel überholt und niemals einem Modell überlassen werden. Der Test
„BREMSE 2 geht der Datenlogik VOR" hält genau das fest.

## Schicht 2 und 3

Greift **keine** Bremse, fragt der Orchestrator ein Modell (strukturierte Ausgabe, Zod). Das
ist ein seltener Pfad — deshalb ein guter Kandidat für ein billigeres Modell über
`MODEL_ORCHESTRATOR`.

Danach kommt Schicht 3: was nicht im Enum steht, wird auf `END` überschrieben. Ein
halluzinierter Knotenname bringt den Graphen damit nicht zum Absturz und führt ihn auch
nirgendwohin.

## Was der Lauf hinterlässt

| Ort | Inhalt | Lebensdauer |
| --- | --- | --- |
| Event-Bus | Live-Anzeige (SSE) | flüchtig, Puffer 5 Minuten |
| `evals/traces/<threadId>.jsonl` | eine Zeile je Knoten | bleibt, ist die Messquelle |
| `.zustand/checkpoints-<domäne>.jsonl` | Graph-Checkpoints | bleibt, überlebt Neustart |
| `.zustand/artefakte-<domäne>.jsonl` | das Artefakt | bleibt |
| `.zustand/aktionen-<domäne>.jsonl` | Queue und Dedup-Index | bleibt |

Der Ort ist über `STATE_DIR` und `TRACE_DIR` überschreibbar. Tests und Harness zeigen auf
ein Temp-Verzeichnis — sonst schleppt der zweite Lauf den ersten mit, und der
Determinismus-Nachweis wäre keiner mehr.
