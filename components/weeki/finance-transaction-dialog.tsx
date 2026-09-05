"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, ChevronDown, FileText, Paperclip, Repeat2, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/features/clients/types";
import {
  EXPENSE_CATEGORIES,
  FINANCE_STATUS_LABELS,
  INCOME_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  type FinancePaymentMethod,
  type FinanceRecurrence,
  type FinanceTransaction,
  type FinanceTransactionDraft,
  type FinanceTransactionStatus,
  type FinanceTransactionType,
} from "@/features/finance/types";
import { cn } from "@/lib/utils";

const today = () => format(new Date(), "yyyy-MM-dd");

function emptyDraft(type: FinanceTransactionType): FinanceTransactionDraft {
  return {
    type,
    description: "",
    clientId: null,
    partnerName: "",
    category: type === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    amount: 0,
    dueDate: today(),
    paidDate: "",
    status: "pending",
    paymentMethod: "pix",
    account: "Conta principal",
    recurring: false,
    recurrence: "monthly",
    recurrenceEndDate: "",
    notes: "",
    attachmentName: "",
  };
}

export function FinanceTransactionDialog({
  open,
  onOpenChange,
  initialType,
  transaction,
  clients,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType: FinanceTransactionType;
  transaction: FinanceTransaction | null;
  clients: Client[];
  onSave: (draft: FinanceTransactionDraft, id?: string) => void;
}) {
  const [draft, setDraft] = useState<FinanceTransactionDraft>(() => transaction ?? emptyDraft(initialType));
  const [detailsOpen, setDetailsOpen] = useState(Boolean(transaction?.notes || transaction?.attachmentName));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof FinanceTransactionDraft>(key: K, value: FinanceTransactionDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const categories = draft.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const changeType = (type: FinanceTransactionType) => {
    setDraft((current) => ({
      ...current,
      type,
      category: type === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
      clientId: type === "expense" ? null : current.clientId,
      partnerName: type === "income" ? "" : current.partnerName,
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.description.trim()) return toast.error("Informe a descrição da transação.");
    if (!draft.amount || draft.amount <= 0) return toast.error("Informe um valor maior que zero.");
    if (!draft.dueDate) return toast.error("Informe a data de vencimento.");
    if (draft.recurring && draft.recurrenceEndDate && draft.recurrenceEndDate < draft.dueDate) return toast.error("A repetição precisa terminar após o vencimento.");

    onSave({
      ...draft,
      description: draft.description.trim(),
      partnerName: draft.partnerName.trim(),
      paidDate: draft.status === "paid" ? (draft.paidDate || today()) : "",
      recurrenceEndDate: draft.recurring ? draft.recurrenceEndDate : "",
    }, transaction?.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl gap-0 overflow-y-auto rounded-xl border-slate-200 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-[#efedff] text-[#5a43dd]"><WalletCards className="size-[18px]" /></span>
              <div>
                <DialogTitle className="text-base">{transaction ? "Editar transação" : "Nova transação"}</DialogTitle>
                <DialogDescription className="mt-1 text-[11px]">Registre a movimentação e mantenha seu fluxo atualizado.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <button type="button" onClick={() => changeType("income")} className={cn("flex h-8 flex-1 items-center justify-center gap-1.5 rounded text-xs font-medium text-slate-500 transition", draft.type === "income" && "bg-white text-emerald-700 ring-1 ring-slate-200")}> <ArrowDownLeft className="size-3.5" /> Receita</button>
              <button type="button" onClick={() => changeType("expense")} className={cn("flex h-8 flex-1 items-center justify-center gap-1.5 rounded text-xs font-medium text-slate-500 transition", draft.type === "expense" && "bg-white text-rose-600 ring-1 ring-slate-200")}> <ArrowUpRight className="size-3.5" /> Despesa</button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
              <label htmlFor="finance-amount" className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">Valor</label>
              <div className="mt-1 flex items-center gap-2"><span className="text-base font-medium text-slate-400">R$</span><input id="finance-amount" type="number" min="0" step="0.01" value={draft.amount || ""} onChange={(event) => update("amount", Number(event.target.value))} placeholder="0,00" className="min-w-0 flex-1 bg-transparent text-[26px] font-semibold tracking-[-0.035em] text-slate-900 outline-none placeholder:text-slate-300" autoFocus /></div>
            </div>

            <Field label="Descrição">
              <Input value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder={draft.type === "income" ? "Ex.: Projeto de identidade visual" : "Ex.: Assinatura de software"} className="h-9 rounded-md text-xs shadow-none" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {draft.type === "income" ? (
                <Field label="Cliente associado">
                  <Select value={draft.clientId ?? "none"} onValueChange={(value) => update("clientId", value === "none" ? null : value)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem cliente</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select>
                </Field>
              ) : (
                <Field label="Fornecedor ou beneficiário">
                  <Input value={draft.partnerName} onChange={(event) => update("partnerName", event.target.value)} placeholder="Nome do fornecedor" className="h-9 rounded-md text-xs shadow-none" />
                </Field>
              )}
              <Field label="Categoria">
                <Select value={draft.category} onValueChange={(value) => update("category", value)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vencimento"><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input type="date" value={draft.dueDate} onChange={(event) => update("dueDate", event.target.value)} className="h-9 rounded-md pl-9 text-xs shadow-none" /></div></Field>
              <Field label="Data da baixa"><div className="relative"><Check className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input type="date" value={draft.paidDate} disabled={draft.status !== "paid"} onChange={(event) => update("paidDate", event.target.value)} className="h-9 rounded-md pl-9 text-xs shadow-none disabled:bg-slate-50" /></div></Field>
            </div>

            <Field label="Situação">
              <div className="grid grid-cols-3 gap-1.5">
                {(["paid", "pending", "overdue"] as FinanceTransactionStatus[]).map((status) => <button key={status} type="button" onClick={() => update("status", status)} className={cn("h-8 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-500 transition", draft.status === status && (status === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "overdue" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"))}>{FINANCE_STATUS_LABELS[status]}</button>)}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Forma de pagamento"><Select value={draft.paymentMethod} onValueChange={(value) => update("paymentMethod", value as FinancePaymentMethod)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Conta"><Input value={draft.account} onChange={(event) => update("account", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field>
            </div>

            <section className="rounded-lg border border-slate-200 p-3.5">
              <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md bg-[#f2efff] text-[#6048df]"><Repeat2 className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-800">Transação recorrente</p><p className="mt-0.5 text-[10px] text-slate-400">Use para mensalidades, assinaturas e custos fixos.</p></div><Switch size="sm" checked={draft.recurring} onCheckedChange={(checked) => update("recurring", checked)} /></div>
              {draft.recurring && <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2"><Field label="Frequência"><Select value={draft.recurrence} onValueChange={(value) => update("recurrence", value as FinanceRecurrence)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="yearly">Anual</SelectItem></SelectContent></Select></Field><Field label="Repetir até"><Input type="date" value={draft.recurrenceEndDate} onChange={(event) => update("recurrenceEndDate", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field></div>}
            </section>

            <section className="rounded-lg border border-slate-200">
              <button type="button" onClick={() => setDetailsOpen((current) => !current)} className="flex h-10 w-full items-center gap-2 px-3.5 text-left text-xs font-medium text-slate-700"><FileText className="size-3.5 text-slate-400" /><span className="flex-1">Comprovante e observações</span>{(draft.attachmentName || draft.notes) && <span className="rounded bg-[#f0edff] px-1.5 py-0.5 text-[9px] text-[#5c45d8]">Preenchido</span>}<ChevronDown className={cn("size-3.5 text-slate-400 transition", detailsOpen && "rotate-180")} /></button>
              {detailsOpen && <div className="space-y-3 border-t border-slate-100 p-3.5"><Field label="Observações"><Textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} rows={3} placeholder="Informações internas sobre esta movimentação" className="resize-none rounded-md text-xs shadow-none" /></Field><input ref={fileInputRef} type="file" className="hidden" onChange={(event) => update("attachmentName", event.target.files?.[0]?.name ?? "")} /><button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 text-[11px] font-medium text-slate-500 transition hover:border-[#9e8df0] hover:text-[#5c45d8]"><Paperclip className="size-3.5" />{draft.attachmentName || "Selecionar comprovante"}</button>{draft.attachmentName && <button type="button" onClick={() => update("attachmentName", "")} className="flex items-center gap-1 text-[10px] text-rose-500"><X className="size-3" /> Remover arquivo</button>}</div>}
            </section>
          </div>

          <DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 rounded-md text-xs">Cancelar</Button>
            <Button type="submit" size="sm" className={cn("h-8 rounded-md px-4 text-xs shadow-none", draft.type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#5140df] hover:bg-[#4432cf]")}><Check className="size-3.5" />{transaction ? "Salvar alterações" : draft.type === "income" ? "Salvar receita" : "Salvar despesa"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.055em] text-slate-500">{label}</span>{children}</label>;
}
