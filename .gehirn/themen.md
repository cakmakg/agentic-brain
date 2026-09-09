# Themen

Offene Themen, die noch zu keiner Entscheidung geworden sind.

Die Titel- und Statuszeilen der **aktiven** Themen werden zu Sitzungsbeginn injiziert —
12 Zeilen, also **sechs Themen**. Mehr bleibt in dieser Datei stehen, kommt aber nicht in
den Kontext. Halte die Liste deshalb kurz.

**Reift ein Thema zu einer Entscheidung, wandert es** nach `DECISIONS.md` (als ADR) oder in
ein Vertragsdokument — und der Eintrag hier wird auf einen Verweis gekürzt. Ohne diese
Bewegung entstehen zwei Wahrheiten.

## Aktive Themen

### Thema: Was dieses Projekt werden soll
**Status:** 🟡 Das Gerüst steht und ist grün (Tests, Demo, Schicht A). Was fehlt, ist die
eigene Domäne: welches Problem, welche Agenten, welcher Ausgabevertrag. Bis das entschieden
ist, sind `PRODUCT.md` §1–§4 Vorlagen. Nächster Schritt: `PRODUCT.md` §1 und §3.2
(Nicht-Ziele) schreiben — die Nicht-Ziele zuerst, sie sind billiger jetzt als später.

<!-- Weitere Themen hierher. Vorlage:

### Thema: <Titel>
**Status:** 🟢 / 🟡 / 🔴 <ein Absatz: wo es steht, was blockiert, was als Nächstes kommt>

-->

## Abgeschlossene Themen

### Thema: Das Gerüst aufsetzen
**Status:** 🟢 Abgeschlossen. Kern, Beispiel-Domäne, Tests, Messinstrument und
Gedächtnis-Hook stehen. Belegt durch: `npm run demo` läuft Ende zu Ende, `npm test` 98/98
grün bei 90,5 % Abdeckung, `npm run evals` 20/20 Vertragstreue und deterministisch.
