// Test suite for lib/notifications.ts
// Uses Node built-in test runner via tsx --test
// No DB required — notifications.ts only uses execSync for OS calls which it catches silently.

import { test } from "node:test";
import assert from "node:assert/strict";

// notifications.ts does NOT import db or config, so no DATA_DIR setup needed.
import {
  playChannelSound,
  sendMacNotification,
  dispatchEvent,
  notifyAndonPulled,
  notifyBudgetExhausted,
} from "../lib/notifications";

test("playChannelSound is exported as a function", () => {
  assert.equal(typeof playChannelSound, "function");
});

test("sendMacNotification is exported as a function", () => {
  assert.equal(typeof sendMacNotification, "function");
});

test("dispatchEvent is exported as a function", () => {
  assert.equal(typeof dispatchEvent, "function");
});

test("notifyAndonPulled is exported as a function", () => {
  assert.equal(typeof notifyAndonPulled, "function");
});

test("notifyBudgetExhausted is exported as a function", () => {
  assert.equal(typeof notifyBudgetExhausted, "function");
});

test("notifyAndonPulled does not throw when called", () => {
  assert.doesNotThrow(() => {
    notifyAndonPulled("test-channel", "test reason");
  });
});

test("notifyBudgetExhausted does not throw when called", () => {
  assert.doesNotThrow(() => {
    notifyBudgetExhausted("test-channel", 1000, 60);
  });
});

test("playChannelSound does not throw for status 0 (idle)", () => {
  assert.doesNotThrow(() => playChannelSound(0));
});

test("playChannelSound does not throw for status 1 (working)", () => {
  assert.doesNotThrow(() => playChannelSound(1));
});

test("playChannelSound does not throw for status 2 (needs-attention)", () => {
  assert.doesNotThrow(() => playChannelSound(2));
});

test("dispatchEvent does not throw for agent_completed event", () => {
  assert.doesNotThrow(() => {
    dispatchEvent("agent_completed", "my-channel", "done successfully");
  });
});

test("dispatchEvent does not throw for andon_pulled event", () => {
  assert.doesNotThrow(() => {
    dispatchEvent("andon_pulled", "my-channel");
  });
});

test("sendMacNotification does not throw when called", () => {
  assert.doesNotThrow(() => {
    sendMacNotification("Test title", "Test body");
  });
});
