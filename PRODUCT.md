# PRODUCT

Regel für dieses Dokument: **keine Zahl ohne datierten Lauf in `evals/reports/`.**
Was nicht gemessen ist, steht hier als „nicht gemessen" — nicht als plausible Schätzung.

## 1. Was dieses Projekt ist

**agentic-brain** ist ein **permission-aware Enterprise Context Layer** mit agentischer
Prozessautomatisierung: Wissen wird samt seinen Berechtigungen aufgenommen, berechtigungstreu
abgefragt und in menschlich genehmigte Aktionen überführt (ADR-0001). Die Vertikale, an der
das bewiesen wird, ist seit dem 2026-09-10 entschieden (ADR-0010): **Besprechungsnotiz →
Aktionspunkt → Ticket.** Quelle ist ein geteiltes Notizenlaufwerk, in dem drei
Berechtigungsmechanismen übereinanderliegen — Ordner-Vererbung, Freigabe an einzelne
Personen, Teilnehmerliste der Besprechung. Adressat ist ein Team, dessen Besprechungsnotizen
in einem solchen Laufwerk liegen und aus denen regelmäßig Tickets entstehen. Zugleich ist das
Repo ein Arbeitsnachweis: nicht die Arbeit allein zählt als Beweis, sondern **wie sie gemessen
wurde**.

Stand heute: die Ebenen ② Kontext, ③ Retrieval, ④ Agent Runtime, ⑤ Aktionen und der Kern von
⑥ Governance stehen und sind gemessen; Ebene ① Connectors trägt seit dem 2026-09-10 ihren
ersten Connector. Offen sind der Postgres-Adapter, ein echtes Embedding und die Auflösung
echter Identitäten.

## 2. Das Problem

Ein Assistenzsystem über Unternehmensdaten scheitert nicht daran, dass es schlechte Antworten
gibt. Es scheitert an zwei Fehlern, die beide **still** sind:

**Der erste: es antwortet aus Dokumenten, die der Fragende nicht sehen darf.** Der übliche
Aufbau legt alles in einen Index und filtert danach — oder filtert einen von zwei Suchpfaden
und vereinigt die Ergebnisse. Beides sieht im Test richtig aus, solange niemand den Fall baut,
in dem eine Benutzerin desselben Gruppennamens in einem **anderen** Mandanten fragt.

Daran erkennt man, dass man dieses Problem hat: Es gibt keine Zahl, die beantwortet, wie viele
unberechtigte Treffer die Suche letzte Woche geliefert hat — und es gibt keinen Testfall, der
rot würde, wenn man die Mandantenprüfung entfernt.

**Der zweite: die Kopie überlebt die Berechtigung.** Wird ein Teilnehmer aus einer Besprechung
entfernt oder ein Dokument gelöscht, bleibt der eingebettete Text im Index liegen. Die
Berechtigung ist zurückgenommen, die Antwort kommt trotzdem. Eine veraltete, vermeintlich
gelöschte Kopie ist ein echter Leckvektor — und der einzige, der ohne jeden Angriff auftritt.

Dazu kommt der Fehler, der nicht still ist, aber teuer: **ein Agent, der nach außen wirkt,
ohne dass ein Mensch zugestimmt hat.** Ein Ticket ist angelegt, eine Zusammenfassung ist
verschickt — zurücknehmen lässt sich beides nicht.

## 3. Umfang

### 3.1 Ziele

Jedes Ziel ist so formuliert, dass ein Befehl es beantwortet. Die Befehle stehen in §4.

1. **Kein unberechtigter Chunk verlässt den Speicher.** Der Filter wird in die Abfrage
   kompiliert, nicht nachgelagert angewandt; beide Pfade der hybriden Suche filtern
   (ADR-0008). Messbar als **3.13 Unauthorized-Retrieval-Rate = 0 %**.
2. **Lässt sich der Principal nicht auflösen, ist das Ergebnis leer — nicht ungefiltert.**
   Fail-closed, wörtlich wie an der HITL-Kante, und im Ergebnis unterscheidbar protokolliert.
