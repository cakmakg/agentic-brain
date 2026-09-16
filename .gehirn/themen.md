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

**Status:** 🟡 E0-A steht (Stand 2026-09-10: **15** Warnungen, 0 Fehler); **E0-B ist frei** und der nächste Disziplinschritt.
Seit 2026-09-08: ESLint 10, Prettier, lefthook, alle Regeln auf `warn`, `src/` unberührt.
E0-B (dependency-cruiser) schreibt seine Regeln auf **Pfade**; seit Etappe 0b stehen die
Ebenenpfade fest, es kann also einmal geschrieben werden. Danach E0-C (`envLive` — erste Etappe mit
Quellcodeänderung), E0-D (`checkJs`), E0-E (zod am HTTP-Rand), E0-F (knip + `.gehirn`-Validator).
Die zwei lange wartenden Regeln sind seit Etappe 2 schreibbar (`*/store/index.js ✗→ */store/*.js`,
`**/retrieval/filter.js ✗→ node:fs, node:http`); seit Etappe 3b kommt eine dritte dazu:
`kernel/connectors/** ✗→ src/domains/**` — der Port darf keine Quelle kennen. Und seit 3c
eine vierte: `*/store/index.js ✗→ pg` — der Port darf keinen Treiber kennen. Seit 3d eine
fuenfte: `*/embedding/index.js ✗→ */embedding/*.js` — dieselbe Regel wie beim Store, nur eine
Ebene weiter.
Zur Zahl 15 siehe das eigene Thema zum Lint-Anstieg.

### Thema: Der Voyage-Adapter ist gebaut und NICHT gemessen

**Status:** 🔴 Neu am 2026-09-11. Kein `VOYAGE_API_KEY` — bis der Lauf durchlaeuft, ist die zentrale Aussage eine Vorhersage.
`EMBEDDING_ADAPTER=voyage npm run evals -- besprechung` hat nie stattgefunden. Der Adapter ist
gegen ein Testdouble geprueft, das die dokumentierte Antwortform nachbildet — aber ein
Testdouble beweist die eigene Logik, nicht die fremde. ADR-0015 sagt vorher, dass **3.13 sich
nicht bewegt**, weil der ACL-Filter vor der Bewertung laeuft; der **Nenner** darf sich sehr
wohl aendern, ein dichtes Embedding gibt mehr Chunks einen Wert ueber null. `0/16` und `0/20`
sind beide 0 %. Bewegt sich der **Zaehler**, hing eine Berechtigung an der Sortierung — das
waere der Befund, nicht das Embedding. Bis dahin gilt „der Adapter ist austauschbar" nur
gegenueber dem breiten Testadapter.

### Thema: Zwang fehlt — von drei Schichten des Inventars steht eine

**Status:** 🟠 Aktualisiert am 2026-09-17. Beweiskette ✅, Sperre ✅, **CI geschrieben und NIE GELAUFEN** — bis der erste Push gruen ist, haengt jede Pruefung weiter daran, dass der Agent sie ausfuehrt und ehrlich berichtet.
Das Inventar vom 2026-09-15 fand 18 Kontrollpunkte und **keinen einzigen technischen Riegel
gegen den Agenten**: `npx eslint src/` endet mit 0 (in E0-A ist jede Regel `warn`), also
blockiert `lefthook` nichts; `prettier` schreibt und laeuft weiter; `.github` fehlt; in
`.claude/settings.json` steht kein `deny`. Der einzige unabhaengige Kontrollpunkt ist der
menschliche Blick auf `git diff`.

Schicht 1 ist am 2026-09-16 gefallen — die Beweiskette (`.gitignore`, `projekt-doktor` §13,
sechs Berichte im Repo). Offen bleiben zwei:

