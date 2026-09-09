# Ingenieursdisziplin

> **Was dieses Dokument ist.** `docs/roadmap.md` beschreibt, **was** gebaut wird.
> Dieses Dokument beschreibt, **wie** gebaut wird — und zwar so, dass die Art des Bauens
> selbst überprüfbar ist.
>
> **Der Satz, aus dem alles folgt:** eine Regel, die kein Befehl prüft, ist eine Meinung.
> `.gehirn/regeln.md` trägt heute elf Regeln als **Prosa**. Prosa wird gelesen, wenn jemand
> daran denkt. Dieses Dokument überführt jede mechanisierbare Regel in einen Prüfer und
> markiert die übrigen ausdrücklich als **nicht mechanisierbar**.
>
> Der Anlass ist kein Verdacht, sondern eine Messung: §1 listet sieben geprüfte Befunde.
> Zwei davon sind Regeln, die schriftlich gelten, verletzt sind — und **keinen einzigen Test
> rot gemacht haben**.

---

## 1. Befunde

Jeder Befund wurde **ausgeführt**, nicht aus dem Code gelesen. Der Befehl steht daneben,
damit er wiederholbar ist.

| #   | Befund                                                                                                                                                                                                                      | Prüfbefehl                                                       | Bewertung                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| B1  | `process.env` steht an **drei** Stellen außerhalb von `kernel/config/env.js`: `governance/trace.js:31`, `persistence/store.js:34`, `persistence/store.js:38`. **Korrigiert am 2026-09-08** — siehe Kasten unter der Tabelle | `grep -rn "process\.env" src/ \| grep -v "kernel/config/env.js"` | 🟠 Nicht Verfall, sondern ein doppelt geführter Variablenname        |
| B2  | `zod` wird in **1 von 27** Dateien benutzt (`domains/beispiel/domain.js`, für die strukturierte LLM-Ausgabe). Der HTTP-Rand parst nicht                                                                                     | `grep -rln "from \"zod\"" src/`                                  | 🔴 „Parse, don't validate" ist heute eine Absicht, keine Praxis      |
| B3  | Kein Lint, kein Formatter, kein Hook, keine Typprüfung. **Null** devDependencies                                                                                                                                            | `ls \| grep -iE "eslint\|prettier\|lefthook\|tsconfig"`          | 🔴 Die einzige echte Werkzeuglücke des Repos                         |
| B4  | `@langchain/langgraph` ist auf **0.2.74** gepinnt, die Registry führt **1.4.14**. `@langchain/anthropic` 0.3.24 gegen 1.5.9                                                                                                 | `npm view @langchain/langgraph version`                          | 🟢 Eingelöst in Etappe 0c: 1.4.14 (ADR-0003)                         |
| B5  | Die Trennlinie hält: kein Domänenname im Kern                                                                                                                                                                               | `grep -rn "beispiel" src/kernel/` → 0                            | 🟢 Grün, aber nur von Hand geprüft                                   |
| B6  | `PRODUCT.md` trägt noch 9 Vorlagenmarken; §1 bis §4 sind leer                                                                                                                                                               | `grep -c "VORLAGE\|<!-- " PRODUCT.md` → 9                        | 🟠 Tor der Etappe 0 in `roadmap.md`                                  |
| B7  | 11 Schwachstellen (6 hoch, 5 mittel) — **keine** aus den Werkzeugen dieser Etappe, alle aus den Produktionsabhängigkeiten. Darunter „LangChain serialization injection enables secret extraction"                           | `npm audit`                                                      | 🟢 Nach Etappe 0c `high: 0`; zwei mittlere aus `express` 4.x bleiben |

> **Korrektur zu B1, eingetragen am 2026-09-08.** Die erste Fassung nannte die drei Stellen
> „Verfall einer Konvention". Das Lesen des Codes hat das Urteil gedreht: alle drei sind
> **dokumentierte Absicht**. `env.js` nennt `TRACE_DIR in governance/trace.js` in einem
> eigenen Kommentar, und über den beiden Stellen in `store.js` steht, warum dort bei JEDEM
> Aufruf gelesen wird statt beim Modul-Laden — sonst fröre die Import-Reihenfolge den Ort
> ein und ein Test, der `STATE_DIR` später setzt, schriebe still ins falsche Verzeichnis.
>
> Der Mangel ist ein feinerer: der **Variablenname** lebt dadurch an zwei Orten
> (`STATE_DIR` in `env.js` und in `store.js`), und `TRACE_DIR` steht in `env.js` überhaupt
> nur im Kommentar. Die Zusage „auf die Frage, welche Umgebungsvariablen es gibt, genau eine
> Antwort" hält damit nicht wörtlich. **E0-C behebt das mit spätbindenden Zugriffsfunktionen,
> nicht durch Löschen der Stellen.**
>
> Der Vorgang selbst ist die Lehre: der Prüfbefehl hat die Stellen gefunden, aber erst das
> Lesen hat sie richtig eingeordnet. Ein Befund ist ein Fund, kein Urteil.

