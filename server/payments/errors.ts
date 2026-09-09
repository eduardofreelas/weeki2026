export class PaymentError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public retryable = false,
  ) {
    super(code);
  }
}
export const messages: Record<string, string> = {
  UNAUTHENTICATED: "Entre na sua conta para gerenciar pagamentos.",
  FORBIDDEN: "Você não tem permissão para esta operação.",
  NOT_FOUND: "Registro não encontrado.",
  NOT_CONFIGURED: "A conexão ainda precisa ser habilitada pela Weeki.",
  RECONNECT_REQUIRED:
    "Sua autorização expirou ou foi revogada. Reconecte a conta.",
  DISCONNECTED: "Conecte uma conta para continuar.",
  UNAVAILABLE:
    "O provedor está indisponível. Tente novamente em alguns instantes.",
  TIMEOUT:
    "O provedor demorou para responder. Consulte o status antes de tentar novamente.",
  INVALID_CREDENTIAL: "Não foi possível validar a autorização desta conta.",
  ACCOUNT_BLOCKED: "Esta conta não está habilitada para receber pagamentos.",
  METHOD_UNAVAILABLE:
    "Esta forma de pagamento não está disponível para a conta selecionada.",
  INVALID_INPUT: "Confira os dados informados.",
  CONFLICT:
    "Esta operação já existe ou está em processamento. Atualize o status.",
  UNSUPPORTED:
    "Esta operação não é suportada neste fluxo. Gerencie-a no provedor.",
  INVALID_WEBHOOK: "Notificação inválida.",
  INVALID_STATE: "A autorização expirou. Inicie a conexão novamente.",
  OWNERSHIP_MISMATCH: "Não foi possível validar a cobrança nesta conta.",
  AMOUNT_MISMATCH: "O valor retornado pelo provedor precisa de revisão.",
  RECONCILIATION_REQUIRED:
    "A operação precisa ser conferida no provedor antes de continuar.",
  INTERNAL: "Não foi possível concluir a operação.",
};
export function errorCode(error: unknown) {
  return error instanceof PaymentError ? error.code : "INTERNAL";
}
