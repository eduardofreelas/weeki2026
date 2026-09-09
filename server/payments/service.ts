import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "../db.js";
import type {
  PaymentCharge,
  PaymentCustomer,
  PaymentFinanceEntry,
  PaymentAudit,
  ProviderId,
  PublicConnection,
  PaymentsOverview,
} from "../../shared/payments.js";
import type {
  Connection,
  Credentials,
  ProviderContext,
  ChargeSnapshot,
  VerifiedEvent,
  WebhookInput,
} from "./provider.js";
import { ProviderRegistry } from "./registry.js";
import { PaymentError, errorCode } from "./errors.js";
import { seal, unseal, hash, randomToken, maskEmail } from "./crypto.js";
import * as repo from "./repository.js";
import type { Scope } from "./repository.js";
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
  );
export const chargeInput = z
  .object({
    connectionId: z.string().uuid().optional(),
    customerId: z.string().uuid(),
    description: z.string().trim().min(1).max(500),
    amountMinor: z.number().int().positive().max(99999999),
    dueDate: isoDate,
    methods: z
      .array(z.enum(["pix", "credit_card", "bank_slip"]))
      .min(1)
      .max(3),
  })
  .strict();
const customerInput = z
  .object({
    localId: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    email: z.string().email().max(254),
    document: z.string().regex(/^(?:\d{11}|\d{14})?$/),
  })
  .strict();
