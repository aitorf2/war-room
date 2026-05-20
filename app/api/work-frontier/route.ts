import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deduceWorkFrontier } from "@/lib/session-memory";
import type { WorkFrontierRow } from "@/lib/session-memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Threshold after which the frontier is considered stale (1 hour). */
const STALE_MS = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const row = db()
    .prepare(`SELECT * FROM work_frontier WHERE channel_id = ?`)
    .get(channelId) as WorkFrontierRow | undefined;

  const isStale = !row || Date.now() - row.deduced_at > STALE_MS;

  if (isStale) {
    // Trigger dead reckoning if we have a project path for this channel.
    // Pull the project path from channel_overrides or user_channels.
    const pathRow = db()
      .prepare(
        `SELECT project_path FROM channel_overrides WHERE channel_id = ?
         UNION
         SELECT project_path FROM user_channels WHERE slug = ?
         LIMIT 1`,
      )
      .get(channelId, channelId) as { project_path: string | null } | undefined;

    if (pathRow?.project_path) {
      try {
        await deduceWorkFrontier(channelId, pathRow.project_path);
      } catch {
        // Non-blocking: stale data is better than a hard error
      }
    }
  }

  const updated = db()
    .prepare(`SELECT * FROM work_frontier WHERE channel_id = ?`)
    .get(channelId) as WorkFrontierRow | undefined;

  if (!updated) {
    return NextResponse.json({ frontier: null });
  }

  return NextResponse.json({
    frontier: JSON.parse(updated.frontier_json),
    lastCommitSha: updated.last_commit_sha,
    lastFileTouched: updated.last_file_touched,
    deducedAt: updated.deduced_at,
    stale: isStale,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    projectPath?: string;
  };

  if (!body.channelId || !body.projectPath) {
    return NextResponse.json(
      { error: "channelId and projectPath required" },
      { status: 400 },
    );
  }

  const text = await deduceWorkFrontier(body.channelId, body.projectPath);
  return NextResponse.json({ ok: true, summary: text });
}
