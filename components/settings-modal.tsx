"use client";

// Settings modal, tabbed surface for everything that doesn't deserve its own
// top-level surface. Triggered by the rail's settings gear (and the cloud
// button, which opens directly on the Sync tab).

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  ChevronDown,
  Cloud,
  Info,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { UploadButton } from "@/components/upload-button";
import { HostingPanel } from "@/components/settings-hosting-panel";
import { JoinForm } from "@/components/settings-hosting-join-form";
import { modalProps } from "@/lib/a11y";
import { t } from "@/lib/i18n/es";

export type SettingsTab = "general" | "agent" | "sidebar" | "boardroom" | "sync" | "about";

type AboutInfo = { version: string; name: string; repo: string | null };

export function SettingsModal({
  initialTab = "general",
  onClose,
}: {
  initialTab?: SettingsTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [about, setAbout] = useState<AboutInfo | null>(null);

  useEffect(() => {
    fetch("/api/about")
      .then((r) => r.json())
      .then(setAbout)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        {...modalProps(t.settings.title)}
        className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-neutral-400" />
            <h2 className="text-lg font-semibold">{t.settings.title}</h2>
          </div>
          <button onClick={onClose} aria-label={t.settings.close} className="text-neutral-500 hover:text-neutral-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Tab rail */}
          <div className="w-48 shrink-0 border-r border-neutral-800 py-3 flex flex-col">
            <TabButton current={tab} value="general" icon={<SettingsIcon className="w-3.5 h-3.5" />} onSelect={setTab}>
              {t.settings.tabs.general}
            </TabButton>
            <TabButton current={tab} value="agent" icon={<Bot className="w-3.5 h-3.5" />} onSelect={setTab}>
              {t.settings.tabs.agent}
            </TabButton>
            <TabButton current={tab} value="sidebar" icon={<Users className="w-3.5 h-3.5" />} onSelect={setTab}>
              {t.settings.tabs.sidebar}
            </TabButton>
            <TabButton current={tab} value="boardroom" icon={<Users className="w-3.5 h-3.5" />} onSelect={setTab}>
              {t.settings.tabs.boardroom}
            </TabButton>
            <TabButton current={tab} value="sync" icon={<Cloud className="w-3.5 h-3.5" />} onSelect={setTab}>
              {t.settings.tabs.sync}
            </TabButton>
            <TabButton current={tab} value="about" icon={<Info className="w-3.5 h-3.5" />} onSelect={setTab}>
              {t.settings.tabs.about}
            </TabButton>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === "general" && <GeneralTab onClose={onClose} />}
            {tab === "agent" && <AgentTab />}
            {tab === "sidebar" && <SidebarTab />}
            {tab === "boardroom" && <BoardroomTab />}
            {tab === "sync" && <SyncTab />}
            {tab === "about" && <AboutTab about={about} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  current,
  value,
  icon,
  onSelect,
  children,
}: {
  current: SettingsTab;
  value: SettingsTab;
  icon: React.ReactNode;
  onSelect: (v: SettingsTab) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
        active ? "bg-neutral-900 text-neutral-100 border-l-2 border-amber-500" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-l-2 border-transparent"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function GeneralTab({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-6">
      <Section title="Tu perfil" description="Nombre mostrado + imagen de avatar. Se usa en todo el sistema: burbujas de chat, asiento en la sala de reuniones, panel lateral.">
        <ProfileEditorRow />
      </Section>

      <Section title="Configuración inicial" description="Vuelve a ejecutar el asistente de bienvenida para actualizar tu identidad, la ruta del CLI de Claude o la carpeta de proyectos.">
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("war-room:open-onboarding"));
            onClose();
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200"
        >
          <Sparkles aria-hidden="true" className="w-3.5 h-3.5 text-amber-300" />
          Volver a ejecutar el asistente
        </button>
      </Section>

      <Section title="Estado del asistente" description="Almacenado localmente en ~/.war-room/app.db. Usa el asistente para actualizar.">
        <OnboardingSummary />
      </Section>
    </div>
  );
}

function ProfileEditorRow() {
  const [displayName, setDisplayName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: { displayName: string; iconUrl: string }) => {
        setDisplayName(d.displayName);
        setIconUrl(d.iconUrl);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, iconUrl }),
      });
      window.dispatchEvent(new CustomEvent("war-room:identity-changed"));
    } finally {
      setSaving(false);
    }
  };

  const letter = displayName.trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex items-start gap-4">
      {iconUrl ? (
        <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-900 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xl font-semibold text-neutral-300 shrink-0">
          {letter}
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Nombre mostrado</div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!loaded}
            placeholder="Tu nombre"
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-700"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Imagen de avatar</div>
          <div className="flex items-center gap-2">
            <input
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              disabled={!loaded}
              placeholder="https://... or click Upload"
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-neutral-700"
            />
            <UploadButton onUploaded={(url) => setIconUrl(url)} disabled={!loaded} />
            {iconUrl && (
              <button
                onClick={() => setIconUrl("")}
                disabled={!loaded}
                className="text-[11px] text-neutral-500 hover:text-red-300"
                title="Borrar imagen"
              >
                borrar
              </button>
            )}
          </div>
          <div className="text-[10px] text-neutral-600 mt-1">
            Pega cualquier URL de imagen o sube desde tu ordenador. Si está en blanco se usa la inicial del nombre.
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={!loaded || saving}
            className="px-3 py-1.5 text-xs rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
          >
            {saving ? t.settings.saving : t.settings.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingSummary() {
  const [data, setData] = useState<Record<string, string | null> | null>(null);
  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d) => setData(d.settings))
      .catch(() => {});
  }, []);
  if (!data) return <div className="text-xs text-neutral-600">Cargando…</div>;
  return (
    <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono">
      <KV k="Identidad" v={data["onboarding.identity"]} />
      <KV k="Nombre mostrado" v={data["onboarding.displayName"]} />
      <KV
        k="Nombre del agente"
        v={
          data["onboarding.agentName"] ||
          (data["onboarding.displayName"]
            ? `${data["onboarding.displayName"]}-Agent`
            : null)
        }
      />
      <KV k="Claude CLI" v={data["onboarding.claudeBin"]} />
      <KV k="Carpeta de proyectos" v={data["onboarding.workspaceRoot"]} />
      <KV k="Sincronización" v={data["onboarding.syncOptIn"] === "1" ? "sí" : "no"} />
    </dl>
  );
}

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <>
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-neutral-300 truncate">{v || <span className="text-neutral-600">(sin definir)</span>}</dd>
    </>
  );
}

