"use client";
import { useCallback, useEffect, useState } from "react";
import type { PaymentsOverview } from "@/shared/payments";
export class PaymentsApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function paymentRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/payments${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new PaymentsApiError(
      "UNAVAILABLE",
      "Não foi possível acessar os pagamentos. Tente novamente.",
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new PaymentsApiError(
      "NOT_CONFIGURED",
      "A configuração de pagamentos ainda não foi concluída.",
    );
  const data = await response.json();
  if (!response.ok)
    throw new PaymentsApiError(
      data.code || "UNAVAILABLE",
      data.message || "Não foi possível concluir a operação.",
    );
  return data;
}
export const paymentPost = <T>(path: string, body?: unknown, key?: string) =>
  paymentRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: key ? { "Idempotency-Key": key } : undefined,
  });
export function usePayments() {
  const [overview, setOverview] = useState<PaymentsOverview | null>(null);
  const [error, setError] = useState<PaymentsApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const data = await paymentRequest<PaymentsOverview>("/connections");
      setOverview(data);
      setError(null);
    } catch (e) {
      setOverview(null);
      setError(e as PaymentsApiError);
    } finally {
      setLoading(false);
    }
  }, []);
  // Fetch authenticated server state on mount; no credentials or payment data are persisted in the browser.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);
  return { overview, error, loading, reload };
}
export function paymentMessage(e: unknown) {
  return e instanceof PaymentsApiError
    ? e.message
    : "Não foi possível concluir. Tente novamente.";
}
