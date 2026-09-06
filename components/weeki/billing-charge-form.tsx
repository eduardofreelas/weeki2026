"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Barcode, Check, CreditCard, Link2, MessageCircle, QrCode, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/features/clients/types";
import { BILLING_METHOD_LABELS, type BillingCharge, type BillingChargeDraft, type BillingGatewaySettings, type BillingMethod } from "@/features/billing/types";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function emptyDraft(settings: BillingGatewaySettings): BillingChargeDraft {
  const methods: BillingMethod[] = [];
  if (settings.pixEnabled) methods.push("pix");
  if (settings.cardEnabled) methods.push("credit_card");
  if (settings.bankSlipEnabled) methods.push("bank_slip");
  return {
    clientId: "",
    description: "",
    amount: 0,
    dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    dueTime: "23:59",
    methods: methods.length ? methods : ["pix"],
    cardMaxInstallments: 3,
    passCardFees: true,
    discountEnabled: false,
    discountMethod: "pix",
    discountPercent: 5,
    remindersEnabled: true,
    lateFeeEnabled: false,
    lateFeePercent: 2,
    dailyInterestPercent: 0.033,
    message: "Olá! Segue o link para pagamento referente aos serviços prestados. Se precisar, estou à disposição.",
  };
}

function chargeToDraft(charge: BillingCharge): BillingChargeDraft {
  return {
    clientId: charge.clientId,
    description: charge.description,
    amount: charge.amount,
    dueDate: charge.dueDate,
    dueTime: charge.dueTime,
    methods: charge.methods,
    cardMaxInstallments: charge.cardMaxInstallments,
    passCardFees: charge.passCardFees,
    discountEnabled: charge.discountEnabled,
    discountMethod: charge.discountMethod,
    discountPercent: charge.discountPercent,
    remindersEnabled: charge.remindersEnabled,
    lateFeeEnabled: charge.lateFeeEnabled,
    lateFeePercent: charge.lateFeePercent,
    dailyInterestPercent: charge.dailyInterestPercent,
    message: charge.message,
  };
}

