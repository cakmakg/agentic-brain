// ── eslint.config.js ─────────────────────────────────────────────────────
// Etappe E0-A aus `docs/engineering-discipline.md`: die Werkzeuge stehen,
// aber NICHTS blockiert. Jede Regel ist `warn`.
//
// Der Zweck dieser Etappe ist nicht, Fehler zu verhindern, sondern den
// BESTAND sichtbar zu machen. Eine Regel, die sofort auf `error` steht,
// erzwingt eine Sammelkorrektur — und damit ist nicht mehr feststellbar,
// welche Änderung welche Zahl bewegt hat.
//
// Der Weg einer Regel steht in §5 („Die Regelleiter"):
//   Befund → docs/lint-rules.md → warn → Baseline → Bestand abtragen → error

import js from "@eslint/js";
import globals from "globals";

// Setzt jede Regel einer Vorgabe-Konfiguration auf `warn` herunter.
// `js.configs.recommended` liefert viele Regeln als `error` aus; in E0-A
// soll aber nichts blockieren. Das hier ist die einzige Stelle, an der
// diese Absicht steht — sie fällt weg, sobald die Etappen C bis F die
// jeweils zuständigen Regeln einzeln auf `error` heben.
const alsWarnung = (konfiguration) => ({
  ...konfiguration,
  rules: Object.fromEntries(
    Object.keys(konfiguration.rules ?? {}).map((name) => [name, "warn"]),
  ),
});

export default [
  {
    // Erzeugte und laufzeitabhängige Verzeichnisse. Deckungsgleich mit
    // .gitignore — was nicht committet wird, wird auch nicht geprüft.
    ignores: [
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "build/**",
      ".zustand/**",
      "evals/traces/**",
      "evals/reports/**",
      "graphify-out/**",
    ],
  },

  alsWarnung(js.configs.recommended),

  {
    // `.mjs` gehört dazu: tests/fixtures/ startet echte Kindprozesse als
    // .mjs-Dateien. Fehlt die Endung hier, greift nur `recommended` ohne
    // Node-Globals — und `process` gilt als undefiniert. Das wären neun
    // Warnungen, die nichts über den Code aussagen, nur über die Konfiguration.
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      // ── Stufe 4 · Umfang ────────────────────────────────────────────
      // Diese drei erziehen, sie blockieren nicht. Sie bleiben `warn`,
      // bis ein Befund das Gegenteil verlangt.
      complexity: ["warn", 10],
      "max-lines-per-function": [
        "warn",
        { max: 60, skipBlankLines: true, skipComments: true },
      ],
      "max-depth": ["warn", 4],
    },
  },

  {
    // ── Stufe 2 · Der Rand ────────────────────────────────────────────
    // NUR src/. Tests und der Messharness setzen STATE_DIR und TRACE_DIR
    // absichtlich — `env.js` schreibt diesen Zweck selbst hin: sie zeigen
    // damit auf ein frisches Verzeichnis, sonst schleppt ein Lauf den
    // vorigen mit und der Determinismus-Nachweis wäre keiner mehr.
    // Eine Regel, die den dokumentierten Zweck des Repos anmeckert, wird
    // abgeschaltet statt befolgt — deshalb steht die Grenze hier.
    //
    // Was in src/ übrig bleibt, sind drei Stellen (trace.js, store.js ×2).
    // Auch sie sind ABSICHT: sie lesen spät statt beim Modul-Laden, sonst
    // fröre die Import-Reihenfolge den Ort ein. Der Mangel ist ein anderer
    // und feinerer: der VARIABLENNAME lebt dadurch an zwei Orten, und
    // TRACE_DIR steht in env.js nur im Kommentar. E0-C behebt genau das
    // mit spätbindenden Zugriffsfunktionen — nicht durch Löschen der Stellen.
    files: ["src/**/*.js"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "process.env in src/ nur über src/kernel/config/env.js. Sonst lebt der Variablenname an zwei Orten — siehe docs/engineering-discipline.md §4 Stufe 2 (Befund B1).",
        },
      ],
    },
  },

  {
    // Hier IST das Lesen von process.env die Aufgabe der Datei.
    // Die Ausnahme steht bewusst als eigener Block: so ist sie auffindbar
    // und wandert nicht als Kommentar in den Quelltext.
    files: ["src/kernel/config/env.js"],
    rules: { "no-restricted-syntax": "off" },
  },
];
