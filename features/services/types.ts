export type ServiceStatus = "draft" | "published" | "hidden" | "archived";
export type ServiceAvailabilityStatus =
  "available" | "unavailable" | "temporarily_unavailable" | "by_request";
export type ServicePricingType =
  "fixed" | "starting_at" | "unit" | "on_request" | "free";
export type ServiceChargingUnit =
  | "unit"
  | "hour"
  | "day"
  | "session"
  | "month"
  | "project"
  | "page"
  | "square_meter"
  | "km"
  | "package"
  | "custom";
export type ServiceHiringType =
  | "buy_now"
  | "request_quote"
  | "schedule"
  | "contact"
  | "hire_and_schedule"
  | "consult";
export type ServicePaymentMethod =
  "pix" | "credit_card" | "bank_slip" | "transfer" | "cash" | "other";
export type ServicePaymentMode = "full" | "deposit" | "installments" | "custom";
export type ServiceVideoProvider = "youtube" | "vimeo" | "external";
export type ServiceLinkKind =
  | "site"
  | "behance"
  | "instagram"
  | "portfolio"
  | "google_drive"
  | "github"
  | "other";
export type ServiceCustomFieldType =
  | "text"
  | "long_text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "file";
export type ServiceOrderStatus =
  | "interest"
  | "awaiting_payment"
  | "paid"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";
export type ServiceOrderPaymentStatus =
  "not_required" | "pending" | "paid" | "overdue" | "cancelled" | "refunded";

export interface ServiceImage {
  id: string;
  url: string;
  alt: string;
  caption: string;
  source: "url" | "upload";
  sortOrder: number;
  isCover: boolean;
  createdAt: string;
}

export interface ServicePortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  gallery: ServiceImage[];
  clientName: string;
  projectDate: string;
  externalUrl: string;
  result: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceVideo {
  id: string;
  title: string;
  url: string;
  provider: ServiceVideoProvider;
  embedUrl: string;
}

export interface ServiceLink {
  id: string;
  label: string;
  url: string;
  kind: ServiceLinkKind;
  icon: string;
}

export interface ServiceVariant {
  id: string;
  name: string;
  description: string;
  price: number;
  includedItems: string[];
  highlighted: boolean;
  duration: string;
  conditions: string;
}

export interface ServiceExtra {
  id: string;
  name: string;
  description: string;
  price: number;
  required: boolean;
  allowQuantity: boolean;
  maxQuantity: number;
  imageUrl: string;
}

export interface ServiceFaq {
  id: string;
  question: string;
  answer: string;
}

export interface ServiceCustomField {
  id: string;
  label: string;
  type: ServiceCustomFieldType;
  required: boolean;
  options: string[];
  placeholder: string;
  helpText: string;
}

export interface ServicePricing {
  type: ServicePricingType;
  amount: number;
  unit: ServiceChargingUnit;
  customUnit: string;
  label: string;
}

export interface ServiceDeadline {
  value: number;
  unit: "minutes" | "hours" | "days" | "business_days" | "weeks" | "months";
  customText: string;
}

export interface ServiceDuration {
  value: number;
  unit: "minutes" | "hours" | "days" | "weeks" | "months" | "custom";
  customText: string;
}

export interface ServicePaymentSettings {
  methods: ServicePaymentMethod[];
  mode: ServicePaymentMode;
  depositPercent: number;
  maxInstallments: number;
  notes: string;
  providerPreference: "default" | "asaas" | "mercadopago" | "stripe";
  requirePaymentBeforeScheduling: boolean;
  createChargeAutomatically: boolean;
}

export interface ServiceScheduleSettings {
  enabled: boolean;
  durationMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  maximumAdvanceDays: number;
  allowedWeekdays: number[];
  specificHours: string[];
  useWorkspaceAvailability: boolean;
}

export interface ServiceHiringSettings {
  type: ServiceHiringType;
  autoCreateClient: boolean;
  autoCreateDemand: boolean;
  autoCreateContract: boolean;
  autoCreateBilling: boolean;
  reserveTimeWhenScheduled: boolean;
  intakeTitle: string;
  confirmationMessage: string;
}

export interface ServiceSeoSettings {
  title: string;
  description: string;
  imageUrl: string;
  noIndex: boolean;
}

export interface ServiceAnalytics {
  storefrontViews: number;
  serviceViews: number;
  ctaClicks: number;
  quoteRequests: number;
  purchases: number;
  appointments: number;
  lastViewedAt: string | null;
}

export interface ServiceFiscalSettings {
  serviceCode: string;
  cnae: string;
  municipalCode: string;
  issRate: number;
  fiscalDescription: string;
}

