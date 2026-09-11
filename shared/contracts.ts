export const CONTRACT_CREATION_SOURCES = ["manual", "template", "ai", "proposal"] as const;
export const CONTRACT_EDITORIAL_STATUSES = ["draft", "review", "ready"] as const;
export const CONTRACT_SIGNATURE_STATUSES = [
  "not_started",
  "preparing",
  "sent",
  "viewed",
  "partially_signed",
  "signed",
  "declined",
  "expired",
  "cancelled",
  "error",
] as const;
export const CONTRACT_STATUSES = [
  "pending",
  "active",
  "ending_soon",
  "ended",
  "terminated",
  "cancelled",
  "archived",
] as const;
export const SIGNATURE_PROVIDERS = ["clicksign"] as const;

export type ContractCreationSource = (typeof CONTRACT_CREATION_SOURCES)[number];
export type ContractEditorialStatus = (typeof CONTRACT_EDITORIAL_STATUSES)[number];
export type ContractSignatureStatus = (typeof CONTRACT_SIGNATURE_STATUSES)[number];
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export type SignatureProviderId = (typeof SIGNATURE_PROVIDERS)[number];
export type ContractPartyType = "individual" | "company";
export type ContractSigningMode = "simultaneous" | "ordered";
export type SignerAuthMethod = "provider_default" | "email" | "sms" | "certificate";
export type ContractDocumentKind = "preview_pdf" | "signature_pdf" | "signed_pdf" | "evidence" | "attachment";
export type ContractEventKind =
  | "created"
  | "updated"
  | "version_created"
  | "ai_generated"
  | "ai_reviewed"
  | "pdf_generated"
  | "signature_prepared"
  | "signature_sent"
  | "signature_viewed"
  | "signer_signed"
  | "signature_completed"
  | "signature_declined"
  | "signature_expired"
  | "signature_cancelled"
  | "signature_error"
  | "reminder_sent"
  | "archived"
  | "deleted_draft";

export const CONTRACT_EDITORIAL_STATUS_LABELS: Record<ContractEditorialStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  ready: "Pronto para envio",
};

