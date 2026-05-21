// Autonomous execution engine — scheduling logic only.
// This module does NOT spawn Claude directly; spawning is handled by the
// existing chat API (app/api/chat/route.ts). This module computes WHEN to
// trigger an autonomous turn and what prompt to inject.
//
// Two-loop concept:
//   Inner loop — normal chat turn → response → chat_messages (existing)
//   Outer loop — every 5 responses, write a human-readable supervision summary
//                to the activity table (kind = "system") and emit an event so
//                dashboards can surface it without reading every message.

import fs from "fs";
import path from "path";
import { db } from "./db";
import { emitChannelEvent } from "./event-emitter";
import { notifyAndonPulled, notifyBudgetExhausted } from "./notifications";

// ---------------------------------------------------------------------------
// Schema bootstrap — idempotent, called lazily on first use
// ---------------------------------------------------------------------------

let _schemaReady = false;

function ensureSchema() {
  if (_schemaReady) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS channel_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      emitted_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_channel_events_channel
      ON channel_events(channel_id, emitted_at DESC);

    CREATE TABLE IF NOT EXISTS channel_velocity (
      channel_id TEXT PRIMARY KEY,
      status_code TEXT,
      tasks_last_7d INTEGER NOT NULL DEFAULT 0,
      tasks_prev_7d INTEGER NOT NULL DEFAULT 0,
      last_computed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deferred_intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      instruction TEXT NOT NULL,
      submitted_at INTEGER NOT NULL,
      execute_after INTEGER NOT NULL,
      executed_at INTEGER,
      result_summary TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_deferred_intents_channel
      ON deferred_intents(channel_id, execute_after ASC);

    CREATE TABLE IF NOT EXISTS channel_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      phase_name TEXT NOT NULL,
      autonomy_freq_secs INTEGER NOT NULL DEFAULT 3600,
      start_at INTEGER NOT NULL,
      end_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_channel_phases_channel
      ON channel_phases(channel_id, start_at DESC);

    CREATE TABLE IF NOT EXISTS channel_lifecycle (
      channel_id TEXT PRIMARY KEY,
      objective TEXT,
      acceptance_criteria_json TEXT,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      weekly_setpoint INTEGER NOT NULL DEFAULT 5,
      tasks_this_week INTEGER NOT NULL DEFAULT 0,
      opened_at INTEGER NOT NULL,
      closed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS autonomy_budget (
      channel_id TEXT PRIMARY KEY,
      week_token_budget INTEGER NOT NULL DEFAULT 100000,
      week_token_used INTEGER NOT NULL DEFAULT 0,
      week_start_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quality_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      criterion TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quality_criteria_channel
      ON quality_criteria(channel_id, active);
  `);
  _schemaReady = true;
}

// ---------------------------------------------------------------------------
// Active channel lock — idea 165: one active channel at a time
// In-process singleton; resets on server restart (acceptable for MVP).
// ---------------------------------------------------------------------------

let _activeChannel: string | null = null;

/** Mark channelId as the currently active autonomous channel.
 *  Other channels will be skipped by checkAutonomousTrigger while this is set. */
export function setActiveChannel(channelId: string): void {
  _activeChannel = channelId;
}

/** Clear the active channel lock, allowing other channels to trigger. */
export function clearActiveChannel(channelId: string): void {
  if (_activeChannel === channelId) _activeChannel = null;
}

/** Return the currently active channel id, or null if none is running. */
export function getActiveChannel(): string | null {
  return _activeChannel;
}

// ---------------------------------------------------------------------------
// checkAutonomousTrigger — idea 36, 83, 208
// ---------------------------------------------------------------------------

/** Compute a trigger prompt for channelId, or null if no trigger is due.
 *
 *  Priority order:
 *  1. Another channel is already active → null (idea 165)
 *  2. Pending deferred intent that is ready to execute → intent prompt (idea 208)
 *  3. Autonomy frequency elapsed since last message → idle-work prompt (idea 36)
 *  4. STATE.md not modified in 48 h → state-review prompt (idea 83)
 *  5. Nothing due → null
 */
export async function checkAutonomousTrigger(
  channelId: string,
  projectPath: string,
): Promise<string | null> {
  ensureSchema();

  // 1. Respect one-active-channel constraint
  if (_activeChannel !== null && _activeChannel !== channelId) {
    return null;
  }

  // 2. Deferred intents take highest priority — user explicitly queued work
  const pendingIntent = db()
    .prepare(
      `SELECT id, instruction FROM deferred_intents
       WHERE channel_id = ? AND executed_at IS NULL AND execute_after <= ?
       ORDER BY execute_after ASC LIMIT 1`,
    )
    .get(channelId, Date.now()) as
    | { id: number; instruction: string }
    | undefined;

  if (pendingIntent) {
    // Record this so recordAutonomousTurn can correlate later
    _pendingIntentId = pendingIntent.id;
    return pendingIntent.instruction;
  }
  _pendingIntentId = null;

  // 3. Idle-work trigger: check phase's autonomy_freq_secs vs last message age
  const currentPhase = db()
    .prepare(
      `SELECT autonomy_freq_secs FROM channel_phases
       WHERE channel_id = ? AND end_at IS NULL
       ORDER BY start_at DESC LIMIT 1`,
    )
    .get(channelId) as { autonomy_freq_secs: number } | undefined;

  const freqSecs = currentPhase?.autonomy_freq_secs ?? 7200; // default: 2 h

  // Find the most recent message in any session for this projectPath
  const lastMsg = db()
    .prepare(
      `SELECT m.created_at
       FROM chat_messages m
       JOIN claude_sessions s ON s.id = m.session_id
       WHERE s.project_path = ?
       ORDER BY m.created_at DESC LIMIT 1`,
    )
    .get(projectPath) as { created_at: number } | undefined;

  const now = Date.now();
  const lastMsgAge = lastMsg ? (now - lastMsg.created_at) / 1000 : Infinity;

  if (lastMsgAge >= freqSecs) {
    const phaseName = db()
      .prepare(
        `SELECT phase_name FROM channel_phases
         WHERE channel_id = ? AND end_at IS NULL
         ORDER BY start_at DESC LIMIT 1`,
      )
      .get(channelId) as { phase_name: string } | undefined;

    const phase = phaseName?.phase_name ?? "general";
    const idleMinutes = Math.round(lastMsgAge / 60);
    return (
      `[Autonomous turn — ${phase} phase] The channel has been idle for ` +
      `${idleMinutes} minutes. Review current project state, identify the ` +
      `highest-value next action, and either execute it or summarise blockers ` +
      `so the team can unblock on next review. Be concise.`
    );
  }

  // 4. File-condition trigger: STATE.md not modified in 48 h (idea 83)
  const statePath = path.join(projectPath, "STATE.md");
  try {
    const stat = fs.statSync(statePath);
    const ageHours = (now - stat.mtimeMs) / (1000 * 60 * 60);
    if (ageHours >= 48) {
      return (
        `[Autonomous state review] STATE.md has not been updated in ` +
        `${Math.round(ageHours)} hours. Read STATE.md, assess project status, ` +
        `and update it with current progress, blockers, and next steps.`
      );
    }
  } catch {
    // STATE.md does not exist — no trigger from this condition
  }

  return null;
}

// Carries the intent id across checkAutonomousTrigger → markIntentExecuted
// when the caller loops back with the result. Module-level is safe because
// Next.js API routes are single-tenant on Node.js.
let _pendingIntentId: number | null = null;

// ---------------------------------------------------------------------------
// recordAutonomousTurn
// ---------------------------------------------------------------------------

/** Log that an autonomous turn was triggered so callers can track cadence. */
export function recordAutonomousTurn(channelId: string, prompt: string): void {
  ensureSchema();
  db()
    .prepare(
      `INSERT INTO action_flight_log(channel_id, action_type, description, created_at)
       VALUES(?, ?, ?, ?)`,
    )
    .run(channelId, "autonomous_trigger", prompt.slice(0, 300), Date.now());

  emitChannelEvent(channelId, "autonomy_started", {
    promptPreview: prompt.slice(0, 120),
  });
}

// ---------------------------------------------------------------------------
// maybeWriteSupervisionSummary — outer loop (idea 91)
// ---------------------------------------------------------------------------

/** Call after each agent response. Every 5th call writes a 2-sentence
 *  summary to the activity table and emits an autonomy_started event so
 *  dashboards surface outer-loop progress without reading all messages. */
export function maybeWriteSupervisionSummary(
  channelId: string,
  sessionId: number,
  responseText: string,
  actionCount: number,
): void {
  if (actionCount % 5 !== 0 || actionCount === 0) return;

  ensureSchema();

  // WHY: Extract the first two meaningful sentences as a cheap but readable
  // summary. Avoids an LLM call for the supervision loop while keeping
  // the outer-loop output human-readable in the activity widget.
  const sentences = responseText
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const summary = sentences.slice(0, 2).join(" ") || responseText.slice(0, 200);

  try {
    db()
      .prepare(
        `INSERT INTO activity(kind, title, detail, project_path, created_at)
         VALUES(?, ?, ?, ?, ?)`,
      )
      .run(
        "system",
        `[supervision] ${channelId} — action #${actionCount}`,
        summary,
        null,
        Date.now(),
      );
  } catch {
    // activity table may not be ready yet on first boot — non-fatal
  }

  emitChannelEvent(channelId, "autonomy_started", {
    kind: "supervision_summary",
    actionCount,
    summary: summary.slice(0, 200),
    sessionId,
  });
}

// ---------------------------------------------------------------------------
// checkQualityCriteria — Andon cord (idea 96)
// ---------------------------------------------------------------------------

/** Evaluate responseText against any active quality criteria for channelId.
 *
 *  Default heuristics apply when no custom criteria exist:
 *  - Response must be longer than 10 chars
 *  - Response must not start with a hard-failure prefix
 *
 *  On failure, emits "andon_pulled" and logs to action_flight_log.
 */
export function checkQualityCriteria(
  channelId: string,
  responseText: string,
): { passed: boolean; failedCriterion?: string } {
  ensureSchema();

  const trimmed = responseText.trim();

  // --- Default heuristic checks ---
  if (trimmed.length < 10) {
    const criterion = "response_too_short";
    _recordAndon(channelId, criterion);
    return { passed: false, failedCriterion: criterion };
  }

  const hardFailPrefixes = [
    "I cannot",
    "I'm unable",
    "Error:",
    "An error occurred",
    "I apologize, but I cannot",
  ];
  for (const prefix of hardFailPrefixes) {
    if (trimmed.startsWith(prefix)) {
      const criterion = `hard_failure_prefix: "${prefix}"`;
      _recordAndon(channelId, criterion);
      return { passed: false, failedCriterion: criterion };
    }
  }

  // --- Per-channel custom criteria ---
  const criteria = db()
    .prepare(
      `SELECT criterion FROM quality_criteria
       WHERE channel_id = ? AND active = 1`,
    )
    .all(channelId) as Array<{ criterion: string }>;

  for (const { criterion } of criteria) {
    // WHY: Simple substring / keyword matching keeps this deterministic and
    // fast — no LLM call. The criterion stored is a required keyword that
    // MUST appear in the response, prefixed with "must_contain:" or
    // a forbidden keyword prefixed with "must_not_contain:".
    if (criterion.startsWith("must_contain:")) {
      const keyword = criterion.slice("must_contain:".length).trim().toLowerCase();
      if (!trimmed.toLowerCase().includes(keyword)) {
        _recordAndon(channelId, criterion);
        return { passed: false, failedCriterion: criterion };
      }
    } else if (criterion.startsWith("must_not_contain:")) {
      const keyword = criterion.slice("must_not_contain:".length).trim().toLowerCase();
      if (trimmed.toLowerCase().includes(keyword)) {
        _recordAndon(channelId, criterion);
        return { passed: false, failedCriterion: criterion };
      }
    }
    // Unknown criterion format: skip (permissive by default)
  }

  return { passed: true };
}

function _recordAndon(channelId: string, failedCriterion: string) {
  db()
    .prepare(
      `INSERT INTO action_flight_log(channel_id, action_type, description, created_at)
       VALUES(?, ?, ?, ?)`,
    )
    .run(channelId, "andon_pulled", failedCriterion, Date.now());
  notifyAndonPulled(channelId, failedCriterion);
}

// ---------------------------------------------------------------------------
// checkMissionBudget — bounded mission (idea 204)
// ---------------------------------------------------------------------------

/** Return true if tokensUsed or elapsedSecs has exceeded the channel's
 *  weekly budget or a per-session time cap.
 *
 *  When over budget the caller should emit "agent_completed" and stop.
 *  This function handles the budget_exhausted notification and event. */
export function checkMissionBudget(
  channelId: string,
  tokensUsed: number,
  elapsedSecs: number,
): boolean {
  ensureSchema();
  const now = Date.now();

  // Update the weekly token usage atomically
  const weekStart = _weekStart();
  db()
    .prepare(
      `INSERT INTO autonomy_budget(channel_id, week_token_budget, week_token_used, week_start_at, updated_at)
       VALUES(?, 100000, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         week_token_used = CASE
           WHEN week_start_at < excluded.week_start_at THEN excluded.week_token_used
           ELSE week_token_used + excluded.week_token_used
         END,
         week_start_at = CASE
           WHEN week_start_at < excluded.week_start_at THEN excluded.week_start_at
           ELSE week_start_at
         END,
         updated_at = excluded.updated_at`,
    )
    .run(channelId, tokensUsed, weekStart, now);

  const row = db()
    .prepare(
      `SELECT week_token_budget, week_token_used FROM autonomy_budget WHERE channel_id = ?`,
    )
    .get(channelId) as
    | { week_token_budget: number; week_token_used: number }
    | undefined;

  const tokenBudgetExceeded = row
    ? row.week_token_used > row.week_token_budget
    : false;

  // Per-session hard cap: 30 minutes (1800 s). Prevents runaway sessions.
  const TIME_CAP_SECS = 1800;
  const timeCapExceeded = elapsedSecs >= TIME_CAP_SECS;

  if (tokenBudgetExceeded || timeCapExceeded) {
    notifyBudgetExhausted(channelId, tokensUsed, elapsedSecs);
    emitChannelEvent(channelId, "agent_completed", {
      reason: tokenBudgetExceeded ? "token_budget" : "time_cap",
      tokensUsed,
      elapsedSecs,
    });
    return true;
  }

  return false;
}

function _weekStart(): number {
  const d = new Date();
  // Monday 00:00:00 UTC
  const day = d.getUTCDay(); // 0 = Sunday
  const diffDays = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diffDays);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// markIntentExecuted — idea 208
// ---------------------------------------------------------------------------

/** Mark a deferred intent as executed with an optional result summary. */
export function markIntentExecuted(intentId: number, resultSummary: string): void {
  ensureSchema();
  db()
    .prepare(
      `UPDATE deferred_intents
       SET executed_at = ?, result_summary = ?
       WHERE id = ?`,
    )
    .run(Date.now(), resultSummary.slice(0, 500), intentId);

  emitChannelEvent("", "intent_executed", { intentId, resultSummary: resultSummary.slice(0, 200) });
}

/** Expose the last detected pending intent id so callers can mark it executed. */
export function getLastPendingIntentId(): number | null {
  return _pendingIntentId;
}
