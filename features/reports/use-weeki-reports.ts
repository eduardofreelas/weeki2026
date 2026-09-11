"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createId } from "@/lib/format";
import {
  reportSnapshotHash,
  sanitizeReportHtml,
  type ReportBlock,
  type ReportEmailDispatch,
  type ReportEvent,
  type ReportSchedule,
  type ReportShare,
  type ReportTemplate,
  type ReportVersion,
  type WeekiReport,
  type ReportDraftInput,
} from "@/shared/reports";
import { createSeedReportTemplates } from "./seed";

const REPORTS_KEY = "weeki.reports.records.v1";
const TEMPLATES_KEY = "weeki.reports.templates.v1";
const SCHEDULES_KEY = "weeki.reports.schedules.v1";
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

function eventFor(kind: ReportEvent["kind"], title: string, description: string, actor = "Você"): ReportEvent {
  return { id: createId(), kind, title, description, actor, createdAt: new Date().toISOString() };
}

function makePublicToken() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return createId().replace(/-/g, "") + Date.now().toString(16);
}

function localPasswordHash(password: string) {
  return password.trim() ? reportSnapshotHash({ password: password.trim() }) : null;
}

function versionFromReport(report: Pick<WeekiReport, "sourceSnapshot" | "blocks" | "metrics" | "versions">, reason: string, immutable: boolean): ReportVersion {
  const snapshot = {
    sourceSnapshot: report.sourceSnapshot,
    blocks: report.blocks.map((block) => ({ ...block })),
    metrics: report.metrics.map((metric) => ({ ...metric })),
  };
  return {
    id: createId(),
    version: Math.max(0, ...report.versions.map((item) => item.version)) + 1,
    reason,
    immutable,
    snapshotHash: reportSnapshotHash(snapshot),
    sourceSnapshot: snapshot.sourceSnapshot,
    blocks: snapshot.blocks,
    metrics: snapshot.metrics,
    createdAt: new Date().toISOString(),
    createdBy: "Você",
  };
}

function normalizeBlocks(blocks: ReportBlock[]) {
  return blocks
    .map((block, index) => ({
      ...block,
      content: sanitizeReportHtml(block.content ?? ""),
      visible: block.visible !== false,
      order: Number.isFinite(block.order) ? block.order : index,
      activityIds: Array.isArray(block.activityIds) ? block.activityIds : [],
      evidenceIds: Array.isArray(block.evidenceIds) ? block.evidenceIds : [],
      metricIds: Array.isArray(block.metricIds) ? block.metricIds : [],
      settings: block.settings ?? {},
    }))
    .sort((a, b) => a.order - b.order);
}

function normalizeReport(report: WeekiReport): WeekiReport {
  const versions = Array.isArray(report.versions) ? report.versions : [];
  const visual: Partial<WeekiReport["visual"]> | undefined = report.visual;
  return {
    ...report,
    workspaceId: report.workspaceId || WORKSPACE_ID,
    selectedCategories: Array.isArray(report.selectedCategories) ? report.selectedCategories : [],
    sourceSnapshot: {
      ...report.sourceSnapshot,
      activities: Array.isArray(report.sourceSnapshot?.activities) ? report.sourceSnapshot.activities : [],
      financial: {
        charges: Array.isArray(report.sourceSnapshot?.financial?.charges) ? report.sourceSnapshot.financial.charges : [],
        transactions: Array.isArray(report.sourceSnapshot?.financial?.transactions) ? report.sourceSnapshot.financial.transactions : [],
      },
    },
    metrics: Array.isArray(report.metrics) ? report.metrics : [],
    blocks: normalizeBlocks(Array.isArray(report.blocks) ? report.blocks : []),
    visual: {
      providerLogoUrl: visual?.providerLogoUrl ?? "",
      clientLogoUrl: visual?.clientLogoUrl ?? "",
      primaryColor: visual?.primaryColor ?? "#7657ff",
      secondaryColor: visual?.secondaryColor ?? "#2f80ed",
      companyName: visual?.companyName ?? "",
      contactEmail: visual?.contactEmail ?? "",
      contactPhone: visual?.contactPhone ?? "",
      document: visual?.document ?? "",
      site: visual?.site ?? "",
      footer: visual?.footer ?? "Relatório gerado pela Weeki.",
      signature: visual?.signature ?? "",
    },
    currentVersionId: report.currentVersionId || versions[0]?.id || "",
    versions,
    share: report.share ?? null,
    emailDispatches: Array.isArray(report.emailDispatches) ? report.emailDispatches : [],
    clientDecisions: Array.isArray(report.clientDecisions) ? report.clientDecisions : [],
    events: Array.isArray(report.events) ? report.events : [],
    finalizedAt: report.finalizedAt ?? null,
    sentAt: report.sentAt ?? null,
    archivedAt: report.archivedAt ?? null,
  };
}

