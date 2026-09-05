"use client";

import {
  Archive,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryItems = [
  { label: "Início", icon: LayoutDashboard },
  { label: "Minha Semana", icon: CalendarDays, area: "week" as const },
  { label: "Demandas", icon: ListTodo },
  { label: "Clientes", icon: Users, area: "clients" as const },
];

const secondaryItems = [
  { label: "Relatórios", icon: BarChart3 },
  { label: "Arquivados", icon: Archive },
];

export type WeekiArea = "week" | "clients";

export function WeekiSidebar({ inboxCount, activeArea, onNavigate }: { inboxCount: number; activeArea: WeekiArea; onNavigate: (area: WeekiArea) => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col bg-[#101014] px-3 py-4 text-white md:flex">
      <div className="flex h-12 items-center px-3">
        <span className="text-[25px] font-semibold tracking-[-0.055em]">weeki</span>
        <span className="ml-1.5 size-2 rounded-full bg-gradient-to-br from-[#8d6cff] to-[#2f80ed] shadow-[0_0_16px_#7657ff]" />
      </div>

      <button className="mt-4 flex h-11 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.045] px-3 text-left transition hover:bg-white/[0.08]">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#7657ff] to-[#327fe5] text-xs font-semibold">EV</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Eduardo Vieira</span>
        <ChevronDown className="size-4 text-white/45" />
      </button>

      <nav className="mt-6 space-y-1" aria-label="Navegação principal">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Workspace</p>
        {primaryItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => item.area && onNavigate(item.area)}
            className={cn(
              "relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white",
              item.area === activeArea && "bg-white/[0.09] text-white",
            )}
          >
            {item.area === activeArea && <span className="absolute -left-3 h-6 w-[3px] rounded-r-full bg-[#8065ff]" />}
            <item.icon className="size-[18px]" strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white">
          <Inbox className="size-[18px]" strokeWidth={1.8} />
          <span className="flex-1 text-left">Caixa de Entrada</span>
          {inboxCount > 0 && <span className="rounded-full bg-[#7657ff] px-2 py-0.5 text-[11px] font-semibold text-white">{inboxCount}</span>}
        </button>
      </nav>

      <nav className="mt-6 space-y-1" aria-label="Navegação secundária">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Gestão</p>
        {secondaryItems.map((item) => (
          <button key={item.label} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white">
            <item.icon className="size-[18px]" strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-white/8 pt-4">
        <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/58 hover:bg-white/[0.06] hover:text-white">
          <CircleHelp className="size-[18px]" /> Ajuda
        </button>
        <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/58 hover:bg-white/[0.06] hover:text-white">
          <Settings className="size-[18px]" /> Configurações
        </button>
      </div>
    </aside>
  );
}

export function MobileNavigation({ activeArea, onNavigate }: { activeArea: WeekiArea; onNavigate: (area: WeekiArea) => void }) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex h-[62px] items-center justify-around rounded-2xl border border-white/10 bg-[#101014]/95 px-2 text-white shadow-2xl backdrop-blur md:hidden" aria-label="Navegação móvel">
      {primaryItems.map((item) => (
        <button key={item.label} type="button" onClick={() => item.area && onNavigate(item.area)} className={cn("flex min-w-14 flex-col items-center gap-1 text-[10px] text-white/50", item.area === activeArea && "text-white")}>
          <item.icon className={cn("size-5", item.area === activeArea && "text-[#9a84ff]")} />
          <span>{item.label === "Minha Semana" ? "Semana" : item.label}</span>
        </button>
      ))}
    </nav>
  );
}
