import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { body, json, requireOrigin } from "../api.js";
import type { SessionAuth } from "../auth.js";
import type { Database } from "../db.js";
import { PaymentError } from "../payments/errors.js";

const checkoutValidationSchema = z.object({
  serviceId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  extras: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().min(1).max(999).default(1),
      }),
    )
    .default([]),
});

function parseJson(raw: string) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new PaymentError("INVALID_INPUT", 400);
  }
}

function slug(value: string) {
  const result = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .safeParse(value);
  if (!result.success) throw new PaymentError("INVALID_INPUT", 400);
  return result.data;
}

function publicIpHashPlaceholder(req: IncomingMessage) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  return forwarded ? "captured-by-edge" : "";
}

export function servicesApi(db: Database, auth: SessionAuth, origin: string) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> => {
    const url = new URL(req.url || "/", origin);
    const path = url.pathname.replace(/\/$/, "");
    if (
      !path.startsWith("/api/services") &&
      !path.startsWith("/api/storefront")
    )
      return false;
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    try {
      if (req.method === "GET" && path === "/api/services/health") {
        json(res, 200, {
          available: true,
          storefront: true,
          checkoutValidation: true,
        });
        return true;
      }

      const publicStorefront = path.match(/^\/api\/storefront\/([^/]+)$/);
      if (publicStorefront && req.method === "GET") {
        const storefrontSlug = slug(publicStorefront[1]);
        const storefront = await db.query<{
          workspace_id: string;
          slug: string;
          public_name: string;
          business_name: string;
          accent_color: string;
          data: unknown;
        }>(
          "SELECT workspace_id,slug,public_name,business_name,accent_color,data FROM weeki_services.storefront_settings WHERE enabled=true AND lower(slug)=lower($1)",
          [storefrontSlug],
        );
        const row = storefront.rows[0];
        if (!row) throw new PaymentError("NOT_FOUND", 404);
        const services = await db.query(
          "SELECT id,slug,name,category,summary,status,availability_status,pricing_type,price_minor,currency,hiring_type,featured,data FROM weeki_services.services WHERE workspace_id=$1 AND status='published' AND in_storefront=true ORDER BY featured DESC, updated_at DESC LIMIT 100",
          [row.workspace_id],
        );
        json(res, 200, { storefront: row, services: services.rows });
        return true;
      }

      const publicService = path.match(
        /^\/api\/storefront\/([^/]+)\/services\/([^/]+)$/,
      );
      if (publicService && req.method === "GET") {
        const storefrontSlug = slug(publicService[1]);
        const serviceSlug = slug(publicService[2]);
        const result = await db.query(
          `SELECT s.id,s.slug,s.name,s.category,s.summary,s.status,s.availability_status,
                  s.pricing_type,s.price_minor,s.currency,s.hiring_type,s.featured,s.data,
                  sf.slug AS storefront_slug,sf.public_name,sf.business_name,sf.accent_color
             FROM weeki_services.services s
             JOIN weeki_services.storefront_settings sf ON sf.workspace_id=s.workspace_id
            WHERE sf.enabled=true AND lower(sf.slug)=lower($1)
              AND s.status='published' AND s.in_storefront=true AND lower(s.slug)=lower($2)
            LIMIT 1`,
          [storefrontSlug, serviceSlug],
        );
        if (!result.rows[0]) throw new PaymentError("NOT_FOUND", 404);
        json(res, 200, result.rows[0]);
        return true;
      }

      const validateCheckout = path.match(
        /^\/api\/storefront\/([^/]+)\/checkout\/validate$/,
      );
      if (validateCheckout && req.method === "POST") {
        const storefrontSlug = slug(validateCheckout[1]);
        const input = checkoutValidationSchema.parse(
          parseJson(await body(req)),
        );
        const service = await db.query<{
          price_minor: string | number;
          currency: string;
          data: {
            variants?: Array<{
              id: string;
              priceMinor?: number;
              price?: number;
            }>;
            extras?: Array<{
              id: string;
              priceMinor?: number;
              price?: number;
              required?: boolean;
            }>;
          };
        }>(
          `SELECT s.price_minor,s.currency,s.data
             FROM weeki_services.services s
             JOIN weeki_services.storefront_settings sf ON sf.workspace_id=s.workspace_id
            WHERE sf.enabled=true AND lower(sf.slug)=lower($1)
              AND s.id=$2 AND s.status='published' AND s.in_storefront=true
            LIMIT 1`,
          [storefrontSlug, input.serviceId],
        );
        const row = service.rows[0];
        if (!row) throw new PaymentError("NOT_FOUND", 404);
        const data = row.data || {};
        const variant = data.variants?.find(
          (item) => item.id === input.variantId,
        );
        const extras = data.extras ?? [];
        const selectedExtras = new Map(
          input.extras.map((extra) => [extra.id, extra.quantity]),
        );
        const base =
          variant?.priceMinor ??
          (variant?.price
            ? Math.round(variant.price * 100)
            : Number(row.price_minor));
        const extrasTotal = extras.reduce((total, extra) => {
          if (!extra.required && !selectedExtras.has(extra.id)) return total;
          const quantity = Math.max(1, selectedExtras.get(extra.id) ?? 1);
          const price =
            extra.priceMinor ??
            (extra.price ? Math.round(extra.price * 100) : 0);
          return total + price * quantity;
        }, 0);
        json(res, 200, {
          totalMinor: base + extrasTotal,
          currency: row.currency,
          source: "server",
        });
        return true;
      }

      const publicEvent = path.match(/^\/api\/storefront\/([^/]+)\/events$/);
      if (publicEvent && req.method === "POST") {
        const storefrontSlug = slug(publicEvent[1]);
        const input = z
          .object({
            serviceId: z.string().uuid().optional().nullable(),
            kind: z.enum([
              "storefront_view",
              "service_view",
              "cta_click",
              "quote_request",
              "purchase",
              "appointment",
              "checkout_abandoned",
            ]),
            data: z.record(z.unknown()).optional().default({}),
          })
          .parse(parseJson(await body(req)));
        const storefront = await db.query<{ workspace_id: string }>(
          "SELECT workspace_id FROM weeki_services.storefront_settings WHERE enabled=true AND lower(slug)=lower($1)",
          [storefrontSlug],
        );
        const workspaceId = storefront.rows[0]?.workspace_id;
        if (!workspaceId) throw new PaymentError("NOT_FOUND", 404);
        await db.query(
          "INSERT INTO weeki_services.analytics_events(id,workspace_id,service_id,kind,ip_hash,user_agent_hash,data) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            randomUUID(),
            workspaceId,
            input.serviceId ?? null,
            input.kind,
            publicIpHashPlaceholder(req),
            req.headers["user-agent"] ? "captured-by-edge" : "",
            input.data,
          ],
        );
        json(res, 202, { accepted: true });
        return true;
      }

      const scope = await auth.scope(req);
      if (!["GET", "HEAD"].includes(req.method || ""))
        requireOrigin(req, origin);

      if (req.method === "GET" && path === "/api/services") {
        const services = await db.query(
          "SELECT id,slug,name,category,summary,status,availability_status,pricing_type,price_minor,currency,hiring_type,featured,in_storefront,data,created_at,updated_at FROM weeki_services.services WHERE workspace_id=$1 ORDER BY updated_at DESC LIMIT 200",
          [scope.workspaceId],
        );
        json(res, 200, services.rows);
        return true;
      }

      if (req.method === "GET" && path === "/api/services/orders") {
        const orders = await db.query(
          "SELECT id,number,service_id,client_id,status,payment_status,total_minor,currency,quote_id,charge_id,contract_id,engagement_id,appointment_date,appointment_time,data,created_at,updated_at FROM weeki_services.service_orders WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200",
          [scope.workspaceId],
        );
        json(res, 200, orders.rows);
        return true;
      }

      if (req.method === "GET" && path === "/api/services/storefront") {
        const storefront = await db.query(
          "SELECT enabled,slug,public_name,business_name,custom_domain,accent_color,data,updated_at FROM weeki_services.storefront_settings WHERE workspace_id=$1",
          [scope.workspaceId],
        );
        json(res, 200, storefront.rows[0] ?? null);
        return true;
      }

      throw new PaymentError("NOT_FOUND", 404);
    } catch (error) {
      const status =
        error instanceof PaymentError
          ? error.status
          : error instanceof z.ZodError
            ? 422
            : 500;
      console.error(
        JSON.stringify({
          requestId,
          code:
            status === 500 ? "SERVICES_INTERNAL" : "SERVICES_REQUEST_FAILED",
          event: "services.request.failed",
        }),
      );
      json(res, status, {
        code: status === 404 ? "NOT_FOUND" : "INVALID_INPUT",
        message:
          status === 500
            ? "Não foi possível concluir a solicitação de serviços."
            : "Requisição inválida.",
      });
      return true;
    }
  };
}
