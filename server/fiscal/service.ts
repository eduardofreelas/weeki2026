import { createHash, randomUUID } from "node:crypto";
import type { Database } from "../db.js";
import type { Scope } from "../payments/repository.js";
import type {
  FiscalAutomationSettings,
  FiscalProfile,
  FiscalServiceConfig,
  NfseEvent,
  NfseRecord,
  NfseRequest,
} from "../../shared/fiscal.js";
import { validateIssuer, validateNfseRequest, validateService } from "../../shared/fiscal-validation.js";
import { FiscalError, fiscalErrorCode } from "./errors.js";
import type { FiscalProvider } from "./provider.js";
import {
  automationSettings,
  certificateCredential,
  certificateMetadata,
  createNfse,
  fiscalProfile,
  inFiscalWorkspace,
  listNfse,
  nfse,
  saveAutomationSettings,
  saveFiscalProfile,
  saveNfse,
  saveNfseError,
  saveServiceConfig,
  serviceConfig,
  serviceConfigs,
} from "./repository.js";

export interface ServerFiscalDraft {
  idempotencyKey: string;
  clientId: string;
  customer: NfseRequest["customer"];
  serviceConfigId: string;
  description: string;
  amount: number;
  competenceDate: string;
  origin: NfseRequest["origin"];
  taskId?: string | null;
  chargeId?: string | null;
  projectId?: string | null;
}

const defaults: FiscalAutomationSettings = {
  enabled: false,
  mode: "never",
  sendEmail: false,
  saveToClient: true,
  attachToService: true,
  attachToCharge: true,
  whatsappEnabled: false,
};

const event = (kind: NfseEvent["kind"], title: string, description: string): NfseEvent => ({
  id: randomUUID(), kind, title, description, createdAt: new Date().toISOString(),
});

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const sanitizeErrorContext = (value: Record<string, unknown>) => Object.fromEntries(
  Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] => {
    const field = entry[1];
    return field === null || ["string", "number", "boolean"].includes(typeof field);
  }),
);

export class FiscalService {
  constructor(public db: Database, private provider: FiscalProvider) {}

  async overview(scope: Scope) {
    return inFiscalWorkspace(this.db, scope, async (sql) => {
      const [profile, automation, services, notes, certificate] = await Promise.all([
        fiscalProfile(sql, scope.workspaceId),
        automationSettings(sql, scope.workspaceId),
        serviceConfigs(sql, scope.workspaceId),
        listNfse(sql, scope.workspaceId),
        certificateMetadata(sql, scope.workspaceId),
      ]);
      return {
        workspaceId: scope.workspaceId,
        environment: process.env.FISCAL_ENVIRONMENT === "production" ? "production" : "sandbox",
        integrationEnabled: this.provider.enabled,
        profile,
        automation: automation ?? defaults,
        services,
        notes,
        certificate,
      };
    }, false);
  }

  async saveProfile(scope: Scope, input: FiscalProfile) {
    if (input.environment === "production" && process.env.FISCAL_LIVE_ENABLED !== "true") {
      throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
    }
    const issues = validateIssuer(input);
    const now = new Date().toISOString();
    const profile: FiscalProfile = {
      ...input,
      environment: process.env.FISCAL_ENVIRONMENT === "production" ? "production" : "sandbox",
      configuredAt: input.configuredAt || now,
      updatedAt: now,
    };
    return inFiscalWorkspace(this.db, scope, async (sql) => {
      await saveFiscalProfile(sql, scope.workspaceId, profile);
      return { profile, valid: issues.length === 0, issues };
    });
  }

  async saveAutomation(scope: Scope, input: FiscalAutomationSettings) {
    const settings = { ...input, whatsappEnabled: false as const };
    return inFiscalWorkspace(this.db, scope, async (sql) => {
      await saveAutomationSettings(sql, scope.workspaceId, settings);
      return settings;
    });
  }

  async saveService(scope: Scope, input: Omit<FiscalServiceConfig, "id" | "createdAt" | "updatedAt"> & Partial<Pick<FiscalServiceConfig, "id" | "createdAt" | "updatedAt">>) {
    const now = new Date().toISOString();
    const config: FiscalServiceConfig = {
      ...input,
      id: input.id || randomUUID(),
      localId: input.localId || input.id || randomUUID(),
      createdAt: input.createdAt || now,
      updatedAt: now,
    };
    const issues = validateService(config);
    return inFiscalWorkspace(this.db, scope, async (sql) => {
      await saveServiceConfig(sql, scope.workspaceId, config);
      return { config, valid: issues.length === 0, issues };
    });
  }

  async list(scope: Scope, offset = 0) {
    return inFiscalWorkspace(this.db, scope, (sql) => listNfse(sql, scope.workspaceId, offset), false);
  }

