"use client";

import { useEffect, useRef, useState } from "react";
import {
  Hash,
  Pin,
  Bell,
  Users,
  Search,
  Lock,
  Paperclip,
  Bot,
  Check,
  Sparkles,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import type { Channel } from "@/lib/channels";
import { FilesPanel } from "./files-panel";
import { t } from "@/lib/i18n/es";

type AdapterMeta = {
  id: string;
  name: string;
  kind: "cli" | "api";
  isConfigured: boolean;
};

type CatalogAgent = {
  id: string;
  name: string;
  description: string;
  model?: string;
};

export function ChannelHeader({
  channel,
  onToggleRight,
}: {
  channel: Channel;
  onToggleRight?: () => void;
}) {
  const [filesOpen, setFilesOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  // Only show the agent chip on channels that actually fire chat. Pinning
  // an AI on a system surface (activity, services, approvals…) doesn't do
  // anything because those don't talk to the agent layer.
  const showAgentChip = channel.kind === "chat";

  return (
    <div className="relative h-12 bg-neutral-950 px-5 flex items-center gap-3 sticky top-0 z-10">
      {channel.isPrivate ? (
        <Lock className="w-4 h-4 text-amber-300" />
      ) : (
        <Hash className="w-4 h-4 text-neutral-500" />
      )}
      <div className="text-sm font-medium">{channel.name}</div>
      {channel.isPrivate && (
        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {t.header.privateChannel}
        </span>
      )}
      {channel.description && (
        <div className="text-xs text-neutral-400 truncate hidden md:block max-w-md">
          <span className="text-neutral-700">·</span> {channel.description}
        </div>
      )}
      {!channel.description && channel.projectPath && (
        <div className="text-xs text-neutral-500 truncate hidden md:block">
          <span className="text-neutral-700">·</span>{" "}
          <code className="text-neutral-500">{channel.projectPath}</code>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1 text-neutral-500">
        {showAgentChip && (
          <AgentChip
            channelId={channel.id}
            pinned={channel.agentBackend ?? null}
            contextMode={channel.contextMode ?? "isolated"}
            contextMessages={channel.contextMessages ?? 15}
            contextChars={channel.contextChars ?? 3000}
            frameworkPin={channel.frameworkPreset ?? null}
          />
        )}
        {channel.projectPath && (
          <OpenInEditorBtn projectPath={channel.projectPath} />
        )}
        <IconBtn title={t.header.files} onClick={() => setFilesOpen(true)}>
          <Paperclip className="w-4 h-4" aria-hidden />
        </IconBtn>
        <div className="relative">
          <IconBtn title={t.header.pinned} onClick={() => setPinnedOpen((v) => !v)}>
            <Pin className="w-4 h-4" aria-hidden />
          </IconBtn>
          {pinnedOpen && (
            <PinnedPopover channelId={channel.id} onClose={() => setPinnedOpen(false)} />
          )}
        </div>
        <IconBtn title={t.header.notifications}><Bell className="w-4 h-4" aria-hidden /></IconBtn>
        <IconBtn title={t.header.members} onClick={onToggleRight}><Users className="w-4 h-4" aria-hidden /></IconBtn>
        <div className="relative ml-2">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600" aria-hidden />
          <input
            aria-label={t.header.searchChannels}
            placeholder={t.header.searchChannels}
            className="w-44 bg-neutral-900 border border-neutral-800 rounded-md text-xs pl-7 pr-2 py-1 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>
      <span aria-hidden className="hairline-h bottom" />
      {filesOpen && (
        <FilesPanel
          channelId={channel.id}
          channelName={channel.name}
          onClose={() => setFilesOpen(false)}
        />
      )}
    </div>
  );
}

function PinnedPopover({
  channelId,
  onClose,
}: {
  channelId: string;
  onClose: () => void;
}) {
  type Pinned = {
    id: number;
    channel_id: string;
    role: string;
    content: string;
    agent_id: string | null;
    pinned_by: string;
    pinned_at: number;
    original_created_at: number;
  };
  const [items, setItems] = useState<Pinned[] | null>(null);

  const load = () => {
    fetch(`/api/pinned?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d: { items: Pinned[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ channelId?: string }>;
      if (!ce.detail?.channelId || ce.detail.channelId === channelId) load();
    };
    window.addEventListener("war-room:pinned-changed", onChange);
    return () => window.removeEventListener("war-room:pinned-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const remove = async (id: number) => {
    setItems((cur) => (cur ? cur.filter((x) => x.id !== id) : cur));
    await fetch("/api/pinned", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-40 w-96 max-h-[60vh] bg-[#0d0d0f] border border-neutral-800 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-amber-400" aria-hidden />
          <span className="text-xs font-semibold text-neutral-200">{t.header.pinnedTitle}</span>
          <span className="ml-auto text-[10px] text-neutral-600" aria-hidden>
            {items === null ? "…" : `${items.length}`}
          </span>
        </div>
        <div className="overflow-y-auto flex-1" role="list" aria-label={t.header.pinnedTitle}>
          {items === null ? (
            <div className="p-4 text-xs text-neutral-600 italic">{t.header.pinnedLoading}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-xs text-neutral-600 italic">
              {t.header.pinnedEmpty}
            </div>
          ) : (
            items.map((p) => (
              <div
                key={p.id}
                className="px-3 py-2.5 border-b border-neutral-900 last:border-b-0 hover:bg-neutral-900/40 group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                    {p.role === "user" ? t.header.pinnedYou : p.agent_id ?? "agent"}
                  </span>
                  <button
                    onClick={() => remove(p.id)}
                    aria-label={t.header.pinnedUnpin}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-neutral-500 hover:text-red-300"
                  >
                    {t.header.pinnedUnpin}
                  </button>
                </div>
                <div className="text-xs text-neutral-300 whitespace-pre-wrap line-clamp-6">
                  {p.content}
                </div>
                <div className="text-[10px] text-neutral-600 mt-1">
                  {new Date(p.pinned_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="w-8 h-8 rounded-md hover:bg-neutral-900 hover:text-neutral-300 flex items-center justify-center"
    >
      {children}
    </button>
  );
}

// ─── Agent picker chip ───────────────────────────────────────────────────────
//
// Sits in the right-side action group of the channel header. Shows the
// currently-active backend for this channel (channel pin > global default)
// and opens a popover listing every adapter the user has wired up. Picking
// one writes a per-channel override; "Use default" clears the pin.

function AgentChip({
  channelId,
  pinned,
  contextMode,
  contextMessages,
  contextChars,
  frameworkPin,
}: {
  channelId: string;
  pinned: string | null;
  contextMode: "isolated" | "shared";
  contextMessages: number;
  contextChars: number;
  /** Channel-level framework override. null = inherit global default. */
  frameworkPin: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [adapters, setAdapters] = useState<AdapterMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("claude-cli");
  const [pin, setPin] = useState<string | null>(pinned);
  const [mode, setMode] = useState<"isolated" | "shared">(contextMode);
  const [msgBudget, setMsgBudget] = useState<number>(contextMessages);
  const [charBudget, setCharBudget] = useState<number>(contextChars);
  const [framework, setFramework] = useState<string | null>(frameworkPin);
  const [frameworkList, setFrameworkList] = useState<Array<{ id: string; name: string }>>([]);
  const [defaultFramework, setDefaultFramework] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Sub-agent catalog (only matters when primary is claude-cli)
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [subAgentId, setSubAgentId] = useState<string | null>(null);
  // Supervisor settings
  const [supervisorAgentId, setSupervisorAgentId] = useState<string | null>(null);
  const [supervisorEveryN, setSupervisorEveryN] = useState<number>(0);
  const [supervisorLoaded, setSupervisorLoaded] = useState(false);

  // React's "state derived from props" pattern: when the parent passes
  // different values (or the user navigates to another channel), reset
  // local state during render. Avoids the setState-in-effect cascade.
  const [prevPinned, setPrevPinned] = useState(pinned);
  const [prevChannelId, setPrevChannelId] = useState(channelId);
  const [prevContextMode, setPrevContextMode] = useState(contextMode);
  const [prevContextMessages, setPrevContextMessages] = useState(contextMessages);
  const [prevContextChars, setPrevContextChars] = useState(contextChars);
  const [prevFramework, setPrevFramework] = useState(frameworkPin);
  if (
    prevPinned !== pinned ||
    prevChannelId !== channelId ||
    prevContextMode !== contextMode ||
    prevContextMessages !== contextMessages ||
    prevContextChars !== contextChars ||
    prevFramework !== frameworkPin
  ) {
    setPrevPinned(pinned);
    setPrevChannelId(channelId);
    setPrevContextMode(contextMode);
    setPrevContextMessages(contextMessages);
    setPrevContextChars(contextChars);
    setPrevFramework(frameworkPin);
    setPin(pinned);
    setMode(contextMode);
    setMsgBudget(contextMessages);
    setCharBudget(contextChars);
    setFramework(frameworkPin);
    setSubAgentId(null);
    setSupervisorLoaded(false);
  }

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { activeId: string; adapters: AdapterMeta[] }) => {
        setAdapters(d.adapters ?? []);
        setActiveId(d.activeId);
      })
      .catch(() => {});
    fetch("/api/frameworks")
      .then((r) => r.json())
      .then((d: { frameworks: Array<{ id: string; name: string }>; defaultId: string | null }) => {
        setFrameworkList(d.frameworks ?? []);
        setDefaultFramework(d.defaultId ?? null);
      })
      .catch(() => {});
    fetch("/api/agents/catalog")
      .then((r) => r.json())
      .then((d: { agents: CatalogAgent[] }) => setCatalog(d.agents ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Load per-channel sub-agent and supervisor settings whenever channelId changes.
    setSupervisorLoaded(false);
    fetch(`/api/channel-sub-agent?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d: { subAgentId: string | null }) => setSubAgentId(d.subAgentId))
      .catch(() => {});
    fetch(`/api/supervisor?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d: { agentId: string | null; everyN: number }) => {
        setSupervisorAgentId(d.agentId);
        setSupervisorEveryN(d.everyN ?? 0);
        setSupervisorLoaded(true);
      })
      .catch(() => setSupervisorLoaded(true));
  }, [channelId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const effectiveId = pin ?? activeId;
  const effective = adapters.find((a) => a.id === effectiveId);
  const label = effective?.name ?? effectiveId;

  const setPinned = async (next: string | null) => {
    setSaving(true);
    setPin(next);
    try {
      await fetch("/api/channel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, backendId: next }),
      });
    } catch {
      // Best-effort. The pin will be re-fetched next time the channel loads.
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const persistContext = async (
    patch: Partial<{ mode: "isolated" | "shared"; messages: number; chars: number }>,
  ) => {
    try {
      await fetch("/api/channel-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, ...patch }),
      });
    } catch {
      // Best-effort. Picked up on next channel load.
    }
  };

  const persistSubAgent = async (next: string | null) => {
    setSubAgentId(next);
    try {
      await fetch("/api/channel-sub-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, subAgentId: next }),
      });
    } catch {}
  };

  const persistSupervisor = async (agentId: string | null, everyN: number) => {
    setSupervisorAgentId(agentId);
    setSupervisorEveryN(everyN);
    try {
      await fetch("/api/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, agentId, everyN }),
      });
    } catch {}
  };

  const persistFramework = async (next: string | null) => {
    setFramework(next);
    try {
      await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, presetId: next }),
      });
    } catch {
      // Best-effort. Picked up on next channel load.
    }
  };

  // Mid-conversation switches surface a confirmation modal explaining
  // that the next turn uses the new framework but existing context
  // stays as-is. The chip skips the modal on initial set (when no
  // framework was previously pinned and global default was implicit).
  const [pendingFw, setPendingFw] = useState<string | null | "__sentinel__">("__sentinel__");
  const requestFrameworkChange = (next: string | null) => {
    if (framework === next) return;
    // First-touch on this channel (no existing pin), no modal needed.
    if (framework === null && next === null) return;
    setPendingFw(next);
  };
  const confirmFrameworkChange = () => {
    if (pendingFw === "__sentinel__") return;
    void persistFramework(pendingFw);
    setPendingFw("__sentinel__");
  };
  const cancelFrameworkChange = () => setPendingFw("__sentinel__");

  const ready = effective?.isConfigured ?? false;

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={pin ? t.header.agentChipPinned(label) : t.header.agentChipDefault(label)}
        title={pin ? t.header.agentChipPinned(label) : t.header.agentChipDefault(label)}
        className={`flex items-center gap-1.5 px-2 h-7 rounded-md border text-[11px] transition-colors ${
          pin
            ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
        } ${saving ? "opacity-60" : ""}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-neutral-700"}`}
        />
        <Bot className="w-3 h-3" />
        <span className="max-w-[8rem] truncate">{label}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.header.agentChipOpen}
          className="absolute right-0 top-full mt-1 z-30 w-72 bg-[#0d0d0f] border border-neutral-800 rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800 flex items-center gap-1.5" aria-hidden>
            <Sparkles className="w-3 h-3 text-amber-400" />
            {t.header.primaryAI}
          </div>
          <button
            onClick={() => setPinned(null)}
            aria-pressed={!pin}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-neutral-900 ${
              !pin ? "bg-neutral-900/80" : ""
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-neutral-200">{t.header.useGlobalDefault}</div>
              <div className="text-[10px] text-neutral-500 truncate">
                {adapters.find((a) => a.id === activeId)?.name ?? activeId}
              </div>
            </div>
            {!pin && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden />}
          </button>
          <div className="border-t border-neutral-900" />
          <div className="max-h-72 overflow-y-auto" role="list" aria-label={t.header.primaryAI}>
            {adapters.map((a) => {
              const isPinned = pin === a.id;
              return (
                <button
                  key={a.id}
                  role="listitem"
                  onClick={() => setPinned(a.id)}
                  aria-pressed={isPinned}
                  aria-label={`${a.name}, ${a.isConfigured ? t.header.agentChipConfigured : t.header.agentChipNotConfigured}${isPinned ? ", seleccionado" : ""}`}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-neutral-900 ${
                    isPinned ? "bg-neutral-900/80" : ""
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      a.isConfigured ? "bg-emerald-500" : "bg-neutral-700"
                    }`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-neutral-200 truncate">{a.name}</div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                      {a.kind === "cli" ? t.header.cliBridge : t.header.apiDirect}
                    </div>
                  </div>
                  {isPinned && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-neutral-900 text-[10px] text-neutral-600 leading-snug">
            {t.header.primaryHint}
          </div>
          {adapters.length > 0 && (
            <div className="px-3 py-2 border-t border-neutral-900">
              <div className="text-[9px] uppercase tracking-wider text-neutral-600 mb-1.5" aria-hidden>
                {t.header.mentionHandles}
              </div>
              <div className="flex flex-wrap gap-1" aria-label={t.header.mentionHandles}>
                {adapters.map((a) => {
                  const stem = a.id.replace(/-(cli|api)$/i, "");
                  const collides = adapters.filter(
                    (x) => x.id.replace(/-(cli|api)$/i, "") === stem,
                  ).length > 1;
                  const handle = collides ? `${stem}.${a.kind}` : stem;
                  return (
                    <span
                      key={a.id}
                      aria-label={`@${handle}, ${a.isConfigured ? t.header.agentChipConfigured : t.header.agentChipNotConfigured}`}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        a.isConfigured
                          ? "bg-neutral-800 text-neutral-300"
                          : "bg-neutral-900 text-neutral-600 line-through"
                      }`}
                    >
                      @{handle}
                    </span>
                  );
                })}
              </div>
              <div className="text-[9px] text-neutral-700 mt-1.5 leading-snug">
                {t.header.mentionHint}
              </div>
            </div>
          )}

          <div className="px-3 py-2 border-t border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5" aria-hidden>
            <Sparkles className="w-3 h-3 text-amber-400" />
            {t.header.crossAgentContext}
          </div>
          <div className="px-3 py-2 flex flex-col gap-2" role="group" aria-label={t.header.crossAgentContext}>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  setMode("isolated");
                  void persistContext({ mode: "isolated" });
                }}
                aria-pressed={mode === "isolated"}
                className={`flex-1 px-2 py-1.5 text-[11px] rounded border transition-colors ${
                  mode === "isolated"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                }`}
              >
                {t.header.contextIsolated}
              </button>
              <button
                onClick={() => {
                  setMode("shared");
                  void persistContext({ mode: "shared" });
                }}
                aria-pressed={mode === "shared"}
                className={`flex-1 px-2 py-1.5 text-[11px] rounded border transition-colors ${
                  mode === "shared"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                }`}
              >
                {t.header.contextShared}
              </button>
            </div>
            <div className="text-[10px] text-neutral-600 leading-snug">
              <strong className="text-neutral-500">{t.header.contextIsolated}</strong>: {t.header.contextIsolatedHint}{" "}
              <strong className="text-neutral-500">{t.header.contextShared}</strong>: {t.header.contextSharedHint}{" "}
              <code className="text-neutral-500">@handle</code>.
            </div>
            {mode === "shared" && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <BudgetField
                  label={t.header.contextMaxMessages}
                  value={msgBudget}
                  min={1}
                  max={200}
                  onCommit={(v) => {
                    setMsgBudget(v);
                    void persistContext({ messages: v });
                  }}
                />
                <BudgetField
                  label={t.header.contextMaxChars}
                  value={charBudget}
                  min={100}
                  max={50_000}
                  step={100}
                  onCommit={(v) => {
                    setCharBudget(v);
                    void persistContext({ chars: v });
                  }}
                />
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/openwar-logo.svg" alt="" className="w-3 h-3" />
            {t.header.agentFramework}
          </div>
          <div className="px-3 py-2 flex flex-col gap-2">
            <select
              aria-label={t.header.frameworkSelectLabel}
              value={framework ?? "__inherit__"}
              onChange={(e) => {
                const v = e.target.value;
                const next = v === "__inherit__" ? null : v;
                requestFrameworkChange(next);
              }}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-neutral-700"
            >
              <option value="__inherit__">
                {t.header.frameworkInherit(
                  defaultFramework
                    ? (frameworkList.find((f) => f.id === defaultFramework)?.name ?? defaultFramework)
                    : ""
                )}
              </option>
              <option value="none">{t.header.frameworkNone}</option>
              {frameworkList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-neutral-600 leading-snug">
              {t.header.frameworkHint}{" "}
              <code className="text-neutral-500">presets/frameworks/</code>.
            </div>
          </div>

          <div className="px-3 py-2 border-t border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500" aria-hidden>
            {t.header.warRoomPrimer}
          </div>
          <div className="px-3 py-2">
            <PrimerToggle channelId={channelId} />
          </div>

          {/* Sub-agent picker: only useful when primary adapter is claude-cli */}
          {(pin === "claude-cli" || (!pin && activeId === "claude-cli")) && catalog.length > 0 && (
            <>
              <div className="px-3 py-2 border-t border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5" aria-hidden>
                <Bot className="w-3 h-3 text-sky-400" />
                {t.header.claudeSubAgent}
              </div>
              <div className="px-3 py-2 flex flex-col gap-2">
                <select
                  aria-label={t.header.subAgentSelectLabel}
                  value={subAgentId ?? "__none__"}
                  onChange={(e) => {
                    const v = e.target.value;
                    void persistSubAgent(v === "__none__" ? null : v);
                  }}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-neutral-700"
                >
                  <option value="__none__">{t.header.subAgentClaudePicks}</option>
                  {catalog.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id}
                    </option>
                  ))}
                </select>
                {subAgentId && catalog.find((a) => a.id === subAgentId)?.description && (
                  <div className="text-[10px] text-neutral-600 leading-snug">
                    {catalog.find((a) => a.id === subAgentId)?.description}
                  </div>
                )}
                <div className="text-[10px] text-neutral-600 leading-snug">
                  {t.header.subAgentHint}
                </div>
              </div>
            </>
          )}

          {/* Supervisor: lightweight meta-agent watching the channel */}
          <div className="px-3 py-2 border-t border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5" aria-hidden>
            <Sparkles className="w-3 h-3 text-violet-400" />
            {t.header.supervisorSection}
          </div>
          <div className="px-3 py-2 flex flex-col gap-2" role="group" aria-label={t.header.supervisorSection}>
            <div className="flex items-center gap-2">
              <select
                disabled={!supervisorLoaded}
                aria-label={t.header.supervisorSelectLabel}
                value={supervisorAgentId ?? "__none__"}
                onChange={(e) => {
                  const v = e.target.value;
                  void persistSupervisor(v === "__none__" ? null : v, supervisorEveryN);
                }}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-neutral-700"
              >
                <option value="__none__">{t.header.supervisorDisabled}</option>
                {catalog.length > 0 ? (
                  catalog.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id}
                    </option>
                  ))
                ) : (
                  <option value="meta-analyzer">meta-analyzer</option>
                )}
              </select>
              {supervisorAgentId && (
                <BudgetField
                  label={t.header.supervisorEveryNLabel}
                  value={supervisorEveryN || 5}
                  min={1}
                  max={50}
                  onCommit={(v) => void persistSupervisor(supervisorAgentId, v)}
                />
              )}
            </div>
            <div className="text-[10px] text-neutral-600 leading-snug">
              {supervisorAgentId
                ? t.header.supervisorActiveHint(supervisorAgentId, supervisorEveryN || 5)
                : t.header.supervisorInactiveHint}
            </div>
          </div>
        </div>
      )}

      {pendingFw !== "__sentinel__" && (
        <FrameworkSwitchModal
          fromId={framework}
          toId={pendingFw}
          adapters={frameworkList}
          onCancel={cancelFrameworkChange}
          onConfirm={confirmFrameworkChange}
        />
      )}
    </div>
  );
}

