"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { createSeedBillingCharges } from "./seed";
import type { FinanceTransaction } from "@/features/finance/types";
import type { BillingCharge, BillingChargeDraft, BillingEvent, BillingGatewaySettings, BillingSendChannel, BillingStatus } from "./types";

const CHARGES_KEY = "weeki.billing.charges.v1";
const SETTINGS_KEY = "weeki.billing.gateway.v1";
const FINANCE_KEY = "weeki.finance.transactions.v1";

const defaultSettings: BillingGatewaySettings = {
  provider: "asaas",
  connected: false,
  environment: "sandbox",
  pixEnabled: true,
  cardEnabled: true,
  bankSlipEnabled: false,
};

const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 34) || "cobranca";
const eventFor = (kind: BillingEvent["kind"], title: string, description: string): BillingEvent => ({ id: makeId(), kind, title, description, createdAt: new Date().toISOString() });

function readStorage<T>(key: string, fallback: () => T): T {
  if (typeof window === "undefined") return fallback();
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback();
  } catch {
    return fallback();
  }
}

function normalizeOverdue(charges: BillingCharge[]) {
  const today = format(new Date(), "yyyy-MM-dd");
  return charges.map((charge) => charge.status === "pending" && charge.dueDate < today ? { ...charge, status: "overdue" as const } : charge);
}

function syncPaidChargeToFinance(charge: BillingCharge) {
  try {
    const current = JSON.parse(window.localStorage.getItem(FINANCE_KEY) || "[]") as FinanceTransaction[];
    const id = `billing-${charge.id}`;
    if (current.some((item) => item.id === id)) return;
    const now = new Date().toISOString();
    current.unshift({
      id,
      type: "income",
      description: charge.description,
      clientId: charge.clientId,
      partnerName: "",
      category: "Receita de cobrança",
      amount: charge.amount,
      dueDate: charge.dueDate,
      paidDate: format(new Date(), "yyyy-MM-dd"),
      status: "paid",
      paymentMethod: charge.methods.includes("pix") ? "pix" : charge.methods.includes("credit_card") ? "credit_card" : "bank_slip",
      account: "Conta principal",
      recurring: false,
      recurrence: "monthly",
      recurrenceEndDate: "",
      notes: `Recebimento sincronizado da cobrança ${charge.code}.`,
      attachmentName: "",
      createdAt: now,
      updatedAt: now,
    });
    window.localStorage.setItem(FINANCE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event("weeki-storage"));
  } catch {
    // Financial synchronization is best-effort while data is stored locally.
  }
}

export function useWeekiBilling() {
  const [charges, setCharges] = useState<BillingCharge[]>(() => normalizeOverdue(readStorage(CHARGES_KEY, createSeedBillingCharges)));
  const [gatewaySettings, setGatewaySettings] = useState<BillingGatewaySettings>(() => readStorage(SETTINGS_KEY, () => defaultSettings));

  useEffect(() => {
    try { window.localStorage.setItem(CHARGES_KEY, JSON.stringify(charges)); } catch { /* Browser storage is optional. */ }
  }, [charges]);

  useEffect(() => {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(gatewaySettings)); } catch { /* Browser storage is optional. */ }
  }, [gatewaySettings]);

  const addCharge = useCallback((draft: BillingChargeDraft, asDraft = false) => {
    const now = new Date().toISOString();
    const id = makeId();
    const sequence = String(Date.now()).slice(-5);
    const code = `COB-${format(new Date(), "yyyy")}-${sequence}`;
    const charge: BillingCharge = {
      ...draft,
      id,
      code,
      status: asDraft ? "draft" : draft.dueDate < format(new Date(), "yyyy-MM-dd") ? "overdue" : "pending",
      paymentLink: `/pagar/${slugify(draft.description)}-${sequence}`,
      accessCount: 0,
      lastAccessAt: "",
      paidAt: "",
      sentChannels: [],
      events: [eventFor("created", asDraft ? "Rascunho criado" : "Cobrança gerada", asDraft ? "Configuração salva para continuar depois." : "Link demonstrativo preparado para compartilhamento.")],
      createdAt: now,
      updatedAt: now,
    };
    setCharges((current) => [charge, ...current]);
    return charge;
  }, []);

  const updateCharge = useCallback((id: string, draft: BillingChargeDraft) => {
    let updated: BillingCharge | null = null;
    setCharges((current) => current.map((charge) => {
      if (charge.id !== id) return charge;
      updated = { ...charge, ...draft, updatedAt: new Date().toISOString(), events: [...charge.events, eventFor("updated", "Cobrança atualizada", "As condições da cobrança foram revisadas.")] };
      return updated;
    }));
    return updated;
  }, []);

  const setChargeStatus = useCallback((id: string, status: BillingStatus) => {
    setCharges((current) => current.map((charge) => {
      if (charge.id !== id) return charge;
      const title = status === "paid" ? "Pagamento confirmado" : status === "cancelled" ? "Cobrança cancelada" : "Status atualizado";
      const updated = { ...charge, status, paidAt: status === "paid" ? new Date().toISOString() : charge.paidAt, updatedAt: new Date().toISOString(), events: [...charge.events, eventFor(status === "paid" ? "paid" : status === "cancelled" ? "cancelled" : "updated", title, status === "paid" ? "Recebimento registrado e enviado ao Financeiro." : `Novo status: ${status}.`)] };
      if (status === "paid") syncPaidChargeToFinance(updated);
      return updated;
    }));
  }, []);

  const registerDispatch = useCallback((id: string, channel: BillingSendChannel) => {
    setCharges((current) => current.map((charge) => charge.id === id ? {
      ...charge,
      sentChannels: charge.sentChannels.includes(channel) ? charge.sentChannels : [...charge.sentChannels, channel],
      updatedAt: new Date().toISOString(),
      events: [...charge.events, eventFor("sent", channel === "whatsapp" ? "Link preparado para WhatsApp" : channel === "email" ? "Link preparado para e-mail" : "Link copiado", "O link demonstrativo foi copiado para compartilhamento.")],
    } : charge));
  }, []);

  const extendDueDate = useCallback((id: string, dueDate: string) => {
    setCharges((current) => current.map((charge) => charge.id === id ? { ...charge, dueDate, status: charge.status === "overdue" ? "pending" : charge.status, updatedAt: new Date().toISOString(), events: [...charge.events, eventFor("due_extended", "Vencimento alterado", `Nova data: ${dueDate}.`)] } : charge));
  }, []);

  return { charges, gatewaySettings, setGatewaySettings, addCharge, updateCharge, setChargeStatus, registerDispatch, extendDueDate };
}
