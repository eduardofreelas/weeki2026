"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  CalendarClock,
  Check,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  ImageIcon,
  Layers3,
  Link2,
  ListChecks,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/weeki/rich-text-editor";
import { ReportPreview } from "@/components/weeki/report-preview";
import { useWeekiBilling } from "@/features/billing/use-weeki-billing";
import type { Client } from "@/features/clients/types";
import { useWeekiFinance } from "@/features/finance/use-weeki-finance";
import { REPORTS_AI_FLAGS, buildReportAiPayload } from "@/features/reports/ai";
import {
  buildExecutiveSummary,
  buildReportDraftInput,
  buildReportVisual,
  filterTasksBySelectedCategories,
  findReportCandidateTasks,
} from "@/features/reports/builders";
import { downloadReportPdf } from "@/features/reports/pdf";
import type { WeekiReportsController } from "@/features/reports/use-weeki-reports";
import type { WeekiSettings } from "@/features/settings/types";
import type { Task } from "@/features/tasks/types";
import { createId, formatDateBR } from "@/lib/format";
import {
  REPORT_BLOCK_LABELS,
  REPORT_DATA_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  type ReportBlock,
  type ReportBlockKind,
  type ReportDataCategory,
  type ReportSchedule,
  type ReportStatus,
  type ReportTemplate,
  type ReportType,
  type WeekiReport,
} from "@/shared/reports";
import { cn } from "@/lib/utils";

type ReportsView = "dashboard" | "new" | "detail";
type ReportsTab = "overview" | "reports" | "templates" | "schedules";
type ReportSort = "updated" | "created" | "period" | "client";
type ComposerStep = "basic" | "data" | "blocks" | "visual";

const composerSteps: Array<{ id: ComposerStep; label: string }> = [
  { id: "basic", label: "Dados" },
  { id: "data", label: "Seleção" },
  { id: "blocks", label: "Blocos" },
  { id: "visual", label: "Visual" },
];

const defaultCategories: ReportDataCategory[] = ["completed_tasks", "in_progress_tasks", "files", "worked_time"];
const defaultBlocks: ReportBlockKind[] = ["cover", "executive_summary", "indicators", "activities", "deliverables", "files", "in_progress", "next_steps", "observations", "signature"];
const availableBlockKinds: ReportBlockKind[] = ["cover", "executive_summary", "indicators", "text", "activities", "deliverables", "files", "images", "hours", "financial", "in_progress", "next_steps", "observations", "conclusion", "signature"];
const textBlockKinds = new Set<ReportBlockKind>(["executive_summary", "text", "next_steps", "observations", "conclusion"]);
const activityBlockKinds = new Set<ReportBlockKind>(["activities", "in_progress", "hours"]);
const evidenceBlockKinds = new Set<ReportBlockKind>(["deliverables", "files", "images", "before_after"]);

const statusStyles: Record<ReportStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-50 text-blue-700",
  review: "bg-amber-50 text-amber-700",
  ready: "bg-[#f0edff] text-[#5b45dc]",
  sent: "bg-cyan-50 text-cyan-700",
  viewed: "bg-indigo-50 text-indigo-700",
  approved: "bg-emerald-50 text-emerald-700",
  adjustment_requested: "bg-rose-50 text-rose-700",
  archived: "bg-slate-100 text-slate-400",
};

const categoryTones: Partial<Record<ReportDataCategory, string>> = {
  financial: "border-amber-200 bg-amber-50 text-amber-800",
  billing: "border-amber-200 bg-amber-50 text-amber-800",
  values: "border-amber-200 bg-amber-50 text-amber-800",
  contracts: "border-rose-200 bg-rose-50 text-rose-800",
};

function todayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

function defaultPeriodStart() {
  return format(startOfMonth(new Date()), "yyyy-MM-dd");
}

function defaultPeriodEnd() {
  return format(endOfMonth(new Date()), "yyyy-MM-dd");
}

function minutesLabel(value: number | null) {
  if (!value) return "-";
  if (value < 60) return `${value} min`;
  const hours = Math.round((value / 60) * 10) / 10;
  return `${hours}h`;
}

function copyToClipboard(value: string) {
  if (!navigator.clipboard) return false;
  void navigator.clipboard.writeText(value);
  return true;
}

function publicUrlFor(token: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("area", "reports");
  url.searchParams.set("share", token);
  return url.toString();
}

function StatusPill({ status }: { status: ReportStatus }) {
  return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-semibold", statusStyles[status])}><span className="size-1.5 rounded-full bg-current" />{REPORT_STATUS_LABELS[status]}</span>;
}

function Indicator({ label, value, icon: Icon, tone = "slate" }: { label: string; value: string | number; icon: LucideIcon; tone?: "slate" | "violet" | "amber" | "cyan" | "emerald" | "blue" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    violet: "bg-[#f0edff] text-[#5b45dc]",
    amber: "bg-amber-50 text-amber-700",
    cyan: "bg-cyan-50 text-cyan-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold text-slate-400">{label}</p>
        <span className={cn("grid size-7 place-items-center rounded-md", tones[tone])}><Icon className="size-3.5" /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </article>
  );
}

export function ReportsScreen({
  clients,
  tasks,
  settings,
  controller,
}: {
  clients: Client[];
  tasks: Task[];
  settings: WeekiSettings;
  controller: WeekiReportsController;
}) {
  const { charges } = useWeekiBilling();
  const { transactions } = useWeekiFinance();
  const [view, setView] = useState<ReportsView>("dashboard");
  const [tab, setTab] = useState<ReportsTab>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sharedToken, setSharedToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("share");
  });

  const selected = controller.reports.find((report) => report.id === selectedId) ?? null;
  const sharedReport = sharedToken ? controller.findByShareToken(sharedToken) : null;

  if (sharedToken) {
    return (
      <SharedReportAccess
        key={sharedToken}
        report={sharedReport}
        token={sharedToken}
        controller={controller}
        onClose={() => {
          setSharedToken(null);
          window.history.replaceState(null, "", window.location.pathname);
        }}
      />
    );
  }

  if (view === "new") {
    return (
      <ReportComposer
        clients={clients}
        tasks={tasks}
        charges={charges}
        transactions={transactions}
        settings={settings}
        templates={controller.templates}
        onCancel={() => setView("dashboard")}
        onSave={(report) => {
          setSelectedId(report.id);
          setView("detail");
        }}
        controller={controller}
      />
    );
  }

  if (view === "detail" && selected) {
    return (
      <ReportDetail
        key={selected.id}
        report={selected}
        controller={controller}
        onBack={() => {
          setSelectedId(null);
          setView("dashboard");
        }}
      />
    );
  }

  return (
    <ReportsDashboard
      reports={controller.reports}
      templates={controller.templates}
      schedules={controller.schedules}
      clients={clients}
      tab={tab}
      onTabChange={setTab}
      onNew={() => setView("new")}
      onOpen={(report) => {
        setSelectedId(report.id);
        setView("detail");
      }}
      onDuplicate={(report) => {
        const copy = controller.duplicateReport(report.id);
        if (copy) toast.success("Relatório duplicado.");
      }}
      onArchive={(report) => {
        controller.archiveReport(report.id);
        toast.success("Relatório arquivado.");
      }}
      onDeleteDraft={(report) => {
        controller.deleteDraft(report.id);
        toast.success("Rascunho excluído.");
      }}
      onDuplicateTemplate={(id) => {
        controller.duplicateTemplate(id);
        toast.success("Modelo duplicado.");
      }}
      onSaveTemplate={controller.saveTemplate}
    />
  );
}

