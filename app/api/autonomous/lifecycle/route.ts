// /api/autonomous/lifecycle
//
// GET  ?channelId=X                                    → channel lifecycle row
// POST { channelId, objective?, acceptanceCriteria?, weeklySetpoint? } → upsert lifecycle
// PATCH { channelId, progressPct?, tasksThisWeek? }    → update progress fields
//
// Tracks the bounded mission state for a channel: what is the objective,
// what are the acceptance criteria, and how far along is it.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LifecycleRow = {
  channel_id: string;
  objective: string | null;
  acceptance_criteria_json: string | null;
  progress_pct: number;
  weekly_setpoint: number;
  tasks_this_week: number;
  opened_at: number;
  closed_at: number | null;
};

function ensureLifecycleTable() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS channel_lifecycle (
      channel_id TEXT PRIMARY KEY,
      objective TEXT,
      acceptance_criteria_json TEXT,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      weekly_setpoint INTEGER NOT NULL DEFAULT 5,
      tasks_this_week INTEGER NOT NULL DEFAULT 0,
      opened_at INTEGER NOT NULL,
      closed_at INTEGER
    );
  `);
}

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  try {
    ensureLifecycleTable();
    const row = db()
      .prepare(`SELECT * FROM channel_lifecycle WHERE channel_id = ?`)
      .get(channelId) as LifecycleRow | undefined;

    return NextResponse.json({ lifecycle: row ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    channelId?: string;
    objective?: string;
    acceptanceCriteria?: string[];
    weeklySetpoint?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const now = Date.now();
  const criteriaJson = body.acceptanceCriteria
    ? JSON.stringify(body.acceptanceCriteria)
    : null;

  try {
    ensureLifecycleTable();
    db()
      .prepare(
        `INSERT INTO channel_lifecycle(
           channel_id, objective, acceptance_criteria_json,
           weekly_setpoint, opened_at
         )
         VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(channel_id) DO UPDATE SET
           objective = COALESCE(excluded.objective, objective),
           acceptance_criteria_json = COALESCE(excluded.acceptance_criteria_json, acceptance_criteria_json),
           weekly_setpoint = COALESCE(excluded.weekly_setpoint, weekly_setpoint)`,
      )
      .run(
        channelId,
        body.objective ?? null,
        criteriaJson,
        body.weeklySetpoint ?? 5,
        now,
      );

    const row = db()
      .prepare(`SELECT * FROM channel_lifecycle WHERE channel_id = ?`)
      .get(channelId) as LifecycleRow;

    return NextResponse.json({ lifecycle: row }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: {
    channelId?: string;
    progressPct?: number;
    tasksThisWeek?: number;
    closedAt?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (typeof body.progressPct === "number") {
    const pct = Math.max(0, Math.min(100, Math.round(body.progressPct)));
    fields.push("progress_pct = ?");
    values.push(pct);
  }
  if (typeof body.tasksThisWeek === "number") {
    fields.push("tasks_this_week = ?");
    values.push(Math.max(0, Math.round(body.tasksThisWeek)));
  }
  if (body.closedAt !== undefined) {
    fields.push("closed_at = ?");
    values.push(body.closedAt);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  values.push(channelId);

  try {
    ensureLifecycleTable();
    db()
      .prepare(`UPDATE channel_lifecycle SET ${fields.join(", ")} WHERE channel_id = ?`)
      .run(...values);

    const row = db()
      .prepare(`SELECT * FROM channel_lifecycle WHERE channel_id = ?`)
      .get(channelId) as LifecycleRow | undefined;

    return NextResponse.json({ lifecycle: row ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
