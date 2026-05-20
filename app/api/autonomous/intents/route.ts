// /api/autonomous/intents
//
// GET  ?channelId=X             → list pending deferred intents
// POST { channelId, instruction, executeAfter? } → enqueue a deferred intent
// PATCH { id, resultSummary }   → mark intent as executed
//
// Idea 208: Deferred intent queue — user queues instructions while busy;
// the autonomous runner executes them when the channel is next idle.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markIntentExecuted } from "@/lib/autonomous-runner";
import { emitChannelEvent } from "@/lib/event-emitter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// WHY: Imported lazily so the schema runs before any query.
function ensureIntentsTable() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS deferred_intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      instruction TEXT NOT NULL,
      submitted_at INTEGER NOT NULL,
      execute_after INTEGER NOT NULL,
      executed_at INTEGER,
      result_summary TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_deferred_intents_channel
      ON deferred_intents(channel_id, execute_after ASC);
  `);
}

type IntentRow = {
  id: number;
  channel_id: string;
  instruction: string;
  submitted_at: number;
  execute_after: number;
  executed_at: number | null;
  result_summary: string | null;
};

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  try {
    ensureIntentsTable();
    const intents = db()
      .prepare(
        `SELECT * FROM deferred_intents
         WHERE channel_id = ? AND executed_at IS NULL
         ORDER BY execute_after ASC`,
      )
      .all(channelId) as IntentRow[];

    return NextResponse.json({ intents });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    channelId?: string;
    instruction?: string;
    executeAfter?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  const instruction = body.instruction?.trim();
  if (!channelId || !instruction) {
    return NextResponse.json(
      { error: "channelId and instruction are required" },
      { status: 400 },
    );
  }

  const now = Date.now();
  const executeAfter = body.executeAfter ?? now; // default: execute immediately when idle

  try {
    ensureIntentsTable();
    const res = db()
      .prepare(
        `INSERT INTO deferred_intents(channel_id, instruction, submitted_at, execute_after)
         VALUES(?, ?, ?, ?)`,
      )
      .run(channelId, instruction, now, executeAfter);

    const intent = db()
      .prepare(`SELECT * FROM deferred_intents WHERE id = ?`)
      .get(Number(res.lastInsertRowid)) as IntentRow;

    emitChannelEvent(channelId, "intent_queued", {
      intentId: intent.id,
      instruction: instruction.slice(0, 120),
    });

    return NextResponse.json({ intent }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: { id?: number; resultSummary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id (number) is required" }, { status: 400 });
  }

  try {
    ensureIntentsTable();
    markIntentExecuted(body.id, body.resultSummary ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