**Was B2 und B3 gemeinsam haben:** beide sind schriftlich geregelt, beide sind verletzt,
und **kein einziger Test wurde rot**. Genau das ist der Ausfall, gegen den dieses Repo
gebaut ist — es läuft, aber es leistet an dieser Stelle nichts.

---

## 2. Die vier Werkzeuge

Jedes trägt genau eine Frage. Mehr Werkzeuge als Fragen zu haben ist ein Fehler, kein
Vorteil.

| Werkzeug                       | Frage                         | Wird `error` bei                                     |
| ------------------------------ | ----------------------------- | ---------------------------------------------------- |
| **ESLint** (flat config)       | Ist diese Zeile erlaubt?      | Randverletzung, verlorene Promise, zu große Funktion |
| **dependency-cruiser**         | Darf diese Datei jene kennen? | `kernel → domains`, Zyklus, Port kennt Adapter       |
| **`tsc --noEmit`** (`checkJs`) | Stimmen die Typen?            | Typfehler in einer Datei mit `// @ts-check`          |
| **knip**                       | Wird das noch gebraucht?      | toter Export, tote Datei                             |

Dazu **Prettier** und **lefthook** — sie prüfen nichts, sie liefern nur aus. Sie stehen
bewusst nicht in der Tabelle.

**Nicht eingeführt: Biome.** Biome ersetzt ESLint _und_ Prettier. Beides zugleich zu fahren
heißt, zwei Wahrheitsquellen für dieselbe Frage zu haben. Entweder — oder; hier: ESLint plus
Prettier, weil die Regeln unten typgestützt sein müssen.

---

## 3. Schichten sind eine Regel, kein Ordner

Die teuerste Entscheidung dieses Abschnitts, weil sie sich später nicht billig zurücknehmen
lässt.

Es gibt in `src/` **eine** Achse, und die steht bereits: `kernel` (Mechanik) gegen `domains`
(Bedeutung). Sie beantwortet die Frage _wem gehört die Bedeutung_. Die hexagonale Achse —
Rand, reine Logik, Anwendungsfall, Adapter — beantwortet eine **andere** Frage: _wie weit weg
von IO_. Die beiden stehen senkrecht zueinander.

**Deshalb wird die hexagonale Achse nicht als Ordner auf oberster Ebene eingeführt.** Sie
lebt **innerhalb** eines Moduls und wird durch Regeln erzwungen:

```
kernel/context/
  store/index.js        · Port          (Anwendungsfall)
  store/memory.js       · Adapter       (Infrastruktur)
  store/postgres.js     · Adapter       (Infrastruktur)
  retrieval/filter.js   · reine Logik   (kein IO, kein Import aus store/)
  ingest/pipeline.js    · Anwendungsfall
```

Die Regel, nicht der Ordner, hält das zusammen:

```
*/store/index.js         ✗→  */store/*.js        (ein Port kennt seine Adapter nicht)
**/retrieval/filter.js   ✗→  node:fs, node:http  (reine Logik sieht kein IO)
src/kernel/**            ✗→  src/domains/**      (die Trennlinie)
```

### Drei Namen, die es nicht geben wird

