"use client";

import { useMemo, useState, type ReactNode } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Mail,
  MoreHorizontal,
  PackagePlus,
  Plus,
  ReceiptText,
  RefreshCcw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/weeki/confirm-action-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/weeki/rich-text-editor";
import { QuoteDocument } from "@/components/weeki/quote-document";
import type { BillingCharge } from "@/features/billing/types";
import type { Client, ClientDraft } from "@/features/clients/types";
import {
  downloadQuotePdf,
  downloadQuoteXlsx,
} from "@/features/operations/quote-documents";
import type { WeekiOperationsController } from "@/features/operations/use-weeki-operations";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_UNIT_LABELS,
  quoteGeneralDiscount,
  quoteSubtotal,
  quoteTotal,
  type Quote,
  type QuoteDiscountType,
  type QuoteItem,
  type QuotePaymentCondition,
  type QuoteStatus,
  type QuoteTaxType,
  type QuoteUnit,
  type Service,
} from "@/features/operations/types";
import type { WeekiSettings } from "@/features/settings/types";
import { formatBRL, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WeekiArea } from "./sidebar";

type QuoteDraft = Omit<Quote, "id" | "number" | "createdAt" | "updatedAt">;

type Props = {
  controller: WeekiOperationsController;
  clients: Client[];
  settings: WeekiSettings;
  onAddClient: (draft: ClientDraft) => Client;
  onNavigate: (area: WeekiArea) => void;
  onCreateBilling: (quote: Quote) => BillingCharge | null;
  onCreateContract: (quote: Quote) => { id: string; number: string } | null;
  onCreateProject: (quote: Quote) => { id: string } | null;
};

const statusFilters: Array<QuoteStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "viewed",
  "awaiting_approval",
  "approved",
  "rejected",
  "expired",
  "cancelled",
];

const units = Object.entries(QUOTE_UNIT_LABELS) as Array<[QuoteUnit, string]>;

const statusTone: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-cyan-50 text-cyan-700",
  awaiting_approval: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  expired: "bg-zinc-100 text-zinc-600",
  cancelled: "bg-slate-200 text-slate-500",
};

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function unitFromText(unit: string): QuoteUnit {
  const value = unit.toLocaleLowerCase("pt-BR");
  if (value.includes("hora")) return "hour";
  if (value.includes("dia")) return "day";
  if (value.includes("semana")) return "week";
  if (value.includes("mês") || value.includes("mes")) return "month";
  if (value.includes("projeto")) return "project";
  if (value.includes("sess")) return "session";
  if (value.includes("página") || value.includes("pagina")) return "page";
  if (value.includes("pacote")) return "package";
  if (value.includes("km")) return "km";
  if (value.includes("m²") || value.includes("m2")) return "square_meter";
  return "unit";
}

function createBlankItem(service?: Service | null): QuoteItem {
  return {
    id: makeId(),
    serviceId: service?.id ?? null,
    savedItemId: service?.id ?? null,
    name: service?.name ?? "",
    description: service?.description ?? "",
    quantity: 1,
    unit: service ? unitFromText(service.unit) : "unit",
    customUnit: "",
    unitPrice: service?.defaultPrice ?? 0,
    discountType: "none",
    discountValue: 0,
    discount: 0,
    addition: 0,
    fiscalCode: service?.fiscalCode ?? "",
    taxRate: service?.taxRate ?? 0,
  };
}

function quoteDefaults(
  controller: WeekiOperationsController,
  settings: WeekiSettings,
  service?: Service | null,
): QuoteDraft {
  const today = new Date();
  const item = createBlankItem(service);
  return {
    title: "",
    clientId: null,
    opportunityId: null,
    items: [item],
    description: "",
    issueDate: format(today, "yyyy-MM-dd"),
    estimatedDeadline: `${controller.quoteSettings.defaultDeadlineDays} dias`,
    validUntil: format(
      addDays(today, controller.quoteSettings.defaultValidityDays),
      "yyyy-MM-dd",
    ),
    responsible: settings.profile.name,
    discountType: "none",
    discountValue: 0,
    taxType: "none",
    taxLabel: "",
    taxValue: 0,
    paymentCondition: "custom",
    downPaymentPercent: 0,
    installments: 1,
    firstDueDate: "",
    paymentDetails: controller.quoteSettings.defaultPaymentTerms,
    estimatedStartDate: "",
    estimatedEndDate: "",
    scope: "",
    exclusions: "",
    notes: controller.quoteSettings.defaultNotes,
    terms: controller.quoteSettings.defaultTerms,
    paymentMethod: "Pix ou transferência",
    status: "draft",
    version: 1,
    parentQuoteId: null,
    publicToken: "",
    viewedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: "",
    acceptedBy: "",
    engagementId: null,
    chargeId: null,
    contractId: null,
    events: [],
  };
}

function quoteToDraft(quote: Quote): QuoteDraft {
  return {
    title: quote.title,
    clientId: quote.clientId,
    opportunityId: quote.opportunityId,
    items: quote.items.map((item) => ({ ...item })),
    description: quote.description,
    issueDate: quote.issueDate,
    estimatedDeadline: quote.estimatedDeadline,
    validUntil: quote.validUntil,
    responsible: quote.responsible,
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    taxType: quote.taxType,
    taxLabel: quote.taxLabel,
    taxValue: quote.taxValue,
    paymentCondition: quote.paymentCondition,
    downPaymentPercent: quote.downPaymentPercent,
    installments: quote.installments,
    firstDueDate: quote.firstDueDate,
    paymentDetails: quote.paymentDetails,
    estimatedStartDate: quote.estimatedStartDate,
    estimatedEndDate: quote.estimatedEndDate,
    scope: quote.scope,
    exclusions: quote.exclusions,
    notes: quote.notes,
    terms: quote.terms,
    paymentMethod: quote.paymentMethod,
    status: quote.status,
    version: quote.version,
    parentQuoteId: quote.parentQuoteId,
    publicToken: quote.publicToken,
    viewedAt: quote.viewedAt,
    approvedAt: quote.approvedAt,
    rejectedAt: quote.rejectedAt,
    rejectionReason: quote.rejectionReason,
    acceptedBy: quote.acceptedBy,
    engagementId: quote.engagementId,
    chargeId: quote.chargeId,
    contractId: quote.contractId,
    events: quote.events,
  };
}

