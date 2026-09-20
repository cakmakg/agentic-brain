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

Die Naht hat genau **sechs feine Stellen** — dort reicht die Domäne dem Kern etwas an. Die
ersten vier standen mit dem Gerüst, die letzten beiden kamen mit den Ebenen ② und ①:

| Stelle         | Kern liefert                         | Domäne liefert                        |
| -------------- | ------------------------------------ | ------------------------------------- |
| Routing        | `createRouter` (das Verfahren)       | die Bremsen, in ihrer Reihenfolge     |
| Guardrail      | `createGuardrail` (die Regex-Engine) | die Muster und ihre Gewichte          |
| Aktions-Queue  | `createActionQueue` (die Mechanik)   | Whitelist und Validierer              |
| State          | Kernfelder + `buildState`            | die eigenen Felder samt Reducer-Wahl  |
| Chunk-Speicher | `createStore` (Port) + `baueStore`   | — reine Mechanik, die Domäne schweigt |
| Connector      | `createConnector` (Port)             | das Berechtigungsmodell der Quelle    |

Die letzte ist die teuerste: ein Connector ist zu einem Zehntel Holen und zu neun Zehnteln
Berechtigungserfassung — und die neun liegen in `domains/<domäne>/acl.js`, nicht im Kern.

**Prüfkriterium:** eine zweite Domäne ändert **null Zeilen** unter `src/kernel/`. Seit dem
2026-09-10 ist das kein Selbstversprechen mehr, sondern an `besprechung` geprüft.

```bash
grep -rn "beispiel" src/kernel/       # muss leer bleiben
grep -rn "besprechung" src/kernel/    # muss leer bleiben
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

- **Der Agent liest nur die Notiz, die die Aufgabe NENNT.** Seit T1 (ADR-0019) liest er
  berechtigungstreu — aber gezielt: es gibt keinen Knoten, der von sich aus recherchiert. Eine
  Frage, die kein `notiz:<id>` enthält, erreicht den Speicher nicht. Der `recherche`-Knoten ist
  an einen Auslöser gebunden (`docs/roadmap.md` §5, Etappe 6).
- **Über HTTP ist die Vertikale mit Naht nicht erreichbar, und der Rand löst keine Identität
  auf.** `adapters/http/server.js` und `bin/serve.js` führen an sechs Stellen fest `beispiel` —
  eine Domäne ohne Connector, die nichts liest (ADR-0004). Der aufgelöste Principal lebt in den
  Kanälen, die ihn verdrahten: im Terminaldurchlauf und im Eval-Harness (ADR-0018, ADR-0019
  Nachtrag 2). Gefährlich ist die Lücke nicht — ohne Principal antwortet der Leseweg leer und
  mit Grund —, aber sie ist eine Lücke in der Reichweite. Den Rand die Domäne **wählen** zu
  lassen ist die saubere Fassung und braucht ihre eigene ADR.
- **Es gibt keinen echten Identitätsanbieter.** Aufgelöst wird gegen ein Verzeichnis aus
  Fixtures; ein OIDC-Adapter kommt, wenn es etwas gibt, wogegen er laufen kann (Etappe 7 und
  11). Bis dahin gilt: die Auflösung ist gemessen, der Anbieter ist keiner.
- **Der Beleg eines Laufs bleibt im Arbeitsspeicher.** `domains/besprechung/leseweg.js` hält je
  `threadId`, welche Chunks der Agent bekam — dieselbe unbegrenzt wachsende Karte wie
  `getEntwurf` und `getArtifact`. Für ein Gerüst tragbar, für Dauerbetrieb nicht.
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

| Frage                                                   | Blockiert heute | Fällt in                    |
| ------------------------------------------------------- | --------------- | --------------------------- |
| Bettet Voyage 3.13 anders? — ungemessen, kein Schlüssel | nichts          | sobald ein Schlüssel da ist |
| `express` 4 → 5 wegen der zwei mittleren Befunde        | nichts          | offen, per eigener ADR      |
| Vollständige TypeScript-Migration                       | nichts          | offen                       |
| Darf ein zweiter Kanal (MCP) `approve` anbieten?        | nichts          | Etappe 6, per ADR           |

Vier Fragen sind gefallen und stehen deshalb nicht mehr hier: **die Vertikale** (ADR-0010),
**K5 nach dem Postgres-Adapter** (ADR-0013, K5 bleibt grün), **echtes Embedding statt Hash**
(ADR-0015 — ein Port mit zwei Adaptern statt eines Tauschs) und **Delta-Sync statt
Momentaufnahme** (ADR-0016 — die Momentaufnahme bleibt, der Einbettungsaufruf wird
zwischengespeichert).

Was von der Embedding-Frage übrig ist, steht oben und ist bewusst schmal formuliert: 3.13 wird
sich nach ADR-0015 **nicht** bewegen, weil der ACL-Filter vor der Bewertung läuft — aber
gemessen ist das nicht, solange kein Schlüssel da ist. Eine Vorhersage ist kein Lauf.

Fällt eine dieser Fragen, wandert sie als ADR nach `DECISIONS.md` und wird hier auf einen
Verweis gekürzt. Eine Frage, die an zwei Orten offen steht, wird zweimal beantwortet.

## 7. Zielstruktur beim Wachsen

Seit dem Umbau am 2026-09-09 tragen die Verzeichnisse unter `src/kernel/` die Namen der sechs
Ebenen (ADR-0002). Dieser Baum ist der **Vertrag**; `docs/roadmap.md` sagt nur, in welcher
**Reihenfolge** er gefüllt wird. `NEU` steht für einen Ort, der heute leer ist. Seit dem
2026-09-10 sind **alle sechs Ebenen belegt** und der Speicher hat **zwei Adapter**
(Etappe 3b und 3c); offen ist nur noch der zweite Außenkanal.

```
src/
  kernel/                    MECHANIK · kennt keine Domäne
    connectors/index.js      ① Port — was eine Quelle können muss (ADR-0011)
      synchronisation.js         ein Zyklus: Momentaufnahme → Chunks → Quelle ersetzen
    context/                 ② envelope.js · aufbau.js (wählt BEIDE Adapterpaare)
      ingest/pipeline.js         Chunking und Envelope-Vererbung (ADR-0009)
      store/index.js             Port — kennt seine Adapter NICHT (ADR-0006)
      store/memory.js            Adapter · trägt Mock-Modus, CI und K5 allein
      store/postgres.js          Adapter · pgvector, Transaktion, opt-in (ADR-0013)
      embedding/index.js         Port — `dokument` und `anfrage` (ADR-0015)
      embedding/hash.js          Adapter · deterministisch, netzfrei, Voreinstellung
      embedding/voyage.js        Adapter · echtes Modell, opt-in, kein npm-Paket
      embedding/zwischenspeicher.js  liegt VOR jedem Adapter · spart Aufrufe (ADR-0016)
    retrieval/               ③ filter.js · reine Logik, kein IO (ADR-0008, ADR-0012)
      suche.js                   hybride Suche — beide Pfade gefiltert
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
    ontology.js              Entitäten, Relationen, Aktionstypen (ab `besprechung`)
    vertrag.js               der Ausgabevertrag als reine Funktion — drei Leser, eine Quelle
    acl.js                   Berechtigungsmodell der Quelle → Envelope des Kerns
    connectors/<quelle>.js   der Connector dieser Quelle

  adapters/                  AUSSENKONTAKT
    http/server.js
    mcp/server.js            NEU, später · bietet KEIN approve an
