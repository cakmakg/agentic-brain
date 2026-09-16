#!/bin/bash
# PreToolUse: verlangt eine Freigabe, bevor der Agent eine Vertragsdatei aendert.
#
# WARUM ES DIESEN HOOK GIBT. Das Inventar vom 2026-09-15 hat 18 Kontrollpunkte
# gefunden und keinen einzigen technischen Riegel gegen den Agenten: in E0-A ist
# jede ESLint-Regel `warn`, also endet `npx eslint src/` mit 0 und `lefthook`
# blockiert nichts; `.github` fehlt; in `.claude/settings.json` steht kein `deny`.
# Jede Pruefung haengt daran, dass der Agent sie ausfuehrt und ehrlich berichtet.
# Der einzige unabhaengige Kontrollpunkt war der menschliche Blick auf `git diff`.
#
# Dieser Hook blockiert NICHT. Er zwingt den Blick: bei einer geschuetzten Datei
# gibt er `permissionDecision: "ask"` zurueck, und Claude Code zeigt den Diff und
# fragt — auch dann, wenn die Sitzung sonst ohne Rueckfrage schreiben duerfte.
# Der Agent schreibt weiter Tests; was er nicht mehr kann, ist es STILL zu tun.
#
# Warum node und kein jq: jq ist auf dieser Maschine nicht installiert, node ist
# als Node-Projekt ohnehin eine harte Abhaengigkeit (siehe lib.sh). Fehlt node,
# faellt der Hook durch und erlaubt die Aenderung — ohne node laeuft in diesem
# Repo aber weder `npm test` noch `npm run demo`, der Fall ist also theoretisch.

command -v node >/dev/null 2>&1 || exit 0

node -e '
let eingabe = "";
process.stdin.on("data", (d) => (eingabe += d)).on("end", () => {
  let pfad = "";
  try {
    pfad = JSON.parse(eingabe)?.tool_input?.file_path ?? "";
  } catch {
    process.exit(0); // kein gueltiges JSON: nicht im Weg stehen
  }
  if (!pfad) process.exit(0);

  // Auf einen repo-relativen Pfad bringen. Windows liefert Backslashes und eine
  // Laufwerksangabe, deren Gross-/Kleinschreibung nicht verlaesslich ist.
  const norm = (s) => s.replace(/\\/g, "/").replace(/\/+$/, "");
  const wurzel = norm(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  let rel = norm(pfad);
  if (rel.toLowerCase().startsWith(wurzel.toLowerCase() + "/"))
    rel = rel.slice(wurzel.length + 1);

  // Die geschuetzte Menge: Dateien, in denen der Agent seinen EIGENEN Ausfall
  // verdecken koennte. Nicht die, an denen er am meisten arbeitet.
  const MUSTER = [
    [/^tests\//, "Testdatei — eine gelockerte Assertion loescht genau den Fehler, den sie finden soll"],
    [/^evals\/domains\/[^/]+\/golden\//, "Golden-Datensatz — geloeschte Faelle senken den Nenner, und die Metrik meldet weiter gruen"],
    [/^\.gehirn\/regeln\.md$/, "Regelbuch — keine Pruefung zaehlt die Regeln, eine entfernte faellt niemandem auf"],
    [/^PRODUCT\.md$/, "Vertragsdokument — Ziele, Nicht-Ziele und die Tore je Etappe"],
    [/^EVALS\.md$/, "Vertragsdokument — die Metrikdefinitionen, an denen jede Zahl haengt"],
    [/^DECISIONS\.md$/, "Vertragsdokument — die Architekturentscheidungen samt Pruefkriterium"],
  ];

  const treffer = MUSTER.find(([re]) => re.test(rel));
  if (!treffer) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `${rel}: ${treffer[1]}. Lies den Diff, bevor du freigibst.`,
      },
    }),
  );
});
'
