import { AsaasProvider } from "./providers/asaas.js";
import { MercadoPagoProvider } from "./providers/mercadopago.js";
import { StripeProvider } from "./providers/stripe.js";
import type { PaymentProvider, ProviderConfig } from "./provider.js";
import type { ProviderId } from "../../shared/payments.js";
import { PaymentError } from "./errors.js";
export class ProviderRegistry {
  private adapters: Map<string, PaymentProvider>;
  constructor(providers: PaymentProvider[]) {
    this.adapters = new Map(providers.map((p) => [p.id, p]));
  }
  get(id: string) {
    const p = this.adapters.get(id);
    if (!p) throw new PaymentError("INVALID_INPUT", 400);
    return p;
  }
  list() {
    return [...this.adapters.values()];
  }
}
export function providers(config: ProviderConfig) {
  const settings: Record<ProviderId, ProviderConfig> = {
    asaas: config,
    mercadopago: {
      ...config,
      clientId: process.env.MP_CLIENT_ID,
      clientSecret: process.env.MP_CLIENT_SECRET,
      webhookSecret: process.env.MP_WEBHOOK_SECRET,
    },
    stripe: {
      ...config,
      clientId: process.env.STRIPE_CONNECT_CLIENT_ID,
      clientSecret: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
  };
  return new ProviderRegistry([
    new AsaasProvider(settings.asaas),
    new MercadoPagoProvider(settings.mercadopago),
    new StripeProvider(settings.stripe),
  ]);
}
