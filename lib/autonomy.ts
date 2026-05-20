import { db } from "./db";

// ─── Lazy schema guard ────────────────────────────────────────────────────────
// The five autonomy tables were added in a dedicated migration. We guard here
// so that any call into this module on a DB that hasn't been migrated yet
// (e.g. test fixtures) degrades gracefully instead of throwing.

let _ensured = false;

function ensure() {
  if (_ensured) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS autonomy_policy (
      channel_id TEXT PRIMARY KEY,
      can_do_json TEXT NOT NULL DEFAULT '[]',
      cannot_do_json TEXT NOT NULL DEFAULT '[]',
      escalate_json TEXT NOT NULL DEFAULT '[]',
      uncertainty_threshold REAL NOT NULL DEFAULT 0.7,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS autonomy_contingencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      condition_description TEXT NOT NULL,
      fallback_action TEXT NOT NULL,
      approved_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contingencies_channel
      ON autonomy_contingencies(channel_id);

    CREATE TABLE IF NOT EXISTS autonomy_budget (
      channel_id TEXT PRIMARY KEY,
      week_token_budget INTEGER NOT NULL DEFAULT 0,
      week_token_used INTEGER NOT NULL DEFAULT 0,
      week_start_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decision_quarantine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      question TEXT NOT NULL,
      default_answer TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      resolved_at INTEGER,
      resolution TEXT,
      applied_default INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_quarantine_channel
      ON decision_quarantine(channel_id, resolved_at);

    CREATE TABLE IF NOT EXISTS quality_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      criterion_description TEXT NOT NULL,
      threshold REAL NOT NULL DEFAULT 0.0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quality_criteria_channel
      ON quality_criteria(channel_id, active);
  `);

  // Ensure new columns exist on channel_overrides (idempotent via PRAGMA check).
  const cols = db()
    .prepare(`PRAGMA table_info(channel_overrides)`)
    .all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("autonomy_perimeter_json")) {
    db().exec(`ALTER TABLE channel_overrides ADD COLUMN autonomy_perimeter_json TEXT`);
  }
  if (!colNames.has("max_session_secs")) {
    db().exec(`ALTER TABLE channel_overrides ADD COLUMN max_session_secs INTEGER`);
  }
  if (!colNames.has("poka_yoke_enabled")) {
    db().exec(
      `ALTER TABLE channel_overrides ADD COLUMN poka_yoke_enabled INTEGER NOT NULL DEFAULT 1`,
    );
  }
  if (!colNames.has("auto_inject_testament")) {
    db().exec(
      `ALTER TABLE channel_overrides ADD COLUMN auto_inject_testament INTEGER NOT NULL DEFAULT 1`,
    );
  }

  _ensured = true;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutonomyPolicy = {
  canDo: string[];
  cannotDo: string[];
  escalate: string[];
  uncertaintyThreshold: number;
};

type PolicyRow = {
  channel_id: string;
  can_do_json: string;
  cannot_do_json: string;
  escalate_json: string;
  uncertainty_threshold: number;
  updated_at: number;
};

type ContingencyRow = {
  id: number;
  channel_id: string;
  condition_description: string;
  fallback_action: string;
  approved_at: number;
};

type QuarantineRow = {
  id: number;
  channel_id: string;
  question: string;
  default_answer: string;
  expires_at: number;
  resolved_at: number | null;
  resolution: string | null;
  applied_default: number;
};

// ─── Policy ───────────────────────────────────────────────────────────────────

/**
 * Get the autonomy policy for a channel.
 * Returns null if no policy has been configured.
 */
export function getAutonomyPolicy(channelId: string): AutonomyPolicy | null {
  ensure();
  const row = db()
    .prepare(`SELECT * FROM autonomy_policy WHERE channel_id = ?`)
    .get(channelId) as PolicyRow | undefined;
  if (!row) return null;
  return {
    canDo: safeParseJson(row.can_do_json, []),
    cannotDo: safeParseJson(row.cannot_do_json, []),
    escalate: safeParseJson(row.escalate_json, []),
    uncertaintyThreshold: row.uncertainty_threshold,
  };
}

/**
 * Upsert the autonomy policy for a channel.
 */
export function upsertAutonomyPolicy(
  channelId: string,
  patch: Partial<AutonomyPolicy>,
): AutonomyPolicy {
  ensure();
  const existing = getAutonomyPolicy(channelId);
  const next: AutonomyPolicy = {
    canDo: patch.canDo ?? existing?.canDo ?? [],
    cannotDo: patch.cannotDo ?? existing?.cannotDo ?? [],
    escalate: patch.escalate ?? existing?.escalate ?? [],
    uncertaintyThreshold:
      patch.uncertaintyThreshold ?? existing?.uncertaintyThreshold ?? 0.7,
  };
  db()
    .prepare(
      `INSERT INTO autonomy_policy(channel_id, can_do_json, cannot_do_json, escalate_json, uncertainty_threshold, updated_at)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         can_do_json = excluded.can_do_json,
         cannot_do_json = excluded.cannot_do_json,
         escalate_json = excluded.escalate_json,
         uncertainty_threshold = excluded.uncertainty_threshold,
         updated_at = excluded.updated_at`,
    )
    .run(
      channelId,
      JSON.stringify(next.canDo),
      JSON.stringify(next.cannotDo),
      JSON.stringify(next.escalate),
      next.uncertaintyThreshold,
      Date.now(),
    );
  return next;
}

// ─── Contingencies ────────────────────────────────────────────────────────────

/**
 * List all approved contingency plans for a channel.
 */
export function listContingencies(channelId: string): ContingencyRow[] {
  ensure();
  return db()
    .prepare(`SELECT * FROM autonomy_contingencies WHERE channel_id = ? ORDER BY approved_at DESC`)
    .all(channelId) as ContingencyRow[];
}

/**
 * Get the number of approved contingencies for a channel.
 * More contingencies = more earned autonomy.
 */
export function getContingencyCount(channelId: string): number {
  ensure();
  const row = db()
    .prepare(`SELECT COUNT(*) as cnt FROM autonomy_contingencies WHERE channel_id = ?`)
    .get(channelId) as { cnt: number };
  return row.cnt;
}

/**
 * Add a new approved contingency plan.
 */
export function addContingency(
  channelId: string,
  conditionDescription: string,
  fallbackAction: string,
): ContingencyRow {
  ensure();
  const now = Date.now();
  const r = db()
    .prepare(
      `INSERT INTO autonomy_contingencies(channel_id, condition_description, fallback_action, approved_at)
       VALUES(?, ?, ?, ?)`,
    )
    .run(channelId, conditionDescription, fallbackAction, now);
  return db()
    .prepare(`SELECT * FROM autonomy_contingencies WHERE id = ?`)
    .get(Number(r.lastInsertRowid)) as ContingencyRow;
}

/**
 * Remove a contingency plan by id.
 */
export function deleteContingency(id: number): void {
  ensure();
  db().prepare(`DELETE FROM autonomy_contingencies WHERE id = ?`).run(id);
}

// ─── Autonomy level ───────────────────────────────────────────────────────────

/**
 * Compute the effective autonomy level (0-5) based on the number of declared
 * contingency plans. Each pair of contingencies earns one level:
 *   0 contingencies → level 0 (no autonomy)
 *   10+ contingencies → level 5 (full autonomy within perimeter)
 */
export function computeAutonomyLevel(channelId: string): number {
  ensure();
  const count = getContingencyCount(channelId);
  return Math.min(5, Math.floor(count / 2));
}

// ─── Action permission check ──────────────────────────────────────────────────

/**
 * Check whether a proposed action is permitted within the autonomy perimeter.
 * Returns false when poka_yoke is enabled and the action matches any entry
 * in the cannot_do list (case-insensitive substring match).
 */
export function isActionPermitted(channelId: string, actionDescription: string): boolean {
  ensure();
  const pokaRow = db()
    .prepare(`SELECT poka_yoke_enabled FROM channel_overrides WHERE channel_id = ?`)
    .get(channelId) as { poka_yoke_enabled: number | null } | undefined;

  // WHY: poka_yoke defaults to 1 (enabled) when the override row doesn't exist yet.
  const pokaEnabled = pokaRow?.poka_yoke_enabled !== 0;

  const policy = getAutonomyPolicy(channelId);
  if (!policy || policy.cannotDo.length === 0) return true;

  const lowerAction = actionDescription.toLowerCase();
  for (const forbidden of policy.cannotDo) {
    if (lowerAction.includes(forbidden.toLowerCase())) {
      // When poka-yoke is off, log the breach but still allow (caller decides).
      // When poka-yoke is on, deny.
      if (pokaEnabled) return false;
    }
  }
  return true;
}

// ─── Poka-yoke ────────────────────────────────────────────────────────────────

/**
 * Check whether an irreversible action has a prior recorded authorization.
 * Looks for a resolved (non-default-applied) quarantine record whose resolution
 * matches actionKey, meaning a human explicitly approved it before the fact.
 */
export function checkPokaYokeAuthorization(channelId: string, actionKey: string): boolean {
  ensure();
  const row = db()
    .prepare(
      `SELECT id FROM decision_quarantine
       WHERE channel_id = ?
         AND resolution = ?
         AND applied_default = 0
         AND resolved_at IS NOT NULL
       LIMIT 1`,
    )
    .get(channelId, actionKey) as { id: number } | undefined;
  return !!row;
}

/**
 * Record an explicit human authorization for a poka-yoke action.
 * Writes a resolved quarantine record so checkPokaYokeAuthorization will pass.
 */
export function recordPokaYokeAuthorization(channelId: string, actionKey: string): void {
  ensure();
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO decision_quarantine(channel_id, question, default_answer, expires_at, resolved_at, resolution, applied_default)
       VALUES(?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      channelId,
      `Authorization for: ${actionKey}`,
      "deny", // WHY: default is always deny — if the timer expires without human input, action is blocked
      now + 86_400_000, // 24 h grace window
      now,
      actionKey,
    );
}

// ─── Decision quarantine ──────────────────────────────────────────────────────

/**
 * Add a question to the quarantine queue. The agent asks the question and
 * declares a safe default answer. If no human resolves it before expiry,
 * the default is applied automatically via resolveExpiredQuarantines().
 * Returns the new record id.
 */
export function quarantineDecision(
  channelId: string,
  question: string,
  defaultAnswer: string,
  expireAfterMs: number,
): number {
  ensure();
  const now = Date.now();
  const r = db()
    .prepare(
      `INSERT INTO decision_quarantine(channel_id, question, default_answer, expires_at, resolved_at, resolution, applied_default)
       VALUES(?, ?, ?, ?, NULL, NULL, 0)`,
    )
    .run(channelId, question, defaultAnswer, now + expireAfterMs);
  return Number(r.lastInsertRowid);
}

/**
 * List open (unresolved) quarantine items for a channel.
 */
export function listOpenQuarantines(channelId: string): QuarantineRow[] {
  ensure();
  return db()
    .prepare(
      `SELECT * FROM decision_quarantine
       WHERE channel_id = ? AND resolved_at IS NULL
       ORDER BY expires_at ASC`,
    )
    .all(channelId) as QuarantineRow[];
}

/**
 * Resolve a quarantine item with a human-supplied answer.
 * applied_default stays 0 to signal a real human decision.
 */
export function resolveQuarantine(id: number, resolution: string): void {
  ensure();
  db()
    .prepare(
      `UPDATE decision_quarantine
       SET resolved_at = ?, resolution = ?, applied_default = 0
       WHERE id = ? AND resolved_at IS NULL`,
    )
    .run(Date.now(), resolution, id);
}

/**
 * Sweep expired unresolved quarantines, apply the declared default, and return
 * a summary of each decision that was auto-resolved. Meant to be called by a
 * cron endpoint or background daemon.
 */
export function resolveExpiredQuarantines(): Array<{
  channelId: string;
  question: string;
  resolution: string;
}> {
  ensure();
  const now = Date.now();
  const expired = db()
    .prepare(
      `SELECT * FROM decision_quarantine
       WHERE resolved_at IS NULL AND expires_at <= ?`,
    )
    .all(now) as QuarantineRow[];

  const results: Array<{ channelId: string; question: string; resolution: string }> = [];

  const update = db().prepare(
    `UPDATE decision_quarantine
     SET resolved_at = ?, resolution = default_answer, applied_default = 1
     WHERE id = ?`,
  );
  const tx = db().transaction(() => {
    for (const row of expired) {
      update.run(now, row.id);
      results.push({
        channelId: row.channel_id,
        question: row.question,
        resolution: row.default_answer,
      });
    }
  });
  tx();

  return results;
}

// ─── Policy text for agent injection ─────────────────────────────────────────

/**
 * Build a formatted text block describing the autonomy policy for a channel.
 * Designed to be injected at the top of an agent's context so it knows
 * what it can and cannot do without asking.
 */
export function getAutonomyPolicyText(channelId: string): string {
  ensure();
  const policy = getAutonomyPolicy(channelId);
  const level = computeAutonomyLevel(channelId);
  const contingencyCount = getContingencyCount(channelId);

  if (!policy) {
    return [
      "=== POLÍTICA DE AUTONOMÍA ===",
      "No hay política configurada para este canal.",
      "Actúa con máxima precaución y escala cualquier decisión no trivial.",
    ].join("\n");
  }

  const lines: string[] = [
    "=== POLÍTICA DE AUTONOMÍA ===",
    `Nivel actual: ${level}/5 (basado en ${contingencyCount} contingencias declaradas)`,
    "",
  ];

  if (policy.canDo.length > 0) {
    lines.push("PUEDES hacer sin pedir permiso:");
    for (const item of policy.canDo) lines.push(`- ${item}`);
    lines.push("");
  }

  if (policy.cannotDo.length > 0) {
    lines.push("NO PUEDES hacer nunca:");
    for (const item of policy.cannotDo) lines.push(`- ${item}`);
    lines.push("");
  }

  if (policy.escalate.length > 0) {
    lines.push("ESCALAR si ocurre:");
    for (const item of policy.escalate) lines.push(`- ${item}`);
    lines.push("");
  }

  lines.push(
    `Umbral de incertidumbre: si tu confianza es menor de ${policy.uncertaintyThreshold}, detente y registra la pregunta.`,
  );

  return lines.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
