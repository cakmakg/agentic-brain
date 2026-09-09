# Projektgedächtnis: Kern

Diese Datei ist der dauerhafte Anker für jeden Agenten, der im Repo `agentic-brain`
arbeitet. Sie bleibt kurz: die dauerhafte Wahrheit steht in den Repo-Dokumenten, hier
steht nur die Orientierung. Sie wird zu Sitzungsbeginn **vollständig** injiziert —
was hier wächst, kostet in jeder Sitzung Kontext.

## Was dieses Repo ist

**agentic-brain** — ein Startgerüst mit produktionsreifen Mustern für menschlich genehmigte
Multi-Agenten-Systeme, domänenunabhängig.

Kein Produkt, sondern ein **Satz technischer Muster** mit eingebautem Messinstrument.

<!-- ERSETZ DIESEN ABSATZ, sobald du weißt, was DEIN Projekt ist. Ein Absatz genügt:
     was es ist, für wen, in welchem Zustand. Die ausführliche Fassung nach PRODUCT.md. -->

> Die Autoritätskette und das Gedächtnisprotokoll stehen in `CLAUDE.md` — dort und nur dort.
> Claude Code lädt jene Datei ohnehin bei jeder Sitzung; eine zweite Kopie hier würde
> irgendwann auseinanderdriften. Diese Datei trägt nur, was sonst nirgends steht.

## Was niemals vergessen werden darf

- **Dass eine Datei existiert, ist kein Beweis; ein bestandener Prüfbefehl ist einer.**
  „Fertig" gilt erst, wenn der Befehl durchläuft — nicht, wenn der Code beim Lesen richtig
  aussieht. Prüf einen Befund durch Ausführen, bevor du ihn meldest.

- **Der Mock-Modus ist die Grundlage von allem.** Ohne `ANTHROPIC_API_KEY` läuft der komplette
  Ablauf Ende zu Ende. Tests und die Evaluationen der **Schicht A** bauen darauf:
  deterministisch, kostenlos, in CI ausführbar. Im Gegenzug messen sie **nicht** die Qualität
  der Modellausgabe, sondern die Korrektheit von Routing und Richtlinien. Die Qualität misst
  die **Schicht B** gegen ein echtes Modell, als Ausgabevertrag statt als Urteil — diese
  Unterscheidung gehört in jede Evaluationsdiskussion.

- **Die Trennlinie `kernel` / `domains` ist die teuerste Entscheidung des Repos.** Der Kern
  kennt keine einzelne Domäne. Prüfkriterium, nach jeder Erweiterung:
  `grep -rn "<domäne>" src/kernel/` muss leer bleiben. Ohne diesen Griff wandert
  Domänenwissen still hinein, und die dritte Domäne kostet so viel wie die erste.

- **Fail-closed heißt wörtlich fail-closed.** Nur ein exaktes `true` bei `humanApproval`
  führt zum terminalen Knoten. `false`, `null`, `undefined` enden bei `END`. Das ist die
  zentrale Zusage; sie liegt im Kern, nicht in einer Domäne, damit keine Domäne sie
  vergessen kann.

- **Keine Zahl ohne datierten Lauf in `evals/reports/`.** Was nicht gemessen wurde, trägt die
  Markierung „nicht gemessen" — nicht eine plausibel aussehende Zahl. Und: eine Erwartung im
  Datensatz wird aus der **Regel** abgeleitet, nie an einen beobachteten Lauf angepasst.

## Wo nachschauen

`CLAUDE.md` trägt den vollständigen Wegweiser. Die vier Vertragsdokumente sind `PRODUCT.md`,
`ARCHITECTURE.md`, `DECISIONS.md`, `EVALS.md`; der Wachstumsweg steht in `EXTEND.md`.
