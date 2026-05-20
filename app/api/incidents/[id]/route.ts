import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IncidentRow = {
  id: number;
  source_channel_id: string;
  incident_name: string;
  description: string | null;
  status: "open" | "resolved";
  created_at: number;
  resolved_at: number | null;
};

function getById(id: number): IncidentRow | undefined {
  return db()
    .prepare(`SELECT * FROM incident_channels WHERE id = ?`)
    .get(id) as IncidentRow | undefined;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const row = getById(Number(id));
  if (!row) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  return NextResponse.json({
    id: row.id,
    sourceChannelId: row.source_channel_id,
    incidentName: row.incident_name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const incidentId = Number(id);
  const body = (await req.json()) as { status?: string };

  if (body.status !== "resolved") {
    return NextResponse.json({ error: "solo se admite status: resolved" }, { status: 400 });
  }

  const now = Date.now();
  const info = db()
    .prepare(
      `UPDATE incident_channels SET status = 'resolved', resolved_at = ? WHERE id = ? AND status = 'open'`,
    )
    .run(now, incidentId);

  if (info.changes === 0) {
    return NextResponse.json({ error: "incidente no encontrado o ya resuelto" }, { status: 404 });
  }

  const updated = getById(incidentId);
  return NextResponse.json({
    id: updated!.id,
    status: updated!.status,
    resolvedAt: updated!.resolved_at,
  });
}
