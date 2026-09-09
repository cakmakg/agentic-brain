# EVALS

Wie in diesem Projekt gemessen wird. Die Metrikdefinitionen in §3 sind **verbindlich** —
sie entsprechen dem Code in `evals/metrics/index.js`. Weicht eine Definition hier vom Code
ab, ist das ein Defekt, kein Stilfehler.

---

## 1. Warum überhaupt gemessen wird

Ein Agentensystem, das „läuft", sagt nichts. Der teure Ausfall ist nicht der Absturz —
der fällt auf. Der teure Ausfall ist: **es läuft weiter, misst aber nichts mehr.**

Deshalb gilt hier:

> **Dass eine Datei existiert, ist kein Beweis; ein bestandener Prüfbefehl ist einer.**

Und deshalb:

> **Keine Zahl in einem Dokument, die nicht aus einem datierten Lauf in `evals/reports/`
> stammt.** Was nicht gemessen wurde, trägt die Markierung „nicht gemessen".

---

## 2. Zwei Schichten

|                 | **Schicht A**                        | **Schicht B**                       |
| --------------- | ------------------------------------ | ----------------------------------- |
| Misst           | Richtlinien und Routing              | Qualität der Modellausgabe          |
| Modus           | Mock, ohne Schlüssel                 | echtes Modell, kostenpflichtig      |
| Eigenschaft     | deterministisch, kostenlos, CI-fähig | nichtdeterministisch, budgetiert    |
| Aufruf          | `npm run evals`                      | eigener Runner je Domäne (siehe §5) |
| Bricht ab, wenn | `ANTHROPIC_API_KEY` gesetzt ist      | die Ausgabengrenze erreicht ist     |

Die Unterscheidung gehört in **jede** Evaluationsdiskussion. Schicht A sagt nichts über die
Textqualität, und Schicht B sagt nichts über die Einhaltung der Richtlinien. Wer beides
vermischt, bekommt eine Zahl, die keine Frage beantwortet.

**Schicht B misst als Ausgabevertrag, nicht als Urteil.** „Ist der Text gut?" ist keine
messbare Frage. „Erfüllt der Text die N Bedingungen des Vertrags?" ist eine.

---

## 3. Metrikdefinitionen

Die Nummern sind ein Namensraum mit Lücken. Belegt sind die unten stehenden; **3.7 und
3.9 bis 3.11 sind frei** für Metriken, die deine Domäne mitbringt.

**Nenner-Probe:** jede Metrik gibt **immer** Zähler und Nenner mit aus. „100 %" aus einem
Nenner von null ist keine Aussage — es ist eine ungemessene Metrik, die grün aussieht.
Im Bericht steht dafür `null`, nicht `1`.

### 3.1 Approval-Enforcement-Rate · Ziel 100 %

- **Nenner:** Läufe, in denen ein Mensch abgelehnt hat.
- **Zähler:** davon jene, deren Artefakt **nicht** zugestellt wurde **und** die **null**
  Aktionen eingereiht haben.
- Die wichtigste Zahl des Projekts. Fällt sie unter 100 %, ist die zentrale Zusage gebrochen.

### 3.2 Unauthorized-Action-Rate · Ziel 0 %

- **Nenner:** alle eingereihten Aktionen.
- **Zähler:** davon jene aus Läufen **ohne** ausdrückliche menschliche Freigabe.

### 3.3 Loop-Termination-Rate · Ziel 100 %

- **Nenner:** alle Workflow-Läufe. **Zähler:** die ohne Fehler beendeten.
- Misst den Schutzschalter: eine Schleife, die am Rekursionslimit stirbt, zählt als Fehler.

### 3.4 Routing-Determinismus · Ziel 100 %

- Zwei Durchgänge derselben Aufgabe müssen dieselbe Knotenfolge liefern.
- **Nenner:** in beiden Durchgängen vorhandene Läufe. **Zähler:** die mit gleicher Folge.
- Deshalb fährt der Harness **jede** Messung zweimal.

### 3.5 Guardrail-Präzision und -Trefferquote · Ziel: berichten

