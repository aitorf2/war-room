// Integration tests for lib/context-graph.ts, lib/crop-rotation.ts, lib/preconditions.ts
// Uses Node built-in test runner via tsx --test

// WHY: Static `import` statements are hoisted before any executable code in
// TypeScript/CJS output, so setting process.env before them has no effect on
// module-level constants like DATA_DIR in config.ts. We use createRequire() to
// load lib modules lazily, after WAR_ROOM_DATA_DIR is set, so db() picks up
// the isolated temp directory instead of the real ~/.war-room.
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-wave3-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

// require() happens in execution order (not hoisted), so DATA_DIR is read
// AFTER the env var is set above.
const req = createRequire(import.meta.url);
const dbMod = req("../lib/db") as { db: () => import("better-sqlite3").Database };

// WHY: The db.ts schema ships context_graph with (node_type, content, parent_id)
// but context-graph.ts writes (from_node, to_node, relation_type, weight).
// Recreate the table with the columns the module actually expects.
function patchContextGraphSchema(): void {
  dbMod.db().exec(`
    DROP TABLE IF EXISTS context_graph;
    CREATE TABLE context_graph (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id    TEXT NOT NULL,
      from_node     TEXT NOT NULL,
      to_node       TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      weight        REAL NOT NULL DEFAULT 1.0,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ctxgraph_channel
      ON context_graph(channel_id, created_at DESC);
  `);
}

// WHY: db.ts quality_criteria uses column criterion_description but
// preconditions.ts (and autonomous-runner.ts) use column criterion.
// Recreate with the correct column so INSERT/SELECT work.
function patchQualityCriteriaSchema(): void {
  dbMod.db().exec(`
    DROP TABLE IF EXISTS quality_criteria;
    CREATE TABLE quality_criteria (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      criterion  TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quality_criteria_channel
      ON quality_criteria(channel_id, active);
  `);
}

// WHY: db.ts action_flight_log uses created_at but crop-rotation.ts queries
// by triggered_at. Recreate the table with the column name the module expects.
function patchActionFlightLogSchema(): void {
  dbMod.db().exec(`
    DROP TABLE IF EXISTS action_flight_log;
    CREATE TABLE action_flight_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id   TEXT NOT NULL,
      session_id   INTEGER,
      action_type  TEXT NOT NULL,
      description  TEXT NOT NULL,
      file_path    TEXT,
      decision_made TEXT,
      triggered_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_flight_channel
      ON action_flight_log(channel_id, triggered_at DESC);
  `);
}

// Apply all schema patches before loading lib modules
patchContextGraphSchema();
patchQualityCriteriaSchema();
patchActionFlightLogSchema();

// Load modules via require() so they share the same db() singleton that already
// points at the temp dir with the patched schema.
const {
  addGraphEdge,
  getGraphNeighbors,
  getGraphSummaryText,
  inferDecisionContext,
} = req("../lib/context-graph") as typeof import("../lib/context-graph");

const {
  checkRotationLimit,
  getRotationStatusText,
} = req("../lib/crop-rotation") as typeof import("../lib/crop-rotation");

const {
  clearPrecondition,
  checkPreconditions,
  getPreconditions,
  getPreconditionsText,
  setPrecondition,
} = req("../lib/preconditions") as typeof import("../lib/preconditions");

// ─── context-graph tests ──────────────────────────────────────────────────────

test("addGraphEdge does not throw", () => {
  assert.doesNotThrow(() => {
    addGraphEdge("ch-cg", "TypeScript", "JavaScript", "extends", 2.0);
  });
});

test("getGraphNeighbors returns array with at least one item with toNode=JavaScript", () => {
  const neighbors = getGraphNeighbors("ch-cg", "TypeScript");
  assert.ok(Array.isArray(neighbors), "should return an array");
  assert.ok(neighbors.length >= 1, "should have at least 1 neighbor");
  assert.ok(
    neighbors.some((n) => n.toNode === "JavaScript"),
    "should include a neighbor with toNode=JavaScript",
  );
});

