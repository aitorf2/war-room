import { db } from "./db";
import { emitChannelEvent } from "./event-emitter";
import { dispatchEvent } from "./notifications";

// WHY: Tables may not exist in older DB snapshots; CREATE IF NOT EXISTS is idempotent
function ensureTables(): void {
  db().exec(`
    CREATE TABLE IF NOT EXISTS channel_lifecycle (
      channel_id TEXT PRIMARY KEY,
      objective TEXT,
      acceptance_criteria_json TEXT,
      progress_pct REAL NOT NULL DEFAULT 0,
      weekly_setpoint INTEGER NOT NULL DEFAULT 5,
      tasks_this_week INTEGER NOT NULL DEFAULT 0,
      opened_at INTEGER,
      closed_at INTEGER
    );
  `);
}

let _tablesReady = false;
function ensureReady(): void {
  if (_tablesReady) return;
  ensureTables();
  _tablesReady = true;
}

// ─── Feature A: Lifecycle open / progress / close ────────────────────────────

export function openLifecycle(
  channelId: string,
  objective: string,
  acceptanceCriteria: string[],
): void {
  ensureReady();
  db()
    .prepare(
      `INSERT INTO channel_lifecycle
         (channel_id, objective, acceptance_criteria_json, progress_pct,
          weekly_setpoint, tasks_this_week, opened_at, closed_at)
       VALUES (?, ?, ?, 0, 5, 0, ?, NULL)
       ON CONFLICT(channel_id) DO UPDATE SET
         objective                = excluded.objective,
         acceptance_criteria_json = excluded.acceptance_criteria_json,
         progress_pct             = 0,
         tasks_this_week          = 0,
         opened_at                = excluded.opened_at,
         closed_at                = NULL`,
    )
    .run(channelId, objective, JSON.stringify(acceptanceCriteria), Date.now());
}

export function updateProgress(channelId: string, progressPct: number): void {
  ensureReady();
  db()
    .prepare(
      `UPDATE channel_lifecycle SET progress_pct = ? WHERE channel_id = ?`,
    )
    .run(progressPct, channelId);

  if (progressPct >= 100) {
    closeLifecycle(channelId, "progress_complete");
  }
}

export function closeLifecycle(channelId: string, reason: string): void {
  ensureReady();
  db()
    .prepare(
      `UPDATE channel_lifecycle SET closed_at = ? WHERE channel_id = ?`,
    )
    .run(Date.now(), channelId);

  emitChannelEvent(channelId, "agent_completed", { reason });
  dispatchEvent("agent_completed", channelId, reason);
}

export function checkAcceptanceCriteria(
  channelId: string,
  responseText: string,
): { met: boolean; matchedCriteria: string[] } {
  ensureReady();

  const row = db()
    .prepare(
      `SELECT acceptance_criteria_json, closed_at FROM channel_lifecycle WHERE channel_id = ?`,
    )
    .get(channelId) as
    | { acceptance_criteria_json: string | null; closed_at: number | null }
    | undefined;

  if (!row || !row.acceptance_criteria_json) {
    return { met: false, matchedCriteria: [] };
  }

  const criteria: string[] = JSON.parse(row.acceptance_criteria_json);
  const lowerResponse = responseText.toLowerCase();

  const matchedCriteria = criteria.filter((criterion) =>
    lowerResponse.includes(criterion.toLowerCase()),
  );

  const met = matchedCriteria.length === criteria.length && criteria.length > 0;

  // WHY: Only auto-close if lifecycle is still open; avoids duplicate close events
  if (met && row.closed_at === null) {
    closeLifecycle(channelId, "criteria_met");
  }

  return { met, matchedCriteria };
}

export function getLifecycleText(channelId: string): string {
  ensureReady();

  const row = db()
    .prepare(
      `SELECT objective, acceptance_criteria_json, progress_pct, closed_at
       FROM channel_lifecycle WHERE channel_id = ?`,
    )
    .get(channelId) as
    | {
        objective: string | null;
        acceptance_criteria_json: string | null;
        progress_pct: number;
        closed_at: number | null;
      }
    | undefined;

  if (!row) return "Canal sin ciclo de vida registrado.";
  if (row.closed_at !== null) return "Canal cerrado.";

  const criteria: string[] = row.acceptance_criteria_json
    ? JSON.parse(row.acceptance_criteria_json)
    : [];

  const objective = row.objective ?? "sin objetivo definido";
  const progress = Math.round(row.progress_pct);
  const total = criteria.length;

  // WHY: VoiceOver reads this verbatim; "por ciento" reads better than "%"
  return (
    `Canal abierto. Objetivo: ${objective}. ` +
    `Progreso: ${progress} por ciento. ` +
    `Criterios de aceptacion: ${total} en total.`
  );
}

export function getDistanceToClosure(channelId: string): number {
  ensureReady();

  const row = db()
    .prepare(
      `SELECT progress_pct, closed_at FROM channel_lifecycle WHERE channel_id = ?`,
    )
    .get(channelId) as
    | { progress_pct: number; closed_at: number | null }
    | undefined;

  if (!row || row.closed_at !== null) return 0;
  return Math.max(0, 100 - row.progress_pct);
}

// ─── Feature B: Weekly setpoint ──────────────────────────────────────────────

export function incrementTaskCount(channelId: string): void {
  ensureReady();
  // WHY: Do nothing if no lifecycle row exists; prevents phantom rows
  db()
    .prepare(
      `UPDATE channel_lifecycle SET tasks_this_week = tasks_this_week + 1 WHERE channel_id = ?`,
    )
    .run(channelId);
}

export function checkSetpointStatus(channelId: string): {
  onTrack: boolean;
  tasksThisWeek: number;
  setpoint: number;
  deficit: number;
} {
  ensureReady();

  const row = db()
    .prepare(
      `SELECT tasks_this_week, weekly_setpoint FROM channel_lifecycle WHERE channel_id = ?`,
    )
    .get(channelId) as
    | { tasks_this_week: number; weekly_setpoint: number }
    | undefined;

  if (!row) {
    return { onTrack: false, tasksThisWeek: 0, setpoint: 5, deficit: 5 };
  }

  const { tasks_this_week: tasksThisWeek, weekly_setpoint: setpoint } = row;
  const onTrack = tasksThisWeek >= setpoint;
  const deficit = Math.max(0, setpoint - tasksThisWeek);

  return { onTrack, tasksThisWeek, setpoint, deficit };
}

export function setWeeklySetpoint(channelId: string, setpoint: number): void {
  ensureReady();
  db()
    .prepare(
      `UPDATE channel_lifecycle SET weekly_setpoint = ? WHERE channel_id = ?`,
    )
    .run(setpoint, channelId);
}
