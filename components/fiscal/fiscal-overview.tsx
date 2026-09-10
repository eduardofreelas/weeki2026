"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileCheck2,
  FilePlus2,
  FileWarning,
  ReceiptText,
  Settings2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FiscalWorkspaceState } from "@/features/fiscal/types";
import { validateIssuer } from "@/features/fiscal/validation";
import { NFSE_ORIGIN_LABELS } from "@/shared/fiscal";
import { FiscalMetric, FiscalPanel, NfseStatusBadge, SandboxBanner, formatFiscalCurrency } from "./common";

export function FiscalOverview({
  state,
  onNavigate,
  onDismissOnboarding,
  onOpenNote,
}: {
  state: FiscalWorkspaceState;
  onNavigate: (view: "notes" | "issue" | "settings") => void;
  onDismissOnboarding: () => void;
  onOpenNote: (id: string) => void;
}) {
  const profileReady = validateIssuer(state.profile).length === 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthNotes = state.notes.filter((note) => (note.issuedAt || note.createdAt).slice(0, 7) === currentMonth);
  const authorized = monthNotes.filter((note) => note.status === "AUTHORIZED");
  const processing = monthNotes.filter((note) => ["PENDING", "PROCESSING"].includes(note.status));
  const rejected = monthNotes.filter((note) => ["REJECTED", "ERROR"].includes(note.status));
  const cancelled = monthNotes.filter((note) => note.status === "CANCELLED");
  const drafts = monthNotes.filter((note) => note.status === "DRAFT");
  const recent = state.notes.slice(0, 6);

  if (!state.profile.configuredAt && !state.onboardingDismissed) {
    const steps = [
      { label: "Dados da empresa", done: profileReady },
      { label: "Configuração fiscal", done: Boolean(state.profile.taxRegime) },
      { label: "Certificado digital", done: state.certificate?.status === "active" },
      { label: "Serviços", done: state.serviceConfigs.some((item) => item.active) },
      { label: "Automação", done: state.automation.enabled },
      { label: "Teste de emissão", done: false },
    ];
    const completed = steps.filter((step) => step.done).length;
    const progress = Math.round((completed / steps.length) * 100);
    return (
      <div className="space-y-4">
        <SandboxBanner />
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-5 sm:p-8 lg:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Sparkles className="size-3" /> Fiscal na Weeki</span>
              <h2 className="mt-4 max-w-xl text-2xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white sm:text-3xl">Automatize a emissão das suas notas fiscais</h2>
              <p className="mt-3 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">Use os dados dos seus clientes e serviços para preparar NFS-e com menos preenchimento. A emissão real só será liberada depois da homologação e da configuração segura do certificado.</p>
              <div className="mt-5 grid gap-2 text-[11px] text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                {["Preenchimento inteligente", "Histórico fiscal centralizado", "Gatilhos por serviço ou cobrança", "Envio por e-mail após autorização"].map((benefit) => <span key={benefit} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="size-3" /></span>{benefit}</span>)}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onNavigate("settings")} className="h-9 rounded-lg bg-[#5944df] px-4 text-[11px]"><Settings2 className="size-3.5" /> Configurar NFS-e</Button>
                <Button size="sm" variant="outline" onClick={onDismissOnboarding} className="h-9 rounded-lg bg-white px-4 text-[11px] shadow-none">Explorar o módulo <ArrowRight className="size-3.5" /></Button>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/70 p-5 dark:border-white/8 dark:bg-white/[0.025] sm:p-7 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-800 dark:text-slate-100">Configure no seu ritmo</p><p className="mt-1 text-[10px] text-slate-400">Seu progresso fica salvo.</p></div><span className="text-xs font-bold text-violet-600 dark:text-violet-300">{progress}%</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#7657ff] to-[#2f80ed] transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="mt-5 space-y-2">
                {steps.map((step, index) => <div key={step.label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-card"><span className={step.done ? "grid size-6 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "grid size-6 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5"}>{step.done ? <Check className="size-3.5" /> : <span className="text-[9px] font-bold">{index + 1}</span>}</span><span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{step.label}</span>{step.label === "Teste de emissão" && <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">STANDBY</span>}</div>)}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SandboxBanner />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FiscalMetric label="Valor emitido no mês" value={formatFiscalCurrency(authorized.reduce((sum, note) => sum + note.amount, 0))} helper="Somente notas autorizadas" icon={ReceiptText} tone="violet" />
        <FiscalMetric label="Notas autorizadas" value={authorized.length} helper={`${monthNotes.length} registro${monthNotes.length === 1 ? "" : "s"} no mês`} icon={FileCheck2} tone="emerald" />
        <FiscalMetric label="Aguardando / processando" value={processing.length} helper={`${drafts.length} rascunho${drafts.length === 1 ? "" : "s"}`} icon={Clock3} tone="blue" />
        <FiscalMetric label="Rejeitadas ou canceladas" value={rejected.length + cancelled.length} helper={`${rejected.length} com atenção · ${cancelled.length} cancelada${cancelled.length === 1 ? "" : "s"}`} icon={rejected.length ? FileWarning : XCircle} tone={rejected.length ? "rose" : "slate"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <FiscalPanel title="Notas recentes" description="Últimas movimentações registradas no módulo Fiscal." action={<button type="button" onClick={() => onNavigate("notes")} className="text-[10px] font-bold text-violet-600 hover:text-violet-700">Ver todas</button>}>
          {recent.length ? (
            <div className="divide-y divide-slate-100 dark:divide-white/8">
              {recent.map((note) => <button type="button" key={note.id} onClick={() => onOpenNote(note.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_100px_110px] sm:px-5"><div className="min-w-0"><p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">{note.customer.name}</p><p className="mt-0.5 truncate text-[9px] text-slate-400">{note.customer.document || "Documento pendente"}</p></div><div className="hidden min-w-0 sm:block"><p className="truncate text-[10px] font-semibold text-slate-600 dark:text-slate-300">{note.service.name}</p><p className="mt-0.5 truncate text-[9px] text-slate-400">{NFSE_ORIGIN_LABELS[note.origin]}</p></div><p className="hidden text-right text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200 sm:block">{formatFiscalCurrency(note.amount)}</p><NfseStatusBadge status={note.status} compact /></button>)}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center px-5 py-8 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><FilePlus2 className="size-5" /></span><p className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-100">Nenhuma nota preparada</p><p className="mx-auto mt-1 max-w-sm text-[10px] leading-4 text-slate-400">Crie um rascunho usando um cliente e um serviço já configurados.</p><Button size="sm" onClick={() => onNavigate("issue")} className="mt-4 h-8 rounded-md bg-[#5944df] px-3 text-[10px]">Preparar primeira NFS-e</Button></div></div>
          )}
        </FiscalPanel>

        <FiscalPanel title="Prontidão fiscal" description="Itens necessários antes da homologação.">
          <div className="space-y-1.5 p-4">
            {[
              { label: "Dados fiscais", done: profileReady },
              { label: "Serviço configurado", done: state.serviceConfigs.some((item) => item.active) },
              { label: "Certificado protegido", done: state.certificate?.status === "active" },
              { label: "API Nacional homologada", done: false },
            ].map((item) => <button type="button" key={item.label} onClick={() => onNavigate("settings")} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03]"><span className={item.done ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}>{item.done ? <CheckCircle2 className="size-4" /> : <CircleDashed className="size-4" />}</span><span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{item.label}</span></button>)}
          </div>
        </FiscalPanel>
      </div>
    </div>
  );
}
