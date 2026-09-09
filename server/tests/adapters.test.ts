import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { StripeProvider } from "../payments/providers/stripe.js";
import { MercadoPagoProvider } from "../payments/providers/mercadopago.js";
import { AsaasProvider } from "../payments/providers/asaas.js";
import type { ProviderContext, Connection } from "../payments/provider.js";
import type {
  PaymentCharge,
  NewCharge,
  PaymentCustomer,
} from "../../shared/payments.js";
import { hostedUrl, request, type Transport } from "../payments/http.js";
import { PaymentError } from "../payments/errors.js";
import { seal, unseal } from "../payments/crypto.js";
import { config, key } from "./helpers.js";
const localId = randomUUID();
const ctx: ProviderContext = {
  connection: {
    id: randomUUID(),
    workspaceId: randomUUID(),
    externalAccountId: "acct_connected_test",
  } as Connection,
  credentials: {
    accessToken: "test_merchant_token",
    webhookSecret: "test_asaas_webhook",
  },
};
const customer: PaymentCustomer = {
  id: randomUUID(),
  localId: "local",
  name: "Test Customer",
  email: "buyer@example.test",
  document: "12345678909",
};
const input: NewCharge = {
  customerId: customer.id,
  description: "Test",
  amountMinor: 85000,
  dueDate: "2099-09-15",
  methods: ["credit_card"],
};
const charge: PaymentCharge = {
  id: localId,
  externalId: "cs_test_checkout",
  externalPaymentId: "pi_test",
  connectionId: ctx.connection.id,
  provider: "stripe",
  customerId: customer.id,
  customerName: customer.name,
  description: input.description,
  amountMinor: 85000,
  currency: "BRL",
  status: "PENDING",
  providerStatus: "open",
  methods: input.methods,
  dueDate: input.dueDate,
  createdAt: new Date().toISOString(),
  paidAt: null,
  refundedMinor: 0,
  paymentUrl: null,
  lastSyncAt: null,
};
const transport =
  (fn: (url: string, init: RequestInit) => unknown): Transport =>
  async <T>(url: string, init: RequestInit = {}) =>
    fn(url, init) as T;
const expectCode = (code: string) => (e: unknown) =>
  e instanceof PaymentError && e.code === code;
