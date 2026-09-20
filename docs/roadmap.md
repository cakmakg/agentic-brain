# Ausbauplan

> **Was dieses Repo wird.** Ein **permission-aware Enterprise Context Layer** mit
> agentischer Prozessautomatisierung und einer Agent Control Plane. Das ist eine
> Produktentscheidung, kein Gerüst mehr — sie gehört als ADR-0001 nach `DECISIONS.md`.
>
> **Was heute davon steht.** Stand 2026-09-13, nach Etappe 3d: **alle sechs Ebenen sind
> belegt und gemessen.** Motor 1 (Kontext, Retrieval, Connectoren) war am 2026-09-09 noch
> leer und ist es nicht mehr — Etappe 2 füllte ② und ③, Etappe 3b Ebene ①. Store und
> Embedding sind seither je ein Port mit zwei Adaptern (3c, 3d). Offen: **der Voyage-Lauf
> selbst** (kein Schlüssel) und echte Identitäten (4).
>
> **Die Sofortmaßnahme (§5) ist am 2026-09-14 gefallen.** Der HTTP-Adapter wandelte
> `"approved": "false"` in eine Genehmigung um; jetzt ist nur ein JSON-Boolean `true` eine
> Genehmigung, jeder Nicht-Boolean endet mit 400. Als Nächstes Etappe 4a.
>
> **Diese Fassung löst die vom 2026-09-08 ab und erweitert die vom 2026-09-10.** Die
> Etappenreihenfolge hat sich damals sachlich geändert, nicht nur die Nummerierung. Am
> 2026-09-13 kamen mit dem Abgleich gegen den Ausgangstext die Teilung von Etappe 4, die
> Etappen 7 bis 14 und die Entscheidungskandidaten A11 bis A19 dazu. Beide Begründungen stehen
> in §8.
>
> **Die Vertikale hat den Anfang nicht blockiert, und das hat sich bewährt.** Sie wurde erst
> in **Etappe 3a** gebraucht und ist dort gefallen (ADR-0010). Etappe 0 bis 2 liefen ohne
> sie — das praktischste Ergebnis dieser Fassung, im Nachhinein bestätigt.
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
| ① Connectors    | 1 · Kontext    | Connector-Port, Synchronisation                | welche Quelle, welches Berechtigungsmodell | 🟢 grün |
| ② Context Layer | 1 · Kontext    | Chunking, Embedding-Aufruf, Envelope-Vererbung | Ontologie, Entitäts- und Relationstypen    | 🟢 grün |
| ③ Retrieval     | 1 · Kontext    | ACL-Filter, hybride Suche, Rerank              | —                                          | 🟢 grün |
| ④ Agent Runtime | 2 · Agent      | Graph, Routing-Verfahren, State, Durable       | Agenten, Prompts, Bremsenreihenfolge       | 🟢 grün |
| ⑤ Action Layer  | 3 · Governance | Queue-Mechanik, Idempotenz, Worker             | Whitelist, Validierer                      | 🟢 grün |
| ⑥ Governance    | 3 · Governance | Guardrail, Auth, Rate-Limit, Trace, Policy     | Guardrail-Muster                           | 🟡 halb |

Daraus folgt die Wachstumsrichtung: **von innen nach außen, nicht in Phasenreihenfolge.**
Der Ausgangstext beginnt bei ① und endet bei ⑥; dieser Plan beginnt dort, wo etwas Grünes
steht, und baut nach außen.

**Ab Etappe 7 erreicht dieses „außen" zum ersten Mal echte Systeme** — eine echte Quelle, ein
echtes Zielsystem, ein echter Kanal. Bis Etappe 6 wuchs der Plan in Ebenen, ab Etappe 7 wächst
er in Nutzen. Die Ebenen bleiben dieselben: kein Schritt ab Etappe 7 braucht eine siebte.

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

Zwei Ergänzungen vom 2026-09-13, beide ohne eine Zusage zu ändern:

- **Die Grenze der ersten Zusage gilt ab Etappe 7 auch für Quell- und Zielsysteme.** Kein
  Systemname gehört in den Kern: `grep -rniE "gdrive|jira|slack|teams" src/kernel/` bleibt
  leer. Protokollzugriff liegt in `src/adapters/`, Bedeutung in der Domäne.
- **Genau eine geplante Etappe bricht eine Zusage: 14b bricht Zusage 5.** Sie beginnt deshalb
  mit einer ADR, die den Bruch benennt (A19). Alle anderen Etappen bis 14a halten alle fünf —
  auch Etappe 11, die einen neuen Genehmigungskanal bringt, fasst `build.js` nicht an.

---

## 3. Zielbaum

> **Umgezogen am 2026-09-09.** Der Baum steht jetzt als **Vertrag** in
> `ARCHITECTURE.md` §7 — dort, wo die Autoritätskette ihn sucht. Dieses Dokument ist ein
> Vorschlag und trägt keine Struktur; es trägt die **Reihenfolge**, in der die Ebenen
> gefüllt werden. Zwei Bäume in zwei Dateien driften auseinander, deshalb steht hier keiner
> mehr.

Seit dem Umbau (Etappe 0b) tragen die Verzeichnisse unter `src/kernel/` die Ebenennamen.
Seit dem 2026-09-10 sind alle sechs belegt: `connectors/`, `context/`, `retrieval/`,
`agent/`, `action/`, `governance/`. `llm/`, `persistence/`, `config/` und `registry.js`
bleiben Infrastruktur außerhalb der Ebenen. Der einzige noch leere Ort im Baum ist
`context/store/postgres.js` (Etappe 3c).

Prüfbefehl und Herleitung der beiden nicht offensichtlichen Zuordnungen
(`checkpointer.js` → `agent/`, Beobachtbarkeit → `governance/`): `ARCHITECTURE.md` §7.

---

## 4. Architekturentscheidungen

Jede ist ein ADR-Kandidat für `DECISIONS.md` und wandert dort **einzeln** ein, sobald sie
fällt — nicht als Block. A1 bis A10 stammen aus der Fassung vom 2026-09-08; A11 bis A19 kamen
am 2026-09-13 mit dem Abgleich gegen den Ausgangstext dazu (§8).

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

**A11 — Eine Aktion übersteigt nie die Rechte des Principals, in dessen Namen sie läuft.**
Heute filtert die Suche je Principal, die Aktions-Queue aber nur je Domäne: die Whitelist sagt,
_welcher_ Aktionstyp erlaubt ist, nicht _für wen_ und _wo_. Ein Agent, der für Anna ein Ticket
in einem Projekt anlegt, auf das Anna keinen Zugriff hat, ist ein „confused deputy". Die
Mechanik (Principal an der Aktion, Prüfung vor dem Schreiben) liegt im Kern, die Politik
(wer darf was wo) in der Domäne. → Etappe 4b.

**A12 — Eine Genehmigung ist ein Entscheidungsobjekt, kein Boolean.** Sie trägt, **wer**
genehmigt hat, und optional einen vom Menschen **bearbeiteten** Entwurf. Ein bearbeiteter
Entwurf hat den Prüfer nie gesehen — er durchläuft deshalb `vertrag.js` und die Validierer der
Queue **erneut**. Der Trace trägt weiter keinen Volltext: vom Unterschied zwischen Entwurf und
genehmigter Fassung landet nur eine Zahl dort (`ARCHITECTURE.md` §5). → Etappe 4d, genutzt ab 9.

**A13 — Hybride Synchronisation: Änderungsabruf plus periodischer Abgleich.** Echte Quellen
drosseln ihre APIs; eine vollständige Momentaufnahme je Zyklus ist bei großen Quellen nicht
tragbar — ADR-0016 hat die Kosten des Einbettens gelöst, nicht die des Holens. Zwischen zwei
Abgleichen werden nur Änderungen geholt; der **Abgleich** bleibt der atomare Ersatz aus
ADR-0011 und fängt, was ein Änderungsabruf verschweigt (Entzüge, Löschungen). Die
Entzugszusage bleibt strukturell, ihre Dauer wird durch das Abgleichsintervall begrenzt.
Löst ADR-0011 teilweise ab. → Etappe 7.

**A14 — Der Überfreigabe-Bericht entsteht im Synchronisationszyklus, nicht über einen
zweiten Leseweg.** `store/index.js` hat bewusst genau einen Leseweg, und der verlangt einen
Principal. Ein Bericht über alle Envelopes würde ihn umgehen. Der Zyklus hält vor
`ersetzeQuelle` ohnehin jede Envelope der Quelle in der Hand — dort wird der Bericht gebaut.
Er enthält Metadaten, **nie** Inhalte. → Etappe 8.

