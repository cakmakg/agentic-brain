# DECISIONS

Architekturentscheidungen (ADRs). Eine Entscheidung gehört hierher, sobald sie **teuer
rückgängig zu machen** wäre — nicht schon, wenn sie getroffen wurde.

Eine ADR wird **nie gelöscht**. Wird sie überholt, bleibt sie stehen und bekommt den Status
`Abgelöst durch ADR-XXXX`. Die Historie ist der Wert des Dokuments: sie beantwortet
„warum eigentlich so?" auch dann noch, wenn niemand mehr da ist, der es weiß.

> **Reihenfolge: älteste zuerst.** Einmal entschieden, bleibt so. Die Nummer ist zugleich
> die Leserichtung.

> **Jede ADR trägt ein Prüfkriterium, und das Prüfkriterium ist ein Befehl.** Ein Kriterium
> in Prosa lässt sich nicht ausführen und wird deshalb nicht geprüft. Steht unter dem Befehl
> ein Datum mit 🔴, ist die Entscheidung getroffen, aber noch nicht eingelöst — das ist kein
> Widerspruch, sondern die Aufgabe.

---

## Vorlage

```markdown
## ADR-0001 — <Titel in einem Satz>

**Datum:** JJJJ-MM-TT
**Status:** Angenommen | Vorgeschlagen | Abgelöst durch ADR-XXXX

### Kontext

Welche Lage erzwingt eine Entscheidung? Welche Zwänge gelten? Was war der Auslöser?
Wenn ein Messwert der Auslöser war: welcher, aus welchem Lauf.

### Entscheidung

Ein Satz im Aktiv. „Wir tun X." Nicht „X wäre sinnvoll."

### Begründung

Warum diese Option und nicht die naheliegende Alternative. Die Alternative benennen.

### Konsequenzen

Was wird dadurch leichter, was schwerer. Was wir uns damit einhandeln.
Ein ADR ohne Konsequenzen-Abschnitt ist eine Absichtserklärung, keine Entscheidung.

### Prüfkriterium

Woran erkennt jemand später, dass diese Entscheidung noch gilt — und nicht still
unterwandert wurde? Am besten ein Befehl.
```

---

## ADR-0001 — Dieses Repo ist ein permission-aware Enterprise Context Layer, kein Startgerüst

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Das Repo entstand als domänenunabhängiges Gerüst und sagt das bis heute in seinen
Ankerdokumenten: „Kein Produkt, sondern ein Satz technischer Muster." Daneben ist ein
Zielbild entstanden — ein permission-aware Enterprise Context Layer mit agentischer
Prozessautomatisierung, sechs Ebenen, drei Motoren (`docs/roadmap.md` §1).

Gemessen am 2026-09-09: Motor 2 und der Kern von Motor 3 sind grün — `npm test` 98/98,
Schicht A 20/20 Aufgaben vertragstreu. Motor 1 ist leer: `src/kernel/context`,
`src/kernel/retrieval` und `src/kernel/connectors` existieren nicht.

Der Auslöser ist keine Zahl, sondern eine Reibung: solange die Ankerdokumente „Gerüst"
sagen, beginnt jede Sitzung im falschen Rahmen. `.gehirn/kern.md` wird zu Sitzungsbeginn
**vollständig** injiziert — was dort steht, ist der erste Satz, den jeder Agent liest.

### Entscheidung

Wir erklären `agentic-brain` zum Produktvorhaben: ein **permission-aware Enterprise Context
Layer** mit agentischer Prozessautomatisierung und einer Agent Control Plane. Die
Ankerdokumente `README.md`, `CLAUDE.md`, `.gehirn/kern.md` und `PRODUCT.md` tragen ab sofort
dieses Ziel und nicht mehr die Gerüst-Formel.

### Begründung

Die naheliegende Alternative wäre, den Gerüst-Rahmen stehen zu lassen und das Produktziel
allein in `docs/roadmap.md` zu führen. Das scheitert an der Autoritätskette: `roadmap.md`
steht dort **gar nicht**, `PRODUCT.md` und `DECISIONS.md` auf Stufe 2 (`CLAUDE.md`). Ein
Ziel, das nur in einem unverbindlichen Dokument lebt, verliert gegen jeden Ankertext, der ihm
widerspricht — und gegen den injizierten Kern verliert es täglich.

Die Identität muss dort stehen, wo zuerst gelesen wird.

### Konsequenzen

**Leichter:** `PRODUCT.md` §1 und §2 bekommen einen Adressaten; die Frage „gehört das ins
Produkt?" wird beantwortbar; der Ausbauplan hat jemanden, für den er gilt.

**Schwerer:** Domänenunabhängigkeit, Mock-Modus und K5 sind nicht mehr selbstverständliche
Güter, sondern Zwänge, die je Fall verteidigt werden müssen. `docs/roadmap.md` §2 hält sie
als fünf Zusagen fest — bricht eine geplante Änderung eine davon, braucht sie vorher eine
eigene ADR.