function emptyClientDraft(
  name: string,
  email: string,
  phone: string,
): ClientDraft {
  return {
    name,
    color: "#7657ff",
    logoUrl: "",
    kind: "company",
    document: "",
    contactName: name,
    contactRole: "",
    email,
    phone,
    website: "",
    address: "",
    fiscal: {
      municipalRegistration: "",
      zipCode: "",
      city: "",
      cityCode: "",
      state: "",
      fiscalEmail: email,
    },
    notes: "",
    status: "active",
    segment: "",
    contractValue: 0,
    contractKind: "none",
    nextDueDate: "",
    paymentStatus: "none",
    files: [],
    links: [],
  };
}

export function QuotesScreen({
  controller,
  clients,
  settings,
  onAddClient,
  onNavigate,
  onCreateBilling,
  onCreateContract,
  onCreateProject,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "month" | "quarter">(
    "all",
  );
  const [valueFilter, setValueFilter] = useState<
    "all" | "small" | "medium" | "large"
  >("all");
  const [validityFilter, setValidityFilter] = useState<
    "all" | "valid" | "expiring" | "expired"
  >("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    controller.quotes[0]?.id ?? null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuoteDraft>(() =>
    quoteDefaults(
      controller,
      settings,
      controller.services.find((service) => !service.archivedAt),
    ),
  );
  const [showPreview, setShowPreview] = useState(true);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);

  const activeSavedItems = controller.services.filter(
    (service) => !service.archivedAt,
  );
  const selectedQuote =
    controller.quotes.find((quote) => quote.id === selectedId) ??
    controller.quotes[0] ??
    null;

  const metrics = useMemo(() => {
    const approved = controller.quotes.filter(
      (quote) => quote.status === "approved",
    );
    const waiting = controller.quotes.filter((quote) =>
      ["sent", "viewed", "awaiting_approval"].includes(quote.status),
    );
    const now = new Date();
    const periodApproved = approved.filter((quote) => {
      const date = quote.approvedAt || quote.updatedAt;
      return (
        new Date(date).getMonth() === now.getMonth() &&
        new Date(date).getFullYear() === now.getFullYear()
      );
    });
    const sent = controller.quotes.filter(
      (quote) => quote.status !== "draft" && quote.status !== "cancelled",
    );
    const approvalRate = sent.length
      ? Math.round((approved.length / sent.length) * 100)
      : 0;
    return {
      total: controller.quotes.length,
      waiting: waiting.length,
      approved: approved.length,
      rejected: controller.quotes.filter((quote) => quote.status === "rejected")
        .length,
      approvedValue: periodApproved.reduce(
        (sum, quote) => sum + quoteTotal(quote),
        0,
      ),
      approvalRate,
      averageTicket: approved.length
        ? approved.reduce((sum, quote) => sum + quoteTotal(quote), 0) /
          approved.length
        : 0,
    };
  }, [controller.quotes]);

  const filteredQuotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const today = format(new Date(), "yyyy-MM-dd");
    const nextWeek = format(addDays(new Date(), 7), "yyyy-MM-dd");
    return controller.quotes.filter((quote) => {
      const client = clients.find((item) => item.id === quote.clientId);
      const total = quoteTotal(quote);
      const created = quote.createdAt.slice(0, 10);
      const inPeriod =
        periodFilter === "all" ||
        (periodFilter === "month" &&
          created.slice(0, 7) === today.slice(0, 7)) ||
        (periodFilter === "quarter" &&
          new Date(quote.createdAt) >= addDays(new Date(), -90));
      const inValue =
        valueFilter === "all" ||
        (valueFilter === "small" && total < 1000) ||
        (valueFilter === "medium" && total >= 1000 && total <= 5000) ||
        (valueFilter === "large" && total > 5000);
      const inValidity =
        validityFilter === "all" ||
        (validityFilter === "valid" && quote.validUntil >= today) ||
        (validityFilter === "expiring" &&
          quote.validUntil >= today &&
          quote.validUntil <= nextWeek) ||
        (validityFilter === "expired" && quote.validUntil < today);
      const searchable =
        `${quote.number} ${quote.title} ${quote.description} ${client?.name ?? ""}`.toLocaleLowerCase(
          "pt-BR",
        );
      return (
        (statusFilter === "all" || quote.status === statusFilter) &&
        (clientFilter === "all" || quote.clientId === clientFilter) &&
        inPeriod &&
        inValue &&
        inValidity &&
        (!normalizedQuery || searchable.includes(normalizedQuery))
      );
    });
  }, [
    clientFilter,
    clients,
    controller.quotes,
    periodFilter,
    query,
    statusFilter,
    validityFilter,
    valueFilter,
  ]);

  const openNew = () => {
    setEditingId(null);
    setClientMode("existing");
    setNewClient({ name: "", email: "", phone: "" });
    setDraft(quoteDefaults(controller, settings, activeSavedItems[0] ?? null));
    setShowPreview(true);
    setSheetOpen(true);
  };

  const editQuote = (quote: Quote) => {
    setEditingId(quote.id);
    setDraft(quoteToDraft(quote));
    setClientMode("existing");
    setNewClient({ name: "", email: "", phone: "" });
    setShowPreview(true);
    setSheetOpen(true);
  };

  const createFromTemplate = (templateId: string) => {
    const template = controller.quoteTemplates.find(
      (item) => item.id === templateId,
    );
    if (!template) return;
    const base = quoteDefaults(controller, settings, null);
    setDraft({
      ...base,
      title: template.name,
      items: template.items.map((item) => ({ ...item, id: makeId() })),
      estimatedDeadline: template.estimatedDeadline,
      scope: template.scope,
      exclusions: template.exclusions,
      notes: template.notes,
      terms: template.terms,
      paymentMethod: template.paymentMethod,
      paymentCondition: template.paymentCondition,
      downPaymentPercent: template.downPaymentPercent,
      installments: template.installments,
      paymentDetails: template.paymentDetails,
    });
    setEditingId(null);
    setClientMode("existing");
    setSheetOpen(true);
  };

  const save = () => {
    let clientId = draft.clientId;
    if (clientMode === "new") {
      if (!newClient.name.trim()) {
        toast.error("Informe o nome do novo cliente.");
        return;
      }
      const created = onAddClient(
        emptyClientDraft(
          newClient.name.trim(),
          newClient.email.trim(),
          newClient.phone.trim(),
        ),
      );
      clientId = created.id;
    }
    if (!clientId) {
      toast.error("Selecione um cliente ou cadastre um novo.");
      return;
    }
    if (!draft.title.trim()) {
      toast.error("Informe o título do orçamento.");
      return;
    }
    if (
      !draft.items.length ||
      draft.items.every(
        (item) => !item.name?.trim() && !item.description.trim(),
      )
    ) {
      toast.error("Adicione pelo menos um item ao orçamento.");
      return;
    }
    if (draft.items.some((item) => item.quantity <= 0 || item.unitPrice < 0)) {
      toast.error("Revise quantidades e valores dos itens.");
      return;
    }
    const payload = {
      ...draft,
      clientId,
      title: draft.title.trim(),
      items: draft.items.map((item) => ({
        ...item,
        name: (item.name || item.description).trim(),
        description: item.description.trim(),
        discount: item.discountType === "fixed" ? (item.discountValue ?? 0) : 0,
      })),
    };
    const saved = editingId
      ? controller.updateQuote(editingId, payload, true)
      : controller.addQuote(payload);
    if (saved) {
      setSelectedId(saved.id);
    }
    setSheetOpen(false);
    toast.success(editingId ? "Orçamento atualizado." : "Orçamento criado.");
  };

  const selectedClient = selectedQuote
    ? (clients.find((client) => client.id === selectedQuote.clientId) ?? null)
    : null;

  const quoteLink = (quote: Quote) => {
    const token =
      quote.publicToken || controller.ensureQuotePublicToken(quote.id);
    return `${window.location.origin}/orcamento/?token=${encodeURIComponent(token)}`;
  };

  const copyLink = async (quote: Quote) => {
    try {
      await navigator.clipboard.writeText(quoteLink(quote));
      controller.addQuoteEvent(
        quote.id,
        "link_copied",
        "Link copiado",
        "Link público preparado para compartilhamento.",
      );
      if (quote.status === "draft")
        controller.setQuoteStatus(quote.id, "awaiting_approval");
      toast.success("Link do orçamento copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const sendEmail = (quote: Quote) => {
    const client = clients.find((item) => item.id === quote.clientId);
    const subject = `Orçamento ${quote.number} — ${settings.profile.businessName || settings.profile.name}`;
    const body = `Olá, ${client?.contactName || client?.name || ""}.\n\nSegue o orçamento ${quote.number}: ${quote.title}.\n\nAcesse: ${quoteLink(quote)}\n\nFico à disposição.`;
    window.location.href = `mailto:${client?.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    controller.setQuoteStatus(quote.id, "sent");
    toast.success("Mensagem de e-mail preparada.");
  };

  const sendWhatsApp = (quote: Quote) => {
    const client = clients.find((item) => item.id === quote.clientId);
    const digits = client?.phone.replace(/\D/g, "") ?? "";
    const text = `Olá! Segue o orçamento ${quote.number} — ${quote.title}: ${quoteLink(quote)}`;
    window.open(
      `https://wa.me/${digits ? `55${digits}` : ""}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    controller.addQuoteEvent(
      quote.id,
      "sent_whatsapp",
      "WhatsApp preparado",
      "Mensagem aberta para envio manual.",
    );
    if (quote.status === "draft") controller.setQuoteStatus(quote.id, "sent");
  };

  const exportPdf = (quote: Quote) => {
    downloadQuotePdf({
      quote,
      client: clients.find((item) => item.id === quote.clientId) ?? null,
      settings,
      quoteSettings: controller.quoteSettings,
    });
    controller.addQuoteEvent(
      quote.id,
      "pdf_generated",
      "PDF gerado",
      "Arquivo PDF profissional baixado.",
    );
  };

  const exportXlsx = (quote: Quote) => {
    downloadQuoteXlsx({
      quote,
      client: clients.find((item) => item.id === quote.clientId) ?? null,
      settings,
      quoteSettings: controller.quoteSettings,
    });
    controller.addQuoteEvent(
      quote.id,
      "excel_exported",
      "Excel exportado",
      "Arquivo .xlsx estruturado baixado.",
    );
  };

  const markRejected = (quote: Quote) => {
    const reason = window.prompt("Motivo da recusa, opcional") ?? "";
    controller.setQuoteStatus(quote.id, "rejected", {
      rejectionReason: reason.trim(),
    });
    toast.success("Orçamento marcado como recusado.");
  };

  const saveAsTemplate = (quote: Quote) => {
    controller.saveQuoteTemplate({
      name: quote.title,
      description: quote.description,
      items: quote.items.map((item) => ({ ...item, id: makeId() })),
      estimatedDeadline: quote.estimatedDeadline,
      scope: quote.scope,
      exclusions: quote.exclusions,
      notes: quote.notes,
      terms: quote.terms,
      paymentMethod: quote.paymentMethod,
      paymentCondition: quote.paymentCondition,
      downPaymentPercent: quote.downPaymentPercent,
      installments: quote.installments,
      paymentDetails: quote.paymentDetails,
    });
    controller.addQuoteEvent(
      quote.id,
      "template_saved",
      "Modelo salvo",
      "Orçamento salvo como modelo reutilizável.",
    );
    toast.success("Modelo de orçamento salvo.");
  };

  const convertToBilling = (quote: Quote) => {
    const charge = onCreateBilling(quote);
    if (!charge) return;
    controller.recordQuoteConversion(quote.id, "billing", charge.id);
    toast.success(`Cobrança ${charge.code} criada em rascunho.`);
    onNavigate("billing");
  };

  const convertToContract = (quote: Quote) => {
    const contract = onCreateContract(quote);
    if (!contract) return;
    controller.recordQuoteConversion(quote.id, "contract", contract.id);
    toast.success(`Contrato ${contract.number} criado.`);
    onNavigate("contracts");
  };

  const convertToProject = (quote: Quote) => {
    const engagement = onCreateProject(quote);
    if (!engagement) return;
    controller.recordQuoteConversion(quote.id, "project", engagement.id);
    toast.success("Atendimento criado a partir do orçamento.");
    onNavigate("engagements");
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#654ce4]">
            Comercial
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Orçamentos
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Crie, envie e acompanhe propostas comerciais para seus clientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {controller.quoteTemplates.filter((template) => !template.archivedAt)
            .length > 0 && (
            <Select onValueChange={createFromTemplate}>
              <SelectTrigger className="h-9 w-[190px] rounded-md bg-white text-xs shadow-none">
                <SelectValue placeholder="Usar modelo" />
              </SelectTrigger>
              <SelectContent>
                {controller.quoteTemplates
                  .filter((template) => !template.archivedAt)
                  .map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <Button type="button" size="sm" onClick={openNew}>
            <Plus className="size-3.5" /> Novo orçamento
          </Button>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Total em orçamentos"
          value={String(metrics.total)}
          detail={`${formatBRL(controller.quotes.reduce((sum, quote) => sum + quoteTotal(quote), 0))} em propostas`}
          icon={FileText}
        />
        <Metric
          label="Aguardando resposta"
          value={String(metrics.waiting)}
          detail="Enviados ou visualizados"
          icon={Send}
        />
        <Metric
          label="Aprovados"
          value={String(metrics.approved)}
          detail={`${metrics.approvalRate}% de aprovação`}
          icon={CheckCircle2}
        />
        <Metric
          label="Recusados"
          value={String(metrics.rejected)}
          detail="Motivos ficam no histórico"
          icon={XCircle}
        />
        <Metric
          label="Valor aprovado"
          value={formatBRL(metrics.approvedValue)}
          detail={`Ticket médio ${formatBRL(metrics.averageTicket)}`}
          icon={WalletCards}
        />
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="week-board-scroll flex gap-1 overflow-x-auto">
          {statusFilters.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "h-8 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:border-slate-300",
                statusFilter === status &&
                  "border-slate-900 bg-slate-900 text-white",
              )}
            >
              {status === "all" ? "Todos" : QUOTE_STATUS_LABELS[status]}
              <span
                className={cn(
                  "ml-1 text-slate-400",
                  statusFilter === status && "text-white/55",
                )}
              >
                {status === "all"
                  ? controller.quotes.length
                  : controller.quotes.filter((quote) => quote.status === status)
                      .length}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_180px_150px_150px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por número, cliente, título ou descrição"
              className="h-9 rounded-md bg-slate-50 pl-8 text-xs shadow-none"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={periodFilter}
            onValueChange={(value) =>
              setPeriodFilter(value as typeof periodFilter)
            }
          >
            <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
              <CalendarDays className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="quarter">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={valueFilter}
            onValueChange={(value) =>
              setValueFilter(value as typeof valueFilter)
            }
          >
            <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
              <SlidersHorizontal className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos valores</SelectItem>
              <SelectItem value="small">Até R$ 1 mil</SelectItem>
              <SelectItem value="medium">R$ 1 mil a R$ 5 mil</SelectItem>
              <SelectItem value="large">Acima de R$ 5 mil</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={validityFilter}
            onValueChange={(value) =>
              setValidityFilter(value as typeof validityFilter)
            }
          >
            <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda validade</SelectItem>
              <SelectItem value="valid">Válidos</SelectItem>
              <SelectItem value="expiring">Vencem em 7 dias</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Listagem</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {filteredQuotes.length} orçamento(s) encontrado(s)
              </p>
            </div>
          </div>
          <div className="week-board-scroll overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-[11px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Orçamento</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Criação</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((quote) => {
                  const client = clients.find(
                    (item) => item.id === quote.clientId,
                  );
                  return (
                    <tr
                      key={quote.id}
                      className={cn(
                        "cursor-pointer transition hover:bg-slate-50",
                        selectedQuote?.id === quote.id && "bg-violet-50/35",
                      )}
                      onClick={() => setSelectedId(quote.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {quote.number}
                        </p>
                        <p className="mt-1 max-w-[230px] truncate text-slate-500">
                          {quote.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {client?.name ?? "Sem cliente"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateBR(quote.issueDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateBR(quote.validUntil)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {formatBRL(quoteTotal(quote))}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={quote.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {quote.responsible || "Você"}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <QuoteActions
                          quote={quote}
                          onEdit={editQuote}
                          onDuplicate={(item) => {
                            const copy = controller.duplicateQuote(item.id);
                            if (copy) setSelectedId(copy.id);
                            toast.success("Orçamento duplicado.");
                          }}
                          onRevision={(item) => {
                            const revision = controller.createQuoteRevision(
                              item.id,
                            );
                            if (revision) setSelectedId(revision.id);
                            toast.success("Revisão criada.");
                          }}
                          onEmail={sendEmail}
                          onWhatsApp={sendWhatsApp}
                          onPdf={exportPdf}
                          onXlsx={exportXlsx}
                          onCopy={copyLink}
                          onApprove={(item) =>
                            controller.setQuoteStatus(item.id, "approved", {
                              acceptedBy:
                                clients.find(
                                  (client) => client.id === item.clientId,
                                )?.name ?? "",
                            })
                          }
                          onReject={markRejected}
                          onCancel={(item) =>
                            controller.setQuoteStatus(item.id, "cancelled")
                          }
                          onDelete={setDeleteTarget}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filteredQuotes.length && (
            <EmptyState
              title="Nenhum orçamento encontrado"
              description="Ajuste os filtros ou crie um novo orçamento para começar."
              action="Novo orçamento"
              onAction={openNew}
            />
          )}
        </section>

        <aside className="min-w-0 xl:sticky xl:top-[88px] xl:max-h-[calc(100vh-112px)] xl:overflow-y-auto">
          {selectedQuote ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Detalhes
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedQuote.title}
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {selectedQuote.number} ·{" "}
                      {selectedClient?.name ?? "Sem cliente"}
                    </p>
                  </div>
                  <StatusBadge status={selectedQuote.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <InfoBox
                    label="Subtotal"
                    value={formatBRL(quoteSubtotal(selectedQuote))}
                  />
                  <InfoBox
                    label="Desconto"
                    value={`- ${formatBRL(quoteGeneralDiscount(selectedQuote))}`}
                  />
                  <InfoBox
                    label="Total"
                    value={formatBRL(quoteTotal(selectedQuote))}
                  />
                  <InfoBox
                    label="Validade"
                    value={formatDateBR(selectedQuote.validUntil)}
                  />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportPdf(selectedQuote)}
                    className="h-8 text-[11px]"
                  >
                    <Download className="size-3.5" /> PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportXlsx(selectedQuote)}
                    className="h-8 text-[11px]"
                  >
                    <FileSpreadsheet className="size-3.5" /> Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyLink(selectedQuote)}
                    className="h-8 text-[11px]"
                  >
                    <Copy className="size-3.5" /> Copiar link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editQuote(selectedQuote)}
                    className="h-8 text-[11px]"
                  >
                    <FileText className="size-3.5" /> Editar
                  </Button>
                </div>
              </section>

              {selectedQuote.status === "approved" && (
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Criar a partir deste orçamento
                  </h3>
                  <div className="mt-3 grid gap-2">
                    <ConversionButton
                      icon={ReceiptText}
                      title="Criar cobrança"
                      description={
                        selectedQuote.chargeId
                          ? "Cobrança já vinculada"
                          : "Gera um rascunho com cliente, valor e vencimento"
                      }
                      disabled={Boolean(selectedQuote.chargeId)}
                      onClick={() => convertToBilling(selectedQuote)}
                    />
                    <ConversionButton
                      icon={FileText}
                      title="Criar contrato"
                      description={
                        selectedQuote.contractId
                          ? "Contrato já vinculado"
                          : "Preenche escopo, valor e condições comerciais"
                      }
                      disabled={Boolean(selectedQuote.contractId)}
                      onClick={() => convertToContract(selectedQuote)}
                    />
                    <ConversionButton
                      icon={PackagePlus}
                      title="Criar demanda/projeto"
                      description={
                        selectedQuote.engagementId
                          ? "Atendimento já vinculado"
                          : "Abre execução com cliente, prazo e valor"
                      }
                      disabled={Boolean(selectedQuote.engagementId)}
                      onClick={() => convertToProject(selectedQuote)}
                    />
                  </div>
                </section>
              )}

              <QuoteDocument
                quote={selectedQuote}
                client={selectedClient}
                settings={settings}
                quoteSettings={controller.quoteSettings}
                compact
              />

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Histórico
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => saveAsTemplate(selectedQuote)}
                    className="h-8 text-[11px]"
                  >
                    <Save className="size-3.5" /> Salvar modelo
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedQuote.events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <p className="text-[11px] font-semibold text-slate-700">
                        {event.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {formatDateTime(event.createdAt)} · {event.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <EmptyState
              title="Selecione um orçamento"
              description="A prévia e o histórico aparecem aqui."
              action="Novo orçamento"
              onAction={openNew}
            />
          )}
        </aside>
      </div>

      <QuoteEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        draft={draft}
        onChange={setDraft}
        clients={clients}
        savedItems={activeSavedItems}
        controller={controller}
        settings={settings}
        editing={Boolean(editingId)}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((current) => !current)}
        clientMode={clientMode}
        onClientMode={setClientMode}
        newClient={newClient}
        onNewClient={setNewClient}
        onSave={save}
      />

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir orçamento?"
        description={
          deleteTarget?.status === "draft"
            ? "Somente rascunhos podem ser excluídos. Esta ação remove o orçamento localmente."
            : "Este orçamento já possui histórico comercial. Cancele ou duplique, mas não exclua este registro."
        }
        confirmLabel={deleteTarget?.status === "draft" ? "Excluir" : "Entendi"}
        destructive={deleteTarget?.status === "draft"}
        onConfirm={() => {
          if (!deleteTarget) return;
          const removed = controller.deleteQuote(deleteTarget.id);
          if (removed) {
            setSelectedId(
              controller.quotes.find((quote) => quote.id !== deleteTarget.id)
                ?.id ?? null,
            );
            toast.success("Orçamento excluído.");
          } else {
            toast.info("Apenas rascunhos podem ser excluídos.");
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function QuoteEditorSheet({
  open,
  onOpenChange,
  draft,
  onChange,
  clients,
  savedItems,
  controller,
  settings,
  editing,
  showPreview,
  onTogglePreview,
  clientMode,
  onClientMode,
  newClient,
  onNewClient,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: QuoteDraft;
  onChange: (draft: QuoteDraft) => void;
  clients: Client[];
  savedItems: Service[];
  controller: WeekiOperationsController;
  settings: WeekiSettings;
  editing: boolean;
  showPreview: boolean;
  onTogglePreview: () => void;
  clientMode: "existing" | "new";
  onClientMode: (mode: "existing" | "new") => void;
  newClient: { name: string; email: string; phone: string };
  onNewClient: (client: { name: string; email: string; phone: string }) => void;
  onSave: () => void;
}) {
  const previewClient =
    clientMode === "existing"
      ? (clients.find((client) => client.id === draft.clientId) ?? null)
      : {
          ...emptyClientDraft(
            newClient.name || "Novo cliente",
            newClient.email,
            newClient.phone,
          ),
          id: "preview-client",
          initials: "NC",
          createdAt: "",
          updatedAt: "",
        };

  const update = <K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const updateItem = (id: string, updateItem: Partial<QuoteItem>) => {
    onChange({
      ...draft,
      items: draft.items.map((item) =>
        item.id === id ? { ...item, ...updateItem } : item,
      ),
    });
  };
  const addItem = (service?: Service | null) =>
    onChange({ ...draft, items: [...draft.items, createBlankItem(service)] });
  const removeItem = (id: string) => {
    if (draft.items.length <= 1) {
      toast.error("Mantenha pelo menos um item no orçamento.");
      return;
    }
    onChange({ ...draft, items: draft.items.filter((item) => item.id !== id) });
  };
  const applySavedItem = (itemId: string, rowId: string) => {
    const service = savedItems.find((item) => item.id === itemId);
    if (!service) return;
    updateItem(rowId, {
      serviceId: service.id,
      savedItemId: service.id,
      name: service.name,
      description: service.description,
      unit: unitFromText(service.unit),
      unitPrice: service.defaultPrice,
      fiscalCode: service.fiscalCode,
      taxRate: service.taxRate,
    });
  };
  const saveItem = (item: QuoteItem) => {
    if (!item.name?.trim() && !item.description.trim()) {
      toast.error("Informe o nome do item antes de salvar.");
      return;
    }
    const created = controller.addService({
      name: (item.name || item.description).trim(),
      description: item.description.trim(),
      category: "Orçamentos",
      defaultPrice: item.unitPrice,
      billingType: item.unit === "hour" ? "variable" : "fixed",
      unit:
        item.unit === "custom"
          ? item.customUnit || "personalizada"
          : QUOTE_UNIT_LABELS[item.unit ?? "unit"],
      defaultDurationDays: controller.quoteSettings.defaultDeadlineDays,
      fiscalCode: item.fiscalCode ?? "",
      taxRate: item.taxRate ?? 0,
      contractTemplateId: null,
      standardTasks: [],
      recurrence: "none",
      archivedAt: null,
    });
    updateItem(item.id, { serviceId: created.id, savedItemId: created.id });
    toast.success("Item salvo no catálogo.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-slate-200 bg-[#f7f8fb] p-0 sm:max-w-none lg:w-[calc(100vw-256px)]"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <SheetTitle className="text-lg">
                {editing ? "Editar orçamento" : "Novo orçamento"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                Cliente, título, item e valor já bastam; o restante é opcional.
              </SheetDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onTogglePreview}
                className="h-8 text-[11px]"
              >
                <FileText className="size-3.5" />{" "}
                {showPreview ? "Ocultar prévia" : "Visualizar orçamento"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-[11px]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                className="h-8 bg-slate-900 text-[11px] hover:bg-slate-800"
              >
                <Save className="size-3.5" /> Gerar orçamento
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div
          className={cn(
            "grid gap-4 px-4 py-4 sm:px-6",
            showPreview
              ? "xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]"
              : "max-w-5xl",
          )}
        >
          <div className="space-y-4">
            <EditorSection step="01" title="Informações principais">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <div className="mb-2 flex gap-1 rounded-md bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => onClientMode("existing")}
                      className={cn(
                        "h-8 flex-1 rounded px-3 text-[11px] font-medium text-slate-500",
                        clientMode === "existing" &&
                          "bg-white text-slate-900 shadow-sm",
                      )}
                    >
                      Cliente existente
                    </button>
                    <button
                      type="button"
                      onClick={() => onClientMode("new")}
                      className={cn(
                        "h-8 flex-1 rounded px-3 text-[11px] font-medium text-slate-500",
                        clientMode === "new" &&
                          "bg-white text-slate-900 shadow-sm",
                      )}
                    >
                      + Novo cliente
                    </button>
                  </div>
                  {clientMode === "existing" ? (
                    <Field label="Cliente">
                      <Select
                        value={draft.clientId ?? "none"}
                        onValueChange={(value) =>
                          update("clientId", value === "none" ? null : value)
                        }
                      >
                        <SelectTrigger className="h-9 rounded-md bg-white text-xs shadow-none">
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Selecione um cliente
                          </SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : (
                    <div className="grid gap-3 rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-3 sm:grid-cols-3">
                      <Field label="Nome do cliente">
                        <Input
                          value={newClient.name}
                          onChange={(event) =>
                            onNewClient({
                              ...newClient,
                              name: event.target.value,
                            })
                          }
                          className="h-9 bg-white text-xs shadow-none"
                        />
                      </Field>
                      <Field label="E-mail">
                        <Input
                          type="email"
                          value={newClient.email}
                          onChange={(event) =>
                            onNewClient({
                              ...newClient,
                              email: event.target.value,
                            })
                          }
                          className="h-9 bg-white text-xs shadow-none"
                        />
                      </Field>
                      <Field label="WhatsApp">
                        <Input
                          value={newClient.phone}
                          onChange={(event) =>
                            onNewClient({
                              ...newClient,
                              phone: event.target.value,
                            })
                          }
                          className="h-9 bg-white text-xs shadow-none"
                        />
                      </Field>
                    </div>
                  )}
                </div>
                <Field label="Título do orçamento">
                  <Input
                    value={draft.title}
                    onChange={(event) => update("title", event.target.value)}
                    placeholder="Desenvolvimento de Website Institucional"
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <Field label="Responsável">
                  <Input
                    value={draft.responsible}
                    onChange={(event) =>
                      update("responsible", event.target.value)
                    }
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <Field label="Data de emissão">
                  <Input
                    type="date"
                    value={draft.issueDate}
                    onChange={(event) =>
                      update("issueDate", event.target.value)
                    }
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <Field label="Validade">
                  <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                    <Select
                      onValueChange={(value) =>
                        update(
                          "validUntil",
                          format(
                            addDays(new Date(draft.issueDate), Number(value)),
                            "yyyy-MM-dd",
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="h-9 bg-white text-xs shadow-none">
                        <SelectValue placeholder="Prazo rápido" />
                      </SelectTrigger>
                      <SelectContent>
                        {[7, 10, 15, 30].map((days) => (
                          <SelectItem key={days} value={String(days)}>
                            {days} dias
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={draft.validUntil}
                      onChange={(event) =>
                        update("validUntil", event.target.value)
                      }
                      className="h-9 bg-white text-xs shadow-none"
                    />
                  </div>
                </Field>
              </div>
              <Field label="Descrição curta">
                <Textarea
                  value={draft.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  rows={3}
                  placeholder="Resumo objetivo da proposta"
                  className="resize-none bg-white text-xs shadow-none"
                />
              </Field>
            </EditorSection>

            <EditorSection step="02" title="Itens do orçamento">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Catálogo de itens salvos
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Reutilize serviços, horas, pacotes ou atividades sem
                      manter um módulo separado.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addItem()}
                    className="h-8 text-[11px]"
                  >
                    <Plus className="size-3.5" /> Item em branco
                  </Button>
                </div>
                <div className="week-board-scroll flex gap-2 overflow-x-auto pb-1">
                  {savedItems.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-violet-200 hover:bg-violet-50"
                    >
                      <span className="block truncate text-[11px] font-semibold text-slate-800">
                        {item.name}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">
                        {formatBRL(item.defaultPrice)} / {item.unit}
                      </span>
                    </button>
                  ))}
                  {!savedItems.length && (
                    <p className="py-3 text-[11px] text-slate-400">
                      Itens salvos aparecerão aqui.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {draft.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">
                        Item {index + 1}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => saveItem(item)}
                          className="h-7 text-[10px]"
                        >
                          <Save className="size-3" /> Salvar item
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="h-7 text-[10px] text-rose-500"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                    {savedItems.length > 0 && (
                      <div className="mb-3 max-w-xs">
                        <Field label="Usar item salvo">
                          <Select
                            value={item.savedItemId ?? "none"}
                            onValueChange={(value) =>
                              value === "none"
                                ? updateItem(item.id, {
                                    serviceId: null,
                                    savedItemId: null,
                                  })
                                : applySavedItem(value, item.id)
                            }
                          >
                            <SelectTrigger className="h-9 text-xs shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Item livre</SelectItem>
                              {savedItems.map((savedItem) => (
                                <SelectItem
                                  key={savedItem.id}
                                  value={savedItem.id}
                                >
                                  {savedItem.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    )}
                    <div className="grid gap-3 lg:grid-cols-[1.1fr_1.4fr_90px_130px_130px_130px]">
                      <Field label="Nome">
                        <Input
                          value={item.name ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, { name: event.target.value })
                          }
                          className="h-9 text-xs shadow-none"
                        />
                      </Field>
                      <Field label="Descrição">
                        <Input
                          value={item.description}
                          onChange={(event) =>
                            updateItem(item.id, {
                              description: event.target.value,
                            })
                          }
                          className="h-9 text-xs shadow-none"
                        />
                      </Field>
                      <Field label="Qtd.">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, {
                              quantity: Number(event.target.value || 0),
                            })
                          }
                          className="h-9 text-xs shadow-none"
                        />
                      </Field>
                      <Field label="Unidade">
                        <Select
                          value={item.unit ?? "unit"}
                          onValueChange={(value) =>
                            updateItem(item.id, { unit: value as QuoteUnit })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Valor unit.">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(item.id, {
                              unitPrice: Number(event.target.value || 0),
                            })
                          }
                          className="h-9 text-xs shadow-none"
                        />
                      </Field>
                      <Field label="Desconto">
                        <div className="grid grid-cols-[80px_1fr] gap-1">
                          <Select
                            value={item.discountType ?? "none"}
                            onValueChange={(value) =>
                              updateItem(item.id, {
                                discountType: value as QuoteDiscountType,
                                discountValue: 0,
                              })
                            }
                          >
                            <SelectTrigger className="h-9 text-[10px] shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem</SelectItem>
                              <SelectItem value="fixed">R$</SelectItem>
                              <SelectItem value="percent">%</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountValue ?? 0}
                            disabled={(item.discountType ?? "none") === "none"}
                            onChange={(event) =>
                              updateItem(item.id, {
                                discountValue: Number(event.target.value || 0),
                              })
                            }
                            className="h-9 text-xs shadow-none"
                          />
                        </div>
                      </Field>
                    </div>
                    {item.unit === "custom" && (
                      <Input
                        value={item.customUnit ?? ""}
                        onChange={(event) =>
                          updateItem(item.id, {
                            customUnit: event.target.value,
                          })
                        }
                        placeholder="Nome da unidade personalizada"
                        className="mt-2 h-9 max-w-xs text-xs shadow-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </EditorSection>

            <EditorSection step="03" title="Valores e condições">
              <div className="grid gap-3 lg:grid-cols-4">
                <Field label="Desconto geral">
                  <div className="grid grid-cols-[92px_1fr] gap-1">
                    <Select
                      value={draft.discountType}
                      onValueChange={(value) =>
                        update("discountType", value as QuoteDiscountType)
                      }
                    >
                      <SelectTrigger className="h-9 bg-white text-[10px] shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem</SelectItem>
                        <SelectItem value="fixed">R$</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.discountValue}
                      disabled={draft.discountType === "none"}
                      onChange={(event) =>
                        update("discountValue", Number(event.target.value || 0))
                      }
                      className="h-9 bg-white text-xs shadow-none"
                    />
                  </div>
                </Field>
                <Field label="Taxas/impostos">
                  <div className="grid grid-cols-[92px_1fr] gap-1">
                    <Select
                      value={draft.taxType}
                      onValueChange={(value) =>
                        update("taxType", value as QuoteTaxType)
                      }
                    >
                      <SelectTrigger className="h-9 bg-white text-[10px] shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem</SelectItem>
                        <SelectItem value="fixed">R$</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.taxValue}
                      disabled={draft.taxType === "none"}
                      onChange={(event) =>
                        update("taxValue", Number(event.target.value || 0))
                      }
                      className="h-9 bg-white text-xs shadow-none"
                    />
                  </div>
                </Field>
                <Field label="Rótulo da taxa">
                  <Input
                    value={draft.taxLabel}
                    onChange={(event) => update("taxLabel", event.target.value)}
                    placeholder="ISS, taxa de urgência..."
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <div className="rounded-lg bg-slate-900 px-3 py-2 text-white">
                  <p className="text-[10px] text-white/60">Total</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatBRL(quoteTotal(draft))}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-4">
                <Field label="Condição">
                  <Select
                    value={draft.paymentCondition}
                    onValueChange={(value) =>
                      update("paymentCondition", value as QuotePaymentCondition)
                    }
                  >
                    <SelectTrigger className="h-9 bg-white text-xs shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">À vista</SelectItem>
                      <SelectItem value="installments">Parcelado</SelectItem>
                      <SelectItem value="down_payment">
                        Entrada + parcelas
                      </SelectItem>
                      <SelectItem value="custom">
                        Texto personalizado
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="% de entrada">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.downPaymentPercent}
                    onChange={(event) =>
                      update(
                        "downPaymentPercent",
                        Number(event.target.value || 0),
                      )
                    }
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <Field label="Parcelas">
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={draft.installments}
                    onChange={(event) =>
                      update("installments", Number(event.target.value || 1))
                    }
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <Field label="Primeiro vencimento">
                  <Input
                    type="date"
                    value={draft.firstDueDate}
                    onChange={(event) =>
                      update("firstDueDate", event.target.value)
                    }
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
              </div>
              <Field label="Texto das condições de pagamento">
                <Textarea
                  value={draft.paymentDetails}
                  onChange={(event) =>
                    update("paymentDetails", event.target.value)
                  }
                  rows={3}
                  className="resize-none bg-white text-xs shadow-none"
                />
              </Field>
            </EditorSection>

            <EditorSection step="04" title="Prazo, escopo e termos">
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Prazo estimado">
                  <Input
                    value={draft.estimatedDeadline}
                    onChange={(event) =>
                      update("estimatedDeadline", event.target.value)
                    }
                    placeholder="15 dias"
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <Field label="Previsão de início">
                  <Input
                    type="date"
                    value={draft.estimatedStartDate}
                    onChange={(event) =>
                      update("estimatedStartDate", event.target.value)
                    }
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
                <Field label="Previsão de conclusão">
                  <Input
                    type="date"
                    value={draft.estimatedEndDate}
                    onChange={(event) =>
                      update("estimatedEndDate", event.target.value)
                    }
                    className="h-9 bg-white text-xs shadow-none"
                  />
                </Field>
              </div>
              <Field label="Escopo">
                <RichTextEditor
                  value={draft.scope}
                  onChange={(value) => update("scope", value)}
                  placeholder="Este orçamento contempla..."
                />
              </Field>
              <Field label="Não incluso">
                <RichTextEditor
                  value={draft.exclusions}
                  onChange={(value) => update("exclusions", value)}
                  placeholder="Hospedagem, domínio, terceiros..."
                />
              </Field>
              <Field label="Observações adicionais">
                <RichTextEditor
                  value={draft.notes}
                  onChange={(value) => update("notes", value)}
                  placeholder="Observações livres..."
                />
              </Field>
              <Field label="Termos e condições">
                <RichTextEditor
                  value={draft.terms}
                  onChange={(value) => update("terms", value)}
                  placeholder="Validade, cancelamento, revisões, pagamento..."
                />
              </Field>
            </EditorSection>
          </div>

          {showPreview && (
            <aside className="xl:sticky xl:top-4 xl:self-start">
              <QuoteDocument
                quote={{
                  ...draft,
                  id: "preview",
                  number: "ORC-2026-0000",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }}
                client={previewClient}
                settings={settings}
                quoteSettings={controller.quoteSettings}
                compact
              />
            </aside>
          )}
        </div>

        <SheetFooter className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Save className="size-3.5" /> Salvar orçamento
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function QuoteActions({
  quote,
  onEdit,
  onDuplicate,
  onRevision,
  onEmail,
  onWhatsApp,
  onPdf,
  onXlsx,
  onCopy,
  onApprove,
  onReject,
  onCancel,
  onDelete,
}: {
  quote: Quote;
  onEdit: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
  onRevision: (quote: Quote) => void;
  onEmail: (quote: Quote) => void;
  onWhatsApp: (quote: Quote) => void;
  onPdf: (quote: Quote) => void;
  onXlsx: (quote: Quote) => void;
  onCopy: (quote: Quote) => void | Promise<void>;
  onApprove: (quote: Quote) => void;
  onReject: (quote: Quote) => void;
  onCancel: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="size-8 p-0">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onEdit(quote)}>
          <FileText /> Visualizar / editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(quote)}>
          <Copy /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRevision(quote)}>
          <RefreshCcw /> Criar revisão
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEmail(quote)}>
          <Mail /> Enviar por e-mail
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onWhatsApp(quote)}>
          <Send /> Preparar WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void onCopy(quote)}>
          <ExternalLink /> Copiar link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onPdf(quote)}>
          <Download /> Baixar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onXlsx(quote)}>
          <FileSpreadsheet /> Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onApprove(quote)}>
          <CheckCircle2 /> Marcar como aprovado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReject(quote)}>
          <XCircle /> Marcar como recusado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCancel(quote)}>
          <XCircle /> Cancelar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(quote)}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof FileText;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <span className="grid size-8 place-items-center rounded-lg bg-[#efedff] text-[#654ce4]">
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-[9px] font-semibold",
        statusTone[status],
      )}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ConversionButton({
  icon: Icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: typeof ReceiptText;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-slate-800">
          {title}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
          {description}
        </span>
      </span>
      <ArrowRight className="size-3.5 text-slate-300" />
    </button>
  );
}

function EditorSection({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-[#654ce4] text-[9px] font-semibold text-white">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="grid min-h-56 place-items-center px-4 py-10 text-center">
      <div>
        <FileText className="mx-auto size-7 text-slate-300" />
        <h3 className="mt-3 text-sm font-semibold text-slate-800">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-slate-400">
          {description}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={onAction}
          className="mt-4 h-8 text-[11px]"
        >
          <Plus className="size-3.5" /> {action}
        </Button>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return value;
  }
}