function PrimerToggle({ channelId }: { channelId: string }) {
  const [pin, setPin] = useState<boolean | null>(null);
  const [effective, setEffective] = useState<boolean>(true);
  const [defaultEnabled, setDefaultEnabled] = useState<boolean>(true);
  const [primerLoaded, setPrimerLoaded] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/primer?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then(
        (d: {
          channelPin: boolean | null;
          effective: boolean;
          defaultEnabled: boolean;
          primerLoaded: boolean;
        }) => {
          setPin(d.channelPin);
          setEffective(d.effective);
          setDefaultEnabled(d.defaultEnabled);
          setPrimerLoaded(d.primerLoaded);
          setLoaded(true);
        },
      )
      .catch(() => setLoaded(true));
  }, [channelId]);

  const choose = async (next: boolean | null) => {
    setPin(next);
    setEffective(next === null ? defaultEnabled : next);
    await fetch("/api/primer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, enabled: next }),
    });
  };

  const value = pin === null ? "__inherit__" : pin ? "on" : "off";

  return (
    <div className="flex flex-col gap-2">
      <select
        disabled={!loaded || !primerLoaded}
        aria-label={t.header.primerSelectLabel}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          choose(v === "__inherit__" ? null : v === "on");
        }}
        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-neutral-700"
      >
        <option value="__inherit__">{t.header.primerInherit(defaultEnabled)}</option>
        <option value="on">{t.header.primerOn}</option>
        <option value="off">{t.header.primerOff}</option>
      </select>
      <div className="text-[10px] text-neutral-600 leading-snug">
        {primerLoaded ? (
          <>
            <strong className={effective ? "text-emerald-400" : "text-neutral-400"}>
              {effective ? t.header.primerOnDesc : t.header.primerOffDesc}
            </strong>{" "}
            {effective ? t.header.primerHintOn : t.header.primerHintOff}
          </>
        ) : (
          <span className="text-amber-400">{t.header.primerMissing}</span>
        )}
      </div>
    </div>
  );
}

