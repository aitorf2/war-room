// Event emitter for channel lifecycle events.
// Writes to channel_events table and also logs to activity table
// so the dashboard surfaces autonomous activity without extra queries.

import { db } from "./db";

export type ChannelEventType =
  | "autonomy_started"
  | "autonomy_completed"
  | "andon_pulled"
  | "agent_completed"
  | "intent_queued"
  | "intent_executed"
  | "budget_exhausted"
  | "phase_changed"
  | "state_review_triggered";

function ensureChannelEventsTable() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS channel_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      emitted_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_channel_events_channel
      ON channel_events(channel_id, emitted_at DESC);
  `);
}

let _eventsReady = false;
function ensureEvents() {
  if (_eventsReady) return;
  ensureChannelEventsTable();
  _eventsReady = true;
}

/** Persist a channel lifecycle event and echo it to the activity log. */
export function emitChannelEvent(
  channelId: string,
  eventType: ChannelEventType,
  payload?: Record<string, unknown>,
) {
  ensureEvents();
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO channel_events(channel_id, event_type, payload_json, emitted_at)
       VALUES(?, ?, ?, ?)`,
    )
    .run(channelId, eventType, payload ? JSON.stringify(payload) : null, now);

  // Mirror to activity so the dashboard widget shows autonomous events inline
  // with manual chat activity, using kind="autonomy_summary" for outer-loop
  // summaries and "system" for the rest.
  const activityKind =
    eventType === "autonomy_started" || eventType === "andon_pulled"
      ? "system"
      : "system";

  try {
    db()
      .prepare(
        `INSERT INTO activity(kind, title, detail, project_path, created_at)
         VALUES(?, ?, ?, ?, ?)`,
      )
      .run(
        activityKind,
        `[autonomous] ${eventType} — ${channelId}`,
        payload ? JSON.stringify(payload).slice(0, 200) : null,
        null,
        now,
      );
  } catch {
    // activity table may not be initialised yet on cold installs; non-fatal
  }
}

/** Return unconsumed events for a channel, newest first. */
export function getPendingEvents(channelId: string, limit = 50) {
  ensureEvents();
  return db()
    .prepare(
      `SELECT * FROM channel_events
       WHERE channel_id = ? AND consumed_at IS NULL
       ORDER BY emitted_at DESC LIMIT ?`,
    )
    .all(channelId, limit) as Array<{
    id: number;
    channel_id: string;
    event_type: ChannelEventType;
    payload_json: string | null;
    emitted_at: number;
    consumed_at: number | null;
  }>;
}

/** Mark an event as consumed so it is not returned again. */
export function markEventConsumed(eventId: number) {
  ensureEvents();
  db()
    .prepare(`UPDATE channel_events SET consumed_at = ? WHERE id = ?`)
    .run(Date.now(), eventId);
}