function ReportsDashboard({
  reports,
  templates,
  schedules,
  clients,
  tab,
  onTabChange,
  onNew,
  onOpen,
  onDuplicate,
  onArchive,
  onDeleteDraft,
  onDuplicateTemplate,
  onSaveTemplate,
}: {
  reports: WeekiReport[];
  templates: ReportTemplate[];
  schedules: ReportSchedule[];
  clients: Client[];
  tab: ReportsTab;
  onTabChange: (tab: ReportsTab) => void;
  onNew: () => void;
  onOpen: (report: WeekiReport) => void;
  onDuplicate: (report: WeekiReport) => void;
  onArchive: (report: WeekiReport) => void;
  onDeleteDraft: (report: WeekiReport) => void;
  onDuplicateTemplate: (id: string) => void;
  onSaveTemplate: (template: ReportTemplate) => void;
}) {
  const monthPrefix = todayKey().slice(0, 7);
  const indicators = useMemo(() => ({
    month: reports.filter((report) => report.createdAt.slice(0, 7) === monthPrefix).length,
    inProgress: reports.filter((report) => report.status === "draft" || report.status === "in_progress").length,
    review: reports.filter((report) => report.status === "review").length,
    sent: reports.filter((report) => report.status === "sent").length,
    viewed: reports.filter((report) => report.status === "viewed").length,
    nextSchedule: schedules.filter((schedule) => schedule.active).sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0]?.nextRunAt ?? "",
  }), [monthPrefix, reports, schedules]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground"><FileText className="size-4" /></span>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Relatórios</h1>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">Crie, acompanhe e compartilhe relatórios profissionais com seus clientes.</p>
        </div>
        <Button type="button" size="sm" onClick={onNew}><Plus className="size-3.5" /> Criar relatório</Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as ReportsTab)} className="mt-5 gap-4">
        <TabsList variant="line" className="week-board-scroll flex max-w-full justify-start gap-5 overflow-x-auto rounded-none bg-transparent p-0">
          <TabsTrigger value="overview" className="h-9 flex-none rounded-none px-0.5 text-xs after:bg-[#7657ff] data-[state=active]:text-[#6548df]">Visão geral</TabsTrigger>
          <TabsTrigger value="reports" className="h-9 flex-none rounded-none px-0.5 text-xs after:bg-[#7657ff] data-[state=active]:text-[#6548df]">Meus relatórios</TabsTrigger>
          <TabsTrigger value="templates" className="h-9 flex-none rounded-none px-0.5 text-xs after:bg-[#7657ff] data-[state=active]:text-[#6548df]">Modelos</TabsTrigger>
          <TabsTrigger value="schedules" className="h-9 flex-none rounded-none px-0.5 text-xs after:bg-[#7657ff] data-[state=active]:text-[#6548df]">Agendamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="m-0">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Indicator label="Relatórios neste mês" value={indicators.month} icon={FileText} tone="violet" />
            <Indicator label="Em elaboração" value={indicators.inProgress} icon={Clock3} />
            <Indicator label="Aguardando revisão" value={indicators.review} icon={Eye} tone="amber" />
            <Indicator label="Enviados" value={indicators.sent} icon={Send} tone="cyan" />
            <Indicator label="Visualizados" value={indicators.viewed} icon={BarChart3} tone="blue" />
            <Indicator label="Próximo programado" value={indicators.nextSchedule ? formatDateBR(indicators.nextSchedule) : "-"} icon={CalendarClock} tone="emerald" />
          </section>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Relatórios recentes</h2>
                <p className="mt-1 text-[11px] text-slate-500">Últimos registros salvos neste workspace.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onNew}><Plus className="size-3.5" /> Novo</Button>
            </div>
            {reports.length ? (
              <div className="mt-4 grid gap-2">
                {reports.slice(0, 5).map((report) => <ReportCompactRow key={report.id} report={report} onOpen={() => onOpen(report)} />)}
              </div>
            ) : (
              <EmptyState icon={FileText} title="Nenhum relatório criado" description="Crie o primeiro relatório a partir de clientes e demandas já cadastrados." action={<Button type="button" size="sm" onClick={onNew}><Plus className="size-3.5" /> Criar relatório</Button>} />
            )}
          </div>
        </TabsContent>
        <TabsContent value="reports" className="m-0">
          <ReportsList reports={reports} clients={clients} onOpen={onOpen} onDuplicate={onDuplicate} onArchive={onArchive} onDeleteDraft={onDeleteDraft} />
        </TabsContent>
        <TabsContent value="templates" className="m-0">
          <TemplatesPanel templates={templates} onDuplicate={onDuplicateTemplate} onSave={onSaveTemplate} />
        </TabsContent>
        <TabsContent value="schedules" className="m-0">
          <SchedulesPanel schedules={schedules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportsList({ reports, clients, onOpen, onDuplicate, onArchive, onDeleteDraft }: { reports: WeekiReport[]; clients: Client[]; onOpen: (report: WeekiReport) => void; onDuplicate: (report: WeekiReport) => void; onArchive: (report: WeekiReport) => void; onDeleteDraft: (report: WeekiReport) => void }) {
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");
  const [sort, setSort] = useState<ReportSort>("updated");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return reports
      .filter((report) => {
        const matchesQuery = !normalized || `${report.number} ${report.title} ${report.clientName}`.toLocaleLowerCase("pt-BR").includes(normalized);
        return matchesQuery &&
          (clientFilter === "all" || report.clientId === clientFilter) &&
          (statusFilter === "all" || report.status === statusFilter) &&
          (typeFilter === "all" || report.type === typeFilter);
      })
      .sort((a, b) => {
        if (sort === "client") return a.clientName.localeCompare(b.clientName);
        if (sort === "period") return b.periodEnd.localeCompare(a.periodEnd);
        if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [clientFilter, query, reports, sort, statusFilter, typeFilter]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_170px_170px_170px_150px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por relatório ou cliente..." className="h-8 rounded-md bg-slate-50 pl-8 text-[11px] shadow-none" />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReportStatus | "all")}>
          <SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><Filter className="size-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ReportType | "all")}>
          <SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as ReportSort)}>
          <SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Mais recentes</SelectItem>
            <SelectItem value="created">Criação</SelectItem>
            <SelectItem value="period">Período</SelectItem>
            <SelectItem value="client">Cliente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        {filtered.length ? (
          <>
            <div className="week-board-scroll hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1120px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-[0.055em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Relatório</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Envio</th>
                    <th className="px-4 py-3">Atualização</th>
                    <th className="w-12 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.map((report) => <ReportTableRow key={report.id} report={report} onOpen={() => onOpen(report)} onDuplicate={() => onDuplicate(report)} onArchive={() => onArchive(report)} onDeleteDraft={() => onDeleteDraft(report)} />)}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {filtered.map((report) => <ReportMobileRow key={report.id} report={report} onOpen={() => onOpen(report)} />)}
            </div>
            <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-[10px] text-slate-400">
              <span>Mostrando {filtered.length} de {reports.length} relatórios</span>
              <span>Página 1</span>
            </footer>
          </>
        ) : (
          <EmptyState icon={FileText} title="Nenhum relatório encontrado" description="Ajuste os filtros ou crie um novo relatório." />
        )}
      </div>
    </section>
  );
}

