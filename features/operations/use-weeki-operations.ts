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
  QuoteStatus,
  Service,
  TimeEntry,
} from "./types";

const STORAGE_KEY = "weeki.operations.v1";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function readState(): OperationsState {
  if (typeof window === "undefined") return createSeedOperations();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return createSeedOperations();
    const parsed = JSON.parse(saved) as Partial<OperationsState>;
    const seed = createSeedOperations();
    return {
      services: parsed.services ?? seed.services,
      opportunities: parsed.opportunities ?? seed.opportunities,
      quotes: parsed.quotes ?? seed.quotes,
      engagements: parsed.engagements ?? seed.engagements,
      cycles: parsed.cycles ?? seed.cycles,
      deliverables: parsed.deliverables ?? seed.deliverables,
      timeEntries: parsed.timeEntries ?? seed.timeEntries,
    };
  } catch {
    return createSeedOperations();
  }
}

const now = () => new Date().toISOString();

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
      const number = `ORC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const created = {
        ...quote,
        id: makeId(),
        number,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        quotes: [created, ...current.quotes],
      }));
      return created;
    },
    [],
  );

  const updateQuote = useCallback(
    (
      id: string,
      quote: Omit<Quote, "id" | "number" | "createdAt" | "updatedAt">,
    ) => {
      setState((current) => ({
        ...current,
        quotes: current.quotes.map((item) =>
          item.id === id ? { ...item, ...quote, updatedAt: now() } : item,
        ),
      }));
    },
    [],
  );

  const setQuoteStatus = useCallback((id: string, status: QuoteStatus) => {
    setState((current) => ({
      ...current,
      quotes: current.quotes.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              approvedAt:
                status === "approved"
                  ? item.approvedAt || now()
                  : item.approvedAt,
              updatedAt: now(),
            }
          : item,
      ),
    }));
  }, []);

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
