# Ausbauplan

> **Was dieses Repo wird.** Ein **permission-aware Enterprise Context Layer** mit
> agentischer Prozessautomatisierung und einer Agent Control Plane. Das ist eine
> Produktentscheidung, kein Gerüst mehr — sie gehört als ADR-0001 nach `DECISIONS.md`.
>
> **Was heute davon steht.** Motor 2 (Agent Runtime) und der Kern von Motor 3 (Governance)
> sind grün und mit Befehlen belegt. Motor 1 (Kontext, Retrieval, Connectoren) ist **leer**:
> gemessen am 2026-09-09, `src/kernel/context` und `src/kernel/retrieval` enthalten null
> Dateien.
>
> **Diese Fassung löst die vom 2026-09-08 ab.** Die Etappenreihenfolge hat sich sachlich
> geändert, nicht nur die Nummerierung — die Begründung steht in §8.
>
> **Die Vertikale blockiert nicht mehr den Anfang.** Sie wird in **Etappe 3** gebraucht.
> Etappe 0 bis 2 laufen ohne sie. Das ist das praktischste Ergebnis dieser Fassung.
>
> **Keine Zahl hier stammt aus einem Lauf.** Die Tore nennen Befehle, keine Ergebnisse — die
> Ergebnisse entstehen beim Durchlaufen und gehören nach `evals/reports/`.

---

## 1. Leitprinzip

Zwei Achsen, die **senkrecht** zueinander stehen und einander nicht ersetzen.

**Waagerecht — `kernel` / `domains`.** Wem gehört die Bedeutung? Das ist die teuerste
Entscheidung des Repos und sie bleibt unangetastet.

**Senkrecht — sechs Ebenen, drei Motoren.** Wie weit weg von IO?

| Ebene           | Motor          | `src/kernel/` — Mechanik                       | `src/domains/<domäne>/` — Bedeutung        | Stand   |
| --------------- | -------------- | ---------------------------------------------- | ------------------------------------------ | ------- |
| ① Connectors    | 1 · Kontext    | Ingest-Rahmen, ACL-Erfassung                   | welche Quelle, welches Berechtigungsmodell | ⬜ leer |
| ② Context Layer | 1 · Kontext    | Chunking, Embedding-Aufruf, Envelope-Vererbung | Ontologie, Entitäts- und Relationstypen    | ⬜ leer |
| ③ Retrieval     | 1 · Kontext    | ACL-Filter, hybride Suche, Rerank              | —                                          | ⬜ leer |
| ④ Agent Runtime | 2 · Agent      | Graph, Routing-Verfahren, State, Durable       | Agenten, Prompts, Bremsenreihenfolge       | 🟢 grün |
| ⑤ Action Layer  | 3 · Governance | Queue-Mechanik, Idempotenz, Worker             | Whitelist, Validierer                      | 🟢 grün |
| ⑥ Governance    | 3 · Governance | Guardrail, Auth, Rate-Limit, Trace, Policy     | Guardrail-Muster                           | 🟡 halb |

Daraus folgt die Wachstumsrichtung: **von innen nach außen, nicht in Phasenreihenfolge.**
Der Ausgangstext beginnt bei ① und endet bei ⑥; dieser Plan beginnt dort, wo etwas Grünes
steht, und baut nach außen.

---

## 2. Fünf Zusagen, die dieser Plan nicht brechen darf

| Zusage                                        | Wie der Plan sie hält                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `grep -rn "<domäne>" src/kernel/` bleibt leer | Ontologie und ACL-Abbildung liegen in der Domäne, nur die Retrieval-**Mechanik** im Kern               |
| Mock-Modus: deterministisch, kostenlos, in CI | Der Store ist ein **Port** mit zwei Adaptern (`memory`, `postgres`); das Embedding hat einen Hash-Mock |
| K5: `clone → install → demo` läuft durch      | `npm run demo` benutzt **immer** den `memory`-Adapter. Postgres liegt nur im Produktionspfad           |
| Keine Zahl ohne datierten Lauf                | Jede Etappe bringt **höchstens eine** neue Metrik und hinterlässt einen datierten Bericht              |
| Die HITL-Kante prüft auf exakt `true`         | Keine Etappe fasst `graph/build.js` an, außer die Umbenennung in Etappe 0b — ohne Logikänderung        |

Bricht eine geplante Änderung eine dieser fünf Zusagen, ist nicht die Zusage falsch, sondern
die Änderung — oder es braucht vorher eine ADR, die den Bruch benennt und begründet.

