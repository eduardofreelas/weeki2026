import type { IncomingMessage, ServerResponse } from "node:http";
import { PaymentError, errorCode, messages } from "../payments/errors.js";
import { body, json, requireOrigin } from "../api.js";
import type { SessionAuth } from "../auth.js";
import type { AccountService } from "./service.js";
import { passwordRequestSchema } from "./schemas.js";
import type { AuthProviderId } from "../../shared/account.js";

const accountMessages: Record<string, string> = {
  ...messages,
  UNAUTHENTICATED: "Entre na sua conta para continuar.",
  NOT_CONFIGURED: "A autenticação ainda precisa ser configurada no servidor.",
  INVALID_INPUT: "Confira os dados informados.",
};

function parseJson(raw: string) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new PaymentError("INVALID_INPUT", 400);
  }
}

function redirect(res: ServerResponse, url: string) {
  res.writeHead(303, {
    Location: url,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end();
}

function safeReturnTo(value: string | null, origin: string) {
  if (!value) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function provider(value: string | null): AuthProviderId {
  if (value === "email" || value === "google" || value === "apple") return value;
  return "oidc";
}

export function accountApi(service: AccountService, auth: SessionAuth, origin: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url || "/", origin);
    const path = url.pathname.replace(/\/$/, "");
    if (!path.startsWith("/api/account") && !path.startsWith("/api/auth")) return false;

    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (req.method === "GET" && path === "/api/auth/config") {
        json(res, 200, {
          authConfigured: auth.configured(),
          providers: {
            email: auth.configured(),
            google: auth.configured(),
            apple: auth.configured(),
          },
          resetPassword: Boolean(process.env.OIDC_PASSWORD_RESET_URL),
        });
        return true;
      }

      if (req.method === "GET" && ["/api/auth/login", "/api/auth/signup", "/api/auth/oauth/google", "/api/auth/oauth/apple"].includes(path)) {
        if (!auth.configured()) throw new PaymentError("NOT_CONFIGURED", 503);
        const inferredProvider = path.endsWith("/google") ? "google" : path.endsWith("/apple") ? "apple" : provider(url.searchParams.get("provider"));
        redirect(res, await auth.login(res, {
          callbackPath: "/api/auth/callback",
          returnTo: safeReturnTo(url.searchParams.get("returnTo"), origin),
          mode: path === "/api/auth/signup" ? "signup" : "login",
          provider: inferredProvider,
          loginHint: url.searchParams.get("login_hint") || undefined,
          nameHint: url.searchParams.get("name") || undefined,
          legalAccepted: url.searchParams.get("terms") === "accepted",
        }));
        return true;
      }

      if (req.method === "GET" && path === "/api/auth/callback") {
        const result = await auth.callback(req, res, url, { callbackPath: "/api/auth/callback" });
        redirect(res, origin + safeReturnTo(result.returnTo, origin));
        return true;
      }

      if (req.method === "POST" && path === "/api/auth/password/forgot") {
        requireOrigin(req, origin);
        passwordRequestSchema.parse(parseJson(await body(req)));
        json(res, 200, {
          success: true,
          resetUrl: process.env.OIDC_PASSWORD_RESET_URL || null,
          message: "Se houver uma conta elegivel, enviaremos as instrucoes de redefinicao.",
        });
        return true;
      }

      if (req.method === "POST" && path === "/api/auth/password/reset") {
        requireOrigin(req, origin);
        json(res, 501, {
          code: "NOT_CONFIGURED",
          message: "A redefinicao de senha e finalizada pelo provedor de identidade configurado.",
        });
        return true;
      }

      if (req.method === "POST" && path === "/api/auth/logout") {
        requireOrigin(req, origin);
        await auth.logout(req, res);
        json(res, 200, { success: true });
        return true;
      }

      if (req.method === "GET" && path === "/api/account/session") {
        if (!auth.configured()) {
          json(res, 200, { authConfigured: false, authenticated: false, session: null });
          return true;
        }
        try {
          const scope = await auth.scope(req);
          json(res, 200, { authConfigured: true, authenticated: true, session: await service.session(scope) });
        } catch (e) {
          if (errorCode(e) !== "UNAUTHENTICATED") throw e;
          json(res, 401, { code: "UNAUTHENTICATED", authConfigured: true, authenticated: false, session: null, message: accountMessages.UNAUTHENTICATED });
        }
        return true;
      }

      const scope = await auth.scope(req);
      if (!["GET", "HEAD"].includes(req.method || "")) requireOrigin(req, origin);

      if (req.method === "GET" && path === "/api/account/availability") {
        json(res, 200, await service.availability(scope));
        return true;
      }
      if (req.method === "PATCH" && path === "/api/account/availability") {
        json(res, 200, await service.saveAvailability(scope, parseJson(await body(req))));
        return true;
      }
      if (req.method === "PATCH" && path === "/api/account/profile") {
        json(res, 200, await service.updateProfile(scope, parseJson(await body(req))));
        return true;
      }
      if (req.method === "PATCH" && path === "/api/account/onboarding") {
        json(res, 200, await service.updateOnboarding(scope, parseJson(await body(req))));
        return true;
      }

      throw new PaymentError("NOT_FOUND", 404);
    } catch (e) {
      const code = errorCode(e);
      console.error(JSON.stringify({ event: "account.request.failed", code }));
      json(res, e instanceof PaymentError ? e.status : 500, {
        code,
        message: accountMessages[code] || accountMessages.INTERNAL,
      });
      return true;
    }
  };
}
