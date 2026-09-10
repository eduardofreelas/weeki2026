"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import type { Client } from "@/features/clients/types";
import { FISCAL_FLAGS } from "./config";
import { createDefaultFiscalState } from "./defaults";
import {
  WEEKI_DOMAIN_EVENTS,
  type PaymentConfirmedEvent,
  type ServiceCompletedEvent,
} from "./events";
import type {
  CreateNfseResult,
  FiscalPendingAction,
  FiscalWorkspaceState,
  NfseDraftInput,
} from "./types";
import { validateNfseRequest } from "./validation";
import {
  emptyFiscalAddress,
  type FiscalAutomationSettings,
  type FiscalProfile,
  type FiscalServiceConfig,
  type NfseEvent,
  type NfseRecord,
  type NfseRequest,
} from "@/shared/fiscal";

const STORAGE_KEY = "weeki.fiscal.workspace.v1";
const WORKSPACE_ID = "local-visual-workspace";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const makeEvent = (
  kind: NfseEvent["kind"],
  title: string,
  description: string,
): NfseEvent => ({ id: makeId(), kind, title, description, createdAt: new Date().toISOString() });

function normalizeState(value: Partial<FiscalWorkspaceState> | null | undefined): FiscalWorkspaceState {
  const defaults = createDefaultFiscalState();
  return {
    ...defaults,
    ...value,
    version: 1,
    profile: {
      ...defaults.profile,
      ...value?.profile,
      address: { ...defaults.profile.address, ...value?.profile?.address },
      environment: "sandbox",
    },
    automation: { ...defaults.automation, ...value?.automation, whatsappEnabled: false },
    certificate: value?.certificate ?? null,
    serviceConfigs: Array.isArray(value?.serviceConfigs) ? value.serviceConfigs : [],
    notes: Array.isArray(value?.notes) ? value.notes : [],
  };
}

function readState() {
  if (typeof window === "undefined") return createDefaultFiscalState();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return normalizeState(saved ? JSON.parse(saved) as Partial<FiscalWorkspaceState> : null);
  } catch {
    return createDefaultFiscalState();
  }
}

function clientToFiscal(client: Client) {
  const fiscal = client.fiscal;
  return {
    localId: client.id,
    personType: client.kind === "company" ? "company" as const : "individual" as const,
    document: client.document,
    name: client.name,
    municipalRegistration: fiscal?.municipalRegistration ?? "",
    email: fiscal?.fiscalEmail || client.email,
    phone: client.phone,
    address: {
      ...emptyFiscalAddress(),
      street: client.address,
      zipCode: fiscal?.zipCode ?? "",
      city: fiscal?.city ?? "",
      cityCode: fiscal?.cityCode ?? "",
      state: fiscal?.state ?? "",
    },
  };
}

function requestFrom(
  state: FiscalWorkspaceState,
  clients: Client[],
  input: NfseDraftInput,
): NfseRequest | null {
  const client = clients.find((item) => item.id === input.clientId);
  const service = state.serviceConfigs.find((item) => item.id === input.serviceConfigId);
  if (!client || !service) return null;
  const baseCustomer = clientToFiscal(client);
  const customer = {
    ...baseCustomer,
    ...input.customerOverride,
    address: { ...baseCustomer.address, ...input.customerOverride?.address },
  };
  const normalizedService = {
    localId: service.localId,
    name: service.name,
    fiscalDescription: service.fiscalDescription,
    serviceCode: service.serviceCode,
    taxationCode: service.taxationCode,
    defaultAmount: service.defaultAmount,
    incidenceCity: service.incidenceCity,
    incidenceCityCode: service.incidenceCityCode,
    operationNature: service.operationNature,
    tax: { ...service.tax },
  };
  return {
    idempotencyKey: input.idempotencyKey || makeId(),
    environment: "sandbox",
    origin: input.origin,
    issuer: {
      personType: state.profile.personType,
      document: state.profile.document,
      legalName: state.profile.legalName,
      tradeName: state.profile.tradeName,
      municipalRegistration: state.profile.municipalRegistration,
      email: state.profile.email,
      phone: state.profile.phone,
      address: { ...state.profile.address },
      taxRegime: state.profile.taxRegime,
      simpleNational: state.profile.simpleNational,
      mei: state.profile.mei,
    },
    customer,
    service: {
      ...normalizedService,
      ...input.serviceOverride,
      tax: { ...normalizedService.tax, ...input.serviceOverride?.tax },
    },
    description: input.description || service.fiscalDescription,
    amount: input.amount,
    competenceDate: input.competenceDate,
    clientId: client.id,
    serviceConfigId: service.id,
    taskId: input.taskId ?? null,
    chargeId: input.chargeId ?? null,
    projectId: input.projectId ?? null,
  };
}