3. **Ein Entzug in der Quelle breitet sich aus.** Nach einem Synchronisationszyklus liefert
   die Suche keinen Chunk des entzogenen Dokuments mehr. Messbar als **3.14**.
4. **Vor jeder Außenwirkung hält der Ablauf beim Menschen an.** Die HITL-Kante prüft auf
   exakt `true`; eine Ablehnung stellt nichts zu und reiht nichts ein.
5. **Ein Agent ruft niemals selbst eine externe Schnittstelle auf.** Er schreibt in die
   Aktions-Queue; ein getrennter Worker validiert und führt aus. Was nicht auf der Whitelist
   steht, kommt nicht in die Queue.
6. **Das Routing ist deterministisch und terminiert.** Bremsen vor LLM-Urteil, harter
   Schutzschalter gegen Endlosschleifen.
7. **Der Kern kennt keine Domäne.** Eine zweite Domäne entsteht als Geschwisterverzeichnis
   und ändert null Zeilen unter `src/kernel/`.
8. **Alles läuft ohne Schlüssel und ohne Infrastruktur durch.** `clone → install → demo` und
   die gesamte Schicht-A-Messung sind deterministisch, kostenlos und CI-fähig.

### 3.2 Nicht-Ziele

Wichtiger als die Ziele. Nichts hiervon wird gebaut, und wer es vorschlägt, braucht eine ADR.

- **Kein Connector-Marktplatz.** Eine Quelle, die mit dem schwersten Berechtigungsmodell
  (ADR-0010). Drei einfache Connectoren lehren zusammen weniger als ein schwerer.
- **Keine eigene Vektordatenbank.** Der Speicher ist ein Port; Adapter sind austauschbar.
- **Kein eigener Identitätsanbieter.** Der Principal wird aufgelöst, nicht verwaltet.
- **Keine Agent-Registry als Produkt** und keine Control Plane, solange die Zahl der Agenten
  klein ist.
- **Keine Abrechnungsinfrastruktur** für ergebnisbasierte Preise.
- **Kein Multi-Cloud-Betrieb.**
- **Keine Sandbox für agentenerzeugten Code.** Die Agenten erzeugen keinen Code.
- **Keine synthetisch erzeugten Golden-Datensätze.** Erwartungen werden aus Regeln
  abgeleitet, nie aus einem beobachteten Lauf übernommen.
- **Keine Bewertung von Textqualität durch ein Modell.** Schicht B misst einen
  Ausgabevertrag, kein Urteil.
- **Kein `approve` über einen zweiten Kanal**, solange keine ADR es ausdrücklich erlaubt.

## 4. Erfolgskriterien

Jedes Kriterium braucht **einen Befehl**, der es beantwortet. Ein Kriterium ohne Befehl ist
eine Meinung.

| #   | Kriterium                                                        | Prüfbefehl                                           | Stand     |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------- | --------- |
| K1  | Der Ablauf hält vor jeder Außenwirkung beim Menschen an          | `npm test` (`tests/workflow.test.js`)                | 🟢        |
| K2  | Eine Ablehnung stellt nichts zu und reiht nichts ein             | `npm test` (`tests/workflow.test.js`)                | 🟢        |
| K3  | Ein Neustart verliert keine wartende Genehmigung                 | `npm test` (`tests/integration/persistence.test.js`) | 🟢        |
| K4  | Routing ist deterministisch und terminiert                       | `npm run evals`                                      | 🟢        |
| K5  | `clone → install → demo` läuft auf einer frischen Maschine durch | `npm install && npm run demo`                        | 🟢        |
| K6  | Eine zweite Domäne ändert null Zeilen im Kern                    | `grep -rn "besprechung" src/kernel/`                 | 🟢 (leer) |
| K7  | Kein unberechtigter Chunk verlässt den Speicher                  | `npm run evals` → 3.13 = 0 %                         | 🟢        |
| K8  | Ein Entzug in der Quelle breitet sich in einem Zyklus aus        | `npm run evals` → 3.14 = 0 %                         | 🟢        |
| K9  | Kein Aktionstyp ist freigeschaltet, der nicht modelliert ist     | `npm test` (`tests/besprechung.test.js`)             | 🟢        |

