"use client";

import { useCallback, useEffect, useState } from "react";
import { createSeedOperations } from "./seed";
import type {
  Deliverable,
  DeliverableStatus,
  Engagement,
  EngagementCycle,
  EngagementStatus,
  Opportunity,
  OpportunityStatus,
  OperationsState,
  Quote,
  QuoteEvent,
  QuoteEventKind,
  QuoteItem,
  QuoteSettings,
  QuoteStatus,
  QuoteTemplate,
  Service,
  TimeEntry,
} from "./types";

const STORAGE_KEY = "weeki.operations.v1";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

const defaultQuoteSettings = (): QuoteSettings => ({
  prefix: "ORC",
  defaultValidityDays: 15,
  defaultDeadlineDays: 30,
  defaultTerms:
    "Valores sujeitos à aprovação formal. Alterações de escopo poderão gerar novo orçamento.",
  defaultNotes: "",
  defaultPaymentTerms: "Pagamento conforme condições comerciais aprovadas.",
  showLogo: true,
  showDocument: true,
  showAddress: true,
  showPhone: true,
  showSignature: true,
  footerText: "Orçamento comercial gerado pela Weeki.",
  currency: "BRL",
  decimalPlaces: 2,
});

function makePublicToken() {
  return `wkq_${makeId().replace(/-/g, "")}`;
}

function eventFor(
  kind: QuoteEventKind,
  title: string,
  description: string,
  actor = "Você",
): QuoteEvent {
  return { id: makeId(), kind, title, description, actor, createdAt: now() };
}

function normalizeQuoteItem(item: QuoteItem): QuoteItem {
  return {
    ...item,
    savedItemId: item.savedItemId ?? item.serviceId ?? null,
    name: item.name ?? item.description,
    unit: item.unit ?? "unit",
    customUnit: item.customUnit ?? "",
    discountType: item.discountType ?? (item.discount ? "fixed" : "none"),
    discountValue: item.discountValue ?? item.discount ?? 0,
    discount: item.discount ?? 0,
    addition: item.addition ?? 0,
    fiscalCode: item.fiscalCode ?? "",
    taxRate: item.taxRate ?? 0,
  };
}

function normalizeQuote(quote: Quote): Quote {
  const createdAt = quote.createdAt || now();
  const issueDate = quote.issueDate || createdAt.slice(0, 10);
  const title =
    quote.title ||
    quote.description ||
    quote.items?.[0]?.description ||
    "Orçamento sem título";
  const events =
    Array.isArray(quote.events) && quote.events.length
      ? quote.events
      : [
          eventFor(
            "created",
            "Orçamento criado",
            "Registro migrado para o módulo de Orçamentos.",
          ),
        ];
  return {
    ...quote,
    title,
    items: Array.isArray(quote.items)
      ? quote.items.map(normalizeQuoteItem)
      : [],
    description: quote.description ?? "",
    issueDate,
    estimatedDeadline: quote.estimatedDeadline ?? "",
    validUntil: quote.validUntil ?? "",
    responsible: quote.responsible ?? "",
    discountType: quote.discountType ?? "none",
    discountValue: quote.discountValue ?? 0,
    taxType: quote.taxType ?? "none",
    taxLabel: quote.taxLabel ?? "",
    taxValue: quote.taxValue ?? 0,
    paymentCondition: quote.paymentCondition ?? "custom",
    downPaymentPercent: quote.downPaymentPercent ?? 0,
    installments: quote.installments ?? 1,
    firstDueDate: quote.firstDueDate ?? "",
    paymentDetails: quote.paymentDetails ?? quote.paymentMethod ?? "",
    estimatedStartDate: quote.estimatedStartDate ?? "",
    estimatedEndDate: quote.estimatedEndDate ?? "",
    scope: quote.scope ?? "",
    exclusions: quote.exclusions ?? "",
    notes: quote.notes ?? "",
    terms: quote.terms ?? "",
    paymentMethod: quote.paymentMethod ?? "",
    version: quote.version ?? 1,
    parentQuoteId: quote.parentQuoteId ?? null,
    publicToken: quote.publicToken || makePublicToken(),
    viewedAt: quote.viewedAt ?? null,
    approvedAt: quote.approvedAt ?? null,
    rejectedAt: quote.rejectedAt ?? null,
    rejectionReason: quote.rejectionReason ?? "",
    acceptedBy: quote.acceptedBy ?? "",
    engagementId: quote.engagementId ?? null,
    chargeId: quote.chargeId ?? null,
    contractId: quote.contractId ?? null,
    events,
  };
}

