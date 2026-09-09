---
name: projekt-doktor
description: Gesundheitscheck fuer agentic-brain. Gedaechtnis-Hook, .gehirn-Dateien, Abhaengigkeitsinstallation, Demo-Durchlauf, Tests, Messinstrument, Kern-Domaenen-Trennung, Dokumentkonsistenz und Risiko von Geheimnislecks werden in einer Tabelle berichtet. Bei "projekt doktor", "doktor", "gesundheitscheck", "ist alles in Ordnung", "funktioniert das Gedaechtnis" verwenden, oder wenn der Verdacht besteht, dass ein Mechanismus still nicht mehr laeuft.
---

# Projekt-Doktor

Dieses Skill prüft die **mechanische** Schicht des Projekts: läuft die Gedächtnisinjektion,
sind die Abhängigkeiten intakt, hält die Trennung zwischen Kern und Domäne, stimmen die
Dokumente mit der Wirklichkeit überein, droht ein Geheimnis ins Repo zu gelangen.

Ziel ist es, **stille Ausfälle sichtbar zu machen** — nicht die lauten. Ein Absturz fällt
ohnehin auf; ein Mechanismus, der weiterläuft und nichts mehr leistet, nicht.

Die zentrale Regel dieses Projekts lautet: *Dass eine Datei existiert, ist kein Beweis; ein
bestandener Prüfbefehl ist einer.* Dieses Skill ist die mechanische Form dieser Regel.

## Arbeitsweise

1. Arbeite im Repo-Stammverzeichnis (dort, wo `CLAUDE.md` liegt). Alle Pfade relativ.
2. Führe die Prüfungen **der Reihe nach mit Bash aus**. Nimm die Befehle wie sie sind,
   rate nicht.
3. Stufe jede Ausgabe als 🟢 / 🟡 / 🔴 ein.
4. Gib das Ergebnis in **einer einzigen Tabelle** aus, mit einer Korrekturzeile je 🔴.
5. Schließe mit **einem einzigen Satz Urteil**.

Die Prüfungen sind nur lesend. Repariere nichts von selbst; berichte zuerst, korrigiere erst
auf Wunsch.

---

## A. Gedächtnismechanik

### 1. Sind die Hook-Dateien vorhanden und ausführbar

```bash
for f in lib.sh session-start.sh; do p=".claude/hooks/$f"; if [ ! -f "$p" ]; then echo "$f: DATEI FEHLT"; elif [ ! -x "$p" ]; then echo "$f: NICHT ausfuehrbar"; else echo "$f: ok"; fi; done
```

🟢 beide `ok`. 🔴 fehlt oder nicht ausführbar.
Korrektur: `chmod +x .claude/hooks/*.sh`; fehlt die Datei, aus der Historie zurückholen.

### 2. Ist der Hook in settings.json verdrahtet

```bash
node -e 'try{const s=require("./.claude/settings.json");const h=(s.hooks&&s.hooks.SessionStart)||[];const n=h.flatMap(m=>m.hooks||[]).filter(x=>String(x.command||"").includes("session-start.sh")).length;console.log("SessionStart-Verdrahtung:",n)}catch(e){console.log("settings.json: BESCHAEDIGT -",e.message)}'
```

🟢 `1`. 🔴 `0` (der Hook läuft überhaupt nicht) oder JSON beschädigt.

### 3. Läuft der Hook wirklich und liefert er gültiges JSON

```bash
CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/session-start.sh | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const t=j.hookSpecificOutput.additionalContext;console.log("JSON ok, Zeichen:",t.length);console.log("Abschnitte:",["Kern","Letzte Sitzung","Offene Themen","Verbindliche Regeln"].filter(a=>t.includes("[Gedächtnis: "+a+"]")).join(" · ")||"KEINE")}catch(e){console.log("UNGUELTIGES JSON:",e.message)}})'
```

🟢 gültiges JSON und alle vier Abschnitte. 🟡 ein Abschnitt fehlt (die Datei ist leer).
🔴 ungültiges JSON — dann wird **gar nichts** injiziert.

**Das ist die wichtigste Prüfung des Skills.** Ein kaputter Hook meldet sich nicht; die
Sitzung beginnt einfach ohne Gedächtnis, und niemand merkt es.

### 4. Sind die vier .gehirn-Dateien vorhanden und nicht leer

```bash
for f in kern.md letzte-sitzung.md themen.md regeln.md; do p=".gehirn/$f"; if [ ! -f "$p" ]; then echo "$f: FEHLT"; else echo "$f: $(wc -c <"$p") Zeichen"; fi; done
```

🟢 alle vier vorhanden und > 200 Zeichen. 🟡 eine ist fast leer. 🔴 eine fehlt.

### 5. Passt das Injektionsfenster

```bash
echo "themen.md aktive Themen: $(sed -n '/^## Aktive/,/^## Abgeschlossene/p' .gehirn/themen.md | grep -c '^### ')"
echo "regeln.md Zeilen bis zum Fenster: $(sed -n '1,60p' .gehirn/regeln.md | wc -l) von $(wc -l < .gehirn/regeln.md)"
```

🟢 höchstens sechs aktive Themen. 🟡 mehr — dann fällt der Rest still aus der Injektion.