K6 ist seit dem 2026-09-10 kein Selbstversprechen mehr: `besprechung` ist eine echte zweite
Domäne neben `beispiel`, und der Befehl prüft sie. `beispiel` bleibt bewusst bestehen
(ADR-0004) — nur so wird die Zusage wirklich geprüft und nicht nur behauptet.

## 5. Zielgruppe und Nutzung

**Wer fragt.** Eine Person aus dem Team, die wissen will, was aus einer Besprechung an
Aktionspunkten offen ist. Sie fragt mit ihrer eigenen Identität; sie sieht genau die Notizen,
die ihr das Notizenlaufwerk zeigen würde — nicht mehr.

**Wer genehmigt.** Ein Mensch, bevor irgendetwas nach außen wirkt. Ein Ticket entsteht erst
nach ausdrücklicher Freigabe; die Kante prüft auf exakt `true`, alles andere ist eine
Ablehnung.

**Über welchen Kanal.** Heute drei: `npm run demo` fährt den vollständigen Ablauf ohne HTTP
in einem Befehl (das ist K5), **`npm run fragen` ist der Kanal des MVP** — er löst eine Identität
auf, hält beim Entwurf an und lässt den Menschen entscheiden; aus einer Pipe gelesen ist er
zugleich ein Prüfbefehl —, und der HTTP-Adapter (`src/adapters/http/`) bietet Start, Genehmigung
und Beobachtung der Queue, führt aber fest die Domäne `beispiel` und löst keine Identität auf
(`ARCHITECTURE.md` §4). Ein MCP-Kanal ist vorgesehen, aber an einen Auslöser gebunden — und
die ADR dazu muss festhalten, ob er `approve` überhaupt anbieten darf.

**Wer betreibt es.** Schicht A läuft ohne `ANTHROPIC_API_KEY` und ohne Datenbank, damit die
Messung in CI läuft. Der Betrieb mit echtem Modell und Postgres ist der Produktionspfad und
nicht Voraussetzung für irgendeine Prüfung in diesem Repo.

## 6. Stand und Baseline

### 6.1 Baseline

Eine rote Baseline ist kein Makel, sondern der Ausgangspunkt: der Übergang von Rot zu Grün ist
der Beweis. Deshalb steht hier auch der Stand vor jeder Etappe, nicht nur der beste.

| Datum      | Bericht                                             | Was gemessen wurde                             | Ergebnis                                                              |
| ---------- | --------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| 2026-09-08 | `2026-09-08-schicht-a-beispiel.json`                | Gerüst, vor dem QA-Tor                         | 20/20 vertragstreu · 3.1 100 % · 3.2 0 % · 3.3 100 % · 3.4 100 %      |
| 2026-09-09 | `2026-09-09-schicht-a-beispiel.json`                | nach Etappe 2, erste Messung der Autorisierung | 28/28 vertragstreu · **3.13 0 %** bei Nenner 10 · 3.1–3.4 unverändert |
| 2026-09-10 | `2026-09-10-schicht-a-besprechung-memory-hash.json` | Etappe 3b, zweite Domäne und Entzug            | siehe §6.2                                                            |

Zwei Zahlen sind hier wichtiger als ihr Wert. **3.13 = 0 % ist beweisfähig, nicht nur grün:**
nimmt man die Mandantenprüfung aus `src/kernel/retrieval/filter.js`, springt die Zahl auf
37,5 %, fünf Fälle melden ihr Leck namentlich, und der Lauf endet mit Rückgabewert 1
(Mutationsprobe am 2026-09-09). Und **die Kostenbaseline wurde in Etappe 1 bewusst neu
gesetzt** — 0,000999 → 0,001884 USD je Lauf —, weil das QA-Tor einen zweiten LLM-Aufruf je
Lauf kostet. Ein Anstieg mit benanntem Grund ist kein Rückschritt; ein Anstieg ohne Grund
wäre einer.