function ReportCompactRow({ report, onOpen }: { report: WeekiReport; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-left transition hover:border-[#c7bcf5] hover:bg-[#fdfcff]">
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-900">{report.title}</span>
        <span className="mt-0.5 block text-[10px] text-slate-400">{report.number} - {report.clientName}</span>
      </span>
      <StatusPill status={report.status} />
    </button>
  );
}

function ReportTableRow({ report, onOpen, onDuplicate, onArchive, onDeleteDraft }: { report: WeekiReport; onOpen: () => void; onDuplicate: () => void; onArchive: () => void; onDeleteDraft: () => void }) {
  return (
    <tr onClick={onOpen} className="group cursor-pointer text-[11px] text-slate-600 transition hover:bg-slate-50/70">
      <td className="px-4 py-3"><p className="font-semibold text-slate-900">{report.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{report.number}</p></td>
      <td className="px-4 py-3">{report.clientName || "-"}</td>
      <td className="px-4 py-3">{formatDateBR(report.periodStart)} a {formatDateBR(report.periodEnd)}</td>
      <td className="px-4 py-3">{REPORT_TYPE_LABELS[report.type]}</td>
      <td className="px-4 py-3"><StatusPill status={report.status} /></td>
      <td className="px-4 py-3">{report.sentAt ? formatDateBR(report.sentAt.slice(0, 10)) : "-"}</td>
      <td className="px-4 py-3">{formatDateBR(report.updatedAt.slice(0, 10))}</td>
      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="grid size-8 place-items-center rounded-md text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100" aria-label={`Ações de ${report.title}`}><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onOpen}><Eye /> Abrir</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}><Copy /> Duplicar</DropdownMenuItem>
            <DropdownMenuSeparator />
            {report.status === "draft" && <DropdownMenuItem onSelect={onDeleteDraft} className="text-rose-600"><Trash2 /> Excluir rascunho</DropdownMenuItem>}
            <DropdownMenuItem onSelect={onArchive}><Archive /> Arquivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function ReportMobileRow({ report, onOpen }: { report: WeekiReport; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full px-4 py-3 text-left">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-slate-900">{report.title}</span>
          <span className="mt-0.5 block text-[10px] text-slate-400">{report.clientName} - {formatDateBR(report.periodStart)} a {formatDateBR(report.periodEnd)}</span>
        </span>
        <StatusPill status={report.status} />
      </span>
    </button>
  );
}

function ReportComposer({
  clients,
  tasks,
  charges,
  transactions,
  settings,
  templates,
  controller,
  onCancel,
  onSave,
}: {
  clients: Client[];
  tasks: Task[];
  charges: ReturnType<typeof useWeekiBilling>["charges"];
  transactions: ReturnType<typeof useWeekiFinance>["transactions"];
  settings: WeekiSettings;
  templates: ReportTemplate[];
  controller: WeekiReportsController;
  onCancel: () => void;
  onSave: (report: WeekiReport) => void;
}) {
  const [step, setStep] = useState<ComposerStep>("basic");
  const [title, setTitle] = useState("Relatório mensal de serviços");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [type, setType] = useState<ReportType>("monthly_services");
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);
  const [responsible, setResponsible] = useState(settings.profile.professionalName || settings.profile.name);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [selectedCategories, setSelectedCategories] = useState<ReportDataCategory[]>(defaultCategories);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskSelectionTouched, setTaskSelectionTouched] = useState(false);
  const [blockKinds, setBlockKinds] = useState<ReportBlockKind[]>(templates[0]?.defaultBlocks ?? defaultBlocks);
  const [visual, setVisual] = useState(buildReportVisual(settings, clients[0] ?? null));

  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null;
  const availableTasks = useMemo(() => findReportCandidateTasks(tasks, { clientId: selectedClient?.id ?? null, periodStart, periodEnd }), [periodEnd, periodStart, selectedClient?.id, tasks]);
  const selectableTasks = useMemo(() => filterTasksBySelectedCategories(availableTasks, selectedCategories), [availableTasks, selectedCategories]);
  const selectableTaskIds = useMemo(() => selectableTasks.map((task) => task.id), [selectableTasks]);
  const effectiveSelectedTaskIds = taskSelectionTouched ? selectedTaskIds.filter((id) => selectableTaskIds.includes(id)) : selectableTaskIds;

  const changeClient = (value: string) => {
    const nextId = value === "__none" ? "" : value;
    const nextClient = clients.find((client) => client.id === nextId) ?? null;
    setClientId(nextId);
    setTaskSelectionTouched(false);
    setSelectedTaskIds([]);
    setVisual((current) => buildReportVisual(settings, nextClient, { ...current, clientLogoUrl: nextClient?.logoUrl ?? "" }));
  };

  const changeTemplate = (value: string) => {
    const nextId = value === "__none" ? "" : value;
    const nextTemplate = templates.find((template) => template.id === nextId) ?? null;
    setTemplateId(nextId);
    if (nextTemplate) {
      setType(nextTemplate.type);
      setBlockKinds(nextTemplate.defaultBlocks);
    }
  };

  const changePeriodStart = (value: string) => {
    setPeriodStart(value);
    setTaskSelectionTouched(false);
    setSelectedTaskIds([]);
  };

  const changePeriodEnd = (value: string) => {
    setPeriodEnd(value);
    setTaskSelectionTouched(false);
    setSelectedTaskIds([]);
  };

  const toggleCategory = (category: ReportDataCategory, checked: boolean) => {
    setSelectedCategories((current) => checked ? Array.from(new Set([...current, category])) : current.filter((item) => item !== category));
    setTaskSelectionTouched(false);
    setSelectedTaskIds([]);
    if (checked && (category === "financial" || category === "billing" || category === "values")) {
      setBlockKinds((current) => current.includes("financial") ? current : [...current, "financial"]);
    }
    if (checked && category === "worked_time") setBlockKinds((current) => current.includes("hours") ? current : [...current, "hours"]);
  };

  const toggleBlock = (kind: ReportBlockKind, checked: boolean) => {
    setBlockKinds((current) => checked ? Array.from(new Set([...current, kind])) : current.filter((item) => item !== kind));
  };

  const createReport = () => {
    if (!title.trim()) {
      toast.error("Informe o nome do relatório.");
      setStep("basic");
      return;
    }
    if (!selectedClient) {
      toast.error("Selecione um cliente.");
      setStep("basic");
      return;
    }
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      toast.error("Revise o período do relatório.");
      setStep("basic");
      return;
    }
    if (!effectiveSelectedTaskIds.length) {
      toast.error("Selecione ao menos uma atividade para compor a V1.");
      setStep("data");
      return;
    }
    const report = controller.createReport(buildReportDraftInput({
      title: title.trim(),
      client: selectedClient,
      type,
      template: selectedTemplate,
      responsible: responsible.trim() || settings.profile.name,
      periodStart,
      periodEnd,
      selectedCategories,
      selectedTaskIds: effectiveSelectedTaskIds,
      tasks,
      charges,
      transactions,
      settings,
      blockKinds,
      visual,
    }));
    toast.success("Relatório criado.");
    onSave(report);
  };

  const stepIndex = composerSteps.findIndex((item) => item.id === step);
  const completed = availableTasks.filter((task) => task.status === "completed").length;
  const open = availableTasks.length - completed;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <button type="button" onClick={onCancel} className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-3.5" /> Relatórios</button>
          <h1 className="text-2xl font-semibold text-slate-900">Criar relatório</h1>
        </div>
        <div className="week-board-scroll flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-200/65 p-1">
          {composerSteps.map((item, index) => (
            <button key={item.id} type="button" onClick={() => setStep(item.id)} className={cn("h-7 shrink-0 rounded-md px-3 text-[11px] font-medium text-slate-500", step === item.id && "bg-white font-semibold text-slate-900")}>
              {index + 1}. {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          {step === "basic" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome do relatório" required><Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Cliente" required>
                <Select value={clientId || "__none"} onValueChange={changeClient}>
                  <SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">Selecionar cliente</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de relatório">
                <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
                  <SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Modelo">
                <Select value={templateId || "__none"} onValueChange={changeTemplate}>
                  <SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">Sem modelo</SelectItem>{templates.filter((template) => !template.archivedAt).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Período inicial" required><Input type="date" value={periodStart} onChange={(event) => changePeriodStart(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Período final" required><Input type="date" value={periodEnd} onChange={(event) => changePeriodEnd(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Responsável"><Input value={responsible} onChange={(event) => setResponsible(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field>
            </div>
          )}

          {step === "data" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-800">Encontramos {availableTasks.length} atividades relacionadas a {selectedClient?.name ?? "este cliente"} neste período.</p>
                <p className="mt-1 text-[11px] text-slate-500">{completed} concluídas, {open} em andamento ou revisão.</p>
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-900">Categorias de dados</h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(REPORT_DATA_CATEGORY_LABELS).map(([value, label]) => {
                    const category = value as ReportDataCategory;
                    const financial = category === "financial" || category === "billing" || category === "values";
                    return (
                      <label key={value} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700", categoryTones[category])}>
                        <span>{label}</span>
                        <Checkbox checked={selectedCategories.includes(category)} onCheckedChange={(checked) => toggleCategory(category, checked === true)} />
                        {financial && <span className="sr-only">Informação sensível selecionada manualmente</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-xs font-semibold text-slate-900">Seleção individual</h2>
                  <span className="text-[10px] text-slate-400">{effectiveSelectedTaskIds.length} selecionadas</span>
                </div>
                <div className="max-h-[430px] overflow-y-auto rounded-lg border border-slate-200">
                  {selectableTasks.length ? selectableTasks.map((task) => (
                    <label key={task.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 bg-white p-3 last:border-b-0">
                      <Checkbox checked={effectiveSelectedTaskIds.includes(task.id)} onCheckedChange={(checked) => { setTaskSelectionTouched(true); setSelectedTaskIds((current) => checked === true ? Array.from(new Set([...effectiveSelectedTaskIds, task.id])) : current.length ? current.filter((id) => id !== task.id) : effectiveSelectedTaskIds.filter((id) => id !== task.id)); }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-800">{task.report?.description || task.title}</span>
                        <span className="mt-1 block text-[10px] text-slate-400">{formatDateBR((task.scheduledDate || task.dueDate || task.createdAt.slice(0, 10)))} - {minutesLabel(task.estimateMinutes)}</span>
                      </span>
                    </label>
                  )) : <div className="grid min-h-32 place-items-center px-4 text-center text-xs text-slate-400">Nenhuma atividade disponível para os filtros escolhidos.</div>}
                </div>
              </div>
            </div>
          )}

          {step === "blocks" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xs font-semibold text-slate-900">Blocos do relatório</h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {availableBlockKinds.map((kind) => (
                    <label key={kind} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                      <span>{REPORT_BLOCK_LABELS[kind]}</span>
                      <Checkbox checked={blockKinds.includes(kind)} onCheckedChange={(checked) => toggleBlock(kind, checked === true)} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-700">Ordem inicial</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {blockKinds.map((kind, index) => <span key={`${kind}-${index}`} className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-500">{index + 1}. {REPORT_BLOCK_LABELS[kind]}</span>)}
                </div>
              </div>
            </div>
          )}

          {step === "visual" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cor principal"><Input type="color" value={visual.primaryColor} onChange={(event) => setVisual((current) => ({ ...current, primaryColor: event.target.value }))} className="h-9 rounded-md p-1 shadow-none" /></Field>
              <Field label="Cor secundária"><Input type="color" value={visual.secondaryColor} onChange={(event) => setVisual((current) => ({ ...current, secondaryColor: event.target.value }))} className="h-9 rounded-md p-1 shadow-none" /></Field>
              <Field label="Logo do prestador"><Input value={visual.providerLogoUrl} onChange={(event) => setVisual((current) => ({ ...current, providerLogoUrl: event.target.value }))} placeholder="https://..." className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Logo do cliente"><Input value={visual.clientLogoUrl} onChange={(event) => setVisual((current) => ({ ...current, clientLogoUrl: event.target.value }))} placeholder="https://..." className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Nome da empresa"><Input value={visual.companyName} onChange={(event) => setVisual((current) => ({ ...current, companyName: event.target.value }))} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="E-mail"><Input value={visual.contactEmail} onChange={(event) => setVisual((current) => ({ ...current, contactEmail: event.target.value }))} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Telefone"><Input value={visual.contactPhone} onChange={(event) => setVisual((current) => ({ ...current, contactPhone: event.target.value }))} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="CNPJ / documento"><Input value={visual.document} onChange={(event) => setVisual((current) => ({ ...current, document: event.target.value }))} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Site"><Input value={visual.site} onChange={(event) => setVisual((current) => ({ ...current, site: event.target.value }))} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Assinatura"><Input value={visual.signature} onChange={(event) => setVisual((current) => ({ ...current, signature: event.target.value }))} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <div className="md:col-span-2"><Field label="Rodapé"><Input value={visual.footer} onChange={(event) => setVisual((current) => ({ ...current, footer: event.target.value }))} className="h-9 rounded-md text-xs shadow-none" /></Field></div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" size="sm" disabled={stepIndex === 0} onClick={() => setStep(composerSteps[stepIndex - 1].id)}>Voltar</Button>
            {stepIndex < composerSteps.length - 1 ? (
              <Button type="button" size="sm" onClick={() => setStep(composerSteps[stepIndex + 1].id)}>Continuar</Button>
            ) : (
              <Button type="button" size="sm" onClick={createReport}><Check className="size-3.5" /> Criar estrutura</Button>
            )}
          </div>
        </section>

        <aside className="space-y-3">
          <PreviewCard title="Cliente" value={selectedClient?.name || "Não selecionado"} icon={FileText} />
          <PreviewCard title="Período" value={`${formatDateBR(periodStart)} a ${formatDateBR(periodEnd)}`} icon={CalendarClock} />
          <PreviewCard title="Atividades elegíveis" value={availableTasks.length} icon={ListChecks} />
          <PreviewCard title="Blocos" value={blockKinds.length} icon={Layers3} />
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p className="text-[11px] leading-5">Dados financeiros só entram quando selecionados manualmente nas categorias.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReportDetail({ report, controller, onBack }: { report: WeekiReport; controller: WeekiReportsController; onBack: () => void }) {
  const [draft, setDraft] = useState(report);
  const [shareOpen, setShareOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [addKind, setAddKind] = useState<ReportBlockKind>("text");

  const updateBlock = (id: string, patch: Partial<ReportBlock>) => {
    setDraft((current) => ({
      ...current,
      status: current.status === "draft" ? "in_progress" : current.status,
      blocks: current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block),
    }));
  };

  const editablePatch = (current: WeekiReport): Partial<WeekiReport> => ({
    title: current.title,
    responsible: current.responsible,
    status: current.status,
    blocks: current.blocks,
    visual: current.visual,
  });

  const save = (silent = false) => {
    controller.updateReport(draft.id, editablePatch(draft), !silent);
    if (!silent) toast.success("Relatório salvo.");
  };

  const finalize = () => {
    const finalized = controller.finalizeReport(draft.id, editablePatch(draft));
    setDraft((current) => finalized ?? { ...current, status: current.status === "draft" || current.status === "in_progress" || current.status === "review" ? "ready" : current.status, finalizedAt: current.finalizedAt ?? new Date().toISOString() });
    toast.success("Relatório finalizado com snapshot preservado.");
  };

  const createLocalSummary = () => {
    const summary = buildExecutiveSummary(draft.sourceSnapshot);
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.kind === "executive_summary" ? { ...block, content: summary } : block),
    }));
    toast.success("Resumo executivo atualizado com os dados selecionados.");
  };

  const aiAction = (block: ReportBlock) => {
    const payload = buildReportAiPayload(draft, block.kind === "text" ? "improve_text" : block.kind === "conclusion" ? "conclusion" : "executive_summary", block.kind);
    if (!REPORTS_AI_FLAGS.apiEnabled) {
      toast.info(`Payload de IA preparado com ${payload.allowedContext.activities.length} atividades; backend de IA ainda não está ativo.`);
      return;
    }
    toast.info("Endpoint de IA configurado; conecte a mutation server-side para executar esta ação.");
  };

  const addBlock = () => {
    const activityIds = draft.sourceSnapshot.activities.map((activity) => activity.id);
    const evidenceIds = draft.sourceSnapshot.activities.flatMap((activity) => activity.evidences.map((evidence) => evidence.id));
    const metricIds = draft.metrics.map((metric) => metric.id);
    const block: ReportBlock = {
      id: createId(),
      kind: addKind,
      title: REPORT_BLOCK_LABELS[addKind],
      visible: true,
      order: draft.blocks.length,
      content: addKind === "text" ? "<p></p>" : "",
      activityIds: activityBlockKinds.has(addKind) ? activityIds : [],
      evidenceIds: evidenceBlockKinds.has(addKind) ? evidenceIds : [],
      metricIds: addKind === "indicators" ? metricIds : [],
      settings: {},
    };
    setDraft((current) => ({ ...current, blocks: [...current.blocks, block] }));
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    setDraft((current) => {
      const ordered = [...current.blocks].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return current;
      const next = [...ordered];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, blocks: next.map((block, order) => ({ ...block, order })) };
    });
  };

  const removeBlock = (id: string) => {
    setDraft((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== id).map((block, order) => ({ ...block, order })) }));
  };

  const downloadPdf = () => {
    downloadReportPdf(draft);
    controller.registerPdf(draft.id);
    toast.success("PDF gerado.");
  };

  return (
    <div className="mx-auto w-full max-w-[1720px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-3.5" /> Relatórios</button>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-10 min-w-[260px] max-w-xl rounded-md border-transparent bg-transparent px-0 text-2xl font-semibold tracking-tight text-slate-900 shadow-none focus-visible:border-transparent focus-visible:ring-0" />
            <StatusPill status={draft.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{draft.number} - {draft.clientName} - {formatDateBR(draft.periodStart)} a {formatDateBR(draft.periodEnd)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => save()}><Save className="size-3.5" /> Salvar rascunho</Button>
          <Button type="button" variant="outline" size="sm" onClick={finalize}><Check className="size-3.5" /> Finalizar</Button>
          <Button type="button" variant="outline" size="sm" onClick={downloadPdf}><Download className="size-3.5" /> Baixar PDF</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(true)}><Link2 className="size-3.5" /> Compartilhar</Button>
          <Button type="button" size="sm" onClick={() => setEmailOpen(true)}><Send className="size-3.5" /> Enviar relatório</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]">
        <section className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Responsável"><Input value={draft.responsible} onChange={(event) => setDraft((current) => ({ ...current, responsible: event.target.value }))} className="h-8 rounded-md text-xs shadow-none" /></Field>
              <Field label="Status editorial">
                <Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as ReportStatus }))}>
                  <SelectTrigger className="h-8 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Field label="Cor principal"><Input type="color" value={draft.visual.primaryColor} onChange={(event) => setDraft((current) => ({ ...current, visual: { ...current.visual, primaryColor: event.target.value } }))} className="h-8 rounded-md p-1 shadow-none" /></Field>
              <Field label="Cor secundária"><Input type="color" value={draft.visual.secondaryColor} onChange={(event) => setDraft((current) => ({ ...current, visual: { ...current.visual, secondaryColor: event.target.value } }))} className="h-8 rounded-md p-1 shadow-none" /></Field>
              <Field label="Assinatura"><Input value={draft.visual.signature} onChange={(event) => setDraft((current) => ({ ...current, visual: { ...current.visual, signature: event.target.value } }))} className="h-8 rounded-md text-xs shadow-none" /></Field>
              <Field label="Rodapé"><Input value={draft.visual.footer} onChange={(event) => setDraft((current) => ({ ...current, visual: { ...current.visual, footer: event.target.value } }))} className="h-8 rounded-md text-xs shadow-none" /></Field>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Editor em blocos</h2>
              <div className="flex items-center gap-2">
                <Select value={addKind} onValueChange={(value) => setAddKind(value as ReportBlockKind)}>
                  <SelectTrigger className="h-8 w-[190px] rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{availableBlockKinds.map((kind) => <SelectItem key={kind} value={kind}>{REPORT_BLOCK_LABELS[kind]}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addBlock}><Plus className="size-3.5" /> Bloco</Button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[...draft.blocks].sort((a, b) => a.order - b.order).map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  report={draft}
                  first={index === 0}
                  last={index === draft.blocks.length - 1}
                  onChange={(patch) => updateBlock(block.id, patch)}
                  onMove={(direction) => moveBlock(block.id, direction)}
                  onRemove={() => removeBlock(block.id)}
                  onAi={() => aiAction(block)}
                  onSummary={createLocalSummary}
                />
              ))}
            </div>
          </div>
        </section>
        <aside className="space-y-3">
          <div className="sticky top-5 space-y-3">
            <ReportPreview report={draft} />
            <Timeline events={draft.events} />
          </div>
        </aside>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} report={draft} controller={controller} onBeforeShare={finalize} onShared={(share) => setDraft((current) => ({ ...current, share }))} onRevoked={() => setDraft((current) => current.share ? { ...current, share: { ...current.share, revokedAt: new Date().toISOString() } } : current)} />
      <EmailDialog open={emailOpen} onOpenChange={setEmailOpen} report={draft} controller={controller} onBeforeSend={() => controller.finalizeReport(draft.id, editablePatch(draft))} />
    </div>
  );
}