**A15 — Schicht C misst Nutzen, ist aber kein Tor.** Schicht A misst Regeln, Schicht B einen
Ausgabevertrag; ob das System Arbeit spart, misst nichts. Schicht C tut es aus echter Nutzung,
ohne LLM-Urteil, in einem eigenen Namensraum (C.1 bis C.5). Weil ihre Zahlen von Menschen und
nicht vom Code abhängen, taugen sie nicht als Tor und zählen nicht gegen „höchstens eine neue
Metrik je Etappe" (§6). → Etappe 9.

**A16 — Die Ausführer-Naht: die Domäne liefert den Aufruf, der Kern Timeout, Wiederholung und
Idempotenz.** Der echte externe Aufruf steht heute als Kommentar im Kern (`action/queue.js`).
Ein Jira-Aufruf darf dort nicht stehen — sonst stünde „jira" im Kern. Wie die Validierer liefert
die Domäne je Aktionstyp einen Ausführer; ein echter Ausführer ist opt-in, die Voreinstellung
simuliert (K5). Aus sechs Nahtstellen werden sieben. → Etappe 10.

**A17 — Außerhalb von HTTP genehmigt nur ein Mensch mit aufgelöster Identität, nie ein
Werkzeug.** Eine Genehmigung, die nicht dort ankommt, wo Menschen arbeiten, wird nicht erteilt.
Ein Knopf in Slack oder Teams, den ein über SSO aufgelöster Mensch drückt und dessen Signatur
der Server prüft, gibt die HITL-Zusage **nicht** an ein Modell ab. Ein MCP-Werkzeug, das
`approve` anbietet, täte es (`EXTEND.md` Schritt 4) — MCP bleibt ohne `approve`. Hebt das
Nicht-Ziel „kein `approve` über einen zweiten Kanal" für genau diesen Fall auf. → Etappe 11.

**A18 — „Ein Agent je Mitarbeiter" ist ein Principal-Kontext, keine Agent-Registry.** Kein
Mitarbeiter will eine eigene Software; er will seine eigenen Aufgaben an einem Ort. Dieselben
Agenten laufen **im Namen** jedes Mitarbeiters, mit seiner Identität und seinen Rechten. Das
Nicht-Ziel „keine Agent-Registry, solange die Zahl der Agenten klein ist" bleibt bestehen, und
der Auslöser aus Etappe 6 (~50 Agenten) wird dadurch nicht erreicht. → Etappe 12.

**A19 — Risikostufen: die HITL-Zusage gilt ab Stufe 2, und Autonomie wird verdient.** Jede
Außenwirkung zu genehmigen hat einen Preis, den 3.1 nicht misst: Genehmigungsmüdigkeit, also
Freigaben ohne Lesen. Stufe 0 (nur für den Nutzer sichtbar) läuft ohne Genehmigung; Stufe 1
(intern, zurücknehmbar) läuft mit Rücknahmefenster; Stufe 2 (für andere sichtbar oder
unumkehrbar) hält beim Menschen an. Ein Aktionstyp steigt nur auf, wenn Schicht-C-Daten es
über einen festgelegten Zeitraum stützen, und nur durch eine menschliche Entscheidung. **Bricht
Zusage 5 (§2) und `PRODUCT.md` Ziel 4 und K1** — geht nur per ADR, die den Bruch benennt.
**Ausdrücklich verboten** ist die Abkürzung, eine Bremse `humanApproval: true` schreiben zu
lassen: sie ließe `build.js` unberührt und gäbe die Entscheidung trotzdem aus der Hand.
→ Etappe 14.

---

## 5. Etappen

Jede Etappe hat ein **Tor**. Ein Tor ist ein Befehl; ein Tor ohne Befehl ist kein Tor.

Jedes Tor enthält denselben Kern — hier einmal genannt, unten nur noch als **Kerntor**:

```bash
npm test && npm run evals && npm run demo
```

### Etappe 0 — Grundlage · vertikalunabhängig

> **Stand 2026-09-09:** 0a erledigt (vier ADRs in `DECISIONS.md`), 0b erledigt (Umbau,
> Prüfkriterium von ADR-0002 grün, Schicht-A-Bericht Byte für Byte identisch), 0c erledigt
> (LangGraph 1.4.14, `npm audit` `high: 0`, Prüfkriterium von ADR-0003 grün).
> **Etappe 0 ist damit geschlossen.**

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

**0c — LangGraph 1.x und `npm audit`.** 🟢 **Erledigt am 2026-09-09.** Vorher auf 0.2.74
gepinnt, `npm audit` elf Schwachstellen, sechs davon hoch, darunter „LangChain serialization
injection enables secret extraction". Jetzt: `@langchain/langgraph` 1.4.14, `@langchain/core`
1.2.9, `@langchain/anthropic` 1.5.9. Die 98 Tests waren das Netz, wie vorhergesagt.

> **Tor:** Kerntor unverändert **und** `npm audit` meldet `high: 0`. — 🟢 `npm test` 98/98,
> Schicht-A-Bericht in **allen** Metriken identisch (einziger Unterschied: der Zeitstempel),
> `npm run demo` Exit 0, `high: 0`.
>
> **Was der Plan nicht vorhergesehen hatte:** LangGraph 1.x verlangt `zod ^3.25.32` als
> Peer — `zod` musste von 3.23.8 auf 3.25.76 mit, bleibt aber in v3. Und die einzige
> Bruchstelle im Quellcode war nicht das State-Schema, sondern der Checkpointer:
> `serde.dumpsTyped` ist in 1.x **asynchron** geworden. Zwei Aufrufstellen, sonst nichts.

**Danach, nicht davor:** der Lint-Rollout E0-B aus `docs/engineering-discipline.md` §6.
dependency-cruiser-Regeln werden auf Pfade geschrieben; vor dem Umbau geschrieben, müssten
sie zweimal geschrieben werden.

### Etappe 1 — Das QA-Tor · `pruefer`

> **🟢 Erledigt am 2026-09-09.** Belegt: `npm test` 107/107 (vorher 98) bei 91,47 % ·
> Schicht A **22/22** vertragstreu, zwei Durchgänge identisch · 3.1 = 100 %, 3.2 = 0 %,
> 3.3 = 100 %, 3.4 = 100 % — alle vier wie gefordert unverändert · `npm run demo` Exit 0 ·
> `grep -rn "beispiel" src/kernel/` leer · ESLint unverändert 12 Warnungen / 0 Fehler.
>
> **Die Baseline hat sich bewegt, und zwar erwartungsgemäß:** Kosten je Lauf
> 0,000999 → 0,001884 USD, Kontextwachstum ×1,00 → Median ×2,79 (p90 ×2,94, Spitze 101
> Token). Beides ist der Preis des zweiten LLM-Aufrufs je Lauf; keine der vier
> Zusagemetriken hat sich bewegt.

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
>
> **Eingelöst:** `RV-1` trägt `bearbeiterAufrufe: 2`. Dazu kam ein Fall, den der Plan nicht
> verlangt hatte: `SS-1` lässt den Prüfer **dauerhaft** ablehnen und belegt damit, dass
> Bremse 3 wirklich auslöst — genau die Lücke, aus der diese Etappe ihre Begründung zieht.
> Ein Schutzschalter, der nur beim Einzeltest der Bremse feuert, ist halb belegt.
>
> **Was der Plan nicht vorhergesehen hatte:** der Bearbeiter muss `istFreigegeben` bei jeder
> neuen Fassung auf `null` zurücksetzen. Ohne das bleibt das Feld auf `false` stehen, die
> Ablehnungs-Bremse greift sofort wieder, und der Bearbeiter ruft sich selbst auf — dieselbe
> Endlosschleife wie die dokumentierte Falle, nur eine Bremse weiter. Nachgetragen in
> `EXTEND.md` Schritt 2.

### Etappe 2 — Messbare Autorisierung · ohne Infrastruktur · vertikalunabhängig