### 6.2 Heutiger Stand

Stand 2026-09-10, nach Etappe 3b. Die Zahlen stammen aus dem Lauf desselben Tages; die
Berichte liegen unter `evals/reports/`.

**Was läuft.** Zwei gemessene Domänen. `beispiel` bleibt die Referenzdomäne des Gerüsts,
`besprechung` ist die Vertikale aus ADR-0010 mit eigenem Connector, eigenem
Berechtigungsmodell und eigener Aktionsfläche. Der Kern trägt seit heute Ebene ① Connectors:
ein Connector liefert eine vollständige Momentaufnahme, die Synchronisation ersetzt eine
Quelle atomar (ADR-0011). Die Envelope kennt Freigaben an einzelne Personen (ADR-0012). Neue
Metrik: **3.14 Latenz des Berechtigungsentzugs**.

**Was nicht läuft.** Das Embedding kommt aus einem Hash und sagt nichts über Suchqualität (ADR-0007).
Der Principal ist eine Behauptung des Aufrufers, keine geprüfte Identität — die Auflösung
gegen ein Verzeichnis kommt in Etappe 4 (ADR-0009). Es gibt keinen Zeitplan, der den Connector
regelmäßig laufen ließe; 3.14 misst deshalb **Zyklen, keine Sekunden**.

**Seit Etappe 3c hat der Speicher zwei Adapter.** `postgres` mit pgvector läuft neben
`memory`; dieselbe Eval-Suite liefert gegen beide dieselben Zahlen. K5 bleibt grün, per
Entscheidung (ADR-0013): `memory` ist die Voreinstellung, Postgres wird ausdrücklich
verlangt. Der ACL-Filter hat dafür zwei Kompilate aus **einem** Regelwerk bekommen
(ADR-0014) — belegt durch eine Mutationsprobe, die nur das SQL-Kompilat aushebelt und dabei
den memory-Lauf grün und den Postgres-Lauf rot werden lässt.

**Die Sofortmaßnahme ist am 2026-09-14 gefallen.** Der HTTP-Adapter wandelte
`"approved": "false"` in eine Genehmigung um; seither ist nur ein JSON-Boolean `true` eine
Genehmigung, jeder Nicht-Boolean endet mit 400 (`tests/httpAdapter.test.js`, zuerst rot). Die
Zusage „ohne menschliche Freigabe wirkt nichts nach außen" gilt damit nicht nur im Kern,
sondern auch am Rand.

**Was als Nächstes kommt** (Stand 2026-09-20). Der **MVP-Schnitt** aus ADR-0019 — §7 unten.
**T1 ist eingelöst:** der Agent liest berechtigungstreu, und 3.13 misst das jetzt auch auf
seinem Pfad. Als Nächstes **T2** — die Identität am Rand, aufgelöst statt geglaubt; bis dahin
bleibt der Principal eine Behauptung des Aufrufers (`ARCHITECTURE.md` §4). Etappe 3d ist
gebaut; offen ist nur der Voyage-Lauf, der vor der ersten echten Quelle fallen muss. Die
Etappen 7 bis 14 — echte Quelle, echte Wirkung, Genehmigung in Slack oder Teams, verdiente
Autonomie — stehen samt Begründung in `docs/roadmap.md`. **Ziele, Nicht-Ziele und
Erfolgskriterien in diesem Dokument ändern sich dadurch noch nicht**: jede Etappe zieht sie mit
ihrer eigenen ADR nach.

## 7. Plan

Die vollständige Fassung mit Begründungen steht in `docs/roadmap.md` — dort ein **Vorschlag**,
hier die Kurzform mit dem Tor. Ein Tor ist ein Befehl; ein Tor ohne Befehl ist kein Tor.

Jedes Tor enthält denselben Kern, hier einmal genannt und unten als **Kerntor** abgekürzt:

