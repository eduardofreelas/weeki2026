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
import { challenge, verifyHmac, hash } from "../crypto.js";
import { PaymentError } from "../errors.js";
import { externalPath, hostedUrl } from "../http.js";
type MP = {
  id: number;
  collector_id: number;
  status: string;
  transaction_amount: number;
  transaction_amount_refunded: number;
  currency_id: string;
  external_reference: string;
  date_approved: string;
  payment_type_id: string;
  live_mode: boolean;
};
type Preference = {
  items: { unit_price: number; quantity: number; currency_id: string }[];
  id: string;
  collector_id: number;
  external_reference: string;
  init_point: string;
  sandbox_init_point: string;
  expires?: boolean;
  expiration_date_to?: string;
};
const statusMap: Record<string, PaymentStatus> = {
  pending: "PENDING",
  approved: "PAID",
  authorized: "PROCESSING",
  in_process: "PROCESSING",
  in_mediation: "PROCESSING",
  rejected: "FAILED",
  cancelled: "CANCELED",
  refunded: "REFUNDED",
  charged_back: "PROCESSING", // Requires assisted chargeback reconciliation.
};
export class MercadoPagoProvider
  extends ProviderBase
  implements PaymentProvider
{
  id = "mercadopago" as const;
  authorizationUrl(state: string, verifier: string) {
    const url = new URL("https://auth.mercadopago.com/authorization");
    url.search = new URLSearchParams({
      client_id: this.config.clientId!,
      response_type: "code",
      platform_id: "mp",
      scope: "offline_access read write",
      redirect_uri: this.callback(this.id),
      state,
      code_challenge: challenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return url.href;
  }
  private async token(body: Record<string, unknown>): Promise<Credentials> {
    const t = await this.http<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      live_mode: boolean;
      scope: string;
    }>("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        ...body,
      }),
    });
    if (
      !t.access_token ||
      !t.refresh_token ||
      !Number.isFinite(t.expires_in) ||
      t.expires_in <= 0 ||
      t.live_mode !== (this.config.environment === "production") ||
      !["read", "write", "offline_access"].every((scope) =>
        t.scope?.split(" ").includes(scope),
      )
    )
      throw new PaymentError("INVALID_CREDENTIAL", 409);
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
    };
  }
  exchangeCode(code: string, verifier: string) {
    return this.token({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: this.callback(this.id),
      test_token: this.config.environment === "sandbox",
    });
  }
  async refreshCredentials(c: Credentials) {
    if (!c.expiresAt || c.expiresAt > Date.now() + 60000) return c;
    if (!c.refreshToken) throw new PaymentError("RECONNECT_REQUIRED", 409);
    try {
      return {
        ...c,
        ...(await this.token({
          grant_type: "refresh_token",
          refresh_token: c.refreshToken,
        })),
      };
    } catch (e) {
      if (e instanceof PaymentError && e.retryable) throw e;
      throw new PaymentError("RECONNECT_REQUIRED", 409);
    }
  }
  private api<T>(
    ctx: ProviderContext,
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ) {
    return this.http<T>("https://api.mercadopago.com" + path, {
      method,
      headers: {
        Authorization: `Bearer ${ctx.credentials.accessToken}`,
        "Content-Type": "application/json",
        ...(key ? { "X-Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async getConnectionStatus(ctx: ProviderContext) {
    const me = await this.api<{
      id: number;
      nickname: string;
      email: string;
      site_id: string;
      status: { site_status: string };
    }>(ctx, "/users/me");
    if (me.site_id !== "MLB" || me.status?.site_status !== "active")
      throw new PaymentError("ACCOUNT_BLOCKED", 409);
    const methods = await this.api<
      { id: string; payment_type_id: string; status: string }[]
    >(ctx, "/v1/payment_methods");
    const supported = new Set<PaymentMethod>();
    for (const m of methods.filter((m) => m.status === "active")) {
      if (m.id === "pix") supported.add("pix");
      if (m.payment_type_id === "credit_card") supported.add("credit_card");
      if (m.id === "bolbradesco") supported.add("bank_slip");
    }
    return {
      id: String(me.id),
      name: me.nickname,
      email: me.email || "",
      capabilities: {
        methods: [...supported],
        multipleMethods: true,
        cancel: true,
        refund: true,
        maxInstallments: 1,
        manualRevocation: true,
      },
    };
  }
  async disconnectAccount(): Promise<void> {
    /* Credentials are destroyed locally; merchant can also revoke the app in MP. */
  }
  normalizeStatus(raw: string) {
    return statusMap[raw] ?? this.unknownStatus();
  }
  private assertPayment(ctx: ProviderContext, p: MP, reference?: string) {
    if (
      String(p.collector_id) !== ctx.connection.externalAccountId ||
      (reference && p.external_reference !== reference) ||
      p.live_mode !== (this.config.environment === "production")
    )
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
  }
  private snapshot(
    p: MP,
    externalId: string,
    url: string | null,
  ): ChargeSnapshot {
    if (p.status === "charged_back")
      throw new PaymentError("RECONCILIATION_REQUIRED", 409);
    const amountMinor = Math.round(p.transaction_amount * 100),
      refundedMinor = Math.round((p.transaction_amount_refunded || 0) * 100);
    return {
      externalId,
      externalPaymentId: String(p.id),
      status:
        refundedMinor > 0 && refundedMinor < amountMinor
          ? "PARTIALLY_REFUNDED"
          : this.normalizeStatus(p.status),
      rawStatus: p.status,
      amountMinor,
      refundedMinor,
      currency: p.currency_id,
      paymentUrl: url,
      paidAt: p.date_approved || null,
      paymentMethod: (
        {
          credit_card: "credit_card",
          bank_transfer: "pix",
          ticket: "bank_slip",
        } as const
      )[p.payment_type_id as "credit_card"],
    };
  }
  async createCharge(
    ctx: ProviderContext,
    input: NewCharge,
    customer: PaymentCustomer,
    id: string,
  ) {
    const excluded = [
      "debit_card",
      "prepaid_card",
      "atm",
      "digital_currency",
      "digital_wallet",
      "account_money",
    ];
    if (!input.methods.includes("pix")) excluded.push("bank_transfer");
    if (!input.methods.includes("credit_card")) excluded.push("credit_card");
    if (!input.methods.includes("bank_slip")) excluded.push("ticket");
    const p = await this.api<Preference>(
      ctx,
      "/checkout/preferences",
      "POST",
      {
        items: [
          {
            id,
            title: input.description,
            quantity: 1,
            currency_id: "BRL",
            unit_price: input.amountMinor / 100,
          },
        ],
        payer: { email: customer.email, name: customer.name },
        external_reference: id,
        back_urls: {
          success: this.config.origin + "/?area=billing",
          pending: this.config.origin + "/?area=billing",
          failure: this.config.origin + "/?area=billing",
        },
        notification_url: `${this.config.origin}/webhooks/mercadopago/${ctx.connection.id}`,
        expires: true,
        expiration_date_to: `${input.dueDate}T23:59:59-03:00`,
        payment_methods: {
          excluded_payment_types: excluded.map((id) => ({ id })),
          installments: 1,
        },
      },
      id,
    );
    if (String(p.collector_id) !== ctx.connection.externalAccountId)
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
    return {
      externalId: p.id,
      status: "PENDING" as const,
      rawStatus: "preference_created",
      amountMinor: input.amountMinor,
      refundedMinor: 0,
      currency: "BRL",
      paymentUrl: hostedUrl(
        this.config.environment === "sandbox"
          ? p.sandbox_init_point
          : p.init_point,
        ["mercadopago.com.br", "mercadopago.com"],
      ),
      paidAt: null,
    };
  }
  async getCharge(ctx: ProviderContext, c: PaymentCharge) {
    const pref = await this.api<Preference>(
      ctx,
      `/checkout/preferences/${externalPath(c.externalId!)}`,
    );
    if (
      String(pref.collector_id) !== ctx.connection.externalAccountId ||
      pref.external_reference !== c.id
    )
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
    const result = await this.api<{ results: MP[]; paging: { total: number } }>(
      ctx,
      `/v1/payments/search?external_reference=${externalPath(c.id)}&sort=date_created&criteria=desc&limit=100`,
    );
    if (result.paging?.total > result.results.length)
      throw new PaymentError("RECONCILIATION_REQUIRED", 409);
    for (const p of result.results) this.assertPayment(ctx, p, c.id);
    if (
      result.results.filter((p) =>
        ["approved", "refunded", "charged_back"].includes(p.status),
      ).length > 1
    )
      throw new PaymentError("RECONCILIATION_REQUIRED", 409);
    const p =
      result.results.find((p) =>
        ["approved", "refunded", "charged_back"].includes(p.status),
      ) || result.results[0];
    if (p) return this.snapshot(p, c.externalId!, c.paymentUrl);
    const expired =
      pref.expires &&
      pref.expiration_date_to &&
      Date.parse(pref.expiration_date_to) < Date.now();
    return {
      externalId: c.externalId!,
      status: expired ? ("CANCELED" as const) : ("PENDING" as const),
      rawStatus: expired ? "preference_expired" : "preference_created",
      amountMinor: c.amountMinor,
      refundedMinor: 0,
      currency: "BRL",
      paymentUrl: c.paymentUrl,
      paidAt: null,
    };
  }
  async findCharge(
    ctx: ProviderContext,
    reference: string,
  ): Promise<ChargeSnapshot | null> {
    const result = await this.api<{
      elements: { id: string }[];
      total: number;
    }>(
      ctx,
      `/checkout/preferences/search?external_reference=${externalPath(reference)}&limit=2`,
    );
    if (result.total > 1)
      throw new PaymentError("RECONCILIATION_REQUIRED", 409);
    if (!result.elements[0]) return null;
    const pref = await this.api<Preference>(
      ctx,
      `/checkout/preferences/${externalPath(result.elements[0].id)}`,
    );
    if (
      String(pref.collector_id) !== ctx.connection.externalAccountId ||
      pref.external_reference !== reference ||
      !pref.items?.length ||
      pref.items.some((i) => i.currency_id !== "BRL")
    )
      throw new PaymentError("OWNERSHIP_MISMATCH", 409);
    return {
      externalId: pref.id,
      status: "PENDING",
      rawStatus: "preference_recovered",
      amountMinor: Math.round(
        pref.items.reduce((n, i) => n + i.unit_price * i.quantity, 0) * 100,
      ),
      refundedMinor: 0,
      currency: "BRL",
      paymentUrl: hostedUrl(
        this.config.environment === "sandbox"
          ? pref.sandbox_init_point
          : pref.init_point,
        ["mercadopago.com.br", "mercadopago.com"],
      ),
      paidAt: null,
    };
  }
  async cancelCharge(ctx: ProviderContext, c: PaymentCharge, key: string) {
    await this.api(
      ctx,
      `/checkout/preferences/${externalPath(c.externalId!)}`,
      "PUT",
      {
        expires: true,
        expiration_date_to: new Date(Date.now() - 60000).toISOString(),
      },
    );
    if (c.externalPaymentId)
      await this.api(
        ctx,
        `/v1/payments/${externalPath(c.externalPaymentId)}`,
        "PUT",
        { status: "cancelled" },
        key,
      );
  }
  async refundCharge(ctx: ProviderContext, c: PaymentCharge, key: string) {
    if (!c.externalPaymentId) throw new PaymentError("UNSUPPORTED", 422);
    await this.api(
      ctx,
      `/v1/payments/${externalPath(c.externalPaymentId)}/refunds`,
      "POST",
      { amount: (c.amountMinor - c.refundedMinor) / 100 },
      key,
    );
  }
  async createPaymentLink(ctx: ProviderContext, c: PaymentCharge) {
    return (await this.getCharge(ctx, c)).paymentUrl;
  }
  handleWebhook(input: WebhookInput): VerifiedEvent {
    const parts = Object.fromEntries(
      (input.headers["x-signature"] || "")
        .split(",")
        .map((p) => p.trim().split("=")),
    );
    const id = input.query.get("data.id")?.toLowerCase(),
      requestId = input.headers["x-request-id"];
    if (!id || !requestId || !parts.ts || !/^\d+$/.test(parts.ts))
      throw new PaymentError("INVALID_WEBHOOK", 401);
    const timestamp =
      Number(parts.ts) > 1e12 ? Number(parts.ts) : Number(parts.ts) * 1000;
    if (Math.abs(Date.now() - timestamp) > 300000)
      throw new PaymentError("INVALID_WEBHOOK", 401);
    verifyHmac(
      this.config.webhookSecret!,
      `id:${id};request-id:${requestId};ts:${parts.ts};`,
      parts.v1 || "",
    );
    // MP signs query resource id, not body. Dedup uses the signed envelope and ignores untrusted body IDs/account/status.
    return {
      id: hash(`${id}:${requestId}:${parts.ts}`),
      type: "payment.updated",
      resourceId: id,
      live: this.config.environment === "production",
    };
  }
  async resolveWebhook(ctx: ProviderContext, e: VerifiedEvent) {
    const p = await this.api<MP>(
      ctx,
      `/v1/payments/${externalPath(e.resourceId)}`,
    );
    this.assertPayment(ctx, p);
    return { reference: p.external_reference };
  }
}