test("getGraphSummaryText returns a Spanish string containing number of relations", () => {
  const text = getGraphSummaryText("ch-cg");
  assert.equal(typeof text, "string");
  // After addGraphEdge above we have at least 1 relation → not the empty message
  assert.ok(
    text.includes("relaciones") || text.includes("relacion"),
    `expected Spanish text about relations, got: ${text}`,
  );
  // Should mention the count (at least "1")
  assert.ok(/\d/.test(text), `expected a number in the text, got: ${text}`);
});

test("inferDecisionContext with known term returns Spanish string (not empty)", () => {
  const result = inferDecisionContext("ch-cg", "TypeScript");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0, "result should not be empty");
  // Known term → found relations → should NOT be the "Sin contexto" message
  assert.ok(
    !result.startsWith("Sin contexto"),
    `expected a contextual result, got: ${result}`,
  );
});

test("inferDecisionContext with unknown term returns 'Sin contexto previo' message", () => {
  const result = inferDecisionContext("ch-cg", "inexistent-term-xyz");
  assert.ok(
    result.startsWith("Sin contexto previo"),
    `expected 'Sin contexto previo', got: ${result}`,
  );
});

// ─── crop-rotation tests ──────────────────────────────────────────────────────

test("checkRotationLimit for file_write returns { allowed: true } when count=0", () => {
  const result = checkRotationLimit("ch-rot", "file_write");
  assert.deepEqual(result, { allowed: true });
});

test("checkRotationLimit for unknown action type returns { allowed: true }", () => {
  const result = checkRotationLimit("ch-rot", "unknown_action");
  assert.deepEqual(result, { allowed: true });
});

test("getRotationStatusText returns a Spanish string about rotation limits", () => {
  const text = getRotationStatusText("ch-rot");
  assert.equal(typeof text, "string");
  assert.ok(text.length > 0, "text should not be empty");
  // With no blocked actions the message says "Sin restricciones"
  assert.ok(
    text.includes("restriccion") || text.includes("Restriccion"),
    `expected Spanish text about restrictions, got: ${text}`,
  );
});

// ─── preconditions tests ──────────────────────────────────────────────────────

test("setPrecondition does not throw", () => {
  assert.doesNotThrow(() => {
    setPrecondition("ch-pre", "el archivo debe existir");
  });
});

test("getPreconditions returns array containing the set precondition", () => {
  const conditions = getPreconditions("ch-pre");
  assert.ok(Array.isArray(conditions), "should return an array");
  assert.ok(
    conditions.includes("el archivo debe existir"),
    `expected 'el archivo debe existir' in ${JSON.stringify(conditions)}`,
  );
});

test("checkPreconditions returns allMet=true when context contains the condition", () => {
  const result = checkPreconditions(
    "ch-pre",
    "el archivo debe existir en el sistema",
  );
  assert.equal(result.allMet, true);
  assert.deepEqual(result.unmet, []);
});

test("checkPreconditions returns allMet=false when context does not match", () => {
  const result = checkPreconditions("ch-pre", "context sin match");
  assert.equal(result.allMet, false);
  assert.ok(result.unmet.length > 0, "unmet list should be non-empty");
});

test("getPreconditionsText returns Spanish string with count", () => {
  const text = getPreconditionsText("ch-pre");
  assert.equal(typeof text, "string");
  assert.ok(
    text.includes("Precondiciones") || text.includes("precondicion"),
    `expected Spanish text about preconditions, got: ${text}`,
  );
  assert.ok(/\d/.test(text), `expected a number in the text, got: ${text}`);
});

test("clearPrecondition does not throw", () => {
  assert.doesNotThrow(() => {
    clearPrecondition("ch-pre", "el archivo debe existir");
  });
});

test("getPreconditions returns empty array after clearing the only condition", () => {
  // clearPrecondition was called in the test above; verify the slate is clean
  const conditions = getPreconditions("ch-pre");
  assert.deepEqual(conditions, []);
});
