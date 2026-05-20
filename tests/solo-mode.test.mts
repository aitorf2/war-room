// Test suite for lib/solo-mode.ts
// Uses Node built-in test runner via: tsx --test tests/solo-mode.test.mts
//
// Uses .mts extension to force ESM mode in tsx, enabling top-level await.
// solo-mode.ts → event-emitter.ts → db.ts → config.ts, so WAR_ROOM_DATA_DIR
// must be set before any of those modules evaluate.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-solo-mode-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

// Dynamic import runs AFTER process.env is set.
const {
  getSoloChannel,
  setSoloChannel,
  clearSoloChannel,
  isBackgrounded,
  getSoloModeText,
} = await import("../lib/solo-mode.ts");

// Ensure clean state at start — module state persists across tests in the same process.
clearSoloChannel();

test("getSoloChannel returns null initially", () => {
  assert.equal(getSoloChannel(), null);
});

test("getSoloModeText returns a Spanish string when no solo channel is set", () => {
  const text = getSoloModeText();
  assert.ok(typeof text === "string");
  assert.ok(text.length > 0);
  // Implementation: "Modo solo desactivado."
  assert.ok(text.includes("Modo"), `expected 'Modo' in text, got: ${text}`);
  assert.ok(text.includes("desactivado"), `expected 'desactivado' in text, got: ${text}`);
});

test("after setSoloChannel, getSoloChannel returns that channel id", () => {
  setSoloChannel("ch-abc");
  assert.equal(getSoloChannel(), "ch-abc");
});

test("isBackgrounded returns false for the active solo channel", () => {
  // ch-abc is the solo channel, so it is NOT backgrounded
  assert.equal(isBackgrounded("ch-abc"), false);
});

test("isBackgrounded returns true for a non-solo channel when solo mode is active", () => {
  assert.equal(isBackgrounded("ch-xyz"), true);
});

test("getSoloModeText mentions the active channel id", () => {
  // Implementation: `Modo solo activo en canal ${_soloChannel}.`
  const text = getSoloModeText();
  assert.ok(typeof text === "string");
  assert.ok(text.includes("ch-abc"), `expected channel id 'ch-abc' in text, got: ${text}`);
  assert.ok(text.includes("Modo"), `expected 'Modo' in text, got: ${text}`);
});

test("after clearSoloChannel, getSoloChannel returns null", () => {
  clearSoloChannel();
  assert.equal(getSoloChannel(), null);
});

test("after clearSoloChannel, isBackgrounded returns false for any channel", () => {
  // No solo channel set → nothing is backgrounded
  assert.equal(isBackgrounded("ch-xyz"), false);
  assert.equal(isBackgrounded("ch-abc"), false);
});

test("getSoloModeText after clearSoloChannel says desactivado", () => {
  const text = getSoloModeText();
  assert.ok(text.includes("desactivado"), `expected 'desactivado' after clear, got: ${text}`);
});

test("setSoloChannel can be called multiple times and overwrites the previous value", () => {
  setSoloChannel("ch-first");
  setSoloChannel("ch-second");
  assert.equal(getSoloChannel(), "ch-second");
  assert.equal(isBackgrounded("ch-first"), true);
  assert.equal(isBackgrounded("ch-second"), false);
  clearSoloChannel();
});
