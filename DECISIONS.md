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

---

## ADR-0005 — Die hexagonale Achse liegt innerhalb einer Ebene; `retrieval/` bleibt eine eigene Ebene

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Vor der ersten Zeile von Etappe 2 stellte sich heraus, dass zwei Dokumente sich
widersprechen, und zwar genau darüber, wohin die neuen Dateien gehören.

`ARCHITECTURE.md` §7 — der Vertrag — legt `context/` und `retrieval/` als **Geschwister**
unter `src/kernel/` an; so nennt sie auch ADR-0002 und der Prüfbefehl `ls src/kernel`.
`docs/engineering-discipline.md` skizziert dagegen `retrieval/filter.js` **innerhalb** von
`kernel/context/`.

Ein zweiter, kleinerer Widerspruch daneben: die Ebenentabelle in `docs/roadmap.md` §1 ordnet
den „Ingest-Rahmen" der Ebene ① Connectors zu, dieselbe Skizze legt `ingest/pipeline.js`
aber nach `context/`.

Beides sind Fragen, die man nicht beim Schreiben der Datei beantworten will.

### Entscheidung

Wir folgen `ARCHITECTURE.md` §7: **`retrieval/` ist eine eigene Ebene neben `context/`,
keine Unterschicht davon.** Die hexagonale Achse — Port, Adapter, reine Logik,
Anwendungsfall — wird **nicht** zu Verzeichnissen auf Ebenenhöhe, sondern bleibt eine Rolle,
die eine Datei **innerhalb** ihrer Ebene spielt.

Und wir trennen die beiden Bedeutungen von „Ingest": `connectors/` ① holt aus einer
**Quelle** und erfasst deren Berechtigungsmodell; `context/ingest/` ② nimmt ein bereits
geholtes Dokument samt Envelope entgegen und macht Chunks daraus. Etappe 2 baut nur das
zweite. `connectors/` bleibt nach Etappe 2 leer — das ist kein Versehen.

### Begründung

Der Vertrag gewinnt, weil er in der Autoritätskette steht (`CLAUDE.md`, Stufe 2) und `docs/`
nicht. Das ist hier keine Formalie: `ls src/kernel` ist das Prüfkriterium von ADR-0002, und
es zählt genau die sechs Ebenennamen auf. Läge `retrieval/` unter `context/`, prüfte dieser
Befehl eine Ebene weniger, ohne dass es jemandem auffiele — die Ebene wäre noch da, aber
nicht mehr überprüfbar.

