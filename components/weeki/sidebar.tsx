"use client";

import { useState } from "react";
import {
  Archive,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  FileText,
  FileSignature,
  FilePlus2,
  Files,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  MoreHorizontal,
  ReceiptText,
  Settings,
  ShoppingBag,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FISCAL_FLAGS } from "@/features/fiscal/config";
import { cn } from "@/lib/utils";

const primaryItems = [
  { label: "Início", icon: LayoutDashboard, area: "dashboard" as const },
  { label: "Minha Semana", icon: CalendarDays, area: "week" as const },
  {
    label: "Atendimentos",
    icon: BriefcaseBusiness,
    area: "engagements" as const,
  },
  { label: "Agenda", icon: CalendarClock, area: "appointments" as const },
  { label: "Clientes", icon: Users, area: "clients" as const },
  { label: "Serviços", icon: ShoppingBag, area: "services" as const },
  { label: "Orçamentos", icon: FileText, area: "quotes" as const },
  { label: "Comercial", icon: KanbanSquare, area: "commercial" as const },
  { label: "Contratos", icon: FileSignature, area: "contracts" as const },
  { label: "Relatórios", icon: BarChart3, area: "reports" as const },
  { label: "Financeiro", icon: WalletCards, area: "finance" as const },
  { label: "Cobranças", icon: ReceiptText, area: "billing" as const },
  { label: "Fiscal", icon: FileCheck2, area: "fiscal" as const },
];

const secondaryItems = [{ label: "Arquivados", icon: Archive }];

export type WeekiArea =
  | "dashboard"
  | "week"
  | "engagements"
  | "clients"
  | "services"
  | "quotes"
  | "commercial"
  | "contracts"
  | "appointments"
  | "reports"
  | "finance"
  | "billing"
  | "fiscal"
  | "settings";
export type FiscalSidebarView = "overview" | "notes" | "issue" | "settings";

