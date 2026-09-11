export class ContractError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public retryable = false,
  ) {
    super(code);
  }
}

export const contractMessages: Record<string, string> = {
  UNAUTHENTICATED: "Entre na sua conta para gerenciar contratos.",
  FORBIDDEN: "Você não tem permissão para esta operação.",
  CONTRACT_NOT_FOUND: "Contrato não encontrado.",
  CONTRACT_NOT_CONFIGURED: "O módulo de contratos ainda não está configurado.",
  CONTRACT_AI_NOT_CONFIGURED: "A geração com IA ainda precisa ser habilitada no servidor.",
  CONTRACT_SIGNATURE_NOT_CONFIGURED: "A assinatura eletrônica ainda precisa de credenciais do provedor.",
  CONTRACT_SIGNATURE_STANDBY: "A assinatura eletrônica está preparada, mas aguarda ativação do provedor.",
  CONTRACT_INVALID_INPUT: "Confira os dados do contrato.",
  CONTRACT_CONFLICT: "Esta operação já existe ou está em processamento.",
  CONTRACT_IMMUTABLE_VERSION: "A versão enviada para assinatura não pode ser alterada.",
  CONTRACT_PROVIDER_UNAVAILABLE: "O provedor de assinatura está indisponível. Tente novamente em instantes.",
  CONTRACT_WEBHOOK_INVALID: "Notificação de assinatura inválida.",
  CONTRACT_WEBHOOK_NOT_FOUND: "Solicitação de assinatura não encontrada para este evento.",
  CONTRACT_INTERNAL: "Não foi possível concluir a operação.",
};

export function contractErrorCode(error: unknown) {
  return error instanceof ContractError ? error.code : "CONTRACT_INTERNAL";
}
