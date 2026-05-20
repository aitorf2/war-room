import { NextRequest, NextResponse } from "next/server";
import {
  getArrivalPatternText,
  inferTypicalArrivalHour,
  isNearTypicalArrival,
  recordSessionStart,
} from "@/lib/pattern-inference";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  return NextResponse.json({
    arrivalText: getArrivalPatternText(channelId),
    typicalHour: inferTypicalArrivalHour(channelId),
    nearArrival: isNearTypicalArrival(channelId),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { channelId?: string };

  const { channelId } = body;
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  recordSessionStart(channelId);
  return NextResponse.json({ ok: true });
}
