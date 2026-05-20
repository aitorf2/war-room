import { NextRequest, NextResponse } from "next/server";
import { logAction, getFlightLogText } from "@/lib/quality-monitor";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FlightLogRow = {
  id: number;
  action_type: string;
  description: string;
  file_path: string | null;
  decision_made: string | null;
  created_at: number;
};

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam, 10))) : 20;

  const text = getFlightLogText(channelId, limit);

  const entries = db()
    .prepare(
      `SELECT id, action_type, description, file_path, decision_made, created_at
       FROM action_flight_log
       WHERE channel_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(channelId, limit) as FlightLogRow[];

  return NextResponse.json({ text, entries: entries.slice().reverse() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    sessionId?: number | null;
    actionType?: string;
    description?: string;
    filePath?: string;
    decisionMade?: string;
  };

  if (!body.channelId || !body.actionType || !body.description) {
    return NextResponse.json(
      { error: "channelId, actionType, description required" },
      { status: 400 },
    );
  }

  logAction(
    body.channelId,
    body.sessionId ?? null,
    body.actionType,
    body.description,
    body.filePath,
    body.decisionMade,
  );

  return NextResponse.json({ ok: true });
}
