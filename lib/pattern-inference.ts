import { db } from "./db";

// WHY: action_flight_log may not exist in older worktree DB snapshots
function ensureTables(): void {
  db().exec(`
    CREATE TABLE IF NOT EXISTS action_flight_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      session_id INTEGER,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      file_path TEXT,
      decision_made TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_flight_channel
      ON action_flight_log(channel_id, created_at DESC);
  `);
}

let _tablesReady = false;
function ensureReady(): void {
  if (_tablesReady) return;
  ensureTables();
  _tablesReady = true;
}

export function recordSessionStart(channelId: string): void {
  ensureReady();
  db()
    .prepare(
      `INSERT INTO action_flight_log
         (channel_id, action_type, description, created_at)
       VALUES (?, 'session_start', 'user_arrival', ?)`,
    )
    .run(channelId, Date.now());
}

export function inferTypicalArrivalHour(channelId: string): number | null {
  ensureReady();

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const rows = db()
    .prepare(
      `SELECT created_at FROM action_flight_log
       WHERE channel_id = ? AND action_type = 'session_start'
         AND created_at >= ?
       ORDER BY created_at DESC`,
    )
    .all(channelId, thirtyDaysAgo) as Array<{ created_at: number }>;

  // WHY: Fewer than 3 data points is not enough to establish a reliable pattern
  if (rows.length < 3) return null;

  const hourCounts = new Map<number, number>();
  for (const row of rows) {
    const hour = new Date(row.created_at).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  let modeHour = 0;
  let maxCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > maxCount) {
      maxCount = count;
      modeHour = hour;
    }
  }

  return modeHour;
}

export function getArrivalPatternText(channelId: string): string {
  const hour = inferTypicalArrivalHour(channelId);
  if (hour === null) return "Patron de conexion no establecido todavia.";
  // WHY: VoiceOver reads "a las N horas" more naturally than "a las N:00"
  return `El usuario suele conectarse a las ${hour} horas.`;
}

export function isNearTypicalArrival(
  channelId: string,
  windowMinutes = 30,
): boolean {
  const typicalHour = inferTypicalArrivalHour(channelId);
  if (typicalHour === null) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const typicalMinutes = typicalHour * 60;

  const diff = Math.abs(currentMinutes - typicalMinutes);
  // WHY: Wrap-around check handles the midnight boundary (e.g. pattern at 23h, now at 0h)
  const wrappedDiff = Math.min(diff, 24 * 60 - diff);

  return wrappedDiff <= windowMinutes;
}

export function getPrearrivalPrompt(
  channelId: string,
  projectPath: string,
): string | null {
  if (!isNearTypicalArrival(channelId)) return null;

  return (
    `El usuario puede conectarse pronto. ` +
    `Prepara un resumen de estado del proyecto en ${projectPath}: ` +
    `que esta pendiente, que progreso se hizo desde la ultima sesion, ` +
    `y que decision requiere atencion inmediata.`
  );
}
