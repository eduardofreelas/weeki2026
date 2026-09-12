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
  ServiceInput,
  ServiceOrder,
  TimeEntry,
} from "./types";
import {
  createDefaultServiceDetails,
  defaultStorefrontSettings,
  publicServiceToken,
  slugifyService,
} from "@/features/services/defaults";
import type {
  ServiceAvailabilityStatus,
  ServiceOrderInput,
  ServiceOrderStatus,
  ServiceStatus,
  StorefrontSettings,
} from "@/features/services/types";

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

function makeServicePublicToken(seed: string) {
  return `wks_${makeId().replace(/-/g, "").slice(0, 18)}_${slugifyService(seed)}`;
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

function normalizeService(service: Service | ServiceInput): Service {
  const timestamp = now();
  const details = createDefaultServiceDetails({
    id: "id" in service ? service.id : undefined,
    name: service.name,
    description: service.description,
    category: service.category,
    defaultPrice: service.defaultPrice,
    unit: service.unit,
    defaultDurationDays: service.defaultDurationDays,
    status: service.status,
    availabilityStatus: service.availabilityStatus,
    slug: service.slug,
  });
  const slug = slugifyService(service.slug || service.name, details.slug);
  const status = service.archivedAt
    ? "archived"
    : (service.status ?? details.status);
  return {
    ...details,
    ...service,
    id: "id" in service ? service.id : makeId(),
    slug,
    status,
    availabilityStatus:
      service.availabilityStatus ?? details.availabilityStatus,
    summary: service.summary ?? details.summary,
    fullDescription: service.fullDescription ?? details.fullDescription,
    coverImage: service.coverImage ?? details.coverImage,
    gallery: service.gallery ?? details.gallery,
    portfolio: service.portfolio ?? details.portfolio,
    videos: service.videos ?? details.videos,
    links: service.links ?? details.links,
    pricing: { ...details.pricing, ...service.pricing },
    variants: service.variants ?? details.variants,
    extras: service.extras ?? details.extras,
    includedItems: service.includedItems ?? details.includedItems,
    excludedItems: service.excludedItems ?? details.excludedItems,
    deadline: { ...details.deadline, ...service.deadline },
    duration: { ...details.duration, ...service.duration },
    hiring: { ...details.hiring, ...service.hiring },
    payment: { ...details.payment, ...service.payment },
    scheduling: { ...details.scheduling, ...service.scheduling },
    faq: service.faq ?? details.faq,
    customFields: service.customFields ?? details.customFields,
    serviceTerms: service.serviceTerms ?? details.serviceTerms,
    seo: { ...details.seo, ...service.seo },
    analytics: { ...details.analytics, ...service.analytics },
    featured: service.featured ?? details.featured,
    inStorefront:
      service.inStorefront ??
      (service.status === "published" ? true : details.inStorefront),
    publicToken:
      service.publicToken ||
      publicServiceToken(slug) ||
      makeServicePublicToken(slug),
    fiscal: {
      ...details.fiscal,
      ...service.fiscal,
      serviceCode:
        service.fiscal?.serviceCode ??
        service.fiscalCode ??
        details.fiscal.serviceCode,
      issRate:
        service.fiscal?.issRate ?? service.taxRate ?? details.fiscal.issRate,
      fiscalDescription:
        service.fiscal?.fiscalDescription ??
        service.description ??
        details.fiscal.fiscalDescription,
    },
    automations: { ...details.automations, ...service.automations },
    archivedAt:
      status === "archived" ? service.archivedAt || now() : service.archivedAt,
    createdAt: "createdAt" in service ? service.createdAt : timestamp,
    updatedAt: "updatedAt" in service ? service.updatedAt : timestamp,
  };
}

function normalizeStorefront(
  settings?: Partial<StorefrontSettings>,
): StorefrontSettings {
  const defaults = defaultStorefrontSettings();
  const slug = slugifyService(settings?.slug || defaults.slug, defaults.slug);
  return {
    ...defaults,
    ...settings,
    slug,
    accentColor: settings?.accentColor || defaults.accentColor,
    serviceOrder: settings?.serviceOrder ?? defaults.serviceOrder,
    featuredServiceIds:
      settings?.featuredServiceIds ?? defaults.featuredServiceIds,
    categories: settings?.categories ?? defaults.categories,
    previousSlugs: settings?.previousSlugs ?? defaults.previousSlugs,
    updatedAt: settings?.updatedAt ?? defaults.updatedAt,
  };
}

function normalizeServiceOrder(order: ServiceOrder): ServiceOrder {
  return {
    ...order,
    clientId: order.clientId ?? null,
    planId: order.planId ?? null,
    extras: order.extras ?? [],
    answers: order.answers ?? [],
    paymentStatus: order.paymentStatus ?? "not_required",
    paymentMethod: order.paymentMethod ?? "not_selected",
    paymentLink: order.paymentLink ?? "",
    appointmentDate: order.appointmentDate ?? "",
    appointmentTime: order.appointmentTime ?? "",
    quoteId: order.quoteId ?? null,
    chargeId: order.chargeId ?? null,
    contractId: order.contractId ?? null,
    engagementId: order.engagementId ?? null,
    source: order.source ?? "storefront",
    status: order.status ?? "interest",
    events: order.events ?? [],
  };
}

function normalizeState(parsed?: Partial<OperationsState>): OperationsState {
  const seed = createSeedOperations();
  return {
    services: (parsed?.services ?? seed.services).map(normalizeService),
    serviceOrders: (parsed?.serviceOrders ?? seed.serviceOrders).map(
      normalizeServiceOrder,
    ),
    storefrontSettings: normalizeStorefront(
      parsed?.storefrontSettings ?? seed.storefrontSettings,
    ),
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

function nextServiceOrderNumber(current: ServiceOrder[]) {
  const year = new Date().getFullYear();
  const count =
    current.filter((order) => order.number.startsWith(`CTR-${year}-`)).length +
    1;
  return `CTR-${year}-${String(count).padStart(4, "0")}`;
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

  const addService = useCallback((service: ServiceInput) => {
    const timestamp = now();
    const created = normalizeService({
      ...service,
      id: makeId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setState((current) => ({
      ...current,
      services: [created, ...current.services],
    }));
    return created;
  }, []);

  const updateService = useCallback((id: string, service: ServiceInput) => {
    let saved: Service | null = null;
    setState((current) => ({
      ...current,
      services: current.services.map((item) => {
        if (item.id !== id) return item;
        saved = normalizeService({ ...item, ...service, updatedAt: now() });
        return saved;
      }),
    }));
    return saved;
  }, []);

  const archiveService = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      services: current.services.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "archived",
              inStorefront: false,
              archivedAt: now(),
              updatedAt: now(),
            }
          : item,
      ),
    }));
  }, []);

  const deleteService = useCallback((id: string) => {
    let removed = false;
    setState((current) => {
      const linked =
        current.quotes.some((quote) =>
          quote.items.some((item) => item.serviceId === id),
        ) ||
        current.engagements.some((engagement) => engagement.serviceId === id) ||
        current.serviceOrders.some((order) => order.serviceId === id);
      const service = current.services.find((item) => item.id === id);
      if (!service || linked || service.status === "published") return current;
      removed = true;
      return {
        ...current,
        services: current.services.filter((item) => item.id !== id),
      };
    });
    return removed;
  }, []);

  const duplicateService = useCallback((id: string) => {
    let copy: Service | null = null;
    setState((current) => {
      const source = current.services.find((service) => service.id === id);
      if (!source) return current;
      const timestamp = now();
      const name = `${source.name} - cópia`;
      const created = normalizeService({
        ...source,
        id: makeId(),
        name,
        slug: slugifyService(name),
        status: "draft",
        inStorefront: false,
        featured: false,
        publicToken: makeServicePublicToken(name),
        analytics: {
          storefrontViews: 0,
          serviceViews: 0,
          ctaClicks: 0,
          quoteRequests: 0,
          purchases: 0,
          appointments: 0,
          lastViewedAt: null,
        },
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      copy = created;
      return { ...current, services: [created, ...current.services] };
    });
    return copy;
  }, []);

  const setServiceStatus = useCallback((id: string, status: ServiceStatus) => {
    setState((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.id === id
          ? {
              ...service,
              status,
              inStorefront:
                status === "published"
                  ? true
                  : status === "archived"
                    ? false
                    : service.inStorefront,
              archivedAt: status === "archived" ? now() : service.archivedAt,
              updatedAt: now(),
            }
          : service,
      ),
    }));
  }, []);

  const setServiceAvailability = useCallback(
    (id: string, availabilityStatus: ServiceAvailabilityStatus) => {
      setState((current) => ({
        ...current,
        services: current.services.map((service) =>
          service.id === id
            ? { ...service, availabilityStatus, updatedAt: now() }
            : service,
        ),
      }));
    },
    [],
  );

  const toggleServiceStorefront = useCallback(
    (id: string, inStorefront: boolean) => {
      setState((current) => ({
        ...current,
        services: current.services.map((service) =>
          service.id === id
            ? {
                ...service,
                inStorefront,
                status: inStorefront ? "published" : service.status,
                updatedAt: now(),
              }
            : service,
        ),
        storefrontSettings: {
          ...current.storefrontSettings,
          serviceOrder: inStorefront
            ? Array.from(
                new Set([...current.storefrontSettings.serviceOrder, id]),
              )
            : current.storefrontSettings.serviceOrder.filter(
                (serviceId) => serviceId !== id,
              ),
          updatedAt: now(),
        },
      }));
    },
    [],
  );

  const recordServiceAnalytics = useCallback(
    (
      id: string,
      metric: keyof Pick<
        Service["analytics"],
        | "storefrontViews"
        | "serviceViews"
        | "ctaClicks"
        | "quoteRequests"
        | "purchases"
        | "appointments"
      >,
    ) => {
      setState((current) => ({
        ...current,
        services: current.services.map((service) =>
          service.id === id
            ? {
                ...service,
                analytics: {
                  ...service.analytics,
                  [metric]: service.analytics[metric] + 1,
                  lastViewedAt:
                    metric === "storefrontViews" || metric === "serviceViews"
                      ? now()
                      : service.analytics.lastViewedAt,
                },
                updatedAt: now(),
              }
            : service,
        ),
      }));
    },
    [],
  );

  const updateStorefrontSettings = useCallback(
    (settings: StorefrontSettings) => {
      setState((current) => {
        const previousSlug = current.storefrontSettings.slug;
        const normalized = normalizeStorefront({
          ...settings,
          previousSlugs:
            settings.slug !== previousSlug
              ? Array.from(
                  new Set([
                    ...current.storefrontSettings.previousSlugs,
                    previousSlug,
                  ]),
                )
              : settings.previousSlugs,
          updatedAt: now(),
        });
        return { ...current, storefrontSettings: normalized };
      });
    },
    [],
  );

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

  const addServiceOrder = useCallback(
    (order: ServiceOrderInput) => {
      const timestamp = now();
      const created = normalizeServiceOrder({
        ...order,
        id: makeId(),
        number: nextServiceOrderNumber(state.serviceOrders),
        events: [
          {
            id: makeId(),
            title: "Contratação recebida",
            description:
              order.source === "storefront"
                ? "Solicitação criada pela vitrine pública."
                : "Contratação registrada manualmente.",
            createdAt: timestamp,
          },
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      setState((current) => ({
        ...current,
        serviceOrders: [created, ...current.serviceOrders],
      }));
      return created;
    },
    [state.serviceOrders],
  );

  const updateServiceOrder = useCallback(
    (id: string, updates: Partial<ServiceOrder>) => {
      let saved: ServiceOrder | null = null;
      setState((current) => ({
        ...current,
        serviceOrders: current.serviceOrders.map((order) => {
          if (order.id !== id) return order;
          saved = normalizeServiceOrder({
            ...order,
            ...updates,
            updatedAt: now(),
          });
          return saved;
        }),
      }));
      return saved;
    },
    [],
  );

  const setServiceOrderStatus = useCallback(
    (id: string, status: ServiceOrderStatus) => {
      setState((current) => ({
        ...current,
        serviceOrders: current.serviceOrders.map((order) =>
          order.id === id
            ? {
                ...order,
                status,
                updatedAt: now(),
                events: [
                  {
                    id: makeId(),
                    title: "Status atualizado",
                    description: `Novo status da contratação: ${status}.`,
                    createdAt: now(),
                  },
                  ...order.events,
                ],
              }
            : order,
        ),
      }));
    },
    [],
  );

  const recordServiceOrderConversion = useCallback(
    (
      id: string,
      target: "quote" | "billing" | "contract" | "project",
      targetId: string,
    ) => {
      const labels = {
        quote: "Orçamento criado",
        billing: "Cobrança criada",
        contract: "Contrato criado",
        project: "Demanda criada",
      };
      setState((current) => ({
        ...current,
        serviceOrders: current.serviceOrders.map((order) =>
          order.id === id
            ? {
                ...order,
                quoteId: target === "quote" ? targetId : order.quoteId,
                chargeId: target === "billing" ? targetId : order.chargeId,
                contractId: target === "contract" ? targetId : order.contractId,
                engagementId:
                  target === "project" ? targetId : order.engagementId,
                status:
                  target === "billing" && order.status === "interest"
                    ? "awaiting_payment"
                    : order.status,
                updatedAt: now(),
                events: [
                  {
                    id: makeId(),
                    title: labels[target],
                    description: "Integração registrada a partir da vitrine.",
                    createdAt: now(),
                  },
                  ...order.events,
                ],
              }
            : order,
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
    deleteService,
    duplicateService,
    setServiceStatus,
    setServiceAvailability,
    toggleServiceStorefront,
    recordServiceAnalytics,
    updateStorefrontSettings,
    addServiceOrder,
    updateServiceOrder,
    setServiceOrderStatus,
    recordServiceOrderConversion,
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
