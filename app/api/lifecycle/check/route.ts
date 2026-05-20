import { NextRequest, NextResponse } from "next/server";
import { checkAcceptanceCriteria } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    responseText?: string;
  };

  const { channelId, responseText } = body;

  if (!channelId || !responseText) {
    return NextResponse.json(
      { error: "channelId and responseText required" },
      { status: 400 },
    );
  }

  const result = checkAcceptanceCriteria(channelId, responseText);
  return NextResponse.json(result);
}