function normalizeTemplate(template: QuoteTemplate): QuoteTemplate {
  return {
    ...template,
    items: Array.isArray(template.items)
      ? template.items.map(normalizeQuoteItem)
      : [],
    paymentCondition: template.paymentCondition ?? "custom",
    downPaymentPercent: template.downPaymentPercent ?? 0,
    installments: template.installments ?? 1,
    paymentDetails: template.paymentDetails ?? template.paymentMethod ?? "",
    archivedAt: template.archivedAt ?? null,
  };
}

function normalizeState(parsed?: Partial<OperationsState>): OperationsState {
  const seed = createSeedOperations();
  return {
    services: parsed?.services ?? seed.services,
    opportunities: parsed?.opportunities ?? seed.opportunities,
    quotes: (parsed?.quotes ?? seed.quotes).map(normalizeQuote),
    quoteTemplates: (parsed?.quoteTemplates ?? seed.quoteTemplates).map(
      normalizeTemplate,
    ),
    quoteSettings: {
      ...defaultQuoteSettings(),
      ...seed.quoteSettings,
      ...parsed?.quoteSettings,
    },
    engagements: parsed?.engagements ?? seed.engagements,
    cycles: parsed?.cycles ?? seed.cycles,
    deliverables: parsed?.deliverables ?? seed.deliverables,
    timeEntries: parsed?.timeEntries ?? seed.timeEntries,
  };
}

function readState(): OperationsState {
  if (typeof window === "undefined") return normalizeState();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return normalizeState(
      saved ? (JSON.parse(saved) as Partial<OperationsState>) : undefined,
    );
  } catch {
    return normalizeState();
  }
}

function nextQuoteNumber(current: Quote[], prefix: string) {
  const year = new Date().getFullYear();
  const normalizedPrefix = prefix.trim().toLocaleUpperCase("pt-BR") || "ORC";
  const count =
    current.filter((quote) =>
      quote.number.startsWith(`${normalizedPrefix}-${year}-`),
    ).length + 1;
  return `${normalizedPrefix}-${year}-${String(count).padStart(4, "0")}`;
}

function statusEvent(status: QuoteStatus): [QuoteEventKind, string, string] {
  if (status === "sent")
    return ["sent_email", "Orçamento enviado", "Envio comercial registrado."];
  if (status === "viewed")
    return ["viewed", "Cliente visualizou", "Visualização registrada."];
  if (status === "awaiting_approval")
    return [
      "shared",
      "Aguardando aprovação",
      "Orçamento pronto para aceite comercial.",
    ];
  if (status === "approved")
    return ["approved", "Orçamento aprovado", "Aceite comercial registrado."];
  if (status === "rejected")
    return [
      "rejected",
      "Orçamento recusado",
      "Recusa registrada no histórico.",
    ];
  if (status === "cancelled")
    return [
      "cancelled",
      "Orçamento cancelado",
      "Registro mantido para histórico.",
    ];
  return ["updated", "Status atualizado", `Novo status: ${status}.`];
}

