import { FiscalError } from "./errors.js";

export interface CertificateSecretStore {
  put(workspaceId: string, certificate: Buffer, password: string): Promise<string>;
  sign(workspaceId: string, secretReference: string, unsignedXml: Buffer): Promise<Buffer>;
  remove(workspaceId: string, secretReference: string): Promise<void>;
}

export class UnconfiguredCertificateSecretStore implements CertificateSecretStore {
  private unavailable(): never {
    throw new FiscalError("CERTIFICATE_STORE_UNAVAILABLE", 503);
  }
  async put(): Promise<string> { return this.unavailable(); }
  async sign(): Promise<Buffer> { return this.unavailable(); }
  async remove(): Promise<void> { this.unavailable(); }
}
