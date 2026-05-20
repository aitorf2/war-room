import { NextRequest, NextResponse } from "next/server";
import { computeVelocityStatus, getVelocityText } from "@/lib/velocity-monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const statusCode = computeVelocityStatus(channelId);
  const velocityText = getVelocityText(channelId);
  return NextResponse.json({ statusCode, velocityText });
}
