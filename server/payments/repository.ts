import { randomUUID } from "node:crypto";
import type { Sql, Database } from "../db.js";
import type { Connection } from "./provider.js";
import type {
  PaymentCharge,
  PaymentCustomer,
  PaymentAudit,
  PaymentFinanceEntry,
} from "../../shared/payments.js";
import { PaymentError } from "./errors.js";
export interface Scope {
  userId: string;
  workspaceId: string;
}
export async function authorize(sql: Sql, scope: Scope, write = false) {
  const { rows } = await sql.query<{ role: string }>(
    "SELECT role FROM weeki_payments.memberships WHERE user_id=$1 AND workspace_id=$2",
    [scope.userId, scope.workspaceId],
  );
  if (!rows[0] || (write && !["owner", "admin"].includes(rows[0].role)))
    throw new PaymentError("FORBIDDEN", 403);
}
export async function workspaceLock(sql: Sql, workspaceId: string) {
  await sql.query(
    "SELECT id FROM weeki_payments.workspaces WHERE id=$1 FOR UPDATE",
    [workspaceId],
  );
}
export async function connection(
  sql: Sql,
  workspaceId: string,
  id: string,
): Promise<Connection> {
  const { rows } = await sql.query<{ data: Connection }>(
    "SELECT data FROM weeki_payments.connections WHERE workspace_id=$1 AND id=$2",
    [workspaceId, id],
  );
  if (!rows[0]) throw new PaymentError("NOT_FOUND", 404);
  return rows[0].data;
}
export async function connections(sql: Sql, workspaceId: string) {
  return (
    await sql.query<{ data: Connection }>(
      "SELECT data FROM weeki_payments.connections WHERE workspace_id=$1 ORDER BY id",
      [workspaceId],
    )
  ).rows.map((r) => r.data);
}
export async function saveConnection(sql: Sql, c: Connection) {
  await sql.query(
    "UPDATE weeki_payments.connections SET data=$3 WHERE workspace_id=$1 AND id=$2",
    [c.workspaceId, c.id, JSON.stringify(c)],
  );
}
export async function charge(
  sql: Sql,
  workspaceId: string,
  id: string,
): Promise<PaymentCharge> {
  const { rows } = await sql.query<{ data: PaymentCharge }>(
    "SELECT data FROM weeki_payments.charges WHERE workspace_id=$1 AND id=$2",
    [workspaceId, id],
  );
  if (!rows[0]) throw new PaymentError("NOT_FOUND", 404);
  return rows[0].data;
}
export async function saveCharge(
  sql: Sql,
  workspaceId: string,
  c: PaymentCharge,
) {
  await sql.query(
    "UPDATE weeki_payments.charges SET data=$3 WHERE workspace_id=$1 AND id=$2",
    [workspaceId, c.id, JSON.stringify(c)],
  );
}
export async function customer(sql: Sql, workspaceId: string, id: string) {
  const r = await sql.query<{ data: PaymentCustomer }>(
    "SELECT data FROM weeki_payments.customers WHERE workspace_id=$1 AND id=$2",
    [workspaceId, id],
  );
  if (!r.rows[0]) throw new PaymentError("NOT_FOUND", 404);
  return r.rows[0].data;
}
export async function audit(
  sql: Sql,
  workspaceId: string,
  data: Omit<PaymentAudit, "id" | "createdAt">,
) {
  const event = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await sql.query(
    "INSERT INTO weeki_payments.audit(id,workspace_id,data) VALUES($1,$2,$3)",
    [event.id, workspaceId, JSON.stringify(event)],
  );
}
export async function reconcile(
  sql: Sql,
  workspaceId: string,
  c: PaymentCharge,
) {
  const confirmed = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(
    c.status,
  );
  if (!confirmed) return;
  for (const [kind, total] of [
    ["receipt", c.amountMinor],
    ["refund", c.refundedMinor],
  ] as const) {
    if (!total) continue;
    const previous = await sql.query<{ amount: string }>(
      "SELECT COALESCE(MAX(total_minor),0)::text AS amount FROM weeki_payments.finance_entries WHERE charge_id=$1 AND workspace_id=$2 AND kind=$3",
      [c.id, workspaceId, kind],
    );
    const old = Number(previous.rows[0]?.amount || 0);
    if (total <= old) continue;
    const e: PaymentFinanceEntry = {
      id: randomUUID(),
      chargeId: c.id,
      customerId: c.customerId,
      customerName: c.customerName,
      description: c.description,
      kind,
      amountMinor: total - old,
      currency: "BRL",
      createdAt: new Date().toISOString(),
      provider: c.provider,
      paymentMethod: c.paymentMethod,
    };
    await sql.query(
      "INSERT INTO weeki_payments.finance_entries(id,workspace_id,charge_id,kind,total_minor,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [e.id, workspaceId, c.id, kind, total, JSON.stringify(e)],
    );
  }
}
export async function inWorkspace<T>(
  db: Database,
  scope: Scope,
  fn: (sql: Sql) => Promise<T>,
  write = true,
) {
  return db.transaction(async (sql) => {
    await authorize(sql, scope, write);
    await workspaceLock(sql, scope.workspaceId);
    return fn(sql);
  });
}
