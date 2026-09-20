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

---

## ADR-0010 — Die Vertikale ist „Besprechungsnotiz → Aktionspunkt → Ticket", die Quelle ist ein geteiltes Notizenlaufwerk

**Datum:** 2026-09-10
**Status:** Angenommen

### Kontext

Seit dem 2026-09-08 stand in `.gehirn/themen.md` die einzige Produktentscheidung, die dieses
Repo nie getroffen hatte: **welche Vertikale?** Etappe 2 hat sie erfolgreich umgangen — der
ACL-Filter braucht einen Principal, und in Schicht A kommt der aus Fixtures (ADR-0009).
Etappe 3 kann sie nicht mehr umgehen. Ontologie, Berechtigungsmodell der Quelle, Connector
und die Liste der Aktionstypen leiten sich alle aus ihr ab; `PRODUCT.md` trug bis heute neun
Vorlagenmarken und war ohne sie nicht zu füllen.

`docs/roadmap.md` §5 setzt dafür eine harte Bedingung: **eine** Quelle, und zwar die mit dem
schwersten Berechtigungsmodell. „Drei einfache Connectoren lehren zusammen weniger als ein
schwerer."

Zur Wahl standen drei Kandidaten aus `themen.md`: Besprechungsnotiz → Aktion → Ticket ·
Ticket-Triage · Kunden-Onboarding.

### Entscheidung

Wir nehmen **Besprechungsnotiz → Aktionspunkt → Ticket** als Vertikale, und als Quelle ein
**geteiltes Notizenlaufwerk** mit drei übereinanderliegenden Berechtigungsmechanismen:
Ordner-Vererbung, Freigabe an einzelne Personen, Teilnehmerliste der Besprechung.

### Begründung

Den Ausschlag gab das Berechtigungsmodell, nicht der Anwendungsfall.

**Ticket-Triage** hat die einfachste ACL: Projektmitgliedschaft plus ein privates Kennzeichen.
Das ist genau das Modell, das `envelope.js` heute schon abbildet — ein Connector dagegen hätte
nichts gelehrt und die Begründung aus §5 leerlaufen lassen.

**Kunden-Onboarding** hat eine schwere ACL, aber eine, deren Regeln aus einem Organigramm
kommen und nicht aus einem Regelwerk. `EVALS.md` §4 verlangt, dass Erwartungen **aus Regeln
abgeleitet** werden; ein Gebietsmodell hätte Fixtures erzwungen, die aus einer erfundenen
Firma stammen statt aus einer Regel.

Das Notizenlaufwerk trägt alle drei Härten, die ein Enterprise-Berechtigungsmodell schwer
machen, und jede davon ist als **Regel** formulierbar:

- **Vererbung ist ein Join.** Ein Ordner erbt die Sichtbarkeit seines Elternordners. Wer die
  Kette nicht bis zur Wurzel läuft, liest zu wenig oder zu viel — und beides fällt erst auf,
  wenn es zu spät ist.
- **Eine Freigabe an eine Person ist eine Ausnahme.** Sie hebt die Ordnerregel für genau ein
  Dokument und genau eine Person auf. Ausnahmen sind die Stelle, an der Filter falsch werden.
- **Eine Teilnehmerliste ändert sich.** Genau deshalb liefert diese Quelle den Entzugstest
  natürlich mit, den `docs/roadmap.md` als Tor für Etappe 3 nennt: Teilnehmer aus der
  Besprechung entfernt → die Notiz darf binnen eines Synchronisationszyklus nicht mehr
  auffindbar sein.

Dazu ein zweiter, kleinerer Grund: der Ablauf passt ohne Verrenkung auf den Graphen, der seit
Etappe 1 steht. Aktionspunkte aus einer Notiz zu ziehen ist ein produzierender Knoten, sie
gegen einen Ausgabevertrag zu halten ist das QA-Tor, ein Ticket anzulegen ist die
Außenwirkung, die hinter der HITL-Kante und der Aktions-Queue liegt. Wir prüfen damit die
These aus ADR-0004 ernsthaft: **eine zweite Domäne ändert null Zeilen im Kern.**

### Konsequenzen

**Leichter:** `PRODUCT.md` ist füllbar. Die Ontologie hat einen Gegenstand. Der Entzugstest
und damit Metrik 3.14 haben einen natürlichen Fall statt eines konstruierten.

**Schwerer:** Das heutige Envelope-Modell reicht nicht. Eine Freigabe an eine **Person** ist
in `oeffentlich | gruppe | privat` nicht ausdrückbar — das ist der Auslöser von ADR-0012.

**Eingehandelt:** Die Quelle ist in Schicht A eine **Fixture-Quelle**, kein Netzzugriff. Das
ist keine Bequemlichkeit, sondern die Bedingung von K5 und des Determinismus: ein Connector,
der ein Netz braucht, nimmt `npm run evals` beides. Was diese Etappe damit **nicht** zeigt,
ist das Aushandeln eines echten Protokolls — sie zeigt, dass ein Berechtigungsmodell korrekt
in die Envelope übersetzt wird und ein Entzug sich ausbreitet.

**Nicht entschieden:** ob die Demo nach dem Postgres-Adapter auf `memory` bleibt (K5). Diese
Frage fällt erst, wenn ein zweiter Adapter existiert — sie vorher zu entscheiden hieße, ohne
den Sachverhalt zu entscheiden. Sie bleibt aktives Thema bis Etappe 3c.

### Prüfkriterium

```bash
grep -c "VORLAGE\|<!-- " PRODUCT.md   # erwartet: 0
grep -rn "besprechung" src/kernel/    # erwartet: keine Ausgabe
```

Stand 2026-09-10, nach Etappe 3a: 🟢 `PRODUCT.md` meldet 0 Vorlagenmarken, die Trennlinie ist leer.

---

## ADR-0011 — Ein Connector liefert eine vollständige Momentaufnahme; die Synchronisation ersetzt eine Quelle atomar

**Datum:** 2026-09-10
**Status:** Angenommen

### Kontext

ADR-0009 vererbt die Berechtigung auf **jeden** Chunk und benennt den Preis in seinem eigenen
Konsequenzen-Abschnitt: ändert sich die Berechtigung, müssen alle Chunks nachgezogen werden.
`docs/roadmap.md` macht daraus das Tor von Etappe 3 und schreibt den Grund dazu: eine
veraltete, vermeintlich gelöschte Kopie ist ein echter Leckvektor.

Damit steht die Frage, wie ein Connector den Speicher aktuell hält. Die naheliegende Antwort
der Branche ist ein **Delta-Sync**: die Quelle meldet, was sich geändert hat, der Speicher
zieht nach.

### Entscheidung

Ein Connector liefert mit `hole()` eine **vollständige Momentaufnahme** dessen, was die Quelle
gerade freigibt — jedes Dokument samt bereits erfasster Envelope. `synchronisiere` chunkt
diese Momentaufnahme und übergibt sie dem Speicher als **atomaren Ersatz der ganzen Quelle**
(`store.ersetzeQuelle(quelle, chunks)`). Es gibt keinen Pfad, auf dem einzelne Dokumente
nachgezogen werden.

### Begründung

Bei einem Delta-Sync hängt die Entzugszusage an der **Korrektheit des Deltas**. Ein Entzug ist
aber genau der Fall, den eine Quelle am leichtesten verschweigt: ein gelöschtes Dokument
erzeugt oft kein Ereignis, eine entzogene Berechtigung fast nie. Der Fehler ist dann still —
die alte Kopie bleibt liegen und wird weiter ausgeliefert, während jede Prüfung grün meldet.
Das ist derselbe Ausfall, um den dieses Repo gebaut ist: **es läuft weiter, misst aber nichts
mehr.**

Beim atomaren Ersatz ist die Zusage **strukturell** statt abgeleitet. Ein Dokument, das die
Momentaufnahme nicht mehr enthält, verschwindet — nicht weil jemand ein Löschereignis richtig
verarbeitet hat, sondern weil es nicht mehr da ist. Ein Dokument mit enger gewordener
Berechtigung kommt mit der neuen Envelope zurück, weil es die alte nirgends mehr gibt. Das ist
dieselbe Denkweise wie in ADR-0008: der unberechtigte Chunk wird nicht weggeworfen, er
entsteht gar nicht erst.

Zweitens hält es den Port klein. Ein Delta-Sync bräuchte einen **Leseweg für Metadaten** —
was liegt gerade zu dieser Quelle im Speicher? —, um vergleichen zu können. `store/index.js`
hält heute fest, dass es **genau einen** Leseweg gibt und dass ein zweiter die Abkürzung wäre,
über die jedes Leck später hereinkäme. Diese Entscheidung erspart den zweiten Leseweg.

### Konsequenzen

**Leichter:** Entzug und Löschung brauchen keinen eigenen Mechanismus, keine Grabsteine, keine
Ereignisverarbeitung. Metrik 3.14 misst eine Eigenschaft der Struktur, nicht die Sorgfalt
eines Diffs.

**Schwerer:** Jeder Zyklus bettet alles neu ein. Mit dem Hash-Embedding aus ADR-0007 kostet
das nichts. Mit einem echten Embedding (Etappe 3d) kostet es Geld je Zyklus, und dann wird der
Delta-Sync zur ernsthaften Frage — **er braucht dann eine eigene ADR**, die ausdrücklich
benennt, dass die Entzugszusage dabei von der Struktur in eine Ableitung wandert.

> **Nachtrag 2026-09-11 — die Frage ist gefallen, und zwar anders als hier erwartet:
> ADR-0016.** Der Delta-Sync bleibt verworfen. Teuer ist nicht der Ersatz, sondern der
> Einbettungsaufruf — also wird genau der zwischengespeichert, nach Art und Text. Ein Vektor
> trägt keine Berechtigung; ein Chunk täte es. Diese ADR bleibt damit unverändert gültig: die
> Momentaufnahme ist vollständig, der Ersatz atomar, die Entzugszusage strukturell.

**Eingehandelt:** „Atomar" gilt hier innerhalb eines Prozesses. Ein verteilter Speicher braucht
dafür eine Transaktion; der `memory`-Adapter bekommt sie geschenkt, der Postgres-Adapter muss
sie ausdrücklich herstellen. Das ist eine Anforderung an Etappe 3c und steht hier, damit sie
dort nicht übersehen wird.

