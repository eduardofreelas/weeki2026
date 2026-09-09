import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fixture, key } from "./helpers.js";
import { paymentApi } from "../api.js";
import { SessionAuth } from "../auth.js";
import { hash, randomToken } from "../payments/crypto.js";
test("HTTP API trusts authenticated session, never posted workspace; rejects CSRF and foreign resources", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const token = randomToken();
  await f.db.query(
    "INSERT INTO weeki_payments.sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [hash(token), f.a.userId, f.a.workspaceId],
  );
  let origin = "";
  const server = createServer(
    (req, res) =>
      void paymentApi(
        f.service,
        new SessionAuth(f.db, origin, key),
        origin,
        key,
      )(req, res),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  );
  const fetchApi = (path: string, init: RequestInit = {}) =>
    fetch(origin + "/api/payments" + path, {
      ...init,
      headers: {
        Cookie: `weeki_session=${token}`,
        Origin: origin,
        ...init.headers,
      },
    });
  assert.equal((await fetch(origin + "/api/payments/connections")).status, 401);
  const overview = await (await fetchApi("/connections")).text();
  assert(!overview.includes("account-a-secret"));
  assert(!overview.includes("encryptedCredentials"));
  assert(!overview.includes("webhookSecret"));
  assert.equal(
    (
      await fetchApi(`/connections/${f.conn.id}/disconnect`, {
        method: "POST",
        headers: { Origin: "https://attacker.invalid" },
      })
    ).status,
    403,
  );
  const foreign = await f.service.connect(f.b, "stripe", {
    accessToken: "account-b-secret",
  });
  assert.equal(
    (await fetchApi(`/connections/${foreign.id}/default`, { method: "POST" }))
      .status,
    404,
  );
  const c = await f.service.createCharge(f.a, f.input, randomUUID());
  assert.equal((await fetchApi(`/charges/${c.id}`)).status, 200);
  assert.equal(
    (
      await fetchApi("/charges", {
        method: "POST",
        headers: {
          "Idempotency-Key": randomUUID(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...f.input, workspaceId: f.b.workspaceId }),
      })
    ).status,
    422,
  );
  assert.equal(
    (await fetchApi("/auth/logout", { method: "POST" })).status,
    200,
  );
  assert.equal((await fetchApi("/connections")).status, 401);
});