---

## 3. Zielbaum

> **Umgezogen am 2026-09-09.** Der Baum steht jetzt als **Vertrag** in
> `ARCHITECTURE.md` §7 — dort, wo die Autoritätskette ihn sucht. Dieses Dokument ist ein
> Vorschlag und trägt keine Struktur; es trägt die **Reihenfolge**, in der die Ebenen
> gefüllt werden. Zwei Bäume in zwei Dateien driften auseinander, deshalb steht hier keiner
> mehr.

Seit dem Umbau (Etappe 0b) tragen die Verzeichnisse unter `src/kernel/` die Ebenennamen:
`agent/`, `action/`, `governance/` stehen; `connectors/`, `context/` und `retrieval/` sind
die drei Orte, die noch leer sind. `llm/`, `persistence/`, `config/` und `registry.js`
bleiben Infrastruktur außerhalb der Ebenen.

Prüfbefehl und Herleitung der beiden nicht offensichtlichen Zuordnungen
(`checkpointer.js` → `agent/`, Beobachtbarkeit → `governance/`): `ARCHITECTURE.md` §7.

---

## 4. Zehn Architekturentscheidungen

Jede ist ein ADR-Kandidat für `DECISIONS.md` und wandert dort **einzeln** ein, sobald sie
fällt — nicht als Block.

**A1 — Der Retrieval-Store ist ein Port mit zwei Adaptern.** Die wichtigste Entscheidung des
Plans. Der `memory`-Adapter trägt Mock-Modus, CI und K5 allein. pgvector kommt später als
zweiter Adapter dazu. Ohne diese Entscheidung nimmt die erste Retrieval-Zeile dem Repo seine
Grundlage, und sie kommt nicht zurück.

**A2 — Deterministisches Mock-Embedding.** Schicht A misst die **Korrektheit der
Autorisierung**, nicht die Qualität der Einbettung. Ein Vektor aus dem Inhalts-Hash genügt:
kostenlos, deterministisch, in CI. Einbettungsqualität ist Sache von Schicht B.

**A3 — Der ACL-Filter wird in die Query kompiliert, nicht nachgelagert angewandt.** Ein
unberechtigter Chunk verlässt die Datenbank **nie**. Lässt sich Identität oder Richtlinie
nicht auflösen, ist das Ergebnis **leer** — nicht ungefiltert. Fail-closed gilt hier wörtlich,
genau wie an der HITL-Kante.

**A4 — Die Ontologie liegt in der Domäne, die Whitelist leitet sich aus ihr ab.**
`actions.js` wird nicht mehr frei geschrieben, sondern aus den Aktionstypen in `ontology.js`
erzeugt und gegen sie geprüft. Der Kern sieht keinen einzigen Entitätstyp.

**A5 — Die Policy-Engine ersetzt die Bremsen nicht, sie liegt darunter.** Die Bremsen bleiben
die Aussage der Domäne. Die HITL-Bremse bleibt **deterministisch und an erster Stelle**. Die
Engine trägt die Risikoklassifikation, nicht die Routing-Entscheidung.

**A6 — Das Audit-Log ist eine Hash-Kette über dem bestehenden Trace.** Keine neue
Abhängigkeit. Konkreter Schritt Richtung EU AI Act Art. 12: das Ändern einer Zeile bricht die
Kette und wird erkannt.

**A7 — `agentId` und `principal` stehen ab sofort im Schema.** Auch solange es genau einen
statischen Agenten gibt. Begründung wie bei `tenantId` (`EXTEND.md` Schritt 5): das Feld
später nachzuziehen heißt, jede Abfrage neu zu schreiben; heute mitzuführen kostet nichts.

**A8 — MCP ist ein Kanal, keine Werkzeugschicht.** Die Aktions-Queue bleibt das Tor. Der
MCP-Adapter tritt **neben** den HTTP-Adapter, nicht an seine Stelle.

**A9 — Die sechs Ebenen liegen unter `kernel/` und tragen die Namen des Diagramms.** Die
Achse `kernel`/`domains` bleibt die primäre; die Ebenen sind Module darunter. Der Umbau ist
eine **reine Umbenennung** und wird genau einmal durchgeführt, in Etappe 0b. Die Alternative
— `src/` direkt nach den sechs Ebenen zu teilen — würde die Trennlinie aufheben und das
`grep`-Kriterium bedeutungslos machen.

