import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AgreementRow } from "@/lib/session-memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  const items = db()
    .prepare(
      `SELECT * FROM channel_agreements
       WHERE channel_id = ?
       ORDER BY is_immutable DESC, created_at ASC`,
    )
    .all(channelId) as AgreementRow[];
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    content?: string;
    isImmutable?: boolean;
    createdBy?: string;
  };

  if (!body.channelId || !body.content?.trim()) {
    return NextResponse.json(
      { error: "channelId and content required" },
      { status: 400 },
    );
  }

  const now = Date.now();
  const result = db()
    .prepare(
      `INSERT INTO channel_agreements(channel_id, content, is_immutable, created_at, created_by)
       VALUES(?, ?, ?, ?, ?)`,
    )
    .run(
      body.channelId,
      body.content.trim(),
      body.isImmutable ? 1 : 0,
      now,
      body.createdBy?.trim() || "user",
    );

  const agreement = db()
    .prepare(`SELECT * FROM channel_agreements WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as AgreementRow;

  return NextResponse.json({ agreement });
}

export async function DELETE(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;
  if (isNaN(id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  db().prepare(`DELETE FROM channel_agreements WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