> **🟢 Erledigt am 2026-09-09.** Belegt: `npm test` **138/138** (vorher 107) bei 92,45 % ·
> Schicht A **28/28** vertragstreu (22 Aufgaben + 6 Abrufe), zwei Durchgänge identisch ·
> **3.13 = 0 %** bei Nenner 10 · 3.1 = 100 %, 3.2 = 0 %, 3.3 = 100 %, 3.4 = 100 % unverändert ·
> `npm run demo` Exit 0 **ohne jede Infrastruktur** (K5) · `grep -rn "beispiel" src/kernel/`
> leer · ESLint unverändert 12 Warnungen / 0 Fehler.
>
> **3.13 kann rot werden — nachgewiesen, nicht behauptet.** Mutationsprobe: nimmt man die
> Mandantenprüfung aus `filter.js`, springt die Zahl auf **37,5 %**, fünf Fälle melden ihr
> Leck namentlich, und der Lauf endet mit Rückgabewert 1. AC-5 fängt dabei genau das, wofür
> der Fall gebaut ist: `d-finanz` fließt an eine Benutzerin desselben Gruppennamens im
> **anderen** Mandanten.
>
> **Fünf ADRs sind dabei gefallen:** ADR-0005 (hexagonale Achse, löst einen Widerspruch
> zwischen `ARCHITECTURE.md` §7 und `docs/engineering-discipline.md` auf) · ADR-0006 (Port
> mit zwei Adaptern) · ADR-0007 (Hash-Embedding) · ADR-0008 (Filter in die Abfrage
> kompiliert, fail-closed) · ADR-0009 (Envelope-Vererbung, Principal im Schema).
>
> **Ebene ① `connectors/` bleibt leer** — sie kommt mit der Vertikale in Etappe 3. Das ist
> die Abgrenzung, die ADR-0005 ausdrücklich zieht.

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

> **In vier Teile geschnitten am 2026-09-10, aus demselben Grund wie Etappe 0.** Die Etappe
> fasste ursprünglich fünf Dinge auf einmal an, davon drei, die dieselbe Zusage berühren
> (3.13): Connector, Postgres-Adapter und echtes Embedding. Bewegt sich die Zahl, wäre nicht
> zuzuordnen, welches der drei sie bewegt hat — genau das, was §6 verhindern soll, von der
> anderen Seite gelesen.

**3a — Die Vertikale und die Ontologie.** 🟢 **Erledigt am 2026-09-10.** Die letzte offene
Produktentscheidung ist gefallen: **Besprechungsnotiz → Aktionspunkt → Ticket**, Quelle ist
ein geteiltes Notizenlaufwerk (ADR-0010). `PRODUCT.md` ist vollständig gefüllt, die Ontologie
steht mit 7 Entitäten, 14 Relationen und 3 Aktionstypen.

> **Tor:** `grep -c` über die Vorlagenmarken in `PRODUCT.md` → 0 (Befehl im Prüfkriterium von
> ADR-0010; er steht bewusst **nicht** in `PRODUCT.md` selbst — ein Prüfbefehl, der seine
> eigene Suchmarke enthält, findet sich selbst). — 🟢 0 Marken, Trennlinie leer.

**3b — Der erste Connector und die Ausbreitung des Entzugs.** 🟢 **Erledigt am 2026-09-10.**
Ebene ① ist gefüllt: `kernel/connectors/` mit Port und Synchronisation, `store.ersetzeQuelle`,
die Domäne `besprechung` als Geschwister von `beispiel` mit `acl.js`, `ontology.js`,
`vertrag.js` und `connectors/notizlaufwerk.js`. Die Envelope kennt Einzelfreigaben (ADR-0012).
Neue Metrik **3.14**.

> **Tor:** Kerntor · `npm run evals` → **3.14 = 0 %** · **3.13 und 3.1–3.4 unverändert** ·
> `grep -rn "besprechung" src/kernel/` leer · K5 grün.
>
> **Eingelöst:** `npm test` **179/179** (vorher 138) bei 92,46 % · Schicht A **28/28** für
> `beispiel` in **jeder Metrik identisch** zum 2026-09-09 und **32/32** für `besprechung` ·
> 3.14 = 0 % (0/6) nach **einem** Zyklus · 3.13 = 0 % (0/10 bzw. 0/16) · `npm run demo`
> Exit 0 ohne Infrastruktur.
>
> **Mutationsprobe, beide Richtungen.** `ersetzeQuelle` anhängen statt ersetzen — der
> klassische Delta-Sync-Fehler — treibt 3.14 auf **83,3 %** mit 7 veralteten Chunks und
> Rückgabewert 1. `ersetzeQuelle` alles verwerfen lassen hält 3.14 bei 0 % und lässt die
> **Vertragstreue** auf 26/32 fallen. Die Zahl kann rot werden, und ihre Gegenrichtung auch.
>
> **Was der Plan nicht vorhergesehen hatte:** das Envelope-Modell reichte nicht. Eine Freigabe
> an eine **Person** — der geteilte Link, die nachträglich eingeladene Teilnehmerin — ist in
> `oeffentlich | gruppe | privat` nicht ausdrückbar. Das kostete eine eigene ADR (0012) und
> eine Regel im Kern. Die naheliegende Alternative, je Dokument eine Pseudo-Gruppe zu bauen,
> hätte den Filter formal unverändert gelassen und die Gruppenliste des Principals mit der
> Zahl der Einzelfreigaben wachsen lassen.

**3c — Postgres-Adapter.** 🟢 **Erledigt am 2026-09-10.** `context/store/postgres.js` mit
pgvector tritt **neben** `memory`. `ersetzeQuelle` stellt seine Atomarität mit einer
Transaktion her — im Arbeitsspeicher war sie geschenkt (ADR-0011). Der Entscheidungspunkt
K5 ist als **ADR-0013** gefallen: `memory` bleibt die Voreinstellung, K5 bleibt grün,
Postgres wird ausdrücklich verlangt.

> **Tor:** dieselbe Eval-Suite gegen den Postgres-Adapter → **3.13 und 3.14 unverändert**.
>
> **Eingelöst:** `npm run evals` (Store: memory) und `npm run evals:postgres`
> (Store: postgres) liefern in **jeder** Metrik dieselben Zahlen — 3.13 = 0 % (0/10 und
> 0/16), 3.14 = 0 % (0/6), Vertragstreue 28/28 und 32/32, beide Durchgänge identisch.
> `npm test` **191** Tests: 185 bestanden, 6 übersprungen ohne Datenbank, 0 gefallen.
> `npm run demo` Exit 0 ohne Infrastruktur. ESLint unverändert 15 Warnungen / 0 Fehler.
>
> **Die Etappe zerfiel in drei Schritte, und das war nötig.** 3c-1: der Store-Port wurde
> **asynchron** — rein mechanisch, mit dem Tor „alle Zahlen identisch", wie beim Ebenenumbau
> in Etappe 0b. 3c-2: die ACL-Regeln bekamen **zwei Kompilate aus einer Quelle** (ADR-0014),
> ebenfalls mit unveränderter 3.13. Erst 3c-3 brachte den Adapter. Hätte man alles zugleich
> gefahren, wäre eine Abweichung keinem der drei zuzuordnen gewesen.
>
> **Was der Plan nicht vorhergesehen hatte:** dass der Adapter der kleinere Teil ist. Die
> eigentliche Frage war, wo die ACL-Regeln leben, wenn zwei Speicher sie brauchen. Zwei
> Implementierungen driften unbemerkt auseinander, und 3.13 misst je Adapter nur seine
> eigene Hälfte — beide melden 0 %, während sie Verschiedenes bedeuten. Die Antwort steht in
> ADR-0014, und sie ist gemessen: eine Mutation **nur** im SQL-Kompilat lässt den
> memory-Lauf grün und treibt den Postgres-Lauf auf **33,3 %** mit Rückgabewert 1.
>
> **Zweite Lehre, teurer als sie aussieht:** der erste Test für die Klammerung der
> SQL-Disjunktion war grün, obwohl der Defekt drin war — die Regeln bringen eigene Klammern
> mit und täuschten die Regex. Erst ein echter Klammerzähler fing die Mutation. Ein Test,
> der nie rot wird, misst nichts; das gilt auch für einen, der gerade erst geschrieben wurde.

**3d — Echtes Embedding.** 🟡 Gebaut und gemessen, **eine Hälfte des Tors steht aus**. Zerfiel
in zwei Schritte mit je eigenem Tor.

