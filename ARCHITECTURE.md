# ARCHITECTURE

> **Vertragsdokument.** Alle sieben Abschnitte tragen Bestand: §1–§5 beschreiben, was im Repo
> tatsächlich steht, §6 hält die offenen Fragen samt Fälligkeit, §7 ist der verbindliche
> Zielbaum. Bei Widerspruch gewinnt diese Datei gegen `docs/roadmap.md` — jenes ist ein
> Vorschlag und steht in der Autoritätskette gar nicht.

## 1. Die Trennlinie

Zwei Schichten, eine Naht:

- **`src/kernel/` — MECHANIK.** Wie ein Graph gebaut wird, wie eine Queue arbeitet, wie ein
  Trace geschrieben wird. Der Kern kennt **keine einzelne Domäne**.
- **`src/domains/<domäne>/` — BEDEUTUNG.** Welche Agenten es gibt, in welcher Reihenfolge die
  Bremsen greifen, welche Muster als Bedrohung gelten, welche Aktionen erlaubt sind.

Die Naht hat genau **vier feine Stellen** — dort reicht die Domäne dem Kern etwas an:

| Stelle        | Kern liefert                         | Domäne liefert                       |
| ------------- | ------------------------------------ | ------------------------------------ |
| Routing       | `createRouter` (das Verfahren)       | die Bremsen, in ihrer Reihenfolge    |
| Guardrail     | `createGuardrail` (die Regex-Engine) | die Muster und ihre Gewichte         |
| Aktions-Queue | `createActionQueue` (die Mechanik)   | Whitelist und Validierer             |
| State         | Kernfelder + `buildState`            | die eigenen Felder samt Reducer-Wahl |

**Prüfkriterium:** eine zweite Domäne ändert **null Zeilen** unter `src/kernel/`.

```bash
grep -rn "beispiel" src/kernel/    # muss leer bleiben
```

Ohne dieses Kriterium wandert Domänenwissen still in den Kern — und die dritte Domäne kostet
dann so viel wie die erste.

## 2. Topologie: Hub-and-Spoke

```
START → entry(guardrail) → hub(orchestrator) ⇄ {spokes}
                              ⛔ interruptBefore: human_approval
                              → (nur bei true) terminal → END
```

Warum ein Hub statt einer Kette: die Routing-Intelligenz sitzt an **einem** Punkt, nicht in
den Kanten. Ein einziger Punkt heißt: prüfbar. Jeder produzierende Knoten kehrt zum Hub
zurück, und der Hub entscheidet neu.

`human_approval` ist ein **leerer Knoten**. Seine einzige Funktion: die Stelle markieren, an
der der Graph anhält.

## 3. Dreischichtiges Routing

1. **Deterministische Bremsen** — lösen den Grossteil der Fälle mit **null LLM-Kosten**.
   Ihre Reihenfolge ist die Aussage der Domäne.
2. **LLM mit strukturierter Ausgabe** — nur, wenn keine Bremse greift.
3. **Post-LLM-Validierung** — ein Agent außerhalb des Enums ⇒ sicheres Override auf `END`.

Die HITL-Entscheidung wird **niemals** dem LLM überlassen: sie liegt in Bremse 2, vor jeder
Datenlogik.

## 4. Bekannte Grenzen

Diese Liste ist absichtlich sichtbar. Eine verschwiegene Grenze wird zu einem Ausfall.

- **Das Zustandslog wächst unbegrenzt.** Keine Verdichtung, keine Rotation. Für ein Gerüst mit
  einem Mandanten tragbar; für Dauerbetrieb nicht.
- **Kein Sperrmechanismus zwischen Prozessen.** Zwei gleichzeitig schreibende Prozesse können
  sich überlappen. Der Ablauf hier ist seriell; mehr wird nicht behauptet.
- **Die Token-Schätzung im Mock-Modus ist grob.** Sie taugt für Trend und Ausreißer, nicht für
  eine Abrechnung.
- **Der Event-Puffer wird nur am Ende von `startWorkflow` aufgeräumt.** Nach
  `resolveApproval` erzeugte Events können erneut gepuffert werden. Kleines Leck.
- **Der Action-Worker simuliert.** Der echte externe Aufruf steht als Kommentar in
  `action/queue.js`. Wer ihn einsetzt, erbt die Idempotenz — und muss die Ausgabengrenze prüfen.
- **Zwei Stellen sind zu groß geraten.** `createActionQueue` in `src/kernel/action/queue.js`
  umfasst 101 Zeilen, und `src/kernel/agent/checkpointer.js` verschachtelt an einer Stelle
  fünf Ebenen tief. Beide sind als ESLint-Warnung sichtbar und bleiben es, bis der
  Lint-Rollout sie einzeln aufgreift — nicht nebenbei bei einer anderen Änderung.