---

## B. Lauffähigkeit

### 6. Sind die Abhängigkeiten installiert und unversehrt

```bash
npm ls --depth=0 2>&1 | tail -20
```

🟢 keine `UNMET`/`invalid`-Zeile. 🔴 sonst. Korrektur: `npm install`.

### 7. Läuft der Demo-Durchlauf Ende zu Ende

```bash
npm run demo 2>&1 | tail -8
```

🟢 die letzte Zeile meldet einen zugestellten Artefaktstatus. 🔴 Absturz oder Abbruch.

Das ist das Kriterium `clone → install → demo`. Bricht es, ist das Gerüst für jemand
Fremdes wertlos, egal wie grün die Tests sind.

### 8. Sind die Tests grün und über der Abdeckungsgrenze

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail) " ; npm test 2>&1 | grep "all files"
```

🟢 `fail 0` und Abdeckung über der Grenze im `package.json`. 🔴 sonst.

### 9. Misst das Messinstrument noch

```bash
npm run evals 2>&1 | tail -14
```

🟢 Vertragstreue vollständig **und** Determinismus identisch **und** Exit-Code 0.
🔴 eine Abweichung, ein abweichender Determinismus, oder Exit-Code ≠ 0.

🟡 wenn der Nenner einer Metrik 0 ist („nicht messbar"): dann misst der Datensatz diese
Zusage nicht mehr, obwohl der Lauf grün aussieht.

---

## C. Struktur und Konsistenz

### 10. Hält die Trennung zwischen Kern und Domäne

```bash
for d in $(ls src/domains); do n=$(grep -rl "$d" src/kernel/ 2>/dev/null | wc -l); echo "$d im Kern: $n Datei(en)"; done
```

🟢 überall `0`. 🔴 sonst — die teuerste Entscheidung des Repos ist unterwandert.

### 11. Kennt der Harness alle Domänen

```bash
echo "src/domains: $(ls src/domains | tr '\n' ' ')"
echo "evals/domains: $(ls evals/domains | grep -v index.js | tr '\n' ' ')"
grep -n "DOMAENEN" evals/domains/index.js
```

🟢 die drei Listen decken sich. 🔴 eine Domäne existiert, wird aber nicht gemessen —
und der Harness meldet trotzdem grün.

### 12. Beschreiben die Dokumente noch die Wirklichkeit

```bash
grep -rn "src/domains/\|src/kernel/\|src/adapters/" README.md CLAUDE.md ARCHITECTURE.md 2>/dev/null | grep -o "src/[a-z/]*" | sort -u | while read p; do [ -e "$p" ] && echo "ok   $p" || echo "TOT  $p"; done
```

🟢 keine `TOT`-Zeile. 🔴 ein Dokument nennt einen Pfad, den es nicht gibt.

Ein Dokument, das eine gelöschte Struktur beschreibt, ist schlimmer als kein Dokument:
es wird geglaubt.

### 13. Stehen Zahlen in Dokumenten ohne Beleg

```bash
ls evals/reports/*.json 2>/dev/null | tail -3 || echo "KEIN BERICHT"
grep -nE "[0-9]+([,.][0-9]+)? ?%" README.md PRODUCT.md EVALS.md ARCHITECTURE.md 2>/dev/null | head -20
```

🟡 jede gefundene Prozentzahl von Hand gegen den jüngsten Bericht halten. 🔴 eine Zahl,
die in keinem Bericht steht — das ist genau der Fehler, gegen den dieses Projekt gebaut ist.

---

## D. Geheimnisse

### 14. Droht ein Leck

```bash
git check-ignore -v .env .gehirn/letzte-sitzung.md .claude/settings.local.json 2>&1 | head
git status --short | grep -E "^\?\?|^ M" | grep -E "\.env|\.zustand|traces/" || echo "keine verdaechtige Datei im Arbeitsverzeichnis"
```

🟢 `.env` ist ignoriert **und** keine Zustands- oder Trace-Datei im Status.
🔴 sonst. **Lies den Inhalt einer `.env` nicht** — prüf nur, dass sie ignoriert ist.

### 15. Steht ein Schlüssel im Code

```bash
grep -rnE "sk-ant-|api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9_-]{20,}" src/ evals/ tests/ docs/ *.md 2>/dev/null | grep -v "x-api-key\|API_KEY=" || echo "kein hartkodierter Schluessel gefunden"
```

🟢 nichts gefunden. 🔴 ein Treffer — sofort melden, nicht ausgeben.

---

## Bericht

Genau eine Tabelle:

| # | Prüfung | Ergebnis | Befund |
| --- | --- | --- | --- |
| 1 | Hook-Dateien | 🟢 | … |
| … | … | … | … |

Darunter je 🔴 eine Korrekturzeile: **was zu tun ist**, in einem Satz, mit dem Befehl.

Zum Schluss **ein** Satz Urteil. Kein Absatz, keine Zusammenfassung der Tabelle.

Und die Regel, die auch für dieses Skill gilt: melde nur, was ein Befehl gezeigt hat. Was
nicht geprüft wurde, steht als „nicht geprüft" in der Tabelle — nicht als 🟢.