**A10 — `beispiel` bleibt als Referenzdomäne bestehen.** Die echte Vertikale tritt **daneben**,
nicht an ihre Stelle. Nur so bleibt die Zusage „eine zweite Domäne ändert null Zeilen im Kern"
etwas, das wirklich geprüft wird und nicht nur behauptet.

---

## 5. Etappen

Jede Etappe hat ein **Tor**. Ein Tor ist ein Befehl; ein Tor ohne Befehl ist kein Tor.

Jedes Tor enthält denselben Kern — hier einmal genannt, unten nur noch als **Kerntor**:

```bash
npm test && npm run evals && npm run demo
```

### Etappe 0 — Grundlage · vertikalunabhängig

> **Stand 2026-09-09:** 0a erledigt (vier ADRs in `DECISIONS.md`), 0b erledigt (Umbau,
> Prüfkriterium von ADR-0002 grün, Schicht-A-Bericht Byte für Byte identisch). **0c offen.**

Drei Teile, **strikt nacheinander**. Zwei davon gleichzeitig zu fahren heißt: eine rote
Zeile ist weder dem einen noch dem anderen zuzuordnen.

**0a — Die Entscheidungen schreiben.** ADR-0001 (Identität des Projekts) · ADR-0002 (A9,
sechs Ebenen) · ADR-0003 (LangGraph 1.x und die Schwachstellen) · ADR-0004 (A10, `beispiel`
bleibt). Null Zeilen Code.

> **Tor:** `DECISIONS.md` trägt vier ADRs, jede mit einem **Prüfkriterium** — und das
> Prüfkriterium ist ein Befehl, kein Satz.

**0b — Der Umbau.** Die Verzeichnisse nehmen die Ebenennamen aus §3 an. **Reine Umbenennung,
null Logikänderung.** Betroffen sind auch Importpfade in `tests/`, `evals/domains/*/adapter.js`
und die Wegweiser-Tabelle in `CLAUDE.md`.

> **Tor:** Kerntor mit **identischen** Zahlen — `npm run evals` muss dieselben Metriken
> liefern wie der Bericht vom 2026-09-08, nicht nur grüne. Dazu:
> `grep -rn "beispiel" src/kernel/` leer, und jeder in einem Dokument genannte Pfad existiert.
>
> **Verbot:** keine „wo wir schon dabei sind"-Korrektur. Die 101-Zeilen-Funktion in der
> Aktions-Queue und die fünf Verschachtelungsebenen im Checkpointer bleiben, wie sie sind —
> sie gehören zum Lint-Rollout, nicht hierher. Sonst verliert das Tor seine Aussage.

**0c — LangGraph 1.x und `npm audit`.** Heute gepinnt auf 0.2.74, aktuell 1.4.14; `npm audit`
meldet elf Schwachstellen, sechs davon hoch, darunter „LangChain serialization injection
enables secret extraction". Am billigsten jetzt: 98 Tests als Netz, noch keine eigene Domäne.

> **Tor:** Kerntor unverändert **und** `npm audit` meldet `high: 0`.

**Danach, nicht davor:** der Lint-Rollout E0-B aus `docs/engineering-discipline.md` §6.
dependency-cruiser-Regeln werden auf Pfade geschrieben; vor dem Umbau geschrieben, müssten
sie zweimal geschrieben werden.

### Etappe 1 — Das QA-Tor · `pruefer`

`EXTEND.md` Schritt 2, jetzt terminiert. Heute wächst `revisionCount` zwar, aber nichts lehnt
je ab — **Bremse 3 (`MAX_REVISIONS = 5`) feuert im Live-Pfad nie.** Ein Schutzschalter, der
nie auslöst, ist unbelegt.

Neu: ein zweiter Spoke `agents/pruefer.js` mit strukturierter Ausgabe, ein State-Feld
`istFreigegeben` mit `lastWins`, und zwei Bremsen statt einer:
`ergebnis && istFreigegeben == null` → `pruefer` · `ergebnis && istFreigegeben === false` →
`bearbeiter`.

> **Die zwei dokumentierten Fallen.** `null` und `false` gleich zu behandeln lässt den Prüfer
> sich endlos selbst aufrufen, bis das Rekursionslimit greift — `null` heißt „ungeprüft",
> `false` heißt „abgelehnt". Und: Produzent und Prüfer strikt trennen; dasselbe Modell mit
> „schreib und kritisiere dich selbst" findet seine eigene Arbeit gut.

