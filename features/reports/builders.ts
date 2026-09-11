import type { BillingCharge } from "@/features/billing/types";
import type { Client } from "@/features/clients/types";
import type { FinanceTransaction } from "@/features/finance/types";
import type { WeekiSettings } from "@/features/settings/types";
import type { Task } from "@/features/tasks/types";
import { STATUS_LABELS } from "@/features/tasks/types";
import { createId, formatDateBR } from "@/lib/format";
import {
  REPORT_ACTIVITY_CATEGORIES,
  REPORT_BLOCK_LABELS,
  deriveReportMetrics,
  stripReportHtml,
  type ReportActivityCategory,
  type ReportActivitySnapshot,
  type ReportBlock,
  type ReportBlockKind,
  type ReportDataCategory,
  type ReportDraftInput,
  type ReportEvidenceKind,
  type ReportEvidenceSnapshot,
  type ReportFinancialSnapshot,
  type ReportMetric,
  type ReportSourceSnapshot,
  type ReportTemplate,
  type ReportType,
  type ReportVisualIdentity,
} from "@/shared/reports";

const categorySet = new Set<string>(REPORT_ACTIVITY_CATEGORIES);

export function dateInReportPeriod(value: string, periodStart: string, periodEnd: string) {
  if (!value || !periodStart || !periodEnd) return false;
  return value >= periodStart && value <= periodEnd;
}

export function taskReportDate(task: Task) {
  return task.scheduledDate || task.dueDate || task.createdAt.slice(0, 10);
}

export function findReportCandidateTasks(tasks: Task[], input: { clientId: string | null; periodStart: string; periodEnd: string }) {
  if (!input.clientId || !input.periodStart || !input.periodEnd) return [];
  return tasks
    .filter((task) => !task.archivedAt)
    .filter((task) => task.clientId === input.clientId)
    .filter((task) => task.report?.includeInReports !== false)
    .filter((task) => dateInReportPeriod(taskReportDate(task), input.periodStart, input.periodEnd))
    .sort((a, b) => taskReportDate(a).localeCompare(taskReportDate(b)) || a.title.localeCompare(b.title));
}

export function filterTasksBySelectedCategories(tasks: Task[], categories: ReportDataCategory[]) {
  const includeCompleted = categories.includes("completed_tasks");
  const includeOpen = categories.includes("in_progress_tasks");
  return tasks.filter((task) => {
    if (task.status === "completed") return includeCompleted;
    return includeOpen;
  });
}

function inferReportCategory(task: Task): ReportActivityCategory {
  const configured = task.report?.category;
  if (configured && categorySet.has(configured)) return configured;
  const text = `${task.title} ${task.tags.join(" ")}`.toLocaleLowerCase("pt-BR");
  if (text.includes("design")) return "design";
  if (text.includes("social")) return "social_media";
  if (text.includes("site") || text.includes("desenvolv")) return "development";
  if (text.includes("atendimento")) return "support";
  if (text.includes("consult")) return "consulting";
  if (text.includes("manuten")) return "maintenance";
  if (text.includes("engenh")) return "engineering";
  if (text.includes("arquitet")) return "architecture";
  if (text.includes("foto")) return "photography";
  if (text.includes("admin")) return "administrative";
  return "other";
}

function evidenceKind(attachmentType: string, name: string): ReportEvidenceKind {
  if (attachmentType === "link") return "external_link";
  if (attachmentType.startsWith("image/")) return "image";
  if (/screenshot|captura/i.test(name)) return "screenshot";
  if (/foto|photo/i.test(name)) return "photo";
  if (/pdf|doc|sheet|slide/i.test(attachmentType)) return "document";
  return "file";
}

function evidenceFromTask(task: Task): ReportEvidenceSnapshot[] {
  return task.attachments.map((attachment) => {
    const isLink = attachment.type === "link" || /^https?:\/\//i.test(attachment.name);
    return {
      id: attachment.id,
      taskId: task.id,
      title: attachment.name,
      kind: evidenceKind(attachment.type, attachment.name),
      url: isLink ? attachment.name : "",
      fileName: isLink ? "" : attachment.name,
      contentType: attachment.type,
      size: attachment.size,
      description: task.report?.evidenceNotes ?? "",
      createdAt: task.updatedAt,
    };
  });
}

