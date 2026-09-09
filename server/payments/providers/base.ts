import type { PaymentStatus } from "../../../shared/payments.js";
import type {
  Account,
  Credentials,
  ProviderConfig,
  ProviderContext,
} from "../provider.js";
import { PaymentError } from "../errors.js";
import { request, type Transport } from "../http.js";
export abstract class ProviderBase {
  constructor(
    public config: ProviderConfig,
    protected http: Transport = request,
  ) {}
  connectionMode: "oauth" | "server_provisioned" = "oauth";
  configured() {
    return Boolean(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.webhookSecret,
    );
  }
  abstract getConnectionStatus(context: ProviderContext): Promise<Account>;
  connectAccount(context: ProviderContext) {
    return this.getConnectionStatus(context);
  }
  async prepareWebhook(context: ProviderContext) {
    return context.credentials;
  }
  async refreshCredentials(credentials: Credentials) {
    return credentials;
  }
  unknownStatus(): PaymentStatus {
    return "PROCESSING";
  }
  unavailable(): never {
    throw new PaymentError("UNSUPPORTED", 422);
  }
  callback(provider: string) {
    return `${this.config.origin}/api/payments/oauth/${provider}/callback`;
  }
}
