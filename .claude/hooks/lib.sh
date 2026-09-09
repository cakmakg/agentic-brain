#!/bin/bash
# agentic-brain Projektgedaechtnis - gemeinsame Hilfsfunktionen.
#
# Fuer das JSON-Escaping wird node benutzt. Da dies ein Node-Projekt ist (npm run demo),
# ist node ohnehin eine harte Abhaengigkeit; der Hook fuegt also keine neue hinzu.
# In der Oberversion lief das ueber python3 - diese Abhaengigkeit wurde entfernt.

if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  GEHIRN_PROJEKT_DIR=$CLAUDE_PROJECT_DIR
else
  GEHIRN_HOOK_DIR=$(CDPATH= cd "$(dirname "$0")" 2>/dev/null && pwd)
  GEHIRN_PROJEKT_DIR=$(CDPATH= cd "$GEHIRN_HOOK_DIR/../.." 2>/dev/null && pwd)
fi

GEHIRN_DIR="$GEHIRN_PROJEKT_DIR/.gehirn"

# Liest stdin und gibt es als JSON-String-Literal aus (inklusive Anfuehrungszeichen).
gehirn_json_escape() {
  command -v node >/dev/null 2>&1 || return 1
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(s)))' 2>/dev/null
}

# Gibt die von Claude Code erwartete Hook-Ausgabe aus.
gehirn_ausgeben() {
  GEHIRN_EVENT=$1
  GEHIRN_TEXT=$2

  case "$GEHIRN_EVENT" in
    SessionStart) ;;
    *) return 0 ;;
  esac

  GEHIRN_ESCAPED=$(printf '%s' "$GEHIRN_TEXT" | gehirn_json_escape 2>/dev/null || :)
  if [ -n "$GEHIRN_ESCAPED" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":%s}}\n' \
      "$GEHIRN_EVENT" "$GEHIRN_ESCAPED"
    return 0
  fi

  # Ohne node: feste ASCII-Warnung ausgeben, die kein Escaping braucht.
  # Besser als beschaedigtes JSON.
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' \
    "$GEHIRN_EVENT" \
    'Projektgedaechtnis nicht geladen: node nicht gefunden. projekt-doktor ausfuehren.'
}
