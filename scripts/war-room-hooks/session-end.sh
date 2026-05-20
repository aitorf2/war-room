#!/usr/bin/env bash
# War Room session end hook — writes a testament record to the local War Room API.
#
# Register in ~/.claude/settings.json under hooks.Stop so Claude Code calls
# this script every time a session ends.
#
# Claude Code Stop hook environment variables used:
#   CLAUDE_SESSION_ID    — the CLI session id (may be empty on first run)
#   CLAUDE_PROJECT_PATH  — absolute path to the project directory
#
# War Room-specific env vars (set in your shell or .env):
#   WAR_ROOM_CHANNEL_ID  — the War Room channel slug this project maps to
#   WAR_ROOM_URL         — base URL of the running War Room app (default: http://localhost:3000)

CHANNEL_ID="${WAR_ROOM_CHANNEL_ID:-}"
PROJECT_PATH="${CLAUDE_PROJECT_PATH:-$(pwd)}"
SESSION_ID="${CLAUDE_SESSION_ID:-}"
WAR_ROOM_URL="${WAR_ROOM_URL:-http://localhost:3000}"

# Skip silently if the user is not inside a War Room-linked session.
if [ -z "$CHANNEL_ID" ]; then
  exit 0
fi

# Build minimal payload. War Room stores this to signal session continuity
# even when the agent has not written an explicit testament. The next
# getSessionInjectionContext() call will surface the empty-testament marker
# so the agent knows a prior session existed.
PAYLOAD=$(printf '{"channelId":"%s","sessionId":"%s","projectPath":"%s","source":"stop-hook"}' \
  "$CHANNEL_ID" "$SESSION_ID" "$PROJECT_PATH")

curl -s -X POST "${WAR_ROOM_URL}/api/session-memory" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  > /dev/null 2>&1 || true

exit 0
