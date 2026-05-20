export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { addGraphEdge, getGraphSummaryText } from "@/lib/context-graph";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId: string;
    fromNode: string;
    toNode: string;
    relationType: string;
    weight?: number;
  };
  addGraphEdge(
    body.channelId,
    body.fromNode,
    body.toNode,
    body.relationType,
    body.weight,
  );
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId") ?? "";
  const summary = getGraphSummaryText(channelId);
  return NextResponse.json({ summary });
}