export const CONTRACT_SIGNATURE_STATUS_LABELS: Record<ContractSignatureStatus, string> = {
  not_started: "Não enviada",
  preparing: "Preparando",
  sent: "Aguardando assinatura",
  viewed: "Visualizada",
  partially_signed: "Parcialmente assinada",
  signed: "Assinada",
  declined: "Recusada",
  expired: "Expirada",
  cancelled: "Cancelada",
  error: "Erro",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  pending: "Pendente",
  active: "Ativo",
  ending_soon: "Próximo do vencimento",
  ended: "Encerrado",
  terminated: "Rescindido",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export const CONTRACT_SOURCE_LABELS: Record<ContractCreationSource, string> = {
  manual: "Criado do zero",
  template: "Modelo",
  ai: "IA",
  proposal: "Proposta ou orçamento",
};

export const SIGNATURE_PROVIDER_LABELS: Record<SignatureProviderId, string> = {
  clicksign: "Clicksign",
};

export type ContractVariableId =
  | "client.name"
  | "client.document"
  | "client.email"
  | "client.phone"
  | "client.address"
  | "client.representative"
  | "business.name"
  | "business.document"
  | "business.email"
  | "service.title"
  | "service.description"
  | "service.scope"
  | "service.deliverables"
  | "service.deadline"
  | "service.revisions"
  | "contract.value"
  | "contract.paymentTerms"
  | "contract.startDate"
  | "contract.endDate"
  | "contract.jurisdiction";

export interface ContractVariableDefinition {
  id: ContractVariableId;
  label: string;
  required: boolean;
}

export const CONTRACT_VARIABLES: ContractVariableDefinition[] = [
  { id: "client.name", label: "Nome do cliente", required: true },
  { id: "client.document", label: "CPF ou CNPJ do cliente", required: false },
  { id: "client.email", label: "E-mail do cliente", required: true },
  { id: "client.phone", label: "Telefone do cliente", required: false },
  { id: "client.address", label: "Endereço do cliente", required: false },
  { id: "client.representative", label: "Representante do cliente", required: false },
  { id: "business.name", label: "Nome do negócio", required: true },
  { id: "business.document", label: "CPF ou CNPJ do negócio", required: false },
  { id: "business.email", label: "E-mail do negócio", required: true },
  { id: "service.title", label: "Título do serviço", required: true },
  { id: "service.description", label: "Descrição do serviço", required: true },
  { id: "service.scope", label: "Escopo", required: true },
  { id: "service.deliverables", label: "Entregas", required: false },
  { id: "service.deadline", label: "Prazo", required: false },
  { id: "service.revisions", label: "Revisões", required: false },
  { id: "contract.value", label: "Valor", required: true },
  { id: "contract.paymentTerms", label: "Condições de pagamento", required: true },
  { id: "contract.startDate", label: "Início da vigência", required: true },
  { id: "contract.endDate", label: "Término da vigência", required: false },
  { id: "contract.jurisdiction", label: "Foro", required: false },
];

export interface ContractBusinessSnapshot {
  name: string;
  document: string;
  email: string;
  phone: string;
  representativeName: string;
  representativeRole: string;
  address: string;
}

export interface ContractClientSnapshot {
  id: string;
  name: string;
  kind: ContractPartyType;
  document: string;
  email: string;
  phone: string;
  address: string;
  representativeName: string;
  representativeRole: string;
  capturedAt: string;
}

export interface ContractServiceSnapshot {
  id: string | null;
  title: string;
  description: string;
  scope: string;
  deliverables: string;
  deadline: string;
  revisions: string;
  providerResponsibilities: string;
  clientResponsibilities: string;
  source: "manual" | "task" | "fiscal_service" | "proposal";
}

export interface ContractBillingSnapshot {
  id: string | null;
  code: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentMethods: string[];
}

export interface ContractSourceSnapshot {
  business: ContractBusinessSnapshot;
  client: ContractClientSnapshot | null;
  service: ContractServiceSnapshot;
  billing: ContractBillingSnapshot | null;
  proposal: {
    id: string | null;
    title: string;
    fileName: string;
  } | null;
  capturedAt: string;
}

export interface ContractTerms {
  value: number;
  paymentTerms: string;
  installments: number;
  firstDueDate: string;
  lateFeePercent: number;
  dailyInterestPercent: number;
  adjustment: string;
  startDate: string;
  endDate: string;
  cancellation: string;
  termination: string;
  confidentiality: boolean;
  intellectualProperty: string;
  portfolioAllowed: boolean;
  dataProtection: string;
  jurisdiction: string;
  additionalClauses: string;
}

export interface ContractParty {
  id: string;
  type: ContractPartyType;
  name: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  representativeName: string;
  representativeRole: string;
  snapshotSource: "business" | "client" | "manual";
}

export interface ContractSigner {
  id: string;
  partyId: string | null;
  name: string;
  email: string;
  document: string;
  role: string;
  order: number;
  authMethod: SignerAuthMethod;
  status: ContractSignatureStatus;
  viewedAt: string | null;
  signedAt: string | null;
  lastEventAt: string | null;
  externalId?: string;
}

export interface ContractVersion {
  id: string;
  version: number;
  title: string;
  content: string;
  contentHash: string;
  reason: string;
  aiGenerated: boolean;
  immutable: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ContractDocument {
  id: string;
  versionId: string;
  kind: ContractDocumentKind;
  fileName: string;
  contentType: string;
  size: number;
  checksum: string;
  storageKey: string;
  provider?: SignatureProviderId;
  externalId?: string;
  createdAt: string;
  immutable: boolean;
}

export interface ContractSignatureRequest {
  id: string;
  versionId: string;
  provider: SignatureProviderId;
  externalId: string;
  externalStatus: string;
  status: ContractSignatureStatus;
  signingMode: ContractSigningMode;
  message: string;
  expiresAt: string;
  sentAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  documentId: string | null;
  evidenceDocumentId: string | null;
  idempotencyKey: string;
}

export interface ContractEvent {
  id: string;
  kind: ContractEventKind;
  title: string;
  description: string;
  actor: string;
  provider?: SignatureProviderId;
  externalId?: string;
  createdAt: string;
}

export interface ContractTemplateVariable {
  id: ContractVariableId;
  required: boolean;
  fallback: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: ContractTemplateVariable[];
  favorite: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeekiContract {
  id: string;
  workspaceId: string;
  number: string;
  title: string;
  clientId: string | null;
  clientName: string;
  source: ContractCreationSource;
  templateId: string | null;
  relatedServiceId: string | null;
  relatedTaskId: string | null;
  relatedProjectId: string | null;
  proposalId: string | null;
  chargeId: string | null;
  sourceSnapshot: ContractSourceSnapshot;
  terms: ContractTerms;
  parties: ContractParty[];
  signers: ContractSigner[];
  signingMode: ContractSigningMode;
  signatureMessage: string;
  editorialStatus: ContractEditorialStatus;
  signatureStatus: ContractSignatureStatus;
  contractStatus: ContractStatus;
  aiGenerated: boolean;
  aiProvider: string | null;
  aiNoticeAccepted: boolean;
  reviewConfirmed: boolean;
  content: string;
  currentVersionId: string;
  versions: ContractVersion[];
  documents: ContractDocument[];
  signatureRequests: ContractSignatureRequest[];
  events: ContractEvent[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDraftInput {
  source: ContractCreationSource;
  title: string;
  clientId: string | null;
  templateId: string | null;
  relatedServiceId: string | null;
  relatedTaskId: string | null;
  proposalId: string | null;
  chargeId: string | null;
  sourceSnapshot: ContractSourceSnapshot;
  terms: ContractTerms;
  parties: ContractParty[];
  signers: ContractSigner[];
  signingMode: ContractSigningMode;
  signatureMessage: string;
  content: string;
  aiGenerated?: boolean;
  aiProvider?: string | null;
}

export interface ContractValidationIssue {
  field: string;
  message: string;
  section:
    | "origin"
    | "parties"
    | "service"
    | "values"
    | "clauses"
    | "document"
    | "signatures"
    | "review";
}

export interface ContractsOverview {
  workspaceId: string;
  apiEnabled: boolean;
  aiEnabled: boolean;
  signatureEnabled: boolean;
  signatureProvider: SignatureProviderId;
  environment: "sandbox" | "production";
  contracts: WeekiContract[];
  templates: ContractTemplate[];
}

export interface ContractAiGenerationInput {
  contractId?: string;
  instructions: string;
  sourceSnapshot: ContractSourceSnapshot;
  terms: ContractTerms;
  clauses: Pick<ContractTerms, "cancellation" | "termination" | "intellectualProperty" | "dataProtection" | "additionalClauses">;
}

export interface ContractAiGenerationResult {
  title: string;
  content: string;
  missingFields: string[];
  warnings: string[];
  model: string;
  provider: "openai";
}

export const LEGAL_REVIEW_NOTICE =
  "O conteúdo gerado pela IA é uma sugestão e não substitui a revisão de um profissional jurídico. Revise todas as cláusulas antes de enviar o contrato.";

export const emptyContractTerms = (): ContractTerms => ({
  value: 0,
  paymentTerms: "",
  installments: 1,
  firstDueDate: "",
  lateFeePercent: 2,
  dailyInterestPercent: 0.033,
  adjustment: "",
  startDate: "",
  endDate: "",
  cancellation: "Cancelamento mediante aviso prévio de 30 dias, preservados os valores devidos pelos serviços já executados.",
  termination: "A rescisão poderá ocorrer por descumprimento contratual, mediante notificação e prazo razoável para correção.",
  confidentiality: true,
  intellectualProperty: "A propriedade intelectual será transferida ao contratante após a quitação integral, salvo licenças de terceiros.",
  portfolioAllowed: true,
  dataProtection: "As partes se comprometem a tratar dados pessoais apenas para execução deste contrato, observando a LGPD.",
  jurisdiction: "",
  additionalClauses: "",
});

export function stripHtml(value: string) {
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

export function sanitizeContractHtml(value: string) {
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

export function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function hasDocumentShape(value: string) {
  const digits = onlyDigits(value);
  return !digits || digits.length === 11 || digits.length === 14;
}

export function renderVariableToken(id: ContractVariableId) {
  return `{{${id}}}`;
}

export function missingVariables(content: string, values: Partial<Record<ContractVariableId, string>>) {
  return CONTRACT_VARIABLES
    .filter((variable) => content.includes(renderVariableToken(variable.id)))
    .filter((variable) => variable.required && !values[variable.id]?.trim())
    .map((variable) => variable.label);
}

export function contractVariableValues(contract: Pick<WeekiContract, "sourceSnapshot" | "terms">): Partial<Record<ContractVariableId, string>> {
  const { sourceSnapshot, terms } = contract;
  return {
    "client.name": sourceSnapshot.client?.name ?? "",
    "client.document": sourceSnapshot.client?.document ?? "",
    "client.email": sourceSnapshot.client?.email ?? "",
    "client.phone": sourceSnapshot.client?.phone ?? "",
    "client.address": sourceSnapshot.client?.address ?? "",
    "client.representative": sourceSnapshot.client?.representativeName ?? "",
    "business.name": sourceSnapshot.business.name,
    "business.document": sourceSnapshot.business.document,
    "business.email": sourceSnapshot.business.email,
    "service.title": sourceSnapshot.service.title,
    "service.description": sourceSnapshot.service.description,
    "service.scope": sourceSnapshot.service.scope,
    "service.deliverables": sourceSnapshot.service.deliverables,
    "service.deadline": sourceSnapshot.service.deadline,
    "service.revisions": sourceSnapshot.service.revisions,
    "contract.value": terms.value ? String(terms.value) : "",
    "contract.paymentTerms": terms.paymentTerms,
    "contract.startDate": terms.startDate,
    "contract.endDate": terms.endDate,
    "contract.jurisdiction": terms.jurisdiction,
  };
}

export function replaceContractVariables(content: string, values: Partial<Record<ContractVariableId, string>>) {
  return CONTRACT_VARIABLES.reduce(
    (current, variable) => current.replaceAll(renderVariableToken(variable.id), values[variable.id] || `[${variable.label} pendente]`),
    content,
  );
}

export function validateContractForSignature(contract: WeekiContract): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  if (!contract.title.trim()) issues.push({ section: "origin", field: "title", message: "Informe o título do contrato." });
  if (!contract.clientId || !contract.sourceSnapshot.client?.name) issues.push({ section: "parties", field: "client", message: "Selecione um cliente cadastrado." });
  if (!contract.sourceSnapshot.business.name.trim()) issues.push({ section: "parties", field: "business.name", message: "Complete o nome do negócio nas configurações." });
  if (!contract.sourceSnapshot.business.email.trim() || !validateEmail(contract.sourceSnapshot.business.email)) issues.push({ section: "parties", field: "business.email", message: "Informe um e-mail válido do negócio." });
  if (contract.sourceSnapshot.client?.email && !validateEmail(contract.sourceSnapshot.client.email)) issues.push({ section: "parties", field: "client.email", message: "Revise o e-mail do cliente." });
  if (!contract.sourceSnapshot.service.title.trim()) issues.push({ section: "service", field: "service.title", message: "Informe o serviço ou projeto relacionado." });
  if (!stripHtml(contract.content).trim()) issues.push({ section: "document", field: "content", message: "O documento não pode ficar vazio." });
  if (!contract.terms.value || contract.terms.value <= 0) issues.push({ section: "values", field: "terms.value", message: "Informe o valor contratado." });
  if (!contract.terms.paymentTerms.trim()) issues.push({ section: "values", field: "terms.paymentTerms", message: "Informe as condições de pagamento." });
  if (!contract.terms.startDate) issues.push({ section: "clauses", field: "terms.startDate", message: "Informe o início da vigência." });
  if (!contract.reviewConfirmed) issues.push({ section: "review", field: "reviewConfirmed", message: "Confirme que o contrato foi revisado antes do envio." });
  const signers = contract.signers.filter((signer) => signer.name.trim() || signer.email.trim());
  if (!signers.length) issues.push({ section: "signatures", field: "signers", message: "Adicione ao menos um signatário." });
  signers.forEach((signer, index) => {
    if (!signer.name.trim()) issues.push({ section: "signatures", field: `signers.${index}.name`, message: "Informe o nome de todos os signatários." });
    if (!validateEmail(signer.email)) issues.push({ section: "signatures", field: `signers.${index}.email`, message: "Informe e-mails válidos para os signatários." });
    if (!hasDocumentShape(signer.document)) issues.push({ section: "signatures", field: `signers.${index}.document`, message: "CPF/CNPJ deve ter 11 ou 14 dígitos quando informado." });
  });
  missingVariables(contract.content, contractVariableValues(contract)).forEach((message) =>
    issues.push({ section: "document", field: "variables", message: `Variável obrigatória sem valor: ${message}.` }),
  );
  return issues;
}

export function deriveContractStatus(contract: Pick<WeekiContract, "archivedAt" | "signatureStatus" | "terms">): ContractStatus {
  if (contract.archivedAt) return "archived";
  if (contract.signatureStatus === "cancelled") return "cancelled";
  if (["declined", "expired", "error"].includes(contract.signatureStatus)) return "pending";
  if (contract.signatureStatus !== "signed") return "pending";
  const today = new Date().toISOString().slice(0, 10);
  if (contract.terms.endDate && contract.terms.endDate < today) return "ended";
  if (contract.terms.startDate && contract.terms.startDate > today) return "pending";
  if (contract.terms.endDate) {
    const end = new Date(`${contract.terms.endDate}T00:00:00.000Z`).getTime();
    const now = new Date(`${today}T00:00:00.000Z`).getTime();
    if (end - now <= 1000 * 60 * 60 * 24 * 30) return "ending_soon";
  }
  return "active";
}
