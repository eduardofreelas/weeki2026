import type {
  ServiceAnalytics,
  ServiceAutomationSettings,
  ServiceAvailabilityStatus,
  ServiceDeadline,
  ServiceDuration,
  ServiceExtra,
  ServiceFaq,
  ServiceFiscalSettings,
  ServiceHiringSettings,
  ServiceImage,
  ServiceLink,
  ServiceOrder,
  ServicePortfolioItem,
  ServicePricing,
  ServiceStatus,
  ServiceVariant,
  ServiceVideo,
  ServiceCustomField,
  StorefrontSettings,
  WeekiServiceDetails,
} from "@/features/services/types";

export type ServiceBillingType = "fixed" | "variable";
export type ServiceRecurrence =
  "none" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type OpportunityStatus =
  | "new"
  | "contacted"
  | "quote_requested"
  | "quote_sent"
  | "negotiation"
  | "won"
  | "lost";
export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
export type QuoteUnit =
  | "unit"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "project"
  | "session"
  | "page"
  | "package"
  | "km"
  | "square_meter"
  | "custom";
export type QuoteDiscountType = "none" | "fixed" | "percent";
export type QuoteTaxType = "none" | "fixed" | "percent";
export type QuotePaymentCondition =
  "cash" | "installments" | "down_payment" | "custom";
export type QuoteEventKind =
  | "created"
  | "updated"
  | "pdf_generated"
  | "excel_exported"
  | "shared"
  | "sent_email"
  | "sent_whatsapp"
  | "link_copied"
  | "viewed"
  | "approved"
  | "rejected"
  | "cancelled"
  | "duplicated"
  | "revision_created"
  | "converted_to_billing"
  | "converted_to_contract"
  | "converted_to_project"
  | "template_saved";
export type EngagementStatus =
  | "planning"
  | "waiting_start"
  | "in_progress"
  | "waiting_client"
  | "review"
  | "completed"
  | "cancelled";
export type DeliverableStatus =
  | "preparing"
  | "ready"
  | "sent"
  | "waiting_approval"
  | "approved"
  | "changes_requested";