- **Sperre — am 2026-09-17 gefallen.** `.claude/hooks/schutz-vertragsdateien.sh` gibt bei
  `tests/**`, `evals/domains/*/golden/**`, `.gehirn/regeln.md`, `PRODUCT.md`, `EVALS.md` und
  `DECISIONS.md` ein `permissionDecision: "ask"` zurueck: Claude Code zeigt den Diff und
  fragt, auch wenn die Sitzung sonst ohne Rueckfrage schreiben duerfte. Er blockiert nicht —
  der Agent schreibt weiter Tests, aber nicht mehr STILL. Belegt: elf Pipe-Proben (relative
  und absolute Pfade, Windows-Backslash, Gross-/Kleinschreibung) plus ein Spurnachweis, dass
  der Harness ihn wirklich aufruft. **Offen bleibt, welche Dateien noch dazugehoeren:**
  `evals/metrics/index.js` (der Rechner), `evals/runners/policy.js` (das Urteil) und
  `evals/domains/*/adapter.js` (seit ADR-0017 traegt es `ungemessen`) sind dieselbe Art von
  Datei, stehen aber nicht auf der Liste.
- **CI — geschrieben am 2026-09-17, aber NIE GELAUFEN.** `.github/workflows/tore.yml`, drei
  Jobs: `schicht-a` (ohne Dienst, das IST K5), `postgres` (pgvector als Service, ADR-0013) und
  `disziplin` (eslint berichtend, `npm audit --audit-level=high` als echtes Tor). Belegt ist
  bisher nur, dass die **Befehle** laufen: aus einem frischen Klon mit `npm ci` sieben von
  sieben gruen, und `npm test` gegen eine erreichbare Datenbank **228/228 statt 222/6
  uebersprungen**. Nicht belegt ist die YAML-Verdrahtung selbst — dafuer gibt es auf dieser
  Maschine kein Werkzeug (kein `act`, kein YAML-Parser), nur den ersten Push. Bis dahin gilt
  hier dasselbe wie beim Voyage-Adapter: gebaut ist nicht gemessen.

Davor gehoeren zwei gemessene Defekte im Messinstrument selbst: `evals/runners/policy.js`
entscheidet in Zeile 618-626 sechsmal mit `erfuellt !== false` — ein `undefined` gilt als
gruen —, und `berechneMetriken` steht in keinem einzigen Test. Ein ungepruefter Richter ist
vor jeder Sperre dran.

### Thema: Der Lint-Anstieg von 12 auf 15 Warnungen

**Status:** 🟡 Neu am 2026-09-10. Drei neue Warnungen, alle als Folge von Etappe 3b bewusst stehengelassen.
`darfSehen` Komplexitaet 11 und `pruefeEnvelope` Komplexitaet 13 sind der Preis, den ADR-0012
in seinem eigenen Konsequenzen-Abschnitt benennt: eine Regel mehr. Die geordnete Regelliste in
`darfSehen` zu zerschneiden waere schlechter als die Warnung — die Reihenfolge IST dort die
Aussage. `berechneMetriken` mit 104 Zeilen ist eine Metrik mehr in einer bewusst linearen
Liste. Zu entscheiden ist nicht, ob refaktoriert wird, sondern ob die drei Schwellen fuer
diese Dateien angehoben oder die Befunde als bekannte Ausnahme notiert werden — beides
gehoert nach `docs/engineering-discipline.md`, nicht in eine stille Anpassung.

### Thema: Ausbau nach dem Abgleich mit dem Ausgangstext — als Nächstes Etappe 4a

**Status:** 🟡 Aktualisiert am 2026-09-14. Die Genehmigungslücke am HTTP-Rand ist geschlossen (Test zuerst rot); offen bleiben die Etappen 4a–14b und A11–A19, alle in `docs/roadmap.md`.
Die vier Lücken aus dem Abgleich — echte Connectoren, Graph und Gedächtnis, ein Agent je
Mitarbeiter, der Autonomiegrad — sind am 2026-09-13 in den Plan gewandert: `docs/roadmap.md`
§4 (A11–A19), §5 (Sofortmaßnahme, Etappe 4a–4d, 7–14b), §8 (Begründung), §10 (offene
Entscheidungen). Die Begründung steht dort und nicht mehr hier. Was hier bleibt, ist nur, was
im Plan leicht übersehen wird:

