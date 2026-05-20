import { NextRequest, NextResponse } from "next/server";
import { recordTelemetry, getTelemetryText } from "@/lib/quality-monitor";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TelemetryRow = {
  id: number;
  channel_id: string;
  confidence: number;
  unverified_assumption_count: number;
  time_to_next_decision_secs: number | null;
  current_mode: string | null;
  created_at: number;
};

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const text = getTelemetryText(channelId);

  const raw = db()
    .prepare(
      `SELECT id, channel_id, confidence, unverified_assumption_count,
              time_to_next_decision_secs, current_mode, created_at
       FROM agent_telemetry
       WHERE channel_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(channelId) as TelemetryRow | undefined;

  return NextResponse.json({ text, data: raw ?? null });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    confidence?: number;
    unverifiedAssumptions?: number;
    timeToNextDecisionSecs?: number;
    currentMode?: string;
  };

  if (
    !body.channelId ||
    typeof body.confidence !== "number" ||
    typeof body.unverifiedAssumptions !== "number"
  ) {
    return NextResponse.json(
      { error: "channelId, confidence, unverifiedAssumptions required" },
      { status: 400 },
    );
  }

  if (body.confidence < 0 || body.confidence > 1) {
    return NextResponse.json(
      { error: "confidence must be between 0 and 1" },
      { status: 400 },
    );
  }

  recordTelemetry(
    body.channelId,
    body.confidence,
    body.unverifiedAssumptions,
    body.timeToNextDecisionSecs,
    body.currentMode,
  );

  return NextResponse.json({ ok: true });
}
