import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { externalPath } from "../../payments/http.js";
import { ContractError } from "../errors.js";
import type {
  SignatureDocumentPayload,
  SignatureProvider,
  SignatureSubmissionInput,
  SignatureSubmissionResult,
  SignatureWebhookInput,
  VerifiedSignatureEvent,
} from "../provider.js";
import type { ContractSignatureRequest, ContractSignatureStatus, ContractSigner } from "../../../shared/contracts.js";

const productionUrl = "https://app.clicksign.com/api/v3";
const sandboxUrl = "https://sandbox.clicksign.com/api/v3";

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function getString(value: unknown, path: string[]): string {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" || typeof current === "number" ? String(current) : "";
}

function compactPayload(payload: unknown): Record<string, unknown> {
  return {
    id: getString(payload, ["id"]) || getString(payload, ["data", "id"]),
    type: getString(payload, ["event", "name"]) || getString(payload, ["type"]) || getString(payload, ["data", "attributes", "event"]),
    envelopeId: getString(payload, ["envelope", "id"]) || getString(payload, ["data", "relationships", "envelope", "data", "id"]),
    documentId: getString(payload, ["document", "id"]) || getString(payload, ["data", "relationships", "document", "data", "id"]),
    signerId: getString(payload, ["signer", "id"]) || getString(payload, ["data", "relationships", "signer", "data", "id"]),
    occurredAt: getString(payload, ["occurred_at"]) || getString(payload, ["created_at"]) || getString(payload, ["data", "attributes", "created_at"]),
  };
}

function equalHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeStatus(raw: string): ContractSignatureStatus {
  const value = raw.toLowerCase();
  if (/(completed|finished|signed|assinado|signature_completed|auto_close)/.test(value)) return "signed";
  if (/(partially|partial)/.test(value)) return "partially_signed";
  if (/(viewed|opened|visualizado)/.test(value)) return "viewed";
  if (/(sent|running|notification|notified|enviado)/.test(value)) return "sent";
  if (/(refused|declined|rejected|recusado)/.test(value)) return "declined";
  if (/(expired|expirado)/.test(value)) return "expired";
  if (/(cancel|canceled|cancelled|cancelado)/.test(value)) return "cancelled";
  if (/(error|failed|erro)/.test(value)) return "error";
  if (/(created|draft|upload|prepar)/.test(value)) return "preparing";
  return "sent";
}

export class ClicksignSignatureProvider implements SignatureProvider {
  readonly id = "clicksign" as const;
  readonly environment: "sandbox" | "production";
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly webhookSecret: string;

  constructor() {
    this.environment = process.env.CONTRACTS_ENVIRONMENT === "production" ? "production" : "sandbox";
    this.baseUrl = (process.env.CLICKSIGN_BASE_URL || (this.environment === "production" ? productionUrl : sandboxUrl)).replace(/\/$/, "");
    this.accessToken = process.env.CLICKSIGN_ACCESS_TOKEN || "";
    this.webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET || "";
  }

