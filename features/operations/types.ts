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
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
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

export interface Service {
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
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  addition: number;
}

export interface Quote {
  id: string;
  number: string;
  clientId: string | null;
  opportunityId: string | null;
  items: QuoteItem[];
  description: string;
  estimatedDeadline: string;
  validUntil: string;
  notes: string;
  terms: string;
  paymentMethod: string;
  status: QuoteStatus;
  approvedAt: string | null;
  engagementId: string | null;
  createdAt: string;
  updatedAt: string;
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
  opportunities: Opportunity[];
  quotes: Quote[];
  engagements: Engagement[];
  cycles: EngagementCycle[];
  deliverables: Deliverable[];
  timeEntries: TimeEntry[];
}

export type OperationsView = "engagements" | "commercial" | "services";

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
  approved: "Aprovado",
  rejected: "Recusado",
  expired: "Expirado",
  cancelled: "Cancelado",
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

export const quoteItemSubtotal = (item: QuoteItem) =>
  Math.max(0, item.quantity * item.unitPrice - item.discount + item.addition);
export const quoteSubtotal = (quote: Pick<Quote, "items">) =>
  quote.items.reduce((total, item) => total + quoteItemSubtotal(item), 0);
