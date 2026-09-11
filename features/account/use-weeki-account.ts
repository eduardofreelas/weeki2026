"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AccountProfileInput,
  AccountSession,
  AccountSessionResponse,
  AuthProviderId,
  OnboardingInput,
} from "@/shared/account";

export const accountApiEnabled = process.env.NEXT_PUBLIC_AUTH_API_ENABLED === "true";

export class AccountApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function accountRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!accountApiEnabled) {
    throw new AccountApiError("VISUAL_ONLY", "A autenticação real ainda não está ativada nesta instalação.");
  }
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new AccountApiError("UNAVAILABLE", "Não foi possível acessar a conta. Tente novamente.");
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new AccountApiError("NOT_CONFIGURED", "A autenticação ainda precisa ser configurada no servidor.");
  }
  const data = await response.json();
  if (!response.ok) {
    throw new AccountApiError(data.code || "UNAVAILABLE", data.message || "Não foi possível concluir.");
  }
  return data as T;
}

const authRedirect = (path: string, params: Record<string, string | boolean | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === false) return;
    search.set(key, value === true ? "true" : value);
  });
  window.location.assign(new URL(`${path}?${search.toString()}`, window.location.origin).href);
};

export function shouldShowOnboarding(session: AccountSession | null) {
  if (!session) return false;
  return session.onboarding.status === "not_started" || session.onboarding.status === "in_progress";
}

export function useWeekiAccount() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [loading, setLoading] = useState(accountApiEnabled);
  const [authConfigured, setAuthConfigured] = useState(accountApiEnabled);
  const [authenticated, setAuthenticated] = useState(!accountApiEnabled);
  const [error, setError] = useState<AccountApiError | null>(null);

  const reload = useCallback(async () => {
    if (!accountApiEnabled) {
      setSession(null);
      setAuthConfigured(false);
      setAuthenticated(true);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const response = await accountRequest<AccountSessionResponse>("/api/account/session");
      setSession(response.session);
      setAuthConfigured(response.authConfigured);
      setAuthenticated(response.authenticated);
      setError(null);
    } catch (e) {
      if (e instanceof AccountApiError && e.code === "UNAUTHENTICATED") {
        setSession(null);
        setAuthConfigured(true);
        setAuthenticated(false);
        setError(null);
      } else {
        setError(e as AccountApiError);
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  const loginWithEmail = useCallback((email: string, returnTo = "/") => {
    authRedirect("/api/auth/login", { provider: "email", login_hint: email, returnTo });
  }, []);

  const signUpWithEmail = useCallback((input: { name: string; email: string; termsAccepted: boolean; returnTo?: string }) => {
    authRedirect("/api/auth/signup", {
      provider: "email",
      login_hint: input.email,
      name: input.name,
      terms: input.termsAccepted ? "accepted" : undefined,
      returnTo: input.returnTo || "/",
    });
  }, []);

  const continueWithProvider = useCallback((provider: Extract<AuthProviderId, "google" | "apple">, returnTo = "/") => {
    authRedirect(`/api/auth/oauth/${provider}`, { returnTo });
  }, []);

  const logout = useCallback(async () => {
    await accountRequest<{ success: boolean }>("/api/auth/logout", { method: "POST" });
    setSession(null);
    setAuthenticated(false);
  }, []);

  const requestPasswordReset = useCallback((email: string) =>
    accountRequest<{ success: boolean; resetUrl: string | null; message: string }>("/api/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    }), []);

  const updateProfile = useCallback(async (input: AccountProfileInput) => {
    const profile = await accountRequest<AccountSession["profile"]>("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    await reload();
    return profile;
  }, [reload]);

  const updateOnboarding = useCallback(async (input: OnboardingInput) => {
    const onboarding = await accountRequest<AccountSession["onboarding"]>("/api/account/onboarding", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    await reload();
    return onboarding;
  }, [reload]);

  return {
    accountApiEnabled,
    session,
    loading,
    authConfigured,
    authenticated,
    error,
    reload,
    loginWithEmail,
    signUpWithEmail,
    continueWithProvider,
    requestPasswordReset,
    updateProfile,
    updateOnboarding,
    logout,
  };
}

export function accountMessage(error: unknown) {
  return error instanceof AccountApiError ? error.message : "Não foi possível concluir. Tente novamente.";
}
