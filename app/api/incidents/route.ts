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

// WHY: Table is created here because incident_channels is a new feature
// table not yet in the main migrate() schema. Lazy creation keeps the
// migration chain clean while the feature ships independently.
function ensureTable(): void {
  db().exec(`
    CREATE TABLE IF NOT EXISTS incident_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_channel_id TEXT NOT NULL,
      incident_name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_incident_status
      ON incident_channels(status, created_at DESC);
  `);
}

export async function GET() {
  ensureTable();
  const rows = db()
    .prepare(
      `SELECT id, source_channel_id, incident_name, description, status, created_at, resolved_at
       FROM incident_channels WHERE status = 'open' ORDER BY created_at DESC`,
    )
    .all() as IncidentRow[];

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      sourceChannelId: r.source_channel_id,
      incidentName: r.incident_name,
      description: r.description,
      status: r.status,
      createdAt: r.created_at,
    })),
  );
}

export async function POST(req: NextRequest) {
  ensureTable();
  const body = (await req.json()) as {
    sourceChannelId?: string;
    incidentName?: string;
    description?: string;
  };

  if (!body.sourceChannelId?.trim() || !body.incidentName?.trim()) {
    return NextResponse.json(
      { error: "sourceChannelId y incidentName son obligatorios" },
      { status: 400 },
    );
  }

  const now = Date.now();
  const result = db()
    .prepare(
      `INSERT INTO incident_channels(source_channel_id, incident_name, description, status, created_at)
       VALUES(?, ?, ?, 'open', ?)`,
    )
    .run(body.sourceChannelId.trim(), body.incidentName.trim(), body.description?.trim() ?? null, now);

  return NextResponse.json(
    { id: Number(result.lastInsertRowid), incidentName: body.incidentName.trim() },
    { status: 201 },
  );
}
