import { hash, randomToken, seal, unseal } from "./crypto.js";
import { PaymentError } from "./errors.js";
import type { Scope } from "./repository.js";
import { authorize } from "./repository.js";
import type { PaymentService } from "./service.js";
import type { ProviderId } from "../../shared/payments.js";
export class PaymentOAuth {
  constructor(
    private service: PaymentService,
    private key: Buffer,
  ) {}
  async begin(scope: Scope, provider: ProviderId, sessionHash: string) {
    await authorize(this.service.db, scope, true);
    const p = this.service.registry.get(provider);
    if (!p.configured()) throw new PaymentError("NOT_CONFIGURED", 503);
    const state = randomToken(),
      verifier = randomToken(),
      url = p.authorizationUrl(state, verifier);
    await this.service.db.query(
      "INSERT INTO weeki_payments.oauth_states(state_hash,session_hash,workspace_id,provider,secret,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
      [
        hash(state),
        sessionHash,
        scope.workspaceId,
        provider,
        seal({ verifier }, this.key, hash(state)),
        new Date(Date.now() + 600000),
      ],
    );
    return url;
  }
  async complete(
    scope: Scope,
    provider: ProviderId,
    sessionHash: string,
    state: string,
    code: string,
  ) {
    await authorize(this.service.db, scope, true);
    const result = await this.service.db.query<{ secret: string }>(
      "DELETE FROM weeki_payments.oauth_states WHERE state_hash=$1 AND session_hash=$2 AND workspace_id=$3 AND provider=$4 AND expires_at>now() RETURNING secret",
      [hash(state), sessionHash, scope.workspaceId, provider],
    );
    if (!result.rows[0] || !code) throw new PaymentError("INVALID_STATE", 400);
    const { verifier } = unseal<{ verifier: string }>(
      result.rows[0].secret,
      this.key,
      hash(state),
    );
    const credentials = await this.service.registry
      .get(provider)
      .exchangeCode(code, verifier);
    return this.service.connect(scope, provider, credentials);
  }
}
