import { createHash, randomUUID } from "node:crypto";
import type { Database, Sql } from "../db.js";
import type { Scope } from "../payments/repository.js";
import { workspaceLock } from "../payments/repository.js";
import {
  contractVariableValues,
  CONTRACT_VARIABLES,
  deriveContractStatus,
  LEGAL_REVIEW_NOTICE,
  replaceContractVariables,
  sanitizeContractHtml,
  validateContractForSignature,
  type ContractAiGenerationInput,
  type ContractAiGenerationResult,
  type ContractDocument,
  type ContractDraftInput,
  type ContractEvent,
  type ContractSignatureRequest,
  type ContractSignatureStatus,
  type ContractTemplate,
  type ContractVersion,
  type WeekiContract,
} from "../../shared/contracts.js";
import { ContractAiClient } from "./ai.js";
import { ContractError } from "./errors.js";
import { contractPdfChecksum, renderContractPdf } from "./pdf.js";
import type { SignatureProviderRegistry } from "./registry.js";
import type { SignatureDocumentPayload, VerifiedSignatureEvent } from "./provider.js";
import * as repo from "./repository.js";

type ContractUpdate = Partial<Omit<Pick<
  WeekiContract,
  "title" | "editorialStatus" | "reviewConfirmed" | "terms" | "parties" | "signers" | "signingMode" | "signatureMessage" | "content"
>, "terms">> & { terms?: Partial<WeekiContract["terms"]> };

export type ContractUpdateInput = ContractUpdate;
export type ContractTemplateInput = Omit<ContractTemplate, "id" | "createdAt" | "updatedAt" | "archivedAt"> &
  Partial<Pick<ContractTemplate, "id" | "createdAt" | "updatedAt" | "archivedAt">>;