export function buildActivitySnapshot(task: Task, responsible: string): ReportActivitySnapshot {
  return {
    id: createId(),
    sourceId: task.id,
    sourceType: "task",
    date: taskReportDate(task),
    title: task.report?.description?.trim() || stripReportHtml(task.description) || task.title,
    internalTitle: task.title,
    description: task.report?.description?.trim() || stripReportHtml(task.description),
    internalDescription: stripReportHtml(task.description),
    category: inferReportCategory(task),
    status: task.status,
    statusLabel: STATUS_LABELS[task.status],
    responsible,
    estimateMinutes: task.estimateMinutes,
    tags: task.tags,
    evidences: evidenceFromTask(task),
  };
}

function financialSnapshot(input: {
  clientId: string | null;
  periodStart: string;
  periodEnd: string;
  categories: ReportDataCategory[];
  charges: BillingCharge[];
  transactions: FinanceTransaction[];
}): ReportFinancialSnapshot {
  if (!input.clientId || (!input.categories.includes("financial") && !input.categories.includes("billing") && !input.categories.includes("values"))) {
    return { charges: [], transactions: [] };
  }
  return {
    charges: input.categories.includes("billing") || input.categories.includes("values")
      ? input.charges
          .filter((charge) => charge.clientId === input.clientId && dateInReportPeriod(charge.dueDate, input.periodStart, input.periodEnd))
          .map((charge) => ({
            id: charge.id,
            code: charge.code,
            description: charge.description,
            amount: charge.amount,
            dueDate: charge.dueDate,
            status: charge.status,
          }))
      : [],
    transactions: input.categories.includes("financial") || input.categories.includes("values")
      ? input.transactions
          .filter((transaction) => transaction.clientId === input.clientId)
          .filter((transaction) => dateInReportPeriod(transaction.paidDate || transaction.dueDate, input.periodStart, input.periodEnd))
          .map((transaction) => ({
            id: transaction.id,
            type: transaction.type,
            description: transaction.description,
            amount: transaction.amount,
            dueDate: transaction.dueDate,
            paidDate: transaction.paidDate,
            status: transaction.status,
          }))
      : [],
  };
}

export function buildReportVisual(settings: WeekiSettings, client: Client | null, overrides?: Partial<ReportVisualIdentity>): ReportVisualIdentity {
  return {
    providerLogoUrl: settings.profile.avatarUrl,
    clientLogoUrl: client?.logoUrl ?? "",
    primaryColor: "#7657ff",
    secondaryColor: "#2f80ed",
    companyName: settings.profile.businessName || settings.profile.professionalName || settings.profile.name,
    contactEmail: settings.profile.email,
    contactPhone: settings.profile.phone,
    document: "",
    site: "",
    footer: "Relatório gerado pela Weeki.",
    signature: settings.profile.professionalName || settings.profile.name,
    ...overrides,
  };
}

export function buildReportSourceSnapshot(input: {
  client: Client | null;
  settings: WeekiSettings;
  tasks: Task[];
  charges: BillingCharge[];
  transactions: FinanceTransaction[];
  selectedTaskIds: string[];
  selectedCategories: ReportDataCategory[];
  periodStart: string;
  periodEnd: string;
  responsible: string;
}): ReportSourceSnapshot {
  const selected = input.tasks.filter((task) => input.selectedTaskIds.includes(task.id));
  const capturedAt = new Date().toISOString();
  return {
    business: {
      name: input.settings.profile.businessName || input.settings.profile.professionalName || input.settings.profile.name,
      professionalName: input.settings.profile.professionalName || input.settings.profile.name,
      email: input.settings.profile.email,
      phone: input.settings.profile.phone,
      document: "",
      site: "",
      logoUrl: input.settings.profile.avatarUrl,
      signature: input.settings.profile.professionalName || input.settings.profile.name,
      capturedAt,
    },
    client: input.client ? {
      id: input.client.id,
      name: input.client.name,
      email: input.client.email,
      phone: input.client.phone,
      document: input.client.document,
      contactName: input.client.contactName,
      website: input.client.website,
      logoUrl: input.client.logoUrl,
      segment: input.client.segment,
      capturedAt,
    } : null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    activities: selected.map((task) => buildActivitySnapshot(task, input.responsible)),
    financial: financialSnapshot({
      clientId: input.client?.id ?? null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      categories: input.selectedCategories,
      charges: input.charges,
      transactions: input.transactions,
    }),
    generatedAt: capturedAt,
  };
}

