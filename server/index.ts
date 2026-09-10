import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { database } from "./db.js";
import { config } from "./config.js";
import { SessionAuth } from "./auth.js";
import { PaymentService } from "./payments/service.js";
import { providers } from "./payments/registry.js";
import { paymentApi, json } from "./api.js";
import { FiscalService } from "./fiscal/service.js";
import { fiscalProviders } from "./fiscal/registry.js";
import { fiscalApi } from "./fiscal/api.js";
const conf = config(),
  db = database(conf.databaseUrl),
  registry = providers(conf),
  service = new PaymentService(db, registry, conf.key);
const api = paymentApi(
  service,
  new SessionAuth(db, conf.origin, conf.key),
  conf.origin,
  conf.key,
);
const fiscal = fiscalApi(
  new FiscalService(db, fiscalProviders().get("national_nfse")),
  new SessionAuth(db, conf.origin, conf.key),
  conf.origin,
);
const root = resolve("out"),
  mime: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
    ".txt": "text/plain",
  };
const server = createServer(async (req, res) => {
  try {
    if (await fiscal(req, res)) return;
    if (await api(req, res)) return;
  } catch {
    json(res, 500, {
      code: "INTERNAL",
      message: "Não foi possível concluir a solicitação.",
    });
    return;
  }
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const path = decodeURIComponent(
      new URL(req.url || "/", conf.origin).pathname,
    );
    let file = resolve(root, "." + path);
    if (!file.startsWith(root + sep) && file !== root) throw new Error("path");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(Number(process.env.PORT || 3000), () =>
  console.log(
    JSON.stringify({
      event: "payments.server.started",
      environment: conf.environment,
    }),
  ),
);
let running = false;
const interval = setInterval(async () => {
  if (running) return;
  running = true;
  try {
    for (let i = 0; i < 20; i++) {
      if (!(await service.processNext())) break;
    }
  } catch {
    console.error(
      JSON.stringify({ event: "payments.worker.failed", code: "INTERNAL" }),
    );
  } finally {
    running = false;
  }
}, 2000);
let syncing = false;
const syncInterval = setInterval(async () => {
  if (syncing) return;
  syncing = true;
  try {
    await service.scheduledSync();
  } catch {
    console.error(
      JSON.stringify({ event: "payments.sync.failed", code: "INTERNAL" }),
    );
  } finally {
    syncing = false;
  }
}, 60000);
process.on("SIGTERM", () => {
  clearInterval(interval);
  clearInterval(syncInterval);
  server.close(() => void db.close());
});
