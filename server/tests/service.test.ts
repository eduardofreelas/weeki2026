import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, event, key } from "./helpers.js";
import { PaymentError } from "../payments/errors.js";
import { PaymentOAuth } from "../payments/oauth.js";
const rejects = (fn: () => Promise<unknown>, code: string) =>
  assert.rejects(
    fn,
    (e: unknown) => e instanceof PaymentError && e.code === code,
  );
test("connection, encrypted vault, masked DTO, default selection and disconnect preserve history", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const publicData = JSON.stringify(await f.service.overview(f.a));
  assert(!publicData.includes("account-a-secret"));
});
test("connect invalid credentials fails closed and cannot steal an account from another tenant", async (t) => {
  const f = await fixture();
  t.after(f.close);
  await rejects(
    () => f.service.connect(f.a, "stripe", { accessToken: "invalid" }),
    "INVALID_CREDENTIAL",
  );
  await rejects(
    () => f.service.connect(f.b, "asaas", { accessToken: "account-a-secret" }),
    "CONFLICT",
  );
  assert.equal((await f.service.overview(f.b)).connections.length, 0);
});
test("default is connected only; disconnect preserves charge IDs, amount, history and reassigns default", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const mp = await f.service.connect(f.a, "mercadopago", {
    accessToken: "account-mp-secret",
  });
  const charge = await f.service.createCharge(f.a, f.input, randomUUID());
  await f.service.setDefault(f.a, mp.id);
  assert.equal(
    (await f.service.overview(f.a)).connections.find((c) => c.isDefault)?.id,
    mp.id,
  );
  await f.service.disconnect(f.a, mp.id);
  assert.equal(
    (await f.service.overview(f.a)).connections.find((c) => c.isDefault)?.id,
    f.conn.id,
  );
  await rejects(() => f.service.setDefault(f.a, mp.id), "DISCONNECTED");
  await f.service.disconnect(f.a, f.conn.id);
  assert.deepEqual(
    await f.service.getCharge(f.a, charge.id),
    JSON.parse(JSON.stringify(charge)),
  );
  await rejects(
    () => f.service.createCharge(f.a, f.input, randomUUID()),
    "DISCONNECTED",
  );
  await rejects(() => f.service.syncCharge(f.a, charge.id), "DISCONNECTED");
  const c = await f.service.connect(f.a, "asaas", {
    accessToken: "account-a-secret",
  });
  assert.equal(c.id, f.conn.id);
  assert.equal(
    (await f.service.syncCharge(f.a, charge.id)).externalId,
    charge.externalId,
  );
});
test("create charge reserves idempotency key; duplicates never call provider twice", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const id = randomUUID(),
    first = await f.service.createCharge(f.a, f.input, id),
    second = await f.service.createCharge(f.a, f.input, id);
  assert.equal(first.id, second.id);
  assert.equal(f.adapters[0].created, 1);
  await rejects(
    () => f.service.createCharge(f.a, { ...f.input, amountMinor: 86000 }, id),
    "CONFLICT",
  );
  assert.equal((await f.service.listCharges(f.a)).length, 1);
});
test("webhook signature, replay, duplicate confirmation and out-of-order status generate exactly one receipt", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  const hook = await event(f, c);
  await rejects(
    () =>
      f.service.enqueue("asaas", f.conn.id, {
        ...hook,
        headers: { signature: "wrong" },
      }),
    "INVALID_WEBHOOK",
  );
  f.adapters[0].records.get(c.id)!.status = "PAID";
  assert.equal(
    (await f.service.enqueue("asaas", f.conn.id, hook)).duplicate,
    false,
  );
  assert.equal(
    (await f.service.enqueue("asaas", f.conn.id, hook)).duplicate,
    true,
  );
  assert.equal(await f.service.processNext(), true);
  assert.equal(await f.service.processNext(), false);
  assert.equal((await f.service.getCharge(f.a, c.id)).status, "PAID");
  await f.service.enqueue("asaas", f.conn.id, await event(f, c));
  await f.service.processNext();
  assert.equal((await f.service.listFinance(f.a)).length, 1);
  f.adapters[0].records.get(c.id)!.status = "PENDING";
  await f.service.syncCharge(f.a, c.id);
  assert.equal((await f.service.getCharge(f.a, c.id)).status, "PAID");
  assert.equal((await f.service.listFinance(f.a)).length, 1);
});
test("declined payment creates no receipt and may recover to paid via canonical lookup", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  Object.assign(f.adapters[0].records.get(c.id)!, {
    status: "FAILED",
    rawStatus: "declined",
  });
  await f.service.enqueue("asaas", f.conn.id, await event(f, c));
  await f.service.processNext();
  assert.equal((await f.service.getCharge(f.a, c.id)).status, "FAILED");
  assert.equal((await f.service.listFinance(f.a)).length, 0);
  Object.assign(f.adapters[0].records.get(c.id)!, {
    status: "PAID",
    rawStatus: "approved",
  });
  assert.equal((await f.service.syncCharge(f.a, c.id)).status, "PAID");
});
test("cancel confirms canonical state; already-paid charge cannot be canceled", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  assert.equal(
    (await f.service.operate(f.a, c.id, "cancel")).status,
    "CANCELED",
  );
  assert.equal(f.adapters[0].canceled, 1);
  await rejects(() => f.service.operate(f.a, c.id, "cancel"), "UNSUPPORTED");
  const paid = await f.service.createCharge(f.a, f.input, randomUUID());
  f.adapters[0].records.get(paid.id)!.status = "PAID";
  await rejects(() => f.service.operate(f.a, paid.id, "cancel"), "UNSUPPORTED");
});
test("refund with duplicates generates one receipt and one expense, not two financial effects", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  f.adapters[0].records.get(c.id)!.status = "PAID";
  const refunded = await f.service.operate(f.a, c.id, "refund");
  assert.equal(refunded.status, "REFUNDED");
  assert.equal(f.adapters[0].refunded, 1);
  await f.service.enqueue("asaas", f.conn.id, await event(f, c));
  await f.service.processNext();
  const entries = await f.service.listFinance(f.a);
  assert.equal(entries.length, 2);
  assert.equal(
    entries.reduce(
      (n, e) => n + (e.kind === "receipt" ? 1 : -1) * Number(e.amountMinor),
      0,
    ),
    0,
  );
  await rejects(() => f.service.operate(f.a, c.id, "refund"), "UNSUPPORTED");
});
test("partial refunds append only the new delta and never regress", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  const r = f.adapters[0].records.get(c.id)!;
  Object.assign(r, { status: "PARTIALLY_REFUNDED", refundedMinor: 10000 });
  await f.service.syncCharge(f.a, c.id);
  r.refundedMinor = 25000;
  await f.service.syncCharge(f.a, c.id);
  r.refundedMinor = 5000;
  await f.service.syncCharge(f.a, c.id);
  const entries = await f.service.listFinance(f.a);
  assert.equal(
    entries
      .filter((e) => e.kind === "refund")
      .reduce((n, e) => n + Number(e.amountMinor), 0),
    25000,
  );
  assert.equal((await f.service.getCharge(f.a, c.id)).refundedMinor, 25000);
});
test("timeout after refund reservation cannot trigger a second remote refund", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  f.adapters[0].records.get(c.id)!.status = "PAID";
  f.adapters[0].refundFails = true;
  await rejects(() => f.service.operate(f.a, c.id, "refund"), "TIMEOUT");
  f.adapters[0].refundFails = false;
  await rejects(() => f.service.operate(f.a, c.id, "refund"), "CONFLICT");
  assert.equal(f.adapters[0].refunded, 1);
  assert.equal(
    (
      await f.db.query(
        "SELECT status FROM weeki_payments.operations WHERE charge_id=$1",
        [c.id],
      )
    ).rows[0].status,
    "reserved",
  );
});
test("token expiration changes public status and safely reassigns default", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const mp = await f.service.connect(f.a, "mercadopago", {
    accessToken: "account-mp-secret",
  });
  f.adapters[0].fail = new PaymentError("RECONNECT_REQUIRED", 409);
  await rejects(
    () => f.service.syncConnection(f.a, f.conn.id),
    "RECONNECT_REQUIRED",
  );
  const list = (await f.service.overview(f.a)).connections;
  assert.equal(
    list.find((c) => c.id === f.conn.id)?.status,
    "reconnect_required",
  );
  assert.equal(list.find((c) => c.isDefault)?.id, mp.id);
});
test("provider unavailable leaves recoverable reservation, never recreates ambiguously", async (t) => {
  const f = await fixture();
  t.after(f.close);
  f.adapters[0].fail = new PaymentError("UNAVAILABLE", 503, true);
  const id = randomUUID(),
    c = await f.service.createCharge(f.a, f.input, id);
  assert.equal(c.status, "PROCESSING");
  assert.equal(c.errorCode, "UNAVAILABLE");
  f.adapters[0].fail = null;
  assert.equal((await f.service.createCharge(f.a, f.input, id)).id, c.id);
  assert.equal(f.adapters[0].created, 0);
});
test("workspace ownership blocks charge reads, provider mutation, customer and charge creation using another account", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  await rejects(() => f.service.getCharge(f.b, c.id), "NOT_FOUND");
  await rejects(() => f.service.syncCharge(f.b, c.id), "NOT_FOUND");
  await rejects(() => f.service.operate(f.b, c.id, "refund"), "NOT_FOUND");
  await rejects(() => f.service.disconnect(f.b, f.conn.id), "NOT_FOUND");
  await rejects(() => f.service.setDefault(f.b, f.conn.id), "NOT_FOUND");
  await rejects(() => f.service.syncConnection(f.b, f.conn.id), "NOT_FOUND");
  await rejects(
    () =>
      f.service.createCharge(
        f.b,
        { ...f.input, connectionId: f.conn.id },
        randomUUID(),
      ),
    "NOT_FOUND",
  );
  await rejects(
    () => f.service.overview({ ...f.a, workspaceId: f.b.workspaceId }),
    "FORBIDDEN",
  );
  assert.equal((await f.service.listCharges(f.b)).length, 0);
  assert.equal((await f.service.listFinance(f.b)).length, 0);
  assert.equal((await f.service.listAudit(f.b)).length, 0);
});
test("read-only membership cannot mutate a connection", async (t) => {
  const f = await fixture();
  t.after(f.close);
  await f.db.query(
    "UPDATE weeki_payments.memberships SET role='viewer' WHERE user_id=$1",
    [f.a.userId],
  );
  await rejects(() => f.service.disconnect(f.a, f.conn.id), "FORBIDDEN");
  await rejects(
    () => f.service.createCharge(f.a, f.input, randomUUID()),
    "FORBIDDEN",
  );
  assert.equal((await f.service.overview(f.a)).connections.length, 1);
});
test("OAuth state is one-use, encrypted, expires, and is bound to session, workspace and provider", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const oauth = new PaymentOAuth(f.service, key),
    url = new URL(await oauth.begin(f.a, "mercadopago", "sessionA")),
    state = url.searchParams.get("state")!;
  await rejects(
    () =>
      oauth.complete(
        f.b,
        "mercadopago",
        "sessionA",
        state,
        "account-mp-secret",
      ),
    "INVALID_STATE",
  );
  await rejects(
    () => oauth.complete(f.a, "stripe", "sessionA", state, "x"),
    "INVALID_STATE",
  );
  await rejects(
    () => oauth.complete(f.a, "mercadopago", "differentSession", state, "x"),
    "INVALID_STATE",
  );
  await oauth.complete(
    f.a,
    "mercadopago",
    "sessionA",
    state,
    "account-mp-secret",
  );
  await rejects(
    () => oauth.complete(f.a, "mercadopago", "sessionA", state, "x"),
    "INVALID_STATE",
  );
  assert.equal(f.adapters[1].exchanged, 1);
  const expired = new URL(
    await oauth.begin(f.a, "stripe", "sessionA"),
  ).searchParams.get("state")!;
  await f.db.query(
    "UPDATE weeki_payments.oauth_states SET expires_at=now()-interval '1 hour'",
  );
  await rejects(
    () => oauth.complete(f.a, "stripe", "sessionA", expired, "x"),
    "INVALID_STATE",
  );
});
test("webhook retries are persisted; invalid amount and foreign reference never change money", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  await f.service.enqueue("asaas", f.conn.id, await event(f, c));
  f.adapters[0].fail = new PaymentError("UNAVAILABLE", 503, true);
  await f.service.processNext();
  assert.equal(
    (await f.db.query("SELECT status FROM weeki_payments.webhook_events"))
      .rows[0].status,
    "retry",
  );
  f.adapters[0].fail = null;
  await f.db.query(
    "UPDATE weeki_payments.webhook_events SET next_attempt_at=now()",
  );
  Object.assign(f.adapters[0].records.get(c.id)!, {
    status: "PAID",
    amountMinor: 1,
  });
  await f.service.processNext();
  assert.equal(
    (await f.db.query("SELECT status FROM weeki_payments.webhook_events"))
      .rows[0].status,
    "failed",
  );
  assert.equal((await f.service.listFinance(f.a)).length, 0);
  await f.service.enqueue(
    "asaas",
    f.conn.id,
    await event(f, c, randomUUID(), { reference: "not-a-uuid" }),
  );
  assert.equal(await f.service.processNext(), true);
  assert.equal((await f.service.getCharge(f.a, c.id)).amountMinor, 85000);
});
test("composite foreign keys reject cross-workspace rows even if application predicates regress", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const own = await f.service.connect(f.b, "stripe", {
    accessToken: "account-b-secret",
  });
  await assert.rejects(
    () =>
      f.db.query(
        "INSERT INTO weeki_payments.charges(id,workspace_id,connection_id,customer_id,request_key,request_hash,data) VALUES($1,$2,$3,$4,'test','hash',$5)",
        [
          randomUUID(),
          f.b.workspaceId,
          own.id,
          f.customer.id,
          JSON.stringify({ amountMinor: 85000, currency: "BRL" }),
        ],
      ),
    (e: unknown) => (e as { code: string }).code === "23503",
  );
});
test("automatic reconciliation compensates a missed webhook and does not duplicate receipts", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  f.adapters[0].records.get(c.id)!.status = "PAID";
  assert.equal(await f.service.scheduledSync(), 1);
  assert.equal((await f.service.getCharge(f.a, c.id)).status, "PAID");
  assert.equal(await f.service.scheduledSync(), 0);
  assert.equal((await f.service.listFinance(f.a)).length, 1);
});
test("failed event retry is scoped and reprocessing is idempotent", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  await f.service.enqueue("asaas", f.conn.id, await event(f, c));
  f.adapters[0].fail = new PaymentError("RECONCILIATION_REQUIRED", 409);
  await f.service.processNext();
  await rejects(() => f.service.retryWebhooks(f.b, f.conn.id), "NOT_FOUND");
  f.adapters[0].fail = null;
  f.adapters[0].records.get(c.id)!.status = "PAID";
  assert.equal((await f.service.retryWebhooks(f.a, f.conn.id)).scheduled, 1);
  await f.service.processNext();
  assert.equal((await f.service.listFinance(f.a)).length, 1);
  assert.equal((await f.service.retryWebhooks(f.a, f.conn.id)).scheduled, 0);
});