```

**Der Port hat seit dem 2026-09-10 zwei Adapter, und erst das beweist ihn.** `store/index.js`
sagte es selbst: ein Adapter beweist keine Grenze. `memory` trägt Mock-Modus, CI und K5
(ADR-0013); `postgres` trägt den Produktionspfad. Der Port ist dabei die **asynchrone
Grenze** — jede Methode gibt ein Promise zurück, auch die des `memory`-Adapters. Beide
Adapter filtern mit demselben Regelwerk in zwei Kompilaten (ADR-0014), und dass sie dasselbe
bedeuten, ist gemessen und nicht behauptet: dieselbe Eval-Suite gegen beide, plus ein
Differenztest.

**Zwei Ports, dieselbe Bauart — und der zweite ist bewusst gleich gebaut wie der erste.**
Seit dem 2026-09-10 wählt `aufbau.js` nicht mehr nur den Store, sondern auch das Embedding
(ADR-0015). Beide Ports haben denselben Zuschnitt: Voreinstellung netzfrei und kostenlos,
zweiter Adapter opt-in über eine Umgebungsvariable, Import erst beim Bauen. Der
Embedding-Port kennt dabei **zwei Arten** — `dokument` und `anfrage` —, weil ein echtes
Retrieval-Modell die Frage anders einbettet als den Text, den sie finden soll. Der
Hash-Adapter ignoriert die Unterscheidung; der Port kennt sie trotzdem von Anfang an, sonst
hätte ihre Einführung später jede Aufrufstelle angefasst.

> Die zwei Ports berühren sich an genau einer Zahl: der Breite. `vector(n)` im
> Postgres-Schema muss zu `embedding.dimensionen` passen, und der Postgres-Adapter **prüft**
> das beim Start statt es zu hoffen. Ein Adapterwechsel ohne neuen Ingest ist damit ein
> lesbarer Fehler und kein stiller.

**Ebene ① ist die dünnste Datei mit der größten Wirkung.** Ein Connector ist zu einem Zehntel
Holen und zu neun Zehnteln Berechtigungserfassung — und die liegt in der **Domäne**
(`acl.js`), nicht hier. Der Kern beschreibt nur die Form: eine vollständige Momentaufnahme mit
bereits erfasster Envelope, die eine Quelle **atomar** ersetzt. Warum kein Delta-Sync:
ADR-0011 — und warum auch der Preis eines echten Embeddings daran nichts ändert: ADR-0016.
Teuer ist nicht der Ersatz, sondern der Einbettungsaufruf, und der wird zwischengespeichert.
Der Unterschied, an dem das hängt: ein **Vektor** trägt keine Berechtigung, ein **Chunk**
trägt eine. Deshalb darf man Vektoren wiederverwenden und Chunks nicht.

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
