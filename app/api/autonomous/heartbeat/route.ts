// GET /api/autonomous/heartbeat
// Polled by the Electron main process every 10 minutes.
//
// Checks every channel that has a project_path set. For each one,
// calls checkAutonomousTrigger. Returns the list of channels that
// need an autonomous turn injected, with the prompt to send.
//
// The Electron process then POSTs to /api/chat for each returned item.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAutonomousTrigger, recordAutonomousTurn } from "@/lib/autonomous-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChannelRow = { slug: string; project_path: string | null };
type Trigger = { channelId: string; projectPath: string; prompt: string };

export async function GET() {
  let channels: ChannelRow[];
  try {
    channels = db()
      .prepare(
        `SELECT slug, project_path FROM user_channels
         WHERE project_path IS NOT NULL AND project_path != ''`,
      )
      .all() as ChannelRow[];
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const triggers: Trigger[] = [];

  for (const ch of channels) {
    if (!ch.project_path) continue;
    try {
      const prompt = await checkAutonomousTrigger(ch.slug, ch.project_path);
      if (prompt) {
        recordAutonomousTurn(ch.slug, prompt);
        triggers.push({ channelId: ch.slug, projectPath: ch.project_path, prompt });
      }
    } catch (err) {
      console.warn(`[heartbeat] error checking channel ${ch.slug}:`, err);
    }
  }

  return NextResponse.json({ triggers, checkedAt: Date.now() });
}
