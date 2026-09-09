import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PaymentService } from "./payments/service.js";
import type { SessionAuth } from "./auth.js";
import { PaymentOAuth } from "./payments/oauth.js";
import { PaymentError, errorCode, messages } from "./payments/errors.js";
import { PROVIDERS, type ProviderId } from "../shared/payments.js";
export function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(JSON.stringify(value));
}
function redirect(res: ServerResponse, url: string) {
  res.writeHead(303, {
    Location: url,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end();
}
export async function body(req: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 262144) throw new PaymentError("INVALID_INPUT", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function parse(raw: string) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new PaymentError("INVALID_INPUT", 400);
  }
}
export function requireOrigin(req: IncomingMessage, origin: string) {
  if (
    req.headers.origin !== origin ||
    (req.headers["sec-fetch-site"] &&
      !["same-origin", "none"].includes(String(req.headers["sec-fetch-site"])))
  )
    throw new PaymentError("FORBIDDEN", 403);
}
function id(value: string) {
  if (!z.string().uuid().safeParse(value).success)
    throw new PaymentError("INVALID_INPUT", 400);
  return value;
}
const providerId = (p: string) => {
  if (!PROVIDERS.includes(p as ProviderId))
    throw new PaymentError("INVALID_INPUT", 400);
  return p as ProviderId;
};
export function paymentApi(
  service: PaymentService,
  auth: SessionAuth,
  origin: string,
  key: Buffer,
) {
  const oauth = new PaymentOAuth(service, key);
  return async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> => {
    const url = new URL(req.url || "/", origin),
      path = url.pathname.replace(/\/$/, "");
    if (!path.startsWith("/api/payments") && !path.startsWith("/webhooks/"))
      return false;
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    try {
      const webhook = path.match(
        /^\/webhooks\/(asaas|mercadopago|stripe)(?:\/([^/]+))?$/,
      );
      if (webhook && req.method === "POST") {
        const raw = await body(req),
          headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers))
          headers[k] = Array.isArray(v) ? v.join(",") : v || "";
        const provider = providerId(webhook[1]),
          input = { raw, headers, query: url.searchParams };
        let connectionId = webhook[2];
        if (!connectionId) {
          const event = service.registry.get(provider).handleWebhook(input);
          if (!event.accountId) throw new PaymentError("INVALID_WEBHOOK", 401);
          const r = await service.db.query<{ id: string }>(
            "SELECT id FROM weeki_payments.connections WHERE data->>'provider'=$1 AND data->>'externalAccountId'=$2 AND data->>'environment'=$3",
            [
              provider,
              event.accountId,
              service.registry.get(provider).config.environment,
            ],
          );
          connectionId = r.rows[0]?.id;
          if (!connectionId) throw new PaymentError("INVALID_WEBHOOK", 401);
        }
        json(
          res,
          200,
          await service.enqueue(provider, id(connectionId), input),
        );
        return true;
      }
      if (req.method === "GET" && path === "/api/payments/health") {
        json(res, 200, { available: true, loginEnabled: auth.configured() });
        return true;
      }
      if (req.method === "GET" && path === "/api/payments/auth/login") {
        redirect(res, await auth.login(res));
        return true;
      }
      if (req.method === "GET" && path === "/api/payments/auth/callback") {
        await auth.callback(req, res, url);
        redirect(res, origin + "/?area=settings&section=payments");
        return true;
      }
      const scope = await auth.scope(req);
      if (!["GET", "HEAD"].includes(req.method || ""))
        requireOrigin(req, origin);
      if (req.method === "POST" && path === "/api/payments/auth/logout") {
        await auth.logout(req, res);
        json(res, 200, { success: true });
        return true;
      }
      const callback = path.match(
        /^\/api\/payments\/oauth\/(asaas|mercadopago|stripe)\/callback$/,
      );
      if (callback && req.method === "GET") {
        await oauth.complete(
          scope,
          providerId(callback[1]),
          auth.sessionHash(req),
          url.searchParams.get("state") || "",
          url.searchParams.get("code") || "",
        );
        redirect(res, origin + "/?area=settings&section=payments&connected=1");
        return true;
      }
      if (req.method === "GET" && path === "/api/payments/connections") {
        json(res, 200, await service.overview(scope));
        return true;
      }
      if (req.method === "GET" && path === "/api/payments/charges") {
        json(
          res,
          200,
          await service.listCharges(
            scope,
            Number(url.searchParams.get("offset") || 0),
          ),
        );
        return true;
      }
      if (req.method === "GET" && path === "/api/payments/finance") {
        json(
          res,
          200,
          await service.listFinance(
            scope,
            Number(url.searchParams.get("offset") || 0),
          ),
        );
        return true;
      }
      if (req.method === "GET" && path === "/api/payments/audit") {
        json(res, 200, await service.listAudit(scope));
        return true;
      }
      if (req.method === "POST" && path === "/api/payments/customers") {
        json(
          res,
          200,
          await service.saveCustomer(scope, parse(await body(req))),
        );
        return true;
      }
      if (req.method === "POST" && path === "/api/payments/charges") {
        json(
          res,
          201,
          await service.createCharge(
            scope,
            parse(await body(req)),
            String(req.headers["idempotency-key"] || ""),
          ),
        );
        return true;
      }
      const connect = path.match(
        /^\/api\/payments\/providers\/(asaas|mercadopago|stripe)\/connect$/,
      );
      if (connect && req.method === "POST") {
        json(res, 200, {
          url: await oauth.begin(
            scope,
            providerId(connect[1]),
            auth.sessionHash(req),
          ),
        });
        return true;
      }
      const conn = path.match(
        /^\/api\/payments\/connections\/([^/]+)\/(default|disconnect|sync|retry-webhooks)$/,
      );
      if (conn && req.method === "POST") {
        const methods = {
          "retry-webhooks": () => service.retryWebhooks(scope, id(conn[1])),
          default: () => service.setDefault(scope, id(conn[1])),
          disconnect: () => service.disconnect(scope, id(conn[1])),
          sync: () => service.syncConnection(scope, id(conn[1])),
        };
        json(
          res,
          200,
          (await methods[conn[2] as keyof typeof methods]()) || {
            success: true,
          },
        );
        return true;
      }
      const charge = path.match(
        /^\/api\/payments\/charges\/([^/]+)(?:\/(sync|cancel|refund))?$/,
      );
      if (charge && req.method === "GET" && !charge[2]) {
        json(res, 200, await service.getCharge(scope, id(charge[1])));
        return true;
      }
      if (charge && req.method === "POST" && charge[2]) {
        json(
          res,
          200,
          charge[2] === "sync"
            ? await service.syncCharge(scope, id(charge[1]))
            : await service.operate(
                scope,
                id(charge[1]),
                charge[2] as "cancel" | "refund",
              ),
        );
        return true;
      }
      throw new PaymentError("NOT_FOUND", 404);
    } catch (e) {
      const code = errorCode(e);
      console.error(
        JSON.stringify({ requestId, code, event: "payment.request.failed" }),
      );
      if (
        /^\/api\/payments\/(auth|oauth\/(asaas|mercadopago|stripe))\/callback$/.test(
          path,
        )
      ) {
        redirect(
          res,
          origin + "/?area=settings&section=payments&payment_error=1",
        );
        return true;
      }
      json(res, e instanceof PaymentError ? e.status : 500, {
        code,
        message: messages[code] || messages.INTERNAL,
        requestId,
      });
      return true;
    }
  };
}
