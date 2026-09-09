# agentic-brain

Ein **permission-aware Enterprise Context Layer** mit agentischer Prozessautomatisierung:
Wissen wird samt seinen Berechtigungen aufgenommen, berechtigungstreu abgefragt und in
**menschlich genehmigte** Aktionen überführt.

Der Anspruch: nicht nur die Arbeit zählt als Beweis, sondern **wie sie gemessen wurde**.

> **Stand 2026-09-09.** Agent Runtime und der Kern der Governance stehen und sind gemessen —
> `npm test` 98/98, Schicht A 20/20. Kontext, Retrieval und Connectoren sind **leer**.
> Die Identität steht als ADR-0001 in [`DECISIONS.md`](DECISIONS.md), die Reihenfolge der
> Etappen in [`docs/roadmap.md`](docs/roadmap.md). `PRODUCT.md` und `ARCHITECTURE.md` tragen
> noch Vorlagenkästen — sie halten die Struktur, nicht überall schon die Antworten.

---

## In drei Befehlen

```bash
npm install
npm run demo     # der komplette Ablauf auf der Konsole, ohne HTTP, ohne API-Schlüssel
npm test         # 98 Tests, Mock-Modus, Abdeckungsgrenze 80 %
npm run evals    # Schicht A: Richtlinien und Routing messen, deterministisch
```

Ohne `ANTHROPIC_API_KEY` läuft alles im **Mock-Modus**: Ende zu Ende, kostenlos,
deterministisch. Das ist kein Notbehelf, sondern das Fundament — Tests und Messungen
bauen darauf.

---

## Was der Ablauf zusagt

```
START → guardrail → orchestrator ⇄ {bearbeiter, ablage}
                         ⛔ HÄLT AN vor human_approval
                         → (NUR bei ausdrücklicher Freigabe) zusteller → END
```

Vier Zusagen, jede an einen Prüfbefehl gebunden:

| Zusage                                            | Wo sie im Code steht                            | Wo sie geprüft wird                     |
| ------------------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| Ohne menschliche Freigabe wirkt nichts nach außen | `src/kernel/graph/build.js` (fail-closed-Kante) | `tests/workflow.test.js`                |
| Kein Agent ruft je selbst eine externe API        | `src/kernel/security/actionQueue.js`            | `tests/actionQueue.test.js`             |
| Ein Neustart verliert keine wartende Genehmigung  | `src/kernel/persistence/`                       | `tests/integration/persistence.test.js` |
| Routing ist deterministisch und terminiert        | `src/kernel/graph/routing.js`                   | `npm run evals`                         |

**Fail-closed heißt wörtlich fail-closed:** alles, was nicht exakt `true` ist — auch
`null` — endet bei `END`. Eine Ablehnung stellt nicht zu und reiht nichts ein.

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
