#!/bin/bash
# Injiziert zu Sitzungsbeginn das Projektgedaechtnis in den Kontext.
#
# Nur lesend: schreibt keine Datei, startet keinen Hintergrundprozess, macht keinen Netzaufruf.
# Geschrieben wird das Gedaechtnis vom Agenten (siehe CLAUDE.md > Gedaechtnisprotokoll).

GEHIRN_HOOK_DIR=$(CDPATH= cd "$(dirname "$0")" 2>/dev/null && pwd)
. "$GEHIRN_HOOK_DIR/lib.sh" 2>/dev/null || exit 0

GEHIRN_NL='
'

# --- Anker des Projekts: der Kern wird vollstaendig injiziert. Er steht bewusst
#     zuerst — Identitaet vor Kontext, Kontext vor Arbeitsliste, Arbeitsliste vor Regeln.
GEHIRN_KERN=""
if [ -f "$GEHIRN_DIR/kern.md" ]; then
  GEHIRN_KERN=$(cat "$GEHIRN_DIR/kern.md" 2>/dev/null)
fi

# --- Bruecke zur letzten Sitzung: nur der oberste Block "## Sitzung:" bis vor die
#     naechste "## Sitzung:"- oder "## Fruehere"-Ueberschrift. Ohne den ersten Check
#     wuerde aktiv=1 beim naechsten Sitzungskopf nicht zurueckgesetzt und mehrere
#     Sitzungen wuerden zu einem Block verschmelzen.
GEHIRN_LETZTE=""
if [ -f "$GEHIRN_DIR/letzte-sitzung.md" ]; then
  GEHIRN_LETZTE=$(awk '
    /^## Sitzung:/ { if (aktiv) exit; aktiv = 1 }
    aktiv && /^## Fr/ { exit }
    aktiv { print }
  ' "$GEHIRN_DIR/letzte-sitzung.md" 2>/dev/null | sed -n '1,50p')
fi

# --- Offene Themen: Titel- und Statuszeilen zwischen "## Aktive" und "## Abgeschlossene".
#     12 Zeilen = 6 Themen. Mehr bleibt in themen.md, wird aber nicht injiziert.
GEHIRN_THEMEN=""
if [ -f "$GEHIRN_DIR/themen.md" ]; then
  GEHIRN_THEMEN=$(sed -n '/^## Aktive/,/^## Abgeschlossene/p' "$GEHIRN_DIR/themen.md" 2>/dev/null \
    | grep -E '^### |^\*\*Status:\*\*' 2>/dev/null \
    | sed -n '1,12p')
fi

# --- Verbindliche Regeln: erste 60 Zeilen. Das ist das Injektionsfenster der Regeldatei.
GEHIRN_REGELN=""
if [ -f "$GEHIRN_DIR/regeln.md" ]; then
  GEHIRN_REGELN=$(sed -n '1,60p' "$GEHIRN_DIR/regeln.md" 2>/dev/null)
fi

# Abschnittsgrenze. Die gestaffelte Kuerzungslogik der Oberversion ist hier ueberfluessig:
# 3000 + 4000 + 2000 + 4000 = 13.000, Gesamtobergrenze 16.000. Die Abschnittsgrenzen
# genuegen allein. Wer hier ein Limit anhebt, muss diese Summe nachrechnen.
gehirn_grenze() {
  GEHIRN_WERT=$1
  GEHIRN_LIMIT=$2
  GEHIRN_NOTIZ=$3
  if [ "${#GEHIRN_WERT}" -le "$GEHIRN_LIMIT" ]; then
    printf '%s' "$GEHIRN_WERT"
    return 0
  fi
  GEHIRN_BEHALT=$((GEHIRN_LIMIT - ${#GEHIRN_NOTIZ} - 1))
  [ "$GEHIRN_BEHALT" -gt 0 ] || GEHIRN_BEHALT=0
  printf '%s\n%s' "${GEHIRN_WERT:0:$GEHIRN_BEHALT}" "$GEHIRN_NOTIZ"
}

GEHIRN_KERN=$(gehirn_grenze "$GEHIRN_KERN" 3000 \
  '[Notiz: Kern gekuerzt, projekt-doktor ausfuehren]')
GEHIRN_LETZTE=$(gehirn_grenze "$GEHIRN_LETZTE" 4000 \
  '[Notiz: letzte Sitzung gekuerzt, projekt-doktor ausfuehren]')
GEHIRN_THEMEN=$(gehirn_grenze "$GEHIRN_THEMEN" 2000 \
  '[Notiz: offene Themen gekuerzt, projekt-doktor ausfuehren]')
GEHIRN_REGELN=$(gehirn_grenze "$GEHIRN_REGELN" 4000 \
  '[Notiz: Regeln gekuerzt, projekt-doktor ausfuehren]')

GEHIRN_KONTEXT=""
[ -n "$GEHIRN_KERN" ] && \
  GEHIRN_KONTEXT="${GEHIRN_KONTEXT}[Gedächtnis: Kern]${GEHIRN_NL}${GEHIRN_KERN}${GEHIRN_NL}${GEHIRN_NL}"
[ -n "$GEHIRN_LETZTE" ] && \
  GEHIRN_KONTEXT="${GEHIRN_KONTEXT}[Gedächtnis: Letzte Sitzung]${GEHIRN_NL}${GEHIRN_LETZTE}${GEHIRN_NL}${GEHIRN_NL}"
[ -n "$GEHIRN_THEMEN" ] && \
  GEHIRN_KONTEXT="${GEHIRN_KONTEXT}[Gedächtnis: Offene Themen]${GEHIRN_NL}${GEHIRN_THEMEN}${GEHIRN_NL}${GEHIRN_NL}"
[ -n "$GEHIRN_REGELN" ] && \
  GEHIRN_KONTEXT="${GEHIRN_KONTEXT}[Gedächtnis: Verbindliche Regeln]${GEHIRN_NL}${GEHIRN_REGELN}${GEHIRN_NL}${GEHIRN_NL}"

GEHIRN_KONTEXT="${GEHIRN_KONTEXT}[Gedächtnis] Kontinuität liegt in deiner Verantwortung: diese Sitzung darf keine Spur schuldig bleiben.
Die dauerhafte Wahrheit steht in den Repo-Dokumenten; \`.gehirn/\` hält nur die Kontinuität."

gehirn_ausgeben SessionStart "$GEHIRN_KONTEXT"
exit 0
