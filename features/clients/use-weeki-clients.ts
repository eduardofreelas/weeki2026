"use client";

import { useCallback, useEffect, useState } from "react";
import { createSeedClients } from "./seed";
import type { Client, ClientDraft } from "./types";

const STORAGE_KEY = "weeki.clients.v1";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const initialsFromName = (name: string) => name
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "")
  .join("") || "CL";

const normalizeFiscal = (client: Pick<Client, "email" | "fiscal">) => ({
  municipalRegistration: "",
  zipCode: "",
  city: "",
  cityCode: "",
  state: "",
  fiscalEmail: client.email || "",
  ...client.fiscal,
});

const normalizeClient = (client: Client): Client => ({
  ...client,
  fiscal: normalizeFiscal(client),
});

export function useWeekiClients() {
  const [clients, setClients] = useState<Client[]>(() => {
    if (typeof window === "undefined") return createSeedClients().map(normalizeClient);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const loaded = saved ? JSON.parse(saved) as Client[] : createSeedClients();
      return loaded.map(normalizeClient);
    } catch {
      return createSeedClients().map(normalizeClient);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch {
      // The app remains usable when browser storage is unavailable.
    }
  }, [clients]);

  const addClient = useCallback((draft: ClientDraft) => {
    const now = new Date().toISOString();
    const client: Client = {
      ...draft,
      fiscal: normalizeFiscal(draft),
      id: makeId(),
      initials: initialsFromName(draft.name),
      createdAt: now,
      updatedAt: now,
    };
    setClients((current) => [client, ...current]);
    return client;
  }, []);

  const updateClient = useCallback((id: string, draft: ClientDraft) => {
    let updatedClient: Client | null = null;
    setClients((current) => current.map((client) => {
      if (client.id !== id) return client;
      updatedClient = {
        ...client,
        ...draft,
        fiscal: normalizeFiscal(draft),
        initials: initialsFromName(draft.name),
        updatedAt: new Date().toISOString(),
      };
      return updatedClient;
    }));
    return updatedClient;
  }, []);

  return { clients, addClient, updateClient };
}
