import { NextRequest, NextResponse } from "next/server";
import { startDrillRun, addDrillStep, completeDrillRun, getDrillReport } from "@/lib/quality-monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const drillIdParam = req.nextUrl.searchParams.get("drillId");
  if (!drillIdParam) {
    return NextResponse.json({ error: "drillId required" }, { status: 400 });
  }

  const drillId = parseInt(drillIdParam, 10);
  if (isNaN(drillId)) {
    return NextResponse.json({ error: "drillId must be a number" }, { status: 400 });
  }

  const text = getDrillReport(drillId);
  return NextResponse.json({ text, drillId });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    taskDescription?: string;
  };

  if (!body.channelId || !body.taskDescription) {
    return NextResponse.json(
      { error: "channelId, taskDescription required" },
      { status: 400 },
    );
  }

  const drillId = startDrillRun(body.channelId, body.taskDescription);
  return NextResponse.json({ drillId });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    drillId?: number;
    step?: string;
    wouldNeedIntervention?: boolean;
    complete?: boolean;
  };

  if (typeof body.drillId !== "number") {
    return NextResponse.json({ error: "drillId required" }, { status: 400 });
  }

  // complete=true finalises the drill and returns the report
  if (body.complete) {
    const report = completeDrillRun(body.drillId);
    return NextResponse.json({ ok: true, report, drillId: body.drillId });
  }

  if (!body.step) {
    return NextResponse.json({ error: "step required when not completing" }, { status: 400 });
  }

  addDrillStep(body.drillId, body.step, body.wouldNeedIntervention ?? false);
  return NextResponse.json({ ok: true });
}
