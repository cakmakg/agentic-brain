# EXTEND

Wie dieses Gerüst wächst — in der Reihenfolge, in der es billig bleibt.

Die Regel dahinter: **jede Schicht wird erst gemessen, dann erweitert.** Wer zwei Schichten
gleichzeitig baut, kann später nicht mehr sagen, welche die Zahl bewegt hat.

---

## Schritt 1 — Eine eigene Domäne

Der häufigste erste Schritt. Er ändert **null Zeilen** unter `src/kernel/`.

```bash
cp -r src/domains/beispiel src/domains/<deine-domäne>
```

Dann der Reihe nach:

1. **`domain.js`** — die vier Stellen der Naht:
   - `stateFields`: die Felder deiner Domäne. **Die Reducer-Wahl ist eine fachliche
     Aussage:** Datenfelder mit Leer-Schutz (`keepIfFilled`), Entscheidungsfelder mit
     „letzter Wert gewinnt" (`lastWins`), Zähler mit `sum`.
   - `brakes`: die Bremsen **in ihrer Reihenfolge**. Die Reihenfolge ist die Aussage.
     Die HITL-Bremse gehört **vor** jede Datenlogik.
   - `guardrailRules` und die Schwellen.
   - `nodes`, `entry`, `hub`, `spokes`, `terminal`.
2. **`agents/`** — je Knoten eine Datei, je Knoten **eine** Verantwortung.
3. **`prompts.js`** — alle Prompts an einer Stelle. Ein versteckter Prompt wird beim Messen
   übersehen.
4. **`actions.js`** — die Whitelist. Was nicht darauf steht, kann kein Agent auslösen.
5. **Registrieren:** der Import von `domain.js` registriert sie. Der Adapter wählt sie.

Dann messen:

```bash
cp -r evals/domains/beispiel evals/domains/<deine-domäne>
# evals/domains/index.js: DOMAENEN erweitern
# golden/tasks.json: Erwartungen AUS DEN REGELN ableiten, nicht aus einem Lauf
npm test && npm run evals
grep -rn "<deine-domäne>" src/kernel/    # muss leer sein
```

---

## Schritt 2 — Ein QA-Tor (Revisionsschleife)

Die Domäne `beispiel` hat bewusst keins. Es ist die erste Erweiterung, die sich lohnt.

- Ein **zweiter Spoke** `pruefer`, mit strukturierter Ausgabe: `{ istFreigegeben, gruende }`.
- Ein State-Feld `istFreigegeben` mit `lastWins` — **nicht** mit Leer-Schutz.
- Zwei Bremsen statt einer:
  - `ergebnis && istFreigegeben == null` → `pruefer` (**ungeprüft**)
  - `ergebnis && istFreigegeben === false` → `bearbeiter` (**abgelehnt**, Revision)

> **Der klassische Fehler an genau dieser Stelle:** `null` und `false` gleich behandeln.
> Dann ruft der Prüfer sich endlos selbst auf, bis das Rekursionslimit greift. `null` heißt
> „ungeprüft", `false` heißt „abgelehnt" — das sind zwei verschiedene Zustände.

Trenn Produzent und Prüfer strikt. Sagst du demselben Modell „schreib und kritisiere dich
selbst", findet es seine eigene Arbeit gut.

Der Zähler `revisionCount` wächst dadurch wirklich, und der Schutzschalter (Bremse 3) wird
scharf. Prüf das mit einem Fall im Datensatz, dessen Erwartung `bearbeiterAufrufe: 2` lautet.

---

## Schritt 3 — Schicht B (Qualität)

Erst sinnvoll, wenn ein **Ausgabevertrag** existiert: N prüfbare Bedingungen. Siehe
`EVALS.md` §5. Die Messschleife steht bereits; du lieferst `schreibe`, `pruefe` und den
Runner.

Kostet Geld. Setz `maxUsd`, bevor du startest, und fahr erst einen einzelnen Fall.

---

## Schritt 4 — Ein zweiter Kanal

Heute gibt es einen Adapter: HTTP. Ein zweiter (etwa MCP) tritt **daneben**, nicht darüber:
gleicher Kern, gleiche Runner, nur eine andere Übersetzung.

Die Frage, die vorher zu entscheiden ist: **darf der neue Kanal genehmigen?** Ein
Werkzeugaufruf, der `approve` anbietet, gibt die HITL-Zusage an ein Modell zurück. Wenn du
ihn anbietest, schreib eine ADR darüber — nicht nur einen Kommentar.

---

## Schritt 5 — Mehrere Mandanten

Das Feld `tenantId` steht vom ersten Schema an da, und **jede** Lesung filtert danach — auch
solange es genau einen Mandanten gibt. Eine Abfrage ohne Mandantenfilter gilt als Defekt.

Deshalb kostet der Übergang zu mehreren Mandanten später keine einzige Abfrage. Das ist der
ganze Grund, warum das Feld heute schon da ist.

---

## Schritt 6 — Ein echter externer Aufruf

Im Action-Worker steht der Aufruf heute als Kommentar. Wer ihn einsetzt, erbt drei Dinge:

- **Idempotenz.** Sie ist da (Schlüssel + Dedup-Index, überlebt einen Neustart) — aber sie
  trägt nur, wenn dein Schlüssel den **Vorgang** meint, nicht den Text.
- **Ein hartes Timeout.** Ein Aufruf ohne Timeout blockiert den Worker.
- **Der Zustand `PROCESSING` wandert bewusst nicht ins Log.** Stirbt der Prozess mitten im
  Aufruf, kommt die Aktion als `PENDING` zurück und wird erneut versucht — die Idempotenz
  trägt ihn.

---

## Was du nicht tun solltest

- **Domänenwissen in den Kern schreiben.** Der `grep` oben ist die Grenze. Er ist billig;
  lauf ihn nach jeder Erweiterung.
- **Eine Erwartung an einen roten Lauf anpassen.** Damit ist die Messung abgeschafft, und
  alles bleibt grün.
- **Zwei Defekte in einem Zug beheben.** Dann ist nicht mehr feststellbar, welcher die Zahl
  bewegt hat.
- **Die HITL-Entscheidung einem Modell überlassen.** Sie gehört in eine deterministische
  Bremse, vor jeder Datenlogik.
- **Eine Zahl in ein Dokument schreiben, die aus keinem Lauf stammt.**
