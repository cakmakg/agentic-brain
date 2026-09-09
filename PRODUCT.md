# PRODUCT

> **VORLAGE.** Die Struktur steht, die Antworten fehlen. Füll sie beim Bauen aus und
> lösch diesen Kasten, sobald §1 bis §4 echte Inhalte tragen.
>
> Regel für dieses Dokument: **keine Zahl ohne datierten Lauf in `evals/reports/`.**
> Was nicht gemessen ist, steht hier als „nicht gemessen" — nicht als plausible Schätzung.

## 1. Was dieses Projekt ist

<!-- Ein Absatz. Was ist es, für wen, in welchem Zustand. Kein Marketing. -->

## 2. Das Problem

<!-- Welchen konkreten Fehler löst es? Woran erkennt jemand, dass er dieses Problem hat? -->

## 3. Umfang

### 3.1 Ziele

<!-- Was das System können MUSS. Jedes Ziel prüfbar formulieren:
     nicht "gute Qualität", sondern "X ist nach Y messbar erfüllt". -->

### 3.2 Nicht-Ziele

<!-- Wichtiger als die Ziele. Was das System AUSDRÜCKLICH NICHT tut.
     Ein Nicht-Ziel hier gespart kostet später eine Umarbeitung. -->

## 4. Erfolgskriterien

Jedes Kriterium braucht **einen Befehl**, der es beantwortet. Ein Kriterium ohne Befehl ist
eine Meinung.

| # | Kriterium | Prüfbefehl | Stand |
| --- | --- | --- | --- |
| K1 | Der Ablauf hält vor jeder Außenwirkung beim Menschen an | `npm test` (`tests/workflow.test.js`) | 🟢 |
| K2 | Eine Ablehnung stellt nichts zu und reiht nichts ein | `npm test` (`tests/workflow.test.js`) | 🟢 |
| K3 | Ein Neustart verliert keine wartende Genehmigung | `npm test` (`tests/integration/persistence.test.js`) | 🟢 |
| K4 | Routing ist deterministisch und terminiert | `npm run evals` | 🟢 |
| K5 | `clone → install → demo` läuft auf einer frischen Maschine durch | `npm install && npm run demo` | 🟢 |
| K6 | Eine zweite Domäne ändert null Zeilen im Kern | `grep -rn "<domäne>" src/kernel/` | 🟢 (leer) |
| K7 | … | … | … |

> Der Stand oben gilt für das mitgelieferte Gerüst mit der Domäne `beispiel`.
> Sobald deine eigene Domäne dazukommt, prüf ihn erneut — und trag ihn erneut ein.

## 5. Zielgruppe und Nutzung

<!-- Wer bedient das System? Über welchen Kanal (CLI, HTTP, MCP)? Wer genehmigt? -->

## 6. Stand und Baseline

### 6.1 Baseline

<!-- Der erste gemessene Zustand, mit Datum und Berichtsdatei. Eine rote Baseline ist
     kein Makel, sondern der Ausgangspunkt: der Übergang von Rot zu Grün ist der Beweis.
     Versteck ihn nicht. -->

| Datum | Bericht | Was gemessen wurde | Ergebnis |
| --- | --- | --- | --- |
| — | — | noch nichts | — |

### 6.2 Heutiger Stand

<!-- Kurz. Was läuft, was nicht, was als Nächstes kommt. -->

## 7. Plan

<!-- Phasen oder Etappen, je mit einem Tor: welcher Befehl muss grün sein,
     bevor die nächste Etappe beginnt? Ein Tor ohne Befehl ist kein Tor. -->

| Etappe | Ziel | Tor (Prüfbefehl) | Stand |
| --- | --- | --- | --- |
| — | — | — | — |