> **Tor:** Die Sequenzen in `evals/domains/beispiel/golden/tasks.json` werden **aus den neuen
> Bremsenregeln neu abgeleitet**, nie an einen beobachteten Lauf angepasst. Ein Fall trägt die
> Erwartung `bearbeiterAufrufe: 2` — der Beweis, dass die Revisionsschleife wirklich läuft.
> Neuer datierter Bericht; der vom 2026-09-08 bleibt als „vor dem Prüfer" stehen und wird
> nicht gelöscht.
>
> Diese Etappe läuft **allein**. Sie ist die einzige, die die Golden-Sequenzen bewegt.

### Etappe 2 — Messbare Autorisierung · ohne Infrastruktur · vertikalunabhängig

Hier entsteht der eigentliche Vorsprung, und er braucht **keine Infrastruktur**: Port plus
`memory`-Adapter, Mock-Embedding, Ingest-Pipeline, Envelope samt Vererbung auf jeden Chunk,
ACL-Filter, Filterung in **beiden** Pfaden der hybriden Suche.

`principal` entsteht hier als **Typ** und wird aus Fixtures gespeist — nicht aus einem
Verzeichnis. Das ist der Grund, warum diese Etappe die Vertikale nicht braucht: die
Erwartungen im Datensatz werden aus einem **Regelwerk** abgeleitet (Benutzer, Gruppen,
Dokumente, Sichtbarkeiten), nicht aus einer echten Organisation.

Neue Metrik in `EVALS.md`:

> **3.13 Unauthorized-Retrieval-Rate · Ziel 0 %**
> Datensatz: `(principal, Anfrage, erwartete sichtbare doc_ids)`. Erwartungen **aus den
> ACL-Regeln abgeleitet**, nie aus einem Lauf. Cross-Tenant- und Cross-User-Leckfälle sind
> Pflicht, nicht optional.

> **Tor:** `npm run evals` → **3.13 = 0 %** · `npm run demo` läuft weiterhin **ohne jede
> Infrastruktur** (K5 bleibt grün) · `grep -rn "<domäne>" src/kernel/` weiterhin leer — der
> Beweis, dass keine Ontologie in den Kern gerutscht ist.

### Etappe 3 — Die Vertikale · erster Connector · Postgres

**Hier und erst hier wird die Vertikale gebraucht.** `PRODUCT.md` §1, §2, §3.1, §3.2 und §7
werden gefüllt. Ontologie-Entwurf: 5–9 Entitäten, 10–20 Relationen, erste Liste der
Aktionstypen. Dann **eine** Quelle — die mit der schwierigsten ACL. Drei einfache Connectoren
lehren zusammen weniger als ein schwerer.

Neu: `domains/<domäne>/` als Geschwister von `beispiel`, `connectors/<quelle>.js` mit
ACL-Erfassung, `context/store/postgres.js`, echtes Embedding, **Ausbreitung von
Berechtigungsentzug**.

> **Tor:** `grep -c "VORLAGE\|<!-- " PRODUCT.md` → 0 · dieselbe Eval-Suite gegen den
> Postgres-Adapter → **3.13 weiterhin 0 %** · **Entzugstest**: Berechtigung in der Quelle
> zurückgenommen → innerhalb von N Sekunden nicht mehr auffindbar. _Eine veraltete
> „gelöschte" Kopie ist ein echter Leckvektor._ · `grep -rn "<neue-domäne>" src/kernel/` leer.
>
> **Entscheidungspunkt K5 → ADR erforderlich.** (a) Die Demo bleibt auf dem `memory`-Adapter,
> K5 bleibt grün — **Empfehlung**; (b) K5 wird bewusst außer Kraft gesetzt. Per Entscheidung,
> nicht aus Versehen.

### Etappe 4 — Identität, Policy, Audit

`principal` wird echt: Auflösung gegen ein Verzeichnis, TTL-begrenzt, **kein Dauer-Cache**.
Dazu `policy/engine.js` und `policy/risk.js`, das Genehmigungs-Timeout mit **Voreinstellung
deny**, und `audit/log.js` als Hash-Kette mit Aufbewahrungsfrist.

> **Tor:** Test — Identität nicht auflösbar → **leeres Ergebnis und kein einziger LLM-Aufruf**
> (fail-closed vor den Kosten) · Test — abgelaufene Genehmigung → deny, **nichts eingereiht,
> nichts zugestellt** · Test — das Ändern einer Audit-Zeile bricht die Kette und wird erkannt ·
> neue Metrik **3.15 Durchsetzung des Genehmigungs-Timeouts = 100 %** · 3.13 unverändert.

