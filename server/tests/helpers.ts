import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Database, Sql } from "../db.js";
import { PaymentService } from "../payments/service.js";
import { ProviderRegistry } from "../payments/registry.js";
import { ProviderBase } from "../payments/providers/base.js";
import type {
  PaymentProvider,
  ChargeSnapshot,
  ProviderContext,
  Credentials,
  WebhookInput,
  VerifiedEvent,
} from "../payments/provider.js";
import type {
  ProviderId,
  NewCharge,
  PaymentCharge,
} from "../../shared/payments.js";
import { PaymentError } from "../payments/errors.js";
import { equal } from "../payments/crypto.js";
export const key = Buffer.alloc(32, 7);
export const config = {
  origin: "https://weeki.test",
  environment: "sandbox" as const,
  clientId: "app_test_only",
  clientSecret: "secret_test_only",
  webhookSecret: "signature_test_only",
};
export class FakeProvider extends ProviderBase implements PaymentProvider {
  records = new Map<string, ChargeSnapshot>();
  created = 0;
  refunded = 0;
  canceled = 0;
  exchanged = 0;
  revoked = 0;
  fail: PaymentError | null = null;
  refundFails = false;
  constructor(public id: ProviderId) {
    super(config);
  }
  authorizationUrl(state: string, verifier: string) {
    const url = new URL("https://oauth.example.test/authorize");
    url.search = new URLSearchParams({ state, challenge: verifier }).toString();
    return url.href;
  }
  async exchangeCode(code: string) {
    this.exchanged++;
    return { accessToken: code };
  }
  async refreshCredentials(c: Credentials) {
    if (c.accessToken === "expired")
      throw new PaymentError("RECONNECT_REQUIRED", 409);
    if (this.fail) throw this.fail;
    return c;
  }
  async getConnectionStatus(ctx: ProviderContext) {
    if (ctx.credentials.accessToken === "invalid")
      throw new PaymentError("INVALID_CREDENTIAL", 409);
    return {
      id: `acct_${ctx.credentials.accessToken!.split("-").slice(0, 2).join("_")}`,
      name: "Empresa de teste",
      email: "prestador@example.test",
      capabilities: {
        methods: ["pix", "credit_card", "bank_slip"] as const as (
          "pix" | "credit_card" | "bank_slip"
        )[],
        multipleMethods: true,
        cancel: true,
        refund: true,
        maxInstallments: 1,
      },
    };
  }
  async disconnectAccount() {
    this.revoked++;
  }
  normalizeStatus(raw: string) {
    return raw === "approved" ? ("PAID" as const) : ("PENDING" as const);
  }
  async createCharge(
    _ctx: ProviderContext,
    input: NewCharge,
    _customer: unknown,
    id: string,
  ) {
    if (this.fail) throw this.fail;
    this.created++;
    const snapshot: ChargeSnapshot = {
      externalId: `test_${id}`,
      amountMinor: input.amountMinor,
      currency: "BRL",
      status: "PENDING",
      rawStatus: "pending",
      refundedMinor: 0,
      paymentUrl: "https://checkout.example.test/pay",
      paidAt: null,
    };
    this.records.set(id, snapshot);
    return { ...snapshot };
  }
  async getCharge(_ctx: ProviderContext, c: PaymentCharge) {
    if (this.fail) throw this.fail;
    return { ...this.records.get(c.id)! };
  }
  async findCharge(_ctx: ProviderContext, id: string) {
    return this.records.get(id) || null;
  }
  async cancelCharge(_ctx: ProviderContext, c: PaymentCharge) {
    this.canceled++;
    this.records.get(c.id)!.status = "CANCELED";
  }
  async refundCharge(_ctx: ProviderContext, c: PaymentCharge) {
    this.refunded++;
    if (this.refundFails) throw new PaymentError("TIMEOUT", 503, true);
    Object.assign(this.records.get(c.id)!, {
      status: "REFUNDED",
      refundedMinor: c.amountMinor,
    });
  }
  async createPaymentLink(ctx: ProviderContext, c: PaymentCharge) {
    return (await this.getCharge(ctx, c)).paymentUrl;
  }
  handleWebhook(input: WebhookInput, credentials?: Credentials): VerifiedEvent {
    if (
      !credentials?.webhookSecret ||
      !equal(input.headers.signature || "", credentials.webhookSecret)
    )
      throw new PaymentError("INVALID_WEBHOOK", 401);
    return JSON.parse(input.raw);
  }
  async resolveWebhook(_ctx: ProviderContext, e: VerifiedEvent) {
    if (this.fail) throw this.fail;
    return { reference: e.reference || "" };
  }
}
export async function fixture() {
  const pg = new PGlite();
  await pg.exec(await readFile("server/migrations/001_payments.sql", "utf8"));
  const wrap = (sql: Pick<PGlite, "query">): Sql => ({
    query: async <T>(text: string, values?: unknown[]) => ({
      rows: (await sql.query(text, values)).rows as T[],
    }),
  });
  const db: Database = {
    ...wrap(pg),
    transaction: (fn) =>
      pg.transaction((tx) => fn(wrap(tx as unknown as PGlite))),
  };
  const a = { userId: randomUUID(), workspaceId: randomUUID() },
    b = { userId: randomUUID(), workspaceId: randomUUID() };
  for (const s of [a, b]) {
    await db.query(
      "INSERT INTO weeki_payments.users(id,issuer,subject) VALUES($1,'test',$2)",
      [s.userId, s.userId],
    );
    await db.query("INSERT INTO weeki_payments.workspaces(id) VALUES($1)", [
      s.workspaceId,
    ]);
    await db.query(
      "INSERT INTO weeki_payments.memberships(user_id,workspace_id,role) VALUES($1,$2,'owner')",
      [s.userId, s.workspaceId],
    );
  }
  const adapters = [
    new FakeProvider("asaas"),
    new FakeProvider("mercadopago"),
    new FakeProvider("stripe"),
  ];
  const service = new PaymentService(db, new ProviderRegistry(adapters), key);
  const customer = await service.saveCustomer(a, {
    localId: "local-client-1",
    name: "Cliente de teste",
    email: "cliente@example.test",
    document: "12345678909",
  });
  const input: NewCharge = {
    customerId: customer.id,
    description: "Serviço de teste",
    amountMinor: 85000,
    dueDate: "2099-09-15",
    methods: ["pix"],
  };
  const conn = await service.connect(a, "asaas", {
    accessToken: "account-a-secret",
  });
  return {
    pg,
    db,
    service,
    a,
    b,
    adapters,
    customer,
    input,
    conn,
    close: () => pg.close(),
  };
}
export type Fixture = Awaited<ReturnType<typeof fixture>>;
export async function event(
  f: Fixture,
  charge: PaymentCharge,
  eventId = randomUUID(),
  overrides: Partial<VerifiedEvent> = {},
) {
  const row = await f.db.query<{
    data: Parameters<PaymentService["credentials"]>[0];
  }>("SELECT data FROM weeki_payments.connections WHERE id=$1", [
    charge.connectionId,
  ]);
  return {
    raw: JSON.stringify({
      id: eventId,
      type: "payment.updated",
      resourceId: charge.externalId,
      reference: charge.id,
      live: false,
      ...overrides,
    }),
    headers: {
      signature: f.service.credentials(row.rows[0].data).webhookSecret!,
    },
    query: new URLSearchParams(),
  };
}
