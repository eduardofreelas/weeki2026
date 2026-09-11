"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CalendarClock,
  Check,
  Clock3,
  Copy,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Filter,
  History,
  Layers3,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/weeki/rich-text-editor";
import type { BillingCharge } from "@/features/billing/types";
import { BILLING_METHOD_LABELS } from "@/features/billing/types";
import { useWeekiBilling } from "@/features/billing/use-weeki-billing";
import type { Client } from "@/features/clients/types";
import { CONTRACTS_FLAGS, generateContractWithAi, contractsMessage } from "@/features/contracts/api";
import type { WeekiContractsController } from "@/features/contracts/use-weeki-contracts";
import type { WeekiSettings } from "@/features/settings/types";
import type { Task } from "@/features/tasks/types";
import { STATUS_LABELS } from "@/features/tasks/types";
import { createId, formatBRL, formatCpfCnpj, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CONTRACT_EDITORIAL_STATUS_LABELS,
  CONTRACT_SIGNATURE_STATUS_LABELS,
  CONTRACT_SOURCE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_VARIABLES,
  LEGAL_REVIEW_NOTICE,
  contractVariableValues,
  emptyContractTerms,
  replaceContractVariables,
  stripHtml,
  validateContractForSignature,
  type ContractCreationSource,
  type ContractDraftInput,
  type ContractEvent,
  type ContractParty,
  type ContractServiceSnapshot,
  type ContractSignatureStatus,
  type ContractSigner,
  type ContractSourceSnapshot,
  type ContractStatus,
  type ContractTemplate,
  type ContractTerms,
  type WeekiContract,
} from "@/shared/contracts";

type ContractsView = "list" | "new" | "detail" | "templates";
type ContractListTab = "all" | "draft" | "review" | "signature" | "active" | "done";
type ContractSort = "updated" | "created" | "value" | "endDate";
type ComposerStep = "origin" | "parties" | "service" | "values" | "clauses" | "review";

const steps: Array<{ id: ComposerStep; label: string }> = [
  { id: "origin", label: "Origem" },
  { id: "parties", label: "Partes" },
  { id: "service", label: "Serviço" },
  { id: "values", label: "Valores" },
  { id: "clauses", label: "Cláusulas" },
  { id: "review", label: "Revisão" },
];

const signatureBadgeStyles: Record<ContractSignatureStatus, string> = {
  not_started: "bg-slate-100 text-slate-600",
  preparing: "bg-blue-50 text-blue-700",
  sent: "bg-amber-50 text-amber-700",
  viewed: "bg-cyan-50 text-cyan-700",
  partially_signed: "bg-[#f0edff] text-[#5a45da]",
  signed: "bg-emerald-50 text-emerald-700",
  declined: "bg-rose-50 text-rose-700",
  expired: "bg-orange-50 text-orange-700",
  cancelled: "bg-slate-100 text-slate-500",
  error: "bg-rose-50 text-rose-700",
};

const contractBadgeStyles: Record<ContractStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  ending_soon: "bg-amber-50 text-amber-700",
  ended: "bg-blue-50 text-blue-700",
  terminated: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
  archived: "bg-slate-100 text-slate-400",
};

const creationOptions: Array<{ id: ContractCreationSource; title: string; description: string; icon: LucideIcon }> = [
  { id: "ai", title: "Criar com IA", description: "Gere uma primeira versão editável no backend.", icon: WandSparkles },
  { id: "template", title: "Usar um modelo", description: "Comece por cláusulas reutilizáveis.", icon: Layers3 },
  { id: "manual", title: "Criar do zero", description: "Monte o contrato manualmente.", icon: Edit3 },
  { id: "proposal", title: "A partir de proposta", description: "Use um arquivo de proposta do cliente como origem.", icon: FileCheck2 },
];

const defaultSignatureMessage = "Olá! Segue o contrato para revisão e assinatura eletrônica. Qualquer dúvida, fico à disposição.";

export function ContractsScreen({
  clients,
  tasks,
  settings,
  controller,
}: {
  clients: Client[];
  tasks: Task[];
  settings: WeekiSettings;
  controller: WeekiContractsController;
}) {
  const { charges } = useWeekiBilling();
  const [view, setView] = useState<ContractsView>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = controller.contracts.find((contract) => contract.id === selectedId) ?? null;
  const openDetail = (contract: WeekiContract) => {
    setSelectedId(contract.id);
    setView("detail");
  };

  if (view === "new") {
    return (
      <ContractComposer
        clients={clients}
        tasks={tasks}
        charges={charges}
        settings={settings}
        templates={controller.templates}
        onCancel={() => setView("list")}
        onSave={(draft) => {
          const contract = controller.createContract(draft);
          toast.success("Contrato salvo como rascunho.");
          openDetail(contract);
        }}
      />
    );
  }

  if (view === "templates") {
    return (
      <TemplateManager
        templates={controller.templates}
        onBack={() => setView("list")}
        onSave={controller.saveTemplate}
        onDuplicate={controller.duplicateTemplate}
      />
    );
  }

  if (view === "detail" && selected) {
    return (
      <ContractDetail
        contract={selected}
        clients={clients}
        tasks={tasks}
        charges={charges}
        onBack={() => setView("list")}
        onEdit={(changes, recordEvent) => controller.updateContract(selected.id, changes, recordEvent)}
        onVersion={(reason, options) => controller.createVersion(selected.id, reason, options)}
        onDuplicate={() => {
          const copy = controller.duplicateContract(selected.id);
          if (copy) {
            toast.success("Contrato duplicado.");
            openDetail(copy);
          }
        }}
        onArchive={() => {
          controller.archiveContract(selected.id);
          toast.success("Contrato arquivado.");
          setView("list");
        }}
        onDeleteDraft={() => {
          controller.deleteDraft(selected.id);
          toast.success("Rascunho excluído.");
          setView("list");
        }}
      />
    );
  }

  return (
    <ContractsDashboard
      contracts={controller.contracts}
      clients={clients}
      tasks={tasks}
      onNew={() => setView("new")}
      onTemplates={() => setView("templates")}
      onOpen={openDetail}
      onDuplicate={(contract) => {
        const copy = controller.duplicateContract(contract.id);
        if (copy) toast.success("Contrato duplicado.");
      }}
      onArchive={(contract) => {
        controller.archiveContract(contract.id);
        toast.success("Contrato arquivado.");
      }}
      onDeleteDraft={(contract) => {
        controller.deleteDraft(contract.id);
        toast.success("Rascunho excluído.");
      }}
    />
  );
}

