"use client";

import {
  Archive,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Inbox,
  LayoutDashboard,
  ListTodo,
  ReceiptText,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryItems = [
  { label: "Início", icon: LayoutDashboard },
  { label: "Minha Semana", icon: CalendarDays, area: "week" as const },
  { label: "Demandas", icon: ListTodo },
  { label: "Clientes", icon: Users, area: "clients" as const },
  { label: "Agendamentos", icon: CalendarClock, area: "appointments" as const },
  { label: "Financeiro", icon: WalletCards, area: "finance" as const },
  { label: "Cobranças", icon: ReceiptText, area: "billing" as const },
];

const secondaryItems = [
  { label: "Relatórios", icon: BarChart3 },
  { label: "Arquivados", icon: Archive },
];

export type WeekiArea = "week" | "clients" | "appointments" | "finance" | "billing";

export function WeekiSidebar({ inboxCount, activeArea, onNavigate, onInbox }: { inboxCount: number; activeArea: WeekiArea; onNavigate: (area: WeekiArea) => void; onInbox?: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar px-3 py-4 text-sidebar-foreground md:flex">
      <div className="flex h-12 items-center px-3">
        <span className="text-2xl font-semibold tracking-tight">weeki</span>
        <span className="ml-1.5 size-2 rounded-full bg-sidebar-primary" />
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
            disabled={!item.area}
            title={!item.area ? "Em breve" : undefined}
            onClick={() => item.area && onNavigate(item.area)}
            className={cn(
              "relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/58",
              item.area === activeArea && "bg-white/[0.09] text-white",
            )}
          >
            {item.area === activeArea && <span className="absolute -left-3 h-6 w-[3px] rounded-r-full bg-sidebar-primary" />}
            <item.icon className="size-[18px]" strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" onClick={onInbox} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white">
          <Inbox className="size-[18px]" strokeWidth={1.8} />
          <span className="flex-1 text-left">Caixa de Entrada</span>
          {inboxCount > 0 && <span className="rounded-full bg-sidebar-primary px-2 py-0.5 text-[11px] font-semibold text-white">{inboxCount}</span>}
        </button>
      </nav>

      <nav className="mt-6 space-y-1" aria-label="Navegação secundária">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Gestão</p>
        {secondaryItems.map((item) => (
          <button key={item.label} type="button" disabled title="Em breve" className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 disabled:cursor-not-allowed disabled:opacity-40">
            <item.icon className="size-[18px]" strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-white/8 pt-4">
        <button type="button" disabled title="Em breve" className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 disabled:cursor-not-allowed disabled:opacity-40">
          <CircleHelp className="size-[18px]" /> Ajuda
        </button>
        <button type="button" disabled title="Em breve" className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 disabled:cursor-not-allowed disabled:opacity-40">
          <Settings className="size-[18px]" /> Configurações
        </button>
      </div>
    </aside>
  );
}

export function MobileNavigation({ activeArea, onNavigate }: { activeArea: WeekiArea; onNavigate: (area: WeekiArea) => void }) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-xl border border-white/10 bg-sidebar/95 px-1 text-white md:hidden" aria-label="Navegação móvel">
      {primaryItems.filter((item) => item.area).map((item) => (
        <button key={item.label} type="button" onClick={() => item.area && onNavigate(item.area)} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 px-1 text-[11px] text-white/50", item.area === activeArea && "text-white")}>
          <item.icon className={cn("size-5", item.area === activeArea && "text-sidebar-primary-foreground")} />
          <span className="truncate">{item.label === "Minha Semana" ? "Semana" : item.label === "Agendamentos" ? "Agenda" : item.label}</span>
        </button>
      ))}
    </nav>
  );
}
