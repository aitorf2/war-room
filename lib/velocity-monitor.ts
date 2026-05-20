import { db } from "./db";
import { emitChannelEvent } from "./event-emitter";
import { playChannelSound, type ChannelStatus } from "./notifications";

export type VelocityStatus = "rising" | "stable" | "falling" | "stalled";

type VelocityRow = {
  channel_id: string;
  status_code: VelocityStatus;
  tasks_last_7d: number;
  tasks_prev_7d: number;
  last_computed_at: number;
};

type CountRow = { n: number };

// WHY: Tables are created lazily here because channel_velocity and
// action_flight_log may not exist in every DB version. migrate() in db.ts
// can't be modified by feature work, so we ensure the schema on first use.
function ensureTables(): void {
  db().exec(`
    CREATE TABLE IF NOT EXISTS channel_velocity (
      channel_id TEXT PRIMARY KEY,
      status_code TEXT NOT NULL DEFAULT 'stable',
      tasks_last_7d INTEGER NOT NULL DEFAULT 0,
      tasks_prev_7d INTEGER NOT NULL DEFAULT 0,
      last_computed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_flight_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_afl_channel_type_created
      ON action_flight_log(channel_id, action_type, created_at);
  `);
}

export function computeVelocityStatus(channelId: string): VelocityStatus {
  ensureTables();
  const row = db()
    .prepare(`SELECT tasks_last_7d, tasks_prev_7d FROM channel_velocity WHERE channel_id = ?`)
    .get(channelId) as { tasks_last_7d: number; tasks_prev_7d: number } | undefined;

  if (!row) return "stable";

  const { tasks_last_7d, tasks_prev_7d } = row;

  if (tasks_last_7d === 0) return "stalled";
  if (tasks_prev_7d === 0) {
    // WHY: Avoid division by zero; any activity when previous was zero is rising.
    return "rising";
  }

  const ratio = tasks_last_7d / tasks_prev_7d;
  if (ratio > 1.2) return "rising";
  if (ratio < 0.8) return "falling";
  return "stable";
}

export function updateChannelVelocity(channelId: string): void {
  ensureTables();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const cutLast = now - sevenDaysMs;
  const cutPrev = now - 2 * sevenDaysMs;

  const last7d = (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM action_flight_log
         WHERE channel_id = ? AND action_type = 'agent_completed'
           AND created_at >= ? AND created_at < ?`,
      )
      .get(channelId, cutLast, now) as CountRow
  ).n;

  const prev7d = (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM action_flight_log
         WHERE channel_id = ? AND action_type = 'agent_completed'
           AND created_at >= ? AND created_at < ?`,
      )
      .get(channelId, cutPrev, cutLast) as CountRow
  ).n;

  db()
    .prepare(
      `INSERT INTO channel_velocity(channel_id, status_code, tasks_last_7d, tasks_prev_7d, last_computed_at)
       VALUES(?, 'stable', ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         tasks_last_7d = excluded.tasks_last_7d,
         tasks_prev_7d = excluded.tasks_prev_7d,
         last_computed_at = excluded.last_computed_at`,
    )
    .run(channelId, last7d, prev7d, now);

  // Recompute status after upsert so the stored status_code stays consistent.
  const status = computeVelocityStatus(channelId);
  db()
    .prepare(`UPDATE channel_velocity SET status_code = ? WHERE channel_id = ?`)
    .run(status, channelId);

  if (status === "stalled" || status === "falling") {
    emitChannelEvent(channelId, "velocity_alert", {
      status_code: status,
      tasks_last_7d: last7d,
      tasks_prev_7d: prev7d,
    });
  }
}

export function getVelocityText(channelId: string): string {
  ensureTables();
  const row = db()
    .prepare(`SELECT status_code, tasks_last_7d, tasks_prev_7d FROM channel_velocity WHERE channel_id = ?`)
    .get(channelId) as VelocityRow | undefined;

  if (!row) {
    return `Ritmo del canal: sin datos todavía.`;
  }

  const statusLabels: Record<VelocityStatus, string> = {
    rising: "subiendo",
    stable: "estable",
    falling: "bajando",
    stalled: "paralizado",
  };

  const label = statusLabels[row.status_code] ?? row.status_code;
  return `Ritmo del canal: ${label}. Tareas esta semana: ${row.tasks_last_7d}, semana anterior: ${row.tasks_prev_7d}.`;
}

export function playVelocitySound(status: VelocityStatus): void {
  const soundMap: Record<VelocityStatus, ChannelStatus> = {
    rising: 1,
    stable: 0,
    falling: 2,
    stalled: 2,
  };
  playChannelSound(soundMap[status]);
}
