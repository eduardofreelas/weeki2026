"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  CheckSquare,
  FileSignature,
  Layers3,
  Search,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client } from "@/features/clients/types";
import type { QuoteTemplate, Service } from "@/features/operations/types";
import { SERVICE_STATUS_LABELS } from "@/features/services/types";
import { STATUS_LABELS, type Task } from "@/features/tasks/types";
import { CONTRACT_STATUS_LABELS, type WeekiContract } from "@/shared/contracts";
import { REPORT_STATUS_LABELS, type WeekiReport } from "@/shared/reports";
import { cn } from "@/lib/utils";
import type { WeekiArea } from "./sidebar";

type ArchiveType =
  "all" | "tasks" | "services" | "quoteTemplates" | "contracts" | "reports";

type ArchivedItem = {
  id: string;
  type: Exclude<ArchiveType, "all">;
  typeLabel: string;
  title: string;
  description: string;
  date: string | null;
  meta: string;
  icon: LucideIcon;
  tone: "violet" | "blue" | "amber" | "emerald" | "slate";
  restore: () => void;
  destination: WeekiArea;
};

const typeLabels: Record<ArchiveType, string> = {
  all: "Todos",
  tasks: "Demandas",
  services: "Serviços",
  quoteTemplates: "Modelos de orçamento",
  contracts: "Contratos",
  reports: "Relatórios",
};

const toneStyles = {
  violet: "bg-[#efedff] text-[#654ce4]",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-100 text-slate-500",
};

