"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { createSeedFinanceTransactions } from "./seed";
import type { FinanceTransaction, FinanceTransactionDraft, FinanceTransactionStatus } from "./types";

const STORAGE_KEY = "weeki.finance.transactions.v1";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function loadTransactions() {
  if (typeof window === "undefined") return createSeedFinanceTransactions();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as FinanceTransaction[] : createSeedFinanceTransactions();
  } catch {
    return createSeedFinanceTransactions();
  }
}

export function useWeekiFinance() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(loadTransactions);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); } catch { /* Browser storage is optional. */ }
  }, [transactions]);

  useEffect(() => {
    const reload = () => setTransactions(loadTransactions());
    window.addEventListener("storage", reload);
    window.addEventListener("weeki-storage", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("weeki-storage", reload);
    };
  }, []);

  const addTransaction = useCallback((draft: FinanceTransactionDraft) => {
    const now = new Date().toISOString();
    const transaction: FinanceTransaction = { ...draft, id: makeId(), createdAt: now, updatedAt: now };
    setTransactions((current) => [transaction, ...current]);
    return transaction;
  }, []);

  const updateTransaction = useCallback((id: string, draft: FinanceTransactionDraft) => {
    setTransactions((current) => current.map((item) => item.id === id ? { ...item, ...draft, updatedAt: new Date().toISOString() } : item));
  }, []);

  const setTransactionStatus = useCallback((id: string, status: FinanceTransactionStatus) => {
    setTransactions((current) => current.map((item) => item.id === id ? {
      ...item,
      status,
      paidDate: status === "paid" ? (item.paidDate || format(new Date(), "yyyy-MM-dd")) : "",
      updatedAt: new Date().toISOString(),
    } : item));
  }, []);

  const duplicateTransaction = useCallback((id: string) => {
    const source = transactions.find((item) => item.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: FinanceTransaction = {
      ...source,
      id: makeId(),
      description: `${source.description} — cópia`,
      dueDate: format(new Date(), "yyyy-MM-dd"),
      paidDate: "",
      status: "pending",
      recurring: false,
      recurrenceEndDate: "",
      createdAt: now,
      updatedAt: now,
    };
    setTransactions((current) => [copy, ...current]);
    return copy;
  }, [transactions]);

  return { transactions, addTransaction, updateTransaction, setTransactionStatus, duplicateTransaction };
}