export interface ServiceBase {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultPrice: number;
  billingType: ServiceBillingType;
  unit: string;
  defaultDurationDays: number;
  fiscalCode: string;
  taxRate: number;
  contractTemplateId: string | null;
  standardTasks: string[];
  recurrence: ServiceRecurrence;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Service extends ServiceBase, WeekiServiceDetails {}

export type ServiceInput = Omit<ServiceBase, "id" | "createdAt" | "updatedAt"> &
  Partial<WeekiServiceDetails>;

export type SavedItem = Service;

export interface Opportunity {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  serviceId: string | null;
  source: string;
  estimatedValue: number;
  notes: string;
  nextAction: string;
  nextActionDate: string;
  status: OpportunityStatus;
  clientId: string | null;
  quoteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  id: string;
  serviceId: string | null;
  savedItemId?: string | null;
  name?: string;
  description: string;
  quantity: number;
  unit?: QuoteUnit;
  customUnit?: string;
  unitPrice: number;
  discountType?: QuoteDiscountType;
  discountValue?: number;
  discount: number;
  addition: number;
  fiscalCode?: string;
  taxRate?: number;
}

export interface QuoteEvent {
  id: string;
  kind: QuoteEventKind;
  title: string;
  description: string;
  actor: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  number: string;
  title: string;
  clientId: string | null;
  opportunityId: string | null;
  items: QuoteItem[];
  description: string;
  issueDate: string;
  estimatedDeadline: string;
  validUntil: string;
  responsible: string;
  discountType: QuoteDiscountType;
  discountValue: number;
  taxType: QuoteTaxType;
  taxLabel: string;
  taxValue: number;
  paymentCondition: QuotePaymentCondition;
  downPaymentPercent: number;
  installments: number;
  firstDueDate: string;
  paymentDetails: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  scope: string;
  exclusions: string;
  notes: string;
  terms: string;
  paymentMethod: string;
  status: QuoteStatus;
  version: number;
  parentQuoteId: string | null;
  publicToken: string;
  viewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string;
  acceptedBy: string;
  engagementId: string | null;
  chargeId?: string | null;
  contractId?: string | null;
  events: QuoteEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string;
  items: QuoteItem[];
  estimatedDeadline: string;
  scope: string;
  exclusions: string;
  notes: string;
  terms: string;
  paymentMethod: string;
  paymentCondition: QuotePaymentCondition;
  downPaymentPercent: number;
  installments: number;
  paymentDetails: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface QuoteSettings {
  prefix: string;
  defaultValidityDays: number;
  defaultDeadlineDays: number;
  defaultTerms: string;
  defaultNotes: string;
  defaultPaymentTerms: string;
  showLogo: boolean;
  showDocument: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showSignature: boolean;
  footerText: string;
  currency: "BRL";
  decimalPlaces: number;
}

export interface Engagement {
  id: string;
  name: string;
  clientId: string;
  serviceId: string | null;
  responsible: string;
  status: EngagementStatus;
  description: string;
  startDate: string;
  dueDate: string;
  value: number;
  quoteId: string | null;
  contractId: string | null;
  recurrence: ServiceRecurrence;
  cycleValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementCycle {
  id: string;
  engagementId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
  createdAt: string;
}

export interface Deliverable {
  id: string;
  engagementId: string;
  title: string;
  description: string;
  date: string;
  attachments: string[];
  links: string[];
  notes: string;
  status: DeliverableStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  engagementId: string | null;
  taskId: string | null;
  clientId: string | null;
  description: string;
  date: string;
  minutes: number;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperationsState {
  services: Service[];
  serviceOrders: ServiceOrder[];
  storefrontSettings: StorefrontSettings;
  opportunities: Opportunity[];
  quotes: Quote[];
  quoteTemplates: QuoteTemplate[];
  quoteSettings: QuoteSettings;
  engagements: Engagement[];
  cycles: EngagementCycle[];
  deliverables: Deliverable[];
  timeEntries: TimeEntry[];
}

export type OperationsView = "engagements" | "commercial" | "services";

export type {
  ServiceAnalytics,
  ServiceAutomationSettings,
  ServiceAvailabilityStatus,
  ServiceDeadline,
  ServiceDuration,
  ServiceExtra,
  ServiceFaq,
  ServiceFiscalSettings,
  ServiceHiringSettings,
  ServiceImage,
  ServiceLink,
  ServiceOrder,
  ServicePortfolioItem,
  ServicePricing,
  ServiceStatus,
  ServiceVariant,
  ServiceVideo,
  ServiceCustomField,
  StorefrontSettings,
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  new: "Novo",
  contacted: "Em contato",
  quote_requested: "Orçamento solicitado",
  quote_sent: "Orçamento enviado",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  viewed: "Visualizado",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

export const QUOTE_UNIT_LABELS: Record<QuoteUnit, string> = {
  unit: "unidade",
  hour: "hora",
  day: "dia",
  week: "semana",
  month: "mês",
  project: "projeto",
  session: "sessão",
  page: "página",
  package: "pacote",
  km: "km",
  square_meter: "m²",
  custom: "personalizada",
};

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  planning: "Planejamento",
  waiting_start: "Aguardando início",
  in_progress: "Em andamento",
  waiting_client: "Aguardando cliente",
  review: "Em revisão",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  preparing: "Preparando",
  ready: "Pronto",
  sent: "Enviado",
  waiting_approval: "Aguardando aprovação",
  approved: "Aprovado",
  changes_requested: "Ajustes solicitados",
};

export const RECURRENCE_LABELS: Record<ServiceRecurrence, string> = {
  none: "Serviço único",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  custom: "Personalizada",
};

export const quoteLineDiscount = (item: QuoteItem) => {
  const gross = item.quantity * item.unitPrice;
  if (item.discountType === "percent") {
    return Math.min(gross, gross * ((item.discountValue ?? 0) / 100));
  }
  if (item.discountType === "fixed") {
    return Math.min(gross, item.discountValue ?? 0);
  }
  return Math.min(gross, item.discount ?? 0);
};

export const quoteItemSubtotal = (item: QuoteItem) =>
  Math.max(
    0,
    item.quantity * item.unitPrice - quoteLineDiscount(item) + item.addition,
  );
export const quoteSubtotal = (quote: Pick<Quote, "items">) =>
  quote.items.reduce((total, item) => total + quoteItemSubtotal(item), 0);
export const quoteGeneralDiscount = (
  quote: Pick<Quote, "discountType" | "discountValue" | "items">,
) => {
  const subtotal = quoteSubtotal(quote);
  if (quote.discountType === "percent") {
    return Math.min(subtotal, subtotal * (quote.discountValue / 100));
  }
  if (quote.discountType === "fixed") {
    return Math.min(subtotal, quote.discountValue);
  }
  return 0;
};
export const quoteTaxTotal = (
  quote: Pick<
    Quote,
    "discountType" | "discountValue" | "items" | "taxType" | "taxValue"
  >,
) => {
  const taxable = Math.max(
    0,
    quoteSubtotal(quote) - quoteGeneralDiscount(quote),
  );
  if (quote.taxType === "percent") return taxable * (quote.taxValue / 100);
  if (quote.taxType === "fixed") return quote.taxValue;
  return 0;
};
export const quoteTotal = (
  quote: Pick<
    Quote,
    "discountType" | "discountValue" | "items" | "taxType" | "taxValue"
  >,
) =>
  Math.max(
    0,
    quoteSubtotal(quote) - quoteGeneralDiscount(quote) + quoteTaxTotal(quote),
  );
