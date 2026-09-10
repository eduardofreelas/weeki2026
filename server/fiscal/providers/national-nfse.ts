import { validateNfseRequest } from "../../../shared/fiscal-validation.js";
import type { NfseRequest, NfseResponse } from "../../../shared/fiscal.js";
import type { CertificateSecretStore } from "../certificate-store.js";
import type { OfficialDpsCodec } from "../dps.js";
import { createDpsSource } from "../dps.js";
import { FiscalError } from "../errors.js";
import type { FiscalProvider, FiscalProviderContext } from "../provider.js";

export interface NationalNfseConfig {
  enabled: boolean;
  environment: "sandbox" | "production";
}

export class NationalNfseProvider implements FiscalProvider {
  readonly id = "national_nfse" as const;
  readonly enabled: boolean;

  constructor(
    private config: NationalNfseConfig,
    private certificates: CertificateSecretStore,
    private dpsCodec: OfficialDpsCodec,
  ) {
    this.enabled = config.enabled;
  }

  async validate(request: NfseRequest) {
    return validateNfseRequest(request, { requireCertificate: false });
  }

  async issueNfse(request: NfseRequest, context: FiscalProviderContext): Promise<NfseResponse> {
    this.assertEnabled();
    const validation = await this.validate(request);
    if (!validation.valid) throw new FiscalError("INVALID_FISCAL_INPUT", 422, { issueCount: validation.issues.length });
    const unsignedXml = await this.dpsCodec.buildAndValidate(createDpsSource(request));
    await this.certificates.sign(context.workspaceId, context.certificateReference, unsignedXml);
    // Transport is intentionally absent until the official contract is pinned and homologated.
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  async getNfse(): ReturnType<FiscalProvider["getNfse"]> { return this.unavailable(); }
  async cancelNfse(): ReturnType<FiscalProvider["cancelNfse"]> { return this.unavailable(); }
  async replaceNfse(): ReturnType<FiscalProvider["replaceNfse"]> { return this.unavailable(); }
  async getPdf(): ReturnType<FiscalProvider["getPdf"]> { return this.unavailable(); }
  async getXml(): ReturnType<FiscalProvider["getXml"]> { return this.unavailable(); }
  async getMunicipalParameters(): ReturnType<FiscalProvider["getMunicipalParameters"]> { return this.unavailable(); }
  async getStatus(): ReturnType<FiscalProvider["getStatus"]> { return this.unavailable(); }

  private assertEnabled() {
    if (!this.config.enabled || this.config.environment !== "sandbox") throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  private unavailable(): never {
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }
}