```bash
npm test && npm run evals && npm run demo
```

| Etappe | Ziel                                             | Tor (Prüfbefehl)                                                                                       | Stand |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----- |
| 0      | Grundlage: ADRs, Ebenenumbau, LangGraph 1.x      | Kerntor mit **identischen** Zahlen · `npm audit` → `high: 0`                                           | 🟢    |
| 1      | Das QA-Tor `pruefer`                             | Kerntor · ein Fall trägt `bearbeiterAufrufe: 2`                                                        | 🟢    |
| 2      | Messbare Autorisierung, ohne Infrastruktur       | `npm run evals` → **3.13 = 0 %** · K5 grün · Trennlinie leer                                           | 🟢    |
| 3a     | Die Vertikale, die Ontologie, dieses Dokument    | Prüfkriterium von ADR-0010 — zwei `grep`, beide leer bzw. 0                                            | 🟢    |
| 3b     | Erster Connector und Ausbreitung des Entzugs     | `npm run evals` → **3.14 = 0 %** · 3.13 unverändert · K5 grün                                          | 🟢    |
| 3c     | Postgres-Adapter neben `memory`                  | dieselbe Eval-Suite gegen Postgres → 3.13 und 3.14 unverändert                                         | 🟢    |
| 3d     | Echtes Embedding                                 | Kerntor · **3.13 unverändert 0 %** — sonst hing sie an der Rangfolge                                   | 🟡    |
| Sofort | Genehmigungslücke im HTTP-Adapter schließen      | HTTP-Test zuerst rot, dann grün · Nicht-Boolean → 400 · Kerntor gleich                                 | 🟢    |
| 4a     | Identität                                        | Identität nicht auflösbar → leer und **kein** LLM-Aufruf — eingelöst; offen bleibt ein ECHTER Anbieter | 🟡    |
| 4b     | Handlungsbefugnis je Principal                   | `npm run evals` → **3.16 = 0 %** · 3.2 und 3.13 unverändert                                            | 🟢    |
| 4c     | Policy, Risikoklasse, Genehmigungs-Timeout       | abgelaufene Genehmigung → deny · **3.15 = 100 %**                                                      | ⬜    |
| 4d     | Audit-Kette, Genehmigung als Entscheidungsobjekt | geänderte Audit-Zeile wird erkannt · bearbeiteter Entwurf durchläuft den Vertrag                       | ⬜    |
| 5      | Aktionsfläche aus der Ontologie erzeugen         | Aktionstyp ohne Modell wird **vor** der Queue abgelehnt · 3.2 = 0 %                                    | 🟢    |
| 6      | An Auslöser gebunden, nicht an einen Kalender    | je Punkt eine eigene ADR vor der ersten Zeile Code                                                     | ⬜    |
| 7      | Erste echte Quelle: Google Drive                 | Drive-Fixtures → 3.13 = 0 % · **3.14 neu definiert** = 0 % · K5 grün                                   | ⬜    |
| 8      | Überfreigabe-Bericht                             | Bericht ohne ein Textzeichen · kein zweiter Leseweg                                                    | ⬜    |
| 9      | Schicht C: Nutzen messbar machen                 | datierter Schicht-C-Bericht mit Modus und Nenner · C.4 = `null`                                        | ⬜    |
| 10     | Erste echte Wirkung: Ticket in Jira              | dieselbe Aktion zweimal, auch nach Absturz → **genau ein** Ticket                                      | ⬜    |
| 11     | Genehmigung in Slack oder Teams                  | unsigniert, wiedergespielt, unbefugt, Nicht-Boolean → abgelehnt                                        | ⬜    |
| 12     | Persönliche Übersicht je Mitarbeiter             | 3.13 = 0 % über Übersicht und Suche · Registry kennt keine Menschen                                    | ⬜    |
| 13     | Dubletten vermeiden                              | Dublette → Kommentar · unsichtbare Dublette wird **nicht** gemeldet                                    | ⬜    |
| 14a    | Rücknahme je Aktionstyp                          | **3.17 = 100 %** · 3.1 und 3.16 unverändert                                                            | ⬜    |
| 14b    | Risikostufen, verdiente Autonomie                | ADR zuerst · Stufe 2 hält weiter an · 3.1 in neuer Definition 100 %                                    | ⬜    |