function BlockEditor({ block, report, first, last, onChange, onMove, onRemove, onAi, onSummary }: { block: ReportBlock; report: WeekiReport; first: boolean; last: boolean; onChange: (patch: Partial<ReportBlock>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void; onAi: () => void; onSummary: () => void }) {
  const activities = report.sourceSnapshot.activities;
  const evidences = activities.flatMap((activity) => activity.evidences);
  const metrics = report.metrics;
  const toggle = <T extends string>(current: T[], value: T, checked: boolean) => checked ? Array.from(new Set([...current, value])) : current.filter((item) => item !== value);

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <header className="flex flex-wrap items-center gap-2">
        <div className="grid size-8 place-items-center rounded-md bg-white text-[#6548df]">{iconForBlock(block.kind)}</div>
        <Input value={block.title} onChange={(event) => onChange({ title: event.target.value })} className="h-8 min-w-[180px] flex-1 rounded-md bg-white text-xs font-semibold shadow-none" />
        <Switch checked={block.visible} onCheckedChange={(checked) => onChange({ visible: checked })} size="sm" />
        <button type="button" disabled={first} onClick={() => onMove(-1)} className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-white disabled:opacity-30" aria-label="Mover bloco para cima"><ArrowUp className="size-3.5" /></button>
        <button type="button" disabled={last} onClick={() => onMove(1)} className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-white disabled:opacity-30" aria-label="Mover bloco para baixo"><ArrowDown className="size-3.5" /></button>
        <button type="button" onClick={onRemove} className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover bloco"><Trash2 className="size-3.5" /></button>
      </header>
      <div className="mt-3 space-y-3">
        {textBlockKinds.has(block.kind) && (
          <>
            <RichTextEditor value={block.content} onChange={(content) => onChange({ content })} placeholder="Escreva o conteúdo deste bloco..." maxLength={5000} />
            <div className="flex flex-wrap gap-2">
              {block.kind === "executive_summary" && <Button type="button" variant="outline" size="sm" onClick={onSummary}><RefreshCcw className="size-3.5" /> Atualizar resumo</Button>}
              <Button type="button" variant="outline" size="sm" onClick={onAi}><Sparkles className="size-3.5" /> Gerar com IA</Button>
            </div>
          </>
        )}

        {block.kind === "cover" && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Subtítulo"><Input value={String(block.settings.subtitle ?? "")} onChange={(event) => onChange({ settings: { ...block.settings, subtitle: event.target.value } })} className="h-8 rounded-md bg-white text-xs shadow-none" /></Field>
            <Field label="Período"><Input value={String(block.settings.period ?? "")} onChange={(event) => onChange({ settings: { ...block.settings, period: event.target.value } })} className="h-8 rounded-md bg-white text-xs shadow-none" /></Field>
          </div>
        )}

        {block.kind === "indicators" && (
          <SelectionList items={metrics} selected={block.metricIds} onToggle={(id, checked) => onChange({ metricIds: toggle(block.metricIds, id, checked) })} label={(metric) => `${metric.label}: ${metric.value}`} detail={(metric) => metric.detail} />
        )}

        {activityBlockKinds.has(block.kind) && (
          <SelectionList items={activities} selected={block.activityIds} onToggle={(id, checked) => onChange({ activityIds: toggle(block.activityIds, id, checked) })} label={(activity) => activity.title} detail={(activity) => `${formatDateBR(activity.date)} - ${activity.statusLabel} - ${minutesLabel(activity.estimateMinutes)}`} />
        )}

        {evidenceBlockKinds.has(block.kind) && (
          <SelectionList items={evidences} selected={block.evidenceIds} onToggle={(id, checked) => onChange({ evidenceIds: toggle(block.evidenceIds, id, checked) })} label={(evidence) => evidence.title} detail={(evidence) => evidence.kind.replace("_", " ")} />
        )}

        {block.kind === "financial" && (
          <div className="rounded-lg bg-white p-3 text-[11px] text-slate-500">
            {report.sourceSnapshot.financial.charges.length + report.sourceSnapshot.financial.transactions.length ? "Dados financeiros selecionados serão exibidos na prévia." : "Nenhuma informação financeira foi selecionada para este relatório."}
          </div>
        )}
      </div>
    </article>
  );
}

