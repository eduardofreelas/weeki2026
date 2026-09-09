import type {
  Capabilities,
  Environment,
  NewCharge,
  PaymentCharge,
  PaymentCustomer,
  PaymentStatus,
  ProviderId,
  PublicConnection,
} from "../../shared/payments.js";
export type Credentials = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  webhookSecret?: string;
  webhookId?: string;
};
export interface Connection extends PublicConnection {
  workspaceId: string;
  encryptedCredentials: string;
}
export interface ProviderContext {
  connection: Connection;
  credentials: Credentials;
}
export interface Account {
  id: string;
  name: string;
  email: string;
  capabilities: Capabilities;
}
export interface ChargeSnapshot {
  externalId: string;
  externalPaymentId?: string;
  status: PaymentStatus;
  rawStatus: string;
  amountMinor: number;
  refundedMinor: number;
  currency: string;
  paymentUrl: string | null;
  paidAt: string | null;
  paymentMethod?: PaymentCharge["paymentMethod"];
}
export interface VerifiedEvent {
  id: string;
  type: string;
  resourceId: string;
  accountId?: string;
  reference?: string;
  live: boolean;
}
export interface WebhookInput {
  raw: string;
  headers: Record<string, string>;
  query: URLSearchParams;
}
export interface ProviderConfig {
  environment: Environment;
  origin: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
}
export interface PaymentProvider {
  id: ProviderId;
  config: ProviderConfig;
  connectionMode: "oauth" | "server_provisioned";
  configured(): boolean;
  authorizationUrl(state: string, verifier: string): string;
  exchangeCode(code: string, verifier: string): Promise<Credentials>;
  refreshCredentials(credentials: Credentials): Promise<Credentials>;
  connectAccount(context: ProviderContext): Promise<Account>;
  getConnectionStatus(context: ProviderContext): Promise<Account>;
  prepareWebhook(context: ProviderContext): Promise<Credentials>;
  disconnectAccount(context: ProviderContext): Promise<void>;
  createCharge(
    context: ProviderContext,
    input: NewCharge,
    customer: PaymentCustomer,
    id: string,
  ): Promise<ChargeSnapshot>;
  getCharge(
    context: ProviderContext,
    charge: PaymentCharge,
  ): Promise<ChargeSnapshot>;
  findCharge(
    context: ProviderContext,
    reference: string,
  ): Promise<ChargeSnapshot | null>;
  cancelCharge(
    context: ProviderContext,
    charge: PaymentCharge,
    operationKey: string,
  ): Promise<void>;
  refundCharge(
    context: ProviderContext,
    charge: PaymentCharge,
    operationKey: string,
  ): Promise<void>;
  createPaymentLink(
    context: ProviderContext,
    charge: PaymentCharge,
  ): Promise<string | null>;
  handleWebhook(input: WebhookInput, credentials?: Credentials): VerifiedEvent;
  resolveWebhook(
    context: ProviderContext,
    event: VerifiedEvent,
  ): Promise<{ reference: string; snapshot?: ChargeSnapshot }>;
  normalizeStatus(raw: string): PaymentStatus;
}