export function WeekiSidebar({
  inboxCount,
  activeArea,
  onNavigate,
  onInbox,
  profileName,
  profileInitials,
  fiscalView = "overview",
  onFiscalNavigate,
}: {
  inboxCount: number;
  activeArea: WeekiArea;
  onNavigate: (area: WeekiArea) => void;
  onInbox?: () => void;
  profileName: string;
  profileInitials: string;
  fiscalView?: FiscalSidebarView;
  onFiscalNavigate?: (view: FiscalSidebarView) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar px-3 py-4 text-sidebar-foreground md:flex">
      <div className="flex h-12 items-center px-3">
        <span className="text-2xl font-semibold tracking-tight">weeki</span>
        <span className="ml-1.5 size-2 rounded-full bg-sidebar-primary" />
      </div>

      <button
        type="button"
        onClick={() => onNavigate("settings")}
        className="mt-4 flex h-11 w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.045] px-3 text-left transition hover:bg-white/[0.08]"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#7657ff] to-[#327fe5] text-xs font-semibold">
          {profileInitials}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {profileName}
        </span>
        <ChevronDown className="size-4 text-white/45" />
      </button>

      <div className="week-board-scroll mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="space-y-1" aria-label="Navegação principal">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
            Workspace
          </p>
          {primaryItems
            .filter(
              (item) => item.area !== "fiscal" || FISCAL_FLAGS.moduleEnabled,
            )
            .map((item) => (
              <div key={item.label}>
                <button
                  type="button"
                  disabled={!item.area}
                  title={!item.area ? "Em breve" : undefined}
                  onClick={() => item.area && onNavigate(item.area)}
                  className={cn(
                    "relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/58",
                    item.area === activeArea && "bg-white/[0.09] text-white",
                  )}
                >
                  {item.area === activeArea && (
                    <span className="absolute -left-3 h-6 w-[3px] rounded-r-full bg-sidebar-primary" />
                  )}
                  <item.icon className="size-[18px]" strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
                {item.area === "fiscal" && activeArea === "fiscal" && (
                  <div className="mb-1 ml-7 mt-1 space-y-0.5 border-l border-white/10 pl-2">
                    {[
                      {
                        id: "overview" as const,
                        label: "Visão geral",
                        icon: LayoutDashboard,
                      },
                      {
                        id: "notes" as const,
                        label: "Notas fiscais",
                        icon: Files,
                      },
                      {
                        id: "issue" as const,
                        label: "Emitir NFS-e",
                        icon: FilePlus2,
                      },
                      {
                        id: "settings" as const,
                        label: "Configurações",
                        icon: Settings,
                      },
                    ].map((subitem) => (
                      <button
                        key={subitem.id}
                        type="button"
                        onClick={() => onFiscalNavigate?.(subitem.id)}
                        className={cn(
                          "flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs font-medium text-white/42 transition hover:bg-white/[0.05] hover:text-white/80",
                          fiscalView === subitem.id &&
                            "bg-white/[0.06] text-white/90",
                        )}
                      >
                        <subitem.icon className="size-3" />
                        <span>{subitem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          <button
            type="button"
            onClick={onInbox}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Inbox className="size-[18px]" strokeWidth={1.8} />
            <span className="flex-1 text-left">Caixa de Entrada</span>
            {inboxCount > 0 && (
              <span className="rounded-full bg-sidebar-primary px-2 py-0.5 text-xs font-semibold text-white">
                {inboxCount}
              </span>
            )}
          </button>
        </nav>

        <nav className="mt-6 space-y-1" aria-label="Navegação secundária">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
            Gestão
          </p>
          {secondaryItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled
              title="Em breve"
              className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <item.icon className="size-[18px]" strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto space-y-1 border-t border-white/8 pt-4">
        <button
          type="button"
          disabled
          title="Em breve"
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CircleHelp className="size-[18px]" /> Ajuda
        </button>
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          className={cn(
            "relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/58 hover:bg-white/[0.06] hover:text-white",
            activeArea === "settings" && "bg-white/[0.09] text-white",
          )}
        >
          {activeArea === "settings" && (
            <span className="absolute -left-3 h-6 w-[3px] rounded-r-full bg-[#8065ff]" />
          )}
          <Settings className="size-[18px]" /> Configurações
        </button>
      </div>
    </aside>
  );
}

export function MobileNavigation({
  activeArea,
  onNavigate,
}: {
  activeArea: WeekiArea;
  onNavigate: (area: WeekiArea) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const main = [
    { label: "Início", icon: LayoutDashboard, area: "dashboard" as const },
    { label: "Semana", icon: CalendarDays, area: "week" as const },
    {
      label: "Trabalho",
      icon: BriefcaseBusiness,
      area: "engagements" as const,
    },
    { label: "Clientes", icon: Users, area: "clients" as const },
    { label: "Config.", icon: Settings, area: "settings" as const },
  ];
  const more = [
    {
      label: "Agenda",
      description: "Agenda e disponibilidade",
      icon: CalendarClock,
      area: "appointments" as const,
    },
    {
      label: "Serviços",
      description: "Catálogo, vitrine e checkout",
      icon: ShoppingBag,
      area: "services" as const,
    },
    {
      label: "Orçamentos",
      description: "Propostas e aprovações",
      icon: FileText,
      area: "quotes" as const,
    },
    {
      label: "Comercial",
      description: "Oportunidades e orçamentos",
      icon: KanbanSquare,
      area: "commercial" as const,
    },
    {
      label: "Contratos",
      description: "Modelos e documentos",
      icon: FileSignature,
      area: "contracts" as const,
    },
    {
      label: "Relatórios",
      description: "Prestação de contas ao cliente",
      icon: BarChart3,
      area: "reports" as const,
    },
    {
      label: "Financeiro",
      description: "Receitas e despesas",
      icon: WalletCards,
      area: "finance" as const,
    },
    {
      label: "Cobranças",
      description: "Links e recebimentos",
      icon: ReceiptText,
      area: "billing" as const,
    },
    {
      label: "Fiscal",
      description: "Notas fiscais e automação",
      icon: FileCheck2,
      area: "fiscal" as const,
    },
  ].filter((item) => item.area !== "fiscal" || FISCAL_FLAGS.moduleEnabled);
  const moreActive = more.some((item) => item.area === activeArea);
  const navigate = (area: WeekiArea) => {
    setMoreOpen(false);
    onNavigate(area);
  };

  return (
    <>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-xl border border-white/10 bg-sidebar/95 px-1 text-white shadow-xl backdrop-blur md:hidden"
        aria-label="Navegação móvel"
      >
        {main.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.area)}
            aria-label={item.area === "settings" ? "Configurações" : item.label}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-xs font-medium text-white/50 transition",
              item.area === activeArea && "bg-white/[0.07] text-white",
            )}
          >
            <item.icon
              className={cn(
                "size-[18px]",
                item.area === activeArea && "text-violet-300",
              )}
            />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-xs font-medium text-white/50 transition",
            moreActive && "bg-white/[0.07] text-white",
          )}
          aria-label="Abrir mais áreas"
        >
          <MoreHorizontal
            className={cn("size-[18px]", moreActive && "text-violet-300")}
          />
          <span>Mais</span>
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-slate-200 px-4 pb-7 pt-2 dark:border-white/10"
          showCloseButton={false}
        >
          <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-slate-200 dark:bg-white/15" />
          <SheetHeader className="px-1 pb-2 pt-3 text-left">
            <SheetTitle className="text-base">Mais áreas</SheetTitle>
            <SheetDescription className="text-xs">
              Acesse os demais recursos do seu workspace.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-2">
            {more.map((item) => (
              <button
                key={item.area}
                type="button"
                onClick={() => navigate(item.area)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-200 hover:bg-violet-50/40 dark:border-white/10 dark:bg-card dark:hover:bg-white/[0.04]",
                  item.area === activeArea &&
                    "border-violet-300 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10",
                )}
              >
                <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                  <item.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