  async get(scope: Scope, id: string) {
    return inFiscalWorkspace(this.db, scope, (sql) => nfse(sql, scope.workspaceId, id), false);
  }

  async createDraft(scope: Scope, input: ServerFiscalDraft) {
    return inFiscalWorkspace(this.db, scope, async (sql) => {
      const profile = await fiscalProfile(sql, scope.workspaceId);
      if (!profile) throw new FiscalError("FISCAL_NOT_CONFIGURED", 422);
      const configuredService = await serviceConfig(sql, scope.workspaceId, input.serviceConfigId);
      const request: NfseRequest = {
        idempotencyKey: input.idempotencyKey,
        environment: profile.environment,
        origin: input.origin,
        issuer: profile,
        customer: input.customer,
        service: configuredService,
        description: input.description || configuredService.fiscalDescription,
        amount: input.amount,
        competenceDate: input.competenceDate,
        clientId: input.clientId,
        serviceConfigId: configuredService.id,
        taskId: input.taskId ?? null,
        chargeId: input.chargeId ?? null,
        projectId: input.projectId ?? null,
      };
      const validation = validateNfseRequest(request);
      const created = event("created", "Rascunho criado", validation.valid
        ? "Dados preparados para revisão antes da emissão."
        : `Rascunho salvo com ${validation.issues.length} pendência(s).`);
      const now = new Date().toISOString();
      const note: NfseRecord = {
        id: randomUUID(),
        workspaceId: scope.workspaceId,
        idempotencyKey: input.idempotencyKey,
        status: "DRAFT",
        environment: profile.environment,
        provider: profile.provider,
        providerReference: "",
        providerStatus: "",
        origin: input.origin,
        issuer: request.issuer,
        customer: request.customer,
        service: request.service,
        description: request.description,
        amount: request.amount,
        competenceDate: request.competenceDate,
        issuedAt: null,
        number: "",
        series: "",
        accessKey: "",
        municipality: request.service.incidenceCity || request.issuer.address.city,
        issAmount: request.amount * (request.service.tax.issRate / 100),
        withholdingAmount: 0,
        clientId: request.clientId,
        serviceConfigId: request.serviceConfigId,
        taskId: request.taskId ?? null,
        chargeId: request.chargeId ?? null,
        projectId: request.projectId ?? null,
        documents: [],
        errors: [],
        events: [created],
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      };
      const result = await createNfse(sql, scope.workspaceId, note, fingerprint(request));
      return { ...result, validation };
    });
  }

  async prepare(scope: Scope, id: string) {
    return inFiscalWorkspace(this.db, scope, async (sql) => {
      const note = await nfse(sql, scope.workspaceId, id);
      if (!["DRAFT", "REJECTED", "ERROR"].includes(note.status)) return note;
      const validation = validateNfseRequest(this.toRequest(note));
      if (!validation.valid) throw new FiscalError("INVALID_FISCAL_INPUT", 422, { issues: validation.issues });
      const createdEvent = event("issue_requested", "Emissão preparada", "A solicitação aguarda a ativação segura do provedor fiscal.");
      const updated = { ...note, status: "PENDING" as const, updatedAt: new Date().toISOString(), events: [createdEvent, ...note.events] };
      await saveNfse(sql, scope.workspaceId, updated, createdEvent);
      return updated;
    });
  }

