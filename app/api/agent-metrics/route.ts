import { NextRequest, NextResponse } from "next/server";
import { updateAgentMetrics, getAutonomyLevelFromMetrics } from "@/lib/quality-monitor";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MetricsRow = {
  channel_id: string;
  precision_streak: number;
  total_tasks_completed: number;
  mean_lexical_entropy: number | null;
  autonomy_level: number;
  last_updated: number;
};

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const row = db()
    .prepare(`SELECT * FROM agent_metrics WHERE channel_id = ?`)
    .get(channelId) as MetricsRow | undefined;

  const autonomyLevel = getAutonomyLevelFromMetrics(channelId);

  return NextResponse.json({
    metrics: row ?? {
      channel_id: channelId,
      precision_streak: 0,
      total_tasks_completed: 0,
      mean_lexical_entropy: null,
      autonomy_level: 1,
      last_updated: null,
    },
    autonomyLevel,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    responseText?: string;
    taskSucceeded?: boolean;
  };

  if (
    !body.channelId ||
    typeof body.responseText !== "string" ||
    typeof body.taskSucceeded !== "boolean"
  ) {
    return NextResponse.json(
      { error: "channelId, responseText, taskSucceeded required" },
      { status: 400 },
    );
  }

  updateAgentMetrics(body.channelId, body.responseText, body.taskSucceeded);

  const autonomyLevel = getAutonomyLevelFromMetrics(body.channelId);
  return NextResponse.json({ ok: true, autonomyLevel });
}