function nextReportNumber(current: WeekiReport[]) {
  const year = new Date().getFullYear();
  const count = current.filter((report) => report.number.includes(`-${year}-`)).length + 1;
  return `REL-${year}-${String(count).padStart(4, "0")}`;
}

export function useWeekiReports() {
  const [reports, setReports] = useState<WeekiReport[]>(() =>
    readStorage(REPORTS_KEY, () => [] as WeekiReport[]).map(normalizeReport),
  );
  const [templates, setTemplates] = useState<ReportTemplate[]>(() =>
    readStorage(TEMPLATES_KEY, createSeedReportTemplates),
  );
  const [schedules, setSchedules] = useState<ReportSchedule[]>(() =>
    readStorage(SCHEDULES_KEY, () => [] as ReportSchedule[]),
  );

  useEffect(() => {
    try { window.localStorage.setItem(REPORTS_KEY, JSON.stringify(reports)); } catch { /* Storage is optional. */ }
  }, [reports]);

  useEffect(() => {
    try { window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); } catch { /* Storage is optional. */ }
  }, [templates]);

  useEffect(() => {
    try { window.localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules)); } catch { /* Storage is optional. */ }
  }, [schedules]);

  const createReport = useCallback((draft: ReportDraftInput) => {
    const now = new Date().toISOString();
    const first: WeekiReport = normalizeReport({
      ...draft,
      id: createId(),
      workspaceId: WORKSPACE_ID,
      number: nextReportNumber(reports),
      blocks: normalizeBlocks(draft.blocks),
      status: "draft",
      currentVersionId: "",
      versions: [],
      share: null,
      emailDispatches: [],
      clientDecisions: [],
      events: [eventFor("created", "Relatório criado", `Estrutura inicial criada para ${draft.clientName || "cliente não selecionado"}.`)],
      finalizedAt: null,
      sentAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const initialVersion = versionFromReport(first, "Relatório criado como rascunho", false);
    const report = { ...first, currentVersionId: initialVersion.id, versions: [initialVersion] };
    setReports((current) => [report, ...current]);
    return report;
  }, [reports]);

  const updateReport = useCallback((id: string, update: Partial<WeekiReport>, recordEvent = true) => {
    let saved: WeekiReport | null = null;
    setReports((current) => current.map((report) => {
      if (report.id !== id) return report;
      const merged = normalizeReport({
        ...report,
        ...update,
        blocks: update.blocks ? normalizeBlocks(update.blocks) : report.blocks,
        sourceSnapshot: update.sourceSnapshot ?? report.sourceSnapshot,
        visual: update.visual ? { ...report.visual, ...update.visual } : report.visual,
        updatedAt: new Date().toISOString(),
        events: recordEvent ? [eventFor("updated", "Relatório atualizado", "As informações do relatório foram revisadas."), ...report.events] : report.events,
      });
      saved = merged;
      return merged;
    }));
    return saved;
  }, []);

  const createVersion = useCallback((id: string, reason: string, immutable = false) => {
    let saved: ReportVersion | null = null;
    setReports((current) => current.map((report) => {
      if (report.id !== id) return report;
      const next = versionFromReport(report, reason, immutable);
      saved = next;
      return normalizeReport({
        ...report,
        currentVersionId: next.id,
        versions: [next, ...report.versions],
        status: immutable && report.status === "draft" ? "ready" : report.status,
        finalizedAt: immutable ? (report.finalizedAt ?? new Date().toISOString()) : report.finalizedAt,
        updatedAt: new Date().toISOString(),
        events: [eventFor(immutable ? "finalized" : "version_created", reason, immutable ? "Snapshot preservado para envio ou compartilhamento." : "Uma nova versão editável foi registrada."), ...report.events],
      });
    }));
    return saved;
  }, []);

  const finalizeReport = useCallback((id: string, update?: Partial<WeekiReport>) => {
    let saved: WeekiReport | null = null;
    setReports((current) => current.map((report) => {
      if (report.id !== id) return report;
      const base = normalizeReport({
        ...report,
        ...update,
        blocks: update?.blocks ? normalizeBlocks(update.blocks) : report.blocks,
        visual: update?.visual ? { ...report.visual, ...update.visual } : report.visual,
        updatedAt: new Date().toISOString(),
      });
      const next = versionFromReport(base, "Relatório finalizado", true);
      saved = normalizeReport({
        ...base,
        status: base.status === "sent" || base.status === "viewed" || base.status === "approved" || base.status === "adjustment_requested" ? base.status : "ready",
        currentVersionId: next.id,
        versions: [next, ...base.versions],
        finalizedAt: base.finalizedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: [eventFor("finalized", "Relatório finalizado", "Os dados desta versão foram preservados."), ...base.events],
      });
      return saved;
    }));
    return saved;
  }, []);

  const duplicateReport = useCallback((id: string) => {
    let copy: WeekiReport | null = null;
    setReports((current) => {
      const source = current.find((report) => report.id === id);
      if (!source) return current;
      const now = new Date().toISOString();
      const duplicate = normalizeReport({
        ...source,
        id: createId(),
        number: nextReportNumber(current),
        title: `${source.title} - cópia`,
        status: "draft",
        share: null,
        emailDispatches: [],
        clientDecisions: [],
        events: [eventFor("created", "Relatório duplicado", `Criado a partir de ${source.number}.`)],
        finalizedAt: null,
        sentAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        versions: [],
      });
      const initialVersion = versionFromReport(duplicate, "Relatório duplicado", false);
      copy = { ...duplicate, currentVersionId: initialVersion.id, versions: [initialVersion] };
      return [copy, ...current];
    });
    return copy;
  }, []);

  const archiveReport = useCallback((id: string) => {
    setReports((current) => current.map((report) => report.id === id
      ? normalizeReport({
          ...report,
          status: "archived",
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          events: [eventFor("archived", "Relatório arquivado", "O histórico e versões foram preservados."), ...report.events],
        })
      : report,
    ));
  }, []);

  const deleteDraft = useCallback((id: string) => {
    setReports((current) => current.filter((report) =>
      report.id !== id || report.status !== "draft",
    ));
  }, []);

  const createShare = useCallback((id: string, input: { allowDownload: boolean; password?: string; expiresAt?: string | null }): ReportShare | null => {
    let saved: ReportShare | null = null;
    setReports((current) => current.map((report) => {
      if (report.id !== id) return report;
      const share: ReportShare = {
        token: makePublicToken(),
        allowView: true,
        allowDownload: input.allowDownload,
        passwordHash: localPasswordHash(input.password ?? ""),
        expiresAt: input.expiresAt || null,
        revokedAt: null,
        accessCount: 0,
        lastAccessAt: null,
        createdAt: new Date().toISOString(),
      };
      saved = share;
      return normalizeReport({
        ...report,
        share,
        updatedAt: new Date().toISOString(),
        events: [eventFor("share_created", "Link compartilhável criado", "Token público não sequencial preparado para este relatório."), ...report.events],
      });
    }));
    return saved;
  }, []);

  const revokeShare = useCallback((id: string) => {
    setReports((current) => current.map((report) => report.id === id && report.share
      ? normalizeReport({
          ...report,
          share: { ...report.share, revokedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
          events: [eventFor("share_revoked", "Link revogado", "O acesso público foi encerrado para este token."), ...report.events],
        })
      : report,
    ));
  }, []);

  const prepareEmail = useCallback((id: string, input: Omit<ReportEmailDispatch, "id" | "status" | "createdAt">) => {
    let saved: ReportEmailDispatch | null = null;
    setReports((current) => current.map((report) => {
      if (report.id !== id) return report;
      saved = {
        ...input,
        id: createId(),
        status: "prepared",
        createdAt: new Date().toISOString(),
      };
      return normalizeReport({
        ...report,
        status: report.status === "draft" || report.status === "in_progress" ? "ready" : report.status,
        sentAt: report.sentAt,
        emailDispatches: [saved, ...report.emailDispatches],
        updatedAt: new Date().toISOString(),
        events: [eventFor("email_prepared", "Envio por e-mail preparado", `Template aberto para ${input.recipient}.`), ...report.events],
      });
    }));
    return saved;
  }, []);

  const registerPdf = useCallback((id: string) => {
    setReports((current) => current.map((report) => report.id === id
      ? normalizeReport({
          ...report,
          updatedAt: new Date().toISOString(),
          events: [eventFor("pdf_generated", "PDF gerado", "Uma cópia em PDF foi baixada localmente."), ...report.events],
        })
      : report,
    ));
  }, []);

  const findByShareToken = useCallback((token: string) => reports.find((report) => report.share?.token === token) ?? null, [reports]);

  const checkSharePassword = useCallback((token: string, password: string) => {
    const report = reports.find((item) => item.share?.token === token);
    if (!report?.share?.passwordHash) return true;
    return report.share.passwordHash === localPasswordHash(password);
  }, [reports]);

  const registerShareOpen = useCallback((token: string) => {
    let saved: WeekiReport | null = null;
    setReports((current) => current.map((report) => {
      if (report.share?.token !== token) return report;
      const now = new Date().toISOString();
      const expired = Boolean(report.share.expiresAt && report.share.expiresAt < now.slice(0, 10));
      if (report.share.revokedAt || expired) {
        saved = report;
        return report;
      }
      saved = normalizeReport({
        ...report,
        status: report.status === "approved" || report.status === "adjustment_requested" ? report.status : "viewed",
        share: {
          ...report.share,
          accessCount: report.share.accessCount + 1,
          lastAccessAt: now,
        },
        updatedAt: now,
        events: [eventFor("share_opened", "Link aberto", "O relatório foi visualizado pelo link compartilhável.", "Cliente"), ...report.events],
      });
      return saved;
    }));
    return saved;
  }, []);

  const registerClientDecision = useCallback((token: string, kind: "approved" | "adjustment_requested", message: string) => {
    let saved: WeekiReport | null = null;
    setReports((current) => current.map((report) => {
      if (report.share?.token !== token) return report;
      const decision = { id: createId(), kind, message: message.trim(), createdAt: new Date().toISOString() };
      saved = normalizeReport({
        ...report,
        status: kind,
        clientDecisions: [decision, ...report.clientDecisions],
        updatedAt: new Date().toISOString(),
        events: [eventFor(kind, kind === "approved" ? "Relatório aprovado" : "Ajuste solicitado", decision.message || "Sem observação adicional.", "Cliente"), ...report.events],
      });
      return saved;
    }));
    return saved;
  }, []);

  const saveTemplate = useCallback((template: ReportTemplate) => {
    const now = new Date().toISOString();
    setTemplates((current) => {
      const saved = { ...template, createdAt: template.createdAt || now, updatedAt: now };
      return current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current];
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

  const activeReports = useMemo(() => reports.filter((report) => !report.archivedAt), [reports]);

  return {
    reports: activeReports,
    allReports: reports,
    templates,
    schedules,
    setSchedules,
    createReport,
    updateReport,
    createVersion,
    finalizeReport,
    duplicateReport,
    archiveReport,
    deleteDraft,
    createShare,
    revokeShare,
    prepareEmail,
    registerPdf,
    findByShareToken,
    checkSharePassword,
    registerShareOpen,
    registerClientDecision,
    saveTemplate,
    duplicateTemplate,
  };
}

export type WeekiReportsController = ReturnType<typeof useWeekiReports>;
