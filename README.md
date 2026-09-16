# agentic-brain

Ein **permission-aware Enterprise Context Layer** mit agentischer Prozessautomatisierung:
Wissen wird samt seinen Berechtigungen aufgenommen, berechtigungstreu abgefragt und in
**menschlich genehmigte** Aktionen überführt.

Der Anspruch: nicht nur die Arbeit zählt als Beweis, sondern **wie sie gemessen wurde**.

> **Stand 2026-09-11.** Alle sechs Ebenen stehen und sind gemessen — `npm test` 211 bestanden
> (6 übersprungen ohne Datenbank), Schicht A 28/28 und 32/32. **Chunk-Speicher und Embedding
> sind je ein Port mit zwei Adaptern** (`memory`/`postgres`, `hash`/`voyage`), und dieselbe
> Messung liefert dieselben Zahlen.
> Die Vertikale ist entschieden (ADR-0010): **Besprechungsnotiz → Aktionspunkt → Ticket**.
> Zwei Zahlen tragen die zentrale Zusage: **3.13 Unauthorized-Retrieval-Rate = 0 %** und
> **3.14 Latenz des Berechtigungsentzugs = 0 %**, beide belegt durch Mutationsproben.
> Offen: **der Voyage-Lauf selbst** — der Adapter ist gebaut und gegen ein Testdouble geprüft,
> aber ohne Schlüssel nie gegen den echten Dienst gelaufen —, dazu echte Identitäten.
> Die Entscheidungen stehen in
> [`DECISIONS.md`](DECISIONS.md), die Reihenfolge der Etappen in
> [`docs/roadmap.md`](docs/roadmap.md), der Umfang in [`PRODUCT.md`](PRODUCT.md).

---

## In drei Befehlen

```bash
npm install
npm run demo     # der komplette Ablauf auf der Konsole, ohne HTTP, ohne API-Schlüssel
npm test         # Mock-Modus, Abdeckungsgrenze 80 %
npm run evals    # Schicht A: Richtlinien, Routing und Autorisierung messen
```

Ohne `ANTHROPIC_API_KEY` läuft alles im **Mock-Modus**: Ende zu Ende, kostenlos,
deterministisch. Das ist kein Notbehelf, sondern das Fundament — Tests und Messungen
bauen darauf. **Und ohne jede Infrastruktur:** kein Docker, keine Datenbank. Das ist
Erfolgskriterium K5, und es gilt auch nach dem Postgres-Adapter (ADR-0013).

Die Vertikale in einem Befehl — Connector, Berechtigungsfilter, Entzug, HITL, Ticket:

```bash
npm run demo:besprechung
```

Der zweite Store-Adapter wird **ausdrücklich verlangt**, nie geraten:

```bash
docker compose up -d          # pgvector auf localhost:55433, ohne Volume
DATABASE_URL=postgresql://agentic:agentic@localhost:55433/agentic npm run evals:postgres
```

Er muss **dieselben Zahlen** liefern wie der Lauf ohne ihn. Tut er es nicht, ist das ein
Defekt mit genau einer möglichen Ursache — dem Adapter.

Ebenso das Embedding: `hash` ist die Voreinstellung und trägt Mock-Modus, CI und K5 allein.
Ein echtes Modell tritt daneben und wird ausdrücklich verlangt (ADR-0015):

```bash
VOYAGE_API_KEY=… EMBEDDING_ADAPTER=voyage npm run evals -- besprechung
```

**Dieser Lauf hat noch nicht stattgefunden.** Ohne Schlüssel ist der Voyage-Adapter gegen ein
Testdouble geprüft, nicht gegen Voyage — ein Testdouble beweist die eigene Logik, nicht die
fremde. Was der Befehl zeigen soll, wenn er läuft: **3.13 bleibt 0 %.** Bewegt er sie, hing
eine Berechtigung an der Sortierung, und das wäre der Befund.

Ein zweiter Synchronisationszyklus über unveränderte Dokumente kostet dabei **null**
Einbettungen — die Momentaufnahme bleibt trotzdem vollständig, weil ein Vektor keine
Berechtigung trägt (ADR-0016).

---

## Was der Ablauf zusagt

```
START → guardrail → orchestrator ⇄ {bearbeiter, pruefer, ablage}
                         ⛔ HÄLT AN vor human_approval
                         → (NUR bei ausdrücklicher Freigabe) zusteller → END
```

Vier Zusagen, jede an einen Prüfbefehl gebunden:

