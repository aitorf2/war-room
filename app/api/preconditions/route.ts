export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  setPrecondition,
  getPreconditions,
  getPreconditionsText,
  clearPrecondition,
} from "@/lib/preconditions";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { channelId: string; condition: string };
  setPrecondition(body.channelId, body.condition);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId") ?? "";
  const preconditions = getPreconditions(channelId);
  const text = getPreconditionsText(channelId);
  return NextResponse.json({ preconditions, text });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { channelId: string; condition: string };
  clearPrecondition(body.channelId, body.condition);
  return NextResponse.json({ ok: true });
}