- **Die Sofortmaßnahme ist am 2026-09-14 gefallen** und hinterlässt eine Regel, keine Notiz:
  nur ein JSON-Boolean `true` ist eine Genehmigung, jeder Nicht-Boolean → 400 — **für jeden
  Kanal**, auch den aus Etappe 11 (`docs/security-model.md`). Die drei Hinweise sind
  verschwunden; `tests/httpAdapter.test.js` ist der erste Test gegen den Adapter, und die
  Abdeckungs-Ausnahme für ihn ist weg.
- **Keine der neun Entscheidungen A11–A19 ist gefallen.** Der Plan ändert keinen Vertrag;
  jede Etappe zieht ihren Vertrag mit ihrer eigenen ADR nach (`docs/roadmap.md` §9).
- **Die frühere Abhängigkeit „Autonomiegrad vor echten Connectoren" ist so aufgelöst:** bis
  einschließlich Etappe 13 bleibt jede Außenwirkung genehmigungspflichtig; Autonomie kommt erst
  in 14b und nur aus Schicht-C-Daten. Die erste echte Quelle (7) kommt also nicht zusammen mit
  mehr Autonomie.
- **Zwei Umdeutungen, keine Übernahmen:** „ein Agent je Mitarbeiter" ist ein
  Principal-Kontext (A18), „Ende zu Ende autonom" ist verdiente Autonomie mit Stufe 2 als
  Grenze (A19).
- Die Zusammenfassung des Ausgangstexts liegt weiter **nicht** im Repo; ihr Kern steht in
  `docs/roadmap.md` §8.

## Abgeschlossene Themen

### Thema: Der Postgres-Pfad laeuft nur, wenn jemand ihn faehrt

**Status:** 🟢 Abgeschlossen 2026-09-16. Beide Adapter am selben Tag gemessen, die Berichte nach Abzug von `erzeugt` und `storeAdapter` Zeichen fuer Zeichen identisch; der CI-Teil lebt im Thema „Zwang fehlt" weiter.
Die Luecke aus ADR-0013 war bewusst, aber bis heute war die zentrale Aussage — „dieselbe
Eval-Suite liefert gegen beide Adapter dieselben Zahlen" — im Repo **unbelegt**: `EVALS.md`
§8 fuehrte eine Postgres-Zeile mit vollen Zahlen und einem Bericht, den es weder auf der
Platte noch im Repo noch in `git log --all` gab. Am 2026-09-16 liefen beide Adapter
nacheinander; vier Berichte liegen im Repo. Die Gegenprobe gegen einen stillen Rueckfall auf
`memory` lief ueber die Datenbank selbst: `chunks` mit `vektor vector(64)`, zehn Zeilen,
`tenant_id` und beide ACL-Spalten. Die alte Zeile vom 2026-09-10 traegt jetzt „kein Bericht"
und ist **nicht heilbar** — der Dateiname traegt die Laufzeit.
Was offen bleibt, ist nicht der Adapter, sondern die Regelmaessigkeit: ohne CI mit Datenbank
misst niemand den SQL-Pfad ausser von Hand, und damit auch nicht das zweite Kompilat der
ACL-Regeln (ADR-0014). Docker zur Voraussetzung jedes Laufs zu machen waere K5 aufzugeben,
nur ueber einen Umweg — deshalb gehoert die Frage zur CI-Schicht, nicht hierher.

### Thema: Etappe 3d — das Embedding wurde ein Port, und der Delta-Sync fiel ohne gebaut zu werden

