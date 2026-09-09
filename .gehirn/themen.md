# Themen

Offene Themen, die noch zu keiner Entscheidung geworden sind.

Die Titel- und Statuszeilen der **aktiven** Themen werden zu Sitzungsbeginn injiziert —
12 Zeilen, also **sechs Themen**. Mehr bleibt in dieser Datei stehen, kommt aber nicht in
den Kontext. Halte die Liste deshalb kurz.

**Reift ein Thema zu einer Entscheidung, wandert es** nach `DECISIONS.md` (als ADR) oder in
ein Vertragsdokument — und der Eintrag hier wird auf einen Verweis gekürzt. Ohne diese
Bewegung entstehen zwei Wahrheiten.

## Aktive Themen

> Nur die Zeilen `### Thema:` und `**Status:**` werden injiziert — der Rest des Absatzes
> nicht. Die **Statuszeile muss deshalb für sich allein stehen** und in sich abgeschlossen
> sein. Der Fließtext darunter ist Vertiefung für den, der die Datei öffnet.

### Thema: `express` 4 → 5 — die zwei verbliebenen mittleren Schwachstellen

**Status:** 🟠 Neu am 2026-09-09. `npm audit` ist bei `high: 0`, aber zwei **mittlere** in `qs` bleiben; sie brauchen `express` 5.
Aufgetaucht als Rest von Etappe 0c. `express` 4.22.2 zieht `qs` 6.15.3 mit; die zwei
mittleren Befunde (Array-Limit-Umgehung, DoS über `isBuffer`) verschwinden erst mit dem
Major-Sprung auf `express` 5. Das hat mit ADR-0003 nichts zu tun und darf deshalb nicht
nebenbei passieren — betroffen wäre `src/adapters/http/`. Braucht eine eigene ADR, bevor eine
Zeile fällt. Notiert in `ARCHITECTURE.md` §4, damit die Grenze nicht verschwiegen ist.

### Thema: Ingenieursdisziplin einführen

**Status:** 🟡 E0-A steht (12 Warnungen, 0 Fehler); **E0-B ist seit dem Umbau frei** und der nächste Disziplinschritt.
Seit 2026-09-08: ESLint 10, Prettier, lefthook, alle Regeln auf `warn`, `src/` unberührt.
E0-B (dependency-cruiser) schreibt seine Regeln auf **Pfade**; seit Etappe 0b stehen die
Ebenenpfade fest, es kann also einmal geschrieben werden. Danach E0-C (`envLive` — erste Etappe mit
Quellcodeänderung), E0-D (`checkJs`), E0-E (zod am HTTP-Rand), E0-F (knip + `.gehirn`-Validator).
Zwei Regeln bleiben bis Etappe 2 unschreibbar, weil ihre Verzeichnisse noch leer sind:
`*/store/index.js ✗→ */store/*.js` und `**/retrieval/filter.js ✗→ node:fs, node:http`.

### Thema: Welche Vertikale — die offene Produktentscheidung

**Status:** 🟡 Blockiert **nicht** mehr den Anfang. Gebraucht ab Etappe 3; Etappe 0, 1 und 2 laufen ohne sie.
Die Umkehr gegenüber dem 2026-09-08: der ACL-Filter braucht keine echte Identität, sondern
einen **Principal** — und in Schicht A kommt der aus dem Datensatz. Ontologie, ACL-Modell,
erster Connector und die Aktionstypen leiten sich weiterhin alle aus ihr ab. Tor:
`grep -c "VORLAGE\|<!-- " PRODUCT.md` → 0 (heute 9). Kandidaten: Besprechungsnotiz → Aktion →
Ticket · Ticket-Triage · Kunden-Onboarding.

## Abgeschlossene Themen

### Thema: Etappe 2 — messbare Autorisierung

**Status:** 🟢 Abgeschlossen 2026-09-09. `npm test` 138/138, Schicht A 28/28, **3.13 = 0 %** bei Nenner 10; K5 grün, Trennlinie leer.
Neu: Ebenen ② `context/` (envelope · embedding · ingest · store-Port + memory-Adapter ·
aufbau) und ③ `retrieval/` (filter · suche). Fünf ADRs gefallen: 0005 (hexagonale Achse,
löst einen Widerspruch zwischen `ARCHITECTURE.md` §7 und `engineering-discipline.md` auf),
0006 (Port), 0007 (Hash-Embedding), 0008 (Filter in die Abfrage kompiliert, fail-closed),
0009 (Envelope-Vererbung). **3.13 kann rot werden — belegt:** ohne die Mandantenprüfung
springt sie auf 37,5 %. Ebene ① `connectors/` bleibt bewusst leer bis Etappe 3.

