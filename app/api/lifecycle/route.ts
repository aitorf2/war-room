import { NextRequest, NextResponse } from "next/server";
import {
  openLifecycle,
  getLifecycleText,
  getDistanceToClosure,
  updateProgress,
  closeLifecycle,
  checkSetpointStatus,
  setWeeklySetpoint,
} from "@/lib/lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const view = req.nextUrl.searchParams.get("view");

  if (view === "setpoint") {
    return NextResponse.json(checkSetpointStatus(channelId));
  }

  return NextResponse.json({
    lifecycleText: getLifecycleText(channelId),
    distanceToClosure: getDistanceToClosure(channelId),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    objective?: string;
    acceptanceCriteria?: string[];
    action?: string;
    weeklySetpoint?: number;
  };

  const { channelId, action } = body;

  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  if (action === "set_setpoint") {
    if (body.weeklySetpoint === undefined) {
      return NextResponse.json(
        { error: "weeklySetpoint required" },
        { status: 400 },
      );
    }
    setWeeklySetpoint(channelId, body.weeklySetpoint);
    return NextResponse.json({ ok: true });
  }

  const { objective, acceptanceCriteria } = body;

  if (!objective || !acceptanceCriteria) {
    return NextResponse.json(
      { error: "objective and acceptanceCriteria required" },
      { status: 400 },
    );
  }

  openLifecycle(channelId, objective, acceptanceCriteria);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    progressPct?: number;
  };

  const { channelId, progressPct } = body;

  if (!channelId || progressPct === undefined) {
    return NextResponse.json(
      { error: "channelId and progressPct required" },
      { status: 400 },
    );
  }

  updateProgress(channelId, progressPct);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    reason?: string;
  };

  const { channelId, reason } = body;

  if (!channelId || !reason) {
    return NextResponse.json(
      { error: "channelId and reason required" },
      { status: 400 },
    );
  }

  closeLifecycle(channelId, reason);
  return NextResponse.json({ ok: true });
}