  async issue(scope: Scope, id: string) {
    if (!this.provider.enabled || process.env.NFSE_NATIONAL_INTEGRATION_ENABLED !== "true") throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
    const reservation = await inFiscalWorkspace(this.db, scope, async (sql) => {
      const note = await nfse(sql, scope.workspaceId, id);
      if (["AUTHORIZED", "PROCESSING"].includes(note.status)) {
        return { shouldIssue: false as const, note };
      }
      if (!["PENDING", "REJECTED", "ERROR"].includes(note.status)) {
        throw new FiscalError("FISCAL_CONFLICT", 409, { status: note.status });
      }
      if (note.provider !== this.provider.id) {
        throw new FiscalError("FISCAL_NOT_CONFIGURED", 422, { provider: note.provider });
      }
      if (note.environment === "production" && process.env.FISCAL_LIVE_ENABLED !== "true") {
        throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
      }
      const certificate = await certificateCredential(sql, scope.workspaceId);
      const validation = validateNfseRequest(this.toRequest(note), {
        certificate: certificate?.metadata,
        requireCertificate: true,
      });
      if (!validation.valid || !certificate?.secretReference) {
        throw new FiscalError("INVALID_FISCAL_INPUT", 422, { issues: validation.issues });
      }
      const processingEvent = event(
        note.attempts ? "retry_requested" : "processing",
        note.attempts ? "Reprocessamento iniciado" : "Emissão em processamento",
        "A emissão foi reservada com idempotência antes da chamada ao provedor fiscal.",
      );
      const processing = { ...note, status: "PROCESSING" as const, attempts: note.attempts + 1, updatedAt: new Date().toISOString(), events: [processingEvent, ...note.events] };
      await saveNfse(sql, scope.workspaceId, processing, processingEvent);
      return {
        shouldIssue: true as const,
        note: processing,
        certificateReference: certificate.secretReference,
      };
    });

    if (!reservation.shouldIssue) return reservation.note;

    try {
      const response = await this.provider.issueNfse(this.toRequest(reservation.note), {
        workspaceId: scope.workspaceId,
        certificateReference: reservation.certificateReference,
      });
      return inFiscalWorkspace(this.db, scope, async (sql) => {
        const current = await nfse(sql, scope.workspaceId, id);
        if (current.status !== "PROCESSING" || current.attempts !== reservation.note.attempts) return current;
        const eventKind: NfseEvent["kind"] = response.status === "AUTHORIZED"
          ? "authorized"
          : response.status === "REJECTED"
            ? "rejected"
            : response.status === "CANCELLED"
              ? "cancelled"
              : response.status === "ERROR"
                ? "error"
                : "processing";
        const resultEvent = event(
          eventKind,
          response.status === "AUTHORIZED" ? "NFS-e autorizada" : response.status === "REJECTED" ? "NFS-e rejeitada" : "Retorno fiscal recebido",
          "O retorno do provedor foi conciliado com o registro fiscal.",
        );
        const updated: NfseRecord = {
          ...current,
          status: response.status,
          providerReference: response.providerReference,
          providerStatus: response.rawStatus || "",
          number: response.number || "",
          series: response.series || "",
          accessKey: response.accessKey || "",
          issuedAt: response.issuedAt || null,
          updatedAt: new Date().toISOString(),
          events: [resultEvent, ...current.events],
        };
        await saveNfse(sql, scope.workspaceId, updated, resultEvent);
        return updated;
      });
    } catch (error) {
      const code = fiscalErrorCode(error);
      await inFiscalWorkspace(this.db, scope, async (sql) => {
        const current = await nfse(sql, scope.workspaceId, id);
        if (current.status !== "PROCESSING" || current.attempts !== reservation.note.attempts) return current;
        const uncertain = code === "FISCAL_PROVIDER_TIMEOUT";
        const failureEvent = event(
          "error",
          uncertain ? "Resposta do provedor pendente" : "Falha controlada na emissão",
          uncertain
            ? "A Weeki manterá a nota em processamento até consultar o estado oficial; um novo envio não será feito automaticamente."
            : "A falha foi registrada sem criar uma segunda nota. Revise a configuração antes de reprocessar.",
        );
        const fiscalError: NfseRecord["errors"][number] = {
          id: randomUUID(),
          code,
          userMessage: error instanceof FiscalError ? error.message : "Não foi possível emitir a NFS-e.",
          providerMessage: "",
          safeContext: error instanceof FiscalError ? sanitizeErrorContext(error.safeContext) : {},
          provider: current.provider,
          attempt: current.attempts,
          createdAt: new Date().toISOString(),
        };
        const failed: NfseRecord = {
          ...current,
          status: uncertain ? "PROCESSING" : "ERROR",
          updatedAt: new Date().toISOString(),
          events: [failureEvent, ...current.events],
          errors: [fiscalError, ...current.errors],
        };
        await saveNfse(sql, scope.workspaceId, failed, failureEvent);
        await saveNfseError(sql, scope.workspaceId, failed.id, fiscalError);
        return failed;
      });
      throw error;
    }
  }

  async cancelPrepared(scope: Scope, id: string) {
    return inFiscalWorkspace(this.db, scope, async (sql) => {
      const note = await nfse(sql, scope.workspaceId, id);
      if (["AUTHORIZED", "PROCESSING"].includes(note.status)) throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
      if (note.status === "CANCELLED") return note;
      const cancelEvent = event("cancelled", "Preparação cancelada", "Nenhuma solicitação fiscal foi transmitida.");
      const updated = { ...note, status: "CANCELLED" as const, updatedAt: new Date().toISOString(), events: [cancelEvent, ...note.events] };
      await saveNfse(sql, scope.workspaceId, updated, cancelEvent);
      return updated;
    });
  }

  private toRequest(note: NfseRecord): NfseRequest {
    return {
      idempotencyKey: note.idempotencyKey,
      environment: note.environment,
      origin: note.origin,
      issuer: note.issuer,
      customer: note.customer,
      service: note.service,
      description: note.description,
      amount: note.amount,
      competenceDate: note.competenceDate,
      clientId: note.clientId,
      serviceConfigId: note.serviceConfigId,
      taskId: note.taskId,
      chargeId: note.chargeId,
      projectId: note.projectId,
    };
  }
}