> **Die Etappe hat ihre eigene Überschrift widerlegt.** „Tauscht den Hash gegen einen
> Modellaufruf" war der Plan; ein Tausch hätte Schicht A und K5 mitgenommen. Es wurde ein
> **Port mit zwei Adaptern** (ADR-0015) — dieselbe Antwort wie beim Chunk-Speicher, und aus
> demselben Grund.
>
> **3d-1 — Der Port und der zweite Adapter.** 🟢 `embedding/index.js` mit den zwei Arten
> `dokument` und `anfrage`, `hash` als Voreinstellung, `voyage` opt-in über
> `EMBEDDING_ADAPTER`. Kein npm-Paket: Voyage hat eine HTTP-API, Node bringt `fetch` mit.
> Warum Voyage und nicht Anthropic — weil es kein Anthropic-Embedding gibt; die Doku sagt es
> wörtlich und empfiehlt Voyage.
>
> **3d-2 — Die Delta-Sync-Frage, und sie ist anders gefallen als geplant.** 🟢 Der Delta-Sync
> bleibt **verworfen** (ADR-0016). Die Frage lautete nie „Momentaufnahme oder Delta?", sondern
> „was ist eigentlich teuer?" — und teuer ist nicht der Ersatz, sondern der Einbettungsaufruf.
> Also liegt jetzt ein Zwischenspeicher **vor** jedem Adapter, der Vektoren nach Art und Text
> hält. Er darf das, weil ein **Vektor keine Berechtigung trägt**; ein Chunk täte es. Die
> Entzugszusage bleibt strukturell.
>
> **Tor — eingelöst, mit einer benannten Lücke:**
>
> - **`npm test` → 211 bestanden, 6 übersprungen, 0 gefallen** (+9 gegenüber 202), 93,28 %.
> - **`npm run evals` → jede Metrik identisch** zum Lauf davor: 3.13 = 0 % (0/10 und 0/16),
>   3.14 = 0 % (0/6), 28/28 und 32/32. Eine Ersparnis, die eine Zahl bewegt, ist keine.
> - **Kapitalprobe:** dritter Zyklus, `d2` fällt aus der Momentaufnahme → kein Chunk mehr
>   auffindbar, obwohl sein Vektor noch im Zwischenspeicher liegt. Zweiter Zyklus über
>   unveränderte Dokumente → **null** Einbettungen.
> - **Vier Mutationen, vier Mal rot, zurückgenommen.**
> - `npm run demo` und `npm run demo:besprechung` Rückgabewert 0 · ESLint 15/0 unverändert.
>
> **🔴 Die offene Hälfte, ausdrücklich:** `EMBEDDING_ADAPTER=voyage npm run evals` ist **nie
> gelaufen** — kein `VOYAGE_API_KEY` in dieser Umgebung. Der Adapter ist gegen ein Testdouble
> geprüft, das die dokumentierte Antwortform nachbildet, aber **ob Voyage wirklich so
> antwortet, weiß dieses Repo nicht.** Ein Testdouble beweist die eigene Logik, nicht die
> fremde. Bis dieser Lauf durchläuft, ist „3.13 bewegt sich nicht" eine **Vorhersage** aus
> ADR-0015 und kein Messwert.

### Sofortmaßnahme vor Etappe 4 — die Genehmigungslücke im HTTP-Adapter

> **🟢 Erledigt am 2026-09-14.** Belegt: `tests/httpAdapter.test.js` — beim ersten Lauf **rot**
> (Fall A antwortete 200), nach der Änderung **6/6 grün**; die Fälle B (`false`) und C (`true`)
> waren in **beiden** Läufen grün, die Probe misst also. Danach `npm test` **217/223** bei
> 93,03 % (6 übersprungen: Postgres ohne Docker), 0 gefallen · `npm run evals` 3.13 = 0 %
> (0/10, 0/16), 3.14 = 0 % (0/6), 28/28 und 32/32, beide Durchgänge identisch · beide Demos
> Exit 0 · ESLint unverändert 15 Warnungen / 0 Fehler.
>
> **Zwei Zeilen Code, eine Zeile Werkzeug.** Der Adapter lehnt jeden Nicht-Boolean mit 400 ab,
> statt ihn umzuwandeln — und `src/adapters/http/server.js` ist **nicht mehr** von der
> Abdeckungsmessung ausgenommen (`package.json`). Die Ausnahme war der zweite Grund, warum kein
> Test die Lücke fing; bleibt sie stehen, kann dieselbe Klasse still wiederkommen. Die Datei
> liegt jetzt bei 81,63 % Zeilenabdeckung, die Gesamtzahl bei 93,03 % — die 80-%-Schwelle hält.
>
> **Die Hinweise sind aus den drei Verträgen verschwunden:** `ARCHITECTURE.md` §4 (Eintrag
> gelöscht), `docs/security-model.md` (aus der Lücke wurde die **Regel je Kanal**),
> `README.md` (Zusagentabelle nennt jetzt Kante **und** Rand). Keine ADR: §10 sagt, die
> Sofortmaßnahme braucht keine — ein Defekt, eine Änderung.

> **Gefunden am 2026-09-13 beim Abgleich mit dem Ausgangstext — durch Ausführen bestätigt,
> nicht aus dem Code gelesen.** Sie stand vor allem anderen, weil sie die Zusage betrifft, die
> das ganze Sicherheitsmodell trägt.

Die HITL-Kante im Kern prüft auf exakt `true` (`build.js`), und das ist richtig. Der
HTTP-Adapter wandelte den Wert aber **vorher** um: `approved: Boolean(approved)`.
`Boolean("false")` ist `true`. Ein Client, der `{"approved": "false"}` sendete, **genehmigte** —
ebenso bei `"no"`, `"0"` oder `1`. Die Zusage „alles, was nicht exakt `true` ist, endet bei
`END`" galt damit im Kern, aber nicht am Rand.

Die Probe lief über echte HTTP-Anfragen gegen `app` aus `src/adapters/http/server.js`, mit
Zustand in einem Temp-Verzeichnis:

| Fall | gesendet           | erwartet         | beobachtet       |
| ---- | ------------------ | ---------------- | ---------------- |
| A    | `"false"` (String) | nicht zugestellt | **ZUGESTELLT**   |
| B    | `false`            | nicht zugestellt | nicht zugestellt |
| C    | `true`             | zugestellt       | zugestellt       |

B und C belegen, dass die Probe selbst misst.

**Warum kein Test es fing.** `src/adapters/http/server.js` war von der Abdeckung ausgenommen
(`package.json`), und kein Test importierte ihn. Die Tests prüften die Kante im Kern — und die
ist korrekt. Geprüft war die Hälfte der Zusage, die nie kaputt war. Beides ist behoben: es gibt
einen Test, und die Ausnahme ist weg.

**Warum daraus eine Regel je Kanal wird.** Jeder spätere Kanal (Etappe 11) kann dieselbe
Fehlerklasse wiederholen. Deshalb: **nur ein JSON-Boolean `true` ist eine Genehmigung; jeder
Nicht-Boolean wird mit 400 abgelehnt, nicht umgewandelt.** Das ist dieselbe Lehre wie beim
API-Schlüssel (`docs/security-model.md` Schicht 3): fail-closed heißt ablehnen, nicht
zurechtbiegen.

> **Tor:** erster Test gegen den HTTP-Adapter, **zuerst rot** (Fall A stellt zu), dann grün ·
> Fall A und jeder Nicht-Boolean → 400, nichts zugestellt, nichts eingereiht · Fall B und C
> unverändert · Kerntor mit identischen Zahlen · der Hinweis auf die Lücke verschwindet aus
> `ARCHITECTURE.md` §4, `docs/security-model.md` und `README.md`. Keine neue Metrik — ein
> Defekt, eine Änderung.

**Der offene Rest aus 3d gehört ebenfalls vor Etappe 7:** Solange die Daten Fixtures sind,
sagt ein Hash-Embedding nichts Falsches. Bei echten Dokumenten würden Nutzer jedoch
Trefferlisten sehen, deren Reihenfolge nichts bedeutet.

### Etappe 4 — Einsatzfähig werden: Identität, Handlungsbefugnis, Policy, Audit

> **In vier Teile geschnitten am 2026-09-13, aus demselben Grund wie Etappe 0 und 3.** Die
> Fassung vom 2026-09-10 fasste Identität, Policy, Timeout und Audit in eine Etappe mit einer
> Metrik (3.15). Mit A11 kommt eine zweite Metrik dazu (3.16), und zwei neue Metriken in einer
> Etappe verbietet §6. Ohne diese Etappe kann kein Unternehmen das System einsetzen — sie ist
> Voraussetzung für jede echte Quelle und jeden echten Kanal.