export function BillingChargeForm({ charge, clients, settings, onBack, onSave }: { charge: BillingCharge | null; clients: Client[]; settings: BillingGatewaySettings; onBack: () => void; onSave: (draft: BillingChargeDraft, asDraft: boolean, id?: string) => void }) {
  const [draft, setDraft] = useState<BillingChargeDraft>(() => charge ? chargeToDraft(charge) : emptyDraft(settings));
  const update = <K extends keyof BillingChargeDraft>(key: K, value: BillingChargeDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const client = clients.find((item) => item.id === draft.clientId);
  const discountedAmount = draft.discountEnabled ? Math.max(0, draft.amount * (1 - draft.discountPercent / 100)) : draft.amount;

  const toggleMethod = (method: BillingMethod, enabled: boolean) => {
    setDraft((current) => ({ ...current, methods: enabled ? Array.from(new Set([...current.methods, method])) : current.methods.filter((item) => item !== method) }));
  };

  const submit = (event: FormEvent, asDraft = false) => {
    event.preventDefault();
    if (!asDraft) {
      if (!draft.clientId) return toast.error("Selecione o cliente da cobrança.");
      if (!draft.description.trim()) return toast.error("Informe a descrição do serviço.");
      if (!draft.amount || draft.amount <= 0) return toast.error("Informe um valor maior que zero.");
      if (!draft.dueDate) return toast.error("Informe a data de vencimento.");
      if (!draft.methods.length) return toast.error("Ative pelo menos uma forma de pagamento.");
    }
    onSave({ ...draft, description: draft.description.trim(), message: draft.message.trim() }, asDraft, charge?.id);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><button type="button" onClick={onBack} className="flex items-center gap-1.5 font-medium hover:text-slate-900"><ArrowLeft className="size-3.5" /> Cobranças</button><span className="text-slate-300">/</span><span className="font-semibold text-slate-800">{charge ? `Editar ${charge.code}` : "Nova cobrança"}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-500">Rascunho automático</span></div>
      <div className="mt-6"><h1 className="text-[23px] font-bold tracking-[-0.035em] text-slate-900 sm:text-[25px]">Gerar cobrança por link</h1><p className="mt-1.5 text-xs leading-5 text-slate-500">Configure as condições e confira a experiência do pagador em tempo real.</p></div>

      {!settings.connected && <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] text-amber-800"><Sparkles className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Modo de demonstração</p><p className="mt-0.5 text-amber-700">Você pode montar e salvar cobranças. O link só aceitará pagamentos após a conexão segura com o Asaas.</p></div></div>}

      <form onSubmit={(event) => submit(event)} className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-4">
          <SectionCard step="01" title="Destinatário e serviço">
            <Field label="Cliente cadastrado"><Select value={draft.clientId || "none"} onValueChange={(value) => update("clientId", value === "none" ? "" : value)}><SelectTrigger className="h-9 rounded-md bg-slate-50 text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Selecione o cliente</SelectItem>{clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Descrição do item ou escopo"><Input value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Ex.: Consultoria estratégica mensal" className="h-9 rounded-md text-xs shadow-none" /></Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_130px]"><Field label="Valor principal"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span><Input type="number" min="0" step="0.01" value={draft.amount || ""} onChange={(event) => update("amount", Number(event.target.value))} className="h-9 rounded-md pl-9 text-xs tabular-nums shadow-none" /></div></Field><Field label="Data de vencimento"><Input type="date" value={draft.dueDate} onChange={(event) => update("dueDate", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Horário limite"><Input type="time" value={draft.dueTime} onChange={(event) => update("dueTime", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field></div>
          </SectionCard>

          <SectionCard step="02" title="Opções de pagamento">
            <PaymentOption icon={Zap} title="Pix instantâneo" description="Confirmação rápida após integração com o gateway." enabled={draft.methods.includes("pix")} onChange={(enabled) => toggleMethod("pix", enabled)} badge="Recomendado" />
            <PaymentOption icon={CreditCard} title="Cartão de crédito" description="Parcelamento pelo checkout seguro do gateway." enabled={draft.methods.includes("credit_card")} onChange={(enabled) => toggleMethod("credit_card", enabled)}>
              {draft.methods.includes("credit_card") && <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2"><Field label="Parcelamento máximo"><Select value={String(draft.cardMaxInstallments)} onValueChange={(value) => update("cardMaxInstallments", Number(value))}><SelectTrigger className="h-8 rounded-md bg-white text-[11px] shadow-none"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,6,12].map((count) => <SelectItem key={count} value={String(count)}>Até {count}x</SelectItem>)}</SelectContent></Select></Field><Field label="Taxa de parcelamento"><div className="grid h-8 grid-cols-2 rounded-md bg-white p-0.5"><button type="button" onClick={() => update("passCardFees", true)} className={cn("rounded text-[9px] font-medium text-slate-500", draft.passCardFees && "bg-slate-900 text-white")}>Repassar</button><button type="button" onClick={() => update("passCardFees", false)} className={cn("rounded text-[9px] font-medium text-slate-500", !draft.passCardFees && "bg-slate-900 text-white")}>Assumir</button></div></Field></div>}
            </PaymentOption>
            <PaymentOption icon={Barcode} title="Boleto bancário" description="Disponível quando habilitado na conta Asaas." enabled={draft.methods.includes("bank_slip")} onChange={(enabled) => toggleMethod("bank_slip", enabled)} />

            <div className="rounded-lg border border-slate-200 p-3.5"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md bg-[#efedff] text-[#5c45df]">%</span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-800">Desconto condicional</p><p className="mt-0.5 text-[10px] text-slate-400">Incentive o pagamento por uma forma específica.</p></div><Switch size="sm" checked={draft.discountEnabled} onCheckedChange={(checked) => update("discountEnabled", checked)} /></div>{draft.discountEnabled && <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2"><Field label="Aplicar desconto em"><Select value={draft.discountMethod} onValueChange={(value) => update("discountMethod", value as BillingMethod)}><SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger><SelectContent>{draft.methods.map((method) => <SelectItem key={method} value={method}>{BILLING_METHOD_LABELS[method]}</SelectItem>)}</SelectContent></Select></Field><Field label="Percentual"><div className="relative"><Input type="number" min="0" max="100" step="0.1" value={draft.discountPercent} onChange={(event) => update("discountPercent", Number(event.target.value))} className="h-8 rounded-md pr-8 text-[11px] shadow-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span></div></Field><div className="sm:col-span-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-[10px]"><span className="text-slate-500">Valor com desconto</span><strong className="font-semibold text-[#5b45df]">{currency.format(discountedAmount)}</strong></div></div>}</div>
          </SectionCard>

          <SectionCard step="03" title="Automação e comunicação">
            <ToggleRow title="Lembretes automáticos" description="Organiza avisos antes e no dia do vencimento." checked={draft.remindersEnabled} onChange={(checked) => update("remindersEnabled", checked)} />
            <ToggleRow title="Multa e juros após atraso" description="Recalcula o valor devido quando o pagamento vence." checked={draft.lateFeeEnabled} onChange={(checked) => update("lateFeeEnabled", checked)} />
            {draft.lateFeeEnabled && <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><Field label="Multa"><Input type="number" min="0" step="0.1" value={draft.lateFeePercent} onChange={(event) => update("lateFeePercent", Number(event.target.value))} className="h-8 rounded-md text-[11px] shadow-none" /></Field><Field label="Juros ao dia"><Input type="number" min="0" step="0.001" value={draft.dailyInterestPercent} onChange={(event) => update("dailyInterestPercent", Number(event.target.value))} className="h-8 rounded-md text-[11px] shadow-none" /></Field></div>}
            <Field label="Mensagem exibida no link"><Textarea value={draft.message} onChange={(event) => update("message", event.target.value)} rows={3} className="resize-none rounded-md text-xs shadow-none" /></Field>
          </SectionCard>

          <div className="flex flex-col-reverse gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"><Button type="button" variant="ghost" size="sm" onClick={(event) => submit(event as unknown as FormEvent, true)} className="h-8 rounded-md text-[11px] text-slate-500">Salvar rascunho</Button><div className="sm:ml-auto flex gap-2"><Button type="button" variant="outline" size="sm" onClick={onBack} className="h-8 flex-1 rounded-md px-3 text-[11px] shadow-none sm:flex-none">Cancelar</Button><Button type="submit" size="sm" className="h-8 flex-1 rounded-md bg-[#111827] px-4 text-[11px] shadow-none hover:bg-[#272f3d] sm:flex-none"><Zap className="size-3.5" />{charge ? "Salvar cobrança" : "Gerar link de cobrança"}</Button></div></div>
        </div>

        <BillingPreview draft={draft} client={client} connected={settings.connected} discountedAmount={discountedAmount} />
      </form>
    </div>
  );
}

function BillingPreview({ draft, client, connected, discountedAmount }: { draft: BillingChargeDraft; client?: Client; connected: boolean; discountedAmount: number }) {
  return <aside className="xl:sticky xl:top-[88px]"><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex h-10 items-center gap-1.5 bg-[#e9edff] px-3"><span className="size-2 rounded-full bg-slate-300" /><span className="size-2 rounded-full bg-slate-300" /><span className="size-2 rounded-full bg-slate-300" /><div className="mx-3 flex h-7 min-w-0 flex-1 items-center gap-2 rounded bg-white px-3 text-[9px] text-slate-500"><Link2 className="size-3 text-emerald-500" /><span className="truncate">weeki.com.br/pagar/previa</span></div><span className={cn("rounded-md px-2 py-1 text-[8px] font-semibold", connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{connected ? "Gateway ativo" : "Prévia"}</span></div><div className="bg-[#f7f8fc] p-4 sm:p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#111827] text-[11px] font-semibold text-white">{client?.initials ?? "CL"}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900">Seu negócio</p><p className="truncate text-[10px] text-slate-400">Cobrança segura pela Weeki</p></div></div><div className="mt-4 rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">Pagador</p><p className="mt-1 text-xs font-semibold text-slate-800">{client?.name ?? "Cliente selecionado"}</p></div><div className="text-right"><p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">Vencimento</p><p className="mt-1 text-[11px] font-medium text-slate-700">{draft.dueDate ? format(parseISO(draft.dueDate), "dd MMM yyyy", { locale: ptBR }) : "—"}</p></div></div><div className="mt-4 rounded-md bg-[#f2f1ff] p-3"><p className="line-clamp-2 text-[10px] text-slate-500">{draft.description || "Descrição do serviço"}</p><div className="mt-2 flex items-end justify-between gap-3"><span className="text-[10px] font-medium text-slate-500">Total a pagar</span><strong className="text-xl font-bold tracking-[-0.04em] text-slate-900">{currency.format(draft.discountEnabled ? discountedAmount : draft.amount)}</strong></div>{draft.discountEnabled && <p className="mt-1 text-right text-[9px] text-[#5a45dc]">{draft.discountPercent}% de desconto via {BILLING_METHOD_LABELS[draft.discountMethod]}</p>}</div></div><div className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-[#e8ebf8] p-1">{(["pix", "credit_card", "bank_slip"] as BillingMethod[]).map((method) => <span key={method} className={cn("flex h-7 items-center justify-center rounded text-[9px] font-medium text-slate-400", draft.methods.includes(method) && "bg-white text-slate-700")}>{BILLING_METHOD_LABELS[method]}</span>)}</div><div className="mt-3 grid min-h-[180px] place-items-center rounded-lg border border-slate-200 bg-white text-center"><div><QrCode className="mx-auto size-20 text-slate-900" strokeWidth={1.3} /><p className="mt-2 text-[10px] font-medium text-slate-600">Checkout exibido após integração</p><p className="mt-1 text-[9px] text-slate-400">Pix, cartão ou boleto conforme configuração</p></div></div>{draft.message && <div className="mt-3 rounded-md bg-[#eceefa] p-3"><p className="text-[8px] font-semibold uppercase text-slate-400">Mensagem</p><p className="mt-1 line-clamp-3 text-[10px] leading-4 text-slate-600">{draft.message}</p></div>}<p className="mt-4 flex items-center justify-center gap-1.5 text-[9px] text-slate-400"><Check className="size-3 text-emerald-500" /> Pagamento processado pelo gateway conectado</p></div></div><div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] text-slate-500"><span className="size-1.5 rounded-full bg-[#654ff0]" /><span className="flex-1">Prévia atualizada enquanto você edita</span><MessageCircle className="size-3.5" /></div></aside>;
}

function SectionCard({ step, title, children }: { step: string; title: string; children: ReactNode }) { return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center"><span className="mr-2 size-2 rounded-full bg-[#6550eb]" /><h2 className="text-sm font-semibold text-slate-900">{title}</h2><span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">Etapa {step}</span></div><div className="space-y-4">{children}</div></section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">{label}</span>{children}</label>; }
function PaymentOption({ icon: Icon, title, description, badge, enabled, onChange, children }: { icon: typeof CreditCard; title: string; description: string; badge?: string; enabled: boolean; onChange: (enabled: boolean) => void; children?: ReactNode }) { return <div className={cn("rounded-lg border p-3.5 transition", enabled ? "border-[#d9d4ff] bg-[#f5f3ff]" : "border-slate-200 bg-slate-50/70")}><div className="flex items-center gap-3"><span className={cn("grid size-8 place-items-center rounded-md", enabled ? "bg-white text-[#5a44dc]" : "bg-slate-100 text-slate-400")}><Icon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-xs font-medium text-slate-800">{title}</p>{badge && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-slate-500">{badge}</span>}</div><p className="mt-0.5 text-[10px] text-slate-400">{description}</p></div><Switch size="sm" checked={enabled} onCheckedChange={onChange} /></div>{children}</div>; }
function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-800">{title}</p><p className="mt-0.5 text-[10px] text-slate-400">{description}</p></div><Switch size="sm" checked={checked} onCheckedChange={onChange} /></div>; }
