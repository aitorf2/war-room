// Integration tests for lib/session-memory.ts
// Uses Node built-in test runner via: tsx --test tests/session-memory.test.ts
//
// CRITICAL: WAR_ROOM_DATA_DIR must be set before importing lib modules because
// lib/config.ts reads DATA_DIR at module evaluation time and lib/db uses it to
// build the DB path on first call to db().

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-session-mem-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

// Only import lib modules AFTER setting the env var
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  writeSessionTestament,
  getSessionInjectionContext,
  recordFriction,
  saveColdMemory,
  deduceWorkFrontier,
} from "../lib/session-memory";

// ─── Tests ──────────────────────────────────────────────────────────────────

test("writeSessionTestament does not throw", () => {
  // session_id must be null or a valid claude_sessions.id; use null to avoid FK violation
  assert.doesNotThrow(() => {
    writeSessionTestament("ch-test", null, {
      commitments: ["a", "b"],
      decisions: ["c"],
      nextSteps: ["d"],
      openQuestions: ["e"],
    });
  });
});

test("getSessionInjectionContext returns non-empty string containing CONTEXTO after writing testament", () => {
  // Write a testament first so there is data to inject; session_id=null avoids FK violation
  writeSessionTestament("ch-test", null, {
    commitments: ["Usar TypeScript"],
    decisions: ["Elegir SQLite"],
    nextSteps: ["Escribir tests"],
    openQuestions: ["Que base de datos usar?"],
  });

  const ctx = getSessionInjectionContext("ch-test");

  assert.equal(typeof ctx, "string", "should return a string");
  assert.ok(ctx.length > 0, "context string should not be empty");
  // The function injects the section header "=== CONTEXTO DE SESION ANTERIOR..."
  assert.ok(
    ctx.includes("CONTEXTO") || ctx.includes("ACUERDOS") || ctx.includes("Compromisos"),
    `context should contain session data; got: ${ctx.slice(0, 200)}`,
  );
});

test("recordFriction does not throw", () => {
  assert.doesNotThrow(() => {
    recordFriction("ch-test", "El agente no encontro el archivo");
  });
});

test("getSessionInjectionContext contains friction description after recordFriction", () => {
  const frictionDescription = "El agente perdio contexto al reiniciar";
  recordFriction("ch-test", frictionDescription);

  const ctx = getSessionInjectionContext("ch-test");

  assert.ok(
    ctx.includes(frictionDescription) || ctx.includes("FRICCION"),
    `context should contain friction data; got: ${ctx.slice(0, 500)}`,
  );
});

test("saveColdMemory does not throw", () => {
  assert.doesNotThrow(() => {
    saveColdMemory(
      "ch-test",
      "Recordar que el proyecto usa TypeScript",
      ["typescript", "stack"],
      3,
    );
  });
});

test("deduceWorkFrontier returns a string and does not throw", async () => {
  // Use /tmp as the project path — git commands will fail gracefully (safeExec catches)
  // but the function should still return a formatted string
  const result = await deduceWorkFrontier("ch-test", tmpdir());

  assert.equal(typeof result, "string", "should return a string");
  // The function always builds at least the header line
  assert.ok(result.length > 0, "result should not be empty");
  assert.ok(
    result.includes("FRONTERA"),
    `result should contain the section header; got: ${result.slice(0, 200)}`,
  );
});