Die Etappen 3c und 3d sind bewusst getrennt. Beide fassen dieselbe Zusage an — 3.13 — und wer
sie zusammen fährt, kann eine Bewegung der Zahl keiner von beiden zuordnen. Das ist dieselbe
Regel wie „höchstens eine neue Metrik je Etappe" in `docs/roadmap.md` §6, nur von der anderen
Seite gelesen.

### Der MVP-Schnitt

Die Tabelle oben ist der **Ausbau**. Der MVP liegt **quer** dazu: er ist ein Schnitt, der
benennt, was bewusst draußen bleibt, bis der Kern von Hand nachvollziehbar läuft (ADR-0019).
Er beantwortet eine einzige Frage — **trägt das Fundament?** — und nicht die Frage, ob ein
Unternehmen das System einsetzen kann; das ist Etappe 4 bis 10.

Der Grund für den ersten Schritt ist ein Befund vom 2026-09-20: 3.13 und 3.14 messen den
Leseweg, 3.1 und 3.2 messen die Genehmigung, **und dazwischen liegt keine Naht.** Kein
Agentenknoten ruft `suche` auf; `principal` kommt im Agentenlayer nicht vor. Die Zusage „samt
Berechtigungen abgefragt **und** in genehmigte Aktionen überführt" ist damit heute zwei Beweise
nebeneinander statt einer Kette (`ARCHITECTURE.md` §4).

| Schritt | Ziel                                                 | Tor (Prüfbefehl)                                                                                                                                       | Stand |
| ------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| T0      | Der Schnitt ist entschieden und benannt — kein Code  | ADR-0019 · Grenze in `ARCHITECTURE.md` §4 · dieser Abschnitt                                                                                           | 🟢    |
| T1      | Die Naht: der Agent liest als Principal, gefiltert   | unberechtigte Notiz → **kein Entwurf, nichts in der Queue** · 3.13 = 0 % bei **größerem** Nenner · Mutationsprobe (Principal entfernen) → 3.13 **rot** | 🟢    |
| T2      | Identität am Rand, aufgelöst statt geglaubt          | nicht auflösbarer Nachweis → leeres Ergebnis und **null** LLM-Aufrufe · ADR-0018 nachgeschrieben                                                       | 🟢    |
| T3      | Die Genehmigung kommt vom Menschen, nicht vom Skript | Ablehnung von Hand → Queue leer · Genehmigung von Hand → **genau eine** Aktion · CI erstmals grün                                                      | 🟢    |

**Draußen bis T3 steht:** echte Quelle (7), echte Wirkung (10), Postgres als Voreinstellung,
der Voyage-Lauf, Schicht B, Schicht C, Policy und Risikoklasse (4c), Audit-Kette (4d),
Genehmigung in Slack oder Teams (11), Graph (13), MCP, Autonomie (14), sowie `express` 5, E0-B
und `projekt-doktor` §12. Einzige Ausnahme ist die **CI** — geschrieben, aber nie gelaufen; sie
bewahrt den Boden davor, still zu brechen, und wird deshalb in T3 einmal grün gesehen.

**T1 ist am 2026-09-20 eingelöst** (ADR-0019, Nachtrag). Gemessen: 3.13 = 0 % bei Nenner
**50** statt 16 — der Agentenpfad ist seither im Nenner —, Vertragstreue **35/35**, `npm test`
243/249 ohne und **250/250** mit Datenbank, beide Store-Adapter zeichengleich. Die
Mutationsprobe macht die Zahl rot: liest der Agent als Dienstkonto, springt 3.13 auf 7,4 %
(4/54), und zwei Fälle melden ihr Leck namentlich. Was dabei die Planannahme widerlegte — dass
die Relevanzsuche für eine benannte Notiz genügt —, steht im Nachtrag.

