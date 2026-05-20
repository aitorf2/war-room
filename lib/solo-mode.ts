import { emitChannelEvent } from "./event-emitter";

// WHY: Solo mode is intentionally ephemeral — it lives only for the
// duration of the current session. Persisting it to DB would require
// cleanup on crash/restart and adds complexity for a focus utility
// that users expect to reset naturally on reload.
let _soloChannel: string | null = null;

export function setSoloChannel(channelId: string): void {
  _soloChannel = channelId;
  emitChannelEvent(channelId, "phase_changed", { mode: "solo" });
}

export function clearSoloChannel(): void {
  _soloChannel = null;
}

export function getSoloChannel(): string | null {
  return _soloChannel;
}

export function isBackgrounded(channelId: string): boolean {
  return _soloChannel !== null && _soloChannel !== channelId;
}

export function getSoloModeText(): string {
  if (_soloChannel === null) {
    return "Modo solo desactivado.";
  }
  return `Modo solo activo en canal ${_soloChannel}.`;
}
