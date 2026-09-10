export const NFSE_STATUSES = [
  "DRAFT",
  "PENDING",
  "PROCESSING",
  "AUTHORIZED",
  "REJECTED",
  "CANCELLED",
  "ERROR",
] as const;

export type NfseStatus = (typeof NFSE_STATUSES)[number];
export type FiscalEnvironment = "sandbox" | "production";
export type FiscalProviderId = "national_nfse" | "focus_nfe" | "plugnotas";
export type FiscalPersonType = "individual" | "company";
export type FiscalTaxRegime =
  | "mei"
  | "simples_nacional"
  | "presumed_profit"
  | "actual_profit"
  | "other";
export type NfseOrigin =
  | "manual"
  | "service_completion"
  | "payment_confirmed"
  | "automation";
export type FiscalAutomationMode =
  | "never"
  | "ask_on_service_completion"
  | "on_service_completion"
  | "on_payment_confirmed";

export interface FiscalAddress {
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  city: string;
  cityCode: string;
  state: string;
  countryCode: "BR";
}

export interface FiscalIssuer {
  personType: FiscalPersonType;
  document: string;
  legalName: string;
  tradeName: string;
  municipalRegistration: string;
  email: string;
  phone: string;
  address: FiscalAddress;
  taxRegime: FiscalTaxRegime | "";
  simpleNational: boolean;
  mei: boolean;
}

export interface FiscalCustomer {
  localId: string;
  personType: FiscalPersonType;
  document: string;
  name: string;
  municipalRegistration: string;
  email: string;
  phone: string;
  address: FiscalAddress;
}

export interface FiscalTax {
  issRate: number;
  issWithheld: boolean;
  inssWithheld: boolean;
  irWithheld: boolean;
  csllWithheld: boolean;
  pisWithheld: boolean;
  cofinsWithheld: boolean;
  approximateTaxAmount: number;
}

export interface FiscalService {
  localId: string;
  name: string;
  fiscalDescription: string;
  serviceCode: string;
  taxationCode: string;
  defaultAmount: number;
  incidenceCity: string;
  incidenceCityCode: string;
  operationNature: string;
  tax: FiscalTax;
}

export interface FiscalProfile extends FiscalIssuer {
  provider: FiscalProviderId;
  environment: FiscalEnvironment;
  configuredAt: string | null;
  updatedAt: string | null;
}

export interface FiscalCertificateMetadata {
  id: string;
  name: string;
  holderName: string;
  holderDocument: string;
  validFrom: string;
  expiresAt: string;
  status: "not_configured" | "active" | "expiring" | "expired" | "error";
  updatedAt: string;
}

export interface FiscalServiceConfig extends FiscalService {
  id: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalAutomationSettings {
  enabled: boolean;
  mode: FiscalAutomationMode;
  sendEmail: boolean;
  saveToClient: boolean;
  attachToService: boolean;
  attachToCharge: boolean;
  whatsappEnabled: false;
}

export interface NfseDocument {
  id: string;
  kind: "pdf" | "xml";
  fileName: string;
  contentType: string;
  checksum: string;
  createdAt: string;
}

export interface NfseError {
  id: string;
  code: string;
  userMessage: string;
  providerMessage: string;
  safeContext: Record<string, string | number | boolean | null>;
  provider: FiscalProviderId;
  attempt: number;
  createdAt: string;
}

export type NfseEventKind =
  | "created"
  | "validation_started"
  | "validation_failed"
  | "issue_requested"
  | "processing"
  | "authorized"
  | "rejected"
  | "retry_requested"
  | "pdf_obtained"
  | "xml_obtained"
  | "email_sent"
  | "cancel_requested"
  | "cancelled"
  | "error";

export interface NfseEvent {
  id: string;
  kind: NfseEventKind;
  title: string;
  description: string;
  createdAt: string;
}

export interface NfseRecord {
  id: string;
  workspaceId: string;
  idempotencyKey: string;
  status: NfseStatus;
  environment: FiscalEnvironment;
  provider: FiscalProviderId;
  providerReference: string;
  providerStatus: string;
  origin: NfseOrigin;
  issuer: FiscalIssuer;
  customer: FiscalCustomer;
  service: FiscalService;
  description: string;
  amount: number;
  competenceDate: string;
  issuedAt: string | null;
  number: string;
  series: string;
  accessKey: string;
  municipality: string;
  issAmount: number;
  withholdingAmount: number;
  clientId: string;
  serviceConfigId: string;
  taskId: string | null;
  chargeId: string | null;
  projectId: string | null;
  documents: NfseDocument[];
  errors: NfseError[];
  events: NfseEvent[];
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface NfseRequest {
  idempotencyKey: string;
  environment: FiscalEnvironment;
  origin: NfseOrigin;
  issuer: FiscalIssuer;
  customer: FiscalCustomer;
  service: FiscalService;
  description: string;
  amount: number;
  competenceDate: string;
  clientId: string;
  serviceConfigId: string;
  taskId?: string | null;
  chargeId?: string | null;
  projectId?: string | null;
}

export interface NfseResponse {
  providerReference: string;
  status: NfseStatus;
  number?: string;
  series?: string;
  accessKey?: string;
  issuedAt?: string;
  rawStatus?: string;
}

export interface MunicipalParameters {
  cityCode: string;
  municipalityName: string;
  municipalRegistrationRequired: boolean;
  serviceCodes: Array<{ code: string; description: string }>;
  refreshedAt: string;
}

export interface FiscalValidationIssue {
  field: string;
  code: string;
  message: string;
  section: "issuer" | "customer" | "service" | "note" | "certificate";
}

export interface FiscalValidationResult {
  valid: boolean;
  issues: FiscalValidationIssue[];
}

export const NFSE_STATUS_LABELS: Record<NfseStatus, string> = {
  DRAFT: "Rascunho",
  PENDING: "Aguardando emissão",
  PROCESSING: "Processando",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  ERROR: "Erro",
};

export const NFSE_ORIGIN_LABELS: Record<NfseOrigin, string> = {
  manual: "Emissão manual",
  service_completion: "Conclusão de serviço",
  payment_confirmed: "Pagamento de cobrança",
  automation: "Automação",
};

export const FISCAL_AUTOMATION_LABELS: Record<FiscalAutomationMode, string> = {
  never: "Nunca automaticamente",
  ask_on_service_completion: "Perguntar ao concluir um serviço",
  on_service_completion: "Emitir ao concluir um serviço",
  on_payment_confirmed: "Emitir quando uma cobrança for paga",
};

export const emptyFiscalAddress = (): FiscalAddress => ({
  street: "",
  number: "",
  complement: "",
  district: "",
  zipCode: "",
  city: "",
  cityCode: "",
  state: "",
  countryCode: "BR",
});

export const emptyFiscalIssuer = (): FiscalIssuer => ({
  personType: "company",
  document: "",
  legalName: "",
  tradeName: "",
  municipalRegistration: "",
  email: "",
  phone: "",
  address: emptyFiscalAddress(),
  taxRegime: "",
  simpleNational: false,
  mei: false,
});
