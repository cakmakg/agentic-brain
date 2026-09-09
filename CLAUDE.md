# agentic-brain

Ein domänenunabhängiges Startgerüst für menschlich genehmigte Multi-Agenten-Systeme.
Zugleich ein Arbeitsnachweis: nicht nur die Arbeit zählt als Beweis, sondern **wie sie
gemessen wurde**.

Diese Datei ist ein Wegweiser. Die dauerhafte Wahrheit steht in den Repo-Dokumenten;
hier steht, wo du nachschaust.

## Sprache

**Das Repo ist auf Deutsch** — Dokumente, Code-Kommentare, Log-Ausgaben, Gedächtnisdateien.
**Das Gespräch mit der Nutzerin oder dem Nutzer läuft auf Türkisch.** Schreib also alles,
was ins Repo geht, auf Deutsch, und antworte im Chat auf Türkisch.

Dateinamen der Wurzeldokumente bleiben englisch (`PRODUCT.md`, `EXTEND.md`,
`ARCHITECTURE.md`, `DECISIONS.md`, `EVALS.md`, `docs/`) — gängige Konvention und
bruchfreie Querverweise. Verzeichnis- und Skill-Namen sind deutsch (`.gehirn/`,
`projekt-doktor`).

Das Kriterium, falls eine Datei später doch türkisch sein soll: türkisch ist, was einem
**Menschen** das Projekt erklärt; deutsch ist alles, was als **Vertrag** gelesen wird.

**Ton:** Direkt, hohes Signal. Keine Einleitungsfloskeln, keine Entschuldigungen,
kein Füllmaterial.

> Allgemeine Entwicklungspräferenzen (TypeScript, Next.js, Mongoose, Git-Disziplin) stehen
> in der globalen `~/.claude/CLAUDE.md` und werden hier nicht wiederholt. Diese Datei trägt
> nur, was speziell für `agentic-brain` gilt.

## Ladereihenfolge

1. `.gehirn/kern.md` — der Anker des Projekts. Was das Repo ist, wofür es existiert,
   was niemals vergessen werden darf.
2. **Letzte Sitzung und offene Themen** — der `SessionStart`-Hook injiziert sie automatisch
   (`.gehirn/letzte-sitzung.md`, `.gehirn/themen.md`).
3. **Verbindliche Regeln** — ebenfalls automatisch injiziert (`.gehirn/regeln.md`,
   erste 60 Zeilen). Was dort steht, ist bindend.
4. **Repo-Dokumente** — werden nicht automatisch geladen. Öffne das passende, bevor du
   entscheidest.

## Autoritätskette

Bei Widerspruch gewinnt der obere Eintrag:

1. Das Wort der Nutzerin oder des Nutzers in dieser Sitzung
2. `PRODUCT.md` · `ARCHITECTURE.md` · `DECISIONS.md` · `EVALS.md`
3. `.gehirn/regeln.md`
4. `.gehirn/kern.md` und diese Datei

Dauerhaftes Wissen lebt in den Repo-Dokumenten. `.gehirn/` hält nur die Kontinuität zwischen
Sitzungen und offene Themen, die noch zu keiner Entscheidung geworden sind. Reift ein Thema,
**wandert es** in ein Repo-Dokument und die Spur in `.gehirn/` wird gekürzt. Diese Trennung
ist bewusst: sie verhindert, dass zwei Gedächtnisse auseinanderdriften.

## Wegweiser nach Aufgabentyp

| Aufgabentyp | Wo nachschauen |
| --- | --- |
| Umfang, Nicht-Ziele, Erfolgskriterien | `PRODUCT.md` |
| Architekturentscheidung, Trade-off, bekannte Grenzen | `ARCHITECTURE.md` |
| „Warum wurde so entschieden" | `DECISIONS.md` |
| Messung, Metrikdefinition, Baseline | `EVALS.md` |
| Wachstumsreihenfolge, schichtweiser Ausbau | `EXTEND.md` |
| Ablaufdetails, Knotenreihenfolge, HITL-Mechanik | `docs/workflow.md` |
| Sicherheitsmodell, Bedrohungsmodell | `docs/security-model.md` |
| KI-gestützter Entwicklungsprozess, Gedächtnisrhythmus | `docs/development-process.md` |
| Agentenverhalten und Prompts | `src/domains/<domäne>/prompts.js` |
| Graph-Topologie, Pause und Fortsetzung | `src/kernel/graph/` |
| Auth, Rate-Limit, Aktions-Isolation | `src/kernel/security/` (Mechanik) · `src/domains/<domäne>/actions.js` (Whitelist) |
| LLM-Adapter, Mock-Modus, Kosten | `src/kernel/llm/` · `src/kernel/observability/costTracker.js` |
| State-Schema und Reducer | `src/kernel/state/` — Kernfelder plus Felder der Domäne |
| Domänen-Spezifikation, Bremsenreihenfolge | `src/domains/<domäne>/domain.js` · Registrierung `src/kernel/registry.js` |
| Tests | `tests/` — `node:test`, Aufruf `npm test` |
| Evaluations-Harness und Datensatz | `evals/` — Aufruf `npm run evals`, Grenzen in `evals/README.md` |
| Offene Themen | `.gehirn/themen.md` |
| Verbindliche Projektkonventionen | `.gehirn/regeln.md` |
| Gesundheitscheck | Skill `projekt-doktor` |

## Wohin neue Dateien gehören

**Jede neue Datei entsteht direkt an ihrem Zielort.** Mechanik nach `src/kernel/`,
Bedeutung nach `src/domains/<domäne>/`, Außenkontakt nach `src/adapters/`. Es gibt keine
vorläufige Ablage — eine später umgezogene Datei bricht den Vergleich zur Baseline.

Eine neue Domäne entsteht als Geschwisterdatei zu `domains/beispiel/` und ändert **null
Zeilen** unter `src/kernel/`. Das ist ein Prüfkriterium, keine Stilfrage:

```bash
grep -rn "beispiel" src/kernel/    # muss leer bleiben
```

## Gedächtnisprotokoll

In diesem Projekt gibt es **keinen** automatischen Compiler: das Gedächtnis schreibst du.
Der Hook liest nur und injiziert zu Sitzungsbeginn.

Bevor eine bedeutsame Sitzung endet:

- `.gehirn/letzte-sitzung.md` — aktualisiere den obersten Block: was getan wurde, was bewusst
  unterlassen wurde, was als Nächstes kommt, welcher Rest offen bleibt.
- `.gehirn/themen.md` — schieb abgeschlossene Themen nach `## Abgeschlossene Themen`, trag neue
  unter `## Aktive Themen` ein. Halte die Zahl aktiver Themen bei sechs; mehr passt nicht ins
  Injektionsfenster.
- `.gehirn/regeln.md` — wenn du korrigiert wurdest („mach das nicht so", „nie wieder so"),
  trag die Korrektur in derselben Sitzung als Regel ein: **welche Regel**, **warum sie
  existiert**. Halte dich nah an die Formulierung der Nutzerin oder des Nutzers, füge keine
  eigene Deutung hinzu.

**Übergaberegel:** Jede bedeutsame Sitzung hinterlässt eine Spur. Entweder eine Entscheidung,
eine Regel oder eine aktualisierte Datei. Eine Sitzung ohne Spur beginnt beim nächsten Mal
wieder bei null.

**Verifikation:** Diese Datei ist ein Wegweiser, nicht die Wahrheit selbst. Lies die aktuelle
Datei, bevor du einem Pfad oder einem Zustand vertraust. **Dass eine Datei existiert, ist kein
Beweis; ein bestandener Prüfbefehl ist einer.**