**Eingehandelt:** `EXTEND.md` beschreibt weiter, wie _ein Gerüst_ wächst. Das ist kein
Widerspruch — der Wachstumsmechanismus bleibt, der Adressat ändert sich. Ebenfalls offen: das
`description`-Feld in `package.json` sagt noch „Startgeruest". Es wird in Etappe 0c
mitgezogen, wenn das Manifest ohnehin angefasst wird, und ist deshalb **nicht** Teil des
Prüfkriteriums — ein Kriterium, das eine bekannte Ausnahme mitprüft, wird abgeschaltet.

### Prüfkriterium

```bash
grep -rniE "kein produkt|startger[üu]st" README.md CLAUDE.md .gehirn/kern.md PRODUCT.md package.json
# erwartet: keine Ausgabe
```

Stand 2026-09-09: 🟢 keine Ausgabe. Die Ankertexte tragen die Identität. Die einzige
bekannte Ausnahme — das `description`-Feld in `package.json` — ist in Etappe 0c eingelöst.
Die Datei steht seitdem **im** Befehl statt außerhalb: das Kriterium prüft jetzt, was es
vorher aussparen musste.

---

## ADR-0002 — Die sechs Ebenen liegen als Module unter `kernel/`, nicht als Wurzel von `src/`

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Das Zielbild benennt sechs Ebenen: Connectors, Context Layer, Retrieval, Agent Runtime,
Action Layer, Governance. Der heutige Kern ist nach Mechanik geschnitten — `graph/`,
`state/`, `security/`, `observability/`, `persistence/`. Beide Schnitte beschreiben dieselben
Dateien, aber nach verschiedenen Fragen.

Zwei Wege, die Ebenen einzuführen: `src/` direkt nach den sechs Ebenen teilen, oder die Achse
`kernel`/`domains` als primär behalten und die Ebenen darunter legen.

### Entscheidung

Wir behalten `kernel`/`domains` als primäre Trennlinie und führen die sechs Ebenen als
Verzeichnisse **unter** `src/kernel/` ein. Der Umbau ist eine **reine Umbenennung mit null
Logikänderung** und wird genau einmal durchgeführt (Etappe 0b).

### Begründung

`src/` nach den sechs Ebenen zu teilen würde die Linie `kernel`/`domains` auflösen — und mit
ihr die teuerste Entscheidung des Repos samt ihrem einzigen mechanischen Test
(`grep -rn "<domäne>" src/kernel/` bleibt leer). Ohne diese Linie gäbe es keinen Ort mehr, an
dem „der Kern kennt keine Domäne" überhaupt falsifizierbar wäre.

Die beiden Achsen beantworten verschiedene Fragen: Ebenen sagen **wie weit weg von IO**, die
Trennlinie sagt **wem die Bedeutung gehört**. Sie stehen senkrecht zueinander; eine darf die
andere nicht ersetzen.

### Konsequenzen

**Leichter:** Jede neue Datei hat eine Adresse, bevor sie geschrieben wird
(`ARCHITECTURE.md` §7). Abhängigkeitsregeln lassen sich auf Ebenenpfade schreiben — deshalb
kommt der dependency-cruiser-Rollout (`docs/engineering-discipline.md` E0-B) **nach** dem
Umbau und nicht davor.

**Schwerer:** Jeder Importpfad in `tests/` und `evals/domains/*/adapter.js` sowie jeder Pfad
in der Wegweiser-Tabelle von `CLAUDE.md` ändert sich einmal. Genau deshalb passiert der Umbau
allein, mit den 98 Tests und den Schicht-A-Zahlen als Netz — und ohne jede „wo wir schon
dabei sind"-Korrektur.

**Eingehandelt:** `llm/`, `persistence/store.js`, `config/` und `registry.js` bleiben
**außerhalb** der sechs Ebenen als Infrastruktur. Die Ebenenliste ist also nicht vollständig,
und wer den Baum liest, muss das wissen. `persistence/store.js` wird von zwei Ebenen benutzt
und ist selbst keine.

### Prüfkriterium

```bash
ls src/kernel | grep -vxE 'connectors|context|retrieval|agent|action|governance|llm|persistence|config|registry\.js'
# erwartet: keine Ausgabe
```

Der Befehl prüft beide Richtungen zugleich: dass die alten Namen verschwunden sind **und**
dass niemand später ein siebtes Verzeichnis daneben erfindet.

Stand 2026-09-09, nach dem Umbau (Etappe 0b): 🟢 keine Ausgabe. Der Kontext oben
beschreibt weiterhin den Zustand **vor** der Entscheidung — eine ADR wird nicht
nachträglich umgeschrieben, nur ihre Statuszeile wird nachgeführt.

---

## ADR-0003 — Wir ziehen auf LangGraph 1.x, bevor eine eigene Domäne entsteht

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Gemessen am 2026-09-09:

| Paket                  | installiert | aktuell |
| ---------------------- | ----------- | ------- |
| `@langchain/langgraph` | 0.2.74      | 1.4.14  |
| `@langchain/core`      | 0.3.66      | 1.2.9   |
| `@langchain/anthropic` | 0.3.24      | 1.5.9   |

