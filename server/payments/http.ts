import { PaymentError } from "./errors.js";
export type Transport = <T>(url: string, init?: RequestInit) => Promise<T>;
// Provider messages/bodies can contain personal data or tokens. Never propagate them to logs or clients.
export const request: Transport = async <T>(
  url: string,
  init: RequestInit = {},
): Promise<T> => {
  const attempts = !init.method || init.method === "GET" ? 3 : 1;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 401)
        throw new PaymentError("RECONNECT_REQUIRED", 409);
      if (response.status === 403)
        throw new PaymentError("ACCOUNT_BLOCKED", 409);
      if (response.status === 404) throw new PaymentError("NOT_FOUND", 404);
      if (response.status === 429 || response.status >= 500)
        throw new PaymentError("UNAVAILABLE", 503, true);
      if (!response.ok) throw new PaymentError("INVALID_INPUT", 422);
      if (response.status === 204) return {} as T;
      return (await response.json()) as T;
    } catch (e) {
      const err =
        e instanceof PaymentError ? e : new PaymentError("TIMEOUT", 503, true);
      if (!err.retryable || i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)));
    }
  }
  throw new PaymentError("UNAVAILABLE", 503, true);
};
export function form(
  value: Record<string, unknown>,
  prefix = "",
  params = new URLSearchParams(),
): URLSearchParams {
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof item === "object")
      form(item as Record<string, unknown>, name, params);
    else params.append(name, String(item));
  }
  return params;
}
export const externalPath = (id: string) => encodeURIComponent(id);
export function hostedUrl(value: unknown, hosts: string[]): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
      ? url.href
      : null;
  } catch {
    return null;
  }
}