Die naheliegende Alternative — die hexagonale Achse als oberste Ordnerebene — ist dieselbe,
die ADR-0002 für die sechs Ebenen schon abgelehnt hat, aus demselben Grund: zwei Achsen
gleichzeitig als Verzeichnisbaum auszudrücken geht nicht, eine muss zur Regel werden.
`docs/engineering-discipline.md` sagt das selbst („Die Regel, nicht der Ordner, hält das
zusammen") und widerspricht sich nur in der Skizze darunter.

Dass die beiden wartenden dependency-cruiser-Regeln als Glob geschrieben sind
(`*/store/index.js`, `**/retrieval/filter.js`), ist der Grund, warum dieser Widerspruch so
lange unbemerkt blieb: sie greifen in **beiden** Anordnungen. Die Regeln überleben diese
Entscheidung unverändert.

### Konsequenzen

**Leichter:** Der Prüfbefehl von ADR-0002 bleibt vollständig, und jede neue Datei aus
Etappe 2 hat eine Adresse, bevor sie geschrieben wird.

**Schwerer:** Die Skizze in `docs/engineering-discipline.md` muss korrigiert werden, sonst
bleibt der Widerspruch stehen und die nächste Person entscheidet ihn neu.

**Eingehandelt:** Ein Zusammenbau-Ort wird nötig. Der Port darf seine Adapter nicht kennen
(ADR-0006), also muss jemand anderes sie verdrahten. Diese Datei ist `context/aufbau.js` und
ist ausdrücklich kein Port, sondern eine Kompositionswurzel.

### Prüfkriterium

```bash
test -d src/kernel/retrieval \
  && test ! -d src/kernel/context/retrieval \
  && ! ls src/kernel | grep -qvxE 'connectors|context|retrieval|agent|action|governance|llm|persistence|config|registry\.js'
# erwartet: Rückgabewert 0
```

Der letzte Teil steht bewusst als `! … grep -q` und nicht als blankes `grep -v`: ein `grep`
ohne Treffer endet mit Rückgabewert 1. Die erste Fassung dieses Kriteriums verlangte
„Rückgabewert 0 **und** keine Ausgabe" — beides zugleich ist unerfüllbar, und ein
Prüfkriterium, das nie grün werden kann, ist schlimmer als keins. Aufgefallen beim ersten
Ausführen, noch in Etappe 2.

Stand 2026-09-09, nach Etappe 2: 🟢 Rückgabewert 0.

---

## ADR-0006 — Der Retrieval-Store ist ein Port mit zwei Adaptern

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Etappe 2 schreibt die erste Zeile Retrieval. Die naheliegende Abkürzung wäre, direkt gegen
pgvector zu schreiben — das ist der Zielzustand, und ein Port wirkt wie Zeremoniell, solange
es nur einen Adapter gibt.

Dagegen stehen zwei Zusagen, die das Repo bereits gibt: der Mock-Modus („ohne
`ANTHROPIC_API_KEY` läuft der komplette Ablauf Ende zu Ende") und K5 („`clone → install →
demo` läuft durch"). Beide sind heute grün, weil nichts im Ablauf eine laufende
Infrastruktur braucht.

### Entscheidung

Der Store ist ein **Port** in `src/kernel/context/store/index.js` mit einem Adapter je
Speicher: `memory.js` jetzt, `postgres.js` in Etappe 3. **Der Port importiert keinen
Adapter.** Verdrahtet wird in `context/aufbau.js`; `npm run demo` und `npm run evals`
benutzen **immer** den `memory`-Adapter.

### Begründung

Ohne diese Entscheidung nimmt die erste Retrieval-Zeile dem Repo seine Grundlage, und sie
kommt nicht zurück: sobald der Ablauf eine Datenbank braucht, ist K5 gebrochen, Schicht A
läuft nicht mehr in CI, und die Messung der Autorisierung — der eigentliche Zweck von
Etappe 2 — hinge an einem Dienst, der beim Messen laufen muss.

Die Alternative „erst pgvector, Port später" scheitert daran, dass ein nachträglich
eingezogener Port nur die Aufrufe abbildet, die es zufällig schon gibt. Ein Port, der nach
seinem einzigen Adapter geformt wurde, ist keiner.

Der Preis ist ehrlich zu nennen: **ein Adapter beweist kein Port.** Erst der zweite
(Etappe 3) zeigt, ob die Grenze an der richtigen Stelle liegt. Bis dahin ist diese ADR eine
Wette, keine Messung.

### Konsequenzen

**Leichter:** Schicht A bleibt deterministisch, kostenlos und in CI ausführbar. Etappe 3 kann
dieselbe Eval-Suite gegen den Postgres-Adapter fahren — das ist dort ausdrücklich das Tor.

**Schwerer:** Jede Store-Fähigkeit muss zweimal gedacht werden: einmal als Vertrag im Port,
einmal als Umsetzung im Adapter. Wer das umgeht, indem er ein Adapter-Detail durchreicht,
hebt die Entscheidung auf, ohne sie zu widerrufen.

**Eingehandelt:** `memory.js` muss die Semantik des späteren Adapters **nachbilden**, nicht
nur irgendwie suchen. Weicht die Reihenfolge der Treffer ab, wandert der Unterschied als
stille Verhaltensänderung nach Etappe 3.

### Prüfkriterium

```bash
grep -nE "from \"\./(memory|postgres)" src/kernel/context/store/index.js
# erwartet: keine Ausgabe — ein Port kennt seine Adapter nicht
```

Stand 2026-09-09, nach Etappe 2: 🟢 keine Ausgabe — der Port kennt seine Adapter nicht.

---

## ADR-0007 — Das Embedding der Schicht A kommt aus einem Hash, nicht aus einem Modell

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Retrieval braucht Vektoren. Ein echtes Embedding-Modell kostet Geld, braucht einen Schlüssel
und liefert nicht bei jedem Lauf exakt dasselbe.

Schicht A misst aber nicht, ob die Einbettung gut ist. Sie misst, ob **kein unberechtigter
Chunk zurückkommt**. Für diese Frage ist der Vektor Beiwerk: er entscheidet, welche der
erlaubten Treffer oben stehen — nicht, ob ein verbotener dabei ist.

### Entscheidung

Im Mock-Modus wird der Vektor **deterministisch aus dem Inhalt abgeleitet** (Hash), ohne
Modellaufruf. Ein echtes Embedding kommt mit Etappe 3 und ist Sache von Schicht B.

### Begründung

Die Alternative wäre, Schicht A gegen ein echtes Modell zu fahren. Damit verlöre die
wichtigste Messung des Projekts genau die drei Eigenschaften, wegen derer sie überhaupt
etwas beweist: deterministisch, kostenlos, in CI. Eine Autorisierungsmessung, die bei jedem
Lauf leicht anders ausfällt, kann keinen Leckfall von Rauschen unterscheiden.

Umgekehrt gilt die Grenze wörtlich und gehört benannt: **dieser Aufbau kann nicht zeigen,
dass die Suche gute Treffer liefert.** Er zeigt, dass sie keine verbotenen liefert. Wer die
Zahl 3.13 als Aussage über Suchqualität liest, liest sie falsch.

### Konsequenzen

**Leichter:** `npm run evals` bleibt ohne Schlüssel lauffähig, und 3.13 ist bei zwei
Durchgängen identisch — sonst wäre die Metrik nicht beweisfähig.

**Schwerer:** Die Rangfolge der Treffer ist im Mock ohne fachliche Bedeutung. Ein Test, der
sich auf „das relevanteste Dokument steht oben" stützt, misst den Hash und nicht die Suche.

**Eingehandelt:** Etappe 3 wechselt das Embedding und **darf 3.13 nicht bewegen**. Tut sie es
doch, hing die Autorisierung an der Rangfolge — und das wäre ein Defekt, kein Nebeneffekt.

### Prüfkriterium

```bash
node --test tests/context.test.js
# erwartet: gruen — darunter der Fall "derselbe Text ergibt denselben Vektor"
```

Stand 2026-09-09, nach Etappe 2: 🟢 31 Tests gruen, darunter der Determinismus des Vektors.

---

## ADR-0008 — Der ACL-Filter wird in die Abfrage kompiliert und ist fail-closed

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Es gibt zwei Wege, Berechtigungen im Retrieval durchzusetzen. Entweder man sucht zuerst und
wirft danach weg, was der Aufrufer nicht sehen darf — oder man baut die Berechtigung in die
Abfrage ein, sodass ein unberechtigter Chunk gar nicht erst zurückkommt.

Der erste Weg ist bequemer und in fast jeder RAG-Anleitung zu finden. Er hat zwei Fehler, die
beide still sind: ein vergessener Filterzweig fällt nicht auf, und der Chunk hat den Speicher
bereits verlassen — er liegt im Prozess, im Log, im Trace.

### Entscheidung

Der ACL-Filter wird **in die Abfrage kompiliert**, nicht nachgelagert angewandt — in
**beiden** Pfaden der hybriden Suche, dem vektoriellen und dem lexikalischen. Lässt sich der
Principal oder die Richtlinie nicht auflösen, ist das Ergebnis **leer**, nicht ungefiltert.

### Begründung

Das ist dieselbe Zusage, die der Graph an der HITL-Kante schon gibt: **alles, was nicht
ausdrücklich erlaubt ist, endet bei nichts.** Dort prüft die Kante auf exakt `true`; hier
liefert ein unauflösbarer Principal exakt null Treffer. Eine zweite Stelle mit derselben
Logik und umgekehrtem Vorzeichen wäre der Punkt, an dem das Sicherheitsmodell
auseinanderfällt.

„Beide Pfade" steht ausdrücklich in der Entscheidung, weil hybride Suche der klassische Ort
für ein halbes Leck ist: der Vektorpfad wird gefiltert, der Stichwortpfad nicht, und die
Vereinigung der beiden ist ungefiltert. Der Fehler ist nicht theoretisch — er ist die
naheliegende Art, hybride Suche zu bauen.

### Konsequenzen

**Leichter:** Ein Leck ist nicht mehr eine Frage von Sorgfalt an jeder Aufrufstelle, sondern
eine Frage der Abfrage an genau einer.

**Schwerer:** Der `memory`-Adapter muss den Filter genauso in seine Suche ziehen, wie es
später die SQL-Abfrage tut. Ein `memory`-Adapter, der bequem alles durchsucht und danach
filtert, würde 3.13 grün melden und die Entscheidung trotzdem verletzen — die Zahl wäre dann
eine Aussage über den Adapter, nicht über den Entwurf.

**Eingehandelt:** Fail-closed heißt auch, dass ein Konfigurationsfehler wie ein Angriff
aussieht: kein Ergebnis. Das ist gewollt und muss im Log unterscheidbar sein, sonst sucht
jemand stundenlang den falschen Fehler.

### Prüfkriterium

```bash
npm run evals
# erwartet: 3.13 Unauthorized-Retrieval-Rate = 0 %, inklusive der Cross-Tenant- und
# Cross-User-Faelle und des Falls "Principal nicht aufloesbar"
```

Stand 2026-09-09, nach Etappe 2: 🟢 3.13 = 0 % bei Nenner 10, ueber sechs Faelle inklusive
Cross-Tenant (AC-5) und fail-closed (AC-6). Belegt durch eine **Mutationsprobe**: nimmt man
die Mandantenpruefung aus `filter.js` heraus, springt 3.13 auf 37,5 % und der Lauf endet mit
Rueckgabewert 1. Eine Metrik, die nicht rot werden kann, misst nichts.

---

## ADR-0009 — Die Envelope wird auf jeden Chunk vererbt, und der Principal steht ab sofort im Schema

**Datum:** 2026-09-09
**Status:** Angenommen

### Kontext

Ein Dokument trägt seine Berechtigungen; ein Chunk ist das, was tatsächlich zurückgegeben
wird. Dazwischen liegt die Stelle, an der Berechtigungen verloren gehen: wird die Berechtigung
nur am Dokument geführt und beim Suchen nachgeschlagen, hängt jede Abfrage an einem Join, den
jemand vergessen kann.

Dieselbe Frage stellte sich schon einmal, bei `tenantId` (`EXTEND.md` Schritt 5). Die Antwort
war, das Feld mitzuführen, obwohl es nur einen Mandanten gab.

### Entscheidung

Jeder Chunk trägt eine **Envelope** — Mandant, Quelle, Dokument-Id, Sichtbarkeit, erlaubte
Gruppen —, die beim Ingest vom Dokument **auf jeden Chunk vererbt** wird. `principal` entsteht
in Etappe 2 als **Typ** und wird aus Fixtures gespeist, nicht aus einem Verzeichnis; `agentId`
wird im selben Zug mitgeführt.

### Begründung

Wie bei `tenantId`: das Feld später nachzuziehen hieße, jede Abfrage neu zu schreiben und
jeden bereits gespeicherten Chunk nachzurüsten. Heute mitzuführen kostet nichts.

Dass der Principal ein **Typ aus Fixtures** ist und keine echte Identität, ist die
Entscheidung, die Etappe 2 überhaupt von der Vertikale löst: der Filter braucht keinen
Verzeichnisdienst, er braucht einen Principal. Die echte Auflösung — mit TTL und ohne
Dauer-Cache — kommt in Etappe 4 und ändert am Filter keine Zeile.

Die Alternative, Berechtigungen am Dokument zu lassen und beim Suchen zu verbinden, ist nicht
falsch, aber sie verschiebt die Zusage von einer Datenstruktur in eine Abfrage. Genau das will
ADR-0008 nicht.

### Konsequenzen

**Leichter:** Der Filter aus ADR-0008 arbeitet auf einem einzigen Datensatz und braucht keinen
Join. Ein Chunk ohne Envelope ist strukturell unmöglich statt nur unerwünscht.

**Schwerer:** Redundanz. Dieselbe Berechtigung steht an jedem Chunk eines Dokuments. Ändert
sie sich, müssen alle Chunks nachgezogen werden — genau das misst Etappe 3 als **3.14 Latenz
des Berechtigungsentzugs**. Diese ADR erzeugt jene Metrik.

**Eingehandelt:** `principal` ist bis Etappe 4 eine **Behauptung des Aufrufers**, keine
geprüfte Identität. Schicht A misst deshalb, ob der Filter einem gegebenen Principal korrekt
folgt — nicht, ob der Principal echt ist. Diese Grenze gehört in jede Aussage über 3.13.

### Prüfkriterium

```bash
node --test tests/context.test.js
# erwartet: gruen — darunter "ein Chunk ohne Envelope wird beim Ingest abgelehnt"
# und "zwei Chunks desselben Dokuments tragen dieselbe Envelope"
```

Stand 2026-09-09, nach Etappe 2: 🟢 `tests/context.test.js` gruen, darunter beide genannten
Faelle.
