export const REPORT_TYPES = [
  "monthly_services",
  "activities",
  "project",
  "hours",
  "financial",
  "appointments",
  "technical",
  "custom",
] as const;

export const REPORT_STATUSES = [
  "draft",
  "in_progress",
  "review",
  "ready",
  "sent",
  "viewed",
  "approved",
  "adjustment_requested",
  "archived",
] as const;

export const REPORT_BLOCK_KINDS = [
  "cover",
  "executive_summary",
  "indicators",
  "text",
  "activities",
  "projects",
  "services",
  "appointments",
  "deliverables",
  "files",
  "images",
  "before_after",
  "hours",
  "financial",
  "in_progress",
  "next_steps",
  "observations",
  "conclusion",
  "signature",
] as const;

export const REPORT_DATA_CATEGORIES = [
  "completed_tasks",
  "in_progress_tasks",
  "projects",
  "services",
  "files",
  "appointments",
  "worked_time",
  "financial",
  "billing",
  "values",
  "contracts",
] as const;

export const REPORT_ACTIVITY_CATEGORIES = [
  "design",
  "development",
  "social_media",
  "support",
  "consulting",
  "maintenance",
  "engineering",
  "architecture",
  "photography",
  "administrative",
  "other",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ReportBlockKind = (typeof REPORT_BLOCK_KINDS)[number];
export type ReportDataCategory = (typeof REPORT_DATA_CATEGORIES)[number];
export type ReportActivityCategory = (typeof REPORT_ACTIVITY_CATEGORIES)[number];

export type ReportEventKind =
  | "created"
  | "updated"
  | "finalized"
  | "version_created"
  | "pdf_generated"
  | "share_created"
  | "share_opened"
  | "share_revoked"
  | "email_prepared"
  | "email_sent"
  | "approved"
  | "adjustment_requested"
  | "ai_generated"
  | "archived"
  | "deleted_draft";

export type ReportEvidenceKind = "image" | "file" | "link" | "document" | "screenshot" | "photo" | "external_link";
export type ReportEmailStatus = "prepared" | "sent" | "failed";
export type ReportPrimitive = string | number | boolean | null;

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  monthly_services: "Relatório mensal de serviços",
  activities: "Relatório de atividades",
  project: "Relatório de projeto",
  hours: "Relatório de horas",
  financial: "Relatório financeiro",
  appointments: "Relatório de atendimentos",
  technical: "Relatório técnico",
  custom: "Personalizado",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: "Rascunho",
  in_progress: "Em elaboração",
  review: "Aguardando revisão",
  ready: "Pronto",
  sent: "Enviado",
  viewed: "Visualizado",
  approved: "Aprovado",
  adjustment_requested: "Ajuste solicitado",
  archived: "Arquivado",
};

export const REPORT_BLOCK_LABELS: Record<ReportBlockKind, string> = {
  cover: "Capa",
  executive_summary: "Resumo executivo",
  indicators: "Indicadores",
  text: "Texto",
  activities: "Atividades realizadas",
  projects: "Projetos",
  services: "Serviços",
  appointments: "Agendamentos e atendimentos",
  deliverables: "Entregas",
  files: "Arquivos",
  images: "Imagens",
  before_after: "Antes e depois",
  hours: "Horas trabalhadas",
  financial: "Financeiro",
  in_progress: "Em andamento",
  next_steps: "Próximas etapas",
  observations: "Observações",
  conclusion: "Conclusão",
  signature: "Assinatura",
};

export const REPORT_DATA_CATEGORY_LABELS: Record<ReportDataCategory, string> = {
  completed_tasks: "Tarefas concluídas",
  in_progress_tasks: "Tarefas em andamento",
  projects: "Projetos",
  services: "Serviços",
  files: "Arquivos e anexos",
  appointments: "Agendamentos",
  worked_time: "Tempo trabalhado",
  financial: "Financeiro",
  billing: "Cobranças",
  values: "Valores",
  contracts: "Contratos",
};

export const REPORT_ACTIVITY_CATEGORY_LABELS: Record<ReportActivityCategory, string> = {
  design: "Design",
  development: "Desenvolvimento",
  social_media: "Social Media",
  support: "Atendimento",
  consulting: "Consultoria",
  maintenance: "Manutenção",
  engineering: "Engenharia",
  architecture: "Arquitetura",
  photography: "Fotografia",
  administrative: "Administrativo",
  other: "Outros",
};

export interface ReportBusinessSnapshot {
  name: string;
  professionalName: string;
  email: string;
  phone: string;
  document: string;
  site: string;
  logoUrl: string;
  signature: string;
  capturedAt: string;
}

export interface ReportClientSnapshot {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  contactName: string;
  website: string;
  logoUrl: string;
  segment: string;
  capturedAt: string;
}

export interface ReportEvidenceSnapshot {
  id: string;
  taskId: string | null;
  title: string;
  kind: ReportEvidenceKind;
  url: string;
  fileName: string;
  contentType: string;
  size: number;
  description: string;
  createdAt: string;
}

export interface ReportActivitySnapshot {
  id: string;
  sourceId: string;
  sourceType: "task" | "manual";
  date: string;
  title: string;
  internalTitle: string;
  description: string;
  internalDescription: string;
  category: ReportActivityCategory;
  status: string;
  statusLabel: string;
  responsible: string;
  estimateMinutes: number | null;
  tags: string[];
  evidences: ReportEvidenceSnapshot[];
}

