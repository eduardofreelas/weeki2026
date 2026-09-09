"use client";

import { useCallback, useEffect, useState } from "react";
import type { WeekiSettings } from "./types";

export const SETTINGS_KEY = "weeki.settings.v1";

export const defaultWeekiSettings: WeekiSettings = {
  profile: {
    name: "Eduardo Vieira",
    email: "eduardo@weeki.com.br",
    phone: "",
    businessName: "Weeki",
    role: "Administrador",
  },
  regional: {
    timezone: "America/Fortaleza",
    language: "pt-BR",
    dateFormat: "dd/MM/yyyy",
    timeFormat: "24h",
    weekStartsOn: "monday",
    currency: "BRL",
  },
  appearance: {
    theme: "light",
    density: "comfortable",
  },
  notifications: {
    inApp: true,
    email: true,
    dailySummary: true,
    deadlineReminders: true,
    appointmentReminders: true,
    paymentUpdates: true,
    productNews: false,
  },
  security: {
    twoFactorEnabled: false,
    loginAlerts: true,
    sessionTimeout: "30d",
  },
  privacy: {
    usageAnalytics: true,
    personalization: true,
  },
  integrations: {
    google_calendar: false,
    google_drive: false,
    trello: false,
    asaas: false,
  },
};

function mergeWithDefaults(saved?: Partial<WeekiSettings>): WeekiSettings {
  return {
    ...defaultWeekiSettings,
    ...saved,
    profile: { ...defaultWeekiSettings.profile, ...saved?.profile },
    regional: { ...defaultWeekiSettings.regional, ...saved?.regional },
    appearance: { ...defaultWeekiSettings.appearance, ...saved?.appearance },
    notifications: { ...defaultWeekiSettings.notifications, ...saved?.notifications },
    security: { ...defaultWeekiSettings.security, ...saved?.security },
    privacy: { ...defaultWeekiSettings.privacy, ...saved?.privacy },
    integrations: { ...defaultWeekiSettings.integrations, ...saved?.integrations },
  };
}

function readSettings(): WeekiSettings {
  if (typeof window === "undefined") return defaultWeekiSettings;
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    return mergeWithDefaults(saved ? JSON.parse(saved) as Partial<WeekiSettings> : undefined);
  } catch {
    return defaultWeekiSettings;
  }
}

function resolveTheme(theme: WeekiSettings["appearance"]["theme"]) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useWeekiSettings() {
  const [settings, setSettings] = useState<WeekiSettings>(readSettings);

  useEffect(() => {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage is optional. */ }
  }, [settings]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = resolveTheme(settings.appearance.theme);
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.density = settings.appearance.density;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.appearance.density, settings.appearance.theme]);

  const updateSettings = useCallback((updates: Partial<WeekiSettings>) => {
    setSettings((current) => mergeWithDefaults({ ...current, ...updates }));
  }, []);

  const resetSettings = useCallback(() => setSettings(defaultWeekiSettings), []);

  return { settings, updateSettings, resetSettings };
}