export function ArchivesScreen({
  tasks,
  clients,
  services,
  quoteTemplates,
  contracts,
  reports,
  onRestoreTask,
  onRestoreService,
  onRestoreQuoteTemplate,
  onRestoreContract,
  onRestoreReport,
  onNavigate,
}: {
  tasks: Task[];
  clients: Client[];
  services: Service[];
  quoteTemplates: QuoteTemplate[];
  contracts: WeekiContract[];
  reports: WeekiReport[];
  onRestoreTask: (id: string) => void;
  onRestoreService: (id: string) => void;
  onRestoreQuoteTemplate: (id: string) => void;
  onRestoreContract: (id: string) => void;
  onRestoreReport: (id: string) => void;
  onNavigate: (area: WeekiArea) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ArchiveType>("all");

  const items = useMemo<ArchivedItem[]>(() => {
    const taskItems: ArchivedItem[] = tasks
      .filter((task) => task.archivedAt)
      .map((task) => {
        const client = clients.find((item) => item.id === task.clientId);
        return {
          id: task.id,
          type: "tasks",
          typeLabel: "Demanda",
          title: task.title,
          description: task.description || "Demanda arquivada.",
          date: task.archivedAt,
          meta: `${STATUS_LABELS[task.status]}${client ? ` · ${client.name}` : ""}`,
          icon: CheckSquare,
          tone: "violet",
          restore: () => onRestoreTask(task.id),
          destination: "week",
        };
      });

    const serviceItems: ArchivedItem[] = services
      .filter((service) => service.archivedAt || service.status === "archived")
      .map((service) => ({
        id: service.id,
        type: "services",
        typeLabel: "Serviço",
        title: service.name,
        description: service.summary || service.description,
        date: service.archivedAt,
        meta: `${SERVICE_STATUS_LABELS[service.status]} · ${service.category || "Sem categoria"}`,
        icon: ShoppingBag,
        tone: "blue",
        restore: () => onRestoreService(service.id),
        destination: "services",
      }));

    const templateItems: ArchivedItem[] = quoteTemplates
      .filter((template) => template.archivedAt)
      .map((template) => ({
        id: template.id,
        type: "quoteTemplates",
        typeLabel: "Modelo",
        title: template.name,
        description: template.description || "Modelo de orçamento arquivado.",
        date: template.archivedAt,
        meta: `${template.items.length} item(ns) · Orçamentos`,
        icon: Layers3,
        tone: "amber",
        restore: () => onRestoreQuoteTemplate(template.id),
        destination: "quotes",
      }));

    const contractItems: ArchivedItem[] = contracts
      .filter((contract) => contract.archivedAt)
      .map((contract) => ({
        id: contract.id,
        type: "contracts",
        typeLabel: "Contrato",
        title: contract.title,
        description: `${contract.number} · ${contract.clientName}`,
        date: contract.archivedAt,
        meta: CONTRACT_STATUS_LABELS[contract.contractStatus],
        icon: FileSignature,
        tone: "emerald",
        restore: () => onRestoreContract(contract.id),
        destination: "contracts",
      }));

    const reportItems: ArchivedItem[] = reports
      .filter((report) => report.archivedAt)
      .map((report) => ({
        id: report.id,
        type: "reports",
        typeLabel: "Relatório",
        title: report.title,
        description: `${report.number} · ${report.clientName || "Sem cliente"}`,
        date: report.archivedAt,
        meta: REPORT_STATUS_LABELS[report.status],
        icon: BarChart3,
        tone: "slate",
        restore: () => onRestoreReport(report.id),
        destination: "reports",
      }));

    return [
      ...taskItems,
      ...serviceItems,
      ...templateItems,
      ...contractItems,
      ...reportItems,
    ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [
    clients,
    contracts,
    onRestoreContract,
    onRestoreQuoteTemplate,
    onRestoreReport,
    onRestoreService,
    onRestoreTask,
    quoteTemplates,
    reports,
    services,
    tasks,
  ]);

  const filteredItems = items.filter((item) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery =
      !normalizedQuery ||
      `${item.title} ${item.description} ${item.meta} ${item.typeLabel}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery);
    return matchesQuery && (type === "all" || item.type === type);
  });

  const counts = {
    tasks: items.filter((item) => item.type === "tasks").length,
    services: items.filter((item) => item.type === "services").length,
    quoteTemplates: items.filter((item) => item.type === "quoteTemplates")
      .length,
    contracts: items.filter((item) => item.type === "contracts").length,
    reports: items.filter((item) => item.type === "reports").length,
  };

  const restoreItem = (item: ArchivedItem) => {
    item.restore();
    toast.success(`${item.typeLabel} restaurado(a).`);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#654ce4]">
            Gestão
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Arquivados
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Recupere demandas, serviços, modelos, contratos e relatórios que
            saíram das listas ativas, mantendo o histórico preservado.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar arquivados"
              className="h-9 rounded-md bg-white pl-9 text-xs shadow-none"
            />
          </div>
          <Select
            value={type}
            onValueChange={(value) => setType(value as ArchiveType)}
          >
            <SelectTrigger className="h-9 w-full rounded-md bg-white text-xs shadow-none sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ArchiveMetric label="Demandas" value={counts.tasks} />
        <ArchiveMetric label="Serviços" value={counts.services} />
        <ArchiveMetric label="Modelos" value={counts.quoteTemplates} />
        <ArchiveMetric label="Contratos" value={counts.contracts} />
        <ArchiveMetric label="Relatórios" value={counts.reports} />
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Itens arquivados
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {filteredItems.length} item(ns) encontrado(s)
            </p>
          </div>
          <Archive className="size-4 text-slate-400" />
        </div>

        <div className="divide-y divide-slate-100">
          {filteredItems.map((item) => (
            <article
              key={`${item.type}-${item.id}`}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  toneStyles[item.tone],
                )}
              >
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    {item.typeLabel}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Arquivado em {formatDate(item.date)}
                  </span>
                </div>
                <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                  {item.description}
                </p>
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  {item.meta}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    restoreItem(item);
                    onNavigate(item.destination);
                  }}
                  className="h-8 text-[11px]"
                >
                  Restaurar e abrir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => restoreItem(item)}
                  className="h-8 text-[11px]"
                >
                  <ArchiveRestore className="size-3.5" /> Restaurar
                </Button>
              </div>
            </article>
          ))}

          {!filteredItems.length && (
            <div className="px-4 py-14 text-center">
              <Archive className="mx-auto size-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Nada arquivado por aqui
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
                Quando você arquivar uma demanda, serviço, modelo, contrato ou
                relatório, ele aparecerá nesta tela para restauração.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ArchiveMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-[10px] text-slate-400">
        disponível para restaurar
      </p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "data não registrada";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}
