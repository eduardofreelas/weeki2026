import type {
  ContractSignatureRequest,
  ContractSignatureStatus,
  ContractSigner,
  SignatureProviderId,
  WeekiContract,
} from "../../shared/contracts.js";

export interface SignatureWebhookInput {
  raw: string;
  headers: Record<string, string>;
  query: URLSearchParams;
}

export interface SignatureSubmissionInput {
  contract: WeekiContract;
  request: ContractSignatureRequest;
  pdf: Buffer;
  checksum: string;
}

export interface SignatureSubmissionResult {
  externalId: string;
  externalStatus: string;
  status: ContractSignatureStatus;
  documentExternalId?: string;
  signerExternalIds: Record<string, string>;
}

export interface SignatureDocumentPayload {
  fileName: string;
  contentType: string;
  data: Buffer;
  checksum?: string;
}

export interface VerifiedSignatureEvent {
  id: string;
  type: string;
  provider: SignatureProviderId;
  externalRequestId: string;
  signerExternalId?: string;
  signatureStatus: ContractSignatureStatus;
  signerStatus?: ContractSignatureStatus;
  occurredAt: string;
  rawStatus: string;
  safePayload: Record<string, unknown>;
}

export interface SignatureProvider {
  id: SignatureProviderId;
  environment: "sandbox" | "production";
  configured(): boolean;
  sendForSignature(input: SignatureSubmissionInput): Promise<SignatureSubmissionResult>;
  resendReminder(request: ContractSignatureRequest, signer?: ContractSigner): Promise<void>;
  cancelRequest(request: ContractSignatureRequest, reason: string): Promise<void>;
  downloadSignedDocument(request: ContractSignatureRequest): Promise<SignatureDocumentPayload>;
  downloadEvidence(request: ContractSignatureRequest): Promise<SignatureDocumentPayload>;
  handleWebhook(input: SignatureWebhookInput): VerifiedSignatureEvent;
}
