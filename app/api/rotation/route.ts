export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { checkRotationLimit, getRotationStatusText } from "@/lib/crop-rotation";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId") ?? "";
  const actionType = req.nextUrl.searchParams.get("actionType") ?? "";
  const result = checkRotationLimit(channelId, actionType);
  const statusText = getRotationStatusText(channelId);
  return NextResponse.json({ ...result, statusText });
}
