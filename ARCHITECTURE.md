# ARCHITECTURE

> **VORLAGE mit Bestand.** §1 bis §5 beschreiben, was im Repo tatsächlich steht — sie sind
> keine Lücken. §6 und §7 sind für deine Entscheidungen frei.

## 1. Die Trennlinie

Zwei Schichten, eine Naht:

- **`src/kernel/` — MECHANIK.** Wie ein Graph gebaut wird, wie eine Queue arbeitet, wie ein
  Trace geschrieben wird. Der Kern kennt **keine einzelne Domäne**.
- **`src/domains/<domäne>/` — BEDEUTUNG.** Welche Agenten es gibt, in welcher Reihenfolge die
  Bremsen greifen, welche Muster als Bedrohung gelten, welche Aktionen erlaubt sind.

Die Naht hat genau **vier feine Stellen** — dort reicht die Domäne dem Kern etwas an:

| Stelle | Kern liefert | Domäne liefert |
| --- | --- | --- |
| Routing | `createRouter` (das Verfahren) | die Bremsen, in ihrer Reihenfolge |
| Guardrail | `createGuardrail` (die Regex-Engine) | die Muster und ihre Gewichte |
| Aktions-Queue | `createActionQueue` (die Mechanik) | Whitelist und Validierer |
| State | Kernfelder + `buildState` | die eigenen Felder samt Reducer-Wahl |

**Prüfkriterium:** eine zweite Domäne ändert **null Zeilen** unter `src/kernel/`.

```bash
grep -rn "beispiel" src/kernel/    # muss leer bleiben
```

Ohne dieses Kriterium wandert Domänenwissen still in den Kern — und die dritte Domäne kostet
dann so viel wie die erste.

## 2. Topologie: Hub-and-Spoke

```
START → entry(guardrail) → hub(orchestrator) ⇄ {spokes}
                              ⛔ interruptBefore: human_approval
                              → (nur bei true) terminal → END
```

Warum ein Hub statt einer Kette: die Routing-Intelligenz sitzt an **einem** Punkt, nicht in
den Kanten. Ein einziger Punkt heißt: prüfbar. Jeder produzierende Knoten kehrt zum Hub
zurück, und der Hub entscheidet neu.

`human_approval` ist ein **leerer Knoten**. Seine einzige Funktion: die Stelle markieren, an
der der Graph anhält.

## 3. Dreischichtiges Routing

1. **Deterministische Bremsen** — lösen den Grossteil der Fälle mit **null LLM-Kosten**.
   Ihre Reihenfolge ist die Aussage der Domäne.
2. **LLM mit strukturierter Ausgabe** — nur, wenn keine Bremse greift.
3. **Post-LLM-Validierung** — ein Agent außerhalb des Enums ⇒ sicheres Override auf `END`.

Die HITL-Entscheidung wird **niemals** dem LLM überlassen: sie liegt in Bremse 2, vor jeder
Datenlogik.

## 4. Bekannte Grenzen

Diese Liste ist absichtlich sichtbar. Eine verschwiegene Grenze wird zu einem Ausfall.

- **Das Zustandslog wächst unbegrenzt.** Keine Verdichtung, keine Rotation. Für ein Gerüst mit
  einem Mandanten tragbar; für Dauerbetrieb nicht.
- **Kein Sperrmechanismus zwischen Prozessen.** Zwei gleichzeitig schreibende Prozesse können
  sich überlappen. Der Ablauf hier ist seriell; mehr wird nicht behauptet.
- **Die Token-Schätzung im Mock-Modus ist grob.** Sie taugt für Trend und Ausreißer, nicht für
  eine Abrechnung.
- **Der Event-Puffer wird nur am Ende von `startWorkflow` aufgeräumt.** Nach
  `resolveApproval` erzeugte Events können erneut gepuffert werden. Kleines Leck.
- **Der Action-Worker simuliert.** Der echte externe Aufruf steht als Kommentar in
  `actionQueue.js`. Wer ihn einsetzt, erbt die Idempotenz — und muss die Ausgabengrenze prüfen.
- <!-- trag deine eigenen ein, sobald du sie kennst -->

## 5. Beobachtbarkeit

Zwei getrennte Wege, absichtlich:

- **Event-Bus** — zeigt an und vergisst. Für die Live-Anzeige (SSE).
- **Trace** — bleibt und ist nachprüfbar. Je Lauf eine JSONL-Datei. **Die Messung liest den
  Trace, nicht den Bus.** Wer eine Zahl anzweifelt, kann die Zeile aufschlagen.

Der Trace trägt **keinen Volltext**, nur Längen. Er belegt Routing und Richtlinien, nicht
Inhalte.

Eine Knotenzeile trägt das **Delta** — was der Knoten geschrieben hat —, nicht den
akkumulierten Zustand. Bei einem `sum`-Reducer steht in jeder Zeile der Zuwachs; der Stand ist
die Summe der Zeilen.

## 6. Entscheidungen, die noch offen sind

<!-- Was du bewusst noch nicht entschieden hast, und woran du es entscheiden wirst.
     Sobald eine Entscheidung fällt, wandert sie als ADR nach DECISIONS.md. -->

## 7. Zielstruktur beim Wachsen

<!-- Wenn das Projekt über eine Domäne und einen Adapter hinauswächst:
     wie sieht der Baum dann aus, und welche Datei zieht wohin?
     Vorher festlegen — eine später umgezogene Datei bricht den Vergleich zur Baseline. -->
