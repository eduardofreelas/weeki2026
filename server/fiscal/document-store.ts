import { FiscalError } from "./errors.js";

export interface StoredFiscalDocument {
  storageKey: string;
  checksum: string;
  contentType: "application/pdf" | "application/xml";
}

export interface FiscalDocumentStore {
  put(workspaceId: string, noteId: string, fileName: string, content: Buffer, contentType: StoredFiscalDocument["contentType"]): Promise<StoredFiscalDocument>;
  signedReadUrl(workspaceId: string, storageKey: string, expiresInSeconds: number): Promise<string>;
  remove(workspaceId: string, storageKey: string): Promise<void>;
}

export class UnconfiguredFiscalDocumentStore implements FiscalDocumentStore {
  private unavailable(): never { throw new FiscalError("FISCAL_NOT_CONFIGURED", 503, { dependency: "fiscal_document_store" }); }
  async put(): Promise<StoredFiscalDocument> { return this.unavailable(); }
  async signedReadUrl(): Promise<string> { return this.unavailable(); }
  async remove(): Promise<void> { this.unavailable(); }
}
