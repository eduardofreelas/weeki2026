export type FiscalErrorCode =
  | "FISCAL_NOT_CONFIGURED"
  | "NFSE_PROVIDER_STANDBY"
  | "CERTIFICATE_STORE_UNAVAILABLE"
  | "INVALID_FISCAL_INPUT"
  | "FISCAL_NOT_FOUND"
  | "FISCAL_FORBIDDEN"
  | "FISCAL_CONFLICT"
  | "FISCAL_PROVIDER_TIMEOUT"
  | "FISCAL_PROVIDER_REJECTED"
  | "FISCAL_INTERNAL";

export const fiscalMessages: Record<FiscalErrorCode, string> = {
  FISCAL_NOT_CONFIGURED: "Conclua a configuração fiscal antes de emitir.",
  NFSE_PROVIDER_STANDBY: "A integração com a NFS-e Nacional ainda está em homologação.",
  CERTIFICATE_STORE_UNAVAILABLE: "O armazenamento seguro do certificado ainda não está configurado.",
  INVALID_FISCAL_INPUT: "Revise as informações necessárias para emitir a NFS-e.",
  FISCAL_NOT_FOUND: "Registro fiscal não encontrado.",
  FISCAL_FORBIDDEN: "Você não tem permissão para acessar este registro fiscal.",
  FISCAL_CONFLICT: "Esta emissão já foi registrada e não será duplicada.",
  FISCAL_PROVIDER_TIMEOUT: "O serviço fiscal demorou para responder. A Weeki verificará o status antes de tentar novamente.",
  FISCAL_PROVIDER_REJECTED: "A NFS-e não foi autorizada. Revise os dados indicados.",
  FISCAL_INTERNAL: "Não foi possível concluir a operação fiscal.",
};

export class FiscalError extends Error {
  constructor(public code: FiscalErrorCode, public status = 400, public safeContext: Record<string, unknown> = {}) {
    super(fiscalMessages[code]);
    this.name = "FiscalError";
  }
}

export function fiscalErrorCode(error: unknown): FiscalErrorCode {
  return error instanceof FiscalError ? error.code : "FISCAL_INTERNAL";
}
