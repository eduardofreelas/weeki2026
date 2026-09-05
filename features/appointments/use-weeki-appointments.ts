"use client";

import { useCallback, useEffect, useState } from "react";
import { createSeedAppointments, createSeedEventTypes } from "./seed";
import type { Appointment, AppointmentDraft, AppointmentStatus, EventType, EventTypeDraft } from "./types";

const APPOINTMENTS_KEY = "weeki.appointments.v1";
const EVENT_TYPES_KEY = "weeki.event-types.v1";
const APPROVAL_KEY = "weeki.appointments.auto-approval.v1";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function readStorage<T>(key: string, fallback: () => T): T {
  if (typeof window === "undefined") return fallback();
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback();
  } catch {
    return fallback();
  }
}

export function useWeekiAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>(() => readStorage(APPOINTMENTS_KEY, createSeedAppointments));
  const [eventTypes, setEventTypes] = useState<EventType[]>(() => readStorage(EVENT_TYPES_KEY, createSeedEventTypes));
  const [autoApproval, setAutoApprovalState] = useState(() => readStorage(APPROVAL_KEY, () => false));

  useEffect(() => {
    try { window.localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments)); } catch { /* Storage is optional. */ }
  }, [appointments]);

  useEffect(() => {
    try { window.localStorage.setItem(EVENT_TYPES_KEY, JSON.stringify(eventTypes)); } catch { /* Storage is optional. */ }
  }, [eventTypes]);

  useEffect(() => {
    try { window.localStorage.setItem(APPROVAL_KEY, JSON.stringify(autoApproval)); } catch { /* Storage is optional. */ }
  }, [autoApproval]);

  const addAppointment = useCallback((draft: AppointmentDraft) => {
    const now = new Date().toISOString();
    const appointment: Appointment = { ...draft, id: makeId(), createdAt: now, updatedAt: now };
    setAppointments((current) => [...current, appointment]);
    return appointment;
  }, []);

  const updateAppointment = useCallback((id: string, draft: AppointmentDraft) => {
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, ...draft, updatedAt: new Date().toISOString() } : item));
  }, []);

  const setAppointmentStatus = useCallback((id: string, status: AppointmentStatus) => {
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
  }, []);

  const addEventType = useCallback((draft: EventTypeDraft) => {
    const now = new Date().toISOString();
    const eventType: EventType = { ...draft, id: makeId(), createdAt: now, updatedAt: now };
    setEventTypes((current) => [eventType, ...current]);
    return eventType;
  }, []);

  const updateEventType = useCallback((id: string, draft: EventTypeDraft) => {
    setEventTypes((current) => current.map((item) => item.id === id ? { ...item, ...draft, updatedAt: new Date().toISOString() } : item));
  }, []);

  const toggleEventType = useCallback((id: string) => {
    setEventTypes((current) => current.map((item) => item.id === id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item));
  }, []);

  return {
    appointments,
    eventTypes,
    autoApproval,
    setAutoApproval: setAutoApprovalState,
    addAppointment,
    updateAppointment,
    setAppointmentStatus,
    addEventType,
    updateEventType,
    toggleEventType,
  };
}
