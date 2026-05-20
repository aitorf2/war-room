import { NextRequest, NextResponse } from "next/server";
import { checkPokaYokeAuthorization, recordPokaYokeAuthorization } from "@/lib/autonomy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/autonomy/poka-yoke?channelId=X&actionKey=Y
 * Returns whether a specific irreversible action is authorized for the channel.
 * The agent calls this before executing any poka-yoke-guarded action.
 */
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  const actionKey = req.nextUrl.searchParams.get("actionKey");
  if (!channelId || !actionKey) {
    return NextResponse.json({ error: "channelId and actionKey required" }, { status: 400 });
  }
  const authorized = checkPokaYokeAuthorization(channelId, actionKey);
  return NextResponse.json({ channelId, actionKey, authorized });
}

/**
 * POST /api/autonomy/poka-yoke
 * Body: { channelId, actionKey }
 * Records human authorization for an irreversible action so the agent can
 * proceed. Must be called by the human before the agent attempts the action.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { channelId?: string; actionKey?: string };
  if (!body.channelId || !body.actionKey?.trim()) {
    return NextResponse.json({ error: "channelId and actionKey required" }, { status: 400 });
  }
  recordPokaYokeAuthorization(body.channelId, body.actionKey.trim());
  return NextResponse.json({ ok: true, channelId: body.channelId, actionKey: body.actionKey });
}