| Vorschlag                                | Warum nicht                                                                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`                            | Ein Buchstabe Unterschied zu `src/domains/`, zwei verschiedene Bedeutungen. Garantierte Verwechslung                                                                                               |
| `src/infrastructure/`                    | Drittes Synonym für das, was `adapters/` und die modulinternen Adapter schon sind                                                                                                                  |
| `src/agent/{planner,executor,evaluator}` | **Der gefährlichste Punkt.** `executor` neben `kernel/agent/runner.js` heißt: zwei Ausführungspfade — und nur einer hält bei `human_approval`. Die einzige Zusage des Repos wäre dann pfadabhängig |

Die drei Rollen haben bereits eine Adresse: **Planer** = `agent/routing.js` plus die Bremsen
der Domäne · **Ausführer** = `agent/runner.js` plus `domains/<d>/agents/*` · **Prüfer** =
`domains/<d>/agents/pruefer.js`, noch nicht gebaut, `EXTEND.md` Schritt 2.

---

## 4. Regelkatalog

Reihenfolge ist Priorität. Jede Regel nennt, **welche geschriebene Regel sie mechanisiert** —
eine Lint-Regel ohne Herkunft ist Geschmack.

### Stufe 1 — Die Trennlinie

| Regel                                                 | Werkzeug           | Stufe     | Mechanisiert                                |
| ----------------------------------------------------- | ------------------ | --------- | ------------------------------------------- |
| `src/kernel/**` importiert nicht aus `src/domains/**` | depcruise + ESLint | **error** | „Domänenwissen gehört nie in `src/kernel/`" |
| Keine zyklischen Abhängigkeiten                       | depcruise          | **error** | — (Voraussetzung für alles andere)          |

Beide dürfen sofort auf `error`: B5 zeigt, dass sie heute grün sind.

### Stufe 2 — Der Rand

| Regel                                                  | Werkzeug                       | Stufe     | Mechanisiert                                                      |
| ------------------------------------------------------ | ------------------------------ | --------- | ----------------------------------------------------------------- |
| `process.env` nur in `kernel/config/env.js`            | ESLint `no-restricted-syntax`  | **error** | die Konvention hinter B1                                          |
| `node:fs` nur in `persistence/`, `governance/trace.js` | ESLint `no-restricted-imports` | error     | Pfadprüfung statt Pfadbereinigung (`security-model.md` Schicht 3) |
| Jede HTTP-Eingabe geht durch ein zod-Schema            | Review + Test                  | error     | „Parse, don't validate" · Befund B2                               |

### Stufe 3 — Agentenspezifisch, nur mit Typinformation erreichbar

| Regel                             | Warum gerade hier                                                                                              | Stufe     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| `no-floating-promises`            | Ein nicht erwartetes `enqueueAction(...)` ist eine **verlorene Aktion** — und zwar eine, die kein Test bemerkt | **error** |
| `no-misused-promises`             | `if (asyncFn())` ist immer wahr. In einer Bremse hieße das: die Bremse greift immer                            | **error** |
| `await-thenable`, `require-await` | Hält die beiden oberen ehrlich                                                                                 | warn      |

Diese drei sind der eigentliche Grund für `checkJs` — ohne Typinformation gibt es sie nicht.

### Stufe 4 — Umfang

`complexity` ≤ 10 · `max-lines-per-function` ≤ 60 · `max-depth` ≤ 4 — alle als **warn** mit
Baseline. Sie erziehen, sie blockieren nicht.

### Stufe 5 — Sobald der Prüfer existiert

| Regel                                                           | Stufe     | Mechanisiert                                                |
| --------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| `agents/pruefer.js` importiert nicht aus `agents/bearbeiter.js` | **error** | „Trenn Produzent und Prüfer strikt" (`EXTEND.md` Schritt 2) |

### Nicht mechanisierbar — und deshalb hier benannt

Eine verschwiegene Grenze wird zu einem Ausfall. Diese Regeln bleiben Prosa in
`.gehirn/regeln.md` und werden von einem **Menschen** im Review geprüft:

- „Eine Erwartung wird aus der Regel abgeleitet, nie an einen Lauf angepasst."
- „Ein Defekt pro Änderung."
- „Keine Zahl ohne datierten Lauf."
- „Die HITL-Entscheidung wird niemals einem Modell überlassen."

Für die letzte gibt es einen **Stellvertreter**, keinen Beweis: `tests/workflow.test.js`
prüft die Kante auf exakt `true`. Das ist weniger als die Regel, aber mehr als nichts.

---

## 5. Die Regelleiter

So entsteht eine neue Regel — und nur so:

```
Fehler tritt zum ZWEITEN Mal auf
        ↓
Eintrag in docs/lint-rules.md   (Regel · Grund · Fix · Alternative)
        ↓
ESLint- oder depcruise-Regel, zunächst warn
        ↓
Baseline aufnehmen, committen
        ↓
Bestand abtragen, dann auf error heben
```

Zwei Verbote dazu:

- **Kein Regel-Bulk.** Eine Regel pro Änderung, mit eigener Baseline. Zwei zugleich heißt:
  nicht mehr feststellbar, welche den Bestand bewegt hat. Dieselbe Regel wie bei Defekten.
- **Keine Regel ohne Befund.** Eine Regel, die noch nie einen echten Fehler verhindert hat,
  ist Zeremonie. B1 und B2 sind Befunde; sie rechtfertigen ihre Regeln.

---

## 6. Rollout

Sechs Etappen. Jede hat ein **Tor**, und jedes Tor enthält denselben Kern:

```bash
npm test && npm run evals && npm run demo    # identisch zur Baseline
```

Die Disziplin einzuführen darf die Messung **nicht** bewegen. Bewegt sie sich, ist nicht der
Code falsch, sondern die Regel.

### E0-A · Werkzeuge, alles auf `warn`

ESLint flat config, Prettier, lefthook pre-commit. **Keine** Regel ist `error`. Zweck: den
Bestand sehen, nichts ändern.

**Tor:** `npx eslint .` läuft durch und berichtet · Kerntor unverändert · `src/` unberührt.

### E0-B · Die Trennlinie mechanisch

dependency-cruiser mit den zwei Regeln der Stufe 1, direkt auf `error` (B5: heute grün).

**Tor:** `npx depcruise src` sauber · Kerntor unverändert · `src/` unberührt.

### E0-C · Der erste echte Fund

`env.js` bekommt **spätbindende Zugriffsfunktionen** — der Variablenname lebt danach an
genau einer Stelle, die späte Auswertung bleibt erhalten:

```js
export const envLive = {
  stateDir: () => process.env.STATE_DIR || path.join(process.cwd(), ".zustand"),
  tenantId: () => process.env.TENANT_ID || "default",
  traceDir: () =>
    process.env.TRACE_DIR || path.join(process.cwd(), "evals", "traces"),
};
```

`store.js` und `trace.js` rufen die Funktion, statt den Namen erneut zu kennen. Erst danach
geht die Regel auf `error`. **Die erste Etappe, die Quellcode ändert**, deshalb allein.

**Tor:**

```bash
grep -rn "process\.env" src/ | grep -v "kernel/config/env.js"   # leer
```

plus Kerntor unverändert. Zusätzlich: `tests/persistence.test.js` und
`tests/integration/persistence.test.js` müssen **unverändert** grün bleiben — sie setzen
`STATE_DIR` zur Laufzeit und sind damit der Beweis, dass die Spätbindung erhalten blieb.

### E0-D · Typprüfung ohne Umschreiben

`tsconfig.json` nur für `tsc --noEmit`: `allowJs`, `checkJs`, `strict`. Dann `// @ts-check`
**dateiweise**, beginnend bei `kernel/agent/schema.js`. JSDoc dort, wo der Prüfer es
verlangt. Kein Build-Schritt, keine Umbenennung, K5 unberührt.

**Tor:** `npx tsc --noEmit` sauber · Kerntor unverändert.

> Eine vollständige Migration nach TypeScript bleibt eine **eigene ADR** und kommt frühestens
> nach der Wahl der Vertikale. `checkJs` liefert den größten Teil des Nutzens zu einem
> Bruchteil der Kosten.

### E0-E · Rand: parse, don't validate

zod am HTTP-Rand (`adapters/http/server.js`). Antwortkörper bleibt `{ error: string }`, kein
Stacktrace nach außen.

**Tor:** neuer Test — fehlerhafter Körper → 400, **und kein Agent wurde aufgerufen** ·
Kerntor unverändert.

### E0-F · knip und Gedächtnis-Validator

knip gegen tote Exporte. Dazu `.claude/hooks/gehirn-pruefen.sh`: aktive Themen ≤ 6, jedes
Thema hat `**Status:**`, jede Regel hat `**Regel:**` und `**Grund:**`.

**Tor:** `npx knip` sauber · der Hook läuft durch · Kerntor unverändert.

---

## 7. Das Gedächtnis bleibt Markdown

Der Einwand ist berechtigt: Agenten ändern Markdown still und respektieren strukturierte
Daten. `.gehirn/` wird vom Agenten geschrieben — das Risiko ist real.

Trotzdem **keine Umstellung auf JSON**, aus drei Gründen:

1. Die Dateien werden vom `SessionStart`-Hook **in den Kontext injiziert**. JSON kostet für
   dieselbe Aussage mehr Token.
2. `CLAUDE.md` begrenzt die aktiven Themen auf sechs, weil das Injektionsfenster begrenzt
   ist. Das ist eine Mengen-, keine Formatfrage.
3. Wo stilles Abgleiten wirklich teuer ist, liegt bereits JSON: `golden/tasks.json`.

**Stattdessen Durchsetzung ohne Formatwechsel:** der Validator aus E0-F. Damit gilt auch
hier der Satz aus §1 — die Regel wird von einem Befehl geprüft, nicht vom guten Willen.

**Kein zweites `harness/`-Verzeichnis.** `features.json` → `.gehirn/themen.md` ·
`progress.md` → `.gehirn/letzte-sitzung.md` · `AGENTS.md` → `CLAUDE.md` und `domain.js`.
Zwei Gedächtnisse driften auseinander; das steht so in `CLAUDE.md` und gilt hier wörtlich.

---

## 8. Was ausdrücklich nicht eingeführt wird

Ein Disziplindokument, das nur zustimmt, ist keins.

| Vorschlag                                          | Grund der Ablehnung                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/domain/`, `src/infrastructure/`, `src/agent/` | §3 — Namenskollision, und im Fall von `agent/` ein zweiter Ausführungspfad ohne HITL-Halt        |
| `harness/`                                         | §7 — zweites Gedächtnis                                                                          |
| `evals/results/`                                   | `evals/reports/` existiert und enthält einen datierten Bericht                                   |
| `evals/run-eval.js`                                | `npm run evals` → `evals/runners/policy.js` existiert                                            |
| `evals/datasets/synthetic/`                        | Widerspricht `regeln.md` **und** dem Ausgangstext (§10.2: „golden dataset kur, sentetik üretme") |
| `docs/architecture.md`                             | `ARCHITECTURE.md` existiert. Zwei Architekturdokumente driften                                   |
| `docs/eval-playbook.md`                            | `EVALS.md` und `evals/README.md` existieren bereits — ein drittes wäre eins zu viel              |
| `docs/decisions/`                                  | `DECISIONS.md` genügt bis etwa zehn ADRs                                                         |
| Biome                                              | §2 — zweite Wahrheitsquelle neben ESLint und Prettier                                            |

Übernommen werden dagegen: `evals/judges/`, `evals/datasets/production/`, `evals/viewer/`,
`docs/lint-rules.md`, `.claude/hooks/lint-on-edit.sh`, `eslint.config.js`,
`.dependency-cruiser.cjs`, `lefthook.yml`, `knip.json`, `tsconfig.json`.

---

## 9. Offene Entscheidungen

| Frage                                                                                                                                                                                                                                                                 | Wann sie fällt              | Wo sie landet         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------- |
| **LangGraph 0.2.74 → 1.x?** (B4 **und B7**) Nicht mehr nur Aktualität: `npm audit` meldet sechs hohe Schwachstellen in derselben Kette, darunter Extraktion von Geheimnissen. Am billigsten jetzt — 98 Tests als Netz, noch keine eigene Domäne. Nach Etappe 1 teurer | Vor Etappe 1                | ADR in `DECISIONS.md` |
| Vollständige TypeScript-Migration?                                                                                                                                                                                                                                    | Nach der Wahl der Vertikale | ADR                   |
| `DECISIONS.md` aufteilen nach `docs/decisions/`?                                                                                                                                                                                                                      | Ab etwa zehn ADRs           | —                     |

**Reihenfolge, die nicht verhandelbar ist:** die Abhängigkeitsmigration und dieser Rollout
laufen **nicht gleichzeitig**. Sonst ist nicht feststellbar, ob ein roter Test von der Regel
oder von der neuen Bibliotheksversion kommt.

---

## 10. Verhältnis zu den anderen Dokumenten

- `.gehirn/regeln.md` bleibt die **Quelle**. Dieses Dokument ist ihre Durchsetzung. Kommt
  eine Regel dort hinzu, gehört hierher die Frage: **welcher Befehl prüft sie?**
- `docs/roadmap.md` trägt das _Was_, dieses Dokument das _Wie_. Der Rollout aus §6 läuft
  parallel zu Etappe 0 der Roadmap — beide brauchen keine Entscheidung über die Vertikale.
- `docs/lint-rules.md` entsteht in E0-A und wächst über die Regelleiter aus §5. Jede
  ESLint-Fehlermeldung verweist auf ihren Abschnitt dort.