**4a — Identität.** `principal` wird echt: Auflösung gegen den Identitätsanbieter des
Unternehmens (SSO) samt Gruppenzugehörigkeit, TTL-begrenzt, **kein Dauer-Cache**. Das
Nicht-Ziel „kein eigener Identitätsanbieter" bleibt bestehen: die Identität wird aufgelöst,
nicht verwaltet. Voraussetzung für die Etappen 7, 11 und 12 — ohne aufgelöste Identität ist
jeder Principal eine Behauptung.

> **Tor:** Test — Identität nicht auflösbar → **leeres Ergebnis und kein einziger LLM-Aufruf**
> (fail-closed vor den Kosten) · Test — ein abgelaufener Identitätseintrag wird neu aufgelöst,
> nicht weiterverwendet · 3.13 unverändert.

**4b — Handlungsbefugnis je Principal (A11).** Die Aktion trägt den Principal, in dessen
Namen sie läuft. Die Queue prüft **vor dem Schreiben** gegen eine Politik der Domäne, ob dieser
Principal diesen Aktionstyp an diesem Ziel auslösen darf. Fehlt die Befugnis oder lässt sie sich
nicht auflösen, wird die Aktion abgelehnt und nicht eingereiht. 4b braucht 4a nicht zwingend:
wie Etappe 2 lässt sie sich gegen regelabgeleitete Principals aus Fixtures messen.

Neue Metrik in `EVALS.md`:

> **3.16 Handlungsbefugnis-Verletzungsrate · Ziel 0 %**
> Nenner: alle eingereihten Aktionen. Zähler: davon jene, deren Principal die Aktion am Ziel
> nicht auslösen darf. Die Erwartung wird aus der Politik abgeleitet, nie aus einem Lauf.
> Pflichtfall: ein Principal **ohne** Befugnis, aber **mit** gültiger Genehmigung — eine
> Genehmigung hebt keine fehlende Befugnis auf.
>
> Warum nicht 3.9: `EVALS.md` hält 3.7 und 3.9 bis 3.11 für Metriken frei, die eine Domäne
> mitbringt. Diese Metrik gehört dem Kern.

> **Tor:** `npm run evals` → **3.16 = 0 %** · Test — eine Aktion ohne Befugnis wird vor dem
> Schreiben abgelehnt, auch wenn sie einen bekannten Idempotenzschlüssel mitbringt · 3.2 und
> 3.13 unverändert.

**4c — Policy, Risikoklasse, Genehmigungs-Timeout.** `policy/engine.js` und `policy/risk.js`.
Die Engine **klassifiziert** das Risiko einer Aktion, sie **routet nicht** (A5): die Klasse wird
hier vergeben und protokolliert, wirksam wird sie erst in Etappe 14b. Dazu das
Genehmigungs-Timeout mit **Voreinstellung deny**.

> **Tor:** Test — abgelaufene Genehmigung → deny, **nichts eingereiht, nichts zugestellt** ·
> neue Metrik **3.15 Durchsetzung des Genehmigungs-Timeouts = 100 %** · jede Aktion trägt eine
> Risikoklasse im Trace · 3.13 und 3.16 unverändert.

**4d — Audit-Kette und Entscheidungsobjekt (A6, A12).** `audit/log.js` als Hash-Kette über
dem Trace, mit Aufbewahrungsfrist. Die Genehmigung wird zum Entscheidungsobjekt: statt
`{ threadId, approved }` nimmt sie den **Genehmigenden** und optional einen **bearbeiteten
Entwurf** entgegen, und der bearbeitete Entwurf läuft erneut durch `vertrag.js` und die
Validierer. Die HITL-Kante bleibt `=== true`: `build.js` wird nicht angefasst, nur das, was vor
ihr ankommt. Braucht 4a — ein Genehmigender ohne aufgelöste Identität ist keiner.

> **Tor:** Test — das Ändern einer Audit-Zeile bricht die Kette und wird erkannt · Test — ein
> bearbeiteter Entwurf, der den Vertrag verletzt, wird abgelehnt und nicht zugestellt · Test —
> jede Genehmigung im Audit nennt ihren Genehmigenden · 3.1 = 100 % unverändert.

### Etappe 5 — Aktionsfläche: von der Ontologie zur Whitelist

A4 wird eingelöst: `actions.js` wird aus den Aktionstypen in `ontology.js` **erzeugt** und
gegen sie geprüft. Was nicht als Aktionstyp modelliert ist, kann kein Agent auslösen — der
Gedanke, den der Ausgangstext aus Palantirs Ontology zieht.

> **Tor:** Test — ein Aktionstyp, der nicht in der Ontologie steht, wird **vor** dem Schreiben
> in die Queue abgelehnt · **3.2 Unauthorized-Action-Rate bleibt 0 %** bei erweiterter
> Aktionsfläche. Keine neue Metrik: 3.2 misst das bereits, sie muss nur unter Last standhalten.

**Voraussetzung für Etappe 13:** Der Aktionstyp `TICKET_KOMMENTIEREN` entsteht dort, und er
entsteht zuerst in `ontology.js` — sonst gäbe es eine freigeschaltete Wirkung, die niemand
modelliert hat (K9).

### Etappe 6 — An Auslöser gebunden, nicht an einen Kalender

Keiner dieser Punkte beginnt zu einem Datum, sondern wenn eine **Bedingung** eintritt. Jeder
verlangt eine ADR vor der ersten Zeile Code.

| Was                               | Auslöser                                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temporal (Durable Execution)      | Ein auf Genehmigung wartender Ablauf überdauert regelmäßig die Lebensdauer eines Prozesses — mit Etappe 11 (Genehmigung über Stunden) wahrscheinlich erreicht                                                   |
| MCP-Kanal                         | Ein zweiter Konsument existiert · bietet **kein** `approve` an (A17); die Genehmigung durch Menschen außerhalb von HTTP ist Etappe 11                                                                           |
| `recherche`-Knoten                | Retrieval steht (Etappe 2) — vorher wäre es ein LLM-Aufruf mit einem selbstbewussten Namen                                                                                                                      |
| Zweiter Agent / A2A               | Die Bremsen einer Domäne überschreiten ~10 und lassen sich sauber teilen                                                                                                                                        |
| Agent-Registry / Control Plane    | ~50 Agenten — auch der Ausgangstext empfiehlt, bis dahin zu verzichten · „ein Agent je Mitarbeiter" löst ihn **nicht** aus (A18)                                                                                |
| Slack als Quelle                  | Der Drive-Connector (Etappe 7) belegt Nutzen in Schicht C über mindestens einen Messzeitraum · braucht eine eigene ACL-Abbildung: private Kanäle, Direktnachrichten, Gäste, geteilte Kanäle                     |
| Graphspeicher / Agentengedächtnis | Relationsfragen, die der gefilterte Leseweg nicht beantwortet, sind in Schicht C belegt · Kanten und Gedächtniseinträge erben die Envelope ihrer Quellen, eine Kante ist nur sichtbar, wenn beide Enden es sind |

### Die Etappen 7 bis 14 — echte Quellen, echte Wirkung, verdiente Autonomie

> **Hinzugekommen am 2026-09-13** mit dem Abgleich gegen den Ausgangstext (§8). Etappe 6 ist
> ein Vorrat an Auslösern, keine Stufe — die Folge läuft deshalb von 5 direkt nach 7.

| Block                             | Etappen     | Frage, die er beantwortet                                                   |
| --------------------------------- | ----------- | --------------------------------------------------------------------------- |
| A · Einsatzfähig werden           | 4a–4d       | Darf ein Unternehmen das System überhaupt einsetzen?                        |
| B · Echte Daten, echte Wirkung    | 7, 8, 9, 10 | Spart das System einer echten Person eine Minute — und woran sehen wir das? |
| C · Dorthin, wo Menschen arbeiten | 11, 12, 13  | Benutzt es jemand, ohne dafür ein neues Werkzeug öffnen zu müssen?          |
| D · Verdiente Autonomie           | 14a, 14b    | Welche Genehmigung kostet mehr, als sie schützt — belegt, nicht geglaubt?   |

**Die Regel über den Blöcken: messen, bevor es wirkt.** Etappe 2 hat die Autorisierung messbar
gemacht, bevor echte Daten kamen. Etappe 9 macht den Nutzen messbar, bevor die erste echte
Wirkung kommt (Etappe 10). Dieselbe Reihenfolge, eine Ebene höher.

### Etappe 7 — Die erste echte Quelle: Google Drive

