// POST /api/autonomous/trigger
// Body: { channelId: string, projectPath: string }
// Response: { trigger: string | null }
//
// Polled by a client-side interval or a Node cron to decide whether to
// inject an autonomous turn into the chat. Does NOT spawn Claude — that
// remains the responsibility of the chat API. Returns the prompt string
// when a trigger is due, or null when the channel is quiet.

import { NextRequest, NextResponse } from "next/server";
import {
  checkAutonomousTrigger,
  recordAutonomousTurn,
} from "@/lib/autonomous-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { channelId?: string; projectPath?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  const projectPath = body.projectPath?.trim();

  if (!channelId || !projectPath) {
    return NextResponse.json(
      { error: "channelId and projectPath are required" },
      { status: 400 },
    );
  }

  try {
    const trigger = await checkAutonomousTrigger(channelId, projectPath);

    if (trigger) {
      recordAutonomousTurn(channelId, trigger);
    }

    return NextResponse.json({ trigger });
  } catch (err) {
    console.error("[autonomous/trigger] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
