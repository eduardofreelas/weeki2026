import type { NfseRequest } from "../../shared/fiscal.js";
import { FiscalError } from "./errors.js";

/** Provider-neutral source used by a versioned official DPS codec. */
export interface DpsSource {
  issuer: NfseRequest["issuer"];
  customer: NfseRequest["customer"];
  service: NfseRequest["service"];
  amount: number;
  description: string;
  competenceDate: string;
}

export function createDpsSource(request: NfseRequest): DpsSource {
  return {
    issuer: request.issuer,
    customer: request.customer,
    service: request.service,
    amount: request.amount,
    description: request.description,
    competenceDate: request.competenceDate,
  };
}

export interface OfficialDpsCodec {
  readonly schemaVersion: string;
  buildAndValidate(source: DpsSource): Promise<Buffer>;
}

/** Deliberately does not guess XML tags or schemas. */
export class StandbyDpsCodec implements OfficialDpsCodec {
  readonly schemaVersion = "unconfigured";
  async buildAndValidate(): Promise<Buffer> {
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }
}
