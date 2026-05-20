import { NextRequest, NextResponse } from "next/server";
import { addContingency, deleteContingency, listContingencies } from "@/lib/autonomy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/autonomy/contingencies?channelId=X
 * Returns the list of approved contingency plans for the channel.
 */
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  return NextResponse.json({ items: listContingencies(channelId) });
}

/**
 * POST /api/autonomy/contingencies
 * Body: { channelId, conditionDescription, fallbackAction }
 * Inserts a new approved contingency plan.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    conditionDescription?: string;
    fallbackAction?: string;
  };

  if (!body.channelId || !body.conditionDescription?.trim() || !body.fallbackAction?.trim()) {
    return NextResponse.json(
      { error: "channelId, conditionDescription, fallbackAction required" },
      { status: 400 },
    );
  }

  const contingency = addContingency(
    body.channelId,
    body.conditionDescription.trim(),
    body.fallbackAction.trim(),
  );
  return NextResponse.json({ contingency });
}

/**
 * DELETE /api/autonomy/contingencies?id=X
 * Removes a contingency plan by id.
 */
export async function DELETE(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : NaN;
  if (!idParam || isNaN(id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  deleteContingency(id);
  return NextResponse.json({ ok: true });
}
