// Test suite for lib/velocity-monitor.ts
// Uses Node built-in test runner via: tsx --test tests/velocity-monitor.test.mts
//
// Uses .mts extension to force ESM mode in tsx, enabling top-level await.
// This lets us set WAR_ROOM_DATA_DIR before lib/config.ts evaluates its
// module-level DATA_DIR constant.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-velocity-monitor-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

// Dynamic import runs AFTER process.env is set, so config.ts reads our temp dir.
const {
  computeVelocityStatus,
  updateChannelVelocity,
  getVelocityText,
  playVelocitySound,
} = await import("../lib/velocity-monitor.ts");

test("computeVelocityStatus returns stable for a channel with no data", () => {
  // No row in channel_velocity → returns "stable" per implementation
  const status = computeVelocityStatus("new-channel");
  assert.equal(status, "stable");
});

test("updateChannelVelocity does not throw when action_flight_log is empty", () => {
  assert.doesNotThrow(() => {
    updateChannelVelocity("vc-test");
  });
});

test("computeVelocityStatus after updateChannelVelocity with no actions returns stalled", () => {
  // With zero completed actions in both 7d windows, tasks_last_7d === 0 → stalled
  updateChannelVelocity("vc-stalled");
  const status = computeVelocityStatus("vc-stalled");
  assert.equal(status, "stalled");
});

test("getVelocityText returns a Spanish string for unknown channel", () => {
  const text = getVelocityText("vc-unknown-xyz");
  assert.ok(typeof text === "string", "should return a string");
  assert.ok(text.length > 0, "should not be empty");
  // Implementation returns: "Ritmo del canal: sin datos todavía."
  assert.ok(text.includes("Ritmo"), `expected 'Ritmo' in text, got: ${text}`);
});

test("getVelocityText after update contains velocity information with task counts", () => {
  updateChannelVelocity("vc-text-test");
  const text = getVelocityText("vc-text-test");
  assert.ok(typeof text === "string");
  // After update, the row exists — should contain task counts
  assert.ok(text.includes("Tareas"), `expected 'Tareas' in velocity text, got: ${text}`);
});

test("playVelocitySound for rising does not throw", () => {
  assert.doesNotThrow(() => {
    playVelocitySound("rising");
  });
});

test("playVelocitySound for stalled does not throw", () => {
  assert.doesNotThrow(() => {
    playVelocitySound("stalled");
  });
});

test("playVelocitySound for falling does not throw", () => {
  assert.doesNotThrow(() => {
    playVelocitySound("falling");
  });
});

test("playVelocitySound for stable does not throw", () => {
  assert.doesNotThrow(() => {
    playVelocitySound("stable");
  });
});

test("updateChannelVelocity is idempotent, calling twice does not throw", () => {
  assert.doesNotThrow(() => {
    updateChannelVelocity("vc-idempotent");
    updateChannelVelocity("vc-idempotent");
  });
});