function recordFrom(request: NfseRequest, queued: boolean): NfseRecord {
  const now = new Date().toISOString();
  const status = queued ? "PENDING" as const : "DRAFT" as const;
  return {
    id: makeId(),
    workspaceId: WORKSPACE_ID,
    idempotencyKey: request.idempotencyKey,
    status,
    environment: "sandbox",
    provider: "national_nfse",
    providerReference: "",
    providerStatus: "",
    origin: request.origin,
    issuer: request.issuer,
    customer: request.customer,
    service: request.service,
    description: request.description,
    amount: request.amount,
    competenceDate: request.competenceDate,
    issuedAt: null,
    number: "",
    series: "",
    accessKey: "",
    municipality: request.service.incidenceCity || request.issuer.address.city,
    issAmount: request.amount * (request.service.tax.issRate / 100),
    withholdingAmount: 0,
    clientId: request.clientId,
    serviceConfigId: request.serviceConfigId,
    taskId: request.taskId ?? null,
    chargeId: request.chargeId ?? null,
    projectId: request.projectId ?? null,
    documents: [],
    errors: [],
    events: [
      makeEvent("created", queued ? "Emissão preparada" : "Rascunho criado", queued
        ? "A nota foi validada e aguarda a ativação segura do provedor fiscal."
        : "A nota foi salva para continuar depois."),
    ],
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function useWeekiFiscal(clients: Client[]) {
  const [state, setState] = useState<FiscalWorkspaceState>(readState);
  const [pendingAction, setPendingAction] = useState<FiscalPendingAction | null>(null);
  const stateRef = useRef(state);
  const clientsRef = useRef(clients);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    // This is a visual sandbox fallback. Real fiscal data uses the server-only repository.
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage is optional in visual mode. */ }
  }, [state]);

  const updateProfile = useCallback((profile: FiscalProfile) => {
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      profile: {
        ...profile,
        environment: "sandbox",
        updatedAt: now,
        configuredAt: profile.configuredAt || now,
      },
    }));
  }, []);

  const updateAutomation = useCallback((automation: FiscalAutomationSettings) => {
    setState((current) => ({ ...current, automation: { ...automation, whatsappEnabled: false } }));
  }, []);

  const saveServiceConfig = useCallback((draft: Omit<FiscalServiceConfig, "id" | "createdAt" | "updatedAt">, id?: string) => {
    const now = new Date().toISOString();
    const saved: FiscalServiceConfig = {
      ...draft,
      id: id || makeId(),
      createdAt: id ? stateRef.current.serviceConfigs.find((item) => item.id === id)?.createdAt || now : now,
      updatedAt: now,
    };
    setState((current) => ({
      ...current,
      serviceConfigs: id
        ? current.serviceConfigs.map((item) => item.id === id ? saved : item)
        : [saved, ...current.serviceConfigs],
    }));
    return saved;
  }, []);

  const setServiceActive = useCallback((id: string, active: boolean) => {
    setState((current) => ({
      ...current,
      serviceConfigs: current.serviceConfigs.map((item) => item.id === id
        ? { ...item, active, updatedAt: new Date().toISOString() }
        : item),
    }));
  }, []);

  const validateDraft = useCallback((input: NfseDraftInput) => {
    const request = requestFrom(stateRef.current, clientsRef.current, input);
    if (!request) return {
      valid: false,
      issues: [{ section: "note" as const, field: "references", code: "REFERENCE_NOT_FOUND", message: "Selecione um cliente e um serviço fiscal válidos." }],
    };
    return validateNfseRequest(request);
  }, []);

  const createDraft = useCallback((input: NfseDraftInput, queued = false): CreateNfseResult => {
    const current = stateRef.current;
    const request = requestFrom(current, clientsRef.current, input);
    if (!request) return { note: null, duplicate: false, issues: [{ field: "references", message: "Selecione um cliente e um serviço fiscal válidos." }] };
    const validation = validateNfseRequest(request);
    if (queued && !validation.valid) return { note: null, duplicate: false, issues: validation.issues };
    const existing = current.notes.find((item) => item.idempotencyKey === request.idempotencyKey);
    if (existing) return { note: existing, duplicate: true, issues: [] };
    const note = recordFrom(request, queued);
    setState((latest) => ({ ...latest, notes: [note, ...latest.notes] }));
    return { note, duplicate: false, issues: validation.issues };
  }, []);

  const queueNote = useCallback((id: string): CreateNfseResult => {
    const note = stateRef.current.notes.find((item) => item.id === id);
    if (!note) return { note: null, duplicate: false, issues: [{ field: "note", message: "Nota não encontrada." }] };
    const request: NfseRequest = {
      idempotencyKey: note.idempotencyKey,
      environment: note.environment,
      origin: note.origin,
      issuer: note.issuer,
      customer: note.customer,
      service: note.service,
      description: note.description,
      amount: note.amount,
      competenceDate: note.competenceDate,
      clientId: note.clientId,
      serviceConfigId: note.serviceConfigId,
      taskId: note.taskId,
      chargeId: note.chargeId,
      projectId: note.projectId,
    };
    const validation = validateNfseRequest(request);
    if (!validation.valid) return { note, duplicate: false, issues: validation.issues };
    const updated: NfseRecord = {
      ...note,
      status: "PENDING",
      updatedAt: new Date().toISOString(),
      events: [makeEvent("issue_requested", "Emissão preparada", "A solicitação aguarda a ativação segura da integração nacional."), ...note.events],
    };
    setState((current) => ({ ...current, notes: current.notes.map((item) => item.id === id ? updated : item) }));
    return { note: updated, duplicate: false, issues: [] };
  }, []);

  const requestRealIssue = useCallback((id: string) => {
    void id;
    if (!FISCAL_FLAGS.nationalIntegrationEnabled) return { ok: false, code: "NFSE_PROVIDER_STANDBY" } as const;
    // Real issue requests are server-only; the browser never builds or signs XML.
    return { ok: false, code: "FISCAL_API_REQUIRED" } as const;
  }, []);

  const cancelPreparedNote = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      notes: current.notes.map((item) => item.id === id && ["DRAFT", "PENDING", "REJECTED", "ERROR"].includes(item.status)
        ? {
            ...item,
            status: "CANCELLED",
            updatedAt: new Date().toISOString(),
            events: [makeEvent("cancelled", "Preparação cancelada", "O registro local foi cancelado; nenhuma ação fiscal foi transmitida."), ...item.events],
          }
        : item),
    }));
  }, []);

  const dismissOnboarding = useCallback(() => setState((current) => ({ ...current, onboardingDismissed: true })), []);

  useEffect(() => {
    const onServiceCompleted = (raw: Event) => {
      const detail = (raw as CustomEvent<ServiceCompletedEvent>).detail;
      const current = stateRef.current;
      if (!current.automation.enabled || current.automation.mode === "never" || current.automation.mode === "on_payment_confirmed") return;
      if (!detail.clientId) return;
      setPendingAction({
        source: "service",
        sourceId: detail.taskId,
        clientId: detail.clientId,
        title: detail.title,
        description: detail.description || detail.title,
        amount: 0,
        competenceDate: format(new Date(detail.completedAt), "yyyy-MM-dd"),
      });
    };
    const onPaymentConfirmed = (raw: Event) => {
      const detail = (raw as CustomEvent<PaymentConfirmedEvent>).detail;
      const current = stateRef.current;
      if (!current.automation.enabled || current.automation.mode !== "on_payment_confirmed") return;
      setPendingAction({
        source: "payment",
        sourceId: detail.chargeId,
        clientId: detail.clientId,
        title: detail.description,
        description: detail.description,
        amount: detail.amount,
        competenceDate: format(new Date(detail.paidAt), "yyyy-MM-dd"),
      });
    };
    window.addEventListener(WEEKI_DOMAIN_EVENTS.serviceCompleted, onServiceCompleted);
    window.addEventListener(WEEKI_DOMAIN_EVENTS.paymentConfirmed, onPaymentConfirmed);
    return () => {
      window.removeEventListener(WEEKI_DOMAIN_EVENTS.serviceCompleted, onServiceCompleted);
      window.removeEventListener(WEEKI_DOMAIN_EVENTS.paymentConfirmed, onPaymentConfirmed);
    };
  }, []);

  return {
    state,
    pendingAction,
    setPendingAction,
    updateProfile,
    updateAutomation,
    saveServiceConfig,
    setServiceActive,
    validateDraft,
    createDraft,
    queueNote,
    requestRealIssue,
    cancelPreparedNote,
    dismissOnboarding,
  };
}

export type WeekiFiscalController = ReturnType<typeof useWeekiFiscal>;
