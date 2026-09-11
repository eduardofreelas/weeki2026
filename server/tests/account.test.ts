import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fixture, key } from "./helpers.js";
import { AccountService } from "../account/service.js";
import { accountApi } from "../account/api.js";
import { SessionAuth } from "../auth.js";
import { hash, randomToken } from "../payments/crypto.js";
import { createDefaultAvailability } from "../../shared/availability.js";

test("availability is validated, persisted and isolated by workspace", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const service = new AccountService(f.db);
  const valid = createDefaultAvailability("America/Fortaleza");
  valid.weekly["1"].enabled = true;
  valid.weekly["2"].enabled = true;

  const saved = await service.saveAvailability(f.a, valid);
  assert(saved.configuredAt);
  assert.equal(saved.weekly["1"].periods.length, 2);
  assert.equal(saved.weekly["2"].periods.length, 2);

  const other = await service.availability(f.b);
  assert.equal(other.configuredAt, null);
  assert.equal(other.weekly["1"].enabled, false);

  const invalid = createDefaultAvailability("America/Fortaleza");
  invalid.weekly["1"].enabled = true;
  invalid.weekly["1"].periods = [
    { id: "a", start: "09:00", end: "12:00" },
    { id: "b", start: "11:00", end: "13:00" },
  ];
  await assert.rejects(() => service.saveAvailability(f.a, invalid), { code: "INVALID_INPUT", status: 422 });
});

test("onboarding and profile changes persist without trusting browser workspace", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const service = new AccountService(f.db);

  const profile = await service.updateProfile(f.a, {
    name: "Ana Souza",
    professionalName: "Ana Souza Consultoria",
    businessName: "Ana Strategy",
    businessArea: "Consultoria",
    workspaceName: "Ana Workspace",
    timezone: "America/Sao_Paulo",
  });
  assert.equal(profile.name, "Ana Souza");
  assert.equal(profile.businessName, "Ana Strategy");
  assert.equal(profile.workspaceName, "Ana Workspace");

  const onboarding = await service.updateOnboarding(f.a, {
    status: "skipped",
    step: "availability",
    completedSteps: ["work", "space"],
  });
  assert.equal(onboarding.status, "skipped");
  assert.deepEqual(onboarding.completedSteps, ["work", "space"]);
});

test("account HTTP API requires authenticated session and same-origin writes", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const previousEnv = {
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
  };
  process.env.OIDC_ISSUER = "https://issuer.example.test";
  process.env.OIDC_CLIENT_ID = "client";
  process.env.OIDC_CLIENT_SECRET = "secret";
  t.after(() => {
    process.env.OIDC_ISSUER = previousEnv.issuer;
    process.env.OIDC_CLIENT_ID = previousEnv.clientId;
    process.env.OIDC_CLIENT_SECRET = previousEnv.clientSecret;
  });

  const token = randomToken();
  await f.db.query(
    "INSERT INTO weeki_payments.sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [hash(token), f.a.userId, f.a.workspaceId],
  );

  let origin = "";
  const service = new AccountService(f.db);
  const server = createServer((req, res) =>
    void accountApi(service, new SessionAuth(f.db, origin, key), origin)(req, res),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));

  assert.equal((await fetch(origin + "/api/account/session")).status, 401);
  const session = await fetch(origin + "/api/account/session", { headers: { Cookie: `weeki_session=${token}` } });
  assert.equal(session.status, 200);
  assert.equal((await session.text()).includes(f.b.workspaceId), false);

  const availability = createDefaultAvailability("America/Fortaleza");
  availability.weekly["1"].enabled = true;
  const blocked = await fetch(origin + "/api/account/availability", {
    method: "PATCH",
    headers: {
      Cookie: `weeki_session=${token}`,
      Origin: "https://attacker.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...availability, workspaceId: f.b.workspaceId }),
  });
  assert.equal(blocked.status, 403);

  const saved = await fetch(origin + "/api/account/availability", {
    method: "PATCH",
    headers: {
      Cookie: `weeki_session=${token}`,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...availability, workspaceId: randomUUID() }),
  });
  assert.equal(saved.status, 200);
});