**Status:** 🟢 Abgeschlossen 2026-09-11 als **ADR-0015** und **ADR-0016**. Jede Metrik unveraendert; ein zweiter Zyklus kostet null Einbettungen.
Die Etappe hat ihre eigene Ueberschrift widerlegt: „den Hash gegen ein Modell tauschen" haette
Schicht A und K5 mitgenommen, also wurde es ein **Port mit zwei Adaptern** (`hash`, `voyage`) —
dieselbe Antwort wie beim Chunk-Speicher. Und die Delta-Sync-Frage aus ADR-0011 fiel **gegen**
den Delta-Sync: teuer ist nicht der Ersatz, sondern der Einbettungsaufruf, also wird genau der
zwischengespeichert (nach **Art und Text**). Der Satz, an dem alles haengt: ein **Vektor**
traegt keine Berechtigung, ein **Chunk** traegt eine — deshalb darf man Vektoren
wiederverwenden und Chunks nicht. Vier Mutationen, vier Mal rot, nach dem Refaktorieren
erneut gefahren. Offen blieb allein der Lauf gegen den echten Dienst (eigenes Thema).

### Thema: Etappe 3c — der Postgres-Adapter und die K5-Entscheidung

**Status:** 🟢 Abgeschlossen 2026-09-10. Dieselbe Eval-Suite gegen zwei Adapter, in **jeder** Metrik identisch; K5 bleibt gruen (ADR-0013).
Neu: `store/postgres.js` mit pgvector, `pg` 8.23.0 (null neue Schwachstellen), `docker-compose.yml`,
`npm run evals:postgres`, sechs Integrationstests. Die Etappe zerfiel in drei Schritte mit je
eigenem Tor: Port **asynchron** (alle Zahlen identisch), ACL-Regeln **eine Quelle / zwei
Kompilate** (ADR-0014, 3.13 unveraendert), dann erst der Adapter. **Die staerkste Probe:**
Mandantengrenze nur im SQL-Kompilat ausgehebelt — memory bleibt bei 0 %, Postgres springt auf
33,3 % mit Rueckgabewert 1. **Die Lehre:** der Adapter war der kleinere Teil; die Frage war,
wo die ACL-Regeln leben, wenn zwei Speicher sie brauchen. Und: mein erster Test fuer die
SQL-Klammerung war gruen, obwohl der Defekt drin war.

### Thema: Welche Vertikale — die offene Produktentscheidung

**Status:** 🟢 Abgeschlossen 2026-09-10 als **ADR-0010**. Besprechungsnotiz → Aktionspunkt → Ticket, Quelle ein geteiltes Notizenlaufwerk.
Den Ausschlag gab das Berechtigungsmodell, nicht der Anwendungsfall: drei uebereinanderliegende
Mechanismen (Ordner-Vererbung, Einzelfreigabe, Teilnehmerliste), jeder als **Regel**
formulierbar — das verlangt `EVALS.md` §4. Ticket-Triage haette eine ACL gehabt, die
`envelope.js` ohnehin schon abbildet; Kunden-Onboarding eine, deren Regeln aus einem
Organigramm statt aus einem Regelwerk kommen. Die Begruendung steht vollstaendig in ADR-0010,
der Umfang in `PRODUCT.md`. Tor eingeloest: 0 Vorlagenmarken, Trennlinie leer.

### Thema: Etappe 3b — erster Connector und Ausbreitung des Entzugs

**Status:** 🟢 Abgeschlossen 2026-09-10. `npm test` 179/179, Schicht A 28/28 + 32/32, **3.14 = 0 %** (0/6) nach einem Zyklus; 3.13 und 3.1–3.4 unbewegt.
Neu: Ebene ① `kernel/connectors/` (Port + `synchronisation.js`), `store.ersetzeQuelle`, die
Domaene `besprechung` mit `ontology.js`, `acl.js`, `vertrag.js` und `connectors/notizlaufwerk.js`.
Drei ADRs: 0010 (Vertikale), 0011 (vollstaendige Momentaufnahme, atomarer Ersatz statt
Delta-Sync), 0012 (`erlaubtePersonen` in der Envelope). **3.14 kann rot werden — belegt:**
`ersetzeQuelle` anhaengen statt ersetzen treibt sie auf 83,3 %; alles verwerfen laesst sie bei
0 % und die Vertragstreue auf 26/32 fallen. Genau dafuer ist `EZ-6` im Datensatz.

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
