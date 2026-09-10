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
    for (const migration of [
      { version: "001", file: "server/migrations/001_payments.sql" },
      { version: "002_fiscal", file: "server/migrations/002_fiscal.sql" },
    ]) {
      const applied = await sql.query(
        "SELECT version FROM public.weeki_payment_migrations WHERE version=$1",
        [migration.version],
      );
      if (applied.rows.length) continue;
      await sql.query(await readFile(migration.file, "utf8"));
      await sql.query(
        "INSERT INTO public.weeki_payment_migrations(version) VALUES($1)",
        [migration.version],
      );
    }
  });
  console.log("Weeki server migrations applied.");
} catch {
  console.error(
    "Weeki migration failed. Check database access and migration state; no provider calls were made.",
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
