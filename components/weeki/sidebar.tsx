"use client";

import {
  Archive,
  BarChart3,
  CalendarDays,
  CircleHelp,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryItems = [
  { label: "Início", icon: LayoutDashboard },
  { label: "Minha Semana", icon: CalendarDays, active: true },
  { label: "Demandas", icon: ListTodo },
  { label: "Clientes", icon: Users },
];

const secondaryItems = [
  { label: "Relatórios", icon: BarChart3 },
  { label: "Arquivados", icon: Archive },
];

export function WeekiSidebar({ inboxCount, onSearch }: { inboxCount: number; onSearch: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-slate-200 bg-white px-3 py-4 text-[#151b2a] md:flex">
      <div className="flex h-11 items-center px-3">
        <span className="text-[24px] font-semibold tracking-[-0.055em]">weeki</span>
        <span className="ml-1.5 size-2 rounded-full bg-[#4f46e5]" />
      </div>

      <button onClick={onSearch} className="mt-4 flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-[#f7f8ff] px-3 text-left text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white">
        <Search className="size-4" />
        <span className="min-w-0 flex-1 truncate">Buscar...</span>
        <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">⌘K</kbd>
      </button>

      <nav className="mt-6 space-y-1" aria-label="Navegação principal">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
        {primaryItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
              item.active && "bg-[#0d1729] text-white shadow-sm hover:bg-[#0d1729] hover:text-white",
            )}
          >
            <item.icon className="size-[18px]" strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
          <Inbox className="size-[18px]" strokeWidth={1.8} />
          <span className="flex-1 text-left">Caixa de Entrada</span>
          {inboxCount > 0 && <span className="rounded-md bg-[#eef0ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#4f46e5]">{inboxCount}</span>}
        </button>
      </nav>

      <nav className="mt-6 space-y-1" aria-label="Navegação secundária">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Gestão</p>
        {secondaryItems.map((item) => (
          <button key={item.label} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
            <item.icon className="size-[18px]" strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-slate-200 pt-3">
        <button className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          <CircleHelp className="size-[18px]" /> Ajuda
        </button>
        <button className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          <Settings className="size-[18px]" /> Configurações
        </button>
        <button className="mt-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0d1729] text-[10px] font-semibold text-white">EV</span>
          <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">Eduardo Vieira</span><span className="block truncate text-[10px] text-slate-400">Minha conta</span></span>
        </button>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex h-[62px] items-center justify-around rounded-2xl border border-slate-200 bg-white/95 px-2 text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur md:hidden" aria-label="Navegação móvel">
      {primaryItems.map((item) => (
        <button key={item.label} className={cn("flex min-w-14 flex-col items-center gap-1 text-[10px]", item.active && "text-[#111827]")}>
          <item.icon className={cn("size-5", item.active && "text-[#4f46e5]")} />
          <span>{item.label === "Minha Semana" ? "Semana" : item.label}</span>
        </button>
      ))}
    </nav>
  );
}