function ContractsDashboard({
  contracts,
  clients,
  tasks,
  onNew,
  onTemplates,
  onOpen,
  onDuplicate,
  onArchive,
  onDeleteDraft,
}: {
  contracts: WeekiContract[];
  clients: Client[];
  tasks: Task[];
  onNew: () => void;
  onTemplates: () => void;
  onOpen: (contract: WeekiContract) => void;
  onDuplicate: (contract: WeekiContract) => void;
  onArchive: (contract: WeekiContract) => void;
  onDeleteDraft: (contract: WeekiContract) => void;
}) {
  const [tab, setTab] = useState<ContractListTab>("all");
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [signatureFilter, setSignatureFilter] = useState<ContractSignatureStatus | "all">("all");
  const [sort, setSort] = useState<ContractSort>("updated");

  const indicators = useMemo(() => ({
    drafts: contracts.filter((contract) => contract.editorialStatus === "draft").length,
    review: contracts.filter((contract) => contract.editorialStatus === "review").length,
    waiting: contracts.filter((contract) => ["sent", "viewed", "partially_signed"].includes(contract.signatureStatus)).length,
    partial: contracts.filter((contract) => contract.signatureStatus === "partially_signed").length,
    active: contracts.filter((contract) => contract.contractStatus === "active").length,
    ending: contracts.filter((contract) => contract.contractStatus === "ending_soon").length,
    done: contracts.filter((contract) => ["signed", "ended"].includes(contract.signatureStatus) || contract.contractStatus === "ended").length,
  }), [contracts]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return contracts
      .filter((contract) => {
        const task = tasks.find((item) => item.id === contract.relatedTaskId);
        const matchesText = !normalized || `${contract.number} ${contract.title} ${contract.clientName} ${task?.title ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalized);
        const matchesTab =
          tab === "all" ||
          (tab === "draft" && contract.editorialStatus === "draft") ||
          (tab === "review" && contract.editorialStatus === "review") ||
          (tab === "signature" && ["sent", "viewed", "partially_signed"].includes(contract.signatureStatus)) ||
          (tab === "active" && contract.contractStatus === "active") ||
          (tab === "done" && ["signed", "ended"].includes(contract.signatureStatus));
        return matchesText &&
          matchesTab &&
          (clientFilter === "all" || contract.clientId === clientFilter) &&
          (signatureFilter === "all" || contract.signatureStatus === signatureFilter);
      })
      .sort((a, b) => {
        if (sort === "value") return b.terms.value - a.terms.value;
        if (sort === "endDate") return (a.terms.endDate || "9999-12-31").localeCompare(b.terms.endDate || "9999-12-31");
        if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [contracts, query, clientFilter, signatureFilter, sort, tab, tasks]);

  const tabs: Array<{ id: ContractListTab; label: string; count: number }> = [
    { id: "all", label: "Todos", count: contracts.length },
    { id: "draft", label: "Rascunhos", count: indicators.drafts },
    { id: "review", label: "Em revisão", count: indicators.review },
    { id: "signature", label: "Aguardando assinatura", count: indicators.waiting },
    { id: "active", label: "Ativos", count: indicators.active },
    { id: "done", label: "Concluídos", count: indicators.done },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground"><FileSignature className="size-4" /></span>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Contratos</h1>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">Crie, versione, revise e acompanhe contratos vinculados a clientes, demandas e cobranças.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onTemplates}><Layers3 className="size-3.5" /> Modelos</Button>
          <Button type="button" size="sm" onClick={onNew}><Plus className="size-3.5" /> Novo contrato</Button>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Indicator label="Rascunhos" value={indicators.drafts} tone="slate" />
        <Indicator label="Em revisão" value={indicators.review} tone="violet" />
        <Indicator label="Aguardando" value={indicators.waiting} tone="amber" />
        <Indicator label="Parciais" value={indicators.partial} tone="cyan" />
        <Indicator label="Ativos" value={indicators.active} tone="emerald" />
        <Indicator label="Vencendo" value={indicators.ending} tone="orange" />
        <Indicator label="Concluídos" value={indicators.done} tone="blue" />
      </section>

      {!CONTRACTS_FLAGS.apiEnabled && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Modo operacional local</p>
            <p className="mt-0.5 text-[11px] leading-4 text-amber-800">Criação, edição, snapshots e versões estão disponíveis neste navegador. IA, PDF backend, envio real para assinatura e webhooks ficam ocultos até ativar o backend e as credenciais.</p>
          </div>
        </div>
      )}

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="week-board-scroll flex max-w-full gap-1 overflow-x-auto">
            {tabs.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("h-8 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600", tab === item.id && "border-slate-900 bg-slate-900 text-white")}>
                {item.label}<span className={cn("ml-1 text-slate-400", tab === item.id && "text-white/55")}>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(value) => setSort(value as ContractSort)}>
              <SelectTrigger className="h-8 w-[150px] rounded-md bg-white text-[11px] shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Mais recentes</SelectItem>
                <SelectItem value="created">Criação</SelectItem>
                <SelectItem value="value">Maior valor</SelectItem>
                <SelectItem value="endDate">Vencimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por número, cliente ou título..." className="h-8 rounded-md bg-slate-50 pl-8 text-[11px] shadow-none" />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={signatureFilter} onValueChange={(value) => setSignatureFilter(value as ContractSignatureStatus | "all")}>
            <SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><Filter className="size-3.5" /><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Assinatura</SelectItem>{Object.entries(CONTRACT_SIGNATURE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </section>

      <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length ? (
          <>
            <div className="week-board-scroll hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1120px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-[0.055em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Contrato</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Serviço / projeto</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Vigência</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assinaturas</th>
                    <th className="px-4 py-3">Atualização</th>
                    <th className="w-12 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((contract) => (
                    <ContractRow key={contract.id} contract={contract} task={tasks.find((item) => item.id === contract.relatedTaskId)} onOpen={() => onOpen(contract)} onDuplicate={() => onDuplicate(contract)} onArchive={() => onArchive(contract)} onDeleteDraft={() => onDeleteDraft(contract)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {filtered.map((contract) => (
                <button key={contract.id} type="button" onClick={() => onOpen(contract)} className="w-full px-4 py-3 text-left">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-900">{contract.title}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">{contract.number} - {contract.clientName}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{formatBRL(contract.terms.value)}</span>
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <StatusPill label={CONTRACT_STATUS_LABELS[contract.contractStatus]} className={contractBadgeStyles[contract.contractStatus]} />
                    <StatusPill label={CONTRACT_SIGNATURE_STATUS_LABELS[contract.signatureStatus]} className={signatureBadgeStyles[contract.signatureStatus]} />
                  </span>
                </button>
              ))}
            </div>
            <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-[10px] text-slate-400">
              <span>Mostrando {filtered.length} de {contracts.length} contratos</span>
              <span>Página 1</span>
            </footer>
          </>
        ) : (
          <div className="grid min-h-[300px] place-items-center px-4 text-center">
            <div>
              <FileSignature className="mx-auto size-7 text-slate-300" />
              <h2 className="mt-3 text-sm font-semibold text-slate-800">{contracts.length ? "Nenhum contrato encontrado" : "Crie seu primeiro contrato"}</h2>
              <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-slate-400">{contracts.length ? "Ajuste os filtros para ver outros registros." : "Use dados de clientes, demandas e cobranças para montar um rascunho com menos preenchimento manual."}</p>
              <Button type="button" size="sm" onClick={onNew} className="mt-4"><Plus className="size-3.5" /> Novo contrato</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ContractRow({ contract, task, onOpen, onDuplicate, onArchive, onDeleteDraft }: { contract: WeekiContract; task?: Task; onOpen: () => void; onDuplicate: () => void; onArchive: () => void; onDeleteDraft: () => void }) {
  return (
    <tr className="text-[11px] text-slate-600 transition hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <button type="button" onClick={onOpen} className="block max-w-[230px] text-left">
          <span className="block truncate font-semibold text-slate-900 hover:text-[#5b45dc]">{contract.title}</span>
          <span className="mt-0.5 block text-[9px] text-slate-400">{contract.number} - {CONTRACT_SOURCE_LABELS[contract.source]}</span>
        </button>
      </td>
      <td className="px-4 py-3"><span className="font-medium text-slate-800">{contract.clientName}</span></td>
      <td className="px-4 py-3"><span className="block max-w-[210px] truncate">{contract.sourceSnapshot.service.title || task?.title || "Sem vínculo"}</span>{task && <span className="mt-0.5 block text-[9px] text-slate-400">{STATUS_LABELS[task.status]}</span>}</td>
      <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">{formatBRL(contract.terms.value)}</td>
      <td className="px-4 py-3"><span className="tabular-nums">{contract.terms.startDate ? formatDateBR(contract.terms.startDate) : "-"}</span><span className="text-slate-300"> até </span><span className="tabular-nums">{contract.terms.endDate ? formatDateBR(contract.terms.endDate) : "indeterminado"}</span></td>
      <td className="px-4 py-3"><StatusPill label={CONTRACT_STATUS_LABELS[contract.contractStatus]} className={contractBadgeStyles[contract.contractStatus]} /></td>
      <td className="px-4 py-3"><div className="flex flex-col gap-1"><StatusPill label={CONTRACT_SIGNATURE_STATUS_LABELS[contract.signatureStatus]} className={signatureBadgeStyles[contract.signatureStatus]} /><span className="text-[9px] text-slate-400">{contract.signers.length} signatário(s)</span></div></td>
      <td className="px-4 py-3 text-[10px] text-slate-400">{format(parseISO(contract.updatedAt), "dd MMM, HH:mm", { locale: ptBR })}</td>
      <td className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label="Ações do contrato"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onOpen}><Eye /> Visualizar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}><Copy /> Duplicar</DropdownMenuItem>
            <DropdownMenuItem disabled={!CONTRACTS_FLAGS.apiEnabled}><Download /> Gerar PDF</DropdownMenuItem>
            <DropdownMenuItem disabled={!CONTRACTS_FLAGS.signatureEnabled}><Send /> Enviar para assinatura</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}><Archive /> Arquivar</DropdownMenuItem>
            {contract.editorialStatus === "draft" && contract.signatureStatus === "not_started" && <DropdownMenuItem variant="destructive" onSelect={onDeleteDraft}><Trash2 /> Excluir rascunho</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function ContractComposer({
  clients,
  tasks,
  charges,
  settings,
  templates,
  onCancel,
  onSave,
}: {
  clients: Client[];
  tasks: Task[];
  charges: BillingCharge[];
  settings: WeekiSettings;
  templates: ContractTemplate[];
  onCancel: () => void;
  onSave: (draft: ContractDraftInput) => void;
}) {
  const favoriteTemplate = templates.find((template) => template.favorite && !template.archivedAt) ?? templates.find((template) => !template.archivedAt);
  const [step, setStep] = useState<ComposerStep>("origin");
  const [source, setSource] = useState<ContractCreationSource>("template");
  const [templateId, setTemplateId] = useState(favoriteTemplate?.id ?? "");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [taskId, setTaskId] = useState("");
  const [chargeId, setChargeId] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [title, setTitle] = useState("Contrato de Prestação de Serviços");
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceScope, setServiceScope] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [deadline, setDeadline] = useState("");
  const [revisions, setRevisions] = useState("2");
  const [terms, setTerms] = useState<ContractTerms>(() => ({ ...emptyContractTerms(), startDate: new Date().toISOString().slice(0, 10) }));
  const [content, setContent] = useState(favoriteTemplate?.content ?? "");
  const [signers, setSigners] = useState<ContractSigner[]>(() => [emptySigner()]);
  const [signingMode, setSigningMode] = useState<"simultaneous" | "ordered">("simultaneous");
  const [signatureMessage, setSignatureMessage] = useState(defaultSignatureMessage);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);

  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const selectedTask = tasks.find((task) => task.id === taskId) ?? null;
  const selectedCharge = charges.find((charge) => charge.id === chargeId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? favoriteTemplate ?? null;
  const clientProposals = selectedClient?.files.filter((file) => /proposta|orcamento|orçamento/i.test(file.name)) ?? [];

  const updateTerms = (patch: Partial<ContractTerms>) => setTerms((current) => ({ ...current, ...patch }));
  const sourceSnapshot = () => buildSnapshot({
    settings,
    client: selectedClient,
    task: selectedTask,
    charge: selectedCharge,
    proposal: clientProposals.find((file) => file.id === proposalId) ?? null,
    serviceTitle,
    serviceDescription,
    serviceScope,
    deliverables,
    deadline,
    revisions,
  });
  const applyTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id);
    setTemplateId(id);
    if (template) setContent(template.content);
  };
  const applyClient = (id: string) => {
    const client = clients.find((item) => item.id === id) ?? null;
    setClientId(id);
    setSigners((current) => current.length && current[0].name ? current : [emptySigner(client)]);
    if (client?.contractValue && !terms.value) updateTerms({ value: client.contractValue });
  };
  const applyTask = (id: string) => {
    const task = tasks.find((item) => item.id === id) ?? null;
    setTaskId(id);
    if (!task) return;
    setServiceTitle(task.title);
    setServiceDescription(stripHtml(task.description));
    setServiceScope(stripHtml(task.description || task.title));
    if (!title.trim() || title === "Contrato de Prestação de Serviços") setTitle(`Contrato - ${task.title}`);
  };
  const applyCharge = (id: string) => {
    const charge = charges.find((item) => item.id === id) ?? null;
    setChargeId(id);
    if (!charge) return;
    updateTerms({
      value: charge.amount,
      firstDueDate: charge.dueDate,
      paymentTerms: `${charge.methods.map((method) => BILLING_METHOD_LABELS[method]).join(", ")} com vencimento em ${formatDateBR(charge.dueDate)}.`,
    });
    if (!serviceTitle) setServiceTitle(charge.description);
  };
  function makeDraft(aiGenerated = false, aiProvider: string | null = null): ContractDraftInput {
    const snapshot = sourceSnapshot();
    const parties = buildParties(snapshot);
    return {
      source,
      title: title.trim() || "Contrato sem título",
      clientId: selectedClient?.id ?? null,
      templateId: source === "template" ? selectedTemplate?.id ?? null : null,
      relatedServiceId: selectedTask?.id ?? null,
      relatedTaskId: selectedTask?.id ?? null,
      proposalId: proposalId || null,
      chargeId: selectedCharge?.id ?? null,
      sourceSnapshot: snapshot,
      terms,
      parties,
      signers: signers.map((signer, index) => ({ ...signer, order: signingMode === "ordered" ? index + 1 : 1 })),
      signingMode,
      signatureMessage,
      content,
      aiGenerated,
      aiProvider,
    };
  }

  const issues = validateDraftPreview(makeDraft());

  const generateAi = async () => {
    if (!CONTRACTS_FLAGS.apiEnabled || !CONTRACTS_FLAGS.aiEnabled) {
      toast.info("Ative o backend e a chave de IA para gerar contratos.");
      return;
    }
    setAiLoading(true);
    try {
      const result = await generateContractWithAi({
        instructions: aiInstructions,
        sourceSnapshot: sourceSnapshot(),
        terms,
        clauses: {
          cancellation: terms.cancellation,
          termination: terms.termination,
          intellectualProperty: terms.intellectualProperty,
          dataProtection: terms.dataProtection,
          additionalClauses: terms.additionalClauses,
        },
      });
      setTitle(result.title || title);
      setContent(result.content);
      setAiWarnings([...result.missingFields, ...result.warnings]);
      setSource("ai");
      toast.success("Contrato gerado pela IA para revisão.");
    } catch (error) {
      toast.error(contractsMessage(error));
    } finally {
      setAiLoading(false);
    }
  };

  const save = () => {
    const draft = makeDraft(source === "ai" && Boolean(aiWarnings.length || aiInstructions), source === "ai" ? "openai" : null);
    const previewIssues = validateDraftPreview(draft);
    if (previewIssues.some((issue) => ["title", "client", "service", "content"].includes(issue.field))) {
      toast.error(previewIssues[0].message);
      return;
    }
    onSave(draft);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button type="button" onClick={onCancel} className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-3.5" /> Contratos</button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Novo contrato</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Revise os dados importados antes de gerar ou enviar qualquer documento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button type="button" size="sm" onClick={save}><Check className="size-3.5" /> Salvar rascunho</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-2 xl:sticky xl:top-5">
          {steps.map((item, index) => (
            <button key={item.id} type="button" onClick={() => setStep(item.id)} className={cn("flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] font-medium text-slate-500 transition hover:bg-slate-50", step === item.id && "bg-[#f0edff] text-[#5b45dc]")}>
              <span className={cn("grid size-5 place-items-center rounded-full border text-[9px]", step === item.id ? "border-[#5b45dc] bg-[#5b45dc] text-white" : "border-slate-200")}>{index + 1}</span>
              {item.label}
            </button>
          ))}
        </aside>

        <section className="min-w-0">
          {step === "origin" && (
            <ComposerSection icon={FileSignature} title="Origem do contrato" aside="Etapa 1 de 6">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {creationOptions.map((option) => (
                  <button key={option.id} type="button" onClick={() => setSource(option.id)} className={cn("min-h-32 rounded-lg border p-3 text-left transition", source === option.id ? "border-[#7561e8] bg-[#f1efff]" : "border-slate-200 bg-white hover:border-[#b8aef4]")}>
                    <span className="flex items-center justify-between"><span className={cn("grid size-8 place-items-center rounded-md", source === option.id ? "bg-[#5b45dc] text-white" : "bg-slate-100 text-slate-500")}><option.icon className="size-4" /></span>{source === option.id && <Check className="size-4 text-[#5b45dc]" />}</span>
                    <span className="mt-3 block text-xs font-semibold text-slate-900">{option.title}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-slate-500">{option.description}</span>
                  </button>
                ))}
              </div>
              {source === "template" && <Field label="Modelo"><Select value={templateId} onValueChange={applyTemplate}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue placeholder="Selecione um modelo" /></SelectTrigger><SelectContent>{templates.filter((template) => !template.archivedAt).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></Field>}
              {source === "proposal" && <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">A Weeki ainda não possui um módulo dedicado de propostas. Nesta etapa, usamos arquivos do cliente com nome de proposta/orçamento apenas como referência de origem.</p>}
              <Field label="Título do contrato" required><Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field>
              <StepActions step={step} onStep={setStep} />
            </ComposerSection>
          )}

          {step === "parties" && (
            <ComposerSection icon={UserRoundPlus} title="Partes e signatários" aside="Etapa 2 de 6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Cliente cadastrado" required><Select value={clientId} onValueChange={applyClient}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Proposta/orçamento de origem"><Select value={proposalId || "none"} onValueChange={(value) => setProposalId(value === "none" ? "" : value)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem proposta vinculada</SelectItem>{clientProposals.map((file) => <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>)}</SelectContent></Select></Field>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <SnapshotCard title="Seu negócio" rows={[settings.profile.businessName || settings.profile.name, settings.profile.email, settings.profile.phone || "Telefone não informado"]} />
                <SnapshotCard title="Cliente" rows={[selectedClient?.name || "Selecione um cliente", selectedClient?.email || "E-mail não informado", selectedClient?.document || "CPF/CNPJ não informado"]} />
              </div>
              <SignerEditor signers={signers} onChange={setSigners} signingMode={signingMode} onSigningModeChange={setSigningMode} client={selectedClient} settings={settings} />
              <StepActions step={step} onStep={setStep} />
            </ComposerSection>
          )}

          {step === "service" && (
            <ComposerSection icon={FileText} title="Serviço, escopo e entregas" aside="Etapa 3 de 6">
              <Field label="Demanda/projeto relacionado"><Select value={taskId || "none"} onValueChange={(value) => applyTask(value === "none" ? "" : value)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem vínculo</SelectItem>{tasks.filter((task) => !clientId || task.clientId === clientId).map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}</SelectContent></Select></Field>
              <div className="grid gap-4 lg:grid-cols-2"><Field label="Serviço" required><Input value={serviceTitle} onChange={(event) => setServiceTitle(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Revisões incluídas"><Input value={revisions} onChange={(event) => setRevisions(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field></div>
              <Field label="Descrição"><Textarea value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} rows={3} className="resize-none text-xs shadow-none" /></Field>
              <Field label="Escopo" required><Textarea value={serviceScope} onChange={(event) => setServiceScope(event.target.value)} rows={4} className="resize-none text-xs shadow-none" /></Field>
              <div className="grid gap-4 lg:grid-cols-2"><Field label="Entregas"><Textarea value={deliverables} onChange={(event) => setDeliverables(event.target.value)} rows={3} className="resize-none text-xs shadow-none" /></Field><Field label="Prazos"><Textarea value={deadline} onChange={(event) => setDeadline(event.target.value)} rows={3} className="resize-none text-xs shadow-none" /></Field></div>
              <StepActions step={step} onStep={setStep} />
            </ComposerSection>
          )}

          {step === "values" && (
            <ComposerSection icon={CalendarClock} title="Valores e condições" aside="Etapa 4 de 6">
              <Field label="Cobrança relacionada"><Select value={chargeId || "none"} onValueChange={(value) => applyCharge(value === "none" ? "" : value)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem cobrança vinculada</SelectItem>{charges.filter((charge) => !clientId || charge.clientId === clientId).map((charge) => <SelectItem key={charge.id} value={charge.id}>{charge.code} - {charge.description}</SelectItem>)}</SelectContent></Select></Field>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Valor total" required><MoneyInput value={terms.value} onChange={(value) => updateTerms({ value })} /></Field>
                <Field label="Parcelas"><Input type="number" min={1} value={terms.installments} onChange={(event) => updateTerms({ installments: Math.max(1, Number(event.target.value) || 1) })} className="h-9 rounded-md text-xs shadow-none" /></Field>
                <Field label="Primeiro vencimento"><Input type="date" value={terms.firstDueDate} onChange={(event) => updateTerms({ firstDueDate: event.target.value })} className="h-9 rounded-md text-xs shadow-none" /></Field>
                <Field label="Reajuste"><Input value={terms.adjustment} onChange={(event) => updateTerms({ adjustment: event.target.value })} placeholder="Ex.: IPCA anual" className="h-9 rounded-md text-xs shadow-none" /></Field>
              </div>
              <Field label="Condições de pagamento" required><Textarea value={terms.paymentTerms} onChange={(event) => updateTerms({ paymentTerms: event.target.value })} rows={3} className="resize-none text-xs shadow-none" /></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Multa (%)"><Input type="number" min={0} step="0.01" value={terms.lateFeePercent} onChange={(event) => updateTerms({ lateFeePercent: Number(event.target.value) || 0 })} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Juros ao dia (%)"><Input type="number" min={0} step="0.001" value={terms.dailyInterestPercent} onChange={(event) => updateTerms({ dailyInterestPercent: Number(event.target.value) || 0 })} className="h-9 rounded-md text-xs shadow-none" /></Field></div>
              <StepActions step={step} onStep={setStep} />
            </ComposerSection>
          )}

          {step === "clauses" && (
            <ComposerSection icon={ShieldCheck} title="Cláusulas principais" aside="Etapa 5 de 6">
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Início da vigência" required><Input type="date" value={terms.startDate} onChange={(event) => updateTerms({ startDate: event.target.value })} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Término da vigência"><Input type="date" value={terms.endDate} onChange={(event) => updateTerms({ endDate: event.target.value })} className="h-9 rounded-md text-xs shadow-none" /></Field></div>
              <Field label="Cancelamento"><Textarea value={terms.cancellation} onChange={(event) => updateTerms({ cancellation: event.target.value })} rows={3} className="resize-none text-xs shadow-none" /></Field>
              <Field label="Rescisão"><Textarea value={terms.termination} onChange={(event) => updateTerms({ termination: event.target.value })} rows={3} className="resize-none text-xs shadow-none" /></Field>
              <div className="grid gap-3 sm:grid-cols-2"><ToggleCard label="Confidencialidade" checked={terms.confidentiality} onChange={(checked) => updateTerms({ confidentiality: checked })} /><ToggleCard label="Autoriza portfólio" checked={terms.portfolioAllowed} onChange={(checked) => updateTerms({ portfolioAllowed: checked })} /></div>
              <Field label="Propriedade intelectual"><Textarea value={terms.intellectualProperty} onChange={(event) => updateTerms({ intellectualProperty: event.target.value })} rows={3} className="resize-none text-xs shadow-none" /></Field>
              <Field label="Proteção de dados / LGPD"><Textarea value={terms.dataProtection} onChange={(event) => updateTerms({ dataProtection: event.target.value })} rows={3} className="resize-none text-xs shadow-none" /></Field>
              <Field label="Foro"><Input value={terms.jurisdiction} onChange={(event) => updateTerms({ jurisdiction: event.target.value })} placeholder="Ex.: Fortaleza/CE" className="h-9 rounded-md text-xs shadow-none" /></Field>
              <Field label="Cláusulas adicionais"><Textarea value={terms.additionalClauses} onChange={(event) => updateTerms({ additionalClauses: event.target.value })} rows={4} className="resize-none text-xs shadow-none" /></Field>
              <StepActions step={step} onStep={setStep} />
            </ComposerSection>
          )}

          {step === "review" && (
            <ComposerSection icon={Eye} title="Revisão e documento" aside="Etapa 6 de 6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">{LEGAL_REVIEW_NOTICE}</div>
              <Field label="Mensagem do envio por e-mail"><Textarea value={signatureMessage} onChange={(event) => setSignatureMessage(event.target.value)} rows={3} className="resize-none text-xs shadow-none" /></Field>
              {source === "ai" && (
                <div className="rounded-lg border border-[#ded8ff] bg-[#f5f3ff] p-3">
                  <Field label="Instruções para IA"><Textarea value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} rows={3} placeholder="Ex.: contrato mais formal, incluir confidencialidade reforçada..." className="resize-none text-xs shadow-none" /></Field>
                  <Button type="button" size="sm" onClick={generateAi} disabled={aiLoading || !CONTRACTS_FLAGS.apiEnabled || !CONTRACTS_FLAGS.aiEnabled} className="mt-3"><WandSparkles className="size-3.5" /> {aiLoading ? "Gerando..." : "Gerar contrato com IA"}</Button>
                  {(!CONTRACTS_FLAGS.apiEnabled || !CONTRACTS_FLAGS.aiEnabled) && <p className="mt-2 text-[10px] text-slate-500">Disponível após ativar `NEXT_PUBLIC_CONTRACTS_API_ENABLED`, `NEXT_PUBLIC_CONTRACTS_AI_ENABLED` e a chave server-side.</p>}
                  {aiWarnings.length > 0 && <ul className="mt-3 space-y-1 text-[10px] text-amber-700">{aiWarnings.map((warning) => <li key={warning}>- {warning}</li>)}</ul>}
                </div>
              )}
              <RichTextEditor value={content} onChange={setContent} placeholder="Escreva ou gere o contrato..." maxLength={45000} className="min-h-[420px]" />
              {issues.length > 0 && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700"><strong>{issues.length} pendência(s):</strong> {issues.slice(0, 3).map((issue) => issue.message).join(" ")}</div>}
              <StepActions step={step} onStep={setStep} />
            </ComposerSection>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-5">
          <PreviewPanel title={title} content={content} snapshot={sourceSnapshot()} terms={terms} />
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-semibold text-slate-900">Validação</h2>
            <div className="mt-3 space-y-2">
              {issues.length ? issues.slice(0, 6).map((issue) => <ValidationRow key={`${issue.section}-${issue.field}-${issue.message}`} ok={false} text={issue.message} />) : <ValidationRow ok text="Pronto para salvar como rascunho." />}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ContractDetail({
  contract,
  clients,
  tasks,
  charges,
  onBack,
  onEdit,
  onVersion,
  onDuplicate,
  onArchive,
  onDeleteDraft,
}: {
  contract: WeekiContract;
  clients: Client[];
  tasks: Task[];
  charges: BillingCharge[];
  onBack: () => void;
  onEdit: (changes: Partial<WeekiContract>, recordEvent?: boolean) => WeekiContract | null;
  onVersion: (reason: string, options?: { immutable?: boolean; aiGenerated?: boolean }) => unknown;
  onDuplicate: () => void;
  onArchive: () => void;
  onDeleteDraft: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [contentDraft, setContentDraft] = useState(contract.content);
  const [reviewChecked, setReviewChecked] = useState(contract.reviewConfirmed);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const task = tasks.find((item) => item.id === contract.relatedTaskId);
  const charge = charges.find((item) => item.id === contract.chargeId);
  const client = clients.find((item) => item.id === contract.clientId);
  const signatureIssues = validateContractForSignature({ ...contract, content: contentDraft, reviewConfirmed: reviewChecked });
  const renderedContent = replaceContractVariables(contract.content, contractVariableValues(contract));
  const canDelete = contract.editorialStatus === "draft" && contract.signatureStatus === "not_started";
  const latestRequest = contract.signatureRequests[0];

  const saveContent = () => {
    onEdit({ content: contentDraft, editorialStatus: "review" }, false);
    onVersion("Revisão manual do documento");
    setEditing(false);
    toast.success("Versão criada.");
  };

  const confirmReview = () => {
    onEdit({ reviewConfirmed: reviewChecked, editorialStatus: reviewChecked ? "ready" : "review" });
    toast.success(reviewChecked ? "Revisão confirmada." : "Revisão removida.");
  };

  const trySignature = () => {
    if (!CONTRACTS_FLAGS.signatureEnabled) {
      toast.info("A assinatura eletrônica real depende das credenciais do provedor.");
      return;
    }
    if (signatureIssues.length) {
      toast.error(signatureIssues[0].message);
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-3.5" /> Contratos</button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{contract.title}</h1>
            <StatusPill label={CONTRACT_STATUS_LABELS[contract.contractStatus]} className={contractBadgeStyles[contract.contractStatus]} />
            <StatusPill label={`v${contract.versions[0]?.version ?? 1}`} className="bg-slate-100 text-slate-500" />
          </div>
          <p className="mt-1 text-xs text-slate-500">{contract.number} - {contract.clientName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDuplicate}><Copy className="size-3.5" /> Duplicar</Button>
          <Button type="button" variant="outline" size="sm" disabled={!CONTRACTS_FLAGS.apiEnabled}><Download className="size-3.5" /> Gerar PDF</Button>
          <Button type="button" size="sm" onClick={trySignature} disabled={!CONTRACTS_FLAGS.signatureEnabled}><Send className="size-3.5" /> Enviar para assinatura</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <Tabs defaultValue="document" className="gap-4">
            <TabsList className="week-board-scroll max-w-full justify-start overflow-x-auto bg-[#eef0ff]">
              <TabsTrigger value="document"><FileText className="size-3.5" /> Documento</TabsTrigger>
              <TabsTrigger value="signatures"><FileSignature className="size-3.5" /> Assinaturas</TabsTrigger>
              <TabsTrigger value="versions"><Layers3 className="size-3.5" /> Versões</TabsTrigger>
              <TabsTrigger value="history"><History className="size-3.5" /> Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="document">
              <section className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div><h2 className="text-sm font-semibold text-slate-900">Documento editável</h2><p className="mt-0.5 text-[10px] text-slate-400">Versões enviadas para assinatura permanecem imutáveis.</p></div>
                  <div className="flex gap-2">{editing ? <><Button type="button" variant="ghost" size="sm" onClick={() => { setContentDraft(contract.content); setEditing(false); }}>Cancelar</Button><Button type="button" size="sm" onClick={saveContent}><Check className="size-3.5" /> Salvar versão</Button></> : <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} disabled={contract.signatureStatus !== "not_started" && contract.signatureStatus !== "cancelled"}><Edit3 className="size-3.5" /> Editar</Button>}</div>
                </div>
                <div className="p-4">
                  {editing ? <RichTextEditor value={contentDraft} onChange={setContentDraft} maxLength={45000} className="min-h-[520px]" /> : <DocumentPreview content={renderedContent} />}
                </div>
              </section>
            </TabsContent>
            <TabsContent value="signatures">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-sm font-semibold text-slate-900">Fluxo de assinatura</h2><p className="mt-0.5 text-[10px] text-slate-400">Status comercial e assinatura são acompanhados separadamente.</p></div>
                  <StatusPill label={CONTRACT_SIGNATURE_STATUS_LABELS[contract.signatureStatus]} className={signatureBadgeStyles[contract.signatureStatus]} />
                </div>
                <div className="mt-4 grid gap-2">
                  {contract.signers.map((signer) => <SignerStatusCard key={signer.id} signer={signer} />)}
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
                  {latestRequest ? `Solicitação ${latestRequest.externalId || latestRequest.id} via ${latestRequest.provider}.` : "Nenhuma solicitação enviada."}
                </div>
              </section>
            </TabsContent>
            <TabsContent value="versions">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Versões preservadas</h2><Button type="button" variant="outline" size="sm" onClick={() => { onVersion("Versão formal criada manualmente"); toast.success("Versão criada."); }}><Plus className="size-3.5" /> Criar versão</Button></div>
                <div className="mt-4 divide-y divide-slate-100">
                  {contract.versions.map((version) => <div key={version.id} className="flex items-center gap-3 py-3"><span className="grid size-8 place-items-center rounded-md bg-[#f0edff] text-[10px] font-semibold text-[#5b45dc]">v{version.version}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{version.reason}</p><p className="mt-0.5 text-[10px] text-slate-400">{format(parseISO(version.createdAt), "dd/MM/yyyy HH:mm")} - hash {version.contentHash}</p></div>{version.immutable && <StatusPill label="Imutável" className="bg-slate-100 text-slate-500" />}{version.aiGenerated && <StatusPill label="IA" className="bg-[#f0edff] text-[#5b45dc]" />}</div>)}
                </div>
              </section>
            </TabsContent>
            <TabsContent value="history">
              <Timeline events={contract.events} />
            </TabsContent>
          </Tabs>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Resumo</h2>
            <div className="mt-4 space-y-3">
              <InfoRow label="Cliente" value={client?.name || contract.clientName} />
              <InfoRow label="Serviço/projeto" value={task?.title || contract.sourceSnapshot.service.title || "Sem vínculo"} />
              <InfoRow label="Valor contratado" value={formatBRL(contract.terms.value)} />
              <InfoRow label="Vigência" value={`${contract.terms.startDate ? formatDateBR(contract.terms.startDate) : "-"} até ${contract.terms.endDate ? formatDateBR(contract.terms.endDate) : "indeterminado"}`} />
              <InfoRow label="Origem" value={CONTRACT_SOURCE_LABELS[contract.source]} />
              <InfoRow label="Cobrança" value={charge?.code || contract.sourceSnapshot.billing?.code || "Não vinculada"} />
              <InfoRow label="Status editorial" value={CONTRACT_EDITORIAL_STATUS_LABELS[contract.editorialStatus]} />
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="flex items-start gap-3">
              <Checkbox checked={reviewChecked} onCheckedChange={(checked) => setReviewChecked(Boolean(checked))} />
              <span><span className="block text-xs font-semibold text-slate-800">Revisei o conteúdo</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{LEGAL_REVIEW_NOTICE}</span></span>
            </label>
            <Button type="button" variant="outline" size="sm" onClick={confirmReview} className="mt-3 w-full"><Check className="size-3.5" /> Confirmar revisão</Button>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Pendências</h2>
            <div className="mt-3 space-y-2">{signatureIssues.length ? signatureIssues.slice(0, 7).map((issue) => <ValidationRow key={`${issue.field}-${issue.message}`} ok={false} text={issue.message} />) : <ValidationRow ok text="Sem pendências para envio." />}</div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Ações seguras</h2>
            <div className="mt-3 divide-y divide-slate-100">
              <ActionRow icon={RefreshCcw} title="Reenviar lembrete" disabled={!CONTRACTS_FLAGS.signatureEnabled || !latestRequest} onClick={() => toast.info("O lembrete real será enviado pelo provedor configurado.")} />
              <ActionRow icon={Archive} title="Arquivar contrato" onClick={onArchive} />
              {canDelete && <ActionRow icon={Trash2} title="Excluir rascunho" danger onClick={onDeleteDraft} />}
            </div>
          </section>
        </aside>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl gap-0 rounded-xl p-0">
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle className="text-base">Confirmar envio para assinatura</DialogTitle>
            <DialogDescription className="text-xs">A versão atual será congelada, o PDF será gerado no backend e enviado ao provedor configurado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-5 text-[11px]">
            <InfoRow label="Contrato" value={`${contract.number} - ${contract.title}`} />
            <InfoRow label="Cliente" value={contract.clientName} />
            <InfoRow label="Versão" value={`v${contract.versions[0]?.version ?? 1}`} />
            <InfoRow label="Signatários" value={contract.signers.map((signer) => `${signer.name} <${signer.email}>`).join(", ")} />
            <InfoRow label="Ordem" value={contract.signingMode === "ordered" ? "Assinatura em ordem" : "Assinatura simultânea"} />
            <InfoRow label="Mensagem" value={contract.signatureMessage} />
            <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">{LEGAL_REVIEW_NOTICE}</div>
          </div>
          <DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button type="button" size="sm" disabled>Enviar pelo provedor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateManager({ templates, onBack, onSave, onDuplicate }: { templates: ContractTemplate[]; onBack: () => void; onSave: (template: ContractTemplate) => void; onDuplicate: (id: string) => void }) {
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const draft = editing ?? emptyTemplate();
  const update = (patch: Partial<ContractTemplate>) => setEditing({ ...draft, ...patch, updatedAt: new Date().toISOString() });
  const save = () => {
    onSave(draft);
    setEditing(null);
    toast.success("Modelo salvo.");
  };
  return (
    <div className="mx-auto w-full max-w-[1300px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div><button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-3.5" /> Contratos</button><h1 className="text-2xl font-semibold text-slate-900">Modelos de contrato</h1></div>
        <Button type="button" size="sm" onClick={() => setEditing(emptyTemplate())}><Plus className="size-3.5" /> Novo modelo</Button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid gap-3 sm:grid-cols-2">
          {templates.filter((template) => !template.archivedAt).map((template) => <article key={template.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#f0edff] text-[#5b45dc]"><Layers3 className="size-4" /></span><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditing(template)}><Edit3 /> Editar</DropdownMenuItem><DropdownMenuItem onSelect={() => onDuplicate(template.id)}><Copy /> Duplicar</DropdownMenuItem><DropdownMenuItem onSelect={() => onSave({ ...template, archivedAt: new Date().toISOString() })}><Archive /> Arquivar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><h2 className="mt-4 text-sm font-semibold text-slate-900">{template.name}</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">{template.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{template.variables.slice(0, 4).map((variable) => <span key={variable.id} className="rounded bg-slate-100 px-1.5 py-1 text-[9px] text-slate-500">{variable.id}</span>)}</div></article>)}
        </section>
        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{editing ? "Editar modelo" : "Prévia de modelo"}</h2>
          {editing ? <div className="mt-4 space-y-4"><Field label="Nome"><Input value={draft.name} onChange={(event) => update({ name: event.target.value })} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Descrição"><Textarea value={draft.description} onChange={(event) => update({ description: event.target.value })} rows={3} className="resize-none text-xs shadow-none" /></Field><Field label="Conteúdo"><RichTextEditor value={draft.content} onChange={(content) => update({ content })} maxLength={45000} /></Field><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button><Button type="button" size="sm" onClick={save}>Salvar modelo</Button></div></div> : <div className="mt-4 rounded-lg bg-slate-50 p-4 text-[11px] leading-5 text-slate-500">Selecione ou crie um modelo para editar variáveis e cláusulas reutilizáveis.</div>}
        </aside>
      </div>
    </div>
  );
}

function buildSnapshot({ settings, client, task, charge, proposal, serviceTitle, serviceDescription, serviceScope, deliverables, deadline, revisions }: { settings: WeekiSettings; client: Client | null; task: Task | null; charge: BillingCharge | null; proposal: { id: string; name: string } | null; serviceTitle: string; serviceDescription: string; serviceScope: string; deliverables: string; deadline: string; revisions: string }): ContractSourceSnapshot {
  const capturedAt = new Date().toISOString();
  const service: ContractServiceSnapshot = {
    id: task?.id ?? null,
    title: serviceTitle || task?.title || charge?.description || "Serviço profissional",
    description: serviceDescription || stripHtml(task?.description ?? "") || charge?.description || "",
    scope: serviceScope || stripHtml(task?.description ?? "") || "",
    deliverables,
    deadline,
    revisions,
    providerResponsibilities: "Executar o serviço com zelo técnico, comunicar impedimentos e entregar os materiais combinados.",
    clientResponsibilities: "Fornecer informações, acessos e aprovações necessárias à execução.",
    source: task ? "task" : proposal ? "proposal" : "manual",
  };
  return {
    business: {
      name: settings.profile.businessName || settings.profile.name,
      document: "",
      email: settings.profile.email,
      phone: settings.profile.phone,
      representativeName: settings.profile.name,
      representativeRole: settings.profile.role,
      address: "",
    },
    client: client ? {
      id: client.id,
      name: client.name,
      kind: client.kind === "company" ? "company" : "individual",
      document: client.document,
      email: client.email,
      phone: client.phone,
      address: client.address,
      representativeName: client.contactName,
      representativeRole: client.contactRole,
      capturedAt,
    } : null,
    service,
    billing: charge ? {
      id: charge.id,
      code: charge.code,
      description: charge.description,
      amount: charge.amount,
      dueDate: charge.dueDate,
      paymentMethods: charge.methods,
    } : null,
    proposal: proposal ? { id: proposal.id, title: proposal.name, fileName: proposal.name } : null,
    capturedAt,
  };
}

function buildParties(snapshot: ContractSourceSnapshot): ContractParty[] {
  return [
    { id: createId(), type: "company", name: snapshot.business.name, document: snapshot.business.document, email: snapshot.business.email, phone: snapshot.business.phone, address: snapshot.business.address, role: "Contratada", representativeName: snapshot.business.representativeName, representativeRole: snapshot.business.representativeRole, snapshotSource: "business" },
    { id: createId(), type: snapshot.client?.kind ?? "company", name: snapshot.client?.name ?? "", document: snapshot.client?.document ?? "", email: snapshot.client?.email ?? "", phone: snapshot.client?.phone ?? "", address: snapshot.client?.address ?? "", role: "Contratante", representativeName: snapshot.client?.representativeName ?? "", representativeRole: snapshot.client?.representativeRole ?? "", snapshotSource: "client" },
  ];
}

function emptySigner(client?: Client | null): ContractSigner {
  return { id: createId(), partyId: null, name: client?.contactName || client?.name || "", email: client?.email || "", document: client?.document || "", role: "Signatário", order: 1, authMethod: "provider_default", status: "not_started", viewedAt: null, signedAt: null, lastEventAt: null };
}

function validateDraftPreview(draft: ContractDraftInput) {
  const fake: WeekiContract = {
    id: "preview",
    workspaceId: "local",
    number: "preview",
    title: draft.title,
    clientId: draft.clientId,
    clientName: draft.sourceSnapshot.client?.name ?? "",
    source: draft.source,
    templateId: draft.templateId,
    relatedServiceId: draft.relatedServiceId,
    relatedTaskId: draft.relatedTaskId,
    relatedProjectId: null,
    proposalId: draft.proposalId,
    chargeId: draft.chargeId,
    sourceSnapshot: draft.sourceSnapshot,
    terms: draft.terms,
    parties: draft.parties,
    signers: draft.signers,
    signingMode: draft.signingMode,
    signatureMessage: draft.signatureMessage,
    editorialStatus: "draft",
    signatureStatus: "not_started",
    contractStatus: "pending",
    aiGenerated: Boolean(draft.aiGenerated),
    aiProvider: draft.aiProvider ?? null,
    aiNoticeAccepted: Boolean(draft.aiGenerated),
    reviewConfirmed: true,
    content: draft.content,
    currentVersionId: "",
    versions: [],
    documents: [],
    signatureRequests: [],
    events: [],
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
  };
  return validateContractForSignature(fake).filter((issue) => issue.section !== "review");
}

function emptyTemplate(): ContractTemplate {
  const now = new Date().toISOString();
  return { id: createId(), name: "Novo modelo", description: "", category: "Serviços", content: "<h1>Novo contrato</h1><p>Escreva as cláusulas do modelo.</p>", variables: CONTRACT_VARIABLES.map((variable) => ({ id: variable.id, required: variable.required, fallback: "" })), favorite: false, archivedAt: null, createdAt: now, updatedAt: now };
}

function StepActions({ step, onStep }: { step: ComposerStep; onStep: (step: ComposerStep) => void }) {
  const index = steps.findIndex((item) => item.id === step);
  return <div className="flex justify-between border-t border-slate-100 pt-4"><Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => onStep(steps[index - 1].id)}>Voltar</Button><Button type="button" size="sm" disabled={index === steps.length - 1} onClick={() => onStep(steps[index + 1].id)}>Continuar</Button></div>;
}

function SignerEditor({ signers, onChange, signingMode, onSigningModeChange, client, settings }: { signers: ContractSigner[]; onChange: (signers: ContractSigner[]) => void; signingMode: "simultaneous" | "ordered"; onSigningModeChange: (mode: "simultaneous" | "ordered") => void; client: Client | null; settings: WeekiSettings }) {
  const update = (id: string, patch: Partial<ContractSigner>) => onChange(signers.map((signer) => signer.id === id ? { ...signer, ...patch } : signer));
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-800">Signatários</h3><div className="flex gap-1 rounded-md bg-slate-100 p-0.5"><button type="button" onClick={() => onSigningModeChange("simultaneous")} className={cn("h-7 rounded px-2 text-[10px]", signingMode === "simultaneous" && "bg-white font-semibold text-slate-900")}>Simultânea</button><button type="button" onClick={() => onSigningModeChange("ordered")} className={cn("h-7 rounded px-2 text-[10px]", signingMode === "ordered" && "bg-white font-semibold text-slate-900")}>Em ordem</button></div></div>
      <div className="mt-3 space-y-3">{signers.map((signer, index) => <div key={signer.id} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[44px_1fr_1fr_140px_32px]"><span className="grid size-8 place-items-center rounded-md bg-white text-[10px] font-semibold text-slate-500">{signingMode === "ordered" ? index + 1 : "•"}</span><Input value={signer.name} onChange={(event) => update(signer.id, { name: event.target.value })} placeholder="Nome" className="h-8 rounded-md bg-white text-xs shadow-none" /><Input type="email" value={signer.email} onChange={(event) => update(signer.id, { email: event.target.value })} placeholder="E-mail" className="h-8 rounded-md bg-white text-xs shadow-none" /><Input value={formatCpfCnpj(signer.document)} onChange={(event) => update(signer.id, { document: event.target.value })} placeholder="CPF/CNPJ" className="h-8 rounded-md bg-white text-xs shadow-none" /><button type="button" onClick={() => onChange(signers.filter((item) => item.id !== signer.id))} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-rose-600" aria-label="Remover signatário"><Trash2 className="size-3.5" /></button></div>)}</div>
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onChange([...signers, emptySigner()])}><Plus className="size-3.5" /> Signatário</Button><Button type="button" variant="outline" size="sm" onClick={() => onChange([...signers, emptySigner(client)])}>Cliente</Button><Button type="button" variant="outline" size="sm" onClick={() => onChange([...signers, { ...emptySigner(), name: settings.profile.name, email: settings.profile.email, role: "Contratada" }])}>Meu usuário</Button></div>
    </div>
  );
}

function PreviewPanel({ title, content, snapshot, terms }: { title: string; content: string; snapshot: ContractSourceSnapshot; terms: ContractTerms }) {
  const preview = replaceContractVariables(content, contractVariableValues({ sourceSnapshot: snapshot, terms }));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between"><h2 className="text-xs font-semibold text-slate-900">Prévia</h2><StatusPill label="Editável" className="bg-[#f0edff] text-[#5b45dc]" /></div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title || "Contrato sem título"}</h3>
      <div className="mt-3 max-h-[460px] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-4">
        <DocumentPreview content={preview} compact />
      </div>
    </section>
  );
}

function DocumentPreview({ content, compact = false }: { content: string; compact?: boolean }) {
  return <article className={cn("prose prose-slate max-w-none text-slate-700 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:text-xs [&_p]:leading-6", compact && "[&_h1]:text-base [&_h2]:text-xs [&_p]:text-[10px] [&_p]:leading-5")} dangerouslySetInnerHTML={{ __html: content || "<p>Documento vazio.</p>" }} />;
}

function SnapshotCard({ title, rows }: { title: string; rows: string[] }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p><div className="mt-2 space-y-1">{rows.map((row, index) => <p key={`${row}-${index}`} className="truncate text-[11px] text-slate-700">{row || "Não informado"}</p>)}</div></div>;
}

function ComposerSection({ icon: Icon, title, aside, children }: { icon: LucideIcon; title: string; aside: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><header className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-md bg-[#f0edff] text-[#5b47df]"><Icon className="size-4" /></span><h2 className="text-sm font-semibold text-slate-900">{title}</h2></div><span className="text-[9px] font-medium text-slate-400">{aside}</span></header>{children}</section>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-[10px] font-semibold text-slate-600">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</Label>{children}</div>;
}

function ToggleCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-700"><span>{label}</span><Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} /></label>;
}

function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="flex h-9 items-center rounded-md border border-input bg-white px-3"><span className="text-[10px] text-slate-400">R$</span><input type="number" min={0} step="0.01" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)} className="min-w-0 flex-1 bg-transparent text-right text-xs font-semibold text-slate-800 outline-none" /></div>;
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-semibold", className)}><span className="size-1.5 rounded-full bg-current" />{label}</span>;
}

function Indicator({ label, value, tone }: { label: string; value: number; tone: "slate" | "violet" | "amber" | "cyan" | "emerald" | "orange" | "blue" }) {
  const tones = { slate: "bg-slate-100 text-slate-700", violet: "bg-[#f0edff] text-[#5b45dc]", amber: "bg-amber-50 text-amber-700", cyan: "bg-cyan-50 text-cyan-700", emerald: "bg-emerald-50 text-emerald-700", orange: "bg-orange-50 text-orange-700", blue: "bg-blue-50 text-blue-700" };
  return <article className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-semibold text-slate-400">{label}</p><p className={cn("mt-2 inline-flex min-w-8 justify-center rounded-md px-2 py-1 text-lg font-semibold tabular-nums", tones[tone])}>{value}</p></article>;
}

function ValidationRow({ ok, text }: { ok: boolean; text: string }) {
  return <div className={cn("flex items-start gap-2 text-[10px] leading-4", ok ? "text-emerald-700" : "text-amber-700")}><span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", ok ? "bg-emerald-50" : "bg-amber-50")}>{ok ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}</span><span>{text}</span></div>;
}

function SignerStatusCard({ signer }: { signer: ContractSigner }) {
  return <article className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"><span className="grid size-9 place-items-center rounded-md bg-white text-[10px] font-semibold text-slate-600">{signer.order}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{signer.name || "Sem nome"}</p><p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-400"><Mail className="size-3" />{signer.email || "Sem e-mail"}</p></div><StatusPill label={CONTRACT_SIGNATURE_STATUS_LABELS[signer.status]} className={signatureBadgeStyles[signer.status]} /></article>;
}

function Timeline({ events }: { events: ContractEvent[] }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-900">Histórico</h2><div className="mt-4 space-y-3">{events.length ? events.map((event) => <div key={event.id} className="flex gap-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#5b45dc]"><Clock3 className="size-3.5" /></span><div className="min-w-0 border-b border-slate-100 pb-3"><p className="text-xs font-semibold text-slate-800">{event.title}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">{event.description}</p><p className="mt-1 text-[9px] text-slate-400">{format(parseISO(event.createdAt), "dd/MM/yyyy HH:mm")} - {event.actor}</p></div></div>) : <p className="text-[11px] text-slate-400">Nenhum evento registrado.</p>}</div></section>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[110px_1fr] gap-3 text-[11px]"><span className="text-slate-400">{label}</span><span className="min-w-0 break-words font-medium text-slate-700">{value || "-"}</span></div>;
}

function ActionRow({ icon: Icon, title, disabled, danger, onClick }: { icon: LucideIcon; title: string; disabled?: boolean; danger?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("flex w-full items-center gap-3 py-3 text-left text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-45", danger && "text-rose-700")}><Icon className="size-4" />{title}</button>;
}
