"use client";

import type { ReactNode } from "react";
import { FlaskConical, Info, type LucideIcon } from "lucide-react";
import { NFSE_STATUS_LABELS, type NfseStatus } from "@/shared/fiscal";
import { cn } from "@/lib/utils";

const statusStyles: Record<NfseStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
  AUTHORIZED: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10",
  ERROR: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
};

export function NfseStatusBadge({ status, compact = false }: { status: NfseStatus; compact?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset", compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]", statusStyles[status])}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {NFSE_STATUS_LABELS[status]}
    </span>
  );
}

export function SandboxBanner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50/75 px-3.5 py-3 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200", className)} role="status">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><FlaskConical className="size-3.5" /></span>
      <div><p className="text-[11px] font-bold">Ambiente de testes</p><p className="mt-0.5 text-[10px] leading-4 text-amber-700/80 dark:text-amber-200/70">Nenhuma nota fiscal real será emitida. API Nacional, assinatura e certificado estão em standby seguro.</p></div>
    </div>
  );
}

export function FiscalPanel({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card", className)}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3.5 dark:border-white/8 sm:px-5">
        <div><h2 className="text-xs font-bold text-slate-900 dark:text-white">{title}</h2>{description && <p className="mt-1 text-[10px] leading-4 text-slate-400">{description}</p>}</div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function FiscalMetric({ label, value, helper, icon: Icon, tone = "violet" }: { label: string; value: string | number; helper?: string; icon: LucideIcon; tone?: "violet" | "blue" | "emerald" | "amber" | "rose" | "slate" }) {
  const tones = {
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-card">
      <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold leading-4 text-slate-500 dark:text-slate-400">{label}</p><span className={cn("grid size-7 place-items-center rounded-md", tones[tone])}><Icon className="size-3.5" /></span></div>
      <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">{value}</p>
      {helper && <p className="mt-1 text-[9px] text-slate-400">{helper}</p>}
    </article>
  );
}

export function InfoNote({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "success" }) {
  const tones = {
    neutral: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300",
    warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/8 dark:text-emerald-200",
  };
  return <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[10px] leading-4", tones[tone])}><Info className="mt-0.5 size-3.5 shrink-0" /><div>{children}</div></div>;
}

export function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return <label className="mb-1.5 block text-[10px] font-bold text-slate-600 dark:text-slate-300">{children}{required && <span className="ml-1 text-rose-500">*</span>}</label>;
}

export const formatFiscalCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