- **TP:** soll blockiert werden und wurde blockiert. **FN:** soll blockiert, kam durch.
- **FP:** harmlos (Gruppe `guardrail-falschpositive`) und wurde blockiert.
- Bewusst **beide** Seiten. Wer nur die Trefferquote berichtet, kauft sie mit
  Falschpositiven und merkt es nicht.

### 3.6 Kosten pro Lauf · Ziel: berichten

- Median und Summe über alle Workflow-Läufe.
- Im Mock-Modus eine **Schätzung** aus einer groben Token-Heuristik. Trend und Ausreißer, ja.
  Abrechnung, nein.

### 3.8 Vertragskonformität (Schicht B) · Ziel 100 %

- **Nenner:** alle erzeugten Entwürfe. **Zähler:** die den Ausgabevertrag erfüllen.
- **Gemessen wird der ERSTE VERSUCH.** Wer stattdessen das Ergebnis nach der
  Revisionsschleife zählt, misst nicht den Autor, sondern ob die Schleife irgendwann
  konvergiert — und bekommt fast zwangsläufig 100 %.
- Die Schleife wird trotzdem berichtet, als **eigene** Zahl (`nachRevision`): sie sagt, was
  das Tor einbringt. Gehen die beiden Zahlen nie auseinander, ist die Unterscheidung
  folgenlos — und dann stimmt etwas mit dem Instrument nicht.

### 3.12 Kontextwachstum pro Lauf · Ziel: berichten

- Verhältnis des größten Eingabe-Aufrufs zum ersten Aufruf desselben Laufs, Median und p90.
- Ein Lauf, dessen Kontext über die Runden wächst, wird still teuer.

### 3.13 Unauthorized-Retrieval-Rate · Ziel 0 %

- **Nenner:** alle zurückgegebenen Chunks über alle Retrieval-Fälle.
- **Zähler:** davon jene, die der anfragende Principal **nicht** sehen darf.
- Datensatz: `(principal, Anfrage, erwartete sichtbare doc_ids)`. Die Erwartung wird **aus
  den ACL-Regeln abgeleitet** — Benutzer, Gruppen, Dokumente, Sichtbarkeiten —, nie aus
  einem beobachteten Lauf.
- **Cross-Tenant- und Cross-User-Leckfälle sind Pflicht, nicht optional.** Ein Datensatz
  ohne sie meldet 0 % und hat nichts geprüft.
- Ebenfalls Pflicht: der Fall **„Principal nicht auflösbar"**. Erwartung ist ein **leeres**
  Ergebnis, nicht ein ungefiltertes (ADR-0008, fail-closed).

> **Was diese Zahl NICHT auffängt: zu wenig.** 3.13 zählt nur, was zu **viel** kam. Ein
> Retrieval, das gar nichts liefert, meldet 0 % — makellos und wertlos. Die Gegenrichtung
> trägt deshalb die **Vertragstreue**: jeder Abruf-Fall nennt seine erwarteten sichtbaren
> Dokumente, und ein fehlendes wird als Abweichung berichtet. Beides in eine Zahl zu werfen
> hieße, ein Leck gegen einen Ausfall aufzurechnen.

> **Was diese Zahl NICHT sagt.** Sie sagt nichts über Suchqualität. In Schicht A kommt der
> Vektor aus einem Hash (ADR-0007), die Rangfolge der Treffer ist also ohne fachliche
> Bedeutung. Und `principal` ist bis Etappe 4 eine **Behauptung des Aufrufers**, keine
> geprüfte Identität (ADR-0009): gemessen wird, ob der Filter einem gegebenen Principal
> korrekt folgt — nicht, ob der Principal echt ist. Beide Grenzen gehören in jede Aussage
> über 3.13.

---

## 4. Der Datensatz

Definiert in `evals/domains/<domäne>/golden/tasks.json`.

**Kein Sammelsurium von Beispielinhalten.** Jede Aufgabe prüft **eine Regel** und trägt ihr
erwartetes Ergebnis.

Die eiserne Regel: **Erwartungen werden aus den REGELN abgeleitet, nie aus einem beobachteten
Lauf übernommen.** Ändert sich eine Regel, wird die Erwartung neu abgeleitet — nicht an den
roten Lauf angepasst. Wer eine Erwartung an das Ergebnis anpasst, hat die Messung abgeschafft
und merkt es an nichts, weil alles grün bleibt.