export function useWeekiOperations() {
  const [state, setState] = useState<OperationsState>(readState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Storage is optional in static mode. */
    }
  }, [state]);

  const addService = useCallback(
    (service: Omit<Service, "id" | "createdAt" | "updatedAt">) => {
      const timestamp = now();
      const created = {
        ...service,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        services: [created, ...current.services],
      }));
      return created;
    },
    [],
  );

  const updateService = useCallback(
    (id: string, service: Omit<Service, "id" | "createdAt" | "updatedAt">) => {
      setState((current) => ({
        ...current,
        services: current.services.map((item) =>
          item.id === id ? { ...item, ...service, updatedAt: now() } : item,
        ),
      }));
    },
    [],
  );

  const archiveService = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      services: current.services.map((item) =>
        item.id === id
          ? { ...item, archivedAt: now(), updatedAt: now() }
          : item,
      ),
    }));
  }, []);

  const addOpportunity = useCallback(
    (opportunity: Omit<Opportunity, "id" | "createdAt" | "updatedAt">) => {
      const timestamp = now();
      const created = {
        ...opportunity,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        opportunities: [created, ...current.opportunities],
      }));
      return created;
    },
    [],
  );

  const updateOpportunity = useCallback(
    (
      id: string,
      opportunity: Omit<Opportunity, "id" | "createdAt" | "updatedAt">,
    ) => {
      setState((current) => ({
        ...current,
        opportunities: current.opportunities.map((item) =>
          item.id === id ? { ...item, ...opportunity, updatedAt: now() } : item,
        ),
      }));
    },
    [],
  );

  const setOpportunityStatus = useCallback(
    (id: string, status: OpportunityStatus) => {
      setState((current) => ({
        ...current,
        opportunities: current.opportunities.map((item) =>
          item.id === id ? { ...item, status, updatedAt: now() } : item,
        ),
      }));
    },
    [],
  );

  const addQuote = useCallback(
    (quote: Omit<Quote, "id" | "number" | "createdAt" | "updatedAt">) => {
      const timestamp = now();
      const created = normalizeQuote({
        ...quote,
        id: makeId(),
        number: nextQuoteNumber(state.quotes, state.quoteSettings.prefix),
        createdAt: timestamp,
        updatedAt: timestamp,
        events: [
          eventFor("created", "Orçamento criado", "Rascunho comercial criado."),
          ...quote.events,
        ],
      });
      setState((current) => ({
        ...current,
        quotes: [created, ...current.quotes],
      }));
      return created;
    },
    [state.quoteSettings.prefix, state.quotes],
  );

  const updateQuote = useCallback(
    (
      id: string,
      quote: Omit<Quote, "id" | "number" | "createdAt" | "updatedAt">,
      recordEvent = false,
    ) => {
      let saved: Quote | null = null;
      setState((current) => ({
        ...current,
        quotes: current.quotes.map((item) => {
          if (item.id !== id) return item;
          saved = normalizeQuote({
            ...item,
            ...quote,
            updatedAt: now(),
            events: recordEvent
              ? [
                  eventFor(
                    "updated",
                    "Orçamento atualizado",
                    "Dados comerciais revisados.",
                  ),
                  ...quote.events,
                ]
              : quote.events,
          });
          return saved;
        }),
      }));
      return saved;
    },
    [],
  );

  const setQuoteStatus = useCallback(
    (
      id: string,
      status: QuoteStatus,
      details?: { rejectionReason?: string; acceptedBy?: string },
    ) => {
      setState((current) => ({
        ...current,
        quotes: current.quotes.map((item) => {
          if (item.id !== id) return item;
          const [kind, title, description] = statusEvent(status);
          return {
            ...item,
            status,
            approvedAt:
              status === "approved"
                ? item.approvedAt || now()
                : item.approvedAt,
            rejectedAt:
              status === "rejected"
                ? item.rejectedAt || now()
                : item.rejectedAt,
            rejectionReason:
              status === "rejected"
                ? (details?.rejectionReason ?? item.rejectionReason)
                : item.rejectionReason,
            acceptedBy:
              status === "approved"
                ? (details?.acceptedBy ?? item.acceptedBy)
                : item.acceptedBy,
            viewedAt:
              status === "viewed" ? item.viewedAt || now() : item.viewedAt,
            updatedAt: now(),
            events: [eventFor(kind, title, description), ...item.events],
          };
        }),
      }));
    },
    [],
  );

  const addQuoteEvent = useCallback(
    (id: string, kind: QuoteEventKind, title: string, description: string) => {
      setState((current) => ({
        ...current,
        quotes: current.quotes.map((item) =>
          item.id === id
            ? {
                ...item,
                updatedAt: now(),
                events: [eventFor(kind, title, description), ...item.events],
              }
            : item,
        ),
      }));
    },
    [],
  );

  const ensureQuotePublicToken = useCallback((id: string) => {
    let token = "";
    setState((current) => ({
      ...current,
      quotes: current.quotes.map((item) => {
        if (item.id !== id) return item;
        token = item.publicToken || makePublicToken();
        return {
          ...item,
          publicToken: token,
          updatedAt: now(),
          events: [
            eventFor(
              "shared",
              "Link público preparado",
              "Token não sequencial gerado para compartilhamento.",
            ),
            ...item.events,
          ],
        };
      }),
    }));
    return token;
  }, []);

  const duplicateQuote = useCallback((id: string): Quote | null => {
    let copy: Quote | null = null;
    setState((current) => {
      const source = current.quotes.find((quote) => quote.id === id);
      if (!source) return current;
      const timestamp = now();
      const created = normalizeQuote({
        ...source,
        id: makeId(),
        number: nextQuoteNumber(current.quotes, current.quoteSettings.prefix),
        title: `${source.title} - cópia`,
        status: "draft",
        publicToken: makePublicToken(),
        viewedAt: null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: "",
        acceptedBy: "",
        engagementId: null,
        chargeId: null,
        contractId: null,
        parentQuoteId: source.parentQuoteId ?? source.id,
        version: 1,
        events: [
          eventFor(
            "duplicated",
            "Orçamento duplicado",
            `Criado a partir de ${source.number}.`,
          ),
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      copy = created;
      return { ...current, quotes: [created, ...current.quotes] };
    });
    return copy;
  }, []);

  const createQuoteRevision = useCallback((id: string): Quote | null => {
    let revision: Quote | null = null;
    setState((current) => {
      const source = current.quotes.find((quote) => quote.id === id);
      if (!source) return current;
      const siblings = current.quotes.filter(
        (quote) => quote.parentQuoteId === (source.parentQuoteId ?? source.id),
      );
      const version =
        Math.max(source.version, ...siblings.map((quote) => quote.version)) + 1;
      const timestamp = now();
      const created = normalizeQuote({
        ...source,
        id: makeId(),
        number: `${source.number.split("-R")[0]}-R${version}`,
        status: "draft",
        publicToken: makePublicToken(),
        viewedAt: null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: "",
        acceptedBy: "",
        engagementId: null,
        chargeId: null,
        contractId: null,
        parentQuoteId: source.parentQuoteId ?? source.id,
        version,
        events: [
          eventFor(
            "revision_created",
            "Revisão criada",
            `Versão ${version} preservada sem apagar a anterior.`,
          ),
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      revision = created;
      return { ...current, quotes: [created, ...current.quotes] };
    });
    return revision;
  }, []);

  const deleteQuote = useCallback((id: string) => {
    let removed = false;
    setState((current) => {
      const source = current.quotes.find((quote) => quote.id === id);
      if (!source || source.status !== "draft") return current;
      removed = true;
      return {
        ...current,
        quotes: current.quotes.filter((quote) => quote.id !== id),
      };
    });
    return removed;
  }, []);

  const saveQuoteTemplate = useCallback(
    (
      template: Omit<
        QuoteTemplate,
        "id" | "createdAt" | "updatedAt" | "archivedAt"
      >,
    ) => {
      const timestamp = now();
      const saved: QuoteTemplate = normalizeTemplate({
        ...template,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: null,
      });
      setState((current) => ({
        ...current,
        quoteTemplates: [saved, ...current.quoteTemplates],
      }));
      return saved;
    },
    [],
  );

  const archiveQuoteTemplate = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      quoteTemplates: current.quoteTemplates.map((template) =>
        template.id === id
          ? { ...template, archivedAt: now(), updatedAt: now() }
          : template,
      ),
    }));
  }, []);

  const updateQuoteSettings = useCallback((settings: QuoteSettings) => {
    setState((current) => ({
      ...current,
      quoteSettings: {
        ...defaultQuoteSettings(),
        ...settings,
        prefix: settings.prefix.trim().toLocaleUpperCase("pt-BR") || "ORC",
      },
    }));
  }, []);

  const recordQuoteConversion = useCallback(
    (
      id: string,
      target: "billing" | "contract" | "project",
      targetId: string,
    ) => {
      const map = {
        billing: {
          event: "converted_to_billing" as const,
          title: "Cobrança criada",
          description: "Rascunho de cobrança gerado a partir do orçamento.",
        },
        contract: {
          event: "converted_to_contract" as const,
          title: "Contrato criado",
          description: "Contrato preenchido com dados do orçamento.",
        },
        project: {
          event: "converted_to_project" as const,
          title: "Demanda/projeto criado",
          description: "Atendimento criado a partir do orçamento aprovado.",
        },
      }[target];
      setState((current) => ({
        ...current,
        quotes: current.quotes.map((quote) =>
          quote.id === id
            ? {
                ...quote,
                chargeId: target === "billing" ? targetId : quote.chargeId,
                contractId: target === "contract" ? targetId : quote.contractId,
                engagementId:
                  target === "project" ? targetId : quote.engagementId,
                updatedAt: now(),
                events: [
                  eventFor(map.event, map.title, map.description),
                  ...quote.events,
                ],
              }
            : quote,
        ),
      }));
    },
    [],
  );

  const addEngagement = useCallback(
    (engagement: Omit<Engagement, "id" | "createdAt" | "updatedAt">) => {
      const timestamp = now();
      const created = {
        ...engagement,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        engagements: [created, ...current.engagements],
      }));
      return created;
    },
    [],
  );

  const updateEngagement = useCallback(
    (
      id: string,
      engagement: Omit<Engagement, "id" | "createdAt" | "updatedAt">,
    ) => {
      setState((current) => ({
        ...current,
        engagements: current.engagements.map((item) =>
          item.id === id ? { ...item, ...engagement, updatedAt: now() } : item,
        ),
      }));
    },
    [],
  );

  const setEngagementStatus = useCallback(
    (id: string, status: EngagementStatus) => {
      setState((current) => ({
        ...current,
        engagements: current.engagements.map((item) =>
          item.id === id ? { ...item, status, updatedAt: now() } : item,
        ),
      }));
    },
    [],
  );

  const addCycle = useCallback(
    (cycle: Omit<EngagementCycle, "id" | "createdAt">) => {
      const created = { ...cycle, id: makeId(), createdAt: now() };
      setState((current) => ({
        ...current,
        cycles: [created, ...current.cycles],
      }));
      return created;
    },
    [],
  );

  const addDeliverable = useCallback(
    (deliverable: Omit<Deliverable, "id" | "createdAt" | "updatedAt">) => {
      const timestamp = now();
      const created = {
        ...deliverable,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        deliverables: [created, ...current.deliverables],
      }));
      return created;
    },
    [],
  );

  const setDeliverableStatus = useCallback(
    (id: string, status: DeliverableStatus) => {
      setState((current) => ({
        ...current,
        deliverables: current.deliverables.map((item) =>
          item.id === id ? { ...item, status, updatedAt: now() } : item,
        ),
      }));
    },
    [],
  );

  const addTimeEntry = useCallback(
    (entry: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">) => {
      const timestamp = now();
      const created = {
        ...entry,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        timeEntries: [created, ...current.timeEntries],
      }));
      return created;
    },
    [],
  );

  return {
    ...state,
    addService,
    updateService,
    archiveService,
    addOpportunity,
    updateOpportunity,
    setOpportunityStatus,
    addQuote,
    updateQuote,
    setQuoteStatus,
    addQuoteEvent,
    ensureQuotePublicToken,
    duplicateQuote,
    createQuoteRevision,
    deleteQuote,
    saveQuoteTemplate,
    archiveQuoteTemplate,
    updateQuoteSettings,
    recordQuoteConversion,
    addEngagement,
    updateEngagement,
    setEngagementStatus,
    addCycle,
    addDeliverable,
    setDeliverableStatus,
    addTimeEntry,
  };
}

export type WeekiOperationsController = ReturnType<typeof useWeekiOperations>;
