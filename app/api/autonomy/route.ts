import { NextRequest, NextResponse } from "next/server";
import {
  computeAutonomyLevel,
  getAutonomyPolicy,
  getContingencyCount,
  upsertAutonomyPolicy,
} from "@/lib/autonomy";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/autonomy?channelId=X
 * Returns full autonomy status: policy, computed level, contingency count, and budget.
 */
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const policy = getAutonomyPolicy(channelId);
  const level = computeAutonomyLevel(channelId);
  const contingencyCount = getContingencyCount(channelId);

  // Budget is optional — return zeros if no row yet.
  const budgetRow = db()
    .prepare(`SELECT * FROM autonomy_budget WHERE channel_id = ?`)
    .get(channelId) as
    | {
        week_token_budget: number;
        week_token_used: number;
        week_start_at: number;
        updated_at: number;
      }
    | undefined;

  const budget = budgetRow
    ? {
        weekTokenBudget: budgetRow.week_token_budget,
        weekTokenUsed: budgetRow.week_token_used,
        weekStartAt: budgetRow.week_start_at,
        updatedAt: budgetRow.updated_at,
      }
    : {
        weekTokenBudget: 0,
        weekTokenUsed: 0,
        weekStartAt: 0,
        updatedAt: 0,
      };

  return NextResponse.json({
    channelId,
    policy,
    level,
    contingencyCount,
    budget,
  });
}

/**
 * POST /api/autonomy
 * Body: { channelId, canDo?, cannotDo?, escalate?, uncertaintyThreshold? }
 * Upserts the autonomy policy for the channel.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    canDo?: string[];
    cannotDo?: string[];
    escalate?: string[];
    uncertaintyThreshold?: number;
  };

  if (!body.channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const policy = upsertAutonomyPolicy(body.channelId, {
    canDo: body.canDo,
    cannotDo: body.cannotDo,
    escalate: body.escalate,
    uncertaintyThreshold: body.uncertaintyThreshold,
  });

  return NextResponse.json({ channelId: body.channelId, policy });
}
