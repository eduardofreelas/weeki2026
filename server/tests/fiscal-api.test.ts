import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionAuth } from "../auth.js";
import { hash, randomToken } from "../payments/crypto.js";
import { UnconfiguredCertificateSecretStore } from "../fiscal/certificate-store.js";
import { StandbyDpsCodec } from "../fiscal/dps.js";
import { fiscalApi } from "../fiscal/api.js";
import { NationalNfseProvider } from "../fiscal/providers/national-nfse.js";
import { FiscalService } from "../fiscal/service.js";
import { fixture, key } from "./helpers.js";

test("fiscal HTTP routes require a session and CSRF origin without exposing certificate references", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const token = randomToken();
  await f.db.query(
    "INSERT INTO weeki_payments.sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [hash(token), f.a.userId, f.a.workspaceId],
  );
  await f.db.query(
    "INSERT INTO weeki_fiscal.certificates(id,workspace_id,secret_reference,metadata) VALUES($1,$2,$3,$4)",
    [
      randomUUID(),
      f.a.workspaceId,
      "kms://must-never-leave-server",
      JSON.stringify({
        id: randomUUID(),
        name: "certificate.pfx",
        holderName: "Empresa Teste",
        holderDocument: "11222333000181",
        validFrom: "2026-01-01T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        status: "active",
        updatedAt: new Date().toISOString(),
      }),
    ],
  );
  const provider = new NationalNfseProvider(
    { enabled: false, environment: "sandbox" },
    new UnconfiguredCertificateSecretStore(),
    new StandbyDpsCodec(),
  );
  const service = new FiscalService(f.db, provider);
  let origin = "";
  const server = createServer((request, response) => {
    void fiscalApi(service, new SessionAuth(f.db, origin, key), origin)(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  assert.equal((await fetch(`${origin}/api/fiscal/health`)).status, 200);
  assert.equal((await fetch(`${origin}/api/fiscal/overview`)).status, 401);

  const authenticated = (path: string, init: RequestInit = {}) => fetch(`${origin}/api/fiscal${path}`, {
    ...init,
    headers: {
      Cookie: `weeki_session=${token}`,
      Origin: origin,
      ...init.headers,
    },
  });
  const overview = await (await authenticated("/overview")).text();
  assert(!overview.includes("kms://must-never-leave-server"));
  assert(!overview.includes("secretReference"));
  assert.equal(
    (await authenticated("/profile", {
      method: "PUT",
      headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" },
      body: "{}",
    })).status,
    403,
  );
  assert.equal(
    (await authenticated("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })).status,
    422,
  );
});