- **Zwei mittlere Schwachstellen bleiben offen.** Der Abhängigkeitsrückstand ist eingelöst:
  seit Etappe 0c läuft `@langchain/langgraph` 1.4.14 und `npm audit` meldet `high: 0`
  (ADR-0003). Übrig bleiben zwei **mittlere** in `qs`, das `express` 4.x mitbringt. Sie
  verschwinden erst mit `express` 5 — ein Major-Sprung, der mit ADR-0003 nichts zu tun hat und
  deshalb eine eigene Entscheidung braucht, nicht ein Nebenbei. Gemessen am 2026-09-09.

## 5. Beobachtbarkeit

Zwei getrennte Wege, absichtlich:

- **Event-Bus** — zeigt an und vergisst. Für die Live-Anzeige (SSE).
- **Trace** — bleibt und ist nachprüfbar. Je Lauf eine JSONL-Datei. **Die Messung liest den
  Trace, nicht den Bus.** Wer eine Zahl anzweifelt, kann die Zeile aufschlagen.

Der Trace trägt **keinen Volltext**, nur Längen. Er belegt Routing und Richtlinien, nicht
Inhalte.

Eine Knotenzeile trägt das **Delta** — was der Knoten geschrieben hat —, nicht den
akkumulierten Zustand. Bei einem `sum`-Reducer steht in jeder Zeile der Zuwachs; der Stand ist
die Summe der Zeilen.

## 6. Entscheidungen, die noch offen sind

| Frage                                                          | Blockiert heute                 | Fällt in                   |
| -------------------------------------------------------------- | ------------------------------- | -------------------------- |
| **Welche Vertikale?** Ontologie, ACL-Modell, erster Connector  | die Ebenen ①–③ mit echten Daten | `docs/roadmap.md` Etappe 3 |
| K5 (`clone → install → demo` ohne Infrastruktur) nach Postgres | nichts                          | Etappe 3, per ADR          |
| Vollständige TypeScript-Migration                              | nichts                          | offen                      |
| Darf ein zweiter Kanal (MCP) `approve` anbieten?               | nichts                          | Etappe 6, per ADR          |

Fällt eine dieser Fragen, wandert sie als ADR nach `DECISIONS.md` und wird hier auf einen
Verweis gekürzt. Eine Frage, die an zwei Orten offen steht, wird zweimal beantwortet.

## 7. Zielstruktur beim Wachsen

Seit dem Umbau am 2026-09-09 tragen die Verzeichnisse unter `src/kernel/` die Namen der sechs
Ebenen (ADR-0002). Dieser Baum ist der **Vertrag**; `docs/roadmap.md` sagt nur, in welcher
**Reihenfolge** er gefüllt wird. `NEU` steht für einen Ort, der heute leer ist — die Ebenen
①–③ existieren noch nicht.

```
src/
  kernel/                    MECHANIK · kennt keine Domäne
    connectors/              ① NEU · Ingest-Rahmen; die Quelle selbst liegt in der Domäne
    context/                 ② NEU · Envelope, Chunking, Embedding, Store-Port
    retrieval/               ③ NEU · ACL-Filter, hybride Suche, Rerank
    agent/                   ④ build · routing · runner · schema · reducers · checkpointer
    action/                  ⑤ queue
    governance/              ⑥ guardrail · auth · rateLimiter · trace · eventBus · costTracker

    llm/                     Infrastruktur · adapter · mock — keine der sechs Ebenen
    persistence/store.js     Infrastruktur · von agent/ UND action/ benutzt
    config/env.js            Infrastruktur
    registry.js              Infrastruktur

  domains/<domäne>/          BEDEUTUNG · der Kern kennt diese Dateien nicht
    domain.js                die Naht: stateFields, brakes, guardrailRules, nodes
    agents/*.js · prompts.js · actions.js
    ontology.js              NEU · Entitäten, Relationen, Aktionstypen
    acl.js                   NEU · Berechtigungsmodell der Quelle → Principal
    connectors/<quelle>.js   NEU

  adapters/                  AUSSENKONTAKT
    http/server.js
    mcp/server.js            NEU, später · bietet KEIN approve an
```

**Zwei Zuordnungen, hergeleitet und nicht geraten.** `checkpointer.js` liegt in `agent/`, weil
Durable Execution zur Agent Runtime gehört und nicht zur Infrastruktur. `trace`, `eventBus`
und `costTracker` liegen in `governance/`, weil Beobachtbarkeit dorthin gehört.
`persistence/store.js` bleibt außerhalb der Ebenen: es wird von zweien benutzt und ist selbst
keine.

Die Ebenenliste ist damit **nicht vollständig** — `llm/`, `persistence/`, `config/` und
`registry.js` sind Infrastruktur. Wer den Baum liest, muss das wissen; der Prüfbefehl weiß es:

```bash
ls src/kernel | grep -vxE 'connectors|context|retrieval|agent|action|governance|llm|persistence|config|registry\.js'
# erwartet: keine Ausgabe
```

Er prüft beide Richtungen — dass keine alte Struktur zurückkehrt **und** dass niemand später
ein siebtes Verzeichnis daneben erfindet.