export interface ServiceAutomationSettings {
  createDemandOnOrder: boolean;
  createContractOnPayment: boolean;
  requestReviewOnCompletion: boolean;
  suggestNfseOnCompletion: boolean;
}

export interface WeekiServiceDetails {
  slug: string;
  status: ServiceStatus;
  availabilityStatus: ServiceAvailabilityStatus;
  summary: string;
  fullDescription: string;
  coverImage: string;
  gallery: ServiceImage[];
  portfolio: ServicePortfolioItem[];
  videos: ServiceVideo[];
  links: ServiceLink[];
  pricing: ServicePricing;
  variants: ServiceVariant[];
  extras: ServiceExtra[];
  includedItems: string[];
  excludedItems: string[];
  deadline: ServiceDeadline;
  duration: ServiceDuration;
  hiring: ServiceHiringSettings;
  payment: ServicePaymentSettings;
  scheduling: ServiceScheduleSettings;
  faq: ServiceFaq[];
  customFields: ServiceCustomField[];
  serviceTerms: string;
  seo: ServiceSeoSettings;
  analytics: ServiceAnalytics;
  featured: boolean;
  inStorefront: boolean;
  publicToken: string;
  fiscal: ServiceFiscalSettings;
  automations: ServiceAutomationSettings;
}

export interface StorefrontSettings {
  enabled: boolean;
  slug: string;
  publicName: string;
  businessName: string;
  headline: string;
  about: string;
  logoUrl: string;
  avatarUrl: string;
  coverUrl: string;
  location: string;
  siteUrl: string;
  instagramUrl: string;
  whatsapp: string;
  email: string;
  customDomain: string;
  theme: "minimal" | "editorial" | "studio";
  accentColor: string;
  serviceOrder: string[];
  featuredServiceIds: string[];
  categories: string[];
  showPrices: boolean;
  showRatings: boolean;
  seoTitle: string;
  seoDescription: string;
  previousSlugs: string[];
  updatedAt: string;
}

export interface ServiceOrderAnswer {
  fieldId: string;
  label: string;
  value: string | string[] | boolean;
}

export interface ServiceOrderExtraSnapshot {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ServiceOrder {
  id: string;
  number: string;
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocument: string;
  planId: string | null;
  planName: string;
  extras: ServiceOrderExtraSnapshot[];
  answers: ServiceOrderAnswer[];
  message: string;
  total: number;
  paymentStatus: ServiceOrderPaymentStatus;
  paymentMethod: ServicePaymentMethod | "not_selected";
  paymentLink: string;
  appointmentDate: string;
  appointmentTime: string;
  quoteId: string | null;
  chargeId: string | null;
  contractId: string | null;
  engagementId: string | null;
  source: "storefront" | "manual" | "quote" | "appointment";
  status: ServiceOrderStatus;
  events: Array<{
    id: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type ServiceOrderInput = Omit<
  ServiceOrder,
  "id" | "number" | "events" | "createdAt" | "updatedAt"
>;

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  hidden: "Oculto",
  archived: "Arquivado",
};

export const SERVICE_AVAILABILITY_LABELS: Record<
  ServiceAvailabilityStatus,
  string
> = {
  available: "Disponível",
  unavailable: "Indisponível",
  temporarily_unavailable: "Temporariamente indisponível",
  by_request: "Sob consulta",
};

export const SERVICE_PRICING_LABELS: Record<ServicePricingType, string> = {
  fixed: "Preço fixo",
  starting_at: "A partir de",
  unit: "Por unidade",
  on_request: "Sob consulta",
  free: "Gratuito",
};

export const SERVICE_UNIT_LABELS: Record<ServiceChargingUnit, string> = {
  unit: "unidade",
  hour: "hora",
  day: "dia",
  session: "sessão",
  month: "mês",
  project: "projeto",
  page: "página",
  square_meter: "m²",
  km: "km",
  package: "pacote",
  custom: "personalizada",
};

export const SERVICE_HIRING_LABELS: Record<ServiceHiringType, string> = {
  buy_now: "Comprar agora",
  request_quote: "Solicitar orçamento",
  schedule: "Agendar",
  contact: "Entrar em contato",
  hire_and_schedule: "Contratar e agendar",
  consult: "Sob consulta",
};

export const SERVICE_ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  interest: "Interesse",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const SERVICE_PAYMENT_METHOD_LABELS: Record<
  ServicePaymentMethod,
  string
> = {
  pix: "PIX",
  credit_card: "Cartão",
  bank_slip: "Boleto",
  transfer: "Transferência",
  cash: "Dinheiro",
  other: "Outro",
};
