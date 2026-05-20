// Session memory system for War Room.
//
// Implements:
//   Idea 55  — Dead reckoning: deduce project state from git + SQLite without user narration
//   Idea 38  — Immutable agreements injected before every session
//   Idea 24  — Friction memory: load historical sticking points at session start
//   Idea 163 — Structured SQLite closeout read as first message next session
//   Idea 189 — Self-compression: agent saves summary before context collapse
//   Idea 113 — Two-layer memory (hot = testaments, cold = memory_cold)

import { execSync } from "child_process";
import { db } from "./db";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SessionTestamentRow {
  id: number;
  channel_id: string;
  session_id: number | null;
  commitments_json: string;
  decisions_json: string;
  next_steps_json: string;
  open_questions_json: string;
  created_at: number;
}

interface WorkFrontierRow {
  channel_id: string;
  frontier_json: string;
  last_commit_sha: string | null;
  last_file_touched: string | null;
  deduced_at: number;
}

interface FrictionRow {
  id: number;
  channel_id: string;
  description: string;
  frequency: number;
  last_seen_at: number;
}

interface AgreementRow {
  id: number;
  channel_id: string;
  content: string;
  is_immutable: number;
  created_at: number;
  created_by: string;
}

// ─── Git helpers ──────────────────────────────────────────────────────────

function safeExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, timeout: 8_000, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// ─── Dead reckoning ───────────────────────────────────────────────────────

/**
 * Reads git log + recently modified files + open decisions from SQLite to
 * deduce the current project state without any user narration.
 * Writes the result to work_frontier and returns it as a human-readable string.
 */
export async function deduceWorkFrontier(
  channelId: string,
  projectPath: string,
): Promise<string> {
  const gitLog = safeExec("git log --oneline -10", projectPath);
  const changedFiles = safeExec("git diff --name-only HEAD~5 HEAD", projectPath);
  const lastSha = safeExec("git rev-parse --short HEAD", projectPath);
  const lastFileTouched = changedFiles.split("\n")[0] ?? null;

  // Pull open decisions from SQLite for this channel
  const openDecisions = db()
    .prepare(
      `SELECT title, summary FROM decisions
       WHERE channel_id = ? AND status = 'open'
       ORDER BY created_at DESC LIMIT 5`,
    )
    .all(channelId) as Array<{ title: string; summary: string }>;

  const frontier = {
    gitLog: gitLog || "(no git history)",
    changedFiles: changedFiles || "(no recent changes)",
    openDecisions,
    deducedAt: new Date().toISOString(),
  };

  const frontierJson = JSON.stringify(frontier);

  db()
    .prepare(
      `INSERT INTO work_frontier(channel_id, frontier_json, last_commit_sha, last_file_touched, deduced_at)
       VALUES(?, ?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         frontier_json = excluded.frontier_json,
         last_commit_sha = excluded.last_commit_sha,
         last_file_touched = excluded.last_file_touched,
         deduced_at = excluded.deduced_at`,
    )
    .run(channelId, frontierJson, lastSha || null, lastFileTouched, Date.now());

  const lines: string[] = ["=== FRONTERA DE TRABAJO (deducida automaticamente) ==="];

  if (gitLog) {
    lines.push("\nUltimos commits:");
    lines.push(gitLog);
  }
  if (changedFiles) {
    lines.push("\nArchivos modificados recientemente:");
    lines.push(changedFiles);
  }
  if (openDecisions.length > 0) {
    lines.push("\nDecisiones abiertas en este canal:");
    for (const d of openDecisions) {
      lines.push(`- ${d.title}: ${d.summary}`);
    }
  }

  return lines.join("\n");
}

// ─── Session injection context ────────────────────────────────────────────

/**
 * Returns the full context block to inject at session start, in priority order:
 * 1. Immutable agreements
 * 2. Latest session testament
 * 3. Top friction points (by frequency)
 * 4. Work frontier
 */