  configured() {
    return Boolean(
      process.env.CONTRACTS_SIGNATURE_ENABLED === "true" &&
      this.accessToken &&
      this.webhookSecret &&
      (this.environment !== "production" || process.env.CONTRACTS_LIVE_ENABLED === "true"),
    );
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.configured()) throw new ContractError("CONTRACT_SIGNATURE_NOT_CONFIGURED", 503);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.headers(), ...init.headers },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401 || response.status === 403) throw new ContractError("CONTRACT_SIGNATURE_NOT_CONFIGURED", 409);
      if (response.status === 404) throw new ContractError("CONTRACT_NOT_FOUND", 404);
      if (response.status === 429 || response.status >= 500) throw new ContractError("CONTRACT_PROVIDER_UNAVAILABLE", 503, true);
      if (!response.ok) throw new ContractError("CONTRACT_INVALID_INPUT", 422);
      if (response.status === 204) return {} as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ContractError) throw error;
      throw new ContractError("CONTRACT_PROVIDER_UNAVAILABLE", 503, true);
    }
  }

  private async download(path: string, fileName: string): Promise<SignatureDocumentPayload> {
    if (!this.configured()) throw new ContractError("CONTRACT_SIGNATURE_NOT_CONFIGURED", 503);
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/pdf, application/octet-stream",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new ContractError(response.status >= 500 ? "CONTRACT_PROVIDER_UNAVAILABLE" : "CONTRACT_INVALID_INPUT", response.status >= 500 ? 503 : 422, response.status >= 500);
    const data = Buffer.from(await response.arrayBuffer());
    return {
      fileName,
      contentType: response.headers.get("content-type") || "application/pdf",
      data,
      checksum: sha256(data),
    };
  }

  async sendForSignature(input: SignatureSubmissionInput): Promise<SignatureSubmissionResult> {
    const name = `${input.contract.number} - ${input.contract.title}`.slice(0, 120);
    const envelope = await this.request<{ data?: { id?: string } }>("/envelopes", {
      method: "POST",
      body: JSON.stringify({ data: { type: "envelopes", attributes: { name } } }),
    });
    const envelopeId = envelope.data?.id;
    if (!envelopeId) throw new ContractError("CONTRACT_PROVIDER_UNAVAILABLE", 503, true);

    const document = await this.request<{ data?: { id?: string } }>(`/envelopes/${externalPath(envelopeId)}/documents`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "documents",
          attributes: {
            filename: `${input.contract.number}.pdf`,
            content_base64: `data:application/pdf;base64,${input.pdf.toString("base64")}`,
            metadata: {
              weeki_contract_id: input.contract.id,
              weeki_version_id: input.request.versionId,
              checksum: input.checksum,
            },
          },
        },
      }),
    });
    const documentExternalId = document.data?.id;
    const signerExternalIds: Record<string, string> = {};
    for (const signer of input.contract.signers) {
      const signerResponse = await this.request<{ data?: { id?: string } }>(`/envelopes/${externalPath(envelopeId)}/signers`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "signers",
            attributes: {
              name: signer.name,
              email: signer.email,
              documentation: signer.document.replace(/\D/g, "") || undefined,
              group: input.contract.signingMode === "ordered" ? signer.order : 1,
              communicate_events: {
                document_signed: "email",
                signature_request: "email",
              },
            },
          },
        }),
      });
      const signerExternalId = signerResponse.data?.id;
      if (signerExternalId) {
        signerExternalIds[signer.id] = signerExternalId;
        if (documentExternalId) {
          await this.request(`/envelopes/${externalPath(envelopeId)}/requirements`, {
            method: "POST",
            body: JSON.stringify({
              data: {
                type: "requirements",
                attributes: { action: "agree", role: signer.role || "sign" },
                relationships: {
                  document: { data: { type: "documents", id: documentExternalId } },
                  signer: { data: { type: "signers", id: signerExternalId } },
                },
              },
            }),
          });
        }
      }
    }
    await this.request(`/envelopes/${externalPath(envelopeId)}/activate`, { method: "POST" });
    await this.request(`/envelopes/${externalPath(envelopeId)}/notifications`, {
      method: "POST",
      body: JSON.stringify({ data: { type: "notifications", attributes: { message: input.request.message } } }),
    });
    return {
      externalId: envelopeId,
      externalStatus: "running",
      status: "sent",
      documentExternalId,
      signerExternalIds,
    };
  }

  async resendReminder(request: ContractSignatureRequest, signer?: ContractSigner) {
    await this.request(`/envelopes/${externalPath(request.externalId)}/notifications`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "notifications",
          attributes: {
            signer_id: signer?.externalId,
            message: request.message,
          },
        },
      }),
    });
  }

  async cancelRequest(request: ContractSignatureRequest, reason: string) {
    await this.request(`/envelopes/${externalPath(request.externalId)}`, {
      method: "PATCH",
      body: JSON.stringify({ data: { type: "envelopes", id: request.externalId, attributes: { status: "cancelled", reason } } }),
    });
  }

  async downloadSignedDocument(request: ContractSignatureRequest) {
    return this.download(`/envelopes/${externalPath(request.externalId)}/documents/download`, `${request.externalId}-signed.pdf`);
  }

  async downloadEvidence(request: ContractSignatureRequest) {
    return this.download(`/envelopes/${externalPath(request.externalId)}/certificates/download`, `${request.externalId}-evidence.pdf`);
  }

  handleWebhook(input: SignatureWebhookInput): VerifiedSignatureEvent {
    if (!this.webhookSecret) throw new ContractError("CONTRACT_WEBHOOK_INVALID", 401);
    const received = input.headers["x-clicksign-signature"] || input.headers.signature || "";
    const expected = createHmac("sha256", this.webhookSecret).update(input.raw).digest("hex");
    if (!received || !equalHex(received.replace(/^sha256=/, ""), expected)) throw new ContractError("CONTRACT_WEBHOOK_INVALID", 401);
    let payload: unknown;
    try {
      payload = JSON.parse(input.raw);
    } catch {
      throw new ContractError("CONTRACT_WEBHOOK_INVALID", 400);
    }
    const safePayload = compactPayload(payload);
    const type = String(safePayload.type || getString(payload, ["event_type"]) || "clicksign.event");
    const externalRequestId =
      String(safePayload.envelopeId || getString(payload, ["envelope_id"]) || getString(payload, ["data", "id"]) || "");
    if (!externalRequestId) throw new ContractError("CONTRACT_WEBHOOK_INVALID", 401);
    const occurredAt = String(safePayload.occurredAt || new Date().toISOString());
    return {
      id: String(safePayload.id || `${externalRequestId}:${type}:${occurredAt}`),
      type,
      provider: this.id,
      externalRequestId,
      signerExternalId: String(safePayload.signerId || "") || undefined,
      signatureStatus: normalizeStatus(type),
      signerStatus: normalizeStatus(type),
      occurredAt,
      rawStatus: type,
      safePayload,
    };
  }
}
