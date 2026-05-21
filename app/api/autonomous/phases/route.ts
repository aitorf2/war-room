// /api/autonomous/phases
//
// GET  ?channelId=X                             → current active phase
// POST { channelId, phaseName, autonomyFreqSecs } → insert new phase (closes previous)
//
// Phases configure how often the autonomous runner injects a turn.
// Each channel can have at most one active phase (end_at IS NULL).
// Inserting a new phase automatically closes the previous one.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitChannelEvent } from "@/lib/event-emitter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PhaseRow = {
  id: number;
  channel_id: string;
  phase_name: string;
  autonomy_freq_secs: number;
  start_at: number;
  end_at: number | null;
};

function ensurePhasesTable() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS channel_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      phase_name TEXT NOT NULL,
      autonomy_freq_secs INTEGER NOT NULL DEFAULT 3600,
      start_at INTEGER NOT NULL,
      end_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_channel_phases_channel
      ON channel_phases(channel_id, start_at DESC);
  `);
}

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  try {
    ensurePhasesTable();
    const phase = db()
      .prepare(
        `SELECT * FROM channel_phases
         WHERE channel_id = ? AND end_at IS NULL
         ORDER BY start_at DESC LIMIT 1`,
      )
      .get(channelId) as PhaseRow | undefined;

    return NextResponse.json({ phase: phase ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    channelId?: string;
    phaseName?: string;
    autonomyFreqSecs?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  const phaseName = body.phaseName?.trim();
  if (!channelId || !phaseName) {
    return NextResponse.json(
      { error: "channelId and phaseName are required" },
      { status: 400 },
    );
  }

  const freqSecs =
    typeof body.autonomyFreqSecs === "number" && body.autonomyFreqSecs > 0
      ? Math.round(body.autonomyFreqSecs)
      : 7200;

  const now = Date.now();

  try {
    ensurePhasesTable();

    // Close any currently open phase for this channel
    db()
      .prepare(
        `UPDATE channel_phases SET end_at = ? WHERE channel_id = ? AND end_at IS NULL`,
      )
      .run(now, channelId);

    // Insert the new phase
    const res = db()
      .prepare(
        `INSERT INTO channel_phases(channel_id, phase_name, autonomy_freq_secs, start_at)
         VALUES(?, ?, ?, ?)`,
      )
      .run(channelId, phaseName, freqSecs, now);

    const phase = db()
      .prepare(`SELECT * FROM channel_phases WHERE id = ?`)
      .get(Number(res.lastInsertRowid)) as PhaseRow;

    emitChannelEvent(channelId, "phase_changed", {
      phaseName,
      autonomyFreqSecs: freqSecs,
    });

    return NextResponse.json({ phase }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