export function buildExecutiveSummary(source: ReportSourceSnapshot) {
  const completed = source.activities.filter((activity) => activity.status === "completed").length;
  const open = source.activities.length - completed;
  const clientName = source.client?.name || "cliente";
  return `<p>No período de ${formatDateBR(source.periodStart)} a ${formatDateBR(source.periodEnd)}, foram selecionadas ${source.activities.length} atividades relacionadas a ${clientName}. ${completed} foram concluídas e ${open} permanecem em acompanhamento.</p>`;
}

export function buildReportBlocks(input: {
  sourceSnapshot: ReportSourceSnapshot;
  metrics: ReportMetric[];
  blockKinds: ReportBlockKind[];
  title: string;
  responsible: string;
}): ReportBlock[] {
  const allActivityIds = input.sourceSnapshot.activities.map((activity) => activity.id);
  const openActivityIds = input.sourceSnapshot.activities.filter((activity) => activity.status !== "completed").map((activity) => activity.id);
  const evidenceIds = input.sourceSnapshot.activities.flatMap((activity) => activity.evidences.map((evidence) => evidence.id));

  return input.blockKinds.map((kind, index) => {
    const block: ReportBlock = {
      id: createId(),
      kind,
      title: REPORT_BLOCK_LABELS[kind],
      visible: true,
      order: index,
      content: "",
      activityIds: [],
      evidenceIds: [],
      metricIds: [],
      settings: {},
    };

    if (kind === "cover") {
      return {
        ...block,
        content: `<p>${input.title}</p>`,
        settings: {
          subtitle: input.sourceSnapshot.client?.name ?? "",
          period: `${formatDateBR(input.sourceSnapshot.periodStart)} a ${formatDateBR(input.sourceSnapshot.periodEnd)}`,
          responsible: input.responsible,
          date: formatDateBR(new Date().toISOString().slice(0, 10)),
        },
      };
    }
    if (kind === "executive_summary") return { ...block, content: buildExecutiveSummary(input.sourceSnapshot) };
    if (kind === "indicators") return { ...block, metricIds: input.metrics.map((metric) => metric.id) };
    if (kind === "activities") return { ...block, activityIds: allActivityIds };
    if (kind === "deliverables" || kind === "files" || kind === "images" || kind === "before_after") return { ...block, evidenceIds };
    if (kind === "hours") return { ...block, activityIds: allActivityIds };
    if (kind === "financial") return { ...block };
    if (kind === "in_progress") return { ...block, activityIds: openActivityIds };
    if (kind === "next_steps") return { ...block, content: openActivityIds.length ? "<p>As atividades em andamento seguem priorizadas para o próximo período, com atualização conforme conclusão e validação do cliente.</p>" : "<p>Não há próximas etapas registradas neste período.</p>" };
    if (kind === "observations") return { ...block, content: "<p>Sem observações adicionais registradas.</p>" };
    if (kind === "conclusion") return { ...block, content: "<p>O período foi consolidado com base nas informações selecionadas neste relatório.</p>" };
    if (kind === "signature") return { ...block, settings: { role: "Responsável pelo relatório" } };
    return block;
  });
}

export function buildReportDraftInput(input: {
  title: string;
  client: Client | null;
  type: ReportType;
  template: ReportTemplate | null;
  responsible: string;
  periodStart: string;
  periodEnd: string;
  selectedCategories: ReportDataCategory[];
  selectedTaskIds: string[];
  tasks: Task[];
  charges: BillingCharge[];
  transactions: FinanceTransaction[];
  settings: WeekiSettings;
  blockKinds: ReportBlockKind[];
  visual: Partial<ReportVisualIdentity>;
}): ReportDraftInput {
  const sourceSnapshot = buildReportSourceSnapshot({
    client: input.client,
    settings: input.settings,
    tasks: input.tasks,
    charges: input.charges,
    transactions: input.transactions,
    selectedTaskIds: input.selectedTaskIds,
    selectedCategories: input.selectedCategories,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    responsible: input.responsible,
  });
  const metrics = deriveReportMetrics(sourceSnapshot);
  const visual = buildReportVisual(input.settings, input.client, { ...input.template?.visual, ...input.visual });
  return {
    title: input.title,
    clientId: input.client?.id ?? null,
    clientName: input.client?.name ?? "",
    type: input.type,
    templateId: input.template?.id ?? null,
    responsible: input.responsible,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    selectedCategories: input.selectedCategories,
    sourceSnapshot,
    metrics,
    blocks: buildReportBlocks({ sourceSnapshot, metrics, blockKinds: input.blockKinds, title: input.title, responsible: input.responsible }),
    visual,
  };
}
