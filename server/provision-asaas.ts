// Server-only operation. Pass API key via protected stdin, never CLI args, env in browser, or repository.
import { database } from "./db.js";
import { config } from "./config.js";
import { providers } from "./payments/registry.js";
import { PaymentService } from "./payments/service.js";
import { z } from "zod";
const c = config(),
  db = database(c.databaseUrl);
try {
  const [userId, workspaceId] = process.argv.slice(2);
  z.string().uuid().parse(userId);
  z.string().uuid().parse(workspaceId);
  if (!process.env.PAYMENTS_ALERT_EMAIL)
    throw new Error("Configure PAYMENTS_ALERT_EMAIL");
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 4096) throw new Error("Invalid credential");
  }
  if (!input.trim()) throw new Error("Missing credential");
  const result = await new PaymentService(db, providers(c), c.key).connect(
    { userId, workspaceId },
    "asaas",
    { accessToken: input.trim() },
  );
  console.log(JSON.stringify({ id: result.id, status: result.status }));
} catch {
  console.error(
    "Asaas provisioning failed. Verify workspace ownership, server settings and API key.",
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
