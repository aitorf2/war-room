import { NextRequest, NextResponse } from "next/server";
import {
  getSessionInjectionContext,
  writeSessionTestament,
} from "@/lib/session-memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  const context = getSessionInjectionContext(channelId);
  return NextResponse.json({ context });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    sessionId?: number | string | null;
    testament?: {
      commitments?: string[];
      decisions?: string[];
      nextSteps?: string[];
      openQuestions?: string[];
    };
    // Minimal payload from the Stop hook — no testament required
    source?: string;
    projectPath?: string;
  };

  if (!body.channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const sessionId =
    body.sessionId !== undefined && body.sessionId !== null
      ? Number(body.sessionId)
      : null;

  // When called from the Stop hook without a pre-built testament, write an
  // empty one to record that the session ended so the next session can detect
  // continuity even with no explicit content.
  const testament = {
    commitments: body.testament?.commitments ?? [],
    decisions: body.testament?.decisions ?? [],
    nextSteps: body.testament?.nextSteps ?? [],
    openQuestions: body.testament?.openQuestions ?? [],
  };

  writeSessionTestament(body.channelId, isNaN(sessionId!) ? null : sessionId, testament);

  return NextResponse.json({ ok: true });
}