| Zusage                                            | Wo sie im Code steht                                                       | Wo sie geprüft wird                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| Ohne menschliche Freigabe wirkt nichts nach außen | `src/kernel/agent/build.js` (Kante) · `src/adapters/http/server.js` (Rand) | `tests/workflow.test.js` · `tests/httpAdapter.test.js` |
| Kein Agent ruft je selbst eine externe API        | `src/kernel/action/queue.js`                                               | `tests/actionQueue.test.js`                            |
| Ein Neustart verliert keine wartende Genehmigung  | `src/kernel/agent/checkpointer.js` · `src/kernel/persistence/store.js`     | `tests/integration/persistence.test.js`                |
| Routing ist deterministisch und terminiert        | `src/kernel/agent/routing.js`                                              | `npm run evals`                                        |

**Fail-closed heißt wörtlich fail-closed:** alles, was nicht exakt `true` ist — auch
`null` — endet bei `END`. Eine Ablehnung stellt nicht zu und reiht nichts ein.

**Das gilt auch am Rand:** der HTTP-Adapter wandelt nichts um. Nur ein JSON-Boolean `true` ist
eine Genehmigung; jeder andere Wert wird mit **400** abgelehnt. Bis zum 2026-09-14 galt das
nicht — `{"approved": "false"}` genehmigte (`Boolean("false")` ist `true`).

---

## Aufbau

```
src/
  kernel/      MECHANIK. Kennt keine einzelne Domäne. Prüfe das mit:
               grep -rn "beispiel" src/kernel/   → muss leer bleiben
  domains/
    beispiel/  BEDEUTUNG. Agenten, Bremsenreihenfolge, Guardrail-Muster,
               erlaubte Aktionen. Referenzdomäne: sie bleibt bestehen, die echte
               Domäne tritt daneben (ADR-0004).
  adapters/    AUSSENKONTAKT. Heute HTTP; ein zweiter Kanal käme daneben.
  bin/         Einstiegspunkte (demo, serve).

evals/         Das Messinstrument. Domänenfrei; je Domäne ein Adapter.
tests/         node:test, keine Testbibliothek.
.gehirn/       Projektgedächtnis zwischen Sitzungen (siehe CLAUDE.md).
```

Die Trennlinie zwischen `kernel/` und `domains/` ist die teuerste Entscheidung dieses
Repos. Sie hat ein Prüfkriterium: **eine zweite Domäne ändert null Zeilen unter
`src/kernel/`.** Ohne dieses Kriterium wandert Domänenwissen still in den Kern, und die
dritte Domäne kostet dann so viel wie die erste.

---

## Eine eigene Domäne bauen

1. `cp -r src/domains/beispiel src/domains/<deine-domäne>`
2. In `domain.js`: State-Felder, Bremsenreihenfolge, Guardrail-Muster, Knoten.
3. In `actions.js`: die Whitelist — was dein System nach außen tun darf.
4. Adapter für die Messung: `cp -r evals/domains/beispiel evals/domains/<deine-domäne>`,
   Eintrag in `evals/domains/index.js`.
5. `npm test && npm run evals`

Der ausführliche Weg steht in [`EXTEND.md`](EXTEND.md).

---

## Wo was steht

| Frage                                                 | Datei                         |
| ----------------------------------------------------- | ----------------------------- |
| Umfang, Nicht-Ziele, Erfolgskriterien                 | `PRODUCT.md`                  |
| Architektur, Trade-offs, bekannte Grenzen             | `ARCHITECTURE.md`             |
| „Warum wurde so entschieden"                          | `DECISIONS.md`                |
| Metrikdefinitionen, Baseline, Messregeln              | `EVALS.md`                    |
| Wachstumsreihenfolge                                  | `EXTEND.md`                   |
| Etappen, ihre Tore, was wann gebraucht wird           | `docs/roadmap.md`             |
| Knotenreihenfolge, HITL-Mechanik                      | `docs/workflow.md`            |
| Bedrohungsmodell, die vier MOAT-Schichten             | `docs/security-model.md`      |
| Arbeitsweise mit einem KI-Agenten, Gedächtnisrhythmus | `docs/development-process.md` |
| Grenzen des Messinstruments                           | `evals/README.md`             |
| Anweisungen für den Agenten, Autoritätskette          | `CLAUDE.md`                   |

---

## Die Regel, an der alles hängt

> **Dass eine Datei existiert, ist kein Beweis; ein bestandener Prüfbefehl ist einer.**

Trag keine Zahl in ein Dokument, die nicht aus einem datierten Lauf in `evals/reports/`
stammt. Was nicht gemessen wurde, trägt die Markierung „nicht gemessen" — nicht eine
plausibel aussehende Zahl.