### Etappe 5 — Aktionsfläche: von der Ontologie zur Whitelist

A4 wird eingelöst: `actions.js` wird aus den Aktionstypen in `ontology.js` **erzeugt** und
gegen sie geprüft. Was nicht als Aktionstyp modelliert ist, kann kein Agent auslösen — der
Gedanke, den der Ausgangstext aus Palantirs Ontology zieht.

> **Tor:** Test — ein Aktionstyp, der nicht in der Ontologie steht, wird **vor** dem Schreiben
> in die Queue abgelehnt · **3.2 Unauthorized-Action-Rate bleibt 0 %** bei erweiterter
> Aktionsfläche. Keine neue Metrik: 3.2 misst das bereits, sie muss nur unter Last standhalten.

### Etappe 6 — An Auslöser gebunden, nicht an einen Kalender

Keiner dieser Punkte beginnt zu einem Datum, sondern wenn eine **Bedingung** eintritt. Jeder
verlangt eine ADR vor der ersten Zeile Code.

| Was                            | Auslöser                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Temporal (Durable Execution)   | Ein auf Genehmigung wartender Ablauf überdauert regelmäßig die Lebensdauer eines Prozesses |
| MCP-Kanal                      | Ein zweiter Konsument existiert · die ADR muss festhalten, ob `approve` angeboten wird     |
| `recherche`-Knoten             | Retrieval steht (Etappe 2) — vorher wäre es ein LLM-Aufruf mit einem selbstbewussten Namen |
| Zweiter Agent / A2A            | Die Bremsen einer Domäne überschreiten ~10 und lassen sich sauber teilen                   |
| Agent-Registry / Control Plane | ~50 Agenten — auch der Ausgangstext empfiehlt, bis dahin zu verzichten                     |

---

## 6. Zuordnung Etappe → Metrik

Die Umsetzung der Regel „ein Defekt pro Änderung" auf den Plan. **Höchstens eine neue Metrik
je Etappe** — sonst ist nicht zuzuordnen, welche Änderung welche Zahl bewegt hat.

| Etappe | Neue Metrik                                 | Was unverändert bleiben muss        |
| ------ | ------------------------------------------- | ----------------------------------- |
| 0      | — (reines Regressionstor)                   | **alles**, Zahl für Zahl            |
| 1      | Baseline neu — der Prüfer bewegt die Wege   | 3.1 = 100 %, 3.2 = 0 %, 3.3 = 100 % |
| 2      | **3.13 Unauthorized-Retrieval-Rate**        | 3.1–3.4, K5                         |
| 3      | 3.14 Latenz des Berechtigungsentzugs        | 3.13, 3.1–3.4                       |
| 4      | 3.15 Durchsetzung des Genehmigungs-Timeouts | alle                                |
| 5      | — (3.2 unter erweiterter Aktionsfläche)     | alle                                |

---

## 7. Dauerhaft außerhalb des Umfangs

Kandidaten für `PRODUCT.md` §3.2:

Connector-Marktplatz · eigene Vektordatenbank · eigener Identitätsanbieter ·
Agent-Registry als Produkt · Abrechnungsinfrastruktur für Outcome-Pricing · Multi-Cloud ·
Sandbox für agentenerzeugten Code (die Agenten erzeugen keinen Code) · Synthetische
Golden-Datensätze (Erwartungen werden aus Regeln abgeleitet).

---

## 8. Wo dieser Plan abweicht

### Vom Ausgangstext

Der Ausgangstext ordnet: Phase 1 Retrieval mit echten Daten, Phase 2 Aktionen, Phase 3
Governance. Dieser Plan kehrt das um. Die Begründung in einem Satz: **das einzige fertige
Stück ist Motor 3, und die Korrektheit der Autorisierung muss messbar sein, bevor echte Daten
ankommen.**

Vier weitere Abweichungen:

- Der Ausgangstext schlägt drei Connectoren zugleich vor. Dieser Plan nimmt **einen** — den
  mit der schwierigsten ACL. Trägt die ACL dort, trägt sie überall.
- Der Ausgangstext setzt pgvector in die MVP. Hier steht in Etappe 2 der `memory`-Adapter,
  damit die Messung kostenlos und in CI bleibt; Postgres kommt in Etappe 3 als zweiter Adapter.
