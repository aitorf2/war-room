import { NextResponse } from "next/server";
import { resolveExpiredQuarantines } from "@/lib/autonomy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/autonomy/quarantine/resolve
 * Sweeps all expired unresolved quarantine items, applies defaults, and returns
 * the list of auto-resolved decisions. Intended to be called by a cron job or
 * daemon on a regular interval (e.g. every minute).
 */
export async function GET() {
  const resolved = resolveExpiredQuarantines();
  return NextResponse.json({ resolved, count: resolved.length });
}