function FrameworkSwitchModal({
  fromId,
  toId,
  adapters,
  onCancel,
  onConfirm,
}: {
  fromId: string | null;
  toId: string | null;
  adapters: Array<{ id: string; name: string }>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = (id: string | null) => {
    if (id === null) return t.header.frameworkInheritLabel;
    if (id === "none") return t.header.frameworkNoneLabel;
    return adapters.find((a) => a.id === id)?.name ?? id;
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);
  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={t.header.frameworkSwitchTitle}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <h2 className="text-lg font-semibold mb-2">{t.header.frameworkSwitchTitle}</h2>
        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
          {t.header.frameworkSwitchBody(label(fromId), label(toId))}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-md border border-neutral-800 hover:bg-neutral-900"
          >
            {t.header.frameworkSwitchCancel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
          >
            {t.header.frameworkSwitchConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Open-in-editor button ───────────────────────────────────────────────────
//
// Sits next to the agent chip when the channel has a projectPath.
// Probes available editors once on mount; clicking opens the project folder
// in the first editor found (Antigravity > Cursor > VS Code > Windsurf > Zed).

function OpenInEditorBtn({ projectPath }: { projectPath: string }) {
  const [editorName, setEditorName] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fs/open-editor")
      .then((r) => r.json())
      .then((d: { editors: Array<{ name: string }> }) => {
        setEditorName(d.editors[0]?.name ?? null);
      })
      .catch(() => {});
  }, []);

  if (!editorName) return null;

  const open = async () => {
    setOpening(true);
    setError(null);
    try {
      const r = await fetch("/api/fs/open-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: projectPath }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? "Could not open editor");
      }
    } catch {
      setError("Could not open editor");
    } finally {
      setOpening(false);
    }
  };

  return (
    <IconBtn
      title={error ? t.header.openInEditorFailed : t.header.openInEditor(editorName)}
      onClick={opening ? undefined : open}
    >
      <FolderOpen className={`w-4 h-4 ${error ? "text-red-400" : ""}`} aria-hidden />
    </IconBtn>
  );
}

function BudgetField({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  // Sync local input when the parent value changes (e.g. switching channels).
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(String(value));
  }
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) return setDraft(String(value));
    const clamped = Math.max(min, Math.min(max, Math.round(n / step) * step));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-neutral-700"
      />
    </label>
  );
}