- Der Ausgangstext stellt Temporal und einen MCP-Gateway als Bausteine der Zielarchitektur dar.
  Hier sind sie an Auslöser gebunden: der Checkpointer überlebt bereits eine Prozessgrenze, die
  Aktions-Queue ist die Frühform des Gateways. Etwas Grünes gegen etwas Ungemessenes zu
  tauschen ist kein Fortschritt.
- Der Ausgangstext nennt in §35 einen Ablauf `researcher → writer → critic → fileSaver →
publisher`. Dieser existiert in diesem Repo **nicht** (`grep` über `src/` findet keinen
  dieser Namen) — er stammt aus dem Projekt, aus dem dieses geklont wurde. Übernommen wird
  daraus nur der Prüfer, unter dem Namen `pruefer`, in Etappe 1.

### Von der eigenen Fassung vom 2026-09-08

Die Reihenfolge hat sich **sachlich** geändert, nicht nur in der Nummerierung:

| Fassung 2026-09-08          | Jetzt               | Grund                                                                                              |
| --------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| Etappe 0 — Vertikale wählen | → Etappe 3          | Etappe 2 misst die ACL-Mechanik gegen **regelabgeleitete Fixtures**, nicht gegen eine Organisation |
| Etappe 1 — eigene Domäne    | → entfällt          | A10: `beispiel` bleibt; die echte Domäne kommt mit der Vertikale                                   |
| Etappe 2 — Identität        | → Etappe 4          | `principal` als **Typ** genügt für den Filter; die echte Auflösung kommt mit echten Daten          |
| Etappe 3 — Kontextkern      | → Etappe 2          | Die Moat-Metrik 3.13 soll so früh wie möglich laufen                                               |
| —                           | Neu: Etappe 0 und 1 | Grundlage (ADRs, Umbau, Abhängigkeiten) und das QA-Tor                                             |

Der Kern des Umdenkens: **die alte Fassung nahm an, der ACL-Filter brauche eine echte
Identität.** Er braucht einen Principal — und in Schicht A kommt der aus dem Datensatz. Damit
läuft die wichtigste Messung des Projekts Monate früher.

---

## 9. Verhältnis zu den anderen Dokumenten

- **`ARCHITECTURE.md` ist der Vertrag, dieses Dokument der Vorschlag.** In der Autoritätskette
  steht `ARCHITECTURE.md` auf Stufe 2, dieses Dokument gar nicht. Konkret: der Zielbaum aus §3
  zieht nach dem Umbau (Etappe 0b) nach `ARCHITECTURE.md` §7 und wird hier gekürzt; die
  offenen Punkte aus §4 ziehen als ADRs nach `DECISIONS.md`. Was hier stehen bleibt, ist die
  **Reihenfolge** — sie gehört in keinen der beiden.
- `ARCHITECTURE.md` §4 („Bekannte Grenzen") wird in Etappe 0 ergänzt: die
  Abhängigkeits-Schwachstellen, der Versionsrückstand und die zwei Lint-Befunde stehen dort
  heute noch nicht.
- `EXTEND.md` beschreibt, wie **ein Gerüst** wächst. Etappe 1 hier ist `EXTEND.md` Schritt 2;
  Etappe 6 verweist auf die Schritte 3, 4 und 6. Ein Widerspruch zwischen beiden Dateien ist
  ein Defekt — bei Konflikt gewinnt `EXTEND.md`.
- `docs/engineering-discipline.md` trägt das **Wie** (Lint, Abhängigkeitsregeln, Typprüfung,
  Rand-Parsing). Sein Rollout läuft parallel, mit **einer** harten Kopplung: **E0-B kommt nach
  Etappe 0b**, weil dependency-cruiser-Regeln auf Pfade geschrieben werden.
- `documentation.md` (türkisch) erzählt den Stand für Menschen. Es wird nach jedem Block
  nachgezogen, nie vorher — ein Bericht über einen Zustand, den es noch nicht gibt, ist
  schlimmer als keiner.

---

## 10. Die offenen Entscheidungen

| Frage                                                  | Blockiert | Fällt in |
| ------------------------------------------------------ | --------- | -------- |
| **Welche Vertikale?** Ontologie, ACL-Modell, Connector | Etappe 3  | Etappe 3 |
| K5 nach dem Postgres-Adapter: halten oder aufgeben?    | Etappe 3  | Etappe 3 |
| Vollständige TypeScript-Migration?                     | nichts    | offen    |
| Zweiter Kanal (MCP): darf er `approve` anbieten?       | Etappe 6  | Etappe 6 |

Etappe 0, 1 und 2 brauchen **keine** dieser Antworten. Sie können heute beginnen.