function publicConnection(c: Connection): PublicConnection {
  const {
    id,
    provider,
    environment,
    externalAccountId,
    accountName,
    maskedEmail,
    status,
    isDefault,
    connectedAt,
    lastSyncAt,
    capabilities,
    errorCode,
  } = c;
  return {
    id,
    provider,
    environment,
    externalAccountId,
    accountName,
    maskedEmail,
    status,
    isDefault,
    connectedAt,
    lastSyncAt,
    capabilities,
    errorCode,
  };
}
const noCapabilities = {
  methods: [],
  multipleMethods: false,
  cancel: false,
  refund: false,
  maxInstallments: 1,
};
export class PaymentService {
  constructor(
    public db: Database,
    public registry: ProviderRegistry,
    private encryptionKey: Buffer,
  ) {}
  private aad(c: Connection) {
    return `${c.workspaceId}:${c.id}`;
  }
  credentials(c: Connection): Credentials {
    return unseal(c.encryptedCredentials, this.encryptionKey, this.aad(c));
  }
  private encrypt(c: Connection, value: Credentials) {
    c.encryptedCredentials = seal(value, this.encryptionKey, this.aad(c));
  }
  async overview(scope: Scope): Promise<PaymentsOverview> {
    await repo.authorize(this.db, scope);
    const environment = this.registry.list()[0].config.environment;
    return {
      workspaceId: scope.workspaceId,
      environment,
      connections: (await repo.connections(this.db, scope.workspaceId))
        .filter((c) => c.environment === environment)
        .map(publicConnection),
      providers: this.registry.list().map((p) => ({
        id: p.id,
        configured: p.configured(),
        connectionMode: p.connectionMode,
      })),
    };
  }
  async listCharges(scope: Scope, offset = 0) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000)
      throw new PaymentError("INVALID_INPUT", 422);
    await repo.authorize(this.db, scope);
    return (
      await this.db.query<{ data: PaymentCharge }>(
        "SELECT ch.data FROM weeki_payments.charges ch JOIN weeki_payments.connections co ON co.id=ch.connection_id WHERE ch.workspace_id=$1 AND co.data->>'environment'=$2 ORDER BY ch.data->>'createdAt' DESC,ch.id DESC LIMIT 100 OFFSET $3",
        [scope.workspaceId, this.registry.list()[0].config.environment, offset],
      )
    ).rows.map((r) => r.data);
  }
  async getCharge(scope: Scope, id: string) {
    await repo.authorize(this.db, scope);
    return repo.charge(this.db, scope.workspaceId, id);
  }
  async listFinance(scope: Scope, offset = 0) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000)
      throw new PaymentError("INVALID_INPUT", 422);
    await repo.authorize(this.db, scope);
    return (
      await this.db.query<{ data: PaymentFinanceEntry }>(
        "SELECT f.data FROM weeki_payments.finance_entries f JOIN weeki_payments.charges ch ON ch.id=f.charge_id JOIN weeki_payments.connections co ON co.id=ch.connection_id WHERE f.workspace_id=$1 AND co.data->>'environment'=$2 ORDER BY f.data->>'createdAt' DESC,f.id DESC LIMIT 100 OFFSET $3",
        [scope.workspaceId, this.registry.list()[0].config.environment, offset],
      )
    ).rows.map((r) => r.data);
  }
  async listAudit(scope: Scope) {
    await repo.authorize(this.db, scope);
    return (
      await this.db.query<{ data: PaymentAudit }>(
        "SELECT data FROM weeki_payments.audit WHERE workspace_id=$1 ORDER BY data->>'createdAt' DESC LIMIT 100",
        [scope.workspaceId],
      )
    ).rows.map((r) => r.data);
  }
  async saveCustomer(scope: Scope, input: unknown): Promise<PaymentCustomer> {
    const parsed = customerInput.safeParse(input);
    if (!parsed.success) throw new PaymentError("INVALID_INPUT", 422);
    return repo.inWorkspace(this.db, scope, async (sql) => {
      const old = await sql.query<{ id: string }>(
        "SELECT id FROM weeki_payments.customers WHERE workspace_id=$1 AND local_id=$2",
        [scope.workspaceId, parsed.data.localId],
      );
      const c = { ...parsed.data, id: old.rows[0]?.id || randomUUID() };
      await sql.query(
        "INSERT INTO weeki_payments.customers(id,workspace_id,local_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,local_id) DO UPDATE SET data=excluded.data",
        [c.id, scope.workspaceId, c.localId, JSON.stringify(c)],
      );
      return c;
    });
  }
  private async defaults(sql: Sql, workspaceId: string, preferred?: string) {
    const all = (await repo.connections(sql, workspaceId)).filter(
      (c) => c.environment === this.registry.list()[0].config.environment,
    );
    const selected =
      all.find((c) => c.id === preferred && c.status === "connected") ||
      all.find((c) => c.isDefault && c.status === "connected") ||
      all.find((c) => c.status === "connected");
    for (const c of all.filter((c) => c.isDefault)) {
      c.isDefault = false;
      await repo.saveConnection(sql, c);
    }
    if (selected) {
      selected.isDefault = true;
      await repo.saveConnection(sql, selected);
    }
  }
  async setDefault(scope: Scope, id: string) {
    return repo.inWorkspace(this.db, scope, async (sql) => {
      const c = await repo.connection(sql, scope.workspaceId, id);
      if (
        c.status !== "connected" ||
        c.environment !== this.registry.get(c.provider).config.environment
      )
        throw new PaymentError("DISCONNECTED", 409);
      await this.defaults(sql, scope.workspaceId, id);
      await repo.audit(sql, scope.workspaceId, {
        action: "provider.default",
        connectionId: id,
      });
    });
  }
  // Used only by server provisioning command / authenticated OAuth callback, never by a public credentials endpoint.
  async connect(
    scope: Scope,
    providerId: ProviderId,
    credentials: Credentials,
  ) {
    return repo.inWorkspace(this.db, scope, async (sql) => {
      const provider = this.registry.get(providerId);
      if (!provider.configured()) throw new PaymentError("NOT_CONFIGURED", 503);
      const temporary: Connection = {
        id: randomUUID(),
        workspaceId: scope.workspaceId,
        provider: providerId,
        environment: provider.config.environment,
        externalAccountId: "",
        accountName: "",
        maskedEmail: "",
        status: "disconnected",
        isDefault: false,
        connectedAt: "",
        lastSyncAt: null,
        capabilities: noCapabilities,
        encryptedCredentials: "",
      };
      const account = await provider.connectAccount({
        connection: temporary,
        credentials,
      });
      if (
        typeof account.id !== "string" ||
        !account.id ||
        account.id.length > 200
      )
        throw new PaymentError("INVALID_CREDENTIAL", 409);
      const all = await repo.connections(sql, scope.workspaceId);
      const c =
        all.find(
          (c) =>
            c.provider === providerId &&
            c.environment === provider.config.environment &&
            c.externalAccountId === account.id,
        ) || temporary;
      if (
        all.some(
          (a) =>
            a.id !== c.id &&
            a.provider === providerId &&
            a.status === "connected" &&
            a.environment === c.environment,
        )
      )
        throw new PaymentError("CONFLICT", 409);
      // Check global unique account before remote setup: prevents account reuse across tenants.
      const other = await sql.query<{ workspace_id: string }>(
        "SELECT workspace_id FROM weeki_payments.connections WHERE data->>'provider'=$1 AND data->>'environment'=$2 AND data->>'externalAccountId'=$3",
        [providerId, c.environment, account.id],
      );
      if (other.rows.some((r) => r.workspace_id !== scope.workspaceId))
        throw new PaymentError("CONFLICT", 409);
      Object.assign(c, {
        externalAccountId: account.id,
        accountName: account.name,
        maskedEmail: maskEmail(account.email),
        capabilities: account.capabilities,
        status: "connected",
        connectedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        errorCode: undefined,
      });
      credentials = {
        ...credentials,
        webhookSecret: credentials.webhookSecret || randomToken(),
      };
      const prepared = await provider.prepareWebhook({
        connection: c,
        credentials,
      });
      this.encrypt(c, prepared);
      await sql.query(
        "INSERT INTO weeki_payments.connections(id,workspace_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        [c.id, scope.workspaceId, JSON.stringify(c)],
      );
      await this.defaults(sql, scope.workspaceId);
      await repo.audit(sql, scope.workspaceId, {
        action: "provider.connected",
        connectionId: c.id,
      });
      return publicConnection(c);
    });
  }
  private async context(sql: Sql, c: Connection): Promise<ProviderContext> {
    if (
      c.status !== "connected" ||
      c.environment !== this.registry.get(c.provider).config.environment
    )
      throw new PaymentError("DISCONNECTED", 409);
    const adapter = this.registry.get(c.provider);
    let credentials = this.credentials(c);
    credentials = await adapter.refreshCredentials(credentials);
    this.encrypt(c, credentials);
    await repo.saveConnection(sql, c);
    return { connection: c, credentials };
  }
  private async safeOperation<T>(
    scope: Scope,
    connectionId: string,
    fn: (sql: Sql, ctx: ProviderContext) => Promise<T>,
  ): Promise<T> {
    const result = await repo.inWorkspace(this.db, scope, async (sql) => {
      const c = await repo.connection(sql, scope.workspaceId, connectionId);
      try {
        const ctx = await this.context(sql, c);
        return { value: await fn(sql, ctx) };
      } catch (e) {
        if (!(e instanceof PaymentError)) throw e;
        if (
          [
            "RECONNECT_REQUIRED",
            "INVALID_CREDENTIAL",
            "ACCOUNT_BLOCKED",
          ].includes(e.code)
        ) {
          c.status = "reconnect_required";
          c.errorCode = e.code;
          c.isDefault = false;
          await repo.saveConnection(sql, c);
          await this.defaults(sql, scope.workspaceId);
        }
        await repo.audit(sql, scope.workspaceId, {
          action: "integration.failed",
          connectionId,
          errorCode: e.code,
        });
        return { error: e };
      }
    });
    if (result.error) throw result.error;
    return result.value as T;
  }
  async syncConnection(scope: Scope, id: string) {
    return this.safeOperation(scope, id, async (sql, ctx) => {
      const a = await this.registry
        .get(ctx.connection.provider)
        .getConnectionStatus(ctx);
      if (a.id !== ctx.connection.externalAccountId)
        throw new PaymentError("OWNERSHIP_MISMATCH", 409);
      Object.assign(ctx.connection, {
        accountName: a.name,
        maskedEmail: maskEmail(a.email),
        capabilities: a.capabilities,
        lastSyncAt: new Date().toISOString(),
        errorCode: undefined,
      });
      await repo.saveConnection(sql, ctx.connection);
      return publicConnection(ctx.connection);
    });
  }
  async disconnect(scope: Scope, id: string) {
    return repo.inWorkspace(this.db, scope, async (sql) => {
      const c = await repo.connection(sql, scope.workspaceId, id);
      if (c.status === "disconnected") return;
      let warning: string | undefined;
      try {
        await this.registry.get(c.provider).disconnectAccount({
          connection: c,
          credentials: this.credentials(c),
        });
      } catch (e) {
        warning = errorCode(e);
      }
      c.status = "disconnected";
      c.isDefault = false;
      this.encrypt(c, {});
      await repo.saveConnection(sql, c);
      await this.defaults(sql, scope.workspaceId);
      await repo.audit(sql, scope.workspaceId, {
        action: "provider.disconnected",
        connectionId: id,
        errorCode: warning,
      });
      return {
        revocationPending:
          Boolean(warning) || Boolean(c.capabilities.manualRevocation),
      };
    });
  }
  async createCharge(
    scope: Scope,
    input: unknown,
    key: string,
  ): Promise<PaymentCharge> {
    const parsed = chargeInput.safeParse(input);
    if (!parsed.success || !z.string().uuid().safeParse(key).success)
      throw new PaymentError("INVALID_INPUT", 422);
    const data = parsed.data,
      requestHash = hash(JSON.stringify(data));
    const reservation = await repo.inWorkspace(this.db, scope, async (sql) => {
      const prior = await sql.query<{
        data: PaymentCharge;
        request_hash: string;
      }>(
        "SELECT data,request_hash FROM weeki_payments.charges WHERE workspace_id=$1 AND request_key=$2",
        [scope.workspaceId, key],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].request_hash !== requestHash)
          throw new PaymentError("CONFLICT", 409);
        return { charge: prior.rows[0].data, existing: true };
      }
      const all = await repo.connections(sql, scope.workspaceId),
        c = data.connectionId
          ? await repo.connection(sql, scope.workspaceId, data.connectionId)
          : all.find(
              (c) =>
                c.isDefault &&
                c.environment === this.registry.list()[0].config.environment,
            );
      if (!c || c.status !== "connected")
        throw new PaymentError("DISCONNECTED", 409);
      if (c.environment !== this.registry.get(c.provider).config.environment)
        throw new PaymentError("DISCONNECTED", 409);
      if (
        data.methods.some((m) => !c.capabilities.methods.includes(m)) ||
        (!c.capabilities.multipleMethods && data.methods.length !== 1)
      )
        throw new PaymentError("METHOD_UNAVAILABLE", 422);
      if (data.dueDate < new Date().toISOString().slice(0, 10))
        throw new PaymentError("INVALID_INPUT", 422);
      const cust = await repo.customer(sql, scope.workspaceId, data.customerId);
      if (c.capabilities.requiresDocument && !cust.document)
        throw new PaymentError("INVALID_INPUT", 422);
      const charge: PaymentCharge = {
        id: randomUUID(),
        connectionId: c.id,
        provider: c.provider,
        externalId: null,
        customerId: cust.id,
        customerName: cust.name,
        description: data.description,
        amountMinor: data.amountMinor,
        currency: "BRL",
        status: "PROCESSING",
        providerStatus: "creation_reserved",
        methods: data.methods,
        dueDate: data.dueDate,
        paymentUrl: null,
        createdAt: new Date().toISOString(),
        paidAt: null,
        refundedMinor: 0,
        lastSyncAt: null,
      };
      await sql.query(
        "INSERT INTO weeki_payments.charges(id,workspace_id,connection_id,customer_id,request_key,request_hash,data) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          charge.id,
          scope.workspaceId,
          c.id,
          cust.id,
          key,
          requestHash,
          JSON.stringify(charge),
        ],
      );
      return { charge, existing: false };
    });
    if (reservation.existing) return reservation.charge;
    try {
      return await this.safeOperation(
        scope,
        reservation.charge.connectionId,
        async (sql, ctx) => {
          const customer = await repo.customer(
            sql,
            scope.workspaceId,
            data.customerId,
          );
          const snapshot = await this.registry
            .get(ctx.connection.provider)
            .createCharge(ctx, data, customer, reservation.charge.id);
          const charge = await this.applySnapshot(
            sql,
            scope.workspaceId,
            reservation.charge,
            snapshot,
          );
          await repo.audit(sql, scope.workspaceId, {
            action: "charge.created",
            chargeId: charge.id,
            connectionId: ctx.connection.id,
          });
          return charge;
        },
      );
    } catch (e) {
      const pending = await repo.inWorkspace(this.db, scope, async (sql) => {
        const c = await repo.charge(
          sql,
          scope.workspaceId,
          reservation.charge.id,
        );
        c.errorCode = errorCode(e);
        await repo.saveCharge(sql, scope.workspaceId, c);
        return c;
      });
      if (!(e instanceof PaymentError)) throw e;
      return pending;
    }
  }
  private async applySnapshot(
    sql: Sql,
    workspaceId: string,
    c: PaymentCharge,
    s: ChargeSnapshot,
  ) {
    if (
      s.amountMinor !== c.amountMinor ||
      s.currency !== c.currency ||
      (c.externalId && s.externalId !== c.externalId)
    )
      throw new PaymentError("AMOUNT_MISMATCH", 409);
    if (
      !Number.isSafeInteger(s.refundedMinor) ||
      s.refundedMinor < 0 ||
      s.refundedMinor > c.amountMinor
    )
      throw new PaymentError("AMOUNT_MISMATCH", 409);
    const previous = c.status;
    // Canonical lookup can lag a prior confirmation. Never regress confirmed/refunded money.
    let status = s.status;
    if (
      status === "PENDING" &&
      c.dueDate < new Date().toISOString().slice(0, 10)
    )
      status = "OVERDUE";
    if (
      ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(previous) &&
      !["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status)
    )
      status = previous;
    const refundedMinor = Math.max(c.refundedMinor, s.refundedMinor);
    if (refundedMinor === c.amountMinor) status = "REFUNDED";
    else if (refundedMinor > 0) status = "PARTIALLY_REFUNDED";
    Object.assign(c, {
      externalId: s.externalId,
      externalPaymentId: s.externalPaymentId || c.externalPaymentId,
      status,
      providerStatus: s.rawStatus,
      paymentUrl: s.paymentUrl || c.paymentUrl,
      paymentMethod: s.paymentMethod || c.paymentMethod,
      paidAt:
        c.paidAt ||
        s.paidAt ||
        (["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status)
          ? new Date().toISOString()
          : null),
      refundedMinor,
      lastSyncAt: new Date().toISOString(),
      errorCode: undefined,
    });
    await repo.saveCharge(sql, workspaceId, c);
    await repo.reconcile(sql, workspaceId, c);
    if (previous !== status)
      await repo.audit(sql, workspaceId, {
        action: `charge.${status.toLowerCase()}`,
        chargeId: c.id,
        connectionId: c.connectionId,
      });
    return c;
  }
  async syncCharge(scope: Scope, id: string) {
    const c = await this.getCharge(scope, id);
    return this.safeOperation(scope, c.connectionId, async (sql, ctx) => {
      const current = await repo.charge(sql, scope.workspaceId, id);
      const p = this.registry.get(current.provider);
      const snapshot = current.externalId
        ? await p.getCharge(ctx, current)
        : await p.findCharge(ctx, current.id);
      if (!snapshot) throw new PaymentError("RECONCILIATION_REQUIRED", 409);
      return this.applySnapshot(sql, scope.workspaceId, current, snapshot);
    });
  }
  async operate(scope: Scope, id: string, kind: "cancel" | "refund") {
    const charge = await this.getCharge(scope, id),
      opKey = hash(`${id}:${kind}`);
    // Commit the unique reservation BEFORE a non-idempotent remote call. A crash or
    // timeout leaves an uncertain operation for reconciliation, never a second refund.
    await this.safeOperation(scope, charge.connectionId, async (sql, ctx) => {
      const current = await repo.charge(sql, scope.workspaceId, id),
        p = this.registry.get(current.provider);
      if (!current.externalId)
        throw new PaymentError("RECONCILIATION_REQUIRED", 409);
      await this.applySnapshot(
        sql,
        scope.workspaceId,
        current,
        await p.getCharge(ctx, current),
      );
      const allowed =
        kind === "refund"
          ? ["PAID", "PARTIALLY_REFUNDED"]
          : ["PENDING", "OVERDUE", "FAILED", "PROCESSING"];
      if (
        !allowed.includes(current.status) ||
        !ctx.connection.capabilities[kind]
      )
        throw new PaymentError("UNSUPPORTED", 422);
      const old = await sql.query(
        "SELECT status FROM weeki_payments.operations WHERE charge_id=$1 AND kind=$2",
        [id, kind],
      );
      if (old.rows[0]) throw new PaymentError("CONFLICT", 409);
      await sql.query(
        "INSERT INTO weeki_payments.operations(charge_id,kind,operation_key,status) VALUES($1,$2,$3,'reserved')",
        [id, kind, opKey],
      );
      await repo.audit(sql, scope.workspaceId, {
        action: `charge.${kind}_reserved`,
        chargeId: id,
        connectionId: charge.connectionId,
      });
    });
    return this.safeOperation(scope, charge.connectionId, async (sql, ctx) => {
      const current = await repo.charge(sql, scope.workspaceId, id),
        p = this.registry.get(current.provider);
      // Recheck status/ownership after the reservation; cancellation may race a payment.
      await this.applySnapshot(
        sql,
        scope.workspaceId,
        current,
        await p.getCharge(ctx, current),
      );
      if (
        kind === "refund" &&
        !["PAID", "PARTIALLY_REFUNDED"].includes(current.status)
      )
        throw new PaymentError("UNSUPPORTED", 422);
      if (
        kind === "cancel" &&
        ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(current.status)
      )
        throw new PaymentError("UNSUPPORTED", 422);
      try {
        if (kind === "refund") await p.refundCharge(ctx, current, opKey);
        else await p.cancelCharge(ctx, current, opKey);
        await sql.query(
          "UPDATE weeki_payments.operations SET status='submitted' WHERE charge_id=$1 AND kind=$2",
          [id, kind],
        );
        await repo.audit(sql, scope.workspaceId, {
          action: `charge.${kind}_requested`,
          chargeId: id,
          connectionId: charge.connectionId,
        });
      } catch (e) {
        if (!(e instanceof PaymentError)) throw e;
        await repo.audit(sql, scope.workspaceId, {
          action: `charge.${kind}_uncertain`,
          chargeId: id,
          errorCode: e.code,
        });
        throw e;
      }
      return this.applySnapshot(
        sql,
        scope.workspaceId,
        current,
        await p.getCharge(ctx, current),
      );
    });
  }
  async retryWebhooks(scope: Scope, id: string) {
    return repo.inWorkspace(this.db, scope, async (sql) => {
      const c = await repo.connection(sql, scope.workspaceId, id);
      if (c.status !== "connected") throw new PaymentError("DISCONNECTED", 409);
      const r = await sql.query(
        "UPDATE weeki_payments.webhook_events SET status='retry',attempts=0,next_attempt_at=now(),error_code=NULL WHERE connection_id=$1 AND status='failed' RETURNING id",
        [id],
      );
      await repo.audit(sql, scope.workspaceId, {
        action: "webhook.retry_requested",
        connectionId: id,
      });
      return { scheduled: r.rows.length };
    });
  }
  async scheduledSync() {
    // Lease rows before network access; multiple server instances can poll safely.
    const jobs = await this.db.transaction(async (sql) => {
      const result = await sql.query<{
        id: string;
        workspace_id: string;
        user_id: string;
      }>(
        `SELECT ch.id,ch.workspace_id,owner.user_id
        FROM weeki_payments.charges ch JOIN weeki_payments.connections co ON co.id=ch.connection_id
        JOIN LATERAL (SELECT user_id FROM weeki_payments.memberships WHERE workspace_id=ch.workspace_id AND role IN ('owner','admin') ORDER BY user_id LIMIT 1) owner ON true
        WHERE ch.sync_after<=now() AND co.data->>'status'='connected' AND co.data->>'environment'=$1
        AND ch.data->>'status'<>'REFUNDED' AND (ch.data->>'createdAt')::timestamptz>now()-interval '90 days'
        ORDER BY ch.sync_after FOR UPDATE OF ch SKIP LOCKED LIMIT 5`,
        [this.registry.list()[0].config.environment],
      );
      for (const job of result.rows)
        await sql.query(
          "UPDATE weeki_payments.charges SET sync_after=now()+interval '15 minutes' WHERE id=$1",
          [job.id],
        );
      return result.rows;
    });
    for (const job of jobs) {
      try {
        await this.syncCharge(
          { userId: job.user_id, workspaceId: job.workspace_id },
          job.id,
        );
      } catch {
        /* safeOperation records redacted failures. Never retry creates or refunds here. */
      }
    }
    await this.db.query(
      "DELETE FROM weeki_payments.oauth_states WHERE expires_at<now()",
    );
    await this.db.query(
      "DELETE FROM weeki_payments.sessions WHERE expires_at<now()",
    );
    return jobs.length;
  }
  async enqueue(
    providerId: ProviderId,
    connectionId: string,
    input: WebhookInput,
  ) {
    const r = await this.db.query<{ data: Connection }>(
      "SELECT data FROM weeki_payments.connections WHERE id=$1",
      [connectionId],
    );
    const c = r.rows[0]?.data;
    if (
      !c ||
      c.provider !== providerId ||
      c.environment !== this.registry.get(providerId).config.environment
    )
      throw new PaymentError("INVALID_WEBHOOK", 401);
    const p = this.registry.get(providerId),
      event = p.handleWebhook(input, this.credentials(c));
    if (event.accountId && event.accountId !== c.externalAccountId)
      throw new PaymentError("INVALID_WEBHOOK", 401);
    const result = await this.db.query(
      "INSERT INTO weeki_payments.webhook_events(id,connection_id,provider,external_id,event_type,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(connection_id,external_id) DO NOTHING RETURNING id",
      [
        randomUUID(),
        c.id,
        providerId,
        event.id,
        event.type,
        JSON.stringify(event),
      ],
    );
    return { accepted: true, duplicate: result.rows.length === 0 };
  }
  async processNext(): Promise<boolean> {
    // Single transaction owns event + workspace lock + financial changes. Crash rolls back all effects.
    return this.db.transaction(async (sql) => {
      const jobs = await sql.query<{
        id: string;
        connection_id: string;
        data: VerifiedEvent;
        attempts: number;
      }>(
        "SELECT id,connection_id,data,attempts FROM weeki_payments.webhook_events WHERE status IN ('pending','retry') AND next_attempt_at<=now() ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1",
      );
      const job = jobs.rows[0];
      if (!job) return false;
      const record = await sql.query<{ workspace_id: string }>(
        "SELECT workspace_id FROM weeki_payments.connections WHERE id=$1",
        [job.connection_id],
      );
      const workspaceId = record.rows[0].workspace_id;
      await repo.workspaceLock(sql, workspaceId);
      const c = await repo.connection(sql, workspaceId, job.connection_id);
      try {
        if (c.status !== "connected") {
          await sql.query(
            "UPDATE weeki_payments.webhook_events SET status='ignored',processed_at=now(),error_code='DISCONNECTED' WHERE id=$1",
            [job.id],
          );
          return true;
        }
        const ctx = await this.context(sql, c),
          p = this.registry.get(c.provider);
        const resolved = await p.resolveWebhook(ctx, job.data);
        if (
          resolved.reference &&
          z.string().uuid().safeParse(resolved.reference).success
        ) {
          const local = await sql.query<{ data: PaymentCharge }>(
            "SELECT data FROM weeki_payments.charges WHERE id=$1 AND workspace_id=$2 AND connection_id=$3",
            [resolved.reference, workspaceId, c.id],
          );
          if (local.rows[0]) {
            const charge = local.rows[0].data;
            const snapshot =
              resolved.snapshot ||
              (charge.externalId
                ? await p.getCharge(ctx, charge)
                : await p.findCharge(ctx, charge.id));
            if (!snapshot)
              throw new PaymentError("RECONCILIATION_REQUIRED", 409);
            await this.applySnapshot(sql, workspaceId, charge, snapshot);
          }
        }
        await sql.query(
          "UPDATE weeki_payments.webhook_events SET status='processed',processed_at=now(),attempts=attempts+1,error_code=NULL WHERE id=$1",
          [job.id],
        );
        c.lastSyncAt = new Date().toISOString();
        await repo.saveConnection(sql, c);
        await repo.audit(sql, workspaceId, {
          action: "webhook.processed",
          connectionId: c.id,
        });
      } catch (e) {
        if (!(e instanceof PaymentError)) throw e;
        const retry = e.retryable && job.attempts < 7;
        await sql.query(
          "UPDATE weeki_payments.webhook_events SET status=$2,attempts=attempts+1,error_code=$3,next_attempt_at=$4 WHERE id=$1",
          [
            job.id,
            retry ? "retry" : "failed",
            e.code,
            new Date(Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts)),
          ],
        );
        if (e.code === "RECONNECT_REQUIRED") {
          c.status = "reconnect_required";
          c.isDefault = false;
          c.errorCode = e.code;
          await repo.saveConnection(sql, c);
          await this.defaults(sql, workspaceId);
        }
        await repo.audit(sql, workspaceId, {
          action: "webhook.failed",
          connectionId: c.id,
          errorCode: e.code,
        });
      }
      return true;
    });
  }
}
