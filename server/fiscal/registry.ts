import type { FiscalProvider } from "./provider.js";
import { UnconfiguredCertificateSecretStore } from "./certificate-store.js";
import { StandbyDpsCodec } from "./dps.js";
import { NationalNfseProvider } from "./providers/national-nfse.js";

export function fiscalProviders() {
  const national = new NationalNfseProvider({
    enabled: process.env.NFSE_NATIONAL_INTEGRATION_ENABLED === "true",
    environment: process.env.FISCAL_ENVIRONMENT === "production" ? "production" : "sandbox",
  }, new UnconfiguredCertificateSecretStore(), new StandbyDpsCodec());
  const registry = new Map<FiscalProvider["id"], FiscalProvider>([[national.id, national]]);
  return {
    get(id: FiscalProvider["id"]) {
      const provider = registry.get(id);
      if (!provider) throw new Error(`Fiscal provider not registered: ${id}`);
      return provider;
    },
  };
}
