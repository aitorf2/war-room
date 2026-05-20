// Notification dispatch helpers — thin wrapper over emitChannelEvent that
// adds typed payloads for the most common notification scenarios.

import { emitChannelEvent, type ChannelEventType } from "./event-emitter";

export interface NotificationPayload {
  message: string;
  severity?: "info" | "warning" | "error";
  meta?: Record<string, unknown>;
}

/** Generic notification dispatch that maps a high-level notification to a
 *  channel event. Consumers (client SSE, webhooks) subscribe to channel_events
 *  for real-time delivery. */
export function dispatchEvent(
  channelId: string,
  eventType: ChannelEventType,
  payload: NotificationPayload,
) {
  emitChannelEvent(channelId, eventType, {
    message: payload.message,
    severity: payload.severity ?? "info",
    ...payload.meta,
  });
}

/** Convenience: notify that an autonomous turn was injected. */
export function notifyAutonomyStarted(channelId: string, prompt: string) {
  dispatchEvent(channelId, "autonomy_started", {
    message: `Autonomous turn injected for channel ${channelId}`,
    severity: "info",
    meta: { promptPreview: prompt.slice(0, 120) },
  });
}

/** Convenience: notify that the andon cord was pulled (quality failure). */
export function notifyAndonPulled(channelId: string, failedCriterion: string) {
  dispatchEvent(channelId, "andon_pulled", {
    message: `Quality criterion failed — agent self-stopped`,
    severity: "warning",
    meta: { failedCriterion },
  });
}

/** Convenience: notify budget exhaustion. */
export function notifyBudgetExhausted(
  channelId: string,
  tokensUsed: number,
  elapsedSecs: number,
) {
  dispatchEvent(channelId, "budget_exhausted", {
    message: `Mission budget exhausted — completing with summary`,
    severity: "info",
    meta: { tokensUsed, elapsedSecs },
  });
}
