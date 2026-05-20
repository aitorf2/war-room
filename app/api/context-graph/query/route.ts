export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { inferDecisionContext } from "@/lib/context-graph";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId") ?? "";
  const keyword = req.nextUrl.searchParams.get("keyword") ?? "";
  const context = inferDecisionContext(channelId, keyword);
  return NextResponse.json({ context });
}
