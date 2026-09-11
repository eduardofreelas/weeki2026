"use client";

import type {
  ContractAiGenerationInput,
  ContractAiGenerationResult,
  ContractsOverview,
  WeekiContract,
} from "@/shared/contracts";

const enabled = (value: string | undefined, fallback = false) =>
  value === undefined ? fallback : value === "true";

export const CONTRACTS_FLAGS = {
  moduleEnabled: enabled(process.env.NEXT_PUBLIC_CONTRACTS_MODULE_ENABLED, true),
  apiEnabled: enabled(process.env.NEXT_PUBLIC_CONTRACTS_API_ENABLED),
  aiEnabled: enabled(process.env.NEXT_PUBLIC_CONTRACTS_AI_ENABLED),
  signatureEnabled: enabled(process.env.NEXT_PUBLIC_CONTRACTS_SIGNATURE_ENABLED),
} as const;

export const CONTRACTS_VISUAL_MODE = !CONTRACTS_FLAGS.apiEnabled;

export class ContractsApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function contractsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!CONTRACTS_FLAGS.apiEnabled) {
    throw new ContractsApiError(
      "VISUAL_ONLY",
      "O backend de contratos ainda não está ativado nesta versão.",
    );
  }
  let response: Response;
  try {
    response = await fetch(`/api/contracts${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ContractsApiError(
      "UNAVAILABLE",
      "Não foi possível acessar contratos. Tente novamente.",
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new ContractsApiError(
      "NOT_CONFIGURED",
      "A configuração do módulo de contratos ainda não foi concluída.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    throw new ContractsApiError(
      data.code || "UNAVAILABLE",
      data.message || "Não foi possível concluir a operação.",
    );
  }
  return data;
}

export const contractsPost = <T>(path: string, body?: unknown, key?: string) =>
  contractsRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: key ? { "Idempotency-Key": key } : undefined,
  });

export const contractsPut = <T>(path: string, body: unknown) =>
  contractsRequest<T>(path, { method: "PUT", body: JSON.stringify(body) });

export function contractsMessage(error: unknown) {
  return error instanceof ContractsApiError
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
}

export async function fetchContractsOverview() {
  return contractsRequest<ContractsOverview>("/overview");
}

export async function generateContractWithAi(input: ContractAiGenerationInput) {
  return contractsPost<ContractAiGenerationResult>("/ai/generate", input);
}

export async function sendContractForSignature(contractId: string, idempotencyKey: string) {
  return contractsPost<WeekiContract>(`/contracts/${contractId}/signature/send`, undefined, idempotencyKey);
}