**Warum Drive zuerst.** Das Notizenlaufwerk aus ADR-0010 ist dem Berechtigungsmodell von Drive
nachgebildet: Ordnervererbung, organisationsweite Links, Freigabe an Einzelne. `acl.js` trägt
die Übersetzung deshalb weitgehend schon. Slack hätte den größeren Nutzen („wo wurde das
entschieden?"), aber das schwerere Modell — es wartet in Etappe 6.

**Was entsteht.** Der Protokollzugriff liegt unter `src/adapters/` (Außenkontakt), die
Übersetzung in die Envelope in der Domäne neben `notizlaufwerk.js`. Drive ist opt-in über eine
Umgebungsvariable, wie Store und Embedding; `npm run evals` und `npm run demo` laufen weiter
gegen die Fixture-Quelle ohne Netz (K5). Dazu kommt die hybride Synchronisation (A13).

**Voraussetzungen.** 4a, weil Drive-Gruppen ohne aufgelöste Identität nicht abbildbar sind, und
der offene Voyage-Lauf aus 3d. **Offen vor der ersten Zeile:** SDK oder `fetch`. Eine neue
Abhängigkeit wird erst nach Rückfrage aufgenommen; Vorbild ist der Voyage-Adapter ohne Paket.

Neudefinition in `EVALS.md`:

> **3.14 Latenz des Berechtigungsentzugs** misst ab hier **Abgleichszyklen**: liefert die
> Suche nach **einem Abgleich** noch einen Chunk des entzogenen Dokuments? Zwischen zwei
> Abgleichen ist ein Entzug, den der Änderungsabruf verschweigt, **bekanntermaßen sichtbar** —
> das Abgleichsintervall ist die Zusage, und es steht im Bericht. Die Baseline vom 2026-09-10
> bleibt stehen; die neue Definition bekommt eine neue Zeile.

> **Tor:** Drive-Fixtures, deren Erwartungen aus den Drive-Berechtigungsregeln abgeleitet
> sind → **3.13 = 0 %** · **3.14 = 0 %** nach einem Abgleich · Test — ein Entzug ohne
> Änderungsereignis ist nach dem Abgleich verschwunden · `npm run demo` ohne Netz ·
> `grep -rniE "gdrive" src/kernel/` leer.

### Etappe 8 — Der Überfreigabe-Bericht

**Warum.** Berechtigungstreu heißt nicht, dass die Berechtigungen stimmen. Das System spiegelt
die Quelle wörtlich — ein organisationsweiter Link wird `oeffentlich` (`acl.js`, Regel 5). In
echten Laufwerken liegen jahrealte, zu weit geöffnete Ordner, und ein Assistent macht diese
Überfreigabe **schneller auffindbar**. Bevor Mitarbeiter ihn benutzen, braucht das
Sicherheitsteam deshalb die Liste.

**Was entsteht (A14).** Der Bericht wird im Synchronisationszyklus gebaut, nicht über einen
zweiten Leseweg. Er nennt Dokument, Quelle, Sichtbarkeit und Grund, **nie** einen
Textausschnitt. Welche Kombinationen als Überfreigabe gelten, legt die Domäne als Regel fest —
aus Regeln, nicht aus einem beobachteten Lauf. Der Bericht sagt etwas über die **Quelle** und
ändert keine Berechtigung.

> **Tor:** Test — der Bericht enthält aus keinem Dokument ein einziges Textzeichen · Fixture
> mit organisationsweit freigegebenem Ordner erscheint im Bericht, Fixture ohne solche Freigabe
> nicht — beide Richtungen, wie bei 3.14 · `store/index.js` bekommt **keinen** Leseweg ohne
> Principal · alle Metriken unverändert. Keine neue Metrik.

### Etappe 9 — Schicht C: Nutzen messbar machen, bevor etwas wirkt

**Warum hier.** Die erste Frage einer Führungskraft ist nicht „ist es sicher?", sondern „spart
es Arbeit?" — und darauf gibt heute keine Zahl eine Antwort. Ohne Messung vor der ersten echten
Wirkung (Etappe 10) gibt es keine Baseline, und ohne Baseline ist jede spätere Aussage über
Nutzen eine Behauptung.

**Was entsteht (A15).** Ein Bericht je Zeitraum unter `evals/reports/`, aus echter Nutzung und
ohne LLM-Urteil:

| Metrik                  | Was sie misst                                        | Warum sie ehrlich ist                                                    |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| C.1 Korrekturgrad       | Unterschied zwischen Entwurf und genehmigter Fassung | kein Modell urteilt — der Mensch hat es durch seine Änderung getan       |
| C.2 Genehmigungsquote   | Anteil genehmigter Entwürfe                          | jede Ablehnung ist ein Qualitätsbefund                                   |
| C.3 Zeit bis zum Ticket | Besprechungsende bis zugestelltes Ticket             | der Nutzen, den das Team spürt                                           |
| C.4 Dublettenquote      | angelegte Tickets, die ein bestehendes wiederholen   | erst ab Etappe 13 messbar — bis dahin `null`, nicht 0                    |
| C.5 Genehmigungsdauer   | Zeit von der Vorlage bis zur Entscheidung            | sehr kurze Freigaben sind das Warnsignal der Genehmigungsmüdigkeit (A19) |

Die Nenner-Probe gilt: jede C-Zahl steht mit Zähler, Nenner und Zeitraum im Bericht. Der Trace
trägt weiter keinen Volltext (A12).

**Was diese Etappe nicht liefert: echte Zahlen.** Die entstehen erst nach Etappe 10. Hier wird
belegt, dass das Instrument misst — mit dem Modus im Bericht, damit ein Mock-Bericht nie wie ein
echter aussieht.

> **Tor:** datierter Schicht-C-Bericht unter `evals/reports/`, Modus und Nenner im Bericht ·
> Test — der Trace enthält den Korrekturgrad als Zahl und keinen Text · Test — C.4 ist `null`,
> solange keine Dublettenprüfung läuft · Schicht A unverändert.

### Etappe 10 — Die erste echte Wirkung: ein Ticket in Jira

**Was entsteht (A16).** Die Domäne liefert je Aktionstyp einen Ausführer, so wie heute die
Validierer. Der Kern ruft ihn mit hartem Timeout, Wiederholung und dem bestehenden
Dedup-Index. Der echte Jira-Ausführer ist opt-in, die Voreinstellung simuliert.

**Das schwierige Stück, ausdrücklich.** `EXTEND.md` Schritt 6 sagt: die Idempotenz trägt nur,
wenn der Schlüssel den **Vorgang** meint. Jira kennt keinen Idempotenzschlüssel. Stirbt der
Prozess zwischen erfolgreichem Aufruf und Logeintrag, legt die Wiederholung ein zweites Ticket
an — außer der Ausführer schreibt den Vorgangsschlüssel ins Ticket und sucht vor dem Anlegen
danach. Diese Lücke ist der eigentliche Inhalt der Etappe, nicht der HTTP-Aufruf.

> **Tor:** Test gegen einen gefälschten Jira-Server — dieselbe Aktion zweimal, auch nach einem
> simulierten Absturz zwischen Aufruf und Log → **genau ein** Ticket · Test — ein Aufruf ohne
> Antwort bricht am Timeout ab und endet nach drei Versuchen `FAILED` · 3.2 = 0 % und
> 3.16 = 0 % unverändert · `npm run demo` ohne Netz · `grep -rniE "jira" src/kernel/` leer ·
> `ARCHITECTURE.md` §1 nennt sieben Nahtstellen.

### Etappe 11 — Genehmigung dort, wo Menschen arbeiten: Slack oder Teams

**Warum.** Eine Genehmigung, für die jemand eine eigene Oberfläche öffnen muss, wird nicht
erteilt — oder zu spät. Ohne diese Etappe bleibt jeder Entwurf liegen, und C.3 misst nur noch
das Warten.

**Was entsteht (A17).** Ein Adapter neben HTTP. Die Vorlage erscheint mit Knöpfen, der Klick
kommt signiert zurück. Der Server prüft die Signatur, löst den Klickenden über SSO auf (4a),
prüft seine Befugnis (4b) und schreibt ein Entscheidungsobjekt (4d) in **denselben**
Checkpoint. `build.js` bleibt unberührt. **Offen vor der ersten Zeile:** Slack oder Teams zuerst.

> **Tor:** Tests — unsignierte, wiedergespielte, abgelaufene und von einem nicht befugten
> Menschen stammende Genehmigungen werden abgelehnt · Test — ein Nicht-Boolean wird abgelehnt,
> nicht umgewandelt (die Fehlerklasse der Sofortmaßnahme, jetzt je Kanal geprüft) · 3.1 = 100 %
> unverändert · das Nicht-Ziel in `PRODUCT.md` §3.2 ist per ADR geändert, bevor die erste Zeile
> entsteht.

### Etappe 12 — Die persönliche Übersicht: der „eigene Agent" jedes Mitarbeiters

**Warum.** Im Alltag geht nicht die Besprechung verloren, sondern die Zusage darin. Eine
tägliche Übersicht je Person — _deine offenen Punkte aus Besprechungen, an denen du
teilgenommen hast · Entwürfe, die auf deine Genehmigung warten · Zusagen, die seit Tagen
stehen_ — ist der sichtbarste Nutzen. Sie ist nur lesend, also Stufe 0 (A19).

**Was entsteht (A18).** Aktionspunkte werden gespeichert statt nur im Laufzustand gehalten, und
sie erben dabei die Envelope ihrer Quellnotiz, genau wie Chunks (ADR-0009). Gelesen wird nur
über den gefilterten Leseweg, zugestellt über den Kanal aus Etappe 11. Neu ist ein **Zeitplan**:
bisher gibt es keinen (ADR-0011), die Übersicht braucht einen.

> **Tor:** Übersichtsfälle im Datensatz, Cross-User-Fall Pflicht → **3.13 = 0 %** über
> Übersicht und Suche zusammen · Test — die Übersicht eines nicht auflösbaren Principals ist
> leer · `grep -rniE "mitarbeiter" src/kernel/registry.js` leer — die Registry kennt Domänen,
> keine Menschen. Keine neue Metrik: 3.13 misst die Übersicht mit.

### Etappe 13 — Dubletten vermeiden: der erste, schmale Graph

**Warum.** Dasselbe Thema kommt in drei Besprechungen vor, und drei Menschen legen drei Tickets
an. Dubletten sind in echten Teams häufig und kosten doppelt: beim Anlegen und beim Aufräumen.

**Was entsteht.** Vor `TICKET_ANLEGEN` sucht das System über den Embedding-Port unter den bereits
vom System angelegten Tickets nach demselben Vorgang — **durch denselben ACL-Filter**. Findet es
einen, schlägt es statt eines neuen Tickets einen Kommentar vor. Dafür kommen der Aktionstyp
`TICKET_KOMMENTIEREN` (zuerst in `ontology.js`, Etappe 5) und eine neue Bremse vor `entwurf` in
`domain.js` dazu. Die Relation „Ticket verweist auf Aktionspunkt" erbt die Envelope beider
Enden. Ein Graphspeicher entsteht **nicht** — er wartet in Etappe 6.

> **Tor:** Dubletten-Fixture → Kommentarvorschlag statt neuem Ticket · Nicht-Dublette → neues
> Ticket (beide Richtungen) · Pflichtfall: das ähnliche Ticket existiert, ist für diesen
> Principal aber **unsichtbar** → es wird **nicht** als Dublette gemeldet, sonst verriete die
> Meldung seine Existenz · 3.13 = 0 % · C.4 wird messbar.

### Etappe 14 — Verdiente Autonomie

> **Die einzige geplante Etappe, die eine Zusage aus §2 bricht (Zusage 5) und `PRODUCT.md`
> Ziel 4 und K1 ändert.** Sie beginnt deshalb mit einer ADR, die den Bruch benennt — nicht mit
> Code. Sie ist zweigeteilt, weil sie sonst eine neue Metrik (3.17) und eine Neudefinition (3.1)
> zugleich brächte.

**14a — Die Rücknahme.** Ein Ausführer (A16) kann je Aktionstyp eine Rücknahme anbieten. Ein
Aktionstyp ohne Rücknahme kann **nie** Stufe 1 werden. In dieser Teiletappe wirkt noch nichts
ohne Genehmigung.

Neue Metrik in `EVALS.md`:

> **3.17 Durchsetzung der Rücknahme · Ziel 100 %**
> Nenner: alle innerhalb des Rücknahmefensters zurückgenommenen Aktionen. Zähler: davon jene,
> deren Wirkung im Zielsystem danach tatsächlich aufgehoben ist.

> **Tor:** Test gegen den gefälschten Jira-Server — eine Rücknahme im Fenster hebt die Wirkung
> auf, außerhalb des Fensters wird sie abgelehnt · **3.17 = 100 %** · 3.1 und 3.16 unverändert.

**14b — Die Stufen werden wirksam (A19).** Die Risikoklasse aus 4c routet ab jetzt: Stufe 0 ohne
Genehmigung, Stufe 1 mit Rücknahmefenster, Stufe 2 hält beim Menschen an. Ein Aktionstyp steigt
nur auf, wenn Schicht-C-Daten aus Etappe 9 es über einen festgelegten Zeitraum stützen — ein
hoher Anteil unveränderter Genehmigungen (C.1, C.2) — und nur durch eine dokumentierte
menschliche Entscheidung. **Offen vor der ersten Zeile:** Zeitraum und Schwelle.

Neudefinition in `EVALS.md`:

> **3.1 Approval-Enforcement-Rate** zählt ab hier nur Läufe der **Stufe 2** im Nenner. Die
> Baseline davor bleibt stehen.

> **Tor:** Test — eine Stufe-2-Aktion hält weiterhin bei `human_approval` · Test — ein
> Aktionstyp ohne Rücknahme lässt sich nicht als Stufe 1 einstellen · Test — eine Bremse, die
> `humanApproval` schreibt, wird abgewiesen (die verbotene Abkürzung aus A19) · 3.1 = 100 % in
> der neuen Definition · 3.13, 3.16 und 3.17 unverändert.

---

## 6. Zuordnung Etappe → Metrik

Die Umsetzung der Regel „ein Defekt pro Änderung" auf den Plan. **Höchstens eine neue Metrik
je Etappe** — sonst ist nicht zuzuordnen, welche Änderung welche Zahl bewegt hat.

| Etappe | Neue Metrik                                     | Was unverändert bleiben muss           |
| ------ | ----------------------------------------------- | -------------------------------------- |
| 0      | — (reines Regressionstor)                       | **alles**, Zahl für Zahl               |
| 1      | Baseline neu — der Prüfer bewegt die Wege       | 3.1 = 100 %, 3.2 = 0 %, 3.3 = 100 %    |
| 2      | **3.13 Unauthorized-Retrieval-Rate**            | 3.1–3.4, K5                            |
| 3a     | — (Entscheidung und Ontologie, kein Code)       | **alles**                              |
| 3b     | **3.14 Latenz des Berechtigungsentzugs**        | 3.13, 3.1–3.4                          |
| 3c     | — (dieselbe Suite gegen Postgres)               | 3.13, 3.14, 3.1–3.4                    |
| 3d     | — (dieselbe Suite mit echtem Embedding)         | 3.13 — sonst hing sie an der Rangfolge |
| 3d-2   | — (dieselbe Suite mit Zwischenspeicher)         | **alles**, Zahl für Zahl               |
| Sofort | — (ein Defekt, ein Test)                        | **alles**, Zahl für Zahl               |
| 4a     | — (Test: nicht auflösbar → kein LLM-Aufruf)     | 3.13                                   |
| 4b     | **3.16 Handlungsbefugnis-Verletzungsrate**      | 3.2, 3.13                              |
| 4c     | **3.15 Durchsetzung des Genehmigungs-Timeouts** | 3.13, 3.16                             |
| 4d     | — (Test: Audit-Kette, Vertrag erneut)           | 3.1                                    |
| 5      | — (3.2 unter erweiterter Aktionsfläche)         | alle                                   |
| 7      | 3.14 **neu definiert** (Abgleichszyklen)        | 3.13                                   |
| 8      | — (Bericht, keine Metrik)                       | alle                                   |
| 9      | Schicht C · C.1–C.5 — **kein Tor** (A15)        | alle aus Schicht A                     |
| 10     | — (Test: genau ein Ticket)                      | 3.2, 3.16                              |
| 11     | — (Tests je Kanal)                              | 3.1                                    |
| 12     | — (3.13 umfasst die Übersicht)                  | 3.13                                   |
| 13     | — (C.4 wird messbar)                            | 3.13                                   |
| 14a    | **3.17 Durchsetzung der Rücknahme**             | 3.1, 3.16                              |
| 14b    | 3.1 **neu definiert** (nur Stufe 2)             | 3.13, 3.16, 3.17                       |

Eine Neudefinition zählt hier wie eine neue Metrik: auch sie bewegt eine Zahl, und die Bewegung
muss genau einer Etappe zuzuordnen sein. Deshalb ist 14 zweigeteilt. Die Schicht-C-Zahlen zählen
nicht mit, weil sie kein Tor sind (A15).

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

### Vom Abgleich mit dem Ausgangstext am 2026-09-13

Eine Zusammenfassung des Ausgangstexts wurde am 2026-09-13 gegen den Stand gehalten. Sie liegt
nicht im Repo; ihr Kern: ein „eigenes KI-Gehirn" für Unternehmen, das Kontext aus Slack, Google
Workspace und Jira in **einem** Gedächtnis zusammenführt, **jedem Mitarbeiter einen eigenen
Agenten** gibt und operative Prozesse **Ende zu Ende autonom** fährt.

**Was sich deckt.** Die Identität des Repos wörtlich (ADR-0001). Retrieval und Evals sind dem
Ausgangstext voraus; Identität war als Etappe 4 geplant.

**Was fehlte — nicht verspätet, sondern in keiner Etappe:** echte Connectoren, Graph und
Gedächtnis, ein Agent je Mitarbeiter, der Autonomiegrad. Die Frage, die daraus die Etappen 7 bis
14 macht, lautet nicht „was steht im Ausgangstext?", sondern **„was braucht ein Unternehmen, damit
eine echte Person eine Minute spart?"** Die ehrliche Antwort zum Stand vom 2026-09-13: das System
spart heute niemandem Zeit. Es liest keine echte Quelle, löst keine echte Identität auf, legt kein
echtes Ticket an und hat keine Oberfläche für Mitarbeiter. Sein heutiger Wert liegt beim
Sicherheitsteam: es beantwortet die Frage „woher weiß ich, dass es niemandem zu viel zeigt?" mit
einer gemessenen Zahl. Das kleinste Stück echten Nutzens ist deshalb **Identität + eine echte
Quelle + eine echte Wirkung + Nutzenmessung** — in genau dieser Reihenfolge stehen die Etappen.

**Zwei Lücken wurden umgedeutet, nicht übernommen:**

- **„Ein Agent je Mitarbeiter"** heißt hier ein Principal-Kontext, keine eigene Software je
  Person (A18). Sonst stieße schon die erste Umsetzung gegen das Nicht-Ziel „keine
  Agent-Registry".
- **„Ende zu Ende autonom"** heißt hier **verdiente** Autonomie je Aktionstyp, belegt durch
  Schicht C und freigegeben von einem Menschen (A19). Eine Autonomie aus Überzeugung hätte die
  zentrale Zusage aufgegeben, ohne zu wissen, ob irgendeine Genehmigung überhaupt lästig ist.

**Was weiterhin anders bleibt als im Ausgangstext:**

- Quellen kommen **einzeln**: erst Drive (Etappe 7), Slack erst, wenn Drive Nutzen belegt
  (Etappe 6). Dieselbe Begründung wie oben: eine schwere Quelle lehrt mehr als drei leichte.
- Ein Graphspeicher und ein Agentengedächtnis bleiben an einen Auslöser gebunden (Etappe 6).
  Der erste Graph ist eine einzige Relation mit einem einzigen Zweck — Dubletten (Etappe 13).
- **Vollständige** Autonomie gibt es nicht. Stufe 2 hält immer beim Menschen an.

**Was der Abgleich nebenbei fand.** Beim Prüfen der Genehmigungsmechanik trat die Lücke im
HTTP-Adapter zutage (Sofortmaßnahme, §5): die Zusage „exakt `true`" hielt im Kern, am Rand
nicht. Sie war nie gemessen worden, weil der Adapter von der Abdeckung ausgenommen **war**. Das
ist dieselbe Lehre wie in `EVALS.md` §1, an der eigenen Zusage: es lief weiter und maß nichts.
Behoben am 2026-09-14 — samt der Ausnahme, die es verdeckte.

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
- **Die Etappen 4a bis 14b ändern heute keinen Vertrag.** Jede zieht ihren Vertrag **mit ihrer
  ADR** nach, nicht vorher: 4b → `PRODUCT.md` §4 (neues Kriterium) und `EVALS.md` 3.16 ·
  7 → `EVALS.md` 3.14 · 9 → `EVALS.md` §2 (Schicht C) und `ARCHITECTURE.md` §5 · 10 →
  `ARCHITECTURE.md` §1 (sieben Nahtstellen) und `EXTEND.md` Schritt 6 · 11 → `PRODUCT.md` §3.2
  (Nicht-Ziel), `docs/security-model.md` Schicht 3 und `EXTEND.md` Schritt 4 · 14a → `EVALS.md`
  3.17 · 14b → `PRODUCT.md` §3.1 Ziel 4 und K1, `EVALS.md` 3.1. Ein Plan, der Verträge vorab
  ändert, beschreibt einen Zustand, den es noch nicht gibt.

---

## 10. Die offenen Entscheidungen

| Frage                                                       | Blockiert  | Stand                                                      |
| ----------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| **Welche Vertikale?** Ontologie, ACL-Modell, Connector      | —          | 🟢 gefallen 2026-09-10, ADR-0010                           |
| K5 nach dem Postgres-Adapter: halten oder aufgeben?         | Etappe 3c  | 🟢 gefallen 2026-09-10, ADR-0013 (K5 bleibt grün)          |
| Delta-Sync statt vollständiger Momentaufnahme?              | Etappe 3d  | 🟢 gefallen 2026-09-11, ADR-0016                           |
| Vollständige TypeScript-Migration?                          | nichts     | ⬜ offen                                                   |
| Zweiter Kanal (MCP): darf er `approve` anbieten?            | Etappe 6   | 🟡 teilweise: MCP nein, ein Mensch in Slack/Teams ja (A17) |
| A11 · Handlungsbefugnis je Principal                        | Etappe 4b  | 🟢 gefallen 2026-09-20, ADR-0020                           |
| A12 · Genehmigung als Entscheidungsobjekt                   | Etappe 4d  | ⬜ offen, ADR-Kandidat                                     |
| A13 · Hybride Synchronisation (löst ADR-0011 teilweise ab)  | Etappe 7   | ⬜ offen, ADR-Kandidat                                     |
| A14 · Überfreigabe-Bericht ohne zweiten Leseweg             | Etappe 8   | ⬜ offen, ADR-Kandidat                                     |
| A15 · Schicht C misst Nutzen, ist kein Tor                  | Etappe 9   | ⬜ offen, ADR-Kandidat                                     |
| A16 · Ausführer-Naht (sieben statt sechs Nahtstellen)       | Etappe 10  | ⬜ offen, ADR-Kandidat                                     |
| A17 · Genehmigung durch Menschen außerhalb von HTTP         | Etappe 11  | ⬜ offen, ADR-Kandidat — ändert ein Nicht-Ziel             |
| A18 · „Ein Agent je Mitarbeiter" als Principal-Kontext      | Etappe 12  | ⬜ offen, ADR-Kandidat                                     |
| A19 · Risikostufen und verdiente Autonomie                  | Etappe 14  | ⬜ offen, ADR-Kandidat — bricht Zusage 5, Ziel 4, K1       |
| Drive, Jira, Slack: SDK als neue Abhängigkeit oder `fetch`? | 7, 10, 11  | ⬜ offen — neue Abhängigkeit nur nach Rückfrage            |
| Welcher Chat-Kanal zuerst: Slack oder Teams?                | Etappe 11  | ⬜ offen                                                   |
| Stufe 1: welcher Messzeitraum, welche Schwelle?             | Etappe 14b | ⬜ offen — braucht Schicht-C-Daten                         |

Etappe 0 bis 3d und die Sofortmaßnahme brauchten **keine** der noch offenen Antworten und sind
gefahren; die Etappen 4b bis 14 brauchen je genau die ADR aus ihrer Zeile, und keine davon fällt
als Block.

> Die Delta-Sync-Zeile ist gefallen, **ohne dass der Delta-Sync gebaut wurde**. Das ist kein
> Aufschub: ADR-0016 entscheidet gegen ihn und löst das Kostenproblem anders. Eine Frage gilt
> als gefallen, wenn sie beantwortet ist — nicht, wenn ihre naheliegende Antwort umgesetzt
> wurde.