export interface ContractAiGenerator {
  configured(): boolean;
  generate(input: ContractAiGenerationInput): Promise<ContractAiGenerationResult>;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function uuidOrNew(value?: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : randomUUID();
}

function uuidOrNull(value?: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function event(kind: ContractEvent["kind"], title: string, description: string, actor = "Weeki"): ContractEvent {
  return { id: randomUUID(), kind, title, description, actor, createdAt: new Date().toISOString() };
}

function normalizeContract(contract: WeekiContract): WeekiContract {
  const signatureStatus = contract.signatureStatus || "not_started";
  return {
    ...contract,
    signatureStatus,
    contractStatus: deriveContractStatus({ ...contract, signatureStatus }),
    versions: contract.versions || [],
    documents: contract.documents || [],
    signatureRequests: contract.signatureRequests || [],
    events: contract.events || [],
  };
}

function version(input: {
  title: string;
  content: string;
  reason: string;
  versionNumber: number;
  aiGenerated?: boolean;
  immutable?: boolean;
  actor?: string;
}): ContractVersion {
  return {
    id: randomUUID(),
    version: input.versionNumber,
    title: input.title,
    content: input.content,
    contentHash: contentHash(input.content),
    reason: input.reason,
    aiGenerated: Boolean(input.aiGenerated),
    immutable: Boolean(input.immutable),
    createdAt: new Date().toISOString(),
    createdBy: input.actor || "Weeki",
  };
}

function normalizeDraft(draft: ContractDraftInput): ContractDraftInput {
  return {
    ...draft,
    title: draft.title.trim() || "Contrato sem título",
    content: sanitizeContractHtml(draft.content),
    parties: draft.parties.map((party) => ({ ...party, id: uuidOrNew(party.id) })),
    signers: draft.signers.map((signer, index) => ({
      ...signer,
      id: uuidOrNew(signer.id),
      partyId: uuidOrNull(signer.partyId),
      order: draft.signingMode === "ordered" ? index + 1 : 1,
      status: signer.status || "not_started",
      viewedAt: signer.viewedAt ?? null,
      signedAt: signer.signedAt ?? null,
      lastEventAt: signer.lastEventAt ?? null,
    })),
  };
}

function applyContractUpdate(contract: WeekiContract, input: ContractUpdate) {
  if (input.content !== undefined && !["not_started", "cancelled"].includes(contract.signatureStatus)) {
    throw new ContractError("CONTRACT_IMMUTABLE_VERSION", 409);
  }
  const parties = input.parties?.map((party) => ({ ...party, id: uuidOrNew(party.id) }));
  const signers = input.signers?.map((signer, index) => ({
    ...signer,
    id: uuidOrNew(signer.id),
    partyId: uuidOrNull(signer.partyId),
    order: input.signingMode === "ordered" ? index + 1 : signer.order,
    status: signer.status || "not_started",
    viewedAt: signer.viewedAt ?? null,
    signedAt: signer.signedAt ?? null,
    lastEventAt: signer.lastEventAt ?? null,
  }));
  const updated: WeekiContract = {
    ...contract,
    ...input,
    parties: parties || contract.parties,
    signers: signers || contract.signers,
    title: input.title?.trim() || contract.title,
    terms: input.terms ? { ...contract.terms, ...input.terms } : contract.terms,
    content: input.content === undefined ? contract.content : sanitizeContractHtml(input.content),
    updatedAt: new Date().toISOString(),
    events: [event("updated", "Contrato atualizado", "Dados do contrato foram revisados."), ...contract.events],
  };
  return normalizeContract(updated);
}

function defaultTemplate(): ContractTemplate {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Contrato de Prestação de Serviços",
    description: "Modelo base para prestadores de serviços com escopo, pagamento, vigência, propriedade intelectual e LGPD.",
    category: "Serviços",
    content: [
      "<h1>Contrato de Prestação de Serviços</h1>",
      "<p>Pelo presente instrumento, {{business.name}} e {{client.name}} celebram contrato de prestação de serviços.</p>",
      "<h2>1. Objeto</h2>",
      "<p>O objeto é a prestação do serviço {{service.title}}, conforme escopo: {{service.scope}}.</p>",
      "<h2>2. Entregas e Prazos</h2>",
      "<p>Entregas: {{service.deliverables}}. Prazo: {{service.deadline}}. Revisões: {{service.revisions}}.</p>",
      "<h2>3. Valores</h2>",
      "<p>O valor total é {{contract.value}}, pago conforme: {{contract.paymentTerms}}.</p>",
      "<h2>4. Vigência</h2>",
      "<p>Este contrato inicia em {{contract.startDate}} e termina em {{contract.endDate}}.</p>",
      "<h2>5. Foro</h2>",
      "<p>Fica eleito o foro de {{contract.jurisdiction}}.</p>",
    ].join(""),
    variables: CONTRACT_VARIABLES.map((variable) => ({ id: variable.id, required: variable.required, fallback: "" })),
    favorite: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDocument(
  contract: WeekiContract,
  versionId: string,
  kind: ContractDocument["kind"],
  pdf: Buffer,
  checksum: string,
  immutable: boolean,
): ContractDocument {
  const id = randomUUID();
  return {
    id,
    versionId,
    kind,
    fileName: `${contract.number}-${kind}.pdf`,
    contentType: "application/pdf",
    size: pdf.byteLength,
    checksum,
    storageKey: `contracts/${contract.workspaceId}/${contract.id}/${versionId}/${id}.pdf`,
    createdAt: new Date().toISOString(),
    immutable,
  };
}

function documentFromPayload(contract: WeekiContract, versionId: string, kind: ContractDocument["kind"], payload: SignatureDocumentPayload): ContractDocument {
  const checksum = payload.checksum || createHash("sha256").update(payload.data).digest("hex");
  const existing = contract.documents.find((document) => document.kind === kind && document.checksum === checksum);
  if (existing) return existing;
  const id = randomUUID();
  return {
    id,
    versionId,
    kind,
    fileName: payload.fileName,
    contentType: payload.contentType,
    size: payload.data.byteLength,
    checksum,
    storageKey: `contracts/${contract.workspaceId}/${contract.id}/${versionId}/${id}-${payload.fileName}`,
    provider: "clicksign",
    externalId: contract.signatureRequests[0]?.externalId,
    createdAt: new Date().toISOString(),
    immutable: true,
  };
}

function eventFromSignature(status: ContractSignatureStatus): ContractEvent {
  if (status === "viewed") return event("signature_viewed", "Contrato visualizado", "O provedor informou visualização do documento.", "Clicksign");
  if (status === "partially_signed") return event("signer_signed", "Assinatura parcial", "Um signatário concluiu a assinatura.", "Clicksign");
  if (status === "signed") return event("signature_completed", "Contrato assinado", "Todas as assinaturas foram concluídas pelo provedor.", "Clicksign");
  if (status === "declined") return event("signature_declined", "Assinatura recusada", "O provedor informou recusa da assinatura.", "Clicksign");
  if (status === "expired") return event("signature_expired", "Solicitação expirada", "O prazo de assinatura expirou.", "Clicksign");
  if (status === "cancelled") return event("signature_cancelled", "Solicitação cancelada", "A solicitação de assinatura foi cancelada.", "Clicksign");
  if (status === "error") return event("signature_error", "Erro de assinatura", "O provedor retornou erro para a solicitação.", "Clicksign");
  return event("signature_sent", "Status de assinatura atualizado", "O provedor atualizou a solicitação.", "Clicksign");
}

export class ContractService {
  constructor(
    public db: Database,
    private signatures: SignatureProviderRegistry,
    private ai: ContractAiGenerator = new ContractAiClient(),
  ) {}

  async overview(scope: Scope) {
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const templates = await repo.listTemplates(sql, scope.workspaceId);
      const provider = this.signatures.default();
      return {
        workspaceId: scope.workspaceId,
        apiEnabled: process.env.CONTRACTS_MODULE_ENABLED !== "false",
        aiEnabled: this.ai.configured(),
        signatureEnabled: provider.configured(),
        signatureProvider: provider.id,
        environment: provider.environment,
        contracts: await repo.listContracts(sql, scope.workspaceId),
        templates: templates.length ? templates : [defaultTemplate()],
      };
    }, false);
  }

  async list(scope: Scope, offset = 0) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000) throw new ContractError("CONTRACT_INVALID_INPUT", 422);
    return repo.inContractsWorkspace(this.db, scope, (sql) => repo.listContracts(sql, scope.workspaceId, offset), false);
  }

  async get(scope: Scope, id: string) {
    return repo.inContractsWorkspace(this.db, scope, (sql) => repo.getContract(sql, scope.workspaceId, id), false);
  }

  async templates(scope: Scope) {
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const templates = await repo.listTemplates(sql, scope.workspaceId);
      return templates.length ? templates : [defaultTemplate()];
    }, false);
  }

  async saveTemplate(scope: Scope, input: ContractTemplateInput) {
    const now = new Date().toISOString();
    const template: ContractTemplate = {
      ...input,
      id: input.id || randomUUID(),
      archivedAt: input.archivedAt ?? null,
      content: sanitizeContractHtml(input.content),
      createdAt: input.createdAt || now,
      updatedAt: now,
    };
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      await repo.saveTemplate(sql, scope.workspaceId, template);
      await repo.audit(sql, scope.workspaceId, null, "contract_template.saved", { templateId: template.id });
      return template;
    });
  }

  async create(scope: Scope, input: ContractDraftInput) {
    const draft = normalizeDraft(input);
    if (!draft.clientId || !draft.sourceSnapshot.client?.name || !draft.content.trim()) throw new ContractError("CONTRACT_INVALID_INPUT", 422);
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const now = new Date().toISOString();
      const initialVersion = version({
        title: draft.title,
        content: draft.content,
        reason: draft.aiGenerated ? "Contrato gerado por IA" : draft.source === "template" ? "Contrato criado a partir de modelo" : "Contrato criado",
        versionNumber: 1,
        aiGenerated: draft.aiGenerated,
        actor: draft.aiGenerated ? "IA Weeki" : "Weeki",
      });
      const contract = normalizeContract({
        id: randomUUID(),
        workspaceId: scope.workspaceId,
        number: await repo.nextNumber(sql, scope.workspaceId),
        title: draft.title,
        clientId: draft.clientId,
        clientName: draft.sourceSnapshot.client?.name || "Cliente não selecionado",
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
        reviewConfirmed: false,
        content: draft.content,
        currentVersionId: initialVersion.id,
        versions: [initialVersion],
        documents: [],
        signatureRequests: [],
        events: [event("created", "Contrato criado", `Origem: ${draft.source}.`)],
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      await repo.saveContract(sql, scope.workspaceId, contract);
      await repo.audit(sql, scope.workspaceId, contract.id, "contract.created", { source: contract.source });
      return contract;
    });
  }

  async update(scope: Scope, id: string, input: ContractUpdate) {
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const contract = await repo.getContract(sql, scope.workspaceId, id);
      const updated = applyContractUpdate(contract, input);
      await repo.saveContract(sql, scope.workspaceId, updated);
      await repo.audit(sql, scope.workspaceId, id, "contract.updated");
      return updated;
    });
  }

  async createVersion(scope: Scope, id: string, reason = "Versão formal criada") {
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const contract = await repo.getContract(sql, scope.workspaceId, id);
      if (!["not_started", "cancelled"].includes(contract.signatureStatus)) throw new ContractError("CONTRACT_IMMUTABLE_VERSION", 409);
      const next = version({
        title: contract.title,
        content: sanitizeContractHtml(contract.content),
        reason,
        versionNumber: Math.max(0, ...contract.versions.map((item) => item.version)) + 1,
      });
      const updated = normalizeContract({
        ...contract,
        currentVersionId: next.id,
        versions: [next, ...contract.versions],
        updatedAt: new Date().toISOString(),
        events: [event("version_created", reason, "Uma nova versão formal foi preservada."), ...contract.events],
      });
      await repo.saveContract(sql, scope.workspaceId, updated);
      await repo.audit(sql, scope.workspaceId, id, "contract.version_created", { versionId: next.id });
      return updated;
    });
  }

  async generateAi(scope: Scope, input: ContractAiGenerationInput): Promise<ContractAiGenerationResult | WeekiContract> {
    await repo.inContractsWorkspace(this.db, scope, async () => undefined, false);
    const result = await this.ai.generate(input);
    if (!input.contractId) return result;
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const contract = await repo.getContract(sql, scope.workspaceId, input.contractId!);
      const next = version({
        title: result.title,
        content: result.content,
        reason: "Contrato gerado por IA",
        versionNumber: Math.max(0, ...contract.versions.map((item) => item.version)) + 1,
        aiGenerated: true,
        actor: "IA Weeki",
      });
      const updated = normalizeContract({
        ...contract,
        title: result.title,
        content: result.content,
        currentVersionId: next.id,
        versions: [next, ...contract.versions],
        editorialStatus: "review",
        aiGenerated: true,
        aiProvider: "openai",
        aiNoticeAccepted: true,
        updatedAt: new Date().toISOString(),
        events: [event("ai_generated", "Conteúdo gerado por IA", "Revise todas as cláusulas antes do envio.", "IA Weeki"), ...contract.events],
      });
      await repo.saveContract(sql, scope.workspaceId, updated);
      await repo.audit(sql, scope.workspaceId, contract.id, "contract.ai_generated", { provider: "openai", model: result.model });
      return updated;
    });
  }

  async generatePdf(scope: Scope, id: string) {
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const contract = await repo.getContract(sql, scope.workspaceId, id);
      const pdf = this.renderPdf(contract);
      const checksum = contractPdfChecksum(pdf);
      const document = buildDocument(contract, contract.currentVersionId, "preview_pdf", pdf, checksum, false);
      const updated = normalizeContract({
        ...contract,
        documents: [document, ...contract.documents],
        updatedAt: new Date().toISOString(),
        events: [event("pdf_generated", "PDF de pré-visualização gerado", `Hash ${checksum}.`), ...contract.events],
      });
      await repo.saveContract(sql, scope.workspaceId, updated);
      await repo.audit(sql, scope.workspaceId, id, "contract.pdf_generated", { checksum, kind: document.kind });
      return { contract: updated, document };
    });
  }

  async sendForSignature(scope: Scope, id: string, idempotencyKey: string, expiresAt?: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new ContractError("CONTRACT_INVALID_INPUT", 422);
    }
    const provider = this.signatures.default();
    if (!provider.configured()) throw new ContractError("CONTRACT_SIGNATURE_NOT_CONFIGURED", 503);
    const reservation = await repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const contract = await repo.getContract(sql, scope.workspaceId, id);
      const requestHash = fingerprint({
        contractId: contract.id,
        versionId: contract.currentVersionId,
        contentHash: contract.versions.find((item) => item.id === contract.currentVersionId)?.contentHash,
        signers: contract.signers.map(({ name, email, document, order, role }) => ({ name, email, document, order, role })),
        message: contract.signatureMessage,
        expiresAt,
      });
      const prior = await sql.query<{ data: ContractSignatureRequest; request_hash: string }>(
        "SELECT data,request_hash FROM weeki_contracts.signature_requests WHERE workspace_id=$1 AND contract_id=$2 AND request_key=$3",
        [scope.workspaceId, contract.id, idempotencyKey],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].request_hash !== requestHash) throw new ContractError("CONTRACT_CONFLICT", 409);
        return { existing: true as const, contract };
      }
      const issues = validateContractForSignature(contract);
      if (issues.length) throw new ContractError("CONTRACT_INVALID_INPUT", 422);
      const rendered = this.renderPdf(contract);
      const checksum = contractPdfChecksum(rendered);
      const document = buildDocument(contract, contract.currentVersionId, "signature_pdf", rendered, checksum, true);
      const request: ContractSignatureRequest = {
        id: randomUUID(),
        versionId: contract.currentVersionId,
        provider: provider.id,
        externalId: `local-${randomUUID()}`,
        externalStatus: "preparing",
        status: "preparing",
        signingMode: contract.signingMode,
        message: contract.signatureMessage,
        expiresAt: expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        sentAt: null,
        completedAt: null,
        cancelledAt: null,
        documentId: document.id,
        evidenceDocumentId: null,
        idempotencyKey,
      };
      const currentVersion = contract.versions.find((item) => item.id === contract.currentVersionId);
      const updatedVersions = contract.versions.map((item) => item.id === contract.currentVersionId ? { ...item, immutable: true } : item);
      const updated = normalizeContract({
        ...contract,
        editorialStatus: "ready",
        signatureStatus: "preparing",
        reviewConfirmed: true,
        versions: currentVersion ? updatedVersions : contract.versions,
        documents: [document, ...contract.documents],
        signatureRequests: [request, ...contract.signatureRequests],
        updatedAt: new Date().toISOString(),
        events: [event("signature_prepared", "Envio reservado", "A versão foi congelada e o PDF recebeu hash antes do envio."), ...contract.events],
      });
      await repo.saveContract(sql, scope.workspaceId, updated);
      await sql.query(
        "UPDATE weeki_contracts.signature_requests SET request_hash=$4 WHERE workspace_id=$1 AND contract_id=$2 AND request_key=$3",
        [scope.workspaceId, contract.id, idempotencyKey, requestHash],
      );
      await repo.audit(sql, scope.workspaceId, contract.id, "contract.signature_reserved", { requestId: request.id, checksum });
      return { existing: false as const, contract: updated, request, pdf: rendered, checksum };
    });
    if (reservation.existing) return reservation.contract;
    try {
      const sent = await provider.sendForSignature({
        contract: reservation.contract,
        request: reservation.request,
        pdf: reservation.pdf,
        checksum: reservation.checksum,
      });
      return await repo.inContractsWorkspace(this.db, scope, async (sql) => {
        const current = await repo.getContract(sql, scope.workspaceId, id);
        const request = current.signatureRequests.find((item) => item.id === reservation.request.id);
        if (!request) throw new ContractError("CONTRACT_CONFLICT", 409);
        const updatedRequest: ContractSignatureRequest = {
          ...request,
          externalId: sent.externalId,
          externalStatus: sent.externalStatus,
          status: sent.status,
          sentAt: new Date().toISOString(),
        };
        const signers = current.signers.map((signer) => ({
          ...signer,
          externalId: sent.signerExternalIds[signer.id] || signer.externalId,
          status: "sent" as const,
          lastEventAt: new Date().toISOString(),
        }));
        const documents = current.documents.map((document) =>
          document.id === request.documentId ? { ...document, externalId: sent.documentExternalId, provider: provider.id } : document,
        );
        const updated = normalizeContract({
          ...current,
          signers,
          documents,
          signatureStatus: sent.status,
          signatureRequests: [updatedRequest, ...current.signatureRequests.filter((item) => item.id !== request.id)],
          updatedAt: new Date().toISOString(),
          events: [event("signature_sent", "Contrato enviado para assinatura", "A solicitação foi criada no provedor especializado."), ...current.events],
        });
        await repo.saveContract(sql, scope.workspaceId, updated);
        await repo.audit(sql, scope.workspaceId, id, "contract.signature_sent", { provider: provider.id, externalId: sent.externalId });
        return updated;
      });
    } catch (error) {
      const code = error instanceof ContractError ? error.code : "CONTRACT_INTERNAL";
      await repo.inContractsWorkspace(this.db, scope, async (sql) => {
        const current = await repo.getContract(sql, scope.workspaceId, id);
        const updated = normalizeContract({
          ...current,
          signatureStatus: "error",
          signatureRequests: current.signatureRequests.map((request) => request.id === reservation.request.id ? { ...request, status: "error", externalStatus: code } : request),
          events: [event("signature_error", "Falha no envio para assinatura", "A falha foi registrada sem criar uma segunda solicitação.", "Weeki"), ...current.events],
          updatedAt: new Date().toISOString(),
        });
        await repo.saveContract(sql, scope.workspaceId, updated);
        await repo.audit(sql, scope.workspaceId, id, "contract.signature_failed", { code });
      });
      throw error;
    }
  }

  async resendReminder(scope: Scope, id: string) {
    const provider = this.signatures.default();
    if (!provider.configured()) throw new ContractError("CONTRACT_SIGNATURE_NOT_CONFIGURED", 503);
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const contract = await repo.getContract(sql, scope.workspaceId, id);
      const request = contract.signatureRequests[0];
      if (!request || !["sent", "viewed", "partially_signed"].includes(request.status)) throw new ContractError("CONTRACT_CONFLICT", 409);
      await provider.resendReminder(request);
      const updated = normalizeContract({
        ...contract,
        updatedAt: new Date().toISOString(),
        events: [event("reminder_sent", "Lembrete reenviado", "O provedor foi acionado para reenviar a notificação."), ...contract.events],
      });
      await repo.saveContract(sql, scope.workspaceId, updated);
      await repo.audit(sql, scope.workspaceId, id, "contract.reminder_sent", { requestId: request.id });
      return updated;
    });
  }

  async cancelSignature(scope: Scope, id: string, reason = "Cancelamento solicitado pelo usuário") {
    const provider = this.signatures.default();
    if (!provider.configured()) throw new ContractError("CONTRACT_SIGNATURE_NOT_CONFIGURED", 503);
    const contract = await this.get(scope, id);
    const request = contract.signatureRequests[0];
    if (!request || !["preparing", "sent", "viewed", "partially_signed", "error"].includes(request.status)) throw new ContractError("CONTRACT_CONFLICT", 409);
    await provider.cancelRequest(request, reason);
    return repo.inContractsWorkspace(this.db, scope, async (sql) => {
      const current = await repo.getContract(sql, scope.workspaceId, id);
      const updated = normalizeContract({
        ...current,
        signatureStatus: "cancelled",
        signatureRequests: current.signatureRequests.map((item) => item.id === request.id ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString(), externalStatus: "cancelled" } : item),
        updatedAt: new Date().toISOString(),
        events: [event("signature_cancelled", "Solicitação cancelada", reason), ...current.events],
      });
      await repo.saveContract(sql, scope.workspaceId, updated);
      await repo.audit(sql, scope.workspaceId, id, "contract.signature_cancelled", { requestId: request.id });
      return updated;
    });
  }

  enqueueSignatureWebhook(providerId: "clicksign", input: { raw: string; headers: Record<string, string>; query: URLSearchParams }) {
    const event = this.signatures.get(providerId).handleWebhook(input);
    return this.db.transaction((sql) => repo.enqueueSignatureEvent(sql, event));
  }

  async processNextWebhook() {
    return this.db.transaction(async (sql) => {
      const job = await repo.nextSignatureEvent(sql);
      if (!job) return false;
      await workspaceLock(sql, job.workspace_id);
      try {
        await this.applySignatureEvent(sql, job.workspace_id, job.contract_id, job.signature_request_id, job.data);
        await repo.completeSignatureEvent(sql, job.id);
      } catch (error) {
        const contractError = error instanceof ContractError ? error : new ContractError("CONTRACT_INTERNAL", 500);
        await repo.failSignatureEvent(sql, job.id, job.attempts, contractError);
      }
      return true;
    });
  }

  private renderPdf(contract: WeekiContract) {
    const content = replaceContractVariables(contract.content, contractVariableValues(contract));
    return renderContractPdf({
      title: `${contract.number} - ${contract.title}`,
      html: content,
      footer: LEGAL_REVIEW_NOTICE,
    });
  }

  private async applySignatureEvent(
    sql: Sql,
    workspaceId: string,
    contractId: string,
    requestId: string,
    signatureEvent: VerifiedSignatureEvent,
  ) {
    const provider = this.signatures.get(signatureEvent.provider);
    const contract = await repo.getContract(sql, workspaceId, contractId);
    const request = contract.signatureRequests.find((item) => item.id === requestId);
    if (!request) throw new ContractError("CONTRACT_WEBHOOK_NOT_FOUND", 404);
    const now = signatureEvent.occurredAt || new Date().toISOString();
    const signers = contract.signers.map((signer) => {
      if (signatureEvent.signerExternalId && signer.externalId !== signatureEvent.signerExternalId) return signer;
      if (!signatureEvent.signerExternalId && signatureEvent.signatureStatus !== "signed") return signer;
      const status = signatureEvent.signerStatus || signatureEvent.signatureStatus;
      return {
        ...signer,
        status,
        viewedAt: status === "viewed" ? signer.viewedAt || now : signer.viewedAt,
        signedAt: status === "signed" || status === "partially_signed" ? signer.signedAt || now : signer.signedAt,
        lastEventAt: now,
      };
    });
    let nextStatus = signatureEvent.signatureStatus;
    if (nextStatus === "signed" || signers.length && signers.every((signer) => signer.status === "signed" || signer.signedAt)) nextStatus = "signed";
    else if (signers.some((signer) => signer.status === "signed" || signer.signedAt)) nextStatus = "partially_signed";
    const requestUpdate: ContractSignatureRequest = {
      ...request,
      status: nextStatus,
      externalStatus: signatureEvent.rawStatus,
      completedAt: nextStatus === "signed" ? request.completedAt || now : request.completedAt,
      cancelledAt: nextStatus === "cancelled" ? request.cancelledAt || now : request.cancelledAt,
    };
    let documents = contract.documents;
    if (nextStatus === "signed") {
      const signed = documentFromPayload(contract, request.versionId, "signed_pdf", await provider.downloadSignedDocument(request));
      const evidence = documentFromPayload({ ...contract, documents: [signed, ...contract.documents] }, request.versionId, "evidence", await provider.downloadEvidence(request));
      documents = [signed, evidence, ...contract.documents.filter((document) => document.id !== signed.id && document.id !== evidence.id)];
      requestUpdate.documentId = signed.id;
      requestUpdate.evidenceDocumentId = evidence.id;
    }
    const updated = normalizeContract({
      ...contract,
      signers,
      documents,
      signatureStatus: nextStatus,
      signatureRequests: [requestUpdate, ...contract.signatureRequests.filter((item) => item.id !== request.id)],
      updatedAt: new Date().toISOString(),
      events: [eventFromSignature(nextStatus), ...contract.events],
    });
    await repo.saveContract(sql, workspaceId, updated);
    await repo.audit(sql, workspaceId, contractId, "contract.webhook_processed", {
      provider: signatureEvent.provider,
      eventType: signatureEvent.type,
      externalId: signatureEvent.id,
      status: nextStatus,
    });
  }
}