test("AES-GCM vault is authenticated to the workspace and connection, ciphertext tampering fails", () => {
  const encrypted = seal(
    { accessToken: "test-secret-never-public" },
    key,
    "workspace1:connection1",
  );
  assert(!encrypted.includes("test-secret"));
  assert.equal(
    unseal<{ accessToken: string }>(encrypted, key, "workspace1:connection1")
      .accessToken,
    "test-secret-never-public",
  );
  assert.throws(() => unseal(encrypted, key, "workspace2:connection1"));
  const parts = encrypted.split(".");
  parts[parts.length - 1] =
    (parts.at(-1)![0] === "A" ? "B" : "A") + parts.at(-1)!.slice(1);
  assert.throws(() => unseal(parts.join("."), key, "workspace1:connection1"));
});
test("Stripe Connect direct Checkout uses connected header and integer amount, no transfers/custody/card fields", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const p = new StripeProvider(
    config,
    transport((url, init) => {
      calls.push({ url, init });
      return {
        id: "cs_test_checkout",
        client_reference_id: localId,
        status: "open",
        payment_status: "unpaid",
        payment_intent: null,
        amount_total: 85000,
        currency: "brl",
        url: "https://checkout.stripe.com/c/pay/test",
        livemode: false,
      };
    }),
  );
  const result = await p.createCharge(ctx, input, customer, localId);
  assert.equal(result.status, "PENDING");
  assert.equal(
    (calls[0].init.headers as Record<string, string>)["Stripe-Account"],
    "acct_connected_test",
  );
  const body = calls[0].init.body as URLSearchParams;
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "85000");
  assert.equal(
    body.get("payment_intent_data[metadata][weeki_charge_id]"),
    localId,
  );
  assert(!body.toString().includes("transfer_data"));
  assert(!body.toString().includes("card%5Bnumber"));
  await assert.rejects(
    () =>
      p.createCharge(
        { ...ctx, connection: { ...ctx.connection, externalAccountId: "" } },
        input,
        customer,
        localId,
      ),
    expectCode("DISCONNECTED"),
  );
});
test("Stripe canonical lookup rejects a charge belonging to another reference or live mode", async () => {
  const p = new StripeProvider(
    config,
    transport(() => ({
      id: "cs_test_checkout",
      client_reference_id: "foreign",
      livemode: false,
    })),
  );
  await assert.rejects(
    () => p.getCharge(ctx, charge),
    expectCode("OWNERSHIP_MISMATCH"),
  );
  const live = new StripeProvider(
    config,
    transport(() => ({
      id: "cs_test_checkout",
      client_reference_id: localId,
      livemode: true,
    })),
  );
  await assert.rejects(
    () => live.getCharge(ctx, charge),
    expectCode("OWNERSHIP_MISMATCH"),
  );
});
test("Stripe signature uses exact raw bytes, supports rotation and rejects stale/wrong/accountless events", () => {
  const p = new StripeProvider(config);
  const ts = String(Math.floor(Date.now() / 1000)),
    raw = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      account: "acct_connected_test",
      livemode: false,
      data: { object: { id: "cs_test", client_reference_id: localId } },
    });
  const signature = createHmac("sha256", config.webhookSecret)
    .update(`${ts}.${raw}`)
    .digest("hex");
  const input = {
    raw,
    headers: {
      "stripe-signature": `t=${ts},v1=${"0".repeat(64)},v1=${signature}`,
    },
    query: new URLSearchParams(),
  };
  assert.equal(p.handleWebhook(input).accountId, "acct_connected_test");
  assert.throws(
    () => p.handleWebhook({ ...input, raw: raw + " " }),
    expectCode("INVALID_WEBHOOK"),
  );
  assert.throws(
    () =>
      p.handleWebhook({
        ...input,
        headers: { "stripe-signature": `t=1,v1=${signature}` },
      }),
    expectCode("INVALID_WEBHOOK"),
  );
});
test("Mercado Pago PKCE authorization and token exchange keep secrets out of URL; refresh preserves webhook secret", async () => {
  let sent: Record<string, unknown> = {};
  const p = new MercadoPagoProvider(
    config,
    transport((_url, init) => {
      sent = JSON.parse(String(init.body));
      return {
        access_token: "test_new",
        refresh_token: "test_refresh",
        expires_in: 3600,
        live_mode: false,
        scope: "read write offline_access",
      };
    }),
  );
  const url = new URL(p.authorizationUrl("state_test", "v".repeat(43)));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), "state_test");
  assert(!url.href.includes(config.clientSecret));
  await p.exchangeCode("test_auth_code", "v".repeat(43));
  assert.equal(sent.test_token, true);
  assert.equal(sent.code_verifier, "v".repeat(43));
  const refreshed = await p.refreshCredentials({
    accessToken: "old",
    refreshToken: "refresh_old",
    expiresAt: 1,
    webhookSecret: "hook",
  });
  assert.equal(refreshed.accessToken, "test_new");
  assert.equal(refreshed.webhookSecret, "hook");
});
test("Mercado Pago invalid refresh requires reconnect; an outage does not revoke a valid authorization", async () => {
  const p = new MercadoPagoProvider(
    config,
    transport(() => {
      throw new PaymentError("INVALID_INPUT", 422);
    }),
  );
  await assert.rejects(
    () => p.refreshCredentials({ refreshToken: "test", expiresAt: 1 }),
    expectCode("RECONNECT_REQUIRED"),
  );
  const outage = new MercadoPagoProvider(
    config,
    transport(() => {
      throw new PaymentError("UNAVAILABLE", 503, true);
    }),
  );
  await assert.rejects(
    () => outage.refreshCredentials({ refreshToken: "test", expiresAt: 1 }),
    expectCode("UNAVAILABLE"),
  );
});
test("Mercado Pago signature binds signed query and request id, untrusted body cannot choose merchant/charge/status", () => {
  const p = new MercadoPagoProvider(config),
    ts = String(Date.now()),
    resource = "123",
    requestId = "request_test";
  const signature = createHmac("sha256", config.webhookSecret)
    .update(`id:${resource};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  const input = {
    raw: '{"id":"untrusted","user_id":"foreign","status":"approved"}',
    headers: {
      "x-signature": `ts=${ts},v1=${signature}`,
      "x-request-id": requestId,
    },
    query: new URLSearchParams({ "data.id": resource }),
  };
  const event = p.handleWebhook(input);
  assert.equal(event.resourceId, resource);
  assert.equal(event.reference, undefined);
  assert.notEqual(event.id, "untrusted");
  assert.throws(
    () =>
      p.handleWebhook({
        ...input,
        query: new URLSearchParams({ "data.id": "456" }),
      }),
    expectCode("INVALID_WEBHOOK"),
  );
});
test("Mercado Pago checkout uses merchant OAuth token and only requested method types; no marketplace fee", async () => {
  let body: Record<string, unknown> = {},
    headers: Record<string, string> = {};
  const p = new MercadoPagoProvider(
    config,
    transport((_url, init) => {
      body = JSON.parse(String(init.body));
      headers = init.headers as Record<string, string>;
      return {
        id: "pref_test",
        collector_id: 123,
        sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/test",
      };
    }),
  );
  const result = await p.createCharge(
    { ...ctx, connection: { ...ctx.connection, externalAccountId: "123" } },
    { ...input, methods: ["pix"] },
    customer,
    localId,
  );
  assert.equal(result.externalId, "pref_test");
  assert.equal(headers.Authorization, "Bearer test_merchant_token");
  assert.equal(body.external_reference, localId);
  assert.equal(body.marketplace_fee, undefined);
  assert(
    (
      body.payment_methods as { excluded_payment_types: { id: string }[] }
    ).excluded_payment_types.some((m) => m.id === "credit_card"),
  );
});
test("Mercado Pago canonical payment rejects foreign collector and unexpected amount handled by service", async () => {
  const p = new MercadoPagoProvider(
    config,
    transport(() => ({
      collector_id: 999,
      live_mode: false,
      external_reference: localId,
    })),
  );
  await assert.rejects(
    () =>
      p.resolveWebhook(
        { ...ctx, connection: { ...ctx.connection, externalAccountId: "123" } },
        {
          id: "event",
          type: "payment.updated",
          resourceId: "123",
          live: false,
        },
      ),
    expectCode("OWNERSHIP_MISMATCH"),
  );
});
test("Asaas authenticated identity uses official wallets endpoint and commercial profile", async () => {
  const urls: string[] = [];
  const p = new AsaasProvider(
    config,
    transport((url, init) => {
      urls.push(url);
      assert.equal(
        (init.headers as Record<string, string>).access_token,
        "test_merchant_token",
      );
      return url.endsWith("/wallets/")
        ? { data: [{ id: "wallet_test" }] }
        : { name: "Empresa", email: "merchant@example.test" };
    }),
  );
  assert.equal((await p.connectAccount(ctx)).id, "wallet_test");
  assert(
    urls.every((url) => url.startsWith("https://api-sandbox.asaas.com/v3/")),
  );
});
test("Asaas token authentication and canonical status normalization preserve external identifier and value", async () => {
  const p = new AsaasProvider(
    config,
    transport(() => ({
      id: "pay_legacy",
      externalReference: localId,
      status: "CONFIRMED",
      value: 850,
      invoiceUrl: "https://sandbox.asaas.com/i/test",
      billingType: "PIX",
    })),
  );
  const result = await p.getCharge(ctx, {
    ...charge,
    externalId: "pay_legacy",
  });
  assert.equal(result.externalId, "pay_legacy");
  assert.equal(result.amountMinor, 85000);
  assert.equal(result.status, "PAID");
  const input = {
    raw: JSON.stringify({
      id: "evt_test",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_legacy" },
    }),
    headers: { "asaas-access-token": "test_asaas_webhook" },
    query: new URLSearchParams(),
  };
  assert.equal(p.handleWebhook(input, ctx.credentials).id, "evt_test");
  assert.throws(
    () => p.handleWebhook({ ...input, headers: {} }, ctx.credentials),
    expectCode("INVALID_WEBHOOK"),
  );
});
test("all adapters normalize success, failure and refund without external states leaking to UI", () => {
  const a = new AsaasProvider(config),
    m = new MercadoPagoProvider(config),
    s = new StripeProvider(config);
  assert.equal(a.normalizeStatus("CONFIRMED"), "PAID");
  assert.equal(m.normalizeStatus("approved"), "PAID");
  assert.equal(s.normalizeStatus("succeeded"), "PAID");
  assert.equal(a.normalizeStatus("CREDIT_CARD_CAPTURE_REFUSED"), "FAILED");
  assert.equal(m.normalizeStatus("rejected"), "FAILED");
  assert.equal(s.normalizeStatus("requires_payment_method"), "FAILED");
  assert.equal(a.normalizeStatus("REFUNDED"), "REFUNDED");
  assert.equal(m.normalizeStatus("refunded"), "REFUNDED");
  assert.equal(s.normalizeStatus("new_unknown_value"), "PROCESSING");
});
test("hosted checkout URL validation rejects javascript, plaintext HTTP and lookalike domains", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://checkout.stripe.com/a",
    "https://stripe.com.evil.test/a",
    "https://evilstripe.com/a",
  ])
    assert.equal(hostedUrl(url, ["stripe.com"]), null);
  assert.equal(
    hostedUrl("https://checkout.stripe.com/a", ["stripe.com"]),
    "https://checkout.stripe.com/a",
  );
});
test("transport retries only safe reads and redacts provider error responses", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response('{"secret":"never expose provider body"}', {
      status: 503,
    });
  });
  await assert.rejects(
    () => request("https://test.invalid", { method: "POST" }),
    (e: unknown) =>
      expectCode("UNAVAILABLE")(e) && !String(e).includes("never expose"),
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    () => request("https://test.invalid"),
    expectCode("UNAVAILABLE"),
  );
  assert.equal(calls, 3);
});
test("Mercado Pago fails closed if sandbox OAuth returns a live credential", async () => {
  const p = new MercadoPagoProvider(
    config,
    transport(() => ({
      access_token: "test-placeholder",
      refresh_token: "test-placeholder",
      expires_in: 3600,
      live_mode: true,
      scope: "read write offline_access",
    })),
  );
  await assert.rejects(
    () => p.exchangeCode("test-code", "v".repeat(43)),
    expectCode("INVALID_CREDENTIAL"),
  );
});
