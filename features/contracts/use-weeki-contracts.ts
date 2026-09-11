"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createId } from "@/lib/format";
import {
  deriveContractStatus,
  sanitizeContractHtml,
  type ContractDocument,
  type ContractDraftInput,
  type ContractEvent,
  type ContractTemplate,
  type ContractVersion,
  type WeekiContract,
} from "@/shared/contracts";
import { createSeedContractTemplates } from "./seed";

const CONTRACTS_KEY = "weeki.contracts.records.v1";
const TEMPLATES_KEY = "weeki.contracts.templates.v1";
const WORKSPACE_ID = "local-visual-workspace";

function readStorage<T>(key: string, fallback: () => T): T {
  if (typeof window === "undefined") return fallback();
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback();
  } catch {
    return fallback();
  }
}

function localHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `local-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function event(kind: ContractEvent["kind"], title: string, description: string, actor = "Você"): ContractEvent {
  return { id: createId(), kind, title, description, actor, createdAt: new Date().toISOString() };
}

function version(input: {
  title: string;
  content: string;
  reason: string;
  versionNumber: number;
  aiGenerated?: boolean;
  immutable?: boolean;
}): ContractVersion {
  return {
    id: createId(),
    version: input.versionNumber,
    title: input.title,
    content: sanitizeContractHtml(input.content),
    contentHash: localHash(sanitizeContractHtml(input.content)),
    reason: input.reason,
    aiGenerated: Boolean(input.aiGenerated),
    immutable: Boolean(input.immutable),
    createdAt: new Date().toISOString(),
    createdBy: "Você",
  };
}

function normalizeContract(contract: WeekiContract): WeekiContract {
  const signatureStatus = contract.signatureStatus || "not_started";
  return {
    ...contract,
    workspaceId: contract.workspaceId || WORKSPACE_ID,
    signatureStatus,
    contractStatus: deriveContractStatus({ ...contract, signatureStatus }),
    versions: Array.isArray(contract.versions) ? contract.versions : [],
    documents: Array.isArray(contract.documents) ? contract.documents : [],
    signatureRequests: Array.isArray(contract.signatureRequests) ? contract.signatureRequests : [],
    events: Array.isArray(contract.events) ? contract.events : [],
  };
}

function nextContractNumber(current: WeekiContract[]) {
  const year = new Date().getFullYear();
  const count = current.filter((contract) => contract.number.includes(`-${year}-`)).length + 1;
  return `CTR-${year}-${String(count).padStart(4, "0")}`;
}

export function useWeekiContracts() {
  const [contracts, setContracts] = useState<WeekiContract[]>(() =>
    readStorage(CONTRACTS_KEY, () => [] as WeekiContract[]).map(normalizeContract),
  );
  const [templates, setTemplates] = useState<ContractTemplate[]>(() =>
    readStorage(TEMPLATES_KEY, createSeedContractTemplates),
  );

  useEffect(() => {
    try { window.localStorage.setItem(CONTRACTS_KEY, JSON.stringify(contracts)); } catch { /* Storage is optional. */ }
  }, [contracts]);

  useEffect(() => {
    try { window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); } catch { /* Storage is optional. */ }
  }, [templates]);

  const createContract = useCallback((draft: ContractDraftInput) => {
    const now = new Date().toISOString();
    const firstVersion = version({
      title: draft.title,
      content: sanitizeContractHtml(draft.content),
      reason: draft.aiGenerated ? "Contrato gerado por IA" : draft.source === "template" ? "Contrato criado a partir de modelo" : "Contrato criado",
      versionNumber: 1,
      aiGenerated: draft.aiGenerated,
    });
    const contract: WeekiContract = normalizeContract({
      id: createId(),
      workspaceId: WORKSPACE_ID,
      number: nextContractNumber(contracts),
      title: draft.title,
      clientId: draft.clientId,
      clientName: draft.sourceSnapshot.client?.name || "Cliente não selecionado",
      source: draft.source,
      templateId: draft.templateId,
      relatedServiceId: draft.relatedServiceId,
      relatedTaskId: draft.relatedTaskId,
      relatedProjectId: null,
      proposalId: draft.proposalId,
      chargeId: draft.chargeId,
      sourceSnapshot: draft.sourceSnapshot,
      terms: draft.terms,
      parties: draft.parties,
      signers: draft.signers,
      signingMode: draft.signingMode,
      signatureMessage: draft.signatureMessage,
      editorialStatus: "draft",
      signatureStatus: "not_started",
      contractStatus: "pending",
      aiGenerated: Boolean(draft.aiGenerated),
      aiProvider: draft.aiProvider ?? null,
      aiNoticeAccepted: Boolean(draft.aiGenerated),
      reviewConfirmed: false,
      content: sanitizeContractHtml(draft.content),
      currentVersionId: firstVersion.id,
      versions: [firstVersion],
      documents: [],
      signatureRequests: [],
      events: [event("created", "Contrato criado", `Origem: ${draft.source}.`)],
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    setContracts((current) => [contract, ...current]);
    return contract;
  }, [contracts]);

  const updateContract = useCallback((id: string, update: Partial<WeekiContract>, recordEvent = true) => {
    let saved: WeekiContract | null = null;
    setContracts((current) => current.map((contract) => {
      if (contract.id !== id) return contract;
      const merged = normalizeContract({
        ...contract,
        ...update,
        terms: update.terms ? { ...contract.terms, ...update.terms } : contract.terms,
        content: update.content === undefined ? contract.content : sanitizeContractHtml(update.content),
        sourceSnapshot: update.sourceSnapshot ? { ...contract.sourceSnapshot, ...update.sourceSnapshot } : contract.sourceSnapshot,
        updatedAt: new Date().toISOString(),
        events: recordEvent
          ? [event("updated", "Contrato atualizado", "As informações do contrato foram revisadas."), ...contract.events]
          : contract.events,
      });
      saved = merged;
      return merged;
    }));
    return saved;
  }, []);

  const createVersion = useCallback((id: string, reason: string, options?: { immutable?: boolean; aiGenerated?: boolean }) => {
    let saved: ContractVersion | null = null;
    setContracts((current) => current.map((contract) => {
      if (contract.id !== id) return contract;
      const next = version({
        title: contract.title,
        content: sanitizeContractHtml(contract.content),
        reason,
        versionNumber: Math.max(0, ...contract.versions.map((item) => item.version)) + 1,
        aiGenerated: options?.aiGenerated,
        immutable: options?.immutable,
      });
      saved = next;
      return normalizeContract({
        ...contract,
        currentVersionId: next.id,
        versions: [next, ...contract.versions],
        updatedAt: new Date().toISOString(),
        events: [event(options?.aiGenerated ? "ai_generated" : "version_created", reason, "Uma nova versão formal foi preservada."), ...contract.events],
      });
    }));
    return saved;
  }, []);

  const replaceContentFromAi = useCallback((id: string, title: string, content: string, provider: string) => {
    let saved: WeekiContract | null = null;
    setContracts((current) => current.map((contract) => {
      if (contract.id !== id) return contract;
      const next = version({
        title,
        content: sanitizeContractHtml(content),
        reason: "Contrato gerado por IA",
        versionNumber: Math.max(0, ...contract.versions.map((item) => item.version)) + 1,
        aiGenerated: true,
      });
      const updated = normalizeContract({
        ...contract,
        title,
        content: sanitizeContractHtml(content),
        currentVersionId: next.id,
        versions: [next, ...contract.versions],
        editorialStatus: "review",
        aiGenerated: true,
        aiProvider: provider,
        aiNoticeAccepted: true,
        updatedAt: new Date().toISOString(),
        events: [event("ai_generated", "Conteúdo gerado por IA", "Revise todas as cláusulas antes do envio.", "IA Weeki"), ...contract.events],
      });
      saved = updated;
      return updated;
    }));
    return saved;
  }, []);

  const duplicateContract = useCallback((id: string) => {
    let copy: WeekiContract | null = null;
    setContracts((current) => {
      const source = current.find((contract) => contract.id === id);
      if (!source) return current;
      const now = new Date().toISOString();
      const firstVersion = version({
        title: `${source.title} - cópia`,
        content: sanitizeContractHtml(source.content),
        reason: "Contrato duplicado",
        versionNumber: 1,
        aiGenerated: source.aiGenerated,
      });
      copy = normalizeContract({
        ...source,
        id: createId(),
        number: nextContractNumber(current),
        title: `${source.title} - cópia`,
        editorialStatus: "draft",
        signatureStatus: "not_started",
        contractStatus: "pending",
        reviewConfirmed: false,
        currentVersionId: firstVersion.id,
        versions: [firstVersion],
        documents: [],
        signatureRequests: [],
        events: [event("created", "Contrato duplicado", `Criado a partir de ${source.number}.`)],
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return [copy, ...current];
    });
    return copy;
  }, []);

  const archiveContract = useCallback((id: string) => {
    setContracts((current) => current.map((contract) => contract.id === id
      ? normalizeContract({
          ...contract,
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          events: [event("archived", "Contrato arquivado", "O histórico foi preservado."), ...contract.events],
        })
      : contract,
    ));
  }, []);

  const deleteDraft = useCallback((id: string) => {
    setContracts((current) => current.filter((contract) =>
      contract.id !== id || contract.signatureStatus !== "not_started" || contract.editorialStatus !== "draft",
    ));
  }, []);

  const attachDocument = useCallback((id: string, document: Omit<ContractDocument, "id" | "createdAt">) => {
    let saved: ContractDocument | null = null;
    setContracts((current) => current.map((contract) => {
      if (contract.id !== id) return contract;
      saved = {
        ...document,
        id: createId(),
        createdAt: new Date().toISOString(),
      };
      return normalizeContract({
        ...contract,
        documents: [saved, ...contract.documents],
        updatedAt: new Date().toISOString(),
        events: [event("pdf_generated", "Documento gerado", `${saved.fileName} foi registrado no contrato.`), ...contract.events],
      });
    }));
    return saved;
  }, []);

  const saveTemplate = useCallback((template: ContractTemplate) => {
    const now = new Date().toISOString();
    setTemplates((current) => {
      const exists = current.some((item) => item.id === template.id);
      const saved = { ...template, content: sanitizeContractHtml(template.content), updatedAt: now, createdAt: template.createdAt || now };
      return exists ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current];
    });
  }, []);

  const duplicateTemplate = useCallback((id: string) => {
    setTemplates((current) => {
      const source = current.find((item) => item.id === id);
      if (!source) return current;
      const now = new Date().toISOString();
      return [{
        ...source,
        id: createId(),
        name: `${source.name} - cópia`,
        favorite: false,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      }, ...current];
    });
  }, []);

  const activeContracts = useMemo(() => contracts.filter((contract) => !contract.archivedAt), [contracts]);

  return {
    contracts: activeContracts,
    allContracts: contracts,
    templates,
    createContract,
    updateContract,
    createVersion,
    replaceContentFromAi,
    duplicateContract,
    archiveContract,
    deleteDraft,
    attachDocument,
    saveTemplate,
    duplicateTemplate,
  };
}

export type WeekiContractsController = ReturnType<typeof useWeekiContracts>;
