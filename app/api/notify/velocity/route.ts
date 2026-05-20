import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispatchEvent } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VelocityRow = {
  channel_id: string;
  tasks_last_7d: number;
  tasks_prev_7d: number;
};

type VelocityAlert = {
  channelId: string;
  tasksLast7d: number;
  tasksPrev7d: number;
  ratio: number;
};

/** GET /api/notify/velocity
 *  Checks channel_velocity for channels where tasks_last_7d / max(tasks_prev_7d, 1) < 0.5.
 *  For each falling channel: inserts a velocity_alert event + fires macOS notification.
 *  Returns { alerts: [...] } */
export async function GET(): Promise<NextResponse> {
  let rows: VelocityRow[] = [];
  try {
    rows = db()
      .prepare(
        `SELECT channel_id, tasks_last_7d, tasks_prev_7d FROM channel_velocity`,
      )
      .all() as VelocityRow[];
  } catch {
    // channel_velocity table may not exist on very old DBs — return empty
    return NextResponse.json({ alerts: [] });
  }

  const alerts: VelocityAlert[] = [];
  const now = Date.now();

  for (const row of rows) {
    const prev = Math.max(row.tasks_prev_7d, 1);
    const ratio = row.tasks_last_7d / prev;

    if (ratio < 0.5) {
      alerts.push({
        channelId: row.channel_id,
        tasksLast7d: row.tasks_last_7d,
        tasksPrev7d: row.tasks_prev_7d,
        ratio,
      });

      try {
        db()
          .prepare(
            `INSERT INTO channel_events (channel_id, event_type, payload_json, emitted_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(
            row.channel_id,
            "velocity_alert",
            JSON.stringify({
              detail: `Ritmo: ${row.tasks_last_7d} tareas vs ${row.tasks_prev_7d} semana anterior`,
              ratio: Math.round(ratio * 100) / 100,
            }),
            now,
          );
      } catch {
        // non-fatal if insert fails
      }

      // WHY: channel_id is used as channel name fallback — War Room may not have
      // a display name available at this layer without an extra JOIN
      dispatchEvent(
        "velocity_alert",
        row.channel_id,
        `Ritmo: ${row.tasks_last_7d} tareas vs ${row.tasks_prev_7d} semana anterior`,
      );
    }
  }

  return NextResponse.json({ alerts });
}
