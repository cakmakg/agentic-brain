# evals — das Messinstrument

Die Definitionen stehen in [`../EVALS.md`](../EVALS.md). Hier steht, **wie man es bedient**
und **was es nicht kann**.

```bash
npm run evals                # alle registrierten Domänen
npm run evals -- beispiel    # nur diese (für die Entwicklung)
```

In CI läuft immer der volle Satz. Eine einzelne Domäne zu fahren, während der Befehl grün
meldet, ließe die andere ungemessen.

---

## Aufbau

```
evals/
  domains/
    index.js               DOMAENEN — die explizite Liste. Kein Verzeichnis-Scan.
    <domäne>/
      adapter.js           die sieben Angaben, die der Runner braucht
      golden/tasks.json    der Datensatz: je Aufgabe eine Regel
  metrics/index.js         Zähler und Nenner. Domänenfrei.
  runners/
    policy.js              SCHICHT A. Domänenfrei.
    messung.js             die Schleife der SCHICHT B. Domänenfrei, injizierte Abhängigkeiten.
  reports/                 je Lauf und Domäne eine JSON-Datei
  traces/                  je Lauf eine JSONL-Datei
```

**Warum eine explizite Liste statt eines Scans:** ein Scan nähme eine Domäne still aus der
Messung, sobald ihre Datei anders heißt — und der Harness meldete weiter grün. Genau dieser
Ausfall („es läuft, aber es misst nichts mehr") ist der Fehler, den dieses Gerüst behandelt.
Ein fehlender Adapter muss **laut** sein.

---

## Der Adaptervertrag

Sieben Felder. Fehlt eines, bricht `ladeAdapter` ab.

| Feld | Was es liefert |
| --- | --- |
| `name` | muss dem Verzeichnisnamen entsprechen |
| `eingang` | der Eingangsknoten — „blockiert" wird **strukturell** erkannt (der Lauf endet dort) |
| `guardrailSchwellen` | **dieselbe** Konstante wie im Code, keine zweite Kopie der Zahl |
| `runner` | aus `getRunner(<domäne>)` |
| `artefaktstatus` | `(threadId) => string \| null` — wie der Endzustand deiner Domäne heißt |
| `aktionen` | `enqueueAction`, `getQueue`, `startActionWorker`, `stopActionWorker` |
| `datensatz` | der geladene `golden/tasks.json` |

Der Import von `adapter.js` hat eine **Nebenwirkung**: er registriert die Domäne. Deshalb wird
er dynamisch geladen — erst, wenn der Runner `TRACE_DIR` und `STATE_DIR` gesetzt hat. Sonst
schriebe der erste Lauf neben das Ziel.

---

## Wie ein Lauf gemessen wird

Die Knotenfolge und der Bedrohungswert kommen aus dem **Trace**, nicht aus dem Event-Bus.
Der Bus zeigt an und vergisst; der Trace bleibt und ist nachprüfbar — wer eine Zahl
anzweifelt, kann die Zeile aufschlagen.

Jede Domäne wird **zweimal** gefahren. Verglichen werden die **Messwerte** beider Durchgänge,
nicht der Bericht (der trägt einen Zeitstempel). Das ist der Determinismus-Nachweis.

Vor jedem Durchgang: ein frisches `STATE_DIR` unter `os.tmpdir()` und `cost.reset()`. Ohne
beides trüge die zweite Domäne den Verbrauch der ersten mit, und die Kostenmetrik meldete für
sie eine Zahl, die zur Hälfte einer anderen gehört.

---

## Was das Instrument NICHT kann

Diese Liste gehört in jede Diskussion über eine Zahl aus diesem Verzeichnis.

- **Schicht A sagt nichts über Textqualität.** Sie läuft im Mock-Modus; der „Text" ist eine
  deterministische Attrappe. Gemessen werden Routing und Richtlinien — mehr nicht.
- **Die Kostenzahl ist eine Schätzung** (Zeichen ÷ 4). Trend und Ausreißer, keine Abrechnung.
- **Der Datensatz misst nur, was in ihm steht.** Eine Angriffsform ohne Aufgabe ist keine
  Lücke im Guardrail, sondern eine im Datensatz — und sie sieht grün aus.
- **Schicht 3 des Routings ist im Mock unerreichbar.** Der `mockFactory` erzwingt bereits ein
  gültiges `END`; ein Override wird nie ausgelöst.
- **Der Harness prüft nicht, ob der Datensatz gut ist.** Die `Vertragstreue` sagt nur, ob der
  Lauf der Erwartung entsprach — nicht, ob die Erwartung die richtige war.

---

## Die Falle, gegen die alles hier gebaut ist

Läuft eine Aufgabe rot, gibt es zwei Wege:

1. **Den Code reparieren** — die Regel gilt, das Verhalten weicht ab.
2. **Die Regel ändern und die Erwartung NEU ABLEITEN** — die Regel war falsch.

Es gibt **keinen dritten**. Die Erwartung an den beobachteten Lauf anzupassen schafft die
Messung ab, und alles bleibt für immer grün.

---

## Schicht B

`messung.js` ist die Schleife — domänenfrei, mit injizierten Abhängigkeiten, und ohne
Schlüssel geprüft (`tests/schichtB.test.js`, 9 Tests). Was fehlt, ist der Teil, den nur deine
Domäne liefern kann: Ausgabevertrag, `schreibe`, `pruefe`, Runner. Siehe `EVALS.md` §5.

Ein Instrument, von dem niemand zeigen kann, dass es überhaupt etwas anderes als „nicht
messbar" ausgeben kann, ist kein Instrument, sondern eine Behauptung. Deshalb wird die
Schleife mit einem Skript-Writer geprüft, bevor je ein Modell sie anfasst.
