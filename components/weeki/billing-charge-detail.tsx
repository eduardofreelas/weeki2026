"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Barcode, CalendarDays, CheckCircle2, Copy, CreditCard, Eye, Link2, Mail, MessageCircle, Pencil, QrCode, Send, ShieldCheck, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Client } from "@/features/clients/types";
import { BILLING_METHOD_LABELS, BILLING_STATUS_LABELS, type BillingCharge, type BillingMethod, type BillingSendChannel, type BillingStatus } from "@/features/billing/types";
import { ConfirmActionDialog } from "@/components/weeki/confirm-action-dialog";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function BillingChargeDetail({ charge, charges, client, gatewayConnected, onBack, onEdit, onStatusChange, onDispatch, onExtendDueDate }: { charge: BillingCharge; charges: BillingCharge[]; client?: Client; gatewayConnected: boolean; onBack: () => void; onEdit: () => void; onStatusChange: (status: BillingStatus) => void; onDispatch: (channel: BillingSendChannel) => void; onExtendDueDate: (dueDate: string) => void }) {
  const [extendOpen, setExtendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState(charge.dueDate);
  const publicLink = `https://weeki.com.br${charge.paymentLink}`;
  const discountedAmount = charge.discountEnabled ? charge.amount * (1 - charge.discountPercent / 100) : charge.amount;
  const clientCharges = charges.filter((item) => item.clientId === charge.clientId);
  const paidCharges = clientCharges.filter((item) => item.status === "paid");

  const copyAndRegister = async (channel: BillingSendChannel) => {
    try {
      await navigator.clipboard.writeText(publicLink);
      onDispatch(channel);
      toast.success(channel === "copied" ? "Link copiado." : channel === "whatsapp" ? "Link copiado para enviar pelo WhatsApp." : "Link copiado para enviar por e-mail.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const saveDueDate = () => {
    if (!newDueDate) return toast.error("Informe a nova data.");
    onExtendDueDate(newDueDate);
    setExtendOpen(false);
    toast.success("Vencimento atualizado.");
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-4" /> Voltar para Cobranças</button><span className="hidden text-slate-300 sm:inline">/</span><h1 className="text-2xl font-semibold tracking-tight text-slate-900">#{charge.code}</h1><StatusBadge status={charge.status} />{charge.accessCount > 0 && <span className="inline-flex w-fit items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500"><Eye className="size-3" /> Acessado {charge.accessCount}x</span>}
        <div className="flex gap-2 sm:ml-auto"><Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil className="size-3.5" /> Editar</Button>{charge.status !== "cancelled" && charge.status !== "paid" && <Button type="button" variant="ghost" size="sm" onClick={() => setCancelOpen(true)} className="text-rose-600"><XCircle className="size-3.5" /> Cancelar</Button>}</div>
      </div>

      <section className="mt-5 rounded-xl bg-gradient-to-br from-[#0d1729] to-[#151c42] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/45">Canal de recebimento digital</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Link de pagamento pronto para envio</h2></div><span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium", gatewayConnected ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-amber-300/20 bg-amber-300/10 text-amber-200")}><ShieldCheck className="size-3.5" />{gatewayConnected ? "Checkout conectado" : "Modo demonstrativo"}</span></div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row"><div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md bg-white px-3 text-sm text-slate-700"><Link2 className="size-3.5 shrink-0" /><span className="truncate">{publicLink}</span><span className="ml-auto hidden shrink-0 text-xs font-semibold uppercase text-slate-400 md:inline">{gatewayConnected ? "Ativo" : "Prévia"}</span></div><Button type="button" onClick={() => copyAndRegister("copied")} className="h-10 rounded-md bg-[#5947e5] px-4 text-sm shadow-none hover:bg-[#4b39d3]"><Copy className="size-3.5" /> Copiar link</Button></div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-white/45">Compartilhar:</span><ShareButton icon={MessageCircle} label="WhatsApp" onClick={() => copyAndRegister("whatsapp")} /><ShareButton icon={Mail} label="E-mail" onClick={() => copyAndRegister("email")} /><ShareButton icon={QrCode} label="Exibir QR Code" onClick={() => toast.info("O QR Code estará disponível quando o checkout estiver conectado.")} /></div>
      </section>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Fatura de serviços</p><h2 className="mt-2 max-w-xl text-base font-semibold leading-6 text-slate-900">{charge.description}</h2><p className="mt-1 text-xs text-slate-400">Identificador {charge.code}</p></div><div className="shrink-0 sm:text-right"><p className="text-xs uppercase text-slate-400">Valor total</p><p className="mt-1 text-2xl font-bold tracking-[-0.045em] text-slate-900">{currency.format(charge.amount)}</p></div></div>
            {charge.discountEnabled && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f2f1ff] px-3.5 py-3 text-xs"><span className="flex items-center gap-2 text-slate-600"><span className="grid size-7 place-items-center rounded-md bg-white text-[#5a45dc]"><Zap className="size-3.5" /></span>{BILLING_METHOD_LABELS[charge.discountMethod]} com {charge.discountPercent}% de desconto</span><strong className="text-xs font-semibold text-[#5843d9]">{currency.format(discountedAmount)}</strong></div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><InfoTile icon={CalendarDays} label="Data de vencimento" value={format(parseISO(charge.dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} detail={`Horário limite: ${charge.dueTime}`} /><InfoTile icon={Send} label="Régua de notificações" value={charge.remindersEnabled ? "Automação ativa" : "Envio manual"} detail={charge.remindersEnabled ? "Lembretes programados" : "Sem lembretes automáticos"} /></div>
            <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Tomador dos serviços</p><div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-50 p-3.5"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-semibold text-white">{client?.initials ?? "CL"}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900">{client?.name ?? "Cliente não encontrado"}</p><p className="mt-0.5 truncate text-xs text-slate-400">{client?.contactName || client?.segment || "Cadastro de cliente"}</p></div></div></div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Rastreabilidade e auditoria</h2><p className="mt-1 text-xs text-slate-400">Histórico de alterações e compartilhamentos.</p></div><span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5c46df]"><span className="size-1.5 rounded-full bg-[#654ff0]" /> Sincronizado</span></div><div className="mt-5 space-y-0">{charge.events.map((event, index) => <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0"><span className={cn("relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-4 border-white", index === charge.events.length - 1 ? "bg-[#5f4aeb]" : "bg-slate-800")}><span className="size-1.5 rounded-full bg-white" /></span>{index < charge.events.length - 1 && <span className="absolute left-[9px] top-4 h-full w-px bg-slate-200" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1"><p className="text-xs font-medium text-slate-800">{event.title}</p><time className="text-xs tabular-nums text-slate-400">{format(parseISO(event.createdAt), "dd MMM, HH:mm", { locale: ptBR })}</time></div><p className="mt-0.5 text-xs leading-4 text-slate-500">{event.description}</p></div></div>)}</div></section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Métodos de pagamento</h2><span className="text-xs text-slate-400">{charge.methods.length} habilitados</span></div><div className="mt-4 space-y-2">{(["pix", "credit_card", "bank_slip"] as BillingMethod[]).map((method) => <PaymentMethodRow key={method} method={method} active={charge.methods.includes(method)} installments={charge.cardMaxInstallments} />)}</div></section>

          <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-900">Ações rápidas</h2><div className="mt-3 divide-y divide-slate-100">{charge.status !== "paid" && charge.status !== "cancelled" && <ActionRow icon={CheckCircle2} title="Marcar como pago" detail="Registra também uma receita no Financeiro" onClick={() => { onStatusChange("paid"); toast.success("Pagamento confirmado e enviado ao Financeiro."); }} />}<ActionRow icon={Mail} title="Reenviar lembrete" detail="Copia o link com uma mensagem amigável" onClick={() => copyAndRegister("email")} /><ActionRow icon={CalendarDays} title="Estender vencimento" detail="Altera a data sem recriar a cobrança" onClick={() => setExtendOpen(true)} /></div></section>

          <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Histórico do cliente</h2><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{clientCharges.length ? `${paidCharges.length}/${clientCharges.length} pagas` : "Primeira cobrança"}</span></div><div className="mt-4 space-y-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">Cobranças emitidas</span><span className="font-semibold text-slate-800">{clientCharges.length}</span></div><div className="flex justify-between"><span className="text-slate-500">Pagamentos confirmados</span><span className="font-semibold text-slate-800">{paidCharges.length}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#5c48e2] to-[#23b4a4]" style={{ width: `${clientCharges.length ? (paidCharges.length / clientCharges.length) * 100 : 0}%` }} /></div></div></section>
        </aside>
      </div>

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}><DialogContent className="max-w-sm gap-0 rounded-xl p-0"><DialogHeader className="border-b border-slate-100 px-5 py-4 text-left"><DialogTitle className="text-base">Estender vencimento</DialogTitle><DialogDescription className="mt-1 text-sm">Defina uma nova data para esta cobrança.</DialogDescription></DialogHeader><div className="px-5 py-5"><label htmlFor="billing-new-due-date" className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-500">Nova data</label><Input id="billing-new-due-date" type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} className="mt-1.5 h-9" /></div><DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/70 px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => setExtendOpen(false)}>Cancelar</Button><Button type="button" size="sm" onClick={saveDueDate}>Salvar data</Button></DialogFooter></DialogContent></Dialog>
      <ConfirmActionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar cobrança?"
        description="O link deixa de ser válido. O registro permanece no histórico com status cancelado."
        confirmLabel="Cancelar cobrança"
        destructive
        onConfirm={() => {
          onStatusChange("cancelled");
          toast.success("Cobrança cancelada.");
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: BillingStatus }) { const styles: Record<BillingStatus, string> = { draft: "bg-slate-100 text-slate-600", pending: "bg-[#efedff] text-[#5a44dd]", paid: "bg-emerald-50 text-emerald-700", overdue: "bg-rose-50 text-rose-700", cancelled: "bg-slate-100 text-slate-400" }; return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", styles[status])}><span className="size-1.5 rounded-full bg-current" />{BILLING_STATUS_LABELS[status]}</span>; }
function ShareButton({ icon: Icon, label, onClick }: { icon: typeof Mail; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex h-8 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-medium text-white/80 transition hover:bg-white/15"><Icon className="size-3.5" />{label}</button>; }
function InfoTile({ icon: Icon, label, value, detail }: { icon: typeof CalendarDays; label: string; value: string; detail: string }) { return <div className="rounded-lg bg-[#f1f3ff] p-3"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-slate-500"><Icon className="size-3 text-[#604ae3]" />{label}</p><p className="mt-2 text-xs font-semibold text-slate-900">{value}</p><p className="mt-1 text-xs text-[#5d47df]">{detail}</p></div>; }
function PaymentMethodRow({ method, active, installments }: { method: BillingMethod; active: boolean; installments: number }) { const Icon = method === "pix" ? Zap : method === "credit_card" ? CreditCard : Barcode; return <div className={cn("flex items-center gap-3 rounded-lg p-3", active ? "bg-[#f0f1ff]" : "bg-slate-50 opacity-55")}><span className={cn("grid size-8 place-items-center rounded-md", active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-400")}><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-800">{BILLING_METHOD_LABELS[method]}</p><p className="mt-0.5 text-xs text-slate-400">{method === "credit_card" ? `Até ${installments}x` : method === "pix" ? "Confirmação rápida" : "Compensação bancária"}</p></div><span className={cn("text-xs font-medium", active ? "text-[#5943dc]" : "text-slate-400")}>{active ? "Ativo" : "Inativo"}</span></div>; }
function ActionRow({ icon: Icon, title, detail, onClick }: { icon: typeof Mail; title: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#f0efff] text-[#5b45dc]"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-slate-800">{title}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{detail}</span></span><span className="text-slate-300">›</span></button>; }
