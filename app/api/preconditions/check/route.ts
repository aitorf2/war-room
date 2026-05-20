export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { checkPreconditions } from "@/lib/preconditions";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { channelId: string; context: string };
  const result = checkPreconditions(body.channelId, body.context);
  return NextResponse.json(result);
}
