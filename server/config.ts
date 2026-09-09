export function config() {
  const origin = new URL(process.env.APP_ORIGIN || "http://localhost:3000")
    .origin;
  if (
    !origin.startsWith("https:") &&
    !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
  )
    throw new Error("APP_ORIGIN requires HTTPS");
  const databaseUrl = process.env.DATABASE_URL;
  const key = Buffer.from(process.env.PAYMENTS_ENCRYPTION_KEY || "", "base64");
  if (!databaseUrl || key.length !== 32)
    throw new Error(
      "Configure DATABASE_URL and a base64 32-byte PAYMENTS_ENCRYPTION_KEY on the server",
    );
  const environment = process.env.PAYMENTS_ENVIRONMENT || "sandbox";
  if (!["sandbox", "production"].includes(environment))
    throw new Error("Invalid payment environment");
  if (
    environment === "production" &&
    process.env.PAYMENTS_LIVE_ENABLED !== "true"
  )
    throw new Error("Production payments require explicit enablement");
  return {
    origin,
    databaseUrl,
    key,
    environment: environment as "sandbox" | "production",
  };
}
