import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { body, json, requireOrigin } from "../api.js";
import type { SessionAuth } from "../auth.js";
import { PaymentError, errorCode as paymentErrorCode, messages as paymentMessages } from "../payments/errors.js";
import { ContractError, contractErrorCode, contractMessages } from "./errors.js";
import type { ContractDraftInput } from "../../shared/contracts.js";
import {
  aiGenerateSchema,
  contractDraftSchema,
  contractTemplateSchema,
  contractUpdateSchema,
  reasonSchema,
  signatureSendSchema,
} from "./schemas.js";
import type { ContractService, ContractTemplateInput, ContractUpdateInput } from "./service.js";

function parseJson(raw: string) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new ContractError("CONTRACT_INVALID_INPUT", 400);
  }
}

function uuid(value: string) {
  if (!z.string().uuid().safeParse(value).success) throw new ContractError("CONTRACT_INVALID_INPUT", 400);
  return value;
}

function headers(req: IncomingMessage) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    result[key.toLowerCase()] = Array.isArray(value) ? value.join(",") : value || "";
  }
  return result;
}

export function contractApi(service: ContractService, auth: SessionAuth, origin: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url || "/", origin);
    const path = url.pathname.replace(/\/$/, "");
    if (!path.startsWith("/api/contracts") && !path.startsWith("/webhooks/clicksign")) return false;
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    try {
      if (req.method === "GET" && path === "/api/contracts/health") {
        json(res, 200, {
          available: process.env.CONTRACTS_MODULE_ENABLED !== "false",
          aiEnabled: process.env.CONTRACTS_AI_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY),
          signatureEnabled: process.env.CONTRACTS_SIGNATURE_ENABLED === "true" && Boolean(process.env.CLICKSIGN_ACCESS_TOKEN),
          signatureProvider: "clicksign",
          environment: process.env.CONTRACTS_ENVIRONMENT === "production" ? "production" : "sandbox",
        });
        return true;
      }
      if (path === "/webhooks/clicksign" && req.method === "POST") {
        const raw = await body(req);
        json(res, 200, await service.enqueueSignatureWebhook("clicksign", { raw, headers: headers(req), query: url.searchParams }));
        return true;
      }
      if (process.env.CONTRACTS_MODULE_ENABLED === "false") throw new ContractError("CONTRACT_NOT_FOUND", 404);

      const scope = await auth.scope(req);
      if (!["GET", "HEAD"].includes(req.method || "")) requireOrigin(req, origin);

      if (req.method === "GET" && path === "/api/contracts/overview") {
        json(res, 200, await service.overview(scope));
        return true;
      }
      if (req.method === "GET" && path === "/api/contracts/templates") {
        json(res, 200, await service.templates(scope));
        return true;
      }
      if (req.method === "POST" && path === "/api/contracts/templates") {
        const input = contractTemplateSchema.parse(parseJson(await body(req)));
        json(res, 201, await service.saveTemplate(scope, input as ContractTemplateInput));
        return true;
      }
      if (req.method === "GET" && path === "/api/contracts") {
        json(res, 200, await service.list(scope, Number(url.searchParams.get("offset") || 0)));
        return true;
      }
      if (req.method === "POST" && path === "/api/contracts") {
        const input = contractDraftSchema.parse(parseJson(await body(req)));
        json(res, 201, await service.create(scope, input as ContractDraftInput));
        return true;
      }
      if (req.method === "POST" && path === "/api/contracts/ai/generate") {
        const input = aiGenerateSchema.parse(parseJson(await body(req)));
        json(res, 200, await service.generateAi(scope, input));
        return true;
      }
      const contract = path.match(/^\/api\/contracts\/([^/]+)(?:\/(versions|pdf|signature\/send|signature\/remind|signature\/cancel))?$/);
      if (contract && req.method === "GET" && !contract[2]) {
        json(res, 200, await service.get(scope, uuid(contract[1])));
        return true;
      }
      if (contract && req.method === "PUT" && !contract[2]) {
        const input = contractUpdateSchema.parse(parseJson(await body(req)));
        json(res, 200, await service.update(scope, uuid(contract[1]), input as ContractUpdateInput));
        return true;
      }
      if (contract && req.method === "POST" && contract[2] === "versions") {
        const input = reasonSchema.parse(parseJson(await body(req)));
        json(res, 200, await service.createVersion(scope, uuid(contract[1]), input.reason));
        return true;
      }
      if (contract && req.method === "POST" && contract[2] === "pdf") {
        json(res, 200, await service.generatePdf(scope, uuid(contract[1])));
        return true;
      }
      if (contract && req.method === "POST" && contract[2] === "signature/send") {
        const input = signatureSendSchema.parse(parseJson(await body(req)));
        json(res, 200, await service.sendForSignature(scope, uuid(contract[1]), String(req.headers["idempotency-key"] || ""), input.expiresAt));
        return true;
      }
      if (contract && req.method === "POST" && contract[2] === "signature/remind") {
        json(res, 200, await service.resendReminder(scope, uuid(contract[1])));
        return true;
      }
      if (contract && req.method === "POST" && contract[2] === "signature/cancel") {
        const input = reasonSchema.parse(parseJson(await body(req)));
        json(res, 200, await service.cancelSignature(scope, uuid(contract[1]), input.reason));
        return true;
      }
      throw new ContractError("CONTRACT_NOT_FOUND", 404);
    } catch (error) {
      const isValidation = error instanceof z.ZodError;
      const status = isValidation
        ? 422
        : error instanceof ContractError || error instanceof PaymentError
          ? error.status
          : 500;
      const code = isValidation
        ? "CONTRACT_INVALID_INPUT"
        : error instanceof PaymentError
          ? paymentErrorCode(error)
          : contractErrorCode(error);
      const message = error instanceof PaymentError
        ? paymentMessages[code] || paymentMessages.INTERNAL
        : contractMessages[code] || contractMessages.CONTRACT_INTERNAL;
      console.error(JSON.stringify({ requestId, code, event: "contracts.request.failed" }));
      json(res, status, { code, message, requestId });
      return true;
    }
  };
}