function SelectionList<T extends { id: string }>({ items, selected, onToggle, label, detail }: { items: T[]; selected: string[]; onToggle: (id: string, checked: boolean) => void; label: (item: T) => string; detail: (item: T) => string }) {
  if (!items.length) return <p className="rounded-lg bg-white p-3 text-xs text-slate-400">Nenhum item disponível.</p>;
  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
      {items.map((item) => (
        <label key={item.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 p-2.5 last:border-b-0">
          <Checkbox checked={selected.includes(item.id)} onCheckedChange={(checked) => onToggle(item.id, checked === true)} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-slate-800">{label(item)}</span>
            <span className="mt-0.5 block text-[10px] text-slate-400">{detail(item)}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function ShareDialog({ open, onOpenChange, report, controller, onBeforeShare, onShared, onRevoked }: { open: boolean; onOpenChange: (open: boolean) => void; report: WeekiReport; controller: WeekiReportsController; onBeforeShare: () => void; onShared: (share: NonNullable<WeekiReport["share"]>) => void; onRevoked: () => void }) {
  const [allowDownload, setAllowDownload] = useState(true);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [link, setLink] = useState("");
  const visibleLink = link || (open && report.share ? publicUrlFor(report.share.token) : "");

  const createShare = () => {
    onBeforeShare();
    const share = controller.createShare(report.id, { allowDownload, password, expiresAt });
    if (!share) return;
    const url = publicUrlFor(share.token);
    setLink(url);
    onShared(share);
    if (copyToClipboard(url)) toast.success("Link copiado.");
    else toast.success("Link criado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 rounded-xl border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left"><DialogTitle className="text-base">Compartilhar relatório</DialogTitle><DialogDescription className="text-xs">Token público não sequencial, com expiração e revogação.</DialogDescription></DialogHeader>
        <div className="space-y-4 px-5 py-5">
          <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"><span>Permitir download</span><Switch checked={allowDownload} onCheckedChange={setAllowDownload} /></label>
          <Field label="Senha opcional"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-8 rounded-md text-xs shadow-none" /></Field>
          <Field label="Expira em"><Input type="date" min={todayKey()} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="h-8 rounded-md text-xs shadow-none" /></Field>
          {visibleLink && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="break-all text-[11px] text-slate-600">{visibleLink}</p></div>}
        </div>
        <DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          {report.share && !report.share.revokedAt && <Button type="button" variant="outline" size="sm" onClick={() => { controller.revokeShare(report.id); onRevoked(); toast.success("Link revogado."); }}><Archive className="size-3.5" /> Revogar</Button>}
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button type="button" size="sm" onClick={createShare}><Link2 className="size-3.5" /> Gerar link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailDialog({ open, onOpenChange, report, controller, onBeforeSend }: { open: boolean; onOpenChange: (open: boolean) => void; report: WeekiReport; controller: WeekiReportsController; onBeforeSend: () => void }) {
  const [recipient, setRecipient] = useState(report.sourceSnapshot.client?.email ?? "");
  const [subject, setSubject] = useState(`${report.title} - ${report.clientName}`);
  const [message, setMessage] = useState(`Olá,\n\nSegue o relatório ${report.title} referente ao período de ${formatDateBR(report.periodStart)} a ${formatDateBR(report.periodEnd)}.\n\nFico à disposição.`);
  const [includePdf, setIncludePdf] = useState(true);
  const [includeLink, setIncludeLink] = useState(Boolean(report.share));

  const send = () => {
    if (!recipient.trim()) {
      toast.error("Informe o destinatário.");
      return;
    }
    onBeforeSend();
    const link = report.share ? publicUrlFor(report.share.token) : "";
    controller.prepareEmail(report.id, { recipient: recipient.trim(), subject: subject.trim(), message, includePdf, includeLink });
    const body = `${message}${includeLink && link ? `\n\nLink do relatório: ${link}` : ""}${includePdf ? "\n\nPDF: baixe pela Weeki antes de anexar ao e-mail." : ""}`;
    window.location.href = `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body)}`;
    toast.success("E-mail preparado.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 rounded-xl border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left"><DialogTitle className="text-base">Enviar relatório</DialogTitle><DialogDescription className="text-xs">Mensagem editável antes do envio pelo seu cliente de e-mail.</DialogDescription></DialogHeader>
        <div className="space-y-4 px-5 py-5">
          <Field label="Destinatário" required><Input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} className="h-8 rounded-md text-xs shadow-none" /></Field>
          <Field label="Assunto" required><Input value={subject} onChange={(event) => setSubject(event.target.value)} className="h-8 rounded-md text-xs shadow-none" /></Field>
          <Field label="Mensagem"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="resize-none text-xs shadow-none" /></Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"><span>Anexar PDF</span><Switch checked={includePdf} onCheckedChange={setIncludePdf} /></label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"><span>Enviar link</span><Switch checked={includeLink} onCheckedChange={setIncludeLink} /></label>
          </div>
        </div>
        <DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/60 px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" size="sm" onClick={send}><Mail className="size-3.5" /> Abrir e-mail</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SharedReportAccess({ report, token, controller, onClose }: { report: WeekiReport | null; token: string; controller: WeekiReportsController; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(!report?.share?.passwordHash);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustment, setAdjustment] = useState("");
  const registeredOpenRef = useRef(false);
  const expired = Boolean(report?.share?.expiresAt && report.share.expiresAt < todayKey());
  const unavailable = !report || !report.share?.allowView || report.share.revokedAt || expired;

  useEffect(() => {
    if (!authorized || !report || registeredOpenRef.current || unavailable) return;
    controller.registerShareOpen(token);
    registeredOpenRef.current = true;
  }, [authorized, controller, report, token, unavailable]);

  if (unavailable) {
    return (
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <EmptyState icon={ShieldCheck} title={expired ? "Acesso expirado" : "Relatório não encontrado"} description="O link pode ter expirado, sido revogado ou não existir neste navegador." action={<Button type="button" variant="outline" size="sm" onClick={onClose}>Voltar</Button>} />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <form onSubmit={(event) => { event.preventDefault(); const ok = controller.checkSharePassword(token, password); setAuthorized(ok); if (!ok) toast.error("Senha inválida."); }} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-4 text-[#6548df]" /><h1 className="text-sm font-semibold text-slate-900">Relatório protegido</h1></div>
          <Field label="Senha"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field>
          <Button type="submit" size="sm" className="mt-4 w-full">Acessar</Button>
        </form>
      </div>
    );
  }

  const approve = () => {
    controller.registerClientDecision(token, "approved", "");
    toast.success("Relatório aprovado.");
  };
  const askAdjustment = () => {
    if (!adjustment.trim()) {
      toast.error("Descreva o ajuste necessário.");
      return;
    }
    controller.registerClientDecision(token, "adjustment_requested", adjustment);
    setAdjustOpen(false);
    toast.success("Ajuste solicitado.");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto mb-4 flex max-w-[900px] flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Visualização compartilhada</p><h1 className="mt-1 text-lg font-semibold text-slate-900">{report.title}</h1></div>
        <div className="flex flex-wrap gap-2">
          {report.share?.allowDownload && <Button type="button" variant="outline" size="sm" onClick={() => { downloadReportPdf(report); toast.success("PDF gerado."); }}><Download className="size-3.5" /> PDF</Button>}
          <Button type="button" variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>Solicitar ajuste</Button>
          <Button type="button" size="sm" onClick={approve}><Check className="size-3.5" /> Aprovar relatório</Button>
        </div>
      </div>
      <ReportPreview report={report} publicMode />
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md gap-0 rounded-xl border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left"><DialogTitle className="text-base">Solicitar ajuste</DialogTitle><DialogDescription className="text-xs">Isso atualiza o status operacional do relatório.</DialogDescription></DialogHeader>
          <div className="px-5 py-5"><Textarea value={adjustment} onChange={(event) => setAdjustment(event.target.value)} rows={5} placeholder="Descreva o ajuste necessário." className="resize-none text-xs shadow-none" /></div>
          <DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/60 px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => setAdjustOpen(false)}>Cancelar</Button><Button type="button" size="sm" onClick={askAdjustment}>Enviar solicitação</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplatesPanel({ templates, onDuplicate, onSave }: { templates: ReportTemplate[]; onDuplicate: (id: string) => void; onSave: (template: ReportTemplate) => void }) {
  const active = templates.filter((template) => !template.archivedAt);
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {active.map((template) => (
          <article key={template.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#f0edff] text-[#5b45dc]"><Layers3 className="size-4" /></span><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label={`Ações de ${template.name}`}><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onDuplicate(template.id)}><Copy /> Duplicar</DropdownMenuItem><DropdownMenuItem onSelect={() => onSave({ ...template, archivedAt: new Date().toISOString() })}><Archive /> Arquivar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">{template.name}</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{template.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{template.defaultBlocks.slice(0, 5).map((kind) => <span key={kind} className="rounded bg-slate-100 px-1.5 py-1 text-[9px] text-slate-500">{REPORT_BLOCK_LABELS[kind]}</span>)}</div>
          </article>
        ))}
      </div>
      <aside className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Modelos Weeki</h2>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">Os modelos definem blocos, ordem inicial e identidade visual básica. Relatórios criados a partir deles continuam editáveis.</p>
      </aside>
    </section>
  );
}

function SchedulesPanel({ schedules }: { schedules: ReportSchedule[] }) {
  if (!schedules.length) {
    return <div className="rounded-xl border border-slate-200 bg-white"><EmptyState icon={CalendarClock} title="Nenhum relatório recorrente" description="A estrutura de recorrência está pronta para backend; a V1 não envia automaticamente por padrão." /></div>;
  }
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[780px] text-left text-[11px]">
        <thead className="bg-slate-50 text-[9px] font-semibold uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Modelo</th><th className="px-4 py-3">Periodicidade</th><th className="px-4 py-3">Próxima geração</th><th className="px-4 py-3">Status</th></tr></thead>
        <tbody>{schedules.map((schedule) => <tr key={schedule.id} className="border-t border-slate-100"><td className="px-4 py-3">{schedule.clientName}</td><td className="px-4 py-3">{schedule.templateName}</td><td className="px-4 py-3">{schedule.frequency}</td><td className="px-4 py-3">{formatDateBR(schedule.nextRunAt)}</td><td className="px-4 py-3">{schedule.active ? "Ativo" : "Pausado"}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function Timeline({ events }: { events: WeekiReport["events"] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2"><History className="size-4 text-slate-400" /><h2 className="text-sm font-semibold text-slate-900">Histórico</h2></div>
      <div className="mt-4 space-y-3">{events.length ? events.slice(0, 8).map((event) => <div key={event.id} className="flex gap-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#5b45dc]"><Clock3 className="size-3.5" /></span><div className="min-w-0 border-b border-slate-100 pb-3"><p className="text-xs font-semibold text-slate-800">{event.title}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">{event.description}</p><p className="mt-1 text-[9px] text-slate-400">{formatDateBR(event.createdAt.slice(0, 10))} - {event.actor}</p></div></div>) : <p className="text-[11px] text-slate-400">Nenhum evento registrado.</p>}</div>
    </section>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return <div className="grid min-h-[280px] place-items-center px-4 text-center"><div><Icon className="mx-auto size-7 text-slate-300" /><h2 className="mt-3 text-sm font-semibold text-slate-800">{title}</h2><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">{description}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-[10px] font-semibold text-slate-600">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</Label>{children}</div>;
}

function PreviewCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: LucideIcon }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-md bg-slate-100 text-slate-500"><Icon className="size-4" /></span><div><p className="text-[10px] text-slate-400">{title}</p><p className="mt-0.5 text-xs font-semibold text-slate-900">{value}</p></div></div></article>;
}

function iconForBlock(kind: ReportBlockKind) {
  if (kind === "indicators") return <BarChart3 className="size-4" />;
  if (kind === "activities" || kind === "in_progress" || kind === "hours") return <ListChecks className="size-4" />;
  if (kind === "files" || kind === "images" || kind === "deliverables" || kind === "before_after") return <ImageIcon className="size-4" />;
  if (kind === "signature") return <Check className="size-4" />;
  return <FileText className="size-4" />;
}
