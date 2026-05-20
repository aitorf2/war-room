// Test suite for lib/event-emitter.ts
// Uses Node built-in test runner via: tsx --test tests/event-emitter.test.mts
//
// Uses .mts extension to force ESM mode in tsx, enabling top-level await.
// This lets us set WAR_ROOM_DATA_DIR before lib/config.ts evaluates its
// module-level DATA_DIR constant.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-event-emitter-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

// Dynamic import runs AFTER process.env is set, so config.ts reads our temp dir.
const { emitChannelEvent, getPendingEvents, markEventConsumed } = await import(
  "../lib/event-emitter.ts"
);

test("emitChannelEvent emits an event that getPendingEvents returns", () => {
  emitChannelEvent("ch-1", "autonomy_started", { detail: "hello" });
  const events = getPendingEvents("ch-1");
  assert.ok(events.length >= 1, "should have at least one pending event");
  assert.equal(events[0].event_type, "autonomy_started");
  assert.equal(events[0].channel_id, "ch-1");
});

test("getPendingEvents returns events newest-first", async () => {
  // WHY: Sleep 2ms between emits so emitted_at timestamps differ,
  // making the ORDER BY emitted_at DESC deterministic in the same process.
  emitChannelEvent("ch-order", "intent_queued", { step: 1 });
  await new Promise((r) => setTimeout(r, 2));
  emitChannelEvent("ch-order", "intent_executed", { step: 2 });
  const events = getPendingEvents("ch-order");
  // Newest first — intent_executed (emitted later) should appear before intent_queued
  assert.equal(events[0].event_type, "intent_executed");
  assert.equal(events[1].event_type, "intent_queued");
});

test("markEventConsumed marks event as consumed and excludes it from getPendingEvents", () => {
  emitChannelEvent("ch-consume", "andon_pulled", { reason: "quality" });
  const before = getPendingEvents("ch-consume");
  assert.ok(before.length >= 1, "should have at least one pending event before consuming");

  const eventId = before[0].id;
  markEventConsumed(eventId);

  const after = getPendingEvents("ch-consume");
  const stillPresent = after.some((e) => e.id === eventId);
  assert.equal(stillPresent, false, "consumed event should not appear in getPendingEvents");
});

test("velocity_alert is a valid event type and does not throw", () => {
  assert.doesNotThrow(() => {
    emitChannelEvent("ch-vel", "velocity_alert", {});
  });
});

test("incident_opened is a valid event type and does not throw", () => {
  assert.doesNotThrow(() => {
    emitChannelEvent("ch-inc", "incident_opened", {});
  });
});

test("emitChannelEvent with no payload does not throw", () => {
  assert.doesNotThrow(() => {
    emitChannelEvent("ch-nopayload", "agent_completed");
  });
});

test("getPendingEvents for channel with no events returns empty array", () => {
  const events = getPendingEvents("ch-nonexistent-xyz-999");
  assert.ok(Array.isArray(events), "should return an array");
  assert.equal(events.length, 0, "should be empty for unknown channel");
});

test("emitted events have the expected shape", () => {
  emitChannelEvent("ch-shape", "budget_exhausted", { tokens: 500 });
  const events = getPendingEvents("ch-shape");
  assert.ok(events.length >= 1);
  const ev = events[0];
  assert.ok(typeof ev.id === "number", "id should be a number");
  assert.ok(typeof ev.channel_id === "string", "channel_id should be a string");
  assert.ok(typeof ev.event_type === "string", "event_type should be a string");
  assert.ok(typeof ev.emitted_at === "number", "emitted_at should be a number");
  assert.equal(ev.consumed_at, null, "consumed_at should be null for fresh events");
});
