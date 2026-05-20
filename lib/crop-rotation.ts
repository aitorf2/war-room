import { db } from "./db";

export const ROTATION_LIMITS: Record<
  string,
  { maxCount: number; windowHours: number }
> = {
  file_write: { maxCount: 5, windowHours: 4 },
  code_review: { maxCount: 3, windowHours: 8 },
  autonomous_trigger: { maxCount: 10, windowHours: 24 },
};

export function checkRotationLimit(
  channelId: string,
  actionType: string,
): { allowed: boolean; restHoursRemaining?: number } {
  const limit = ROTATION_LIMITS[actionType];
  if (!limit) {
    return { allowed: true };
  }

  const windowMs = limit.windowHours * 60 * 60 * 1000;
  const windowStart = Date.now() - windowMs;

  const countRow = db()
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM action_flight_log
       WHERE channel_id = ? AND action_type = ? AND triggered_at >= ?`,
    )
    .get(channelId, actionType, windowStart) as { cnt: number };

  if (countRow.cnt < limit.maxCount) {
    return { allowed: true };
  }

  // WHY: find the oldest action inside the window to compute when the
  // window slides past it, which is the earliest time the action is allowed again.
  const earliestRow = db()
    .prepare(
      `SELECT triggered_at
       FROM action_flight_log
       WHERE channel_id = ? AND action_type = ? AND triggered_at >= ?
       ORDER BY triggered_at ASC
       LIMIT 1`,
    )
    .get(channelId, actionType, windowStart) as
    | { triggered_at: number }
    | undefined;

  if (!earliestRow) {
    return { allowed: true };
  }

  const clearsAt = earliestRow.triggered_at + windowMs;
  const restMs = clearsAt - Date.now();
  const restHours = Math.ceil(restMs / (60 * 60 * 1000));

  return { allowed: false, restHoursRemaining: Math.max(1, restHours) };
}

export function getRotationStatusText(channelId: string): string {
  const active: string[] = [];

  for (const actionType of Object.keys(ROTATION_LIMITS)) {
    const result = checkRotationLimit(channelId, actionType);
    if (!result.allowed && result.restHoursRemaining !== undefined) {
      active.push(
        `${actionType} bloqueado, se libera en ${result.restHoursRemaining} hora${result.restHoursRemaining === 1 ? "" : "s"}`,
      );
    }
  }

  if (active.length === 0) {
    return "Sin restricciones de rotacion activas.";
  }

  return `Restricciones de rotacion activas: ${active.join("; ")}.`;
}
