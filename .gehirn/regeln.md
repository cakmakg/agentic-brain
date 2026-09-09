# Projektregeln

Die hier eingetragenen Regeln sind **verbindlich**. Zu Sitzungsbeginn gelangen die ersten
60 Zeilen automatisch in den Kontext — die nützlichsten Regeln gehören deshalb nach oben.

Diese Regeln gelten speziell für `agentic-brain`. Allgemeine Präferenzen (TypeScript,
Next.js, Mongoose, Git) stehen in der globalen `~/.claude/CLAUDE.md` und werden hier nicht
wiederholt.

## Regeln

- **Regel:** „Fertig" darf erst gesagt werden, wenn der Prüfbefehl durchläuft. Dass eine Datei
  existiert, ist kein Beweis. **Grund:** Ein Häkchen nach Dateiexistenz gesetzt verdeckt genau
  den Ausfall, den dieses Gerüst sichtbar machen soll — es läuft, aber es leistet nichts.

- **Regel:** Prüfe einen Befund durch Ausführen, bevor du ihn meldest. Ein aus dem Code
  gelesenes Ergebnis ist nicht „verifiziert". **Grund:** Eine Hypothese kann beim Lesen
  vollkommen richtig aussehen und beim Ausführen falsch sein.

- **Regel:** Keine Zahl in README oder Dokumenten, die nicht aus einem datierten Lauf in
  `evals/reports/` stammt. Was nicht gemessen wurde, trägt die Markierung „nicht gemessen" —
  nicht eine plausibel aussehende Zahl. **Grund:** Erfundene Metriken in einem README sind
  genau der Fehler, gegen den dieses Projekt gebaut ist.

- **Regel:** Eine Erwartung im Golden-Datensatz wird aus der **Regel** abgeleitet, nie an
  einen beobachteten Lauf angepasst. Ändert sich eine Regel, wird die Erwartung **neu
  abgeleitet**. **Grund:** Wer die Erwartung ans Ergebnis anpasst, schafft die Messung ab —
  und merkt es an nichts, weil alles grün bleibt.

- **Regel:** Ein Defekt pro Änderung. **Grund:** Dass eine Verbesserung gegenüber der Baseline
  belegbar ist, hängt daran, dass jede Änderung genau einer Metrik zuzuordnen ist. Zwei
  Defekte in einem Zug behoben heißt: nicht mehr feststellbar, welcher die Zahl bewegt hat.

- **Regel:** Domänenwissen gehört nie in `src/kernel/`. Nach jeder Erweiterung:
  `grep -rn "<domäne>" src/kernel/` — muss leer sein. **Grund:** Die Trennlinie ist die
  teuerste Entscheidung des Repos. Ein einziger Domänenname im Kern macht sie zunichte, und
  niemandem fällt es auf, weil alles weiterläuft.

- **Regel:** Ändert eine Änderung Struktur, Philosophie oder Ziel des Projekts, werden
  `README.md`, `CLAUDE.md`, `PRODUCT.md`, `ARCHITECTURE.md` **im selben Zug** geprüft und
  aktualisiert — nicht erst auf Nachfrage. **Grund:** Ein Dokument, das eine bereits gelöschte
  Struktur beschreibt, ist schlimmer als kein Dokument: es wird geglaubt.

- **Regel:** Neue Dateien entstehen direkt an ihrem Zielort. Es gibt keine vorläufige Ablage.
  **Grund:** Eine später umgezogene Datei bricht den Vergleich zur Baseline.

- **Regel:** Geh Schritt für Schritt vor und frag nach. Nimm nichts an. **Grund:** In einem
  Zug erzeugte Dateien zementieren still Entscheidungen, deren Rücknahme teuer ist.

- **Regel:** Zeig, was du schreiben willst, bevor du ins Repo schreibst. Erzeuge keine Dateien
  im Block. **Grund:** Ohne Freigabe angelegte Dateien hinterlassen Reste, die wieder
  aufgeräumt werden müssen.

- **Regel:** Fremde Planungstexte sind Vorschläge, keine Quellen. Prüf sie gegen die
  Vertragsdokumente, bevor du etwas übernimmst. **Grund:** Ein übernommener Plan kann
  bereits getroffenen Entscheidungen widersprechen und wird trotzdem als „Plan" weitergereicht.

- **Regel:** Die HITL-Entscheidung wird niemals einem Modell überlassen. Sie gehört in eine
  deterministische Bremse, vor jeder Datenlogik. **Grund:** Es ist die einzige Zusage, die
  das ganze Sicherheitsmodell trägt.

## Wie diese Liste wächst

Wenn du korrigiert wirst („mach das nicht so", „nie wieder so"), trage die Korrektur in
derselben Sitzung als neuen Punkt ein: **welche Regel**, **warum sie existiert**. Halte dich
nah an die Formulierung der Nutzerin oder des Nutzers, füge keine eigene Deutung hinzu.

Ist eine Regel überholt, lösch oder überschreib sie; lass keine zwei widersprüchlichen Punkte
nebeneinander stehen. Wird die Liste lang, wandern die nützlichsten nach oben — die ersten
60 Zeilen sind das Injektionsfenster.

Reift eine Regel zu einer Architekturentscheidung, **befördere sie** als ADR nach
`DECISIONS.md` und kürz den Eintrag hier auf einen Verweis. Eine Regel und eine ADR, die
dasselbe sagen, driften auseinander.
