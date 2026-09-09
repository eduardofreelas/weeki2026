import type {
  NewCharge,
  PaymentCharge,
  PaymentCustomer,
  PaymentMethod,
  PaymentStatus,
} from "../../../shared/payments.js";
import type {
  ChargeSnapshot,
  Credentials,
  PaymentProvider,
  ProviderContext,
  VerifiedEvent,
  WebhookInput,
} from "../provider.js";
import { ProviderBase } from "./base.js";
import { PaymentError } from "../errors.js";
import { verifyHmac } from "../crypto.js";
import { externalPath, form, hostedUrl } from "../http.js";
type StripeAccount = {
  id: string;
  business_profile?: { name: string };
  email: string;
  charges_enabled: boolean;
  capabilities: Record<string, string>;
};
type Intent = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  latest_charge?: {
    id: string;
    amount_refunded: number;
    paid: boolean;
    payment_method_details?: { type: string };
  };
  metadata?: { weeki_charge_id: string };
};
type Session = {
  id: string;
  status: string;
  url: string;
  amount_total: number;
  currency: string;
  payment_status: string;
  client_reference_id: string;
  payment_intent: Intent | null;
  livemode: boolean;
};
const methodMap: Record<PaymentMethod, string> = {
  pix: "pix",
  credit_card: "card",
  bank_slip: "boleto",
};
const statuses: Record<string, PaymentStatus> = {
  succeeded: "PAID",
  processing: "PROCESSING",
  requires_capture: "PROCESSING",
  requires_action: "PENDING",
  requires_payment_method: "FAILED",
  requires_confirmation: "PENDING",
  canceled: "CANCELED",
  expired: "CANCELED",
  open: "PENDING",
  paid: "PAID",
  unpaid: "PENDING",
};
export class StripeProvider extends ProviderBase implements PaymentProvider {
  id = "stripe" as const;
  authorizationUrl(state: string) {
    const url = new URL("https://connect.stripe.com/oauth/authorize");
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId!,
      scope: "read_write",
      redirect_uri: this.callback(this.id),
      state,
    }).toString();
    return url.href;
  }
  async exchangeCode(code: string): Promise<Credentials> {
    const t = await this.http<{
      access_token: string;
      stripe_user_id: string;
      livemode: boolean;
      scope: string;
    }>("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        client_secret: this.config.clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });
    if (
      !t.stripe_user_id ||
      t.scope !== "read_write" ||
      t.livemode !== (this.config.environment === "production")
    )
      throw new PaymentError("INVALID_CREDENTIAL", 409);
    return { accessToken: t.access_token }; // Used only to retrieve/verify account at connection time.
  }
  private api<T>(
    ctx: ProviderContext,
    path: string,
    method = "GET",
    body?: Record<string, unknown>,
    key?: string,
  ) {
    const account = ctx.connection.externalAccountId;
    if (!account) throw new PaymentError("DISCONNECTED", 409); // Never create a platform charge.
    return this.http<T>("https://api.stripe.com/v1" + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.clientSecret}`,
        "Stripe-Account": account,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(key ? { "Idempotency-Key": key } : {}),
        ...(process.env.STRIPE_API_VERSION
          ? { "Stripe-Version": process.env.STRIPE_API_VERSION }
          : {}),
      },
      body: body ? form(body) : undefined,
    });
  }
  async getConnectionStatus(ctx: ProviderContext) {
    const account = ctx.connection.externalAccountId
      ? await this.api<StripeAccount>(ctx, "/account")
      : await this.http<StripeAccount>("https://api.stripe.com/v1/account", {
          headers: { Authorization: `Bearer ${ctx.credentials.accessToken}` },
        });
    if (!account.charges_enabled)
      throw new PaymentError("ACCOUNT_BLOCKED", 409);
    const methods = Object.entries({
      credit_card: "card_payments",
      pix: "pix_payments",
      bank_slip: "boleto_payments",
    })
      .filter(([, cap]) => account.capabilities?.[cap] === "active")
      .map(([method]) => method as PaymentMethod);
    return {
      id: account.id,
      name: account.business_profile?.name || "Conta Stripe",
      email: account.email || "",
      capabilities: {
        methods,
        multipleMethods: true,
        cancel: true,
        refund: true,
        maxInstallments: 1,
        checkoutNotice:
          "O checkout Stripe fica disponível por até 24 horas. O vencimento da cobrança não prolonga a validade do link.",
      },
    };
  }
  async disconnectAccount(ctx: ProviderContext) {
    await this.http("https://connect.stripe.com/oauth/deauthorize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.clientSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({
        client_id: this.config.clientId,
        stripe_user_id: ctx.connection.externalAccountId,
      }),
    });
  }
  normalizeStatus(raw: string) {
    return statuses[raw] ?? this.unknownStatus();
  }
  private snapshot(s: Session): ChargeSnapshot {
    if (s.livemode !== (this.config.environment === "production"))
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
    const intent = s.payment_intent,
      refund = intent?.latest_charge?.amount_refunded || 0;
    const status =
      refund >= s.amount_total
        ? "REFUNDED"
        : refund > 0
          ? "PARTIALLY_REFUNDED"
          : s.payment_status === "paid"
            ? "PAID"
            : this.normalizeStatus(intent?.status || s.status);
    return {
      externalId: s.id,
      externalPaymentId: intent?.id,
      status,
      rawStatus: intent?.status || s.status,
      amountMinor: s.amount_total,
      refundedMinor: refund,
      currency: s.currency?.toUpperCase(),
      paymentUrl: hostedUrl(s.url, ["stripe.com"]),
      paidAt: null,
      paymentMethod: (
        { card: "credit_card", pix: "pix", boleto: "bank_slip" } as const
      )[intent?.latest_charge?.payment_method_details?.type as "card"],
    };
  }
  async createCharge(
    ctx: ProviderContext,
    input: NewCharge,
    customer: PaymentCustomer,
    id: string,
  ) {
    // Hosted sessions expire within 24h. Due date is the Weeki business due date, not a guarantee of session lifetime.
    const s = await this.api<Session>(
      ctx,
      "/checkout/sessions",
      "POST",
      {
        mode: "payment",
        client_reference_id: id,
        customer_email: customer.email,
        payment_method_types: input.methods.map((m) => methodMap[m]),
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: input.amountMinor,
              product_data: { name: input.description },
            },
            quantity: 1,
          },
        ],
        metadata: { weeki_charge_id: id },
        payment_intent_data: { metadata: { weeki_charge_id: id } },
        success_url: this.config.origin + "/?area=billing",
        cancel_url: this.config.origin + "/?area=billing",
        expand: ["payment_intent.latest_charge"],
      },
      id,
    );
    return this.snapshot(s);
  }
  async getCharge(ctx: ProviderContext, c: PaymentCharge) {
    const s = await this.api<Session>(
      ctx,
      `/checkout/sessions/${externalPath(c.externalId!)}?expand[]=payment_intent.latest_charge`,
    );
    if (s.client_reference_id !== c.id)
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
    return {
      ...this.snapshot(s),
      paymentUrl: hostedUrl(s.url, ["stripe.com"]) || c.paymentUrl,
    };
  }
  async findCharge(
    ctx: ProviderContext,
    reference: string,
  ): Promise<ChargeSnapshot | null> {
    // Recovery uses a bounded session listing; ambiguous results remain PROCESSING for operator reconciliation.
    const r = await this.api<{ data: Session[]; has_more: boolean }>(
      ctx,
      "/checkout/sessions?limit=100&expand[]=data.payment_intent.latest_charge",
    );
    const matches = r.data.filter((s) => s.client_reference_id === reference);
    if (matches.length > 1)
      throw new PaymentError("RECONCILIATION_REQUIRED", 409);
    return matches[0] ? this.snapshot(matches[0]) : null;
  }
  async cancelCharge(ctx: ProviderContext, c: PaymentCharge, key: string) {
    const s = await this.api<Session>(
      ctx,
      `/checkout/sessions/${externalPath(c.externalId!)}?expand[]=payment_intent.latest_charge`,
    );
    if (s.status === "open")
      await this.api(
        ctx,
        `/checkout/sessions/${externalPath(c.externalId!)}/expire`,
        "POST",
        {},
        key,
      );
    else if (s.payment_intent && s.payment_intent.status !== "succeeded")
      await this.api(
        ctx,
        `/payment_intents/${externalPath(s.payment_intent.id)}/cancel`,
        "POST",
        {},
        key,
      );
    else throw new PaymentError("UNSUPPORTED", 422);
  }
  async refundCharge(ctx: ProviderContext, c: PaymentCharge, key: string) {
    if (!c.externalPaymentId) throw new PaymentError("UNSUPPORTED", 422);
    await this.api(
      ctx,
      "/refunds",
      "POST",
      {
        payment_intent: c.externalPaymentId,
        amount: c.amountMinor - c.refundedMinor,
      },
      key,
    );
  }
  async createPaymentLink(ctx: ProviderContext, c: PaymentCharge) {
    return (await this.getCharge(ctx, c)).paymentUrl;
  }
  handleWebhook(input: WebhookInput): VerifiedEvent {
    const pairs = (input.headers["stripe-signature"] || "")
      .split(",")
      .map((p) => p.split("="));
    const ts = pairs.find(([k]) => k === "t")?.[1];
    if (
      !ts ||
      Math.abs(Date.now() / 1000 - Number(ts)) > 300 ||
      !/^\d+$/.test(ts)
    )
      throw new PaymentError("INVALID_WEBHOOK", 401);
    let valid = false;
    for (const [key, sig] of pairs) {
      if (key !== "v1") continue;
      try {
        verifyHmac(this.config.webhookSecret!, `${ts}.${input.raw}`, sig);
        valid = true;
      } catch {
        /* Key rotation may send multiple signatures. */
      }
    }
    if (!valid) throw new PaymentError("INVALID_WEBHOOK", 401);
    const e = JSON.parse(input.raw) as {
      id: string;
      type: string;
      account: string;
      livemode: boolean;
      data: {
        object: {
          id: string;
          client_reference_id?: string;
          metadata?: { weeki_charge_id?: string };
        };
      };
    };
    if (
      !e.id ||
      !e.account ||
      e.livemode !== (this.config.environment === "production")
    )
      throw new PaymentError("INVALID_WEBHOOK", 401);
    return {
      id: e.id,
      type: e.type,
      resourceId: e.data.object.id,
      accountId: e.account,
      reference:
        e.data.object.client_reference_id ||
        e.data.object.metadata?.weeki_charge_id,
      live: e.livemode,
    };
  }
  async resolveWebhook(ctx: ProviderContext, e: VerifiedEvent) {
    if (e.accountId !== ctx.connection.externalAccountId)
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
    if (e.type === "account.application.deauthorized") {
      await this.getConnectionStatus(ctx);
      return { reference: "" };
    }
    if (e.reference) return { reference: e.reference };
    if (e.resourceId.startsWith("ch_")) {
      const c = await this.api<{ payment_intent: string }>(
        ctx,
        `/charges/${externalPath(e.resourceId)}`,
      );
      const i = await this.api<Intent>(
        ctx,
        `/payment_intents/${externalPath(c.payment_intent)}`,
      );
      return { reference: i.metadata?.weeki_charge_id || "" };
    }
    return { reference: "" };
  }
}