export function getSessionInjectionContext(channelId: string): string {
  const sections: string[] = [];

  // 1. Immutable agreements
  const agreements = db()
    .prepare(
      `SELECT content FROM channel_agreements
       WHERE channel_id = ? AND is_immutable = 1
       ORDER BY created_at ASC`,
    )
    .all(channelId) as Array<{ content: string }>;

  if (agreements.length > 0) {
    sections.push("=== ACUERDOS PERMANENTES ===");
    for (const a of agreements) {
      sections.push(a.content);
    }
  }

  // 2. Latest session testament
  const testament = db()
    .prepare(
      `SELECT * FROM session_testaments
       WHERE channel_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(channelId) as SessionTestamentRow | undefined;

  if (testament) {
    const commitments: string[] = JSON.parse(testament.commitments_json);
    const decisions: string[] = JSON.parse(testament.decisions_json);
    const nextSteps: string[] = JSON.parse(testament.next_steps_json);
    const openQuestions: string[] = JSON.parse(testament.open_questions_json);

    const date = new Date(testament.created_at).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    sections.push(`\n=== CONTEXTO DE SESION ANTERIOR (${date}) ===`);

    if (commitments.length > 0) {
      sections.push("\nCompromisos adquiridos:");
      for (const c of commitments) sections.push(`- ${c}`);
    }
    if (decisions.length > 0) {
      sections.push("\nDecisiones tomadas:");
      for (const d of decisions) sections.push(`- ${d}`);
    }
    if (nextSteps.length > 0) {
      sections.push("\nProximos pasos pendientes:");
      for (const s of nextSteps) sections.push(`- ${s}`);
    }
    if (openQuestions.length > 0) {
      sections.push("\nPreguntas abiertas sin resolver:");
      for (const q of openQuestions) sections.push(`- ${q}`);
    }
  }

  // 3. Top friction points
  const frictions = db()
    .prepare(
      `SELECT description, frequency FROM friction_log
       WHERE channel_id = ?
       ORDER BY frequency DESC LIMIT 5`,
    )
    .all(channelId) as Array<{ description: string; frequency: number }>;

  if (frictions.length > 0) {
    sections.push("\n=== PUNTOS DE FRICCION HISTORICOS ===");
    for (const f of frictions) {
      sections.push(`- [${f.frequency}x] ${f.description}`);
    }
  }

  // 4. Work frontier (if available and not too stale — 24h)
  const frontier = db()
    .prepare(`SELECT * FROM work_frontier WHERE channel_id = ?`)
    .get(channelId) as WorkFrontierRow | undefined;

  const oneDayMs = 24 * 60 * 60 * 1000;
  if (frontier && Date.now() - frontier.deduced_at < oneDayMs) {
    const data = JSON.parse(frontier.frontier_json) as {
      gitLog: string;
      changedFiles: string;
      openDecisions: Array<{ title: string; summary: string }>;
    };

    sections.push("\n=== FRONTERA DE TRABAJO ===");
    if (data.gitLog && data.gitLog !== "(no git history)") {
      sections.push("Ultimos commits:");
      sections.push(data.gitLog);
    }
    if (data.changedFiles && data.changedFiles !== "(no recent changes)") {
      sections.push("Archivos modificados recientemente:");
      sections.push(data.changedFiles);
    }
    if (data.openDecisions.length > 0) {
      sections.push("Decisiones abiertas:");
      for (const d of data.openDecisions) sections.push(`- ${d.title}`);
    }
  }

  return sections.join("\n");
}

// ─── Write session testament ──────────────────────────────────────────────

/**
 * Saves a structured summary at session end. Called by the Stop hook or
 * manually by the agent before context collapse.
 */
export function writeSessionTestament(
  channelId: string,
  sessionId: number | null,
  testament: {
    commitments: string[];
    decisions: string[];
    nextSteps: string[];
    openQuestions: string[];
  },
): void {
  db()
    .prepare(
      `INSERT INTO session_testaments(
         channel_id, session_id,
         commitments_json, decisions_json,
         next_steps_json, open_questions_json,
         created_at
       ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      channelId,
      sessionId,
      JSON.stringify(testament.commitments),
      JSON.stringify(testament.decisions),
      JSON.stringify(testament.nextSteps),
      JSON.stringify(testament.openQuestions),
      Date.now(),
    );
}

// ─── Friction memory ──────────────────────────────────────────────────────

/**
 * Records a friction point for a channel. If an identical description already
 * exists for the channel, increments its frequency counter instead of
 * inserting a duplicate row.
 */
export function recordFriction(channelId: string, description: string): void {
  const now = Date.now();
  const existing = db()
    .prepare(
      `SELECT id FROM friction_log WHERE channel_id = ? AND description = ?`,
    )
    .get(channelId, description) as { id: number } | undefined;

  if (existing) {
    db()
      .prepare(
        `UPDATE friction_log SET frequency = frequency + 1, last_seen_at = ? WHERE id = ?`,
      )
      .run(now, existing.id);
  } else {
    db()
      .prepare(
        `INSERT INTO friction_log(channel_id, description, frequency, last_seen_at) VALUES(?, ?, 1, ?)`,
      )
      .run(channelId, description, now);
  }
}

// ─── Cold memory ─────────────────────────────────────────────────────────

/**
 * Saves a long-lived memory to the cold layer (architectural decisions,
 * permanent learnings). Cold memories survive context compaction and are
 * queried at session start via the injection context.
 */
export function saveColdMemory(
  channelId: string,
  content: string,
  tags: string[],
  importance: number,
): void {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO memory_cold(channel_id, content, tags_json, importance, created_at, last_accessed_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
    )
    .run(channelId, content, JSON.stringify(tags), importance, now, now);
}

// ─── Re-exported row types for consumers ──────────────────────────────────

export type { AgreementRow, FrictionRow, SessionTestamentRow, WorkFrontierRow };
