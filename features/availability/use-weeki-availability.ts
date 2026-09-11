"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createDefaultAvailability,
  normalizeAvailability,
  validateAvailability,
  type WeekiAvailability,
} from "@/shared/availability";
import { accountApiEnabled } from "@/features/account/use-weeki-account";

const AVAILABILITY_KEY = "weeki.availability.v1";

const browserTimezone = (fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
};

function readLocal(fallbackTimezone: string) {
  if (typeof window === "undefined") return createDefaultAvailability(fallbackTimezone);
  try {
    const saved = window.localStorage.getItem(AVAILABILITY_KEY);
    return normalizeAvailability(saved ? JSON.parse(saved) as WeekiAvailability : createDefaultAvailability(browserTimezone(fallbackTimezone)));
  } catch {
    return createDefaultAvailability(browserTimezone(fallbackTimezone));
  }
}

async function requestAvailability(input?: WeekiAvailability) {
  const response = await fetch("/api/account/availability", {
    method: input ? "PATCH" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: input ? { "Content-Type": "application/json" } : undefined,
    body: input ? JSON.stringify(input) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("A disponibilidade autenticada ainda não está configurada.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Não foi possível salvar a disponibilidade.");
  return normalizeAvailability(data as WeekiAvailability);
}

export function useWeekiAvailability(fallbackTimezone: string, remoteAvailability?: WeekiAvailability | null) {
  const [availability, setAvailability] = useState<WeekiAvailability>(() => normalizeAvailability(remoteAvailability || readLocal(fallbackTimezone)));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!remoteAvailability) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailability(normalizeAvailability(remoteAvailability));
  }, [remoteAvailability]);

  useEffect(() => {
    if (accountApiEnabled || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(availability));
    } catch {
      /* local storage is optional */
    }
  }, [availability]);

  const validation = useMemo(() => validateAvailability(availability), [availability]);

  const reload = useCallback(async () => {
    if (!accountApiEnabled) return availability;
    setLoading(true);
    try {
      const next = await requestAvailability();
      setAvailability(next);
      setError(null);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a disponibilidade.");
      return availability;
    } finally {
      setLoading(false);
    }
  }, [availability]);

  const saveAvailability = useCallback(async (input: WeekiAvailability) => {
    const normalized = normalizeAvailability(input);
    const result = validateAvailability(normalized);
    if (!result.valid) throw new Error(result.errors[0] || "Revise os horários informados.");
    setSaving(true);
    try {
      const timestamped = normalizeAvailability({
        ...normalized,
        configuredAt: normalized.configuredAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const next = accountApiEnabled ? await requestAvailability(timestamped) : timestamped;
      setAvailability(next);
      setError(null);
      return next;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível salvar a disponibilidade.";
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    availability,
    setAvailability,
    validation,
    loading,
    saving,
    error,
    reload,
    saveAvailability,
  };
}
