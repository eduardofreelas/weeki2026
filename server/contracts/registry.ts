import type { SignatureProvider } from "./provider.js";
import type { SignatureProviderId } from "../../shared/contracts.js";
import { ClicksignSignatureProvider } from "./providers/clicksign.js";
import { ContractError } from "./errors.js";

export class SignatureProviderRegistry {
  private providers: Map<SignatureProviderId, SignatureProvider>;

  constructor(providers: SignatureProvider[]) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
  }

  get(id: SignatureProviderId) {
    const provider = this.providers.get(id);
    if (!provider) throw new ContractError("CONTRACT_SIGNATURE_NOT_CONFIGURED", 503);
    return provider;
  }

  default() {
    return this.get("clicksign");
  }

  list() {
    return [...this.providers.values()];
  }
}

export function signatureProviders() {
  return new SignatureProviderRegistry([new ClicksignSignatureProvider()]);
}
