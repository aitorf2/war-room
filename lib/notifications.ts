import { execSync } from "child_process";

export type ChannelStatus = 0 | 1 | 2; // idle | working | needs-attention

// Maps status codes to macOS system sounds (available in /System/Library/Sounds/)
const STATUS_SOUNDS: Record<ChannelStatus, string> = {
  0: "Glass",    // idle / completed
  1: "Tink",     // working / in progress
  2: "Sosumi",   // needs attention / blocked
};

export type EventType =
  | "agent_completed"
  | "agent_blocked"
  | "agent_error"
  | "agent_waiting_decision"
  | "autonomy_started"
  | "andon_pulled"
  | "testament_written"
  | "velocity_alert";

const EVENT_STATUS: Record<EventType, ChannelStatus> = {
  agent_completed: 0,
  agent_blocked: 2,
  agent_error: 2,
  agent_waiting_decision: 2,
  autonomy_started: 1,
  andon_pulled: 2,
  testament_written: 0,
  velocity_alert: 2,
};

const EVENT_TITLES: Record<EventType, string> = {
  agent_completed: "— Listo",
  agent_blocked: "— Bloqueado",
  agent_error: "— Error",
  agent_waiting_decision: "— Decisión requerida",
  autonomy_started: "— Trabajando solo",
  andon_pulled: "— Agente parado (calidad)",
  testament_written: "— Sesión cerrada",
  velocity_alert: "— Ritmo cayendo",
};

/** Play the appropriate system sound for a channel state.
 *  Uses afplay which is always available on macOS and works without screen. */
export function playChannelSound(status: ChannelStatus): void {
  const sound = STATUS_SOUNDS[status];
  try {
    execSync(`afplay /System/Library/Sounds/${sound}.aiff`, { timeout: 3000 });
  } catch {
    // afplay unavailable in test env — ignore silently
  }
}

/** Fire a macOS notification via osascript (VoiceOver reads these automatically). */
export function sendMacNotification(title: string, body: string): void {
  const escaped = (s: string) => s.replace(/"/g, '\\"').replace(/\n/g, " ");
  try {
    execSync(
      `osascript -e 'display notification "${escaped(body)}" with title "${escaped(title)}"'`,
      { timeout: 3000 },
    );
  } catch {
    // osascript unavailable in test env — ignore silently
  }
}

/** Process a typed event from channel_events table:
 *  play sound + show notification. */
export function dispatchEvent(
  eventType: EventType,
  channelName: string,
  detail?: string,
): void {
  const status = EVENT_STATUS[eventType] ?? 2;
  playChannelSound(status);

  const suffix = EVENT_TITLES[eventType] ?? "";
  const title = `${channelName} ${suffix}`.trim();
  sendMacNotification(title, detail ?? "");
}

export function notifyAndonPulled(channelId: string, reason: string): void {
  dispatchEvent("andon_pulled", channelId, reason);
}

export function notifyBudgetExhausted(
  channelId: string,
  tokensUsed: number,
  elapsedSecs: number,
): void {
  const mins = Math.round(elapsedSecs / 60);
  dispatchEvent(
    "agent_completed",
    channelId,
    `Presupuesto agotado: ${tokensUsed} tokens, ${mins} minutos`,
  );
}
