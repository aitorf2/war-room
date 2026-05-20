import { NextRequest, NextResponse } from "next/server";
import { clearSoloChannel, getSoloChannel, setSoloChannel } from "@/lib/solo-mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ soloChannel: getSoloChannel() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { channelId?: string };
  if (!body.channelId?.trim()) {
    return NextResponse.json({ error: "channelId es obligatorio" }, { status: 400 });
  }
  setSoloChannel(body.channelId.trim());
  return NextResponse.json({ soloChannel: body.channelId.trim() });
}

export async function DELETE() {
  clearSoloChannel();
  return NextResponse.json({ soloChannel: null });
}
