import type { NfseRecord } from "../../shared/fiscal.js";
import { FiscalError } from "./errors.js";

export interface FiscalNotification {
  to: string;
  customerName: string;
  issuerName: string;
  serviceName: string;
  amount: number;
  nfseNumber: string;
  secureViewUrl: string;
  documentIds: string[];
}

export interface NotificationProvider {
  readonly channel: "email" | "whatsapp";
  send(message: FiscalNotification, note: NfseRecord): Promise<{ externalId: string }>;
}

export class StandbyNotificationProvider implements NotificationProvider {
  constructor(readonly channel: "email" | "whatsapp") {}
  async send(): Promise<{ externalId: string }> {
    throw new FiscalError("FISCAL_NOT_CONFIGURED", 503, { dependency: `${this.channel}_provider` });
  }
}
