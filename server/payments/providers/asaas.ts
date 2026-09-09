import type {
  NewCharge,
  PaymentCharge,
  PaymentCustomer,
  PaymentMethod,
  PaymentStatus,
} from "../../../shared/payments.js";
import type {
  ChargeSnapshot,
  PaymentProvider,
  ProviderContext,
  VerifiedEvent,
  WebhookInput,
} from "../provider.js";
import { ProviderBase } from "./base.js";
import { PaymentError } from "../errors.js";
import { equal } from "../crypto.js";
import { externalPath, hostedUrl } from "../http.js";
type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  deleted?: boolean;
  invoiceUrl: string;
  paymentDate?: string;
  confirmedDate?: string;
  externalReference: string;
  billingType: string;
  refunds?: { value: number; status: string }[];
};
const methods: Record<PaymentMethod, string> = {
  pix: "PIX",
  credit_card: "CREDIT_CARD",
  bank_slip: "BOLETO",
};
const statuses: Record<string, PaymentStatus> = {
  PENDING: "PENDING",
  RECEIVED: "PAID",
  CONFIRMED: "PAID",
  RECEIVED_IN_CASH: "PAID",
  OVERDUE: "OVERDUE",
  REFUNDED: "REFUNDED",
  REFUND_REQUESTED: "PROCESSING",
  REFUND_IN_PROGRESS: "PROCESSING",
  CHARGEBACK_REQUESTED: "PROCESSING",
  CHARGEBACK_DISPUTE: "PROCESSING",
  AWAITING_CHARGEBACK_REVERSAL: "PROCESSING",
  DUNNING_RECEIVED: "PAID",
  AWAITING_RISK_ANALYSIS: "PROCESSING",
  AUTHORIZED: "PROCESSING",
  DELETED: "CANCELED",
  CREDIT_CARD_CAPTURE_REFUSED: "FAILED",
  REPROVED_BY_RISK_ANALYSIS: "FAILED",
};
export class AsaasProvider extends ProviderBase implements PaymentProvider {
  id = "asaas" as const;
  connectionMode = "server_provisioned" as const;
  configured() {
    return true;
  } // Individual API keys are provisioned into the encrypted server vault.
  authorizationUrl(): string {
    return this.unavailable();
  }
  async exchangeCode(): Promise<never> {
    return this.unavailable();
  }
  private api<T>(
    ctx: ProviderContext,
    path: string,
    method = "GET",
    body?: unknown,
  ) {
    if (!ctx.credentials.accessToken)
      throw new PaymentError("RECONNECT_REQUIRED", 409);
    const base =
      this.config.environment === "sandbox"
        ? "https://api-sandbox.asaas.com/v3"
        : "https://api.asaas.com/v3";
    return this.http<T>(base + path, {
      method,
      headers: {
        access_token: ctx.credentials.accessToken,
        "Content-Type": "application/json",
        "User-Agent": "Weeki/1.0",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async getConnectionStatus(ctx: ProviderContext) {
    const info = await this.api<{ name: string; email: string }>(
      ctx,
      "/myAccount/commercialInfo",
    );
    const wallets = await this.api<{ data: { id: string }[] }>(
      ctx,
      "/wallets/",
    );
    const id = wallets.data?.[0]?.id;
    if (!id) throw new PaymentError("ACCOUNT_BLOCKED", 409);
    return {
      id,
      name: info.name || "Conta Asaas",
      email: info.email || "",
      capabilities: {
        methods: ["pix", "credit_card", "bank_slip"] as PaymentMethod[],
        multipleMethods: false,
        cancel: true,
        refund: true,
        maxInstallments: 1,
        manualRevocation: true,
        requiresDocument: true,
        checkoutNotice:
          "Selecione um método por cobrança. O cliente paga no checkout Asaas.",
      },
    };
  }
  async prepareWebhook(ctx: ProviderContext) {
    const url = `${this.config.origin}/webhooks/asaas/${ctx.connection.id}`;
    const existing = await this.api<{ data: { id: string; url: string }[] }>(
      ctx,
      "/webhooks?limit=100",
    );
    const matches = existing.data.filter((h) => h.url === url);
    if (matches.length > 1)
      throw new PaymentError("RECONCILIATION_REQUIRED", 409);
    const payload = {
      name: "Weeki cobranças",
      url,
      email: process.env.PAYMENTS_ALERT_EMAIL,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: ctx.credentials.webhookSecret,
      sendType: "SEQUENTIALLY",
      events: [
        "PAYMENT_CREATED",
        "PAYMENT_UPDATED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED",
        "PAYMENT_OVERDUE",
        "PAYMENT_DELETED",
        "PAYMENT_REFUNDED",
        "PAYMENT_PARTIALLY_REFUNDED",
        "PAYMENT_REFUND_IN_PROGRESS",
        "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
      ],
    };
    const hook = matches[0]
      ? await this.api<{ id: string }>(
          ctx,
          `/webhooks/${externalPath(matches[0].id)}`,
          "PUT",
          payload,
        )
      : await this.api<{ id: string }>(ctx, "/webhooks", "POST", payload);
    return { ...ctx.credentials, webhookId: hook.id };
  }
  async disconnectAccount(ctx: ProviderContext) {
    if (ctx.credentials.webhookId)
      await this.api(
        ctx,
        `/webhooks/${externalPath(ctx.credentials.webhookId)}`,
        "DELETE",
      );
  }
  normalizeStatus(raw: string) {
    return statuses[raw] ?? this.unknownStatus();
  }
  private snapshot(p: AsaasPayment): ChargeSnapshot {
    const refundedMinor = Math.round(
      (p.refunds || [])
        .filter((r) => r.status === "DONE")
        .reduce((s, r) => s + r.value, 0) * 100,
    );
    const amountMinor = Math.round(p.value * 100);
    return {
      externalId: p.id,
      status: p.deleted
        ? "CANCELED"
        : refundedMinor > 0 && refundedMinor < amountMinor
          ? "PARTIALLY_REFUNDED"
          : this.normalizeStatus(p.status),
      rawStatus: p.deleted ? "DELETED" : p.status,
      amountMinor,
      refundedMinor: p.status === "REFUNDED" ? amountMinor : refundedMinor,
      currency: "BRL",
      paymentUrl: hostedUrl(p.invoiceUrl, ["asaas.com"]),
      paidAt: p.paymentDate || p.confirmedDate || null,
      paymentMethod: (
        { PIX: "pix", BOLETO: "bank_slip", CREDIT_CARD: "credit_card" } as const
      )[p.billingType as "PIX"],
    };
  }
  async createCharge(
    ctx: ProviderContext,
    input: NewCharge,
    customer: PaymentCustomer,
    id: string,
  ) {
    if (input.methods.length !== 1)
      throw new PaymentError("METHOD_UNAVAILABLE", 422);
    const existing = await this.findCharge(ctx, id);
    if (existing) return existing;
    if (!customer.document) throw new PaymentError("INVALID_INPUT", 422);
    const matches = await this.api<{ data: { id: string }[] }>(
      ctx,
      `/customers?externalReference=${externalPath(customer.id)}`,
    );
    const remote =
      matches.data[0] ||
      (await this.api<{ id: string }>(ctx, "/customers", "POST", {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.document,
        externalReference: customer.id,
        notificationDisabled: true,
      }));
    const p = await this.api<AsaasPayment>(ctx, "/payments", "POST", {
      customer: remote.id,
      billingType: methods[input.methods[0]],
      value: input.amountMinor / 100,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: id,
    });
    return this.snapshot(p);
  }
  async getCharge(ctx: ProviderContext, c: PaymentCharge) {
    const p = await this.api<AsaasPayment>(
      ctx,
      `/payments/${externalPath(c.externalId!)}`,
    );
    if (p.externalReference !== c.id)
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
    return this.snapshot(p);
  }
  async findCharge(ctx: ProviderContext, reference: string) {
    const r = await this.api<{ data: AsaasPayment[] }>(
      ctx,
      `/payments?externalReference=${externalPath(reference)}`,
    );
    if (r.data.length > 1)
      throw new PaymentError("RECONCILIATION_REQUIRED", 409);
    return r.data[0] ? this.snapshot(r.data[0]) : null;
  }
  async cancelCharge(ctx: ProviderContext, c: PaymentCharge) {
    await this.api(ctx, `/payments/${externalPath(c.externalId!)}`, "DELETE");
  }
  async refundCharge(ctx: ProviderContext, c: PaymentCharge) {
    await this.api(
      ctx,
      `/payments/${externalPath(c.externalId!)}/refund`,
      "POST",
      { value: (c.amountMinor - c.refundedMinor) / 100 },
    );
  }
  async createPaymentLink(ctx: ProviderContext, c: PaymentCharge) {
    return (await this.getCharge(ctx, c)).paymentUrl;
  }
  handleWebhook(
    input: WebhookInput,
    credentials?: ProviderContext["credentials"],
  ): VerifiedEvent {
    if (
      !credentials?.webhookSecret ||
      !equal(
        input.headers["asaas-access-token"] || "",
        credentials.webhookSecret,
      )
    )
      throw new PaymentError("INVALID_WEBHOOK", 401);
    const data = JSON.parse(input.raw) as {
      id: string;
      event: string;
      payment?: { id: string; externalReference?: string };
    };
    if (!data.id || !data.event || !data.payment?.id)
      throw new PaymentError("INVALID_WEBHOOK", 400);
    return {
      id: data.id,
      type: data.event,
      resourceId: data.payment.id,
      reference: data.payment.externalReference,
      live: this.config.environment === "production",
    };
  }
  async resolveWebhook(ctx: ProviderContext, e: VerifiedEvent) {
    const p = await this.api<AsaasPayment>(
      ctx,
      `/payments/${externalPath(e.resourceId)}`,
    );
    return { reference: p.externalReference, snapshot: this.snapshot(p) };
  }
}
