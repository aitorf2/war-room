// Test suite for lib/autonomous-runner.ts
// Uses .mts + top-level await so WAR_ROOM_DATA_DIR is set before lib/config.ts loads.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-ar-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

const {
  getActiveChannel,
  setActiveChannel,
  clearActiveChannel,
  checkQualityCriteria,
  maybeWriteSupervisionSummary,
  checkAutonomousTrigger,
  recordAutonomousTurn,
} = await import("../lib/autonomous-runner.ts");

// ─── Active channel lock ──────────────────────────────────────────────────────

test("getActiveChannel: initially returns null", () => {
  clearActiveChannel(getActiveChannel() ?? "__none__");
  assert.equal(getActiveChannel(), null);
});

test("setActiveChannel: sets the active channel", () => {
  setActiveChannel("ch-auto");
  assert.equal(getActiveChannel(), "ch-auto");
});

test("clearActiveChannel: clears the active channel", () => {
  clearActiveChannel("ch-auto");
  assert.equal(getActiveChannel(), null);
});

// ─── checkQualityCriteria ─────────────────────────────────────────────────────

test("checkQualityCriteria: fails on hard-failure prefix 'I cannot'", () => {
  const result = checkQualityCriteria("ch-auto", "I cannot do that");
  assert.equal(result.passed, false);
  assert.ok(result.failedCriterion?.includes("hard_failure_prefix"), `got: ${result.failedCriterion}`);
});

test("checkQualityCriteria: fails on hard-failure prefix 'I'm unable'", () => {
  const result = checkQualityCriteria("ch-auto", "I'm unable to process");
  assert.equal(result.passed, false);
  assert.ok(result.failedCriterion?.includes("hard_failure_prefix"), `got: ${result.failedCriterion}`);
});

test("checkQualityCriteria: passes for a valid long Spanish response", () => {
  const result = checkQualityCriteria(
    "ch-auto",
    "El agente ha completado la tarea satisfactoriamente con los recursos disponibles.",
  );
  assert.equal(result.passed, true);
  assert.equal(result.failedCriterion, undefined);
});

test("checkQualityCriteria: fails for response shorter than 10 chars", () => {
  const result = checkQualityCriteria("ch-auto", "ok");
  assert.equal(result.passed, false);
  assert.equal(result.failedCriterion, "response_too_short");
});

// ─── maybeWriteSupervisionSummary ─────────────────────────────────────────────

test("maybeWriteSupervisionSummary: does not throw when actionCount=5 (triggers summary)", () => {
  assert.doesNotThrow(() => {
    maybeWriteSupervisionSummary("ch-auto", 1, "El agente realizo el trabajo. Los resultados son positivos.", 5);
  });
});

test("maybeWriteSupervisionSummary: does not throw when actionCount=3 (no summary written)", () => {
  assert.doesNotThrow(() => { maybeWriteSupervisionSummary("ch-auto", 1, "texto", 3); });
});

test("maybeWriteSupervisionSummary: does not throw for actionCount=0 (skipped)", () => {
  assert.doesNotThrow(() => { maybeWriteSupervisionSummary("ch-auto", 1, "texto largo suficiente aqui", 0); });
});

test("maybeWriteSupervisionSummary: does not throw for actionCount=10 (second trigger)", () => {
  assert.doesNotThrow(() => {
    maybeWriteSupervisionSummary("ch-auto", 2, "Segunda supervision del agente autonomo. Progreso continuo.", 10);
  });
});

// ─── checkAutonomousTrigger ───────────────────────────────────────────────────

test("checkAutonomousTrigger: returns null or string for non-existent project path", async () => {
  const result = await checkAutonomousTrigger("ch-auto", "/tmp/no-such-project");
  assert.ok(result === null || typeof result === "string", `Expected null or string, got: ${typeof result}`);
});

test("checkAutonomousTrigger: returns null when a different channel is active", async () => {
  setActiveChannel("other-channel");
  const result = await checkAutonomousTrigger("ch-auto", "/tmp/no-such-project");
  assert.equal(result, null);
  clearActiveChannel("other-channel");
});

test("checkAutonomousTrigger: returns a string prompt when no channel is active and project is idle", async () => {
  clearActiveChannel(getActiveChannel() ?? "__none__");
  const result = await checkAutonomousTrigger("ch-trigger", "/tmp/no-such-project-trigger");
  assert.ok(typeof result === "string", `Expected string prompt, got: ${result}`);
  assert.ok(
    result.includes("Autonomous") || result.includes("autonomous") || result.includes("idle"),
    `Expected autonomous trigger text, got: ${result}`,
  );
});

// ─── recordAutonomousTurn ─────────────────────────────────────────────────────

test("recordAutonomousTurn: does not throw after schema fix", () => {
  assert.doesNotThrow(() => {
    recordAutonomousTurn("ch-auto", "test autonomous prompt that is definitely longer than 300 chars? no its fine");
  });
});
