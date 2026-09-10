import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { body, json, requireOrigin } from "../api.js";
import type { SessionAuth } from "../auth.js";
import { PaymentError, errorCode as paymentErrorCode, messages as paymentMessages } from "../payments/errors.js";
import { FiscalError, fiscalErrorCode, fiscalMessages } from "./errors.js";
import { createFiscalDraftSchema, fiscalAutomationSchema, fiscalProfileSchema, fiscalServiceSchema } from "./schemas.js";
import type { FiscalService } from "./service.js";

function parseJson(raw: string) {
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new FiscalError("INVALID_FISCAL_INPUT", 400); }
}

function uuid(value: string) {
  if (!z.string().uuid().safeParse(value).success) throw new FiscalError("INVALID_FISCAL_INPUT", 400);
  return value;
}

export function fiscalApi(service: FiscalService, auth: SessionAuth, origin: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url || "/", origin);
    const path = url.pathname.replace(/\/$/, "");
    if (!path.startsWith("/api/fiscal")) return false;
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    try {
      if (req.method === "GET" && path === "/api/fiscal/health") {
        const moduleEnabled = process.env.FISCAL_MODULE_ENABLED !== "false";
        json(res, 200, {
          available: moduleEnabled,
          environment: process.env.FISCAL_ENVIRONMENT === "production" ? "production" : "sandbox",
          integrationEnabled: process.env.NFSE_NATIONAL_INTEGRATION_ENABLED === "true",
          liveEnabled: process.env.FISCAL_LIVE_ENABLED === "true",
        });
        return true;
      }
      if (process.env.FISCAL_MODULE_ENABLED === "false") {
        throw new FiscalError("FISCAL_NOT_FOUND", 404);
      }
      const scope = await auth.scope(req);
      if (!["GET", "HEAD"].includes(req.method || "")) requireOrigin(req, origin);

      if (req.method === "GET" && path === "/api/fiscal/overview") {
        json(res, 200, await service.overview(scope));
        return true;
      }
      if (req.method === "PUT" && path === "/api/fiscal/profile") {
        const input = fiscalProfileSchema.parse(parseJson(await body(req)));
        json(res, 200, await service.saveProfile(scope, input));
        return true;
      }
      if (req.method === "PUT" && path === "/api/fiscal/automation") {
        const input = fiscalAutomationSchema.parse(parseJson(await body(req)));
        json(res, 200, await service.saveAutomation(scope, input));
        return true;
      }
      if (req.method === "POST" && path === "/api/fiscal/services") {
        const input = fiscalServiceSchema.parse(parseJson(await body(req)));
        json(res, 201, await service.saveService(scope, input));
        return true;
      }
      if (req.method === "GET" && path === "/api/fiscal/notes") {
        json(res, 200, await service.list(scope, Number(url.searchParams.get("offset") || 0)));
        return true;
      }
      if (req.method === "POST" && path === "/api/fiscal/notes") {
        const input = createFiscalDraftSchema.parse(parseJson(await body(req)));
        json(res, 201, await service.createDraft(scope, input));
        return true;
      }
      const note = path.match(/^\/api\/fiscal\/notes\/([^/]+)(?:\/(prepare|issue|cancel))?$/);
      if (note && req.method === "GET" && !note[2]) {
        json(res, 200, await service.get(scope, uuid(note[1])));
        return true;
      }
      if (note && req.method === "POST" && note[2]) {
        const actions = {
          prepare: () => service.prepare(scope, uuid(note[1])),
          issue: () => service.issue(scope, uuid(note[1])),
          cancel: () => service.cancelPrepared(scope, uuid(note[1])),
        };
        json(res, 200, await actions[note[2] as keyof typeof actions]());
        return true;
      }
      throw new FiscalError("FISCAL_NOT_FOUND", 404);
    } catch (error) {
      const isValidation = error instanceof z.ZodError;
      const status = isValidation ? 422 : error instanceof FiscalError || error instanceof PaymentError ? error.status : 500;
      const code = isValidation ? "INVALID_FISCAL_INPUT" : error instanceof PaymentError ? paymentErrorCode(error) : fiscalErrorCode(error);
      const message = error instanceof PaymentError ? paymentMessages[code as keyof typeof paymentMessages] : fiscalMessages[code as keyof typeof fiscalMessages] || fiscalMessages.FISCAL_INTERNAL;
      console.error(JSON.stringify({ requestId, code, event: "fiscal.request.failed" }));
      json(res, status, { code, message, requestId });
      return true;
    }
  };
}
