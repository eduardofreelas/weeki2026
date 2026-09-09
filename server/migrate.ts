import { readFile } from "node:fs/promises";
import { database } from "./db.js";
import { config } from "./config.js";
const db = database(config().databaseUrl);
try {
  await db.transaction(async (sql) => {
    await sql.query(
      "CREATE TABLE IF NOT EXISTS public.weeki_payment_migrations(version text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    await sql.query(
      "LOCK TABLE public.weeki_payment_migrations IN EXCLUSIVE MODE",
    );
    const old = await sql.query(
      "SELECT version FROM public.weeki_payment_migrations WHERE version='001'",
    );
    if (old.rows.length) return;
    await sql.query(
      await readFile("server/migrations/001_payments.sql", "utf8"),
    );
    await sql.query(
      "INSERT INTO public.weeki_payment_migrations(version) VALUES('001')",
    );
  });
  console.log("Payments migration applied.");
} catch {
  console.error(
    "Payments migration failed. Check database access and migration state; no provider calls were made.",
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
