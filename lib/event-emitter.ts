import { db } from "./db";
import { dispatchEvent, type EventType } from "./notifications";

/** Agent calls this to emit a typed event — it doesn't need to know how notification happens. */
export function emitChannelEvent(
  channelId: string,
  channelName: string,
  eventType: EventType,
  payload?: Record<string, unknown>,
): void {
  db()
    .prepare(
      `INSERT INTO channel_events (channel_id, event_type, payload_json, emitted_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      channelId,
      eventType,
      payload ? JSON.stringify(payload) : null,
      Date.now(),
    );

  dispatchEvent(eventType, channelName, payload?.detail as string | undefined);
}

/** Mark events as consumed after processing. */
export function consumeEvents(eventIds: number[]): void {
  if (eventIds.length === 0) return;
  const placeholders = eventIds.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE channel_events SET consumed_at = ? WHERE id IN (${placeholders})`,
    )
    .run(Date.now(), ...eventIds);
}
