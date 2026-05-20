import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispatchEvent, type EventType } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NotifyBody = {
  eventType?: EventType;
  channelId?: string;
  channelName?: string;
  detail?: string;
};

type EventRow = {
  id: number;
  channel_id: string;
  event_type: string;
  payload_json: string | null;
  emitted_at: number;
};

/** POST /api/notify
 *  Accepts { eventType, channelId, channelName, detail? }
 *  Inserts into channel_events, dispatches macOS notification+sound, returns { ok: true } */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as NotifyBody;
  const { eventType, channelId, channelName, detail } = body;

  if (!eventType || !channelId || !channelName) {
    return NextResponse.json(
      { error: "eventType, channelId, channelName required" },
      { status: 400 },
    );
  }

  try {
    db()
      .prepare(
        `INSERT INTO channel_events (channel_id, event_type, payload_json, emitted_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        channelId,
        eventType,
        detail ? JSON.stringify({ detail }) : null,
        Date.now(),
      );
  } catch {
    // channel_events table may not exist on very old DBs — non-fatal
  }

  dispatchEvent(eventType, channelName, detail);

  return NextResponse.json({ ok: true });
}

/** GET /api/notify
 *  Returns the last 20 unconsumed events across all channels. */
export async function GET(): Promise<NextResponse> {
  let events: EventRow[] = [];
  try {
    events = db()
      .prepare(
        `SELECT id, channel_id, event_type, payload_json, emitted_at
         FROM channel_events
         WHERE consumed_at IS NULL
         ORDER BY emitted_at DESC
         LIMIT 20`,
      )
      .all() as EventRow[];
  } catch {
    // channel_events table may not exist on very old DBs — return empty
  }

  return NextResponse.json({ events });
}
