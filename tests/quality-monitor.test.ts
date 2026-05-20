// Test suite for lib/quality-monitor.ts
// Uses Node built-in test runner via tsx --test
//
// CRITICAL: WAR_ROOM_DATA_DIR must be set before importing lib modules
// because config.ts reads it at module evaluation time.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-qm-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

// Now safe to import lib modules
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeLexicalEntropy,
  logAction,
  getFlightLogText,
  updateAgentMetrics,
  getAutonomyLevelFromMetrics,
  recordTelemetry,
  getTelemetryText,
} from "../lib/quality-monitor";

// ─── computeLexicalEntropy ────────────────────────────────────────────────────

test("computeLexicalEntropy: high repetition text returns low entropy (0.0-0.4)", () => {
  // "hola" appears 3 times — only 1 unique word out of 3 → ratio = 0.33
  const result = computeLexicalEntropy("hola hola hola");
  assert.ok(
    result >= 0.0 && result <= 0.4,
    `Expected entropy in [0.0, 0.4], got ${result}`,
  );
});

test("computeLexicalEntropy: all-unique words returns high entropy (0.8-1.0)", () => {
  // 5 distinct content words → ratio = 1.0
  const result = computeLexicalEntropy("cielo mar tierra fuego agua");
  assert.ok(
    result >= 0.8 && result <= 1.0,
    `Expected entropy in [0.8, 1.0], got ${result}`,
  );
});

test("computeLexicalEntropy: empty string returns 0.5 (neutral per spec)", () => {
  const result = computeLexicalEntropy("");
  assert.equal(result, 0.5);
});

// ─── logAction ────────────────────────────────────────────────────────────────

test("logAction: does not throw for valid inputs", () => {
  assert.doesNotThrow(() => {
    logAction("ch-qm", null, "code_review", "Revisando el codigo");
  });
});

test("logAction: accepts optional filePath and decisionMade", () => {
  assert.doesNotThrow(() => {
    logAction(
      "ch-qm",
      null,
      "code_review",
      "Revisando el codigo con detalle",
      "/src/main.ts",
      "Aprobar cambio",
    );
  });
});

// ─── getFlightLogText ─────────────────────────────────────────────────────────

test("getFlightLogText: after logAction returns string containing 'Accion'", () => {
  // logAction already called above in this process; channel "ch-qm" has entries
  const result = getFlightLogText("ch-qm");
  assert.equal(typeof result, "string");
  assert.ok(
    result.includes("Accion"),
    `Expected 'Accion' in flight log text, got: ${result}`,
  );
});

test("getFlightLogText: empty channel returns 'No hay acciones' message", () => {
  const result = getFlightLogText("empty-channel");
  assert.equal(typeof result, "string");
  assert.ok(
    result.includes("No hay acciones"),
    `Expected 'No hay acciones' message, got: ${result}`,
  );
});

// ─── updateAgentMetrics ───────────────────────────────────────────────────────

test("updateAgentMetrics: does not throw for successful task", () => {
  assert.doesNotThrow(() => {
    updateAgentMetrics(
      "ch-qm",
      "El agente completo la tarea. El resultado fue satisfactorio.",
      true,
    );
  });
});

test("updateAgentMetrics: does not throw for failed task", () => {
  assert.doesNotThrow(() => {
    updateAgentMetrics("ch-qm", "El agente no pudo completar la tarea.", false);
  });
});

// ─── getAutonomyLevelFromMetrics ──────────────────────────────────────────────

test("getAutonomyLevelFromMetrics: returns a number between 0 and 5 inclusive", () => {
  // updateAgentMetrics was called above so metrics row exists for ch-qm
  const level = getAutonomyLevelFromMetrics("ch-qm");
  assert.equal(typeof level, "number");
  assert.ok(
    level >= 0 && level <= 5,
    `Expected autonomy level in [0, 5], got ${level}`,
  );
});

test("getAutonomyLevelFromMetrics: returns 1 for channel with no metrics row", () => {
  const level = getAutonomyLevelFromMetrics("ch-qm-no-metrics");
  assert.equal(level, 1);
});

// ─── recordTelemetry ─────────────────────────────────────────────────────────

test("recordTelemetry: does not throw", () => {
  assert.doesNotThrow(() => {
    recordTelemetry("ch-qm", 0.85, 2, 300, "working");
  });
});

test("recordTelemetry: accepts optional parameters as undefined", () => {
  assert.doesNotThrow(() => {
    recordTelemetry("ch-qm", 0.5, 0);
  });
});

// ─── getTelemetryText ─────────────────────────────────────────────────────────

test("getTelemetryText: returns Spanish text containing 'Confianza'", () => {
  // recordTelemetry was already called above for ch-qm
  const result = getTelemetryText("ch-qm");
  assert.equal(typeof result, "string");
  assert.ok(
    result.includes("Confianza"),
    `Expected 'Confianza' in telemetry text, got: ${result}`,
  );
});

test("getTelemetryText: returns no-telemetry message for empty channel", () => {
  const result = getTelemetryText("ch-qm-no-telemetry");
  assert.ok(
    result.includes("No hay telemetria"),
    `Expected no-telemetry message, got: ${result}`,
  );
});

test("getTelemetryText: includes time info when time_to_next_decision_secs provided", () => {
  recordTelemetry("ch-qm-time", 0.7, 1, 300, "planning");
  const result = getTelemetryText("ch-qm-time");
  assert.ok(
    result.includes("Confianza") && result.includes("minutos"),
    `Expected 'minutos' in result, got: ${result}`,
  );
});