type AdapterMeta = {
  id: string;
  name: string;
  defaultName?: string;
  defaultIconUrl?: string | null;
  defaultAccent?: string | null;
  iconUrl?: string | null;
  accent?: string | null;
  kind: "cli" | "api";
  capabilities: { toolUse: boolean; memory: boolean; fileAccess: boolean; notes?: string };
  isConfigured: boolean;
};

type AgentSettings = {
  activeId: string;
  settings: Record<string, string | null>;
  adapters: AdapterMeta[];
};

function AgentTab() {
  const [data, setData] = useState<AgentSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: AgentSettings) => {
        setData(d);
        // Seed draft with the masked / current values so inputs are
        // controlled from the get-go.
        const seed: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.settings)) seed[k] = v ?? "";
        setDraft(seed);
      })
      .catch(() => {});
  }, []);

  if (!data) return <div className="text-xs text-neutral-600">Cargando…</div>;

  const set = (k: string, v: string) => setDraft((cur) => ({ ...cur, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      // Refresh to pick up isConfigured flips and re-mask secrets.
      const r = await fetch("/api/agents");
      const fresh = (await r.json()) as AgentSettings;
      setData(fresh);
      const seed: Record<string, string> = {};
      for (const [k, v] of Object.entries(fresh.settings)) seed[k] = v ?? "";
      setDraft(seed);
    } finally {
      setSaving(false);
    }
  };

  const cliAdapters = data.adapters.filter((a) => a.kind === "cli");
  const apiAdapters = data.adapters.filter((a) => a.kind === "api");

  // Backend pick auto-saves on click, no need for the user to scroll down
  // to "Save changes" just to switch which AI is in charge.
  const pickBackend = async (id: string) => {
    set("agent.backend", id);
    setData((cur) => (cur ? { ...cur, activeId: id } : cur));
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "agent.backend": id }),
      });
    } catch {
      // best-effort; user can still hit Save below if persistence fails
    }
  };

  const Card = ({ a }: { a: AdapterMeta }) => {
    const isActive = data.activeId === a.id;
    return (
      <button
        onClick={() => pickBackend(a.id)}
        className={`text-left p-3 rounded-lg border transition-colors ${
          isActive
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${a.isConfigured ? "bg-emerald-500" : "bg-neutral-700"}`}
            title={a.isConfigured ? "Configurado" : "Requiere configuración"}
          />
          <span className="text-sm font-medium text-neutral-100">{a.name}</span>
          {isActive && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 ml-auto">
              activo
            </span>
          )}
        </div>
        {a.capabilities.notes && (
          <div className="text-[11px] text-neutral-500 mt-1.5 leading-snug">{a.capabilities.notes}</div>
        )}
      </button>
    );
  };

  const refreshAdapters = async () => {
    const r = await fetch("/api/agents");
    const fresh = (await r.json()) as AgentSettings;
    setData(fresh);
  };

  const configuredForProfiles = data.adapters.filter((a) => a.isConfigured);

  return (
    <div className="space-y-6">
      {configuredForProfiles.length > 0 && (
        <Section
          title="Perfiles de agente"
          description="Cada agente configurado aparece en toda la app (burbujas de chat, asientos en la sala de reuniones, filas del panel lateral) con su nombre integrado, logo de marca y color de marca por defecto. Modifica cualquiera de ellos por agente aquí. Haz clic en un agente para expandirlo."
        >
          <div className="space-y-2">
            {configuredForProfiles.map((a) => (
              <ProfileEditor key={a.id} adapter={a} onSaved={refreshAdapters} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Backend" description="Elige cómo War Room se comunica con la IA. El puente CLI ejecuta el binario oficial en tu carpeta de proyecto (funcionalidad completa). El modo API llama al proveedor directamente (solo chat, sin herramientas, sin archivos de proyecto, sin memoria).">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Puente CLI, funcionalidad completa</div>
          <div className="grid grid-cols-2 gap-2">
            {cliAdapters.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">API directa BYOK, solo chat</div>
          <div className="grid grid-cols-2 gap-2">
            {apiAdapters.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Puente CLI, rutas de binarios" description="Reemplaza la búsqueda del ejecutable si el binario no está en tu PATH. Deja en blanco para usar el predeterminado.">
        <KVInput label="claude" value={draft["agent.cli.claude.bin"] ?? ""} onChange={(v) => set("agent.cli.claude.bin", v)} />
        <KVInput label="codex" value={draft["agent.cli.codex.bin"] ?? ""} onChange={(v) => set("agent.cli.codex.bin", v)} />
        <KVInput label="gemini" value={draft["agent.cli.gemini.bin"] ?? ""} onChange={(v) => set("agent.cli.gemini.bin", v)} />
        <KVInput label="openclaw" value={draft["agent.cli.openclaw.bin"] ?? ""} onChange={(v) => set("agent.cli.openclaw.bin", v)} />
        <KVInput label="hermes" value={draft["agent.cli.hermes.bin"] ?? ""} onChange={(v) => set("agent.cli.hermes.bin", v)} />
        <KVInput label="semaclaw" value={draft["agent.cli.semaclaw.bin"] ?? ""} onChange={(v) => set("agent.cli.semaclaw.bin", v)} />
        <KVInput label="custom binary" value={draft["agent.cli.custom.bin"] ?? ""} onChange={(v) => set("agent.cli.custom.bin", v)} placeholder="C:\path\to\your-cli.exe" />
        <KVInput label="custom args template" value={draft["agent.cli.custom.template"] ?? ""} onChange={(v) => set("agent.cli.custom.template", v)} placeholder='--prompt "{{prompt}}" --cwd "{{cwd}}"' />
      </Section>

      <Section title="Claves API (BYOK)" description="Las claves pegadas se almacenan en tu SQLite local (~/.war-room/app.db). Nunca salen de tu máquina.">
        <ApiPair
          name="Anthropic"
          keyValue={draft["agent.api.anthropic.key"] ?? ""}
          modelValue={draft["agent.api.anthropic.model"] ?? ""}
          modelPlaceholder="claude-sonnet-4-6"
          onKey={(v) => set("agent.api.anthropic.key", v)}
          onModel={(v) => set("agent.api.anthropic.model", v)}
        />
        <ApiPair
          name="OpenAI"
          keyValue={draft["agent.api.openai.key"] ?? ""}
          modelValue={draft["agent.api.openai.model"] ?? ""}
          modelPlaceholder="gpt-5"
          onKey={(v) => set("agent.api.openai.key", v)}
          onModel={(v) => set("agent.api.openai.model", v)}
        />
        <ApiPair
          name="Google Gemini"
          keyValue={draft["agent.api.gemini.key"] ?? ""}
          modelValue={draft["agent.api.gemini.model"] ?? ""}
          modelPlaceholder="gemini-2.5-pro"
          onKey={(v) => set("agent.api.gemini.key", v)}
          onModel={(v) => set("agent.api.gemini.model", v)}
        />
        <ApiPair
          name="xAI Grok"
          keyValue={draft["agent.api.grok.key"] ?? ""}
          modelValue={draft["agent.api.grok.model"] ?? ""}
          modelPlaceholder="grok-3"
          onKey={(v) => set("agent.api.grok.key", v)}
          onModel={(v) => set("agent.api.grok.model", v)}
        />
      </Section>

      <Section title="Endpoint compatible con OpenAI" description="Cualquier servicio que hable el protocolo OpenAI Chat Completions. Funciona con OpenRouter, Groq, Together, Mistral, DeepSeek, Ollama (http://localhost:11434/v1) y la mayoría de los demás.">
        <KVInput label="base URL" value={draft["agent.api.openai-compat.baseUrl"] ?? ""} onChange={(v) => set("agent.api.openai-compat.baseUrl", v)} placeholder="https://openrouter.ai/api/v1" />
        <KVInput label="api key" value={draft["agent.api.openai-compat.key"] ?? ""} onChange={(v) => set("agent.api.openai-compat.key", v)} secret />
        <KVInput label="model name" value={draft["agent.api.openai-compat.model"] ?? ""} onChange={(v) => set("agent.api.openai-compat.model", v)} placeholder="anthropic/claude-3.5-sonnet" />
      </Section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
        >
          {saving ? t.settings.saving : t.settings.saveChanges}
        </button>
      </div>
    </div>
  );
}

// Per-adapter profile editor. Collapsed by default so the Agent tab
// doesn't become a wall of cards; click the chevron / row to expand.
// Save writes to /api/agent-profiles; reset clears the row so the
// agent falls back to its built-in name + logo + brand accent.
const PRESET_ICONS = [
  { url: "/agent-logos/claude.png", label: "Claude" },
  { url: "/agent-logos/openai.jpg", label: "OpenAI" },
  { url: "/agent-logos/gemini.png", label: "Gemini" },
  { url: "/agent-logos/grok.svg", label: "Grok" },
  { url: "/agent-logos/hermes.png", label: "Hermes" },
  { url: "/agent-logos/openclaw.png", label: "OpenClaw" },
  { url: "/agent-logos/semaclaw.png", label: "SemaClaw" },
];

const ACCENT_OPTIONS: Array<{ value: string; label: string; swatch: string }> = [
  { value: "amber", label: "Ámbar", swatch: "bg-amber-500" },
  { value: "sky", label: "Cielo", swatch: "bg-sky-500" },
  { value: "emerald", label: "Esmeralda", swatch: "bg-emerald-500" },
  { value: "violet", label: "Violeta", swatch: "bg-violet-500" },
  { value: "fuchsia", label: "Fucsia", swatch: "bg-fuchsia-500" },
  { value: "rose", label: "Rosa", swatch: "bg-rose-500" },
];

function ProfileLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 font-medium">
      {children}
    </div>
  );
}

function ProfileEditor({
  adapter,
  onSaved,
}: {
  adapter: AdapterMeta;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [accent, setAccent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/agent-profiles?adapterId=${encodeURIComponent(adapter.id)}`)
      .then((r) => r.json())
      .then((d: { profile: { display_name: string | null; icon_url: string | null; accent: string | null } | null }) => {
        setName(d.profile?.display_name ?? "");
        setIconUrl(d.profile?.icon_url ?? "");
        setAccent(d.profile?.accent ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded, adapter.id]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/agent-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapterId: adapter.id,
          displayName: name,
          iconUrl,
          accent,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await fetch("/api/agent-profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapterId: adapter.id }),
      });
      setName("");
      setIconUrl("");
      setAccent("");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const effectiveAccent = accent || adapter.defaultAccent || "amber";
  const effectiveIcon = iconUrl || adapter.defaultIconUrl || null;

  return (
    <div className="border border-neutral-800 rounded-lg bg-neutral-900/30 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-neutral-900/60"
      >
        {effectiveIcon ? (
          <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-900 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={effectiveIcon} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`w-9 h-9 rounded-full border-2 border-${effectiveAccent}-500/40 bg-neutral-900 flex items-center justify-center shrink-0`}>
            <Bot className="w-4 h-4 text-neutral-500" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <div className="text-sm font-medium text-neutral-100 truncate">
            {name || adapter.defaultName || adapter.name}
          </div>
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
            {adapter.id}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-neutral-800 p-3 space-y-3">
          {!loaded ? (
            <div className="text-xs text-neutral-600 italic">Cargando…</div>
          ) : (
            <>
              <div>
                <ProfileLabel>Nombre mostrado</ProfileLabel>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={adapter.defaultName || adapter.name}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-neutral-700"
                />
                <div className="text-[10px] text-neutral-600 mt-1">
                  Deja en blanco para usar el nombre integrado.
                </div>
              </div>
              <div>
                <ProfileLabel>Logo</ProfileLabel>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    onClick={() => setIconUrl("")}
                    className={`relative w-11 h-11 rounded-full overflow-hidden border-2 bg-neutral-950 ${iconUrl === "" ? "border-amber-400" : "border-neutral-800 hover:border-neutral-700"}`}
                    title="Integrado"
                  >
                    {adapter.defaultIconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={adapter.defaultIconUrl} alt="" className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <Bot aria-hidden="true" className="w-4 h-4 text-neutral-500 m-auto" />
                    )}
                    <span className="absolute -bottom-3 left-0 right-0 text-[8px] text-neutral-500 text-center">integrado</span>
                  </button>
                  {PRESET_ICONS.map((p) => (
                    <button
                      key={p.url}
                      onClick={() => setIconUrl(p.url)}
                      title={p.label}
                      className={`w-11 h-11 rounded-full overflow-hidden border-2 bg-neutral-950 ${iconUrl === p.url ? "border-amber-400" : "border-neutral-800 hover:border-neutral-700"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    value={iconUrl.startsWith("/agent-logos/") ? "" : iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="O pega una URL (https://...)"
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-neutral-700"
                  />
                  <UploadButton onUploaded={(url) => setIconUrl(url)} />
                </div>
              </div>
              <div>
                <ProfileLabel>Color de acento</ProfileLabel>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAccent("")}
                    className={`px-2 py-1.5 rounded border text-[11px] ${accent === "" ? "border-amber-400 text-amber-200" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"}`}
                    title="Color de marca integrado"
                  >
                    integrado
                  </button>
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAccent(opt.value)}
                      title={opt.label}
                      className={`w-7 h-7 rounded-full border-2 ${opt.swatch} ${accent === opt.value ? "border-white" : "border-transparent hover:border-neutral-700"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-900">
                <button
                  onClick={reset}
                  disabled={saving}
                  className="text-[11px] text-neutral-500 hover:text-red-300 disabled:opacity-40"
                >
                  Restaurar valores integrados
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
                >
                  {saving ? t.settings.saving : t.settings.saveProfile}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KVInput({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-center mb-2">
      <span className="text-[11px] text-neutral-500 uppercase tracking-wider">{label}</span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-neutral-900 border border-neutral-800 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-neutral-700"
      />
    </div>
  );
}

function ApiPair({
  name,
  keyValue,
  modelValue,
  modelPlaceholder,
  onKey,
  onModel,
}: {
  name: string;
  keyValue: string;
  modelValue: string;
  modelPlaceholder: string;
  onKey: (v: string) => void;
  onModel: (v: string) => void;
}) {
  return (
    <div className="mb-3 p-3 rounded-md border border-neutral-800 bg-neutral-900/30">
      <div className="text-xs font-semibold text-neutral-200 mb-2">{name}</div>
      <KVInput label="api key" value={keyValue} onChange={onKey} secret />
      <KVInput label="model" value={modelValue} onChange={onModel} placeholder={modelPlaceholder} />
    </div>
  );
}

// Discord-style visual grouping for the right sidebar. Users create
// named, optionally colored "roles" and assign agents + humans to
// them. The right sidebar renders one section per role, with
// members grouped under it. Purely visual: zero impact on routing,
// agent behavior, or permissions.

type SidebarRole = { id: number; name: string; color: string | null; position: number };
type SidebarAssignment = { role_id: number; member_kind: string; member_id: string };
type SidebarMember = { kind: "agent" | "human"; id: string; name: string; iconUrl: string | null };

const ROLE_COLOR_OPTIONS: Array<{ value: string; label: string; swatch: string }> = [
  { value: "amber", label: "Ámbar", swatch: "bg-amber-500" },
  { value: "sky", label: "Cielo", swatch: "bg-sky-500" },
  { value: "emerald", label: "Esmeralda", swatch: "bg-emerald-500" },
  { value: "violet", label: "Violeta", swatch: "bg-violet-500" },
  { value: "fuchsia", label: "Fucsia", swatch: "bg-fuchsia-500" },
  { value: "rose", label: "Rosa", swatch: "bg-rose-500" },
  { value: "neutral", label: "Neutro", swatch: "bg-neutral-500" },
];

function SidebarTab() {
  const [roles, setRoles] = useState<SidebarRole[]>([]);
  const [assignments, setAssignments] = useState<SidebarAssignment[]>([]);
  const [members, setMembers] = useState<SidebarMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState<string>("neutral");

  const refresh = useCallback(async () => {
    const [r, a, p] = await Promise.all([
      fetch("/api/sidebar-roles").then((x) => x.json()),
      fetch("/api/agents").then((x) => x.json()),
      fetch("/api/profile").then((x) => x.json()),
    ]);
    setRoles(r.roles ?? []);
    setAssignments(r.assignments ?? []);
    const cfg = (a.adapters ?? []).filter((x: { isConfigured: boolean }) => x.isConfigured);
    const m: SidebarMember[] = [
      { kind: "human", id: "local", name: p.displayName || "You", iconUrl: p.iconUrl || null },
      ...cfg.map((x: { id: string; name: string; iconUrl: string | null }) => ({
        kind: "agent" as const,
        id: x.id,
        name: x.name,
        iconUrl: x.iconUrl,
      })),
    ];
    setMembers(m);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    await fetch("/api/sidebar-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: newRoleName.trim(), color: newRoleColor }),
    });
    setNewRoleName("");
    refresh();
  };

  const deleteRole = async (id: number) => {
    await fetch("/api/sidebar-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    refresh();
  };

  const renameRole = async (id: number, name: string) => {
    if (!name.trim()) return;
    await fetch("/api/sidebar-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, name: name.trim() }),
    });
    refresh();
  };

  const recolorRole = async (id: number, color: string) => {
    await fetch("/api/sidebar-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, color }),
    });
    refresh();
  };

  const assignMember = async (
    memberKind: "agent" | "human",
    memberId: string,
    roleId: number | null,
  ) => {
    await fetch("/api/sidebar-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", memberKind, memberId, roleId }),
    });
    refresh();
  };

  const roleOf = (kind: string, id: string): number | null => {
    return assignments.find((x) => x.member_kind === kind && x.member_id === id)?.role_id ?? null;
  };

  if (!loaded) return <div className="text-xs text-neutral-600">Cargando…</div>;

  return (
    <div className="space-y-6">
      <Section
        title="Grupos"
        description="Agrupaciones estilo Discord para el panel lateral. Crea un grupo (p. ej. 'Redacción', 'Vídeo', 'Ingeniería') y asigna agentes y personas abajo. Los miembros sin grupo van a la sección 'Miembros' por defecto."
      >
        <div className="space-y-2">
          {roles.length === 0 && (
            <div className="text-xs text-neutral-600 italic">Sin grupos aún. Crea uno abajo.</div>
          )}
          {roles.map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              onRename={(n) => renameRole(r.id, n)}
              onRecolor={(c) => recolorRole(r.id, c)}
              onDelete={() => deleteRole(r.id)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-neutral-900 mt-3">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createRole()}
            placeholder="Nombre del nuevo grupo..."
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-neutral-700"
          />
          <select
            value={newRoleColor}
            onChange={(e) => setNewRoleColor(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-neutral-700"
          >
            {ROLE_COLOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={createRole}
            disabled={!newRoleName.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
          >
            Añadir grupo
          </button>
        </div>
      </Section>

      <Section
        title="Asignar miembros"
        description="Elige a qué grupo pertenece cada agente y persona. 'Sin asignar' va a la sección 'Miembros' por defecto."
      >
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={`${m.kind}-${m.id}`}
              className="flex items-center gap-3 p-2 rounded-md border border-neutral-800 bg-neutral-900/30"
            >
              {m.iconUrl ? (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-900 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.iconUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] uppercase font-semibold text-neutral-300 shrink-0">
                  {m.name[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-neutral-100 truncate">{m.name}</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">{m.kind}</div>
              </div>
              <select
                value={roleOf(m.kind, m.id) ?? ""}
                onChange={(e) =>
                  assignMember(
                    m.kind,
                    m.id,
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-neutral-700"
              >
                <option value="">Sin asignar</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function RoleCard({
  role,
  onRename,
  onRecolor,
  onDelete,
}: {
  role: SidebarRole;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(role.name);
  const swatch =
    ROLE_COLOR_OPTIONS.find((o) => o.value === (role.color ?? "neutral"))?.swatch ?? "bg-neutral-500";
  return (
    <div className="flex items-center gap-3 p-2 rounded-md border border-neutral-800 bg-neutral-900/30">
      <span className={`w-3 h-3 rounded-full ${swatch} shrink-0`} />
      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft !== role.name) onRename(draft.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(role.name);
              setEditing(false);
            }
          }}
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-neutral-700"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(role.name);
            setEditing(true);
          }}
          className="flex-1 text-left text-sm text-neutral-100 hover:text-amber-300"
        >
          {role.name}
        </button>
      )}
      <select
        value={role.color ?? "neutral"}
        onChange={(e) => onRecolor(e.target.value)}
        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-neutral-700"
      >
        {ROLE_COLOR_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (confirm(`¿Eliminar el grupo "${role.name}"? Los miembros quedarán sin asignar.`)) onDelete();
        }}
        className="text-[11px] text-neutral-500 hover:text-red-300"
      >
        eliminar
      </button>
    </div>
  );
}

function BoardroomTab() {
  return (
    <div className="space-y-6">
      <Section title="Dispositivos" description="Cámara y micrófono predeterminados para la sala de reuniones. Por ahora se seleccionan en la pantalla de entrada cada vez que inicias una reunión.">
        <div className="text-xs text-neutral-500 italic">
          Configuración predeterminada de dispositivos, próximamente.
        </div>
      </Section>
      <Section title="Mini flotante" description="La barra siempre visible que aparece cuando cambias de pestaña durante una llamada.">
        <div className="text-xs text-neutral-400">
          Actualmente activado. Para ocultarlo durante una reunión, haz clic en la × de la propia barra.
          Se vuelve a abrir automáticamente la próxima vez que cambies de pestaña.
        </div>
      </Section>
    </div>
  );
}

type SyncStatusPayload = {
  state: "disabled" | "connecting" | "open" | "closed" | "error";
  url: string;
  workspaceId: string;
  lastSeen: number;
  lastEventAt: number | null;
  lastError: string | null;
  clientId: string;
};

function SyncTab() {
  const [syncUrl, setSyncUrl] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SyncStatusPayload | null>(null);

  const refreshStatus = useCallback(() => {
    fetch("/api/sync/status")
      .then((r) => r.json())
      .then((d: SyncStatusPayload) => setStatus(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d: { settings: Record<string, string | null> }) => {
        setSyncUrl(d.settings["onboarding.syncUrl"] ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    refreshStatus();
    const t = setInterval(refreshStatus, 5_000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncUrl, syncOptIn: !!syncUrl.trim() }),
      });
      refreshStatus();
    } finally {
      setSaving(false);
    }
  };

  const dotClass =
    status?.state === "open"
      ? "bg-emerald-500 animate-pulse"
      : status?.state === "connecting"
        ? "bg-amber-500 animate-pulse"
        : status?.state === "error" || status?.state === "closed"
          ? "bg-red-500"
          : "bg-neutral-600";

  const stateLabel =
    status?.state === "open"
      ? `Conectado a ${status.url}`
      : status?.state === "connecting"
        ? `Conectando a ${status.url}…`
        : status?.state === "closed"
          ? `Desconectado (reintentando)`
          : status?.state === "error"
            ? `Error: ${status.lastError ?? "desconocido"}`
            : syncUrl.trim()
              ? "Configurado pero sin conexión aún, abre Configuración para iniciarlo"
              : "Sin configurar, funcionando en local";

  const onJoin = async ({ url, workspace, token }: { url: string; workspace: string; token: string }) => {
    setSyncUrl(url);
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncUrl: url, syncWorkspace: workspace, syncToken: token, syncOptIn: true }),
    });
    refreshStatus();
  };

  return (
    <div className="space-y-6">
      <Section
        title="Conectar a un espacio de trabajo"
        description="Pega la invitación de quien aloja el espacio. Pegado inteligente: suelta el bloque completo en el campo URL y los tres valores se rellenan solos."
      >
        <JoinForm
          initialUrl={syncUrl}
          initialWorkspace=""
          initialToken=""
          onSave={onJoin}
        />
        <div className="flex items-center gap-2 text-xs mt-3">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span className="text-neutral-300">{stateLabel}</span>
        </div>
      </Section>

      <Section
        title="Alojar este espacio"
        description="Ejecuta el servidor de sincronización desde esta máquina para que tus compañeros se conecten a ti. Cuatro modos de alojamiento, del más sencillo al más avanzado."
      >
        <HostingPanel />
      </Section>

      <Section
        title="Guardar URL rápida"
        description="Si ya conoces la URL y no tienes el bloque de invitación, pégala aquí directamente."
      >
        <div className="space-y-2">
          <input
            value={syncUrl}
            onChange={(e) => setSyncUrl(e.target.value)}
            placeholder="wss://war-room.your-domain.com  or  ws://192.168.1.50:8788"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-700"
            disabled={!loaded}
          />
          <button
            onClick={save}
            disabled={!loaded || saving}
            className="px-3 py-1.5 text-xs rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {saving ? t.settings.saving : "Guardar URL"}
          </button>
        </div>
      </Section>

      <Section title="Actualización automática" description="La aplicación descarga nuevas versiones del servidor de actualización configurado en esta build. Consulta WAR_ROOM_UPDATE_URL o release.js para cambiar la fuente.">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-neutral-300">Conectado, comprueba actualizaciones en cada arranque</span>
        </div>
      </Section>
    </div>
  );
}

function AboutTab({ about }: { about: AboutInfo | null }) {
  return (
    <div className="space-y-6">
      <Section title="Versión">
        {about ? (
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-neutral-500">Nombre</dt>
            <dd className="text-neutral-200">{about.name}</dd>
            <dt className="text-neutral-500">Versión</dt>
            <dd className="text-neutral-200 font-mono">v{about.version}</dd>
            <dt className="text-neutral-500">Servidor de actualización</dt>
            <dd className="text-neutral-300 font-mono text-xs break-all">{about.repo ?? "-"}</dd>
          </dl>
        ) : (
          <div className="text-xs text-neutral-600">Cargando…</div>
        )}
      </Section>
      <Section title="Créditos" description="Publicación de código abierto AGPL-3.0. Dependencias de código abierto listadas en package.json.">
        <div />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-100 mb-1">{title}</h3>
      {description && <p className="text-xs text-neutral-500 mb-3 leading-relaxed max-w-xl">{description}</p>}
      {children}
    </section>
  );
}
