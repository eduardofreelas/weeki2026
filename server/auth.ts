import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "./db.js";
import { PaymentError } from "./payments/errors.js";
import {
  randomToken,
  hash,
  challenge,
  seal,
  unseal,
} from "./payments/crypto.js";
import type { Scope } from "./payments/repository.js";
import { authorize } from "./payments/repository.js";
import { request } from "./payments/http.js";
import type { AuthProviderId } from "../shared/account.js";
import { upsertAuthProfile } from "./account/service.js";
interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}
interface LoginOptions {
  callbackPath?: string;
  returnTo?: string;
  mode?: "login" | "signup";
  provider?: AuthProviderId;
  loginHint?: string;
  nameHint?: string;
  legalAccepted?: boolean;
}
interface CallbackSecret {
  verifier: string;
  nonce: string;
  returnTo?: string;
  provider?: AuthProviderId;
  nameHint?: string;
  legalAccepted?: boolean;
}
export function cookieValue(req: IncomingMessage, name: string) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((p) => p.trim().split("="))
      .find(([k]) => k === name)?.[1] || ""
  );
}
export class SessionAuth {
  constructor(
    private db: Database,
    private origin: string,
    private key: Buffer,
  ) {}
  configured() {
    return Boolean(
      process.env.OIDC_ISSUER &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET,
    );
  }
  private async discovery() {
    if (!this.configured()) throw new PaymentError("NOT_CONFIGURED", 503);
    const issuer = process.env.OIDC_ISSUER!.replace(/\/$/, "");
    if (!issuer.startsWith("https://"))
      throw new PaymentError("NOT_CONFIGURED", 503);
    const d = await request<Discovery>(
      issuer + "/.well-known/openid-configuration",
    );
    if (
      d.issuer !== issuer ||
      ![d.authorization_endpoint, d.token_endpoint, d.jwks_uri].every((v) =>
        v.startsWith("https://"),
      )
    )
      throw new PaymentError("NOT_CONFIGURED", 503);
    return d;
  }
  private cookie(
    res: ServerResponse,
    name: string,
    value: string,
    maxAge: number,
  ) {
    res.setHeader(
      "Set-Cookie",
      `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.origin.startsWith("https://") ? "; Secure" : ""}`,
    );
  }
  sessionHash(req: IncomingMessage) {
    return hash(cookieValue(req, "weeki_session"));
  }
  async scope(req: IncomingMessage): Promise<Scope> {
    const result = await this.db.query<{
      user_id: string;
      workspace_id: string;
    }>(
      "SELECT user_id,workspace_id FROM weeki_payments.sessions WHERE token_hash=$1 AND expires_at>now()",
      [this.sessionHash(req)],
    );
    const r = result.rows[0];
    if (!r) throw new PaymentError("UNAUTHENTICATED", 401);
    const scope = { userId: r.user_id, workspaceId: r.workspace_id };
    await authorize(this.db, scope);
    return scope;
  }
  private safeReturnTo(value?: string) {
    if (!value) return "/";
    try {
      const url = new URL(value, this.origin);
      if (url.origin !== this.origin) return "/";
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return "/";
    }
  }
  private providerHint(provider?: AuthProviderId) {
    const hintParam = process.env.OIDC_PROVIDER_HINT_PARAM;
    const hintValue =
      provider === "google"
        ? process.env.OIDC_GOOGLE_PROVIDER_HINT
        : provider === "apple"
          ? process.env.OIDC_APPLE_PROVIDER_HINT
          : provider === "email"
            ? process.env.OIDC_EMAIL_PROVIDER_HINT
            : undefined;
    return hintParam && hintValue ? { hintParam, hintValue } : null;
  }
  async login(res: ServerResponse, options: LoginOptions = {}) {
    const d = await this.discovery(),
      state = randomToken(),
      verifier = randomToken(),
      nonce = randomToken(),
      binding = randomToken();
    const callbackPath = options.callbackPath || "/api/payments/auth/callback";
    const secret: CallbackSecret = {
      verifier,
      nonce,
      returnTo: this.safeReturnTo(options.returnTo),
      provider: options.provider || "oidc",
      nameHint: options.nameHint,
      legalAccepted: Boolean(options.legalAccepted),
    };
    await this.db.query(
      "INSERT INTO weeki_payments.oauth_states(state_hash,session_hash,provider,secret,expires_at) VALUES($1,$2,'oidc',$3,$4)",
      [
        hash(state),
        hash(binding),
        seal(secret, this.key, hash(state)),
        new Date(Date.now() + 600000),
      ],
    );
    this.cookie(res, "weeki_login", binding, 600);
    const url = new URL(d.authorization_endpoint);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.OIDC_CLIENT_ID!,
      redirect_uri: this.origin + callbackPath,
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge(verifier),
      code_challenge_method: "S256",
    });
    if (options.loginHint) params.set("login_hint", options.loginHint);
    if (options.mode === "signup") params.set("screen_hint", "signup");
    const providerHint = this.providerHint(options.provider);
    if (providerHint) params.set(providerHint.hintParam, providerHint.hintValue);
    url.search = params.toString();
    return url.href;
  }
  async callback(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    options: { callbackPath?: string } = {},
  ) {
    const state = url.searchParams.get("state") || "",
      code = url.searchParams.get("code");
    if (!state || !code) throw new PaymentError("INVALID_STATE", 400);
    const result = await this.db.query<{ secret: string }>(
      "DELETE FROM weeki_payments.oauth_states WHERE state_hash=$1 AND session_hash=$2 AND provider='oidc' AND expires_at>now() RETURNING secret",
      [hash(state), hash(cookieValue(req, "weeki_login"))],
    );
    if (!result.rows[0]) throw new PaymentError("INVALID_STATE", 400);
    const secret = unseal<CallbackSecret>(
        result.rows[0].secret,
        this.key,
        hash(state),
      ),
      d = await this.discovery();
    const callbackPath = options.callbackPath || "/api/payments/auth/callback";
    const tokens = await request<{ id_token: string }>(d.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.OIDC_CLIENT_ID!,
        client_secret: process.env.OIDC_CLIENT_SECRET!,
        code,
        redirect_uri: this.origin + callbackPath,
        code_verifier: secret.verifier,
      }),
    });
    const { payload } = await jwtVerify(
      tokens.id_token,
      createRemoteJWKSet(new URL(d.jwks_uri)),
      {
        issuer: d.issuer,
        audience: process.env.OIDC_CLIENT_ID,
        algorithms: ["RS256", "ES256"],
        requiredClaims: ["sub", "iat", "exp", "nonce"],
        clockTolerance: 10,
      },
    );
    if (
      payload.nonce !== secret.nonce ||
      !payload.sub ||
      (payload.azp && payload.azp !== process.env.OIDC_CLIENT_ID)
    )
      throw new PaymentError("INVALID_STATE", 401);
    const session = randomToken();
    let callbackResult = {
      userId: "",
      workspaceId: "",
      returnTo: this.safeReturnTo(secret.returnTo),
    };
    await this.db.transaction(async (sql) => {
      const email = typeof payload.email === "string" ? payload.email.toLocaleLowerCase("pt-BR") : "";
      const name =
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : secret.nameHint || "";
      const avatarUrl = typeof payload.picture === "string" ? payload.picture : "";
      const provider = secret.provider || "oidc";
      const linkedProvider = await sql.query<{ user_id: string }>(
        "SELECT user_id FROM weeki_payments.auth_providers WHERE issuer=$1 AND subject=$2 ORDER BY connected_at LIMIT 1",
        [d.issuer, payload.sub],
      );
      const linkedEmail =
        !linkedProvider.rows[0] && email && payload.email_verified === true
          ? await sql.query<{ user_id: string }>(
              "SELECT user_id FROM weeki_payments.user_profiles WHERE lower(email)=lower($1) AND email_verified=true LIMIT 1",
              [email],
            )
          : { rows: [] };
      let userId = linkedProvider.rows[0]?.user_id || linkedEmail.rows[0]?.user_id;
      if (!userId) {
        const newUser = randomUUID();
        const users = await sql.query<{ id: string }>(
          "INSERT INTO weeki_payments.users(id,issuer,subject) VALUES($1,$2,$3) ON CONFLICT(issuer,subject) DO UPDATE SET subject=excluded.subject RETURNING id",
          [newUser, d.issuer, payload.sub],
        );
        userId = users.rows[0].id;
      }
      await sql.query(
        "SELECT id FROM weeki_payments.users WHERE id=$1 FOR UPDATE",
        [userId],
      );
      const memberships = await sql.query<{ workspace_id: string }>(
        "SELECT workspace_id FROM weeki_payments.memberships WHERE user_id=$1 ORDER BY workspace_id LIMIT 1",
        [userId],
      );
      let workspaceId = memberships.rows[0]?.workspace_id;
      if (!workspaceId) {
        workspaceId = randomUUID();
        await sql.query(
          "INSERT INTO weeki_payments.workspaces(id) VALUES($1)",
          [workspaceId],
        );
        await sql.query(
          "INSERT INTO weeki_payments.memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",
          [workspaceId, userId],
        );
      }
      await upsertAuthProfile(sql, { userId, workspaceId }, {
        provider,
        issuer: d.issuer,
        subject: String(payload.sub),
        email,
        emailVerified: payload.email_verified === true,
        name,
        avatarUrl,
        legalAccepted: secret.legalAccepted,
      });
      await sql.query(
        "INSERT INTO weeki_payments.sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,$4)",
        [
          hash(session),
          userId,
          workspaceId,
          new Date(Date.now() + 8 * 3600000),
        ],
      );
      callbackResult = { userId, workspaceId, returnTo: this.safeReturnTo(secret.returnTo) };
    });
    this.cookie(res, "weeki_session", session, 8 * 3600);
    return callbackResult;
  }
  async logout(req: IncomingMessage, res: ServerResponse) {
    await this.db.query(
      "DELETE FROM weeki_payments.sessions WHERE token_hash=$1",
      [this.sessionHash(req)],
    );
    this.cookie(res, "weeki_session", "", 0);
  }
}