### Thema: Etappe 1 — das QA-Tor `pruefer`

**Status:** 🟢 Abgeschlossen 2026-09-09. `npm test` 107/107, Schicht A 22/22; die vier Zusagemetriken unverändert, Kosten- und Kontextbaseline bewusst neu.
Neu: Spoke `agents/pruefer.js` mit strukturierter Ausgabe, State-Felder `istFreigegeben`
(`lastWins`) und `gruende`, Bremsen 5/6/7 statt der alten 5. Belegt: `RV-1` trägt
`bearbeiterAufrufe: 2` (der geforderte Beweis), und `SS-1` lässt den Prüfer dauerhaft
ablehnen — damit löst BREMSE 3 zum ersten Mal im Live-Pfad aus, statt nur zu existieren.
**Die Falle, die der Plan nicht kannte:** der Bearbeiter muss `istFreigegeben` bei jeder
neuen Fassung auf `null` zurücksetzen, sonst greift die Ablehnungs-Bremse sofort wieder.
Nachgetragen in `EXTEND.md` Schritt 2 und `docs/roadmap.md`.

### Thema: Etappe 0c — LangGraph 1.x und `npm audit`

**Status:** 🟢 Abgeschlossen 2026-09-09. langgraph 1.4.14, `npm audit` `high: 0`; ADR-0003 grün, Etappe 0 damit geschlossen.
Belegt: `npm test` 98/98 · Schicht-A-Bericht **Zeile für Zeile identisch** zum Stand vor dem
Sprung (einziger Unterschied: der Zeitstempel) · `npm run demo` Exit 0, sowohl aus frischem
Zustand als auch gegen den alten · ESLint unverändert 12 Warnungen / 0 Fehler.
Zwei Dinge, die der Plan nicht vorhergesehen hatte: LangGraph 1.x verlangt `zod ^3.25.32` als
Peer (3.23.8 → 3.25.76, bleibt in v3), und die einzige Bruchstelle im Quellcode war **nicht**
das State-Schema, sondern `serde.dumpsTyped` im Checkpointer — in 1.x asynchron geworden.
88 alte Checkpoints aus 0.2.74 spielten fehlerfrei zurück: der Sprung ist zustandskompatibel.

### Thema: Etappe 0b — Umbau auf die sechs Ebenen

**Status:** 🟢 Abgeschlossen 2026-09-09. Reine Umbenennung, null Logikänderung; ADR-0002 grün.
Belegt: Schicht-A-Bericht **Byte für Byte identisch** zum committeten Stand · `npm test` 98/98 ·
`npm run demo` Exit 0 · `ls src/kernel` ohne Fremdling · kein Dokument nennt mehr einen Pfad,
den es vor dem Umbau gab und jetzt nicht mehr gibt. Der Zielbaum ist als Vertrag nach
`ARCHITECTURE.md` §7 gezogen, `docs/roadmap.md` §3 auf einen Verweis gekürzt.

### Thema: Das Gerüst aufsetzen

**Status:** 🟢 Abgeschlossen. Kern, Beispiel-Domäne, Tests, Messinstrument und
Gedächtnis-Hook stehen. Belegt durch: `npm run demo` läuft Ende zu Ende, `npm test` 98/98
grün bei 90,5 % Abdeckung, `npm run evals` 20/20 Vertragstreue und deterministisch.

---

<!-- VORLAGE fuer ein neues Thema. Sie steht BEWUSST unterhalb von
     "## Abgeschlossene Themen": der Hook liest nur den Bereich zwischen
     "## Aktive" und "## Abgeschlossene" und filtert dort auf Zeilen, die mit
     "### " oder "**Status:**" beginnen. Ein HTML-Kommentar schuetzt davor NICHT --
     stand die Vorlage oben, wurde sie mitinjiziert und belegte ein Themenfenster.

     ### Thema: <Titel>
     **Status:** <Emoji + EIN abgeschlossener Satz — nur diese Zeile wird injiziert>
     <Fliesstext darunter: wo es steht, was blockiert, was als Naechstes kommt>
-->
