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

### Thema: Etappe 0b — Umbau auf die sechs Ebenen

**Status:** 🔴 Der unmittelbar nächste Schritt. Reine Umbenennung, null Logikänderung, läuft allein. Entschieden in ADR-0002.
`graph/ state/ security/ observability/` → `agent/ action/ governance/`; `persistence/`,
`llm/`, `config/`, `registry.js` bleiben als Infrastruktur außerhalb der Ebenen. Betroffen
sind auch Importpfade in `tests/`, `evals/domains/*/adapter.js` und die Wegweiser-Tabelle in
`CLAUDE.md`. Tor: Kerntor mit **identischen** Zahlen (nicht nur grünen) plus das
Prüfkriterium von ADR-0002. **Verbot:** keine „wo wir schon dabei sind"-Korrektur — die
101-Zeilen-Funktion in der Aktions-Queue und die fünf Verschachtelungsebenen im Checkpointer
bleiben unangetastet, sie gehören zum Lint-Rollout.

### Thema: LangGraph 1.x und die Schwachstellen — Etappe 0c

**Status:** 🔴 Entschieden als ADR-0003, noch nicht ausgeführt. Gemessen 2026-09-09: langgraph 0.2.74 (aktuell 1.4.14), `npm audit` 6 hoch.
Der Entscheidungsteil ist erledigt und steht in `DECISIONS.md`; offen ist nur noch die
Ausführung. Unter den hohen: „LangChain serialization injection enables secret extraction"
(`@langchain/core`). Läuft **nach** dem Umbau und **nie gleichzeitig** mit ihm. Prüfkriterium
von ADR-0003 ist zugleich das Tor. Nebenbei fällig: `description` in `package.json` sagt noch
„Startgeruest" — die einzige bekannte Ausnahme zum Prüfkriterium von ADR-0001.

### Thema: Ingenieursdisziplin einführen

**Status:** 🟡 E0-A steht (12 Warnungen, 0 Fehler); E0-B ist an den Umbau gekoppelt und kommt **nach** Etappe 0b.
Seit 2026-09-08: ESLint 10, Prettier, lefthook, alle Regeln auf `warn`, `src/` unberührt.
E0-B (dependency-cruiser) schreibt seine Regeln auf **Pfade** — vor dem Umbau geschrieben,
müsste es zweimal geschrieben werden. Danach E0-C (`envLive` — erste Etappe mit
Quellcodeänderung), E0-D (`checkJs`), E0-E (zod am HTTP-Rand), E0-F (knip + `.gehirn`-Validator).
Nach dem Umbau werden zwei neue Regeln überhaupt erst schreibbar: `*/store/index.js ✗→
*/store/*.js` und `**/retrieval/filter.js ✗→ node:fs, node:http`.

### Thema: Welche Vertikale — die offene Produktentscheidung

**Status:** 🟡 Blockiert **nicht** mehr den Anfang. Gebraucht ab Etappe 3; Etappe 0, 1 und 2 laufen ohne sie.
Die Umkehr gegenüber dem 2026-09-08: der ACL-Filter braucht keine echte Identität, sondern
einen **Principal** — und in Schicht A kommt der aus dem Datensatz. Ontologie, ACL-Modell,
erster Connector und die Aktionstypen leiten sich weiterhin alle aus ihr ab. Tor:
`grep -c "VORLAGE\|<!-- " PRODUCT.md` → 0 (heute 9). Kandidaten: Besprechungsnotiz → Aktion →
Ticket · Ticket-Triage · Kunden-Onboarding.

## Abgeschlossene Themen

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