**T2 ist am 2026-09-20 eingelöst** (ADR-0018, ADR-0019 Nachtrag 2). Der Kanal legt einen
**Nachweis** vor, ein Verzeichnis antwortet, und ohne Antwort ist das Ergebnis leer und kostet
**keinen Modellaufruf**. Gemessen: `npm test` 247/254 ohne und **254/254** mit Datenbank ·
3.13 unverändert 0 % (0/50) · Vertragstreue 35/35 · beide Store-Adapter zeichengleich · der
Bericht nennt seither den Identitäts-Adapter (`fixtures`). Mutationsprobe: **glaubt** der
Harness den Nachweis statt ihn aufzulösen, springt 3.13 auf 7,4 % (4/54) und zwei Fälle melden
ihr Leck. **Der Kanal ist das Terminal, nicht `/api/run`** — der HTTP-Rand führt `beispiel`, das
nichts liest; die Begründung steht im Nachtrag, die verbleibende Lücke in `ARCHITECTURE.md` §4.

**T3 ist am 2026-09-20 zu zwei Dritteln eingelöst** (ADR-0019, Nachtrag 3). `npm run fragen`
ist der Kanal des MVP: ein Mensch legt seinen Nachweis vor, sieht den Entwurf und entscheidet
selbst. Gemessen, als Prozess von außen (`tests/kanal.test.js`, 5 Fälle): **Ablehnung von Hand →
Queue leer**, **Genehmigung von Hand → genau eine Aktion**, und `true` oder eine leere Zeile
genehmigen **nicht**. Mutationsprobe: setzt man den Parser auf „alles genehmigt", fallen zwei der
fünf Fälle. **Und der dritte Teil des Tors ist eingelöst:** am 2026-09-20 lief die CI zum
ersten Mal — auf einer Maschine, die nicht der Agent ist. Alle drei Jobs grün, keiner
übersprungen: `Schicht A` (npm ci · test · evals · beide Demos), `Postgres` (pgvector als
Dienst, `evals:postgres` und `npm test` gegen die Datenbank) und `Lint und Abhängigkeiten`
(`eslint .`, `npm audit --audit-level=high`). Lauf `35524547434` auf `3449676`.

**Damit steht der MVP-Schnitt vollständig** — gebaut, gemessen, und die Messung nicht mehr
darauf angewiesen, dass der Agent sie ausführt und ehrlich berichtet.

**Und der erste Schritt nach dem MVP ist gefahren: Etappe 4b** (ADR-0020, löst A11 ein). Die
Aktion trägt seither den Principal, und die Queue prüft **vor dem Schreiben**, ob er den Typ an
diesem Ziel auslösen darf — sie glaubt dem Ablauf nicht. Neue Metrik **3.16 = 0 %** (Nenner 2),
`npm test` 254/261 ohne und **262/262** mit Datenbank, beide Store-Adapter zeichengleich.
Mutationsprobe: TOR 1b entfernt → 3.16 springt auf 50 % (2/4), Rückgabewert 1.

**Dabei fand der Lauf gegen den zweiten Adapter einen Defekt, den kein Test gesucht hatte:**
eine Befugnisprüfung mit leerer Zielkennung fiel still in die Relevanzsuche, und dort antworteten
`memory` und Postgres verschieden — aus einer fehlenden Kennung wurde „durchsuche alles" und aus
einer fehlenden Befugnis eine erteilte. Geschlossen an zwei Stellen (Port und Politik), und der
Grund steht bei beiden.

**Was danach kommt, steht hier absichtlich nicht.** Der nächste Schritt wird nach einem
Kriterium gewählt und nicht aus einer Liste abgelesen: **welche Aussage dieses Repos ist heute
noch eine Vorhersage.** Heute wären das der Voyage-Lauf, die erste Schicht-B-Messung und die
erste echte Quelle — in dieser Reihenfolge zu prüfen, nicht zu planen.