export interface ReportFinancialSnapshot {
  charges: Array<{
    id: string;
    code: string;
    description: string;
    amount: number;
    dueDate: string;
    status: string;
  }>;
  transactions: Array<{
    id: string;
    type: "income" | "expense";
    description: string;
    amount: number;
    dueDate: string;
    paidDate: string;
    status: string;
  }>;
}

export interface ReportSourceSnapshot {
  business: ReportBusinessSnapshot;
  client: ReportClientSnapshot | null;
  periodStart: string;
  periodEnd: string;
  activities: ReportActivitySnapshot[];
  financial: ReportFinancialSnapshot;
  generatedAt: string;
}

export interface ReportMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface ReportBlock {
  id: string;
  kind: ReportBlockKind;
  title: string;
  visible: boolean;
  order: number;
  content: string;
  activityIds: string[];
  evidenceIds: string[];
  metricIds: string[];
  settings: Record<string, ReportPrimitive>;
}

export interface ReportVisualIdentity {
  providerLogoUrl: string;
  clientLogoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  document: string;
  site: string;
  footer: string;
  signature: string;
}

export interface ReportVersion {
  id: string;
  version: number;
  reason: string;
  immutable: boolean;
  snapshotHash: string;
  sourceSnapshot: ReportSourceSnapshot;
  blocks: ReportBlock[];
  metrics: ReportMetric[];
  createdAt: string;
  createdBy: string;
}

export interface ReportShare {
  token: string;
  allowView: boolean;
  allowDownload: boolean;
  passwordHash: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  accessCount: number;
  lastAccessAt: string | null;
  createdAt: string;
}

export interface ReportEmailDispatch {
  id: string;
  recipient: string;
  subject: string;
  message: string;
  includePdf: boolean;
  includeLink: boolean;
  status: ReportEmailStatus;
  createdAt: string;
}

export interface ReportClientDecision {
  id: string;
  kind: "approved" | "adjustment_requested";
  message: string;
  createdAt: string;
}

export interface ReportEvent {
  id: string;
  kind: ReportEventKind;
  title: string;
  description: string;
  actor: string;
  createdAt: string;
}

export interface WeekiReport {
  id: string;
  workspaceId: string;
  number: string;
  title: string;
  clientId: string | null;
  clientName: string;
  type: ReportType;
  templateId: string | null;
  responsible: string;
  periodStart: string;
  periodEnd: string;
  selectedCategories: ReportDataCategory[];
  sourceSnapshot: ReportSourceSnapshot;
  metrics: ReportMetric[];
  blocks: ReportBlock[];
  visual: ReportVisualIdentity;
  status: ReportStatus;
  currentVersionId: string;
  versions: ReportVersion[];
  share: ReportShare | null;
  emailDispatches: ReportEmailDispatch[];
  clientDecisions: ReportClientDecision[];
  events: ReportEvent[];
  finalizedAt: string | null;
  sentAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  defaultBlocks: ReportBlockKind[];
  visual: Partial<ReportVisualIdentity>;
  favorite: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSchedule {
  id: string;
  clientId: string;
  clientName: string;
  templateId: string;
  templateName: string;
  frequency: "monthly" | "weekly" | "quarterly";
  nextRunAt: string;
  lastReportId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDraftInput {
  title: string;
  clientId: string | null;
  clientName: string;
  type: ReportType;
  templateId: string | null;
  responsible: string;
  periodStart: string;
  periodEnd: string;
  selectedCategories: ReportDataCategory[];
  sourceSnapshot: ReportSourceSnapshot;
  metrics: ReportMetric[];
  blocks: ReportBlock[];
  visual: ReportVisualIdentity;
}

export function stripReportHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeReportHtml(value: string) {
  const allowed = new Set(["h1", "h2", "h3", "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "a", "div", "span"]);
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, rawTag: string, rawAttrs: string) => {
      const closing = match.startsWith("</");
      const tag = rawTag.toLowerCase();
      if (!allowed.has(tag)) return "";
      if (closing) return `</${tag}>`;
      if (tag === "br") return "<br>";
      const href = rawAttrs.match(/\shref=(["'])(.*?)\1/i)?.[2]?.trim();
      if (tag === "a" && href && /^https?:\/\//i.test(href)) return `<a href="${href.replace(/"/g, "&quot;")}">`;
      return `<${tag}>`;
    });
}

export function deriveReportMetrics(sourceSnapshot: ReportSourceSnapshot): ReportMetric[] {
  const activities = sourceSnapshot.activities;
  const completed = activities.filter((activity) => activity.status === "completed").length;
  const inProgress = activities.filter((activity) => activity.status !== "completed").length;
  const deliverables = activities.filter((activity) => activity.evidences.length > 0 || activity.tags.length > 0).length;
  const evidenceCount = activities.reduce((total, activity) => total + activity.evidences.length, 0);
  const minutes = activities.reduce((total, activity) => total + (activity.estimateMinutes ?? 0), 0);
  const hours = minutes > 0 ? `${Math.round((minutes / 60) * 10) / 10}h` : "0h";
  return [
    { id: "activities", label: "Atividades", value: String(activities.length), detail: "registros selecionados" },
    { id: "completed", label: "Concluídas", value: String(completed), detail: "atividades finalizadas" },
    { id: "in_progress", label: "Em andamento", value: String(inProgress), detail: "atividades abertas" },
    { id: "deliverables", label: "Entregas", value: String(deliverables), detail: "itens com entregáveis ou tags" },
    { id: "worked_time", label: "Horas", value: hours, detail: "estimativa registrada" },
    { id: "evidences", label: "Evidências", value: String(evidenceCount), detail: "arquivos, links e anexos" },
  ];
}

export function reportSnapshotHash(value: unknown) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `local-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
