import type {
  FiscalValidationResult,
  MunicipalParameters,
  NfseRequest,
  NfseResponse,
  NfseStatus,
} from "../../shared/fiscal.js";

export interface FiscalDocumentPayload {
  content: Buffer;
  contentType: "application/pdf" | "application/xml";
  fileName: string;
  checksum: string;
}

export interface FiscalProviderContext {
  workspaceId: string;
  certificateReference: string;
}

export interface FiscalProvider {
  readonly id: "national_nfse" | "focus_nfe" | "plugnotas";
  readonly enabled: boolean;
  issueNfse(request: NfseRequest, context: FiscalProviderContext): Promise<NfseResponse>;
  getNfse(providerReference: string): Promise<NfseResponse>;
  cancelNfse(providerReference: string, reason: string): Promise<NfseResponse>;
  replaceNfse(providerReference: string, request: NfseRequest, context: FiscalProviderContext): Promise<NfseResponse>;
  getPdf(providerReference: string): Promise<FiscalDocumentPayload>;
  getXml(providerReference: string): Promise<FiscalDocumentPayload>;
  getMunicipalParameters(cityCode: string): Promise<MunicipalParameters>;
  validate(request: NfseRequest): Promise<FiscalValidationResult>;
  getStatus(providerReference: string): Promise<{ status: NfseStatus; rawStatus: string }>;
}
