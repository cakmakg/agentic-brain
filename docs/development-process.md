# Entwicklungsprozess

Wie in diesem Repo gearbeitet wird — mit einem KI-Agenten als ständigem Mitarbeiter.

Der Prozess ist selbst Teil des Produkts. Ein Agentensystem, das ohne nachvollziehbaren
Prozess entsteht, kann nicht glaubhaft behaupten, Nachvollziehbarkeit sei sein Thema.

---

## 1. Die Grundregel

> **Dass eine Datei existiert, ist kein Beweis; ein bestandener Prüfbefehl ist einer.**

„Fertig" darf erst gesagt werden, wenn der Prüfbefehl durchläuft. Nicht, wenn die Datei
angelegt ist. Nicht, wenn der Code beim Lesen richtig aussieht.

Daraus folgt die zweite Regel: **prüf einen Befund durch Ausführen, bevor du ihn meldest.**
Ein aus dem Code gelesenes Ergebnis ist nicht verifiziert.

---

## 2. Eine Aufgabe

Aufgaben werden einzeln erledigt. **Ein Defekt pro Änderung.** Zwei Defekte in einem Zug
behoben heißt: nicht mehr feststellbar, welcher die Zahl bewegt hat.

Vorlage:

```markdown
### T<n> — <Titel>

**Problem:** Was ist heute falsch? Woran sieht man es?
**Erwartung:** Was soll danach gelten?
**Prüfbefehl:** Der Befehl, der es beantwortet.
**Vorher:** Ausgabe des Befehls jetzt (rot).
**Nachher:** Ausgabe des Befehls nach der Änderung (grün).
**Berührte Dateien:** Liste. Ist der Kern dabei, begründe es.
```

`Vorher` und `Nachher` sind nicht Zeremoniell. Ohne `Vorher` ist unbeweisbar, dass der Defekt
existierte; ohne `Nachher`, dass er weg ist.

---

## 3. Der Rhythmus einer Sitzung

**Zu Beginn** injiziert der `SessionStart`-Hook automatisch:
`.gehirn/kern.md`, den obersten Block von `.gehirn/letzte-sitzung.md`, die aktiven Themen aus
`.gehirn/themen.md` und die ersten 60 Zeilen von `.gehirn/regeln.md`.

Der Hook **liest nur**. Er schreibt keine Datei, startet keinen Prozess, macht keinen
Netzaufruf.

**Während der Sitzung:** lies die Datei, bevor du ihr vertraust. Die injizierten Notizen
sagen, was **beim Schreiben** wahr war.

**Vor dem Ende** — das Gedächtnisprotokoll aus `CLAUDE.md`:

| Datei | Was hineingehört |
| --- | --- |
| `.gehirn/letzte-sitzung.md` | oberster Block: getan · bewusst unterlassen · als Nächstes · offener Rest |
| `.gehirn/themen.md` | Abgeschlossenes nach unten, Neues unter „Aktive Themen" (höchstens sechs) |
| `.gehirn/regeln.md` | jede Korrektur, die du bekommen hast — **welche Regel**, **warum** |

**Übergaberegel:** Jede bedeutsame Sitzung hinterlässt eine Spur — eine Entscheidung, eine
Regel oder eine aktualisierte Datei. Eine Sitzung ohne Spur beginnt beim nächsten Mal wieder
bei null.

---

## 4. Wie das Gedächtnis liest und schreibt

Es gibt **keinen** automatischen Compiler. Der Hook liest; **schreiben musst du.** Das ist
Absicht: ein automatisch verdichtetes Gedächtnis driftet, ohne dass es jemandem auffällt.

Zwei Gedächtnisse, klar getrennt:

- **Repo-Dokumente** (`PRODUCT`, `ARCHITECTURE`, `DECISIONS`, `EVALS`, `docs/`) — die
  dauerhafte Wahrheit.
- **`.gehirn/`** — nur die Kontinuität zwischen Sitzungen und Themen, die noch zu keiner
  Entscheidung geworden sind.

**Reift ein Thema, wandert es** in ein Repo-Dokument, und die Spur in `.gehirn/` wird gekürzt.
Ohne diese Bewegung entstehen zwei Wahrheiten, und niemand weiß mehr, welche gilt.

Das Injektionsfenster ist begrenzt (Abschnittsgrenzen 3000/4000/2000/4000 Zeichen, zusammen
unter 16 000). Deshalb: sechs aktive Themen, nützlichste Regeln nach oben. Wer ein Limit
anhebt, muss die Summe nachrechnen.

---

## 5. Wartungsrhythmus

| Wann | Was |
| --- | --- |
| jede Sitzung | Gedächtnisprotokoll (§3) |
| nach jeder Erweiterung | `npm test && npm run evals` · `grep -rn "<domäne>" src/kernel/` |
| wöchentlich | Skill `projekt-doktor` — findet stille Ausfälle |
| bei jeder Strukturänderung | `README.md`, `CLAUDE.md`, `PRODUCT.md`, `ARCHITECTURE.md` **im selben Zug** prüfen |
| gelegentlich | die Mutationsprobe (`EVALS.md` §7): wird der Test überhaupt rot? |

Die vorletzte Zeile ist die, die am häufigsten vergessen wird. Ein Dokument, das eine bereits
gelöschte Struktur beschreibt, ist schlimmer als kein Dokument — es wird geglaubt.

---

## 6. Arbeitsweise mit dem Agenten

- **Schritt für Schritt, und nachfragen.** Nichts annehmen. In einem Zug erzeugte Dateien
  zementieren still Entscheidungen, deren Rücknahme teuer ist.
- **Zeigen, bevor geschrieben wird.** Keine Dateien im Block anlegen.
- **Fremde Planungstexte sind Vorschläge, keine Quellen.** Prüf sie gegen die
  Vertragsdokumente, bevor du etwas übernimmst.
- **Korrekturen werden in derselben Sitzung zu Regeln.** Nah an der Formulierung der
  Nutzerin oder des Nutzers, ohne eigene Deutung.
- **Reift eine Regel zu einer Architekturentscheidung, befördere sie** als ADR nach
  `DECISIONS.md` und kürz den Eintrag in `.gehirn/regeln.md` auf einen Verweis.

---

## 7. Vor dem Veröffentlichen

```bash
npm test && npm run evals      # beide grün?
git status                     # kommt eine Zustands- oder Trace-Datei mit?
grep -rn "<domäne>" src/kernel/  # leer?
```

Und: **keine Zahl in einem Dokument, die nicht aus einem datierten Lauf in `evals/reports/`
stammt.** Was nicht gemessen wurde, trägt die Markierung „nicht gemessen".
