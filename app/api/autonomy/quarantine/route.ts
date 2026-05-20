import { NextRequest, NextResponse } from "next/server";
import {
  listOpenQuarantines,
  quarantineDecision,
  resolveQuarantine,
} from "@/lib/autonomy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// WHY: Default expiry of 1 hour — enough for a human to notice and respond
// during an active session, short enough to not block the agent indefinitely.
const DEFAULT_EXPIRE_MS = 60 * 60 * 1000;

/**
 * GET /api/autonomy/quarantine?channelId=X
 * Returns open (unresolved) quarantine items for the channel.
 */
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  return NextResponse.json({ items: listOpenQuarantines(channelId) });
}

/**
 * POST /api/autonomy/quarantine
 * Body: { channelId, question, defaultAnswer, expireAfterMs? }
 * Adds a new decision to the quarantine queue.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    question?: string;
    defaultAnswer?: string;
    expireAfterMs?: number;
  };

  if (!body.channelId || !body.question?.trim() || !body.defaultAnswer?.trim()) {
    return NextResponse.json(
      { error: "channelId, question, defaultAnswer required" },
      { status: 400 },
    );
  }

  const expireAfterMs =
    typeof body.expireAfterMs === "number" && body.expireAfterMs > 0
      ? body.expireAfterMs
      : DEFAULT_EXPIRE_MS;

  const id = quarantineDecision(
    body.channelId,
    body.question.trim(),
    body.defaultAnswer.trim(),
    expireAfterMs,
  );
  return NextResponse.json({ id });
}

/**
 * PATCH /api/autonomy/quarantine
 * Body: { id, resolution }
 * Resolves a quarantine item with a human-supplied answer.
 */
export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id?: number; resolution?: string };
  if (typeof body.id !== "number" || !body.resolution?.trim()) {
    return NextResponse.json({ error: "id and resolution required" }, { status: 400 });
  }
  resolveQuarantine(body.id, body.resolution.trim());
  return NextResponse.json({ ok: true });
}