**Grenze der Messung:** Schicht A misst **Zyklen, keine Sekunden**. Die Sekundenzahl aus dem
Roadmap-Tor („innerhalb von N Sekunden") hängt am Zeitplan, mit dem der Connector läuft — und
einen Zeitplan gibt es noch nicht. 3.14 misst deshalb: liefert die Suche nach **einem**
Synchronisationszyklus noch einen Chunk des entzogenen Dokuments?

### Prüfkriterium

```bash
node --test tests/connectors.test.js
# erwartet: gruen — darunter "ein Dokument, das die Momentaufnahme nicht mehr enthaelt,
# ist nach der Synchronisation verschwunden" und
# "ersetzeQuelle laesst Chunks anderer Quellen unberuehrt"
```

Stand 2026-09-10, nach Etappe 3b: 🟢 `tests/connectors.test.js` 11/11 gruen, darunter beide genannten Faelle.

---

## ADR-0012 — Die Envelope wächst um `erlaubtePersonen`; eine Freigabe an eine Person ist kein Sonderfall der Gruppe

**Datum:** 2026-09-10
**Status:** Angenommen

### Kontext

Die in ADR-0010 gewählte Quelle kennt drei Berechtigungsmechanismen. Zwei davon bildet
`envelope.js` heute ab: Ordner-Vererbung wird zu `erlaubteGruppen`, ein vertrauliches Dokument
zu `sichtbarkeit: "privat"`. Der dritte nicht: eine **Freigabe an eine einzelne Person** — der
geteilte Link, die nachträglich eingeladene Teilnehmerin — hat in `oeffentlich | gruppe |
privat` keinen Platz.

`envelope.js` beschreibt ausdrücklich ein **allgemeines** Berechtigungsmodell und keine
Ontologie. Die Frage ist deshalb nicht, ob die Domäne dieses Feld will, sondern ob
„Freigabe an eine Person" allgemein genug ist, um im Kern zu stehen.

### Entscheidung

Die Envelope bekommt ein **optionales** Feld `erlaubtePersonen: string[]`, und `darfSehen`
bekommt eine Regel dafür: nach der Mandantengrenze, gleichrangig mit dem Besitzer, **vor** den
Sichtbarkeitsstufen.

### Begründung

Die naheliegende Alternative war, ohne Kernänderung auszukommen und je Dokument eine
**Pseudo-Gruppe** zu erzeugen (`notiz:<id>:freigabe`), in die die freigegebenen Personen
gelegt werden. Das funktioniert und ist genau der Grund, warum es abgelehnt wird: es
verschiebt die Kosten dorthin, wo sie niemand sieht. Die Gruppenliste des Principals wächst
dann mit der Zahl der Dokumente, auf die er je einzeln freigegeben wurde — im Betrieb als
_group explosion_ bekannt. Der Filter bliebe formal unverändert und würde in der Praxis
langsam und unlesbar.

Die Regel steht **vor** den Sichtbarkeitsstufen, weil eine Freigabe eine Ausnahme ist: sie
soll `privat` aufheben können, sonst hätte sie keinen Zweck. Sie steht **nach** der
Mandantengrenze, weil keine Ausnahme diese Grenze aufheben darf — dieselbe Ordnung, die
`filter.js` seit ADR-0008 begründet.

Dass das Feld **optional** ist, ist Absicht und zugleich der Beweis, dass die Änderung nichts
Bestehendes bewegt: `erlaubtePersonen ?? []` lässt jede heute existierende Envelope
unverändert gültig. Die sechs ACL-Fälle aus Etappe 2 und ihre Erwartungen bleiben Zeile für
Zeile dieselben.

### Konsequenzen

**Leichter:** Das Berechtigungsmodell trägt jetzt die drei Mechanismen, an denen echte
Quellen scheitern — Vererbung, Gruppe, Ausnahme. Die Domäne übersetzt, sie erfindet nicht.

**Schwerer:** Der Filter hat eine Regel mehr, und jede Regel ist eine Stelle, an der er falsch
sein kann. Bezahlt wird das mit Fällen: sowohl „Freigabe greift" als auch „Freigabe hebt die
Mandantengrenze **nicht** auf" sind Pflichtfälle im Datensatz, nicht Kür.

**Eingehandelt:** Eine Berechtigung, die an einer Person hängt, ist die teuerste Art von
Berechtigung — sie lässt sich nicht durch das Entfernen aus einer Gruppe zurücknehmen,
sondern nur dokumentweise. Genau deshalb ist der Entzug einer Personen-Freigabe ein
Pflichtfall von 3.14.

### Prüfkriterium

```bash
node --test tests/retrieval.test.js
# erwartet: gruen — darunter "eine Freigabe an eine Person hebt privat auf"
# und "eine Freigabe an eine Person hebt die Mandantengrenze NICHT auf"
npm run evals
# erwartet: 3.13 weiterhin 0.0 % — das Feld darf die Zahl nicht bewegen
```

Stand 2026-09-10, nach Etappe 3b: 🟢 beide Faelle in `tests/retrieval.test.js` gruen; `npm run evals` meldet 3.13 unveraendert 0,0 % (0/10 in `beispiel`, 0/16 in `besprechung`).

---

## ADR-0013 — K5 bleibt grün: die Voreinstellung bleibt `memory`, Postgres tritt daneben

**Datum:** 2026-09-10
**Status:** Angenommen

### Kontext

`docs/roadmap.md` hat diese Entscheidung von Anfang an für Etappe 3c vorgesehen und
ausdrücklich verlangt, dass sie **per Entscheidung fällt, nicht aus Versehen**. Sie wurde
in ADR-0010 bewusst nicht vorweggenommen: solange es keinen zweiten Adapter gab, hätte man
ohne den Sachverhalt entschieden.

Jetzt gibt es ihn. `src/kernel/context/store/postgres.js` läuft, und dieselbe Eval-Suite
liefert gegen ihn dieselben Zahlen wie gegen `memory`. Damit steht die Frage an, die K5
stellt: läuft `clone → install → demo` weiterhin ohne Infrastruktur?

### Entscheidung

**Ja.** `memory` bleibt die Voreinstellung für `npm run demo`, `npm test` und
`npm run evals`. Der Postgres-Adapter wird **ausdrücklich verlangt** — über
`STORE_ADAPTER=postgres`, `--store=postgres` oder `npm run evals:postgres` — und nie
geraten. K5 bleibt unverändert grün.

### Begründung

Die Alternative wäre gewesen, die Demo auf den „echten" Pfad umzustellen, weil er
realistischer ist. Das kostet drei Dinge auf einmal, und alle drei sind Zusagen aus
`docs/roadmap.md` §2: die Messung wäre nicht mehr kostenlos, nicht mehr deterministisch und
nicht mehr in CI lauffähig. Realismus in der Demo ist das nicht wert — die Vertikale hat mit
`npm run demo:besprechung` ohnehin einen eigenen Befehl, der den vollständigen Ablauf zeigt.

Der zweite Grund ist stärker als der erste und war vorher nicht sichtbar: **die Trennung
misst jetzt etwas.** Zwei Konfigurationen desselben Datensatzes, die dieselben Zahlen liefern
müssen, sind ein schärferes Instrument als eine. Ein Unterschied zwischen ihnen ist ein
Defekt mit genau einer möglichen Ursache — dem Adapter. Stellte man alles auf Postgres um,
verlöre man diesen Vergleich und hätte dafür nichts gewonnen.

Dass die Trennung wirklich trägt, ist keine Behauptung: `context/aufbau.js` lädt die
Adapterfabriken **dynamisch**. Ohne `STORE_ADAPTER=postgres` wird `pg` nicht einmal geladen —
im Abdeckungsbericht von `npm test` taucht `postgres.js` gar nicht erst auf.

### Konsequenzen

**Leichter:** K5 bleibt, was es war. Ein Klon des Repos braucht weiterhin nur Node. Die
Schicht-A-Messung bleibt kostenlos und CI-fähig.

**Schwerer:** Es gibt jetzt **zwei** gemessene Konfigurationen und damit zwei Berichte je
Domäne und Tag. Der Dateiname trägt deshalb den Adapternamen, und der Bericht trägt das Feld
`storeAdapter`. Ohne das wäre ein Lauf, bei dem `STORE_ADAPTER` still verschluckt wurde, von
einem echten Postgres-Lauf nicht zu unterscheiden — und er meldete grün.

**Eingehandelt, und es ist die wichtigste Zeile dieser ADR:** der Postgres-Pfad wird nur
gemessen, wenn jemand ihn ausdrücklich fährt. Eine CI ohne Docker misst ihn **nicht**. Das
ist eine bewusste Lücke, keine übersehene: sie zu schließen hieße, Docker zur Voraussetzung
jedes Laufs zu machen — also K5 aufzugeben, nur über einen Umweg. Wer den Postgres-Lauf zur
Bedingung eines Merge machen will, braucht dafür eine eigene Entscheidung und einen
CI-Dienst, der eine Datenbank stellt.

### Prüfkriterium

```bash
npm run demo                       # ohne DATABASE_URL, ohne Docker
npm test                           # meldet "skipped 6", nicht "fail"
npm run evals                      # Store: memory
npm run evals:postgres             # Store: postgres — dieselben Zahlen
```

Stand 2026-09-10, nach Etappe 3c: 🟢 `npm run demo` Exit 0 ohne Infrastruktur ·
`npm test` 185 bestanden, **6 uebersprungen**, 0 gefallen · beide Eval-Laeufe in **jeder**
Metrik identisch (3.13 = 0 %, 3.14 = 0 %, Vertragstreue 28/28 und 32/32).

---

## ADR-0014 — Die ACL-Regeln haben EINE Quelle und ZWEI Kompilate

**Datum:** 2026-09-10
**Status:** Angenommen

### Kontext

ADR-0008 verlangt, dass der ACL-Filter **in die Abfrage kompiliert** wird. Für den
`memory`-Adapter heißt das ein JavaScript-Prädikat, das beim Durchsuchen angelegt wird. Für
Postgres heißt dasselbe etwas völlig anderes: eine `WHERE`-Bedingung mit gebundenen
Parametern.

Damit steht die Frage, die jeden zweiten Adapter betrifft: wo leben die Regeln?

### Entscheidung

Die vier Zugangsregeln und die Mandantengrenze stehen **einmal**, in
`src/kernel/retrieval/filter.js`, als Liste. Jede Regel trägt **beide Kompilate** in
derselben Deklaration — `js: (p, e) => …` und `sql: (p, binde) => …`, direkt untereinander.
`darfSehen` und `kompiliereFilterSql` bauen daraus, keiner von beiden formuliert eine eigene
Regel. Auch die Spaltennamen stehen dort; der Adapter baut sein Schema aus ihnen.

### Begründung

Drei Alternativen standen zur Wahl, und die naheliegendste ist die gefährlichste.

**(a) Zwei getrennte Implementierungen** — die ACL-Logik im Filter, die `WHERE`-Bedingung im
Postgres-Adapter. Sie driften auseinander, und zwar unbemerkt: 3.13 misst je Adapter nur
seine eigene Hälfte, und beide melden 0 %, während sie Verschiedenes bedeuten. Abgelehnt.

**(b) In Postgres nachgelagert filtern** — alles holen, dann das JS-Prädikat anwenden. Damit
gäbe es nur eine Implementierung, aber ADR-0008 wäre gebrochen: der unberechtigte Chunk
verlässt die Datenbank. Genau das, was jene ADR ausschließt. Abgelehnt.

**(c) Ein kleiner Ausdrucksbaum** und zwei Interpreter — formal die reinste Lösung und
wirklich nur eine Quelle. Bei vier Regeln ist sie Überbau, und sie verschiebt das Problem:
der Interpreter selbst kann falsch sein, und ihn prüft dann nichts.

Gewählt wurde die Fassung, die **Nachbarschaft mit Messung** verbindet. Die zwei Kompilate
stehen nebeneinander, in einem Blick prüfbar — aber Nachbarschaft ist kein Beweis. Der Beweis
ist, dass sie **gegeneinander gemessen** werden:

- ein Differenztest fährt dieselben Dokumente, dieselbe Frage und fünf Principale durch
  beide Adapter und vergleicht die Chunk-Ids **in ihrer Reihenfolge**
  (`tests/integration/postgres.test.js`);
- dieselbe Eval-Suite läuft gegen beide Adapter und muss dieselben Zahlen liefern.

Dass die Spaltennamen bei den Regeln stehen und nicht im Adapter, folgt derselben Logik:
liefe das Schema unabhängig von der Bedingung, wäre ein Tippfehler in einem Spaltennamen ein
**leeres Suchergebnis** — und ein leeres Ergebnis sieht in 3.13 makellos aus.

### Konsequenzen

**Leichter:** Eine neue Zugangsregel ist ein Eintrag mit zwei Zeilen. Ein Adapter kann keine
eigene ACL-Regel erfinden: der Port reicht ihm die fertigen Kompilate und den Principal
ausdrücklich **nicht**.

**Schwerer:** Wer eine Regel hinzufügt, muss an beide Kompilate denken. Eine Regel mit nur
einem `js` verschwände im SQL-Pfad still — deshalb prüft ein Test, dass jede Regel beide
Funktionen trägt. Das ist der billigste Teil der Absicherung und der, der am ehesten gebraucht
wird.

**Nebenbei gefallen:** die geordnete `if`-Kette wurde zur Normalform
`Mandant UND (A ODER B ODER C ODER D)`. Die Umformung ist gleichwertig — `privat` und
„unbekannt" trugen nie zu einer Erlaubnis bei — und macht die Reihenfolge der vier Regeln
bedeutungslos. Die Mandantengrenze steht bewusst **außerhalb** der Disjunktion, weil sie ein
UND ist.

**Eingehandelt:** Der SQL-Pfad wird nur gemessen, wenn jemand gegen Postgres fährt
(ADR-0013). Bis dahin trägt ihn allein die Nachbarschaft der beiden Zeilen — und die ist,
wie oben gesagt, kein Beweis. Wer den SQL-Pfad ändert, ohne den Postgres-Lauf zu fahren, hat
nichts geprüft.

### Prüfkriterium

Die Mutationsprobe, und sie prüft beide Hälften auf einmal: die Mandantengrenze **nur** im
SQL-Kompilat aushebeln (`MANDANTENGRENZE.sql` gibt `true` zurück), dann beide Läufe fahren.

```bash
npm run evals -- besprechung        # muss GRUEN bleiben  (JS-Prädikat unberührt)
npm run evals:postgres -- besprechung   # muss ROT werden (SQL-Bedingung kaputt)
node --test tests/integration/postgres.test.js   # Differenztest
```

Stand 2026-09-10, nach Etappe 3c: 🟢 ausgefuehrt. Unter der Mutation blieb der memory-Lauf
bei 3.13 = 0,0 % (32/32 vertragstreu), der Postgres-Lauf sprang auf **33,3 % (8/24)** mit
Rueckgabewert 1, und die beiden Cross-Tenant-Faelle BA-5 und BA-6 meldeten ihr Leck
namentlich. Danach zurueckgenommen. Der Differenztest ist gruen: beide Adapter liefern fuer
fuenf Principale dieselben Chunk-Ids in derselben Reihenfolge.

---

## ADR-0015 — Das Embedding ist ein Port mit zwei Adaptern; der echte heißt Voyage

**Datum:** 2026-09-10
**Status:** Angenommen

### Kontext

Bis Etappe 3d bettete das Repo Text mit einer FNV-1a-Hash-Funktion über 64 Dimensionen ein.
Das war nie als Suchqualität gemeint, sondern als **Platzhalter mit einer Eigenschaft**:
deterministisch, kostenlos, netzfrei — also tauglich für Schicht A und für K5. Er hat seine
Aufgabe erfüllt und trägt sie weiter.

Was er **nicht** kann: Bedeutung. „Rollout verschoben" und „Einführung vertagt" liegen für
ihn beliebig weit auseinander, weil sie kein Wort teilen. Jede Aussage dieses Repos über
Retrieval-Qualität war bis hierher eine Aussage über Wortüberlappung.

Der Auslöser für die Entscheidung war eine Feststellung, die den naheliegenden Weg versperrt:
**Anthropic bietet kein Embedding-Modell an.** Die eigene Dokumentation sagt es wörtlich —
„Anthropic does not offer its own embedding model" — und verweist auf Voyage AI. In einem
Repo, das sonst ausschließlich Anthropic anspricht, ist ein zweiter Anbieter also keine
Vorliebe, sondern die dokumentierte Empfehlung des ersten.

Damit stellten sich drei Fragen auf einmal, und nur die mittlere ist die eigentliche:

1. Welcher Anbieter?
2. **Ersetzt** der echte den Hash — oder tritt er **daneben**?
3. Was passiert mit der Zusage 3.13 = 0 %, wenn die Vektoren sich ändern?

### Entscheidung

**Ein Port `kernel/context/embedding/` mit zwei Adaptern.** `hash` bleibt die Voreinstellung;
`voyage` ist opt-in über `EMBEDDING_ADAPTER=voyage`. Der Port schreibt drei Dinge vor:
`name`, `dimensionen` und `einbetteViele(texte, art)`. Die Wahl trifft `aufbau.js` — derselbe
Kompositionswurzel, der schon den Store-Adapter wählt.

**Der Port kennt zwei Arten: `dokument` und `anfrage`.** Ein echtes Retrieval-Modell bettet
die Frage anders ein als den Text, den sie finden soll; Voyage nennt das `input_type`. Der
Hash-Adapter ignoriert die Unterscheidung — er ist symmetrisch —, aber der **Port** kennt sie
von Anfang an. Sie erst mit dem zweiten Adapter einzuführen hätte jede Aufrufstelle im Repo
angefasst, und zwar genau in der Etappe, in der man am wenigsten anfassen will.

**Der Port nimmt Listen, nicht einzelne Texte.** `einbetteViele` ist die Pflichtmethode,
`einbette` nur die Bequemlichkeit darüber. Ein Dokument mit 300 Chunks wären sonst 300
Netzaufrufe, und die Anbieter rechnen je Aufruf ab.

**Der Port prüft die Antwort seines Adapters**: bekannte Art, Anzahl gleich Anzahl, jeder
Vektor in der versprochenen Breite. Ein Adapter, der zu wenige Vektoren liefert, verschiebt
sonst still die Zuordnung von Chunk zu Vektor.

### Alternativen

**Den Hash ersetzen statt danebenstellen.** Verworfen, und zwar zweimal begründet. Erstens
K5: `clone → install → demo` muss ohne Infrastruktur laufen, und ein Netzaufruf mit
Schlüsselzwang bricht das. Zweitens Schicht A: sie ist deterministisch und kostenlos, weil
sie es sein muss — eine Suite, die je Lauf Geld kostet und je Lauf leicht andere Zahlen
liefert, wird nicht mehr gefahren. Genau dieselbe Begründung trägt schon ADR-0007 für das
LLM; hier ist sie nur auf das Embedding angewandt.

**Die Breite aus der ersten Antwort raten.** Verworfen. Die Zahl steht im Vertrag mit dem
Postgres-Schema (`vector(n)`), und ein Schema von einer Antwort abhängig zu machen, die noch
nicht da ist, dreht die Reihenfolge um. Sie wird deshalb ausdrücklich mitgeführt, und der
Postgres-Adapter **prüft** beim Start, dass die vorhandene Tabelle dieselbe Breite hat.

**Ein npm-Paket für Voyage.** Es gibt keins für Node, und es bräuchte auch keins: Voyage hat
eine HTTP-API, Node bringt `fetch` mit. Ein Paket für einen einzigen POST wäre eine
Abhängigkeit, die `npm audit` mitträgt, ohne etwas beizutragen.

**Ohne Schlüssel still auf `hash` zurückfallen.** Ausdrücklich verworfen — das ist der
gefährlichste der drei. Ein Lauf, der `EMBEDDING_ADAPTER=voyage` bekommt und `hash` fährt,
schreibt `voyage` in den Bericht und misst etwas anderes. Der Adapter wirft stattdessen.

### Konsequenzen

**Gewonnen.** Die Behauptung „der Adapter ist austauschbar" ist prüfbar geworden: derselbe
Ingest, derselbe Speicher, derselbe Filter laufen mit einem 1024-dimensionalen Embedding
durch (`tests/embedding.test.js`, letzter Test). Und der teuerste Fehler dieses Adapters —
eine vertauschte Antwort — ist abgefangen: die Antwort wird **nach `index` sortiert**, nicht
in der Reihenfolge geglaubt, in der sie eintrifft.

> Warum gerade der: eine vertauschte Antwort liefert die **richtige Anzahl** Vektoren. Die
> Prüfung im Port greift also nicht, und keine Metrik dieses Repos auch nicht. Jeder Chunk
> trüge den Vektor eines anderen, und es sähe aus wie schlechte Suchqualität — der teuerste
> Ausfall ist immer der, der wie ein bekanntes Problem aussieht.

**Vorhergesagt, bevor jemand misst.** 3.13 darf sich durch ein anderes Embedding **nicht**
bewegen, und zwar aus einem Grund, der in der Reihenfolge liegt: der ACL-Filter läuft in
beiden Adaptern **vor** der Bewertung. Kein Vektor kann einen unerlaubten Chunk in die
Treffermenge heben, weil er dort nie zur Auswahl steht. Bewegt sich 3.13 doch, dann hing eine
Berechtigung an der Sortierung — und das wäre der Befund, nicht das Embedding.

Der **Nenner** von 3.13 darf sich dagegen sehr wohl ändern: ein dichtes Embedding gibt mehr
Chunks einen Wert über null als ein spärlicher Hash. `0/16` und `0/20` sind beide 0 %.

**Eingehandelt.** Ein zweiter Anbieter und ein zweiter Schlüssel im Betrieb. Und eine
Kostenstelle, die pro Ingest zählt — deshalb der Stapel und deshalb `hash` als Voreinstellung.

**Noch offen.** Wer den Embedding-Adapter wechselt, muss neu ingestieren: alte Vektoren einer
anderen Breite sind nicht vergleichbar. Der Postgres-Adapter sagt das mit einer lesbaren
Meldung, migriert aber **nicht** von selbst — die Tabelle zu verwerfen ist ein Datenverlust,
und den entscheidet kein Adapter im Vorbeigehen.

### Prüfkriterium

Zwei Befehle. Der erste ist netzfrei und prüft die Mechanik des Ports, der zweite prüft die
Zusage oben — und **braucht einen Schlüssel**:

```bash
node --test tests/embedding.test.js      # Port, Stapel, input_type, Reihenfolge
npm run evals -- besprechung             # hash: 3.13 muss 0,0 % bleiben

EMBEDDING_ADAPTER=voyage npm run evals -- besprechung   # braucht VOYAGE_API_KEY
```

Stand 2026-09-10, nach Etappe 3d:

- **Netzfreier Teil: 🟢 ausgeführt.** 12/12 in `tests/embedding.test.js`; die gesamte Suite
  202/208 (6 übersprungen, ohne `DATABASE_URL`). Seit ADR-0016 sind es **21/21** und
  217 insgesamt — die Zahlen dieses Absatzes sind der Stand vom 2026-09-10, absichtlich
  nicht nachgezogen: sie belegen den Lauf, der damals stattgefunden hat. Die Mutationsprobe an der wertvollsten
  Stelle — die Sortierung nach `index` entfernt — färbte genau die zwei Tests rot, die sie
  soll, und wurde zurückgenommen. Jede Zahl aus Etappe 3c ist nach dem Umbau auf den Port
  **unverändert** geblieben, gegen beide Store-Adapter.
- **Voyage-Teil: 🔴 nicht ausgeführt.** `VOYAGE_API_KEY` ist in dieser Umgebung nicht gesetzt.
  Der Adapter ist geschrieben und gegen ein Testdouble geprüft, das die dokumentierte
  Antwortform nachbildet — aber **ob Voyage wirklich so antwortet, weiß dieses Repo nicht.**
  Ein Testdouble beweist die eigene Logik, nicht die fremde. Bis der Lauf oben durchläuft,
  ist der zweite Adapter gebaut und **nicht gemessen**; „austauschbar" gilt bis dahin nur
  gegenüber dem breiten Testadapter, nicht gegenüber Voyage.

---

## ADR-0016 — Die vollständige Momentaufnahme bleibt; gespart wird am Einbettungsaufruf, nicht am Ersatz

**Datum:** 2026-09-11
**Status:** Angenommen

### Kontext

ADR-0011 hat den Delta-Sync verworfen und die Frage zugleich terminiert: „Mit einem echten
Embedding (Etappe 3d) kostet es Geld je Zyklus, und dann wird der Delta-Sync zur ernsthaften
Frage — **er braucht dann eine eigene ADR**." Mit ADR-0015 steht der zweite Adapter, also ist
der Termin da. Das ist diese ADR.

Die Lage, in Zahlen: `synchronisiere` holt je Zyklus die vollständige Momentaufnahme, chunkt
sie und ersetzt die ganze Quelle. Bei `hash` kostet das nichts. Bei `voyage` kostet jeder
Zyklus die vollständige Einbettung — auch für Text, der sich seit dem letzten Zyklus um kein
Zeichen bewegt hat. Ein Notizenlaufwerk, das stündlich synchronisiert wird, bezahlt dasselbe
Dokument vierundzwanzig Mal am Tag.

Der Vorschlag, der sich damit aufdrängt, ist der Delta-Sync, und er wäre falsch gelesen. Die
Frage lautet nicht „Momentaufnahme oder Delta?", sondern: **was genau ist eigentlich teuer?**

### Entscheidung

**Die Momentaufnahme bleibt vollständig und der Ersatz atomar — ADR-0011 wird nicht
angerührt.** Gespart wird an genau einer Stelle: dem Einbettungsaufruf. Vor jedem Adapter
liegt ein Zwischenspeicher (`kernel/context/embedding/zwischenspeicher.js`), der Vektoren nach
**Art und Text** hält. Ein zweiter Zyklus über unveränderte Dokumente erreicht den Adapter
nicht mehr.

### Begründung

**Die Trennlinie liegt zwischen Vektor und Envelope, und nur dort.**

Ein Vektor ist eine reine Funktion des Textes. Er trägt **keine** Berechtigung — die steht in
der Envelope, und die kommt in jedem Zyklus frisch aus der Momentaufnahme. Einen Vektor
wiederzuverwenden heißt deshalb: eine Rechnung nicht zweimal bezahlen. Ein **Dokument**
wiederzuverwenden hieße: eine alte Berechtigung behalten. Das eine ist erlaubt, das andere
ist der Leckvektor, um den dieses Repo gebaut ist.

Genau daran scheitert der Delta-Sync und genau daran scheitert der Zwischenspeicher nicht.
Beim Delta-Sync hängt die Entzugszusage an der Korrektheit eines Deltas, und ein Entzug ist
der Fall, den eine Quelle am leichtesten verschweigt (ADR-0011). Beim Zwischenspeicher hängt
sie an nichts Neuem: `ersetzeQuelle` läuft unverändert über die vollständige Chunkliste, ein
Dokument, das aus der Momentaufnahme fällt, verschwindet weiterhin **strukturell** — sein
Vektor liegt dann zwar noch im Zwischenspeicher, aber ein Vektor ohne Chunk ist niemandes
Treffer.

**Der Preis wird an der richtigen Stelle bezahlt.** Teuer ist nicht der Ersatz — der ist eine
Speicheroperation und kostet Millisekunden. Teuer ist der Netzaufruf an ein Modell. Der
Delta-Sync hätte die billige Hälfte optimiert und dafür die teure Zusage aufgegeben.

**Metrik 3.14 misst weiter dasselbe.** Sie zählt, ob nach **einem** Synchronisationszyklus
noch ein Chunk eines entzogenen Dokuments auffindbar ist. Am Zyklus ändert sich nichts, nur
daran, wie viel er kostet.

### Alternativen

**Delta-Sync, wie die Branche ihn baut.** Verworfen, und zwar aus demselben Grund wie in
ADR-0011 — die Begründung ist nicht schwächer geworden, sondern stärker: der Zwischenspeicher
nimmt dem Delta-Sync sein einziges verbliebenes Argument. Er war nie wegen der Latenz
attraktiv, sondern wegen der Kosten, und die Kosten sind jetzt anders gelöst.

**Den Zwischenspeicher zwischen Store und Adapter legen** (also Chunks speichern statt
Vektoren). Verworfen — das wäre genau der Delta-Sync, nur unter anderem Namen: ein
zwischengespeicherter Chunk trägt seine Envelope mit, und ab da hängt die Entzugszusage
daran, dass jemand ihn richtig entwertet.

**Einen Hash über den Text als Schlüssel.** Verworfen. Ein Hash kann kollidieren, und eine
Kollision hieße: ein Chunk trägt den Vektor eines anderen — bei **richtiger Anzahl**, also
unterhalb jeder Prüfung des Ports und jeder Metrik dieses Repos. Chunks sind auf
`CHUNK_LAENGE` begrenzt; der Text selbst ist als Schlüssel bezahlbar, und er kollidiert nicht.

**Die Art aus dem Schlüssel lassen.** Verworfen, und das ist der Fehler, der am teuersten
gewesen wäre. Ein echtes Retrieval-Modell ist asymmetrisch (Voyage: `input_type`). Ohne die
Art bekäme die Frage den Dokumentvektor, und die Suche liefe in einem Raum, für den das
Modell nicht trainiert wurde. Es sähe aus wie schlechte Suchqualität, nicht wie ein Defekt.

**Den Zwischenspeicher als Option führen, nur für `voyage`.** Verworfen. Die Zusage „ein
zweiter Zyklus über unveränderte Dokumente fragt den Adapter nicht noch einmal" soll eine
Eigenschaft des **Systems** sein, keine der Konfiguration — sonst gilt sie in dem Lauf nicht,
in dem sie jemand vergessen hat. Für einen deterministischen Adapter ändert er nichts
Beobachtbares; abschalten lässt er sich mit `EMBEDDING_CACHE_MAX=0`.

### Konsequenzen

**Gewonnen.** Ein Synchronisationszyklus über unveränderte Dokumente kostet null
Einbettungen. Die Entzugszusage bleibt dort, wo ADR-0011 sie hingelegt hat: in der Struktur.
Und die Frage aus `docs/roadmap.md` §10 ist beantwortet, ohne eine Zusage einzutauschen.

**Eingehandelt: Speicher gegen Geld.** Der Zwischenspeicher hält Vektoren im Prozess. 5000
Einträge sind bei `voyage-4` (1024 Dimensionen) rund 40 MB. Die Zahl steht in
`EMBEDDING_CACHE_MAX`.

**Die Grenze, wörtlich.** Die Verdrängung ist FIFO. Ist die Arbeitsmenge **größer** als `max`,
ist jeder Eintrag verdrängt, bevor er wiederverwendet wird — die Trefferquote fällt dann auf
**null**, nicht auf „etwas weniger". Wer eine große Quelle fährt, hebt die Zahl oder zahlt
jeden Zyklus voll. Ein LRU verhielte sich bei diesem Zugriffsmuster (ein Durchlauf über
dieselbe Menge je Zyklus) genauso.

**Zweite Grenze: der Speicher ist prozesslokal.** Ein Neustart verwirft ihn, und zwei Prozesse
teilen ihn nicht. Das ist bewusst: ein geteilter Vektorspeicher wäre ein zweiter Leseweg neben
`store/index.js`, und der ist in ADR-0011 aus gutem Grund abgelehnt. Wer ihn überleben lassen
will, braucht eine eigene Entscheidung.

**Noch offen.** Ein Dokument, dessen **Text** gleich bleibt und dessen **Envelope** sich
ändert, wird nicht neu eingebettet — richtig so, der Vektor hängt nicht an der Berechtigung.
Aber dieser Satz ist nur wahr, solange keine Berechtigung je in den einzubettenden Text
gerät. Wer den Chunk-Text jemals um Metadaten anreichert, hebt diese ADR auf.

### Prüfkriterium

Drei Befehle, alle netzfrei:

```bash
node --test tests/embedding.test.js   # 21/21, darunter die Kapitalprobe
npm test                              # die Zahlen dürfen sich NICHT bewegen
npm run evals                         # ebenso: jede Metrik identisch
```

Stand 2026-09-11, ausgeführt:

- **`node --test tests/embedding.test.js` → 21/21, 0 gefallen.** Die Kapitalprobe fährt drei
  Zyklen: der zweite über unveränderte Dokumente erhöht `gefragt` um **null**, der dritte
  entfernt `d2` aus der Momentaufnahme und die Suche findet **keinen** Chunk mehr davon —
  obwohl sein Vektor noch im Zwischenspeicher liegt. Der vierte Zyklus mit neuem Text
  kostet wieder, sonst wäre der Speicher taub statt sparsam.
- **Vier Mutationen, vier Mal rot, alle zurückgenommen.** Art aus dem Schlüssel entfernt →
  „`dokument` und `anfrage` teilen KEINEN Eintrag" fällt. Teiltreffer auf `neue[0]` statt
  `neue[j]` gelegt → vier Tests fallen. Verdrängung abgeschaltet → die Kapazitätsprobe fällt.
  Prüfung der Teilantwort entfernt → ihr Test fällt. Eine Zusicherung, die nie rot wird,
  misst nichts.
- **`npm test` → 211 bestanden, 6 übersprungen, 0 gefallen** (vorher 202/6/0: +9 neue Tests,
  keine bewegte Zahl), Zeilendeckung 93,28 %.
- **`npm run evals` → jede Metrik identisch zum Lauf vor dieser Etappe.** 3.13 = 0 % (0/10
  und 0/16), 3.14 = 0 % (0/6), 28/28 und 32/32, beide Durchgänge identisch. Das ist das Tor:
  eine Ersparnis, die eine Zahl bewegt, ist keine Ersparnis, sondern eine Änderung.
- **`npm run demo` und `npm run demo:besprechung` → Rückgabewert 0**, ohne Schlüssel, ohne
  Docker. ESLint unverändert **15 Warnungen / 0 Fehler**.

---

## ADR-0017 — Eine Pflichtmetrik muss gemessen sein; die Ausnahme benennt die Domäne

**Datum:** 2026-09-16
**Status:** Angenommen

### Kontext

Das Urteil des Harness stand seit Etappe 2 in `evals/runners/policy.js` und lautete sechsmal
`metriken["3.x"].erfuellt !== false`. Dazu passte `kennzahl()` in `evals/metrics/index.js`:
ein Nenner von null ergibt `erfuellt: null`, denn eine ungemessene Metrik ist „weder bestanden
noch gefallen". Beides für sich richtig — zusammen eine Lücke.

Denn `null !== false` ist wahr. Eine Metrik, deren Fälle aus dem Golden-Datensatz
**verschwinden**, fällt auf Nenner null, wird `null` und kommt durch. Der Lauf endet mit
Rückgabewert 0.

Damit war die Messung gegen **Verschlechterung** geschützt und gegen **Abschaffung** nicht.
Eine entfernte Mandantenprüfung trieb 3.13 am 2026-09-09 auf 37,5 % und den Lauf auf
Rückgabewert 1 — das ist belegt. Gelöschte Leckfälle dagegen lieferten weiter grün. Von den
beiden Wegen, eine Zusage loszuwerden, war nur der laute verschlossen.

Das ist genau der Ausfall, gegen den dieses Repo gebaut ist: nicht der Absturz, sondern
„es läuft weiter, misst aber nichts mehr".

### Entscheidung

**Jede Pflichtmetrik muss gemessen UND erfüllt sein. Eine Ausnahme ist gültig, wenn die
Domäne sie benennt.**

1. Neues Pflichtfeld `ungemessen` im Eval-Adapter jeder Domäne (`evals/domains/index.js`),
   ein Objekt `{ "3.14": "Grund" }`. Keine Ausnahmen heißt `{}` — auch das eine Aussage.
2. Das Urteil prüft je Pflichtmetrik (3.1, 3.2, 3.3, 3.4, 3.13, 3.14):
   `erfuellt === true`, oder `erfuellt === null` **und** in `ungemessen` erklärt.
3. **Eine Erklärung, die nicht mehr zutrifft, ist selbst ein Befund.** Steht eine Metrik in
   `ungemessen` und hat trotzdem einen Nenner über null, wird der Lauf rot.
4. Jeder Befund nennt die Metrik, ihren Nenner und den Grund. Ein Urteil, das nur „rot" sagt,
   verschiebt die Arbeit nur.

### Begründung

**Die Asymmetrie war das Problem, nicht der Schwellenwert.** Kaputtmachen fiel auf, Abschaffen
nicht. Wer eine unbequeme Zusage loswerden wollte, brauchte den Filter nicht anzufassen — es
genügte, die Fälle zu löschen, die sie prüfen. Beide Wege müssen gleich laut sein.

**Ein pauschales `=== true` wäre falsch gewesen.** Die Domäne `beispiel` hat keinen Connector
(ADR-0004); ihr 3.14 ist mit Nenner 0 **zu Recht** ungemessen. Ein pauschaler Schwellenwert
hätte erzwungen, ihr einen Schein-Connector zu geben oder eine Ausnahme in den Runner zu
schreiben. Das erste verfälscht die Referenzdomäne, das zweite setzt Domänenwissen in den
Kern — die teuerste Entscheidung dieses Repos.

**Deshalb steht die Ausnahme bei der Domäne.** Ob eine Zusage hier messbar ist, ist eine
Aussage über die Domäne, nicht über die Mechanik des Harness. Dieselbe Linie wie
`src/kernel` / `src/domains`, eine Ebene höher — und dieselbe Begründung wie die explizite
Liste `DOMAENEN` statt eines Verzeichnis-Scans.

**Eine Erklärung muss verfallen können.** Bekäme `beispiel` eines Tages einen Connector, bliebe
der Eintrag stehen und deckte von da an genau den Ausfall wieder zu, gegen den er geschrieben
wurde. Eine Ausnahme, die ihre Begründung überlebt, ist schlimmer als keine: sie sieht geprüft
aus.

### Alternativen

**Pauschal `erfuellt === true`.** Verworfen, siehe oben: es hätte `beispiel` bestraft, obwohl
deren ungemessenes 3.14 der ehrliche Wert ist.

**Einen erwarteten Nenner je Metrik festschreiben.** Verworfen. Eine feste Zahl koppelt das
Urteil an die Größe des Datensatzes: jeder **hinzugefügte** Fall machte den Lauf rot. Eine
Regel, die Wachstum bestraft, wird umgangen statt befolgt.

**Den Nenner gegen den letzten Bericht halten.** Verworfen. Dann ist der vorige Lauf der
Richter, und eine langsame Erosion über viele Läufe bliebe unsichtbar — jeder Schritt wäre
klein genug. Außerdem setzte es voraus, dass der Bericht im Repo liegt; dass das bis zum
2026-09-16 nicht der Fall war, ist ein eigener Befund desselben Tages.

**Nur eine Prüfung im `projekt-doktor` (§9).** Verworfen als alleinige Maßnahme: sie meldet 🟡
und lässt den Rückgabewert unberührt. Eine CI kann darauf nicht aufsetzen, und ein Mensch muss
sie von Hand aufrufen. Sie bleibt als zweite, weichere Sicht bestehen.

### Konsequenzen

- **Jede neue Domäne trägt ein Feld mehr.** Fehlt `ungemessen`, wirft `ladeAdapter` — laut,
  nicht still. Das ist der Preis und zugleich der Zweck.
- **`beispiel` trägt genau einen Eintrag** (3.14), `besprechung` keinen.
- **Teilweises Löschen bleibt ungedeckt.** Verschwinden drei von fünf Leckfällen, sinkt der
  Nenner von 16 auf 10 und bleibt über null — der Lauf bleibt grün. Dagegen hilft keine
  Metrik, sondern eine Sperre auf den Golden-Dateien und ein zweites Augenpaar am Diff. Das
  gehört in die Zwangs-Schicht, nicht hierher, und ist offen.
- **`ladeAdapter` und `PFLICHTFELDER` stehen weiterhin in keinem Test.** Ein Test bräuchte
  eine Naht für eine erfundene Domäne; die gibt es nicht. Bekannt und benannt.

### Prüfkriterium

Der Befehl, von dem aus diese ADR geschrieben wurde: **Fälle löschen, der Lauf muss rot
werden.** Am 2026-09-16 ausgeführt, drei Mutationen, Dateien danach über `sha1sum` unverändert
zurück:

```bash
npm run evals                                  # unveraendert: Rueckgabewert 0
# retrieval.faelle der Domaene besprechung geleert:
#   🔴 3.13: ungemessen (Nenner 0) und in adapter.ungemessen nicht erklaert
#   Vertragstreue bleibt 25/25 gruen — rot kommt allein aus diesem Urteil
# entzug.faelle geleert:
#   🔴 3.14: ungemessen (Nenner 0) und in adapter.ungemessen nicht erklaert
# Erklaerung auf die falsche Metrik gesetzt:
#   🔴 3.13: als ungemessen erklaert, ist aber gemessen (Nenner 10) — veraltet
#   🔴 3.14: ungemessen (Nenner 0) und in adapter.ungemessen nicht erklaert
```

Vor dieser Entscheidung war **jede** dieser drei Mutationen grün. Dazu steht das Instrument
selbst seit demselben Tag unter Test (`tests/metriken.test.js`, fünf Fälle, drei Mutationen
belegt): `npm test` 222 bestanden, 0 gefallen, Abdeckung 96,40 %.

---

## ADR-0018 — Der Principal wird aufgelöst, nicht geglaubt: ein Port, ein Verzeichnis, eine befristete Antwort

**Datum:** 2026-09-20
**Status:** Angenommen

> **Diese ADR kommt nach ihrem Code.** Der Port liegt seit dem 2026-09-17 unversioniert im
> Arbeitsbaum und nennt im Dateikopf eine ADR-0018, die es nicht gab. Das ist die Schuld, die
> T2 des MVP-Schnitts einlöst — nachgeschrieben, nicht rückdatiert.

### Kontext

`istPrincipalAufloesbar` in `context/envelope.js` prüft die **Form**: Mandant da, Benutzer da,
Gruppen ein Array. Wer ein passend geformtes Objekt schickt, ist damit, wen er zu sein behauptet.
Seit T1 (ADR-0019) reist dieser Principal durch den Graphen und entscheidet, **was ein Agent
sieht** — die Behauptung ist also von einer Randnotiz zur Zugriffsentscheidung geworden. Genau
das macht ihre Auflösung fällig.

### Entscheidung

**Die Identität wird über einen Port aufgelöst, mit einer befristeten Antwort und ohne dass
dieses Repo Identitäten verwaltet.**

1. `governance/identitaet/index.js` ist der Port: ein Adapter kann genau eines —
   `aufloese(nachweis)` gibt einen Principal oder `null`. Er trägt einen `name`, weil der in
   den Bericht gehört: sonst ist ein Lauf gegen ein Testdouble von einem echten nicht zu
   unterscheiden.
2. `fixtures.js` ist der erste und bis auf Weiteres einzige Adapter: ein Verzeichnis als
   Tabelle, kein Netz, kein Schlüssel. Er trägt Schicht A und K5, wie `memory` beim Store
   (ADR-0013) und `hash` beim Embedding (ADR-0015).
3. Die Auflösung ist **befristet** (Voreinstellung fünf Minuten) und die Uhr ist einspeisbar.
4. **Ein negatives Ergebnis wird nicht zwischengespeichert.**
5. `vergiss(nachweis)` nimmt einen Eintrag sofort aus dem Speicher.
6. **Das Nicht-Ziel bleibt:** kein eigener Identitätsanbieter (`PRODUCT.md` §3.2). Hier
   entsteht kein Benutzer, kein Passwort, keine Gruppe — hier wird gefragt.
7. **Den Adapter und das Verzeichnis wählt der Kanal**, nicht der Kern. Es gibt noch **keinen**
   `aufbau.js` für Identität: ein Wähler zwischen einem einzigen Adapter wäre Gerüst für später,
   und der kommt mit dem zweiten Adapter.

### Begründung

**Warum überhaupt ein Zwischenspeicher.** Ohne ihn liegt bei jedem Lauf ein Netzaufruf auf dem
heißen Pfad, vor jeder Datenlogik.

**Warum ein befristeter.** Ein unbefristeter wäre der Fehler, den dieses Repo als 3.14 messbar
gemacht hat, eine Ebene höher: dort überlebt die KOPIE eines Dokuments die Berechtigung, hier
überlebte die Gruppenzugehörigkeit von gestern den Entzug von heute. Ein Entzug im Verzeichnis
muss innerhalb einer Sitzung wirken.

**Warum kein negatives Ergebnis im Speicher.** Wäre „nicht auflösbar" eine Zeile im
Zwischenspeicher, würde eine **Störung** des Verzeichnisses für die Dauer der Frist zu einer
Berechtigungsentscheidung — der Ausfall sähe aus wie ein Nein. Ein Nein muss teuer bleiben.

**Warum die Uhr einspeisbar ist.** Ein Test, der schläft, misst die Uhr und nicht die Regel.
Der Messpunkt ist ohnehin nicht der Principal, sondern die Zahl der Verzeichnis-Aufrufe: am
zurückgegebenen Objekt sieht man nicht, ob es frisch erfragt oder weitergereicht wurde.

**Warum noch kein echter Anbieter.** Die Lektion des Voyage-Adapters: ein Adapter, der nie gegen
den echten Dienst gelaufen ist, ist gebaut und nicht gemessen. Ein OIDC-Adapter ohne
erreichbaren Anbieter wäre dieselbe Schuld ein zweites Mal. Er kommt, wenn es etwas gibt, wogegen
er laufen kann (Etappe 7 und 11).

### Alternativen

**Den Principal weiter glauben.** Verworfen: seit T1 entscheidet er, was ein Agent liest. Eine
geglaubte Identität heißt dann, dass der Aufrufer seine Leseberechtigung selbst bestimmt.

**Unbefristet zwischenspeichern.** Verworfen, siehe Begründung — ein Entzug, der erst nach dem
Neustart wirkt, ist keiner.

**Die Auflösung im Kern erzwingen, statt sie dem Kanal zu geben.** Verworfen. Der Kern kennt
keinen Kanal; ein Zwang im Kern hieße, dass `beispiel` ohne Verzeichnis nicht mehr läuft, und
das kostet K5.

**Identitäten selbst verwalten.** Verworfen: ändert ein Nicht-Ziel und bringt Passwörter,
Sitzungen und Entzug in ein Repo, das ein Kontextlayer ist.

### Konsequenzen

- **Der Kanal verdrahtet.** Wer keinen Auflöser mitbringt, bekommt `principal = null` — und
  damit ein leeres Ergebnis mit Grund, nicht ein ungefiltertes (ADR-0008 F7). Fail-closed ist
  die Voreinstellung, nicht die Ausnahme.
- **Der HTTP-Rand löst nichts auf.** Er führt `beispiel`, und `beispiel` liest nichts
  (ADR-0004). Warum der MVP die Identität in den Terminalkanal legt und nicht an `/api/run`,
  steht im zweiten Nachtrag zu ADR-0019.
- **Der Harness löst ebenfalls auf.** Sonst wäre „aufgelöst statt geglaubt" verdrahtet und
  ungemessen — der Fall, den dieses Repo am häufigsten benennt.
- **Der Adaptername steht im Bericht** (`identitaetAdapter`), nicht im Dateinamen: die beiden
  Adapter im Namen sind die, die die **Zahlen** bewegen; dieser bewegt keine.
- **Ein kaputter Verzeichniseintrag fällt beim BAU auf**, nicht im Lauf. Ein Datenfehler, der
  erst im Lauf auffällt, sieht aus wie eine abgelehnte Identität.

### Prüfkriterium

```bash
npm test                 # tests/identitaet.test.js — 9 Faelle
# darunter, ohne zu warten: abgelaufener Eintrag wird NEU aufgeloest
#   (verzeichnisAufrufe 2 statt 1), negatives Ergebnis nie zwischengespeichert,
#   kaputter Verzeichniseintrag faellt beim Bau auf
npm run evals            # 3.13 unveraendert 0 % — die Aufloesung aendert die Zahl nicht,
                         # sie aendert, WOHER der Principal kommt
```

Dazu der Ende-zu-Ende-Fall in `tests/naht.test.js` und `BZ-3` im Golden-Datensatz: ein
**unbekannter Nachweis** ergibt ein leeres Ergebnis und **null LLM-Aufrufe**.

### Nachtrag vom 2026-09-20 · was T2 verdrahtet hat

`demo-besprechung.js` legt keinen Principal mehr vor, sondern einen **Nachweis**, und der Port
löst ihn auf; ein dritter Lauf mit unbekanntem Nachweis zeigt die Kante. Der Eval-Adapter baut
sein Verzeichnis als **Projektion** der Principale aus `acl.json` (`nachweis-<name>`), und der
Runner nimmt den Principal nur noch aus der Auflösung — der frühere direkte Zugriff auf die
Principal-Tabelle ist **entfernt**, damit es nicht zwei Wege gibt, an eine Identität zu kommen.
`BZ-3` prüft seither die Identitätskante statt eines von Hand missgestalteten Principals: der
Nachweis `nachweis-kaputt` steht in keinem Verzeichnis, weil ein missgestalteter Principal dort
gar nicht eingetragen werden **kann**.

---

## ADR-0019 — Der MVP ist ein Schnitt durch den Ausbauplan; sein erster Schritt ist die fehlende Naht

**Datum:** 2026-09-20
**Status:** Angenommen

### Kontext

Dieses Repo hat zwanzig Etappen und **keine MVP-Definition**. Das Wort steht an genau zwei
Stellen: in `data/kurumsal-ai-beyni-altyapi.md` §12.2, der Fassung des Ausgangstexts (Faz 1 —
drei bis vier Connectoren, pgvector, fünf bis zehn Aktionen über MCP, Genehmigung in Slack,
OTel, acht bis zwölf Wochen), und in `docs/roadmap.md` §8 als bewusste Abweichung davon.
Abgewichen wurde, **ersetzt wurde nie**. Ein Ausbauplan sagt, was als Nächstes kommt; ein MVP
sagt, was bewusst draußen bleibt. Das zweite fehlt, und solange es fehlt, ist jede Antwort auf
„läuft das Ding im Kern?" eine Meinung.

Beim Zuschneiden dieses Schnitts fiel am 2026-09-20 eine Lücke auf, die **keine Metrik dieses
Repos misst**. Vier Befunde, jeder per `grep` belegt:

- `kernel/retrieval/suche.js` — der gefilterte Leseweg — wird aus genau zwei Stellen
  aufgerufen: `src/bin/demo-besprechung.js` und dem Eval-Harness. **Aus keinem Agentenknoten.**
- `principal` kommt im Agentenlayer nicht vor: nicht in `agent/schema.js`, nicht in
  `agent/runner.js`, in keinem Knoten. Der Graph **kann** keinen Principal tragen.
- `domains/besprechung/agents/extrahierer.js` holt die Notiz-Id über einen regulären Ausdruck
  aus `state.task` (`NOTIZ_MUSTER`) und fragt dann das Modell. Der Speicher wird nie berührt.
- `/api/run` nimmt `task` und sonst nichts. Am Rand gibt es keine Identität.

Damit ist der Satz, der dieses Repo beschreibt — Wissen wird samt seinen Berechtigungen
aufgenommen, **berechtigungstreu abgefragt** und in menschlich genehmigte Aktionen
**überführt** (ADR-0001) — heute **zwei Beweise nebeneinander statt einer Kette**: 3.13 und
3.14 messen den Leseweg, 3.1 und 3.2 messen die Genehmigung, und zwischen beiden liegt keine
Naht. Ein Agent kann einen Entwurf über eine Notiz schreiben, die der Fragende nicht sehen
darf, und 3.13 bleibt dabei bei 0 % — weil der Agentenpfad nicht in ihrem Nenner ist.
`demo-besprechung.js` zeigt dieselbe Trennung offen: Teil 1 und 2 fragen als Principal, Teil 3
startet den Ablauf ohne einen.

### Entscheidung

**Der MVP ist ein Schnitt durch `docs/roadmap.md`, kein eigener Plan — vier Schritte, deren
erster die fehlende Naht schließt.**

- **T0** — diese ADR, die Grenze in `ARCHITECTURE.md` §4 und ein Abschnitt in `PRODUCT.md` §7.
  Kein Code.
- **T1 · die Naht** — `principal` wird ein Feld des Graphzustands, und der `extrahierer` holt
  seine Notiz über `suche({ store, principal })` statt über einen regulären Ausdruck auf
  `state.task`. Der Principal bleibt zunächst eine **Behauptung** des Aufrufers: dieselbe
  Vertrauensstufe, die der Leseweg heute schon hat, eine Ebene höher.
- **T2 · Identität am Rand** — `/api/run` nimmt einen Nachweis, der Port aus
  `governance/identitaet/` löst ihn auf. ADR-0018 wird nachgeschrieben, die beiden
  unversionierten Dateien kommen ins Repo.
- **T3 · die menschliche Hand** — die Genehmigung kommt vom Menschen, nicht aus dem Skript:
  ein im Terminal anhaltender Durchlauf. `npm run demo` bleibt unberührt, es ist K5.

**Draußen bleibt, bis der MVP steht:** echte Quelle (Etappe 7), echte Wirkung (10), Postgres
als Voreinstellung, der Voyage-Lauf, Schicht B, Schicht C, Policy und Risikoklasse (4c), die
Audit-Kette (4d), Genehmigung in Slack oder Teams (11), Graph (13), MCP, Autonomie (14) — und
die Disziplinschulden `express` 5, E0-B, `projekt-doktor` §12. Die einzige Ausnahme ist die
**CI**: sie ist geschrieben und wird in T3 einmal grün gesehen, weil sie das ist, was den
Boden davor bewahrt, still zu brechen.

### Begründung

**Die Naht ist der billigste Schritt mit dem größten Beweis.** Sie fügt keine Fähigkeit hinzu;
sie verbindet zwei Hälften, die beide schon gemessen sind. Danach beantwortet **ein** Durchlauf
die Frage, für die man heute zwei Berichte und ein Zugeständnis braucht.

**Warum die Naht vor der Identität kommt.** Ohne Naht gibt es nichts, was einen aufgelösten
Principal tragen könnte — die Auflösung ginge ins Leere. Und die Reihenfolge ist in diesem Repo
schon einmal so entschieden worden: Etappe 2 hat die Autorisierung gegen **regelabgeleitete
Principals aus Fixtures** gemessen, lange vor jeder echten Identität, und `docs/roadmap.md`
sagt dasselbe für 4b ausdrücklich.

**Warum ein Schnitt und kein eigenes Dokument.** Ausgangstext, Ausbauplan und MVP wären drei
Pläne und damit drei Wahrheiten; nach wenigen Wochen widersprechen sie sich, und keiner merkt
es. Der MVP ist eine Aussage über den **Umfang** — er gehört deshalb in das Dokument, das den
Umfang trägt.

**Warum der MVP des Ausgangstexts nicht übernommen wird.** Drei bis vier Connectoren, MCP,
Slack, OTel: keiner dieser Punkte macht eine Aussage messbar, die heute eine Vorhersage ist.
ADR-0010 hat bereits entschieden, dass eine schwere Quelle mehr lehrt als drei leichte.

### Alternativen

**Den MVP als „einsatzfähig" definieren** — 4a, 4b, 4d, 7, 9, 10. Am 2026-09-20 ausgeschrieben
und verworfen: das ist der zweite Stock. Die Naht käme darin als Nebensache vor, und ein
Fundament, dessen tragende Fuge nebenbei entsteht, ist keines.

**Zuerst die Identität, dann die Naht.** Verworfen: ein aufgelöster Principal, den kein Ablauf
weiterträgt, ist eine Auflösung ins Leere. Die Reihenfolge wäre umgekehrt teurer, weil T1 das
Zustandsschema ohnehin anfasst.

**Eine eigene `docs/mvp.md`.** Verworfen, siehe Begründung: dritte Wahrheit.

**Die Naht sofort beheben, ohne ADR.** Verworfen. Sie ändert das Zustandsschema des Kerns und
den **Nenner** von 3.13; eine Änderung, die einen Nenner bewegt, ohne dass irgendwo steht,
warum, macht jeden späteren Vergleich mit den Berichten davor ungültig.

### Konsequenzen

- **Der Nenner von 3.13 wächst in T1.** Die Zahl soll 0 % bleiben, aber sie misst danach zwei
  Wege. Ein Vergleich mit Berichten von vor T1 ist nur unter Nennung beider Nenner gültig.
- **`ARCHITECTURE.md` §4 trägt die Grenze**, bis T1 sie schließt. Eine verschwiegene Grenze
  wird zu einem Ausfall.
- **Bis T2 bleibt der Principal eine Behauptung**, im Leseweg wie im Agentenpfad. Bewusst und
  benannt, nicht übersehen.
- **`beispiel` bekommt die Naht nicht.** Sie hat keinen Connector (ADR-0004) und bleibt die
  Referenzdomäne von K5. Die Naht entsteht in `besprechung`, der Vertikalen aus ADR-0010.
- **Der MVP endet nach T3.** Was danach kommt, wird nach einem Kriterium gewählt und nicht aus
  einer Liste abgelesen: **welche Aussage dieses Repos ist heute noch eine Vorhersage.**

### Prüfkriterium

Heute, **vor** T1 — beide Befehle belegen die fehlende Naht, beide am 2026-09-20 ausgeführt und
beide leer (Rückgabewert 1):

```bash
grep -rn "suche" src/domains/*/agents/   # leer: kein Agent liest ueber den gefilterten Weg
grep -rn "principal" src/kernel/agent/   # leer: der Graph kann keinen Principal tragen
```

🔴 **Nach T1 müssen beide Treffer haben** — und das genügt nicht, denn Treffer sind keine
Wirkung. Das Tor des MVP, Schritt für Schritt, offen:

```bash
npm test && npm run evals && npm run demo && npm run demo:besprechung
# T1  unberechtigte Notiz -> KEIN Entwurf, nichts in der Queue; 3.13 = 0 % bei GROESSEREM Nenner
# T1  Mutationsprobe: `principal` aus dem Suchaufruf des Agenten entfernen -> 3.13 MUSS rot werden
# T2  nicht aufloesbarer Nachweis -> leeres Ergebnis und NULL LLM-Aufrufe
# T3  Ablehnung von Hand -> Queue leer; Genehmigung von Hand -> genau eine Aktion
```

Die Mutationsprobe in T1 ist die eigentliche Prüfung. Bleibt 3.13 nach dem Entfernen des
Principals grün, ist die Naht gelegt, aber nicht gemessen — und dann gilt für sie dasselbe wie
für den Voyage-Adapter: gebaut ist nicht gemessen.

### Nachtrag vom 2026-09-20 · T1 ist eingelöst, und eine Annahme darin war falsch

**Was T1 geändert hat.** `principal` ist ein Kernfeld des Graphzustands mit dem neuen Reducer
`einmalGesetzt` — der erste nicht-leere Wert gewinnt, damit die Identität innerhalb eines Laufs
nicht tauschbar ist. `startWorkflow` nimmt ihn an. Der `extrahierer` der Domäne `besprechung`
holt seine Notiz über den gefilterten Leseweg, bekommt sie nicht, wenn der Principal sie nicht
sehen darf, und fragt in diesem Fall **kein Modell**. Die Herkunft eines Tickets kommt seither
aus dem Leseweg und nicht mehr aus der Antwort des Modells. Der Speicher liegt in
`domains/besprechung/leseweg.js` **neben** dem Zustand, nicht darin: der Checkpointer
serialisiert den Zustand, und ein Chunk-Speicher darin hieße, Inhalte samt Envelopes in ein Log
zu schreiben, das keine Berechtigung kennt.

**DIE FALSCHE ANNAHME.** Der Plan sagte „der `extrahierer` holt seine Notiz über
`suche({ store, principal })`" — also über die Relevanzsuche. Beim ersten Lauf kam sie nicht:
`memory` verwirft Chunks mit `wert = 0`, und ein Hash-Embedding (ADR-0007) sagt über Relevanz
nichts. Eine **berechtigte** Notiz wäre damit „nicht sichtbar" gewesen, weil sie schlecht
bewertet wurde — die Rangfolge hätte über die Berechtigung entschieden. Hätte der
Golden-Datensatz das durch passend gewählte Aufgabentexte ausgeglichen, wäre die Erwartung an
die Implementierung angepasst worden: genau der Fehler, den dieses Repo Erwartung-an-roten-Lauf
nennt.

**Deshalb hat der Leseweg jetzt zwei Kippen statt einer zweiten Methode.** Ohne `dokumentId`
die Relevanzsuche; mit `dokumentId` der gezielte Abruf: alle sichtbaren Chunks genau dieses
Dokuments, in Absatzreihenfolge, ohne Relevanz und ohne `k`. Eine zweite Lesemethode wäre eine
zweite Stelle, an der man die fail-closed-Kante vergessen kann — beide Kippen gehen durch
dieselbe Kompilierung desselben Regelwerks (ADR-0014). **Relevanz darf ordnen; ausschließen
darf nur die ACL.**

**Der Nenner von 3.13 trägt jetzt den Agentenpfad** (50 statt 16 Chunks in `besprechung`).
Draußen bleiben die Entzugsfälle: ihre Lieferungen beurteilt 3.14 phasenweise, und dieselbe
Evidenz in zwei Metriken hieße, dass ein Defekt zwei Zahlen bewegt.

**Belegt — ausgeführt, nicht behauptet:**

```bash
npm test                     # 243/249, 0 gefallen, 6 uebersprungen (ohne Docker)
DATABASE_URL=... npm test    # 250/250, 0 uebersprungen — auch der gezielte Abruf gegen pgvector
npm run evals                # 3.13 = 0 % bei Nenner 50 (vorher 16) · Vertragstreue 35/35
DATABASE_URL=... npm run evals:postgres   # beide Berichte nach Abzug von `erzeugt` und
                                          # `storeAdapter` ZEICHENGLEICH (1760 Zeichen)
npm run demo                 # Exit 0 — K5 unberuehrt
grep -rn "suche" src/domains/*/agents/    # jetzt TREFFER (vorher leer)
grep -rn "principal" src/kernel/agent/    # jetzt TREFFER (vorher leer)
```

**Die Mutationsprobe, die aus der Naht eine Messung macht.** Im Suchaufruf des Agenten
`state.principal` durch ein Dienstkonto ersetzt (`gruppen: ["technik", "leitung"]`) — der
klassische Defekt „der Agent läuft als Servicekonto":

```
Unauthorized-Retrieval-Rate   7,4 %  (4/54)        → Rueckgabewert 1
Vertragstreue                 33/35
  🔴 BZ-1  LECK im Agentenpfad: 2 unerlaubte Chunks aus [n-archiv]
  🔴 BZ-3  LECK im Agentenpfad: 2 unerlaubte Chunks aus [n-offen]
```

Zwei unabhängige Kanäle melden denselben Defekt: die Metrik und die Vertragstreue. Danach
zurückgenommen, die Datei über `sha1sum` unverändert
(`17c0e15ae743aa958a8ced502891518e38d82182`), alle Zahlen wieder wie oben.

**Was T1 NICHT getan hat.** Der Principal ist weiter eine **Behauptung** des Aufrufers — das
ist T2. Und der Agent liest nur die Notiz, die die Aufgabe **nennt**; ein Knoten, der von sich
aus recherchiert, ist an einen Auslöser gebunden (`docs/roadmap.md` §5, Etappe 6). `beispiel`
bleibt ohne Naht und trägt weiter K5.

### Nachtrag vom 2026-09-20 (2) · T2 sitzt im Terminalkanal, nicht an `/api/run`

**Was entschieden wurde.** T2 bringt die Identität in den **Terminalkanal** — nicht an
`/api/run`, wie die Entscheidung oben es formulierte. Der HTTP-Rand bleibt unberührt.

**Warum.** Der Rand führt heute an sechs Stellen fest `beispiel`
(`adapters/http/server.js` 37–41, 96, 98 und `bin/serve.js` 8). Und `beispiel` hat keinen
Connector (ADR-0004), liest also nichts: ein Principal hat dort **nichts zu entscheiden**. Die
Identität an einen Rand zu hängen, der eine Domäne ohne Leseweg führt, hätte eine Auflösung
erzeugt, die niemand benutzt — gebaut und nicht messbar, genau die Schuld, gegen die der
MVP-Schnitt geschnitten ist. Zugleich ist der Kanal des MVP ohnehin das Terminal: T3 legt die
menschliche Genehmigung in einen anhaltenden Durchlauf, nicht in einen Browser.

**Die verworfene Alternative** ist nicht falsch, nur später: den Rand die Domäne **wählen**
lassen (Domäne als Parameter, Artefakt- und Queue-Zugriff aus der Domänenspezifikation statt aus
einem festen Import). Das ist die saubere Fassung — sie ändert aber den Vertrag der
Domänenspezifikation und braucht ihre eigene ADR. Sie kommt, wenn der Rand wirklich zwei Domänen
führen soll, und nicht vorher.

**Was dadurch offen bleibt und benannt ist:** über HTTP ist die Vertikale mit Naht **nicht
erreichbar**, und der Rand löst keine Identität auf (`ARCHITECTURE.md` §4). Gefährlich ist das
nicht: ohne Principal antwortet der Leseweg leer und mit Grund. Es ist eine Lücke in der
Reichweite, keine in der Zusage.

### Nachtrag vom 2026-09-20 (3) · T3: die Hand am Tor — und der eine Teil, der offen bleibt

**Was T3 gebaut hat.** `src/bin/fragen.js`, der Kanal des MVP: er löst eine Identität auf (T2),
startet den Lauf, hält beim Entwurf an, zeigt ihn und lässt den **Menschen** entscheiden. Er
tritt **neben** die beiden bestehenden Einstiegspunkte — `npm run demo` bleibt unberührt, weil es
K5 ist, und `demo-besprechung.js` bleibt die Vorführung, die sich selbst genehmigt.

**Die Regel dieses Kanals, aus der Regel am HTTP-Rand übersetzt.** Nur `ja` oder `j` genehmigt,
und daraus entsteht ein echtes Boolean. Alles andere lehnt ab — ein Tippfehler, eine leere
Zeile, ein Ende der Eingabe und ausdrücklich auch `true`. Gefragt wird **einmal**: eine Schleife
„bitte nochmal" könnte bei beendeter Eingabe nie enden, und ein Tor, das hängt, ist keines.
Nachgezogen in `docs/security-model.md`, wo die Regel je Kanal steht.

**Warum der Kanal aus einer Pipe lesen kann.** Ein Tor ist ein Befehl. Ein Einstiegspunkt, der
nur am Terminal eines Menschen funktioniert, wäre eine Vorführung — messbar wird er erst, wenn
`printf` ihn fahren kann. Deshalb liest er bei fehlendem TTY die Eingabe vorher ganz und
verbraucht sie zeilenweise, und deshalb endet er mit einer **maschinenlesbaren Zeile** (dieselbe
Form wie die Fixtures der Persistenzprüfung).

**Belegt — ausgeführt, nicht behauptet:**

```bash
printf 'nachweis-dora\n\nnein\n' | npm run fragen   # Entwurf AWAITING_APPROVAL · Queue 0
printf 'nachweis-dora\n\nja\n'   | npm run fragen   # Entwurf ZUGESTELLT · Queue 1 TICKET_ANLEGEN
npm test                                            # 252/259, 0 gefallen, 7 uebersprungen
                                                    # Abdeckung 96,79 %
```

`tests/kanal.test.js` fährt fünf Fälle als **Prozess von außen**: Ablehnung, Genehmigung, die
Strenge des Parsers (`true`, `yes`, `jaa`, `1`, leer — alle lehnen ab), ein unbekannter Nachweis
(an der Tür abgelehnt, kein Lauf) und eine unberechtigte Notiz (der Mensch wird **gar nicht**
gefragt). Ein Test, der `resolveApproval` selbst aufriefe, hätte genau die Zeile ersetzt, um die
es geht.

**Mutationsprobe.** Parser auf „alles genehmigt" (`antwort !== undefined`): **zwei der fünf
Fälle fallen** — die Ablehnung und die Strenge —, die Genehmigung bleibt zu Recht grün.
Zurückgenommen, `sha1sum` unverändert (`a61332e0…`).

**Der dritte Teil des Tors, am selben Tag eingelöst.** Er verlangte einen Commit und einen
Push, und beides tut dieser Agent nicht ohne ausdrückliche Aufforderung
(`~/.claude/CLAUDE.md`) — es wäre auch die falsche Reihenfolge: die Zwangs-Schicht existiert,
damit ein Mensch am Diff vorbeikommt, nicht damit ein Agent sich selbst freigibt. Auf
Aufforderung gingen fünf Commits hinaus (und neun ältere, die seit dem 2026-09-16 unversendet
lagen — darunter die CI selbst, weshalb dies ihr **erster Lauf überhaupt** war).

**Ergebnis: alle drei Jobs grün, keiner übersprungen** — `Schicht A` ohne Schlüssel und ohne
Datenbank (npm ci · test · evals · beide Demos), `Postgres` mit pgvector als Dienst
(`evals:postgres` und `npm test` gegen die Datenbank, also 259/259 statt 252 und 7
übersprungen) und `Lint und Abhängigkeiten` (`eslint .`, `npm audit --audit-level=high`).
Lauf `35524547434` auf `3449676`.

**Damit ist der MVP-Schnitt zu Ende.** Und die wichtigste Zeile daran ist nicht das Grün,
sondern wo es entstanden ist: bis heute hing jede Prüfung dieses Repos daran, dass der Agent
sie ausführt und ehrlich berichtet. Seit diesem Lauf tut es eine Maschine, die nicht er ist.
