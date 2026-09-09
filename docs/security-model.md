# Sicherheitsmodell

Vier Schichten („MOAT"), in der Reihenfolge, in der ein Request sie durchläuft. Jede Schicht
hat eine Aufgabe und **eine bekannte Grenze**. Die Grenzen stehen hier, weil eine
verschwiegene Grenze zu einem Ausfall wird.

---

## Bedrohungsmodell

Wovor das System schützt:

1. **Prompt-Injection über die Nutzereingabe.** Jemand schreibt Anweisungen in die Aufgabe.
2. **Ein gekaperter oder halluzinierender Agent.** Er versucht, nach außen zu wirken.
3. **Unbegrenzter Verbrauch.** Eine Schleife oder ein Kontext, der über die Runden wächst.
4. **Wirkung ohne menschliche Freigabe.** Der teuerste Fall: etwas passiert in der Welt,
   das niemand genehmigt hat.

Wovor es **nicht** schützt (bewusst):

- Ein böswilliger Betreiber mit Dateisystemzugriff.
- Ein kompromittiertes Modell beim Anbieter.
- Netzwerkangriffe unterhalb der Anwendungsschicht.
- Mehrere gleichzeitig schreibende Prozesse auf demselben Zustandsverzeichnis.

---

## Schicht 1 — Guardrail

`src/kernel/governance/guardrail.js` (Mechanik) · `src/domains/<domäne>/domain.js` (Muster)

**KEIN LLM.** Die Sicherheitsprüfung selbst muss gegen Prompt-Injection immun sein. Fragst du
ein Modell „ist dieser Text gefährlich?", kann die angreifende Person auch dieses Modell
täuschen.

Gewichtete Regex-Bewertung, drei Bänder:

| Score | Wirkung                                                         | Beispiel                       |
| ----- | --------------------------------------------------------------- | ------------------------------ |
| ≥ 3   | **blockiert** — der Lauf endet nach dem Eingang                 | `ignore previous instructions` |
| 2     | **sanitisiert** — die Stelle wird ersetzt, der Lauf geht weiter | `pretend to be a …`            |
| 1     | **durchgelassen** — der Score wird trotzdem gemeldet            | `malware`, `sql injection`     |

Das dritte Band ist **Absicht**. Angriffsvokabular kann ein legitimes Thema sein. Wer es
blockiert, kauft Trefferquote mit Falschpositiven — Metrik 3.5 misst beide Seiten.

Auch unterhalb der Schwelle wird der **gemessene** Score gemeldet, nicht pauschal 0. Sonst
sähe ein Text mit Score 2 aus wie ein harmloser mit Score 0, und jede Falschpositiv-Analyse
wäre blind.

> **Die Falle beim Einrichten:** die Blockierschwelle auf die Summe aller Gewichte setzen.
> Dann blockiert der Guardrail nur, wenn **alle** Muster zugleich greifen — eine einzelne
> ernsthafte Injection kommt durch, und der Test darüber bleibt trotzdem grün.
> `tests/guardrail.test.js` hält genau diesen Fall fest.

**Bekannte Grenze:** Regex erkennt nur bekannte Formen. Eine neue Formulierung kommt durch,
bis jemand ein Muster ergänzt. Und: sanitisiert wird nur die Nutzereingabe. **Externe Daten
sind ebenso feindlich** — wer einen Scraper anschließt, braucht dort dieselbe Grenze.

---

## Schicht 2 — Budget-Kill-Switch

`src/kernel/governance/costTracker.js`

Ist das Budget überschritten, endet der Lauf **im Guardrail** — vor dem ersten LLM-Aufruf.
Nicht danach, nicht „beim nächsten Mal".

Die Preistabelle kennt das Modell **pro Aufruf**, nicht global. Ein Rollen-Override
(`MODEL_ORCHESTRATOR=claude-haiku-4-5`) muss auch beim Preis ankommen, sonst zählt die
Kostenmetrik einen billigen Aufruf zum teuren Preis und die Einsparung ist unsichtbar.

**Bekannte Grenze:** die Token-Schätzung im Mock-Modus ist grob (Zeichen ÷ 4). Für Trend und
Ausreißer, nicht für eine Abrechnung.

---

## Schicht 3 — Auth und Rate-Limit

`src/kernel/governance/auth.js` · `src/kernel/governance/rateLimiter.js`

- Der API-Schlüssel wird **geprüft, nicht bereinigt**. Eine Bereinigung vergrößert den
  akzeptierten Schlüsselraum still: aus `d!e!v!-!l!o!c!a!l!-!k!e!y` würde sonst ein gültiger
  Schlüssel. **Fail-closed heißt ablehnen, nicht zurechtbiegen.**
- Der Vergleich läuft laufzeitkonstant.
- Unbekannter Schlüssel → 401. **Kein** automatisches Anlegen eines Mandanten.
- Drei Limiter: global, Workflow-Start, Genehmigung.
- Dieselbe Lehre gilt an zwei weiteren Stellen: eine ungültige `run_id` (Trace) und ein
  ungültiger Log-Name (Speicher) werden **abgelehnt**. Ein bereinigter Pfad ist eine
  Einladung zum Verzeichniswechsel.

**Bekannte Grenze:** der SSE-Endpunkt liegt **vor** der Auth — `EventSource` kann keine
Header senden. Der Schutz ist die nicht erratbare `threadId` (UUID). Wer sie kennt, sieht den
Stream.

---

## Schicht 4 — Aktions-Isolation

`src/kernel/action/queue.js` (Mechanik) · `src/domains/<domäne>/actions.js` (Whitelist)

```
Agent → ActionQueue (SCHREIBT nur) → Worker (liest + VALIDIERT + führt aus)
```

**Agenten rufen niemals direkt eine externe API auf.** Das ist das Kernprinzip.

Zwei Tore:

1. **`enqueueAction`** — steht der Typ nicht auf der Whitelist, wird schon **vor** dem
   Schreiben abgelehnt.
2. **Der Worker** — prüft das Payload gegen Schema und Länge; nach drei Versuchen `FAILED`.

Tor 1 kommt **vor** der Dedup-Prüfung: ein nicht erlaubter Typ muss auch dann auffliegen,
wenn er einen bereits bekannten Schlüssel mitbringt.

**Idempotenz.** Jede Aktion trägt einen Schlüssel — mitgegeben oder deterministisch aus
`(threadId, actionType, payload)` abgeleitet. Die Serialisierung ist stabil: dieselben Felder
in anderer Reihenfolge ergeben denselben Schlüssel. Ein bekannter Schlüssel wird nicht erneut
geschrieben. Das überlebt einen Neustart.

Solange der Worker simuliert, ist eine doppelte Zeile harmlos. Mit einem echten Aufruf wäre
sie eine zweite Wirkung in der Welt — deshalb steht die Regel **hier und jetzt**, nicht
später.

**Bekannte Grenze:** der Worker simuliert. Der echte Aufruf steht als Kommentar. Wer ihn
einsetzt, braucht ein hartes Timeout.

---

## Die Zusage darüber: Human-in-the-Loop

Alle vier Schichten zusammen sind wertlos, wenn der Graph am Genehmigungstor vorbeikommt.
Deshalb liegt die Zusage **im Kern**, nicht in einer Domäne:

- `humanApproval` ist ein **Kernfeld**. Eine Domäne darf es nicht überschreiben —
  `buildState` wirft.
- Die Kante `human_approval → terminal` prüft auf **exakt `true`**.
- `interruptBefore` hält den Graphen an, **bevor** er den Knoten betritt.

Geprüft in `tests/workflow.test.js` und `tests/integration/persistence.test.js` — der zweite
über eine echte Prozessgrenze, mit PID-Vergleich.

---

## Geheimnisse

- `.env` und `.env.*` (außer `.env.example`) sind in `.gitignore`.
- Kein Schlüssel gehört in den Code, in einen Log oder in einen Trace.
- `req.clientId` trägt den **gesendeten** Schlüssel, nie einen zurechtgebogenen — sonst
  wichen Rate-Limit und Audit von der tatsächlichen Eingabe ab.
- Vor jedem Veröffentlichen: `git status` und ein Blick, ob eine Zustands- oder Trace-Datei
  mitkommt.
