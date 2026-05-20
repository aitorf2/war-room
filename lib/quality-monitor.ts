import fs from "fs";
import path from "path";
import { db } from "./db";
import { emitChannelEvent } from "./event-emitter";

// Spanish stopwords excluded from lexical entropy to avoid inflating score
// with high-frequency grammatical words that carry no semantic content.
const STOPWORDS = new Set([
  "el", "la", "los", "las", "de", "del", "que", "y", "a", "en",
  "es", "se", "no", "un", "una", "por", "con", "lo", "le", "al",
  "su", "sus", "para", "pero", "si", "mi", "me", "te", "tu",
  "esto", "eso", "esta", "ese", "como", "más", "o", "ya", "hay",
  "he", "ha", "han", "ser", "son", "fue", "era", "muy", "todo",
  "sobre", "porque", "cuando", "donde", "también", "entre",
]);

// ─── Flight data recorder ─────────────────────────────────────────────────────

/** Log a single agent action for later VoiceOver playback. */
export function logAction(
  channelId: string,
  sessionId: number | null,
  actionType: string,
  description: string,
  filePath?: string,
  decisionMade?: string,
): void {
  db()
    .prepare(
      `INSERT INTO action_flight_log
         (channel_id, session_id, action_type, description, file_path, decision_made, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      channelId,
      sessionId ?? null,
      actionType,
      description,
      filePath ?? null,
      decisionMade ?? null,
      Date.now(),
    );
}

type FlightLogRow = {
  id: number;
  action_type: string;
  description: string;
  file_path: string | null;
  decision_made: string | null;
  created_at: number;
};

/** Return flight log as numbered plain-text list suitable for VoiceOver reading. */
export function getFlightLogText(channelId: string, limit = 20): string {
  const rows = db()
    .prepare(
      `SELECT id, action_type, description, file_path, decision_made, created_at
       FROM action_flight_log
       WHERE channel_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(channelId, limit) as FlightLogRow[];

  if (rows.length === 0) {
    return "No hay acciones registradas en este canal.";
  }

  // Reverse so oldest is first (chronological order for narration).
  const ordered = rows.slice().reverse();

  return ordered
    .map((row, i) => {
      const d = new Date(row.created_at);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const time = `${hh}:${mm}`;
      let line = `Accion ${i + 1}. A las ${time}. ${row.description}.`;
      if (row.decision_made) {
        line += ` Tomo decision: ${row.decision_made}.`;
      }
      return line;
    })
    .join("\n");
}

// ─── Lexical entropy ──────────────────────────────────────────────────────────

/** Compute lexical entropy of a text as unique_content_words / total_content_words.
 *  Range 0-1. Below 0.3 = high repetition. Above 0.6 = healthy variety. */
export function computeLexicalEntropy(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  if (words.length === 0) return 0.5; // neutral when no content words

  const unique = new Set(words);
  return unique.size / words.length;
}

// ─── Agent metrics (weaning protocol) ────────────────────────────────────────

type MetricsRow = {
  channel_id: string;
  precision_streak: number;
  total_tasks_completed: number;
  mean_lexical_entropy: number | null;
  autonomy_level: number;
  last_updated: number;
};

function getMetricsRow(channelId: string): MetricsRow | undefined {
  return db()
    .prepare(`SELECT * FROM agent_metrics WHERE channel_id = ?`)
    .get(channelId) as MetricsRow | undefined;
}

/** Update metrics after each agent response.
 *  Computes rolling lexical entropy and advances the precision streak. */
export function updateAgentMetrics(
  channelId: string,
  responseText: string,
  taskSucceeded: boolean,
): void {
  const entropy = computeLexicalEntropy(responseText);
  const existing = getMetricsRow(channelId);
  const now = Date.now();

  let streak = existing?.precision_streak ?? 0;
  let totalTasks = existing?.total_tasks_completed ?? 0;
  const oldMean = existing?.mean_lexical_entropy ?? entropy;

  // Exponential moving average: 80% old, 20% new observation.
  const newMean = 0.8 * oldMean + 0.2 * entropy;

  if (taskSucceeded) {
    streak += 1;
    totalTasks += 1;
  } else {
    streak = 0;
  }

  // Autonomy level 1-5, one level per every 3 consecutive successes.
  const autonomyLevel = Math.min(5, Math.floor(streak / 3));

  db()
    .prepare(
      `INSERT INTO agent_metrics
         (channel_id, precision_streak, total_tasks_completed, mean_lexical_entropy, autonomy_level, last_updated)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         precision_streak     = excluded.precision_streak,
         total_tasks_completed = excluded.total_tasks_completed,
         mean_lexical_entropy = excluded.mean_lexical_entropy,
         autonomy_level       = excluded.autonomy_level,
         last_updated         = excluded.last_updated`,
    )
    .run(channelId, streak, totalTasks, newMean, autonomyLevel, now);

  // Lexical degradation: pull the andon cord so the user is alerted.
  if (newMean < 0.3) {
    emitChannelEvent(channelId, "andon_pulled", {
      detail: `Entropia lexica media caida a ${newMean.toFixed(2)}. El agente puede estar repitiendo patrones.`,
    });
  }
}

/** Read the current autonomy level for a channel (1-5). */
export function getAutonomyLevelFromMetrics(channelId: string): number {
  const row = getMetricsRow(channelId);
  return row?.autonomy_level ?? 1;
}

// ─── Inverse telemetry ────────────────────────────────────────────────────────

/** Agent proactively reports its internal state. */
export function recordTelemetry(
  channelId: string,
  confidence: number,
  unverifiedAssumptions: number,
  timeToNextDecisionSecs?: number,
  currentMode?: string,
): void {
  db()
    .prepare(
      `INSERT INTO agent_telemetry
         (channel_id, confidence, unverified_assumption_count, time_to_next_decision_secs, current_mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      channelId,
      confidence,
      unverifiedAssumptions,
      timeToNextDecisionSecs ?? null,
      currentMode ?? null,
      Date.now(),
    );
}

type TelemetryRow = {
  confidence: number;
  unverified_assumption_count: number;
  time_to_next_decision_secs: number | null;
  current_mode: string | null;
};

/** Return the latest telemetry snapshot as plain Spanish text for VoiceOver. */
export function getTelemetryText(channelId: string): string {
  const row = db()
    .prepare(
      `SELECT confidence, unverified_assumption_count, time_to_next_decision_secs, current_mode
       FROM agent_telemetry
       WHERE channel_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(channelId) as TelemetryRow | undefined;

  if (!row) {
    return "No hay telemetria registrada para este canal.";
  }

  const confidencePct = Math.round(row.confidence * 100);
  let text = `Confianza: ${confidencePct} por ciento. Supuestos sin verificar: ${row.unverified_assumption_count}.`;

  if (row.time_to_next_decision_secs !== null) {
    const mins = Math.round(row.time_to_next_decision_secs / 60);
    if (mins < 2) {
      text += " Proxima decision: en menos de dos minutos.";
    } else {
      text += ` Proxima decision: aproximadamente ${mins} minutos.`;
    }
  }

  if (row.current_mode) {
    text += ` Modo actual: ${row.current_mode}.`;
  }

  return text;
}

// ─── Drill mode ───────────────────────────────────────────────────────────────

type DrillRow = {
  id: number;
  result_log_json: string | null;
  intervention_points_json: string | null;
  completed_at: number | null;
};

/** Start a new drill run. Returns the drill id. */
export function startDrillRun(channelId: string, taskDescription: string): number {
  const res = db()
    .prepare(
      `INSERT INTO drill_runs (channel_id, task_description, result_log_json, intervention_points_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(channelId, taskDescription, JSON.stringify([]), JSON.stringify([]), Date.now());
  return Number(res.lastInsertRowid);
}

/** Append a step to an in-progress drill run. */
export function addDrillStep(
  drillId: number,
  step: string,
  wouldNeedIntervention: boolean,
): void {
  const row = db()
    .prepare(`SELECT result_log_json, intervention_points_json FROM drill_runs WHERE id = ?`)
    .get(drillId) as Pick<DrillRow, "result_log_json" | "intervention_points_json"> | undefined;

  if (!row) return;

  const log: string[] = row.result_log_json ? (JSON.parse(row.result_log_json) as string[]) : [];
  const interventions: string[] = row.intervention_points_json
    ? (JSON.parse(row.intervention_points_json) as string[])
    : [];

  log.push(step);
  if (wouldNeedIntervention) {
    interventions.push(step);
  }

  db()
    .prepare(
      `UPDATE drill_runs
       SET result_log_json = ?, intervention_points_json = ?
       WHERE id = ?`,
    )
    .run(JSON.stringify(log), JSON.stringify(interventions), drillId);
}

/** Mark a drill run as completed and return its formatted report. */
export function completeDrillRun(drillId: number): string {
  db()
    .prepare(`UPDATE drill_runs SET completed_at = ? WHERE id = ?`)
    .run(Date.now(), drillId);
  return getDrillReport(drillId);
}

/** Return a drill run report as plain Spanish text for VoiceOver. */
export function getDrillReport(drillId: number): string {
  const row = db()
    .prepare(
      `SELECT result_log_json, intervention_points_json, task_description, completed_at
       FROM drill_runs WHERE id = ?`,
    )
    .get(drillId) as
    | (Pick<DrillRow, "result_log_json" | "intervention_points_json" | "completed_at"> & {
        task_description: string;
      })
    | undefined;

  if (!row) {
    return "No se encontro el simulacro solicitado.";
  }

  const steps: string[] = row.result_log_json
    ? (JSON.parse(row.result_log_json) as string[])
    : [];
  const interventions: string[] = row.intervention_points_json
    ? (JSON.parse(row.intervention_points_json) as string[])
    : [];

  const status = row.completed_at ? "completado" : "en curso";
  let report = `Simulacro ${status}. Tarea: ${row.task_description}. El agente habria ejecutado ${steps.length} pasos.`;

  if (interventions.length === 0) {
    report += " No se necesitaria intervencion humana en ningun paso.";
  } else {
    report += ` Necesitaria intervencion en ${interventions.length} paso${interventions.length === 1 ? "" : "s"}: `;
    report += interventions.map((s, i) => `paso ${i + 1}: ${s}`).join("; ") + ".";
  }

  return report;
}

// ─── Coherence sampling ───────────────────────────────────────────────────────

type MessageRow = {
  content: string;
  role: string;
};

/** Local heuristic coherence check between a random past message and STATE.md.
 *  Does NOT call any LLM — keyword overlap only. */
export async function sampleCoherence(
  channelId: string,
  projectPath: string,
): Promise<{ contradictionFound: boolean; detail: string }> {
  const statePath = path.join(projectPath, "STATE.md");

  if (!fs.existsSync(statePath)) {
    return {
      contradictionFound: false,
      detail: "No se encontro STATE.md en la ruta del proyecto.",
    };
  }

  // Read STATE.md and extract meaningful terms (length > 4, not stopwords).
  let stateContent: string;
  try {
    stateContent = fs.readFileSync(statePath, "utf-8");
  } catch {
    return {
      contradictionFound: false,
      detail: "No se pudo leer STATE.md.",
    };
  }

  const stateTerms = new Set(
    stateContent
      .toLowerCase()
      .replace(/[^a-záéíóúüñ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w)),
  );

  // Pick a random past assistant message from any session in this channel.
  const rows = db()
    .prepare(
      `SELECT m.content, m.role
       FROM chat_messages m
       JOIN claude_sessions s ON s.id = m.session_id
       WHERE s.project_path = ? AND m.role = 'assistant'
       ORDER BY RANDOM()
       LIMIT 1`,
    )
    .all(projectPath) as MessageRow[];

  if (rows.length === 0) {
    return {
      contradictionFound: false,
      detail: "No hay mensajes previos para comparar.",
    };
  }

  const pastContent = rows[0].content.toLowerCase().replace(/[^a-záéíóúüñ\s]/g, " ");

  // Look for simple negation signals near state terms.
  // A contradiction heuristic: state terms appear in past message near "no", "nunca", "sin".
  const negationWords = ["no ", "nunca", "sin ", "jamas", "tampoco", "ningún", "ninguna"];
  const foundTerms: string[] = [];

  for (const term of stateTerms) {
    if (pastContent.includes(term)) {
      // Check if a negation word appears within 60 chars of the term.
      const idx = pastContent.indexOf(term);
      const window = pastContent.slice(Math.max(0, idx - 60), idx + term.length + 60);
      if (negationWords.some((neg) => window.includes(neg))) {
        foundTerms.push(term);
      }
    }
  }

  if (foundTerms.length > 0) {
    return {
      contradictionFound: true,
      detail: `Posible contradiccion detectada. El agente nego terminos clave de STATE.md: ${foundTerms.slice(0, 3).join(", ")}.`,
    };
  }

  return {
    contradictionFound: false,
    detail: "Sin contradicciones evidentes entre el historial y STATE.md.",
  };
}
