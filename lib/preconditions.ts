import { db } from "./db";

const PREFIX = "precondition:";

export function setPrecondition(channelId: string, condition: string): void {
  db()
    .prepare(
      `INSERT INTO quality_criteria(channel_id, criterion, active, created_at)
       VALUES(?, ?, 1, ?)`,
    )
    .run(channelId, PREFIX + condition, Date.now());
}

export function getPreconditions(channelId: string): string[] {
  const rows = db()
    .prepare(
      `SELECT criterion
       FROM quality_criteria
       WHERE channel_id = ? AND active = 1 AND criterion LIKE ?`,
    )
    .all(channelId, `${PREFIX}%`) as Array<{ criterion: string }>;
  return rows.map((r) => r.criterion.slice(PREFIX.length));
}

export function checkPreconditions(
  channelId: string,
  context: string,
): { allMet: boolean; unmet: string[] } {
  const conditions = getPreconditions(channelId);
  const lowerContext = context.toLowerCase();
  const unmet = conditions.filter(
    (cond) => !lowerContext.includes(cond.toLowerCase()),
  );
  return { allMet: unmet.length === 0, unmet };
}

export function getPreconditionsText(channelId: string): string {
  const conditions = getPreconditions(channelId);
  if (conditions.length === 0) {
    return "Sin precondiciones configuradas.";
  }
  const list = conditions.map((c) => `- ${c}`).join("\n");
  return `Precondiciones activas: ${conditions.length}.\n${list}`;
}

export function clearPrecondition(channelId: string, condition: string): void {
  db()
    .prepare(
      `UPDATE quality_criteria
       SET active = 0
       WHERE channel_id = ? AND criterion = ?`,
    )
    .run(channelId, PREFIX + condition);
}