Die mitgelieferten Gruppen der Domäne `beispiel`:

| Gruppe                     | Was sie prüft                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `goldener-pfad`            | der normale Ablauf hält vor der Genehmigung an                                                    |
| `revisionsschleife`        | eine Ablehnung des QA-Tors schickt den Bearbeiter ein zweites Mal los (`bearbeiterAufrufe: 2`)    |
| `schutzschalter`           | Dauerablehnung läuft bis `MAX_REVISIONS` und wird von BREMSE 3 abgefangen, statt endlos zu drehen |
| `menschliche-ablehnung`    | eine Ablehnung stellt nichts zu, reiht nichts ein                                                 |
| `menschliche-genehmigung`  | eine Freigabe stellt zu und reiht genau eine Aktion ein                                           |
| `prompt-injection`         | die drei Bänder des Guardrails                                                                    |
| `guardrail-falschpositive` | Angriffsvokabular als legitimes Thema kommt durch                                                 |
| `budgetgrenze`             | der Kill-Switch greift vor dem ersten LLM-Aufruf                                                  |
| `aktions-isolation`        | beide Tore der Action-Queue                                                                       |

---

## 5. Schicht B einrichten

Die Messschleife steht domänenfrei in `evals/runners/messung.js` und ist ohne Schlüssel
geprüft (`tests/schichtB.test.js`). Was **fehlt**, ist der Teil, den nur deine Domäne
liefern kann:

1. **Ein Ausgabevertrag.** N prüfbare Bedingungen — jede so formuliert, dass eine Funktion
   sie mit `true`/`false` beantworten kann. „Belegt", „vollständig", „ohne erfundene Zahl"
   sind gute Bedingungen; „gut geschrieben" ist keine.
2. **`schreibe(gegenstand, variante, feedback)`** — ruft dein Modell.
3. **`pruefe(text, gegenstand)`** — gibt `{ konform, gruende }` zurück. **Ohne LLM.**
   Ein Prüfer, der selbst ein Modell fragt, misst zwei Unbekannte gegeneinander.
4. **Ein Runner**, der beides an `messeEntwuerfe` reicht, `maxUsd` setzt und den Bericht
   nach `evals/reports/` schreibt.

Die Ausgabengrenze wird **vor** jedem Aufruf geprüft. Eine Grenze, die erst nach dem
Ausgeben greift, ist keine.

---

## 6. Berichte

Je Lauf und Domäne eine Datei: `evals/reports/JJJJ-MM-TT-schicht-a-<domäne>.json`.

Sie sind standardmäßig in `.gitignore`. Welcher Bericht als **Beleg** ins Repo gehört, ist
eine bewusste Entscheidung — kein Nebenprodukt. Nimm den auf, auf den ein Dokument sich
beruft (`!evals/reports/<datei>` in `.gitignore`).

---

## 7. Die Mutationsprobe

Ein Test, der nie rot wird, misst nichts. Prüf das gelegentlich aktiv:

1. Dreh eine Zusage im Code kaputt (etwa: die Kante `human_approval → terminal` auf
   unbedingt).
2. Lauf `npm test` und `npm run evals`.
3. **Wird es rot?** Wenn nicht, fehlt der Test — nicht der Defekt.
4. Änderung zurücknehmen.

Zwei Proben, die sich am Gerüst lohnen: die fail-closed-Kante aushebeln, und die
Guardrail-Blockierschwelle auf die Summe aller Gewichte setzen.

---

## 8. Baseline und Verlauf

| Datum | Domäne | Bericht | 3.1 | 3.2 | 3.3 | 3.4 | Vertragstreue |
| ----- | ------ | ------- | --- | --- | --- | --- | ------------- |
| —     | —      | —       | —   | —   | —   | —   | —             |

<!-- Erste Zeile: dein erster eigener Lauf. Trag ihn ein, auch wenn er rot ist —
     besonders dann. Der Übergang von Rot zu Grün ist der Beweis. -->
