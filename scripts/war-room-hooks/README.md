# War Room Claude Code Hooks

These scripts integrate War Room's session memory system with Claude Code's hook mechanism.

## Available hooks

### `session-end.sh` — Stop hook

Called by Claude Code every time a session ends (the agent stops responding).
It posts a minimal testament record to the running War Room API so the next
session can detect continuity and inject prior context automatically.

## Registration

Add the following to `~/.claude/settings.json` (or the project-local
`.claude/settings.json`) under the `hooks` key:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/war-room/scripts/war-room-hooks/session-end.sh"
          }
        ]
      }
    ]
  }
}
```

Replace `/absolute/path/to/war-room` with the actual path where you cloned War Room.

## Required environment variables

Set these in your shell profile (`.zshrc`, `.bashrc`) or in a `.env` file
that your shell sources before launching Claude Code:

| Variable | Required | Default | Description |
|---|---|---|---|
| `WAR_ROOM_CHANNEL_ID` | Yes | (none) | The War Room channel slug that this project maps to. If unset, the hook exits silently. |
| `WAR_ROOM_URL` | No | `http://localhost:3000` | Base URL of the running War Room instance. |

## How session memory works end-to-end

1. When a Claude Code session ends, `session-end.sh` posts to `POST /api/session-memory`.
2. War Room writes a testament record to the `session_testaments` SQLite table.
3. When the next session starts, the agent (or the War Room UI) calls
   `GET /api/session-memory?channelId=<slug>` to retrieve the injection context.
4. The injection context includes (in order): immutable agreements, prior testament,
   top friction points, and the deduced work frontier.
5. The agent prepends this context to its first response so it resumes without
   losing continuity across context compactions.

## Writing a richer testament

The `session-end.sh` script writes a minimal empty-marker testament. For a
full testament with commitments, decisions, and next steps, POST directly:

```bash
curl -X POST http://localhost:3000/api/session-memory \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "my-channel",
    "testament": {
      "commitments": ["Finish the auth refactor by Friday"],
      "decisions": ["Use JWT, not sessions"],
      "nextSteps": ["Write migration for users table"],
      "openQuestions": ["Do we need refresh tokens?"]
    }
  }'
```
