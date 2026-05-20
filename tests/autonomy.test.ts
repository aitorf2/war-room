// Integration tests for lib/autonomy.ts
// Uses Node built-in test runner via: tsx --test tests/autonomy.test.ts
//
// CRITICAL: WAR_ROOM_DATA_DIR must be set before importing lib modules because
// lib/config.ts reads DATA_DIR at module evaluation time and lib/db uses it to
// build the DB path on first call to db().

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = mkdtempSync(join(tmpdir(), "wr-autonomy-test-"));
process.env.WAR_ROOM_DATA_DIR = TEST_DIR;

// Only import lib modules AFTER setting the env var
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAutonomyPolicy,
  computeAutonomyLevel,
  getAutonomyPolicyText,
  upsertAutonomyPolicy,
  isActionPermitted,
  quarantineDecision,
  resolveExpiredQuarantines,
} from "../lib/autonomy";

// ─── Tests ──────────────────────────────────────────────────────────────────

test("getAutonomyPolicy returns null for channel with no policy", () => {
  const policy = getAutonomyPolicy("nonexistent-channel");
  assert.equal(policy, null, "should return null when no policy exists");
});

test("computeAutonomyLevel returns 0 for channel with no contingencies", () => {
  const level = computeAutonomyLevel("nonexistent-channel");
  assert.equal(typeof level, "number", "should return a number");
  assert.equal(level, 0, "channel with no contingencies should be at level 0");
});

test("getAutonomyPolicyText returns a Spanish string even for channel with no policy", () => {
  const text = getAutonomyPolicyText("nonexistent-channel");
  assert.equal(typeof text, "string", "should return a string");
  assert.ok(text.length > 0, "text should not be empty");
  // The no-policy branch returns Spanish text about acting with caution
  assert.ok(
    text.includes("POLÍTICA") || text.includes("No hay política") || text.includes("precaución"),
    `should contain Spanish policy language; got: ${text}`,
  );
});

test("isActionPermitted returns true when policy has no cannotDo entries", () => {
  // Create a policy with only canDo items, nothing forbidden
  upsertAutonomyPolicy("ch-policy-open", {
    canDo: ["write files", "read files"],
    cannotDo: [],
    escalate: [],
    uncertaintyThreshold: 0.7,
  });

  const result = isActionPermitted("ch-policy-open", "write a file");
  assert.equal(result, true, "should be permitted when cannotDo is empty");
});

test("isActionPermitted returns false when action matches cannotDo entry", () => {
  // Create a policy that explicitly forbids "delete"
  upsertAutonomyPolicy("ch-policy-restricted", {
    canDo: ["write files", "read files"],
    cannotDo: ["delete"],
    escalate: [],
    uncertaintyThreshold: 0.7,
  });

  const result = isActionPermitted("ch-policy-restricted", "delete everything");
  assert.equal(result, false, 'action containing "delete" should be denied when delete is in cannotDo');
});

test("isActionPermitted returns true for safe action with restricted policy", () => {
  // Reuse the restricted policy from above — a safe action should still pass
  const result = isActionPermitted("ch-policy-restricted", "write a file");
  assert.equal(result, true, "safe action should be permitted even with a restricted policy");
});

test("quarantineDecision returns a numeric id", () => {
  const id = quarantineDecision(
    "ch-quarantine",
    "Deberia borrar el archivo?",
    "no",
    60_000,
  );
  assert.equal(typeof id, "number", "should return a number");
  assert.ok(id > 0, "returned id should be a positive integer");
});

test("resolveExpiredQuarantines returns an array", () => {
  const results = resolveExpiredQuarantines();
  assert.ok(Array.isArray(results), "should return an array");
  // May be empty if no quarantines have expired yet — that's fine
});

test("resolveExpiredQuarantines resolves expired quarantine and returns it", () => {
  // Create a quarantine that expires immediately (0ms from now)
  const id = quarantineDecision(
    "ch-expired",
    "Que accion tomar?",
    "esperar",
    0, // expires immediately
  );
  assert.ok(id > 0, "setup: quarantine id should be positive");

  // Give it a tiny delay to ensure expires_at <= now
  // (0ms expiry means expires_at = Date.now() at creation, which is <= Date.now() now)
  const results = resolveExpiredQuarantines();
  assert.ok(Array.isArray(results), "should return an array");

  const resolved = results.find((r) => r.question === "Que accion tomar?");
  assert.ok(resolved !== undefined, "the expired quarantine should appear in resolved list");
  assert.equal(resolved?.resolution, "esperar", "resolution should match the default_answer");
});