`npm audit`: elf Schwachstellen, **sechs davon hoch**. Unter den hohen: „LangChain
serialization injection vulnerability enables secret extraction" (`@langchain/core`) und
„LangSmith SDK: Public prompt pull deserializes untrusted manifests without trust boundary
warning" (`langsmith`).

Das Netz ist heute so groß, wie es nie wieder sein wird: 98 Tests, 20 Golden-Aufgaben, genau
eine Domäne, kein Retrieval, kein Connector.

### Entscheidung

Wir führen den Sprung auf LangGraph 1.x zusammen mit der Behebung der hochstufigen
Schwachstellen als **eigenen Schritt** durch (Etappe 0c) — nach dem Umbau, vor jeder neuen
Ebene.

### Begründung

Die Alternative wäre, erst nach oben zu bauen und später zu migrieren. Sie scheitert an zwei
Punkten. Erstens schrumpft das Netz mit jeder Ebene: jede neue Schicht und jede echte Domäne
bringt Pfade mit, die die heutigen 98 Tests nicht abdecken — die Migration wird also monoton
teurer, nie billiger. Zweitens ist eine Schwachstelle der Klasse „secret extraction"
ausgerechnet in der Schicht, die den API-Schlüssel führt, nichts, was man vertagt.

Getrennt von 0b, weil LangGraph 1.x brechende Änderungen an den State- und
Annotation-Schnittstellen hat. Liefen Umbenennung und Versionssprung zusammen, wäre eine rote
Zeile weder dem einen noch dem anderen zuzuordnen.

### Konsequenzen

**Leichter:** Alles ab Etappe 2 baut auf einem unterstützten Major. `npm audit` bleibt ein
Tor und wird kein Rückstand.

**Schwerer:** `src/kernel/agent/` und der Checkpointer werden angefasst werden müssen — und
zwar an genau der Stelle, an der die HITL-Kante hängt. Die Zusage „die Kante prüft auf exakt
`true`" gilt auch durch die Migration hindurch; sie ist testgedeckt und muss es bleiben.

**Eingehandelt:** `npm audit` mit `high = 0` wird zum stehenden Tor. Taucht später eine hohe
Schwachstelle ohne Fix auf, braucht das eine eigene ADR, die sie benennt und ein Datum
setzt — nicht Schweigen.

### Prüfkriterium

```bash
node -e "const v=require('@langchain/langgraph/package.json').version; process.exit(+v.split('.')[0]>=1?0:1)" \
  && npm audit --json | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>process.exit(JSON.parse(s).metadata.vulnerabilities.high===0?0:1))"
# erwartet: Rückgabewert 0
```

Stand 2026-09-09: 🟢 Rückgabewert 0 — `@langchain/langgraph` 1.4.14, `npm audit` `high: 0`.
Eingelöst in Etappe 0c.

---

## ADR-0004 — `beispiel` bleibt als Referenzdomäne bestehen

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Mit Etappe 3 entsteht eine echte Vertikale. Der naheliegende Schritt wäre, `beispiel` durch
sie zu ersetzen — eine Beispieldomäne wirkt wie Ballast, sobald es eine echte gibt.

Die zentrale Zusage des Repos lautet aber: **eine zweite Domäne ändert null Zeilen unter
`src/kernel/`.** Bei genau einer Domäne ist diese Zusage nicht falsifizierbar — der
`grep`-Test ist trivial erfüllt, weil es nichts gibt, wogegen er laufen könnte.

Dazu kommt: `beispiel` trägt die datierte Schicht-A-Grundlinie
(`evals/reports/2026-09-08-schicht-a-beispiel.json`).

### Entscheidung

`beispiel` bleibt bestehen. Die echte Vertikale entsteht als **Geschwister** unter
`src/domains/`, nicht an ihrer Stelle.

### Begründung

Die Alternative — `beispiel` löschen, sobald die Vertikale läuft — verwechselt die
Beispieldomäne mit Ballast. Sie ist das Messinstrument: sie hält die Trennlinie prüfbar, sie
läuft ohne API-Schlüssel und ohne echte Daten, und sie hält die Berichte über Etappen hinweg
vergleichbar. Ohne sie wird aus einer geprüften Eigenschaft eine Behauptung.

### Konsequenzen

**Leichter:** Die Trennlinie bleibt mit zwei Domänen messbar. Schicht A behält eine Domäne
ohne Kosten und ohne Datenschutzfläche. Die Grundlinie bleibt über alle Etappen vergleichbar.

**Schwerer:** Jede Kernänderung muss zwei Domänen grün halten. `beispiel` will gepflegt
werden, obwohl es keinen Produktwert liefert — das ist der Preis der Prüfbarkeit.

**Eingehandelt:** Das Prüfkriterium läuft über **alle** Domänen. Eine dritte Domäne ist
automatisch mitgeprüft, ohne dass jemand das Kriterium anfasst.

### Prüfkriterium

```bash
test -f src/domains/beispiel/domain.js \
  && ! grep -rEq "$(ls -d src/domains/*/ | xargs -n1 basename | paste -sd'|')" src/kernel/
# erwartet: Rückgabewert 0
```

Stand 2026-09-09: 🟢 Rückgabewert 0.
