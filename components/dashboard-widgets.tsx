"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Users,
  Bot,
  TrendingUp,
  Activity as ActivityIcon,
  FileText,
  LayoutDashboard,
  Home as HomeIcon,
  Briefcase,
} from "lucide-react";
import { useState } from "react";

export type WidgetId =
  | "home"
  | "boardroom"
  | "agent-flow"
  | "active-jobs"
  | "activity"
  | "activity-mix"
  | "recent-activity"
  | "leaderboard"
  | "recent-files";

type Widget = {
  id: WidgetId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

// Sidebar widgets scroll the dashboard to that section. Order matches dashboard layout.
const WIDGETS: Widget[] = [
  { id: "home", label: "Inicio", Icon: HomeIcon, accent: "text-amber-300" },
  { id: "active-jobs", label: "Proyectos activos", Icon: Briefcase, accent: "text-emerald-300" },
  { id: "boardroom", label: "Sala de reuniones", Icon: Users, accent: "text-violet-300" },
  { id: "activity", label: "Gráfico de actividad", Icon: TrendingUp, accent: "text-violet-300" },
  { id: "recent-activity", label: "Actividad reciente", Icon: ActivityIcon, accent: "text-sky-300" },
  { id: "recent-files", label: "Archivos recientes", Icon: FileText, accent: "text-neutral-300" },
  { id: "agent-flow", label: "Flujo de agentes", Icon: Bot, accent: "text-amber-300" },
];

export function DashboardWidgets() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const onHome = pathname === "/c/home";

  return (
    <div className="mb-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1 px-3 py-1 text-xs uppercase tracking-wider font-semibold text-neutral-500 hover:text-neutral-300"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <LayoutDashboard className="w-3 h-3 text-neutral-600" />
        <span>Panel</span>
        <span className="ml-auto text-neutral-700">{WIDGETS.length}</span>
      </button>
      {!collapsed && (
        <div className="flex flex-col">
          {WIDGETS.map((w) => {
            const isHome = w.id === "home";
            const href = isHome ? "/c/home" : `/c/home#${w.id}`;
            const Icon = w.Icon;
            const onClick = (e: React.MouseEvent) => {
              if (!onHome) return; // Off /c/home; let the link navigate normally.
              const targetId = isHome ? "overview" : w.id;
              const el = document.getElementById(targetId);
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            };
            return (
              <Link
                key={w.id}
                href={href}
                onClick={onClick}
                className="mx-2 px-2 py-1 rounded-md flex items-center gap-2 text-sm transition-colors text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${w.accent}`} />
                <span className="truncate flex-1">{w.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
