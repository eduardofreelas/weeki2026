"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe2,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Client } from "@/features/clients/types";
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/features/clients/types";
import type { Task } from "@/features/tasks/types";
import { STATUS_LABELS } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

type DetailTab = "overview" | "files" | "finance";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const formatFileSize = (size: number) => {
  if (!size) return "Arquivo";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  negotiating: "bg-amber-50 text-amber-700 ring-amber-200",
  inactive: "bg-slate-100 text-slate-500 ring-slate-200",
};

const paymentStyles = {
  paid: "text-emerald-700",
  pending: "text-amber-700",
  overdue: "text-rose-700",
  none: "text-slate-500",
};

export function ClientDetail({
  client,
  tasks,
  onBack,
  onEdit,
  onNewTask,
  onOpenTask,
  onToggleTask,
}: {
  client: Client;
  tasks: Task[];
  onBack: () => void;
  onEdit: () => void;
  onNewTask: () => void;
  onOpenTask: (task: Task) => void;
  onToggleTask: (taskId: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const clientTasks = useMemo(() => tasks
    .filter((task) => task.clientId === client.id)
    .sort((a, b) => `${a.scheduledDate ?? "9999"}${a.scheduledTime}`.localeCompare(`${b.scheduledDate ?? "9999"}${b.scheduledTime}`)), [client.id, tasks]);
  const completedTasks = clientTasks.filter((task) => task.status === "completed").length;
  const progress = clientTasks.length ? Math.round((completedTasks / clientTasks.length) * 100) : 0;

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar agora.");
    }
  };

  const tabs = [
    { value: "overview" as const, label: "Visão geral & demandas", count: clientTasks.length, icon: BriefcaseBusiness },
    { value: "files" as const, label: "Arquivos & links", count: client.files.length + client.links.length, icon: FolderOpen },
    { value: "finance" as const, label: "Financeiro & contrato", icon: WalletCards },
  ];

  return (
    <div className="mx-auto w-full max-w-[1220px] pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="h-8 rounded-md bg-white px-2.5 text-xs shadow-none"><ArrowLeft className="size-3.5" /> Voltar</Button>
          <span>/</span><button type="button" onClick={onBack} className="hover:text-slate-700">Clientes</button><span>/</span><span className="font-medium text-slate-700">{client.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit} className="h-8 rounded-md bg-white px-3 text-xs shadow-none"><Pencil className="size-3.5" /> Editar cliente</Button>
          <Button type="button" size="sm" onClick={onNewTask} className="h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none hover:bg-[#4432cf]"><Plus className="size-3.5" /> Nova demanda</Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid gap-5 bg-gradient-to-r from-white via-white to-[#f2fffd] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl text-2xl font-semibold" style={{ backgroundColor: `${client.color}18`, color: client.color }}>
              {/* A origem pode ser um data URL ou endereço fornecido pelo usuário. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {client.logoUrl ? <img src={client.logoUrl} alt="" className="size-full object-cover" /> : client.initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[26px] font-bold tracking-[-0.04em] text-slate-900">{client.name}</h1>
                <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold ring-1 ring-inset", statusStyles[client.status])}><span className="size-1.5 rounded-full bg-current" />{CLIENT_STATUS_LABELS[client.status]}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{CLIENT_KIND_LABELS[client.kind]}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {client.document && <span>{client.kind === "company" ? "CNPJ" : "CPF"}: {client.document}</span>}
                <span className="hidden size-1 rounded-full bg-slate-300 sm:inline" />
                <span>Cadastrado em {format(parseISO(client.createdAt), "MMM yyyy", { locale: ptBR })}</span>
                {client.website && <><span className="hidden size-1 rounded-full bg-slate-300 sm:inline" /><a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="font-medium text-[#6548df] hover:underline">Abrir site</a></>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#f2f3ff]/80 p-2">
            <div className="min-w-[112px] rounded-lg border border-slate-100 bg-white px-3 py-2.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Contrato</span><p className="mt-1 text-sm font-semibold text-slate-900">{client.contractValue ? currency.format(client.contractValue) : "—"}<span className="text-[10px] font-normal text-slate-400">{client.contractKind === "fixed" ? "/mês" : ""}</span></p></div>
            <div className="min-w-[112px] rounded-lg border border-slate-100 bg-white px-3 py-2.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Responsável</span><p className="mt-1 truncate text-sm font-semibold text-slate-900">{client.contactName || "—"}</p></div>
            <div className="min-w-[112px] rounded-lg border border-slate-100 bg-white px-3 py-2.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Segmento</span><p className="mt-1 truncate text-sm font-semibold text-slate-900">{client.segment || "—"}</p></div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="week-board-scroll flex overflow-x-auto rounded-lg bg-[#eef0ff] p-1">
            {tabs.map((item) => <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-slate-500 transition", tab === item.value && "bg-white font-semibold text-slate-800")}><item.icon className={cn("size-3.5", tab === item.value && "text-[#6650e4]")} />{item.label}{item.count !== undefined && <span className="rounded-full bg-[#eeeaff] px-1.5 py-0.5 text-[10px] font-semibold text-[#674bdd]">{item.count}</span>}</button>)}
          </div>

          {tab === "overview" && (
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-sm font-semibold text-slate-900">Demandas do cliente</h2><p className="mt-0.5 text-[11px] text-slate-400">Acompanhamento de entregas e pendências vinculadas.</p></div>
                <div className="flex items-center gap-3"><span className="text-xs font-semibold tabular-nums text-slate-600">{completedTasks} de {clientTasks.length} prontas</span><div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#5d4be5]" style={{ width: `${progress}%` }} /></div></div>
              </div>
              <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
                {clientTasks.length ? clientTasks.map((task) => (
                  <article key={task.id} onClick={() => onOpenTask(task)} className="group flex cursor-pointer items-center gap-3 bg-white px-3 py-2.5 transition hover:bg-slate-50" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpenTask(task); }}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onToggleTask(task.id); }} className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition", task.status === "completed" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-transparent hover:border-[#6b56e5]")} aria-label={task.status === "completed" ? "Reabrir demanda" : "Concluir demanda"}><CheckCircle2 className="size-3" /></button>
                    <div className="min-w-0 flex-1"><h3 className={cn("truncate text-xs font-medium text-slate-800", task.status === "completed" && "text-slate-400 line-through")}>{task.title}</h3><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">{task.scheduledDate && <span className="flex items-center gap-1"><CalendarDays className="size-3" />{format(parseISO(task.scheduledDate), "EEE, dd/MM", { locale: ptBR })}{task.scheduledTime ? `, ${task.scheduledTime}` : ""}</span>}{task.estimateMinutes && <span>{task.estimateMinutes >= 60 ? `${Math.floor(task.estimateMinutes / 60)}h${task.estimateMinutes % 60 ? ` ${task.estimateMinutes % 60}min` : ""}` : `${task.estimateMinutes}min`}</span>}</div></div>
                    <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold", task.status === "completed" ? "bg-emerald-50 text-emerald-700" : task.status === "in_progress" ? "bg-[#eeeaff] text-[#6449d9]" : task.status === "waiting" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500")}>{STATUS_LABELS[task.status]}</span>
                  </article>
                )) : <div className="grid min-h-28 place-items-center px-4 text-center"><div><Clipboard className="mx-auto size-5 text-slate-300" /><p className="mt-2 text-xs font-medium text-slate-500">Nenhuma demanda vinculada</p><p className="mt-1 text-[11px] text-slate-400">Crie a primeira demanda para este cliente.</p></div></div>}
              </div>
              <button type="button" onClick={onNewTask} className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#f1f2ff] text-xs font-medium text-slate-600 transition hover:bg-[#e9eaff] hover:text-[#5742db]"><Plus className="size-3.5" /> Adicionar demanda para {client.name}</button>
            </section>
          )}

          {(tab === "overview" || tab === "files") && (
            <>
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><PaperclipIcon /> Arquivos e documentos</h2><Button type="button" variant="outline" size="sm" onClick={onEdit} className="h-8 rounded-md bg-slate-50 px-2.5 text-[11px] shadow-none"><Upload className="size-3.5" /> Enviar arquivo</Button></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {client.files.length ? client.files.map((file) => <div key={file.id} className="flex min-h-24 flex-col rounded-lg bg-slate-50 p-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-md bg-white text-[#6548df]"><FileText className="size-4" /></span><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-slate-700">{file.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{formatFileSize(file.size)}</p></div></div><div className="mt-auto flex items-center justify-between pt-3"><span className="text-[10px] text-slate-400">{format(parseISO(file.createdAt), "dd/MM/yyyy")}</span><button type="button" onClick={() => toast.info("O arquivo está registrado no protótipo local.")} className="grid size-6 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-[#6548df]" aria-label={`Baixar ${file.name}`}><Download className="size-3.5" /></button></div></div>) : <div className="col-span-full rounded-lg border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-400">Nenhum arquivo anexado.</div>}
                </div>
              </section>

              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Link2 className="size-4 text-[#6550e1]" /> Links rápidos</h2><button type="button" onClick={onEdit} className="text-[11px] font-semibold text-[#6548df] hover:underline">+ Adicionar link</button></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {client.links.length ? client.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 transition hover:bg-[#f0efff]"><span className="grid size-7 place-items-center rounded-md bg-white text-[#6548df]"><Globe2 className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-slate-700">{link.label}</span><span className="block truncate text-[10px] text-slate-400">{link.url}</span></span><ExternalLink className="size-3.5 text-slate-400" /></a>) : <div className="col-span-full rounded-lg border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-400">Nenhum link salvo.</div>}
                </div>
              </section>
            </>
          )}

          {tab === "finance" && <FinancePanel client={client} />}
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Contato principal</h2><span className="rounded-full bg-[#f1efff] px-2 py-1 text-[10px] font-semibold text-[#6548df]">Principal</span></div>
            <div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#e8ecff] text-sm font-semibold text-slate-800">{client.contactName ? client.contactName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") : <UserRound className="size-4" />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{client.contactName || "Sem responsável"}</p><p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{client.contactRole || "Contato principal"}</p></div></div>
            <div className="mt-5 space-y-4">
              <ContactRow icon={Mail} label="E-mail" value={client.email} action={client.email ? <button type="button" onClick={() => copy(client.email, "E-mail")} className="text-[#6548df]" aria-label="Copiar e-mail"><Copy className="size-3.5" /></button> : undefined} />
              <ContactRow icon={Phone} label="Telefone / WhatsApp" value={client.phone} action={client.phone ? <a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600" aria-label="Abrir WhatsApp"><MessageCircle className="size-3.5" /></a> : undefined} />
              <ContactRow icon={MapPin} label="Endereço" value={client.address} />
            </div>
          </section>

          <FinancePanel client={client} compact />

          {client.notes && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">Observações</h2><p className="mt-3 whitespace-pre-wrap text-[11px] leading-5 text-slate-500">{client.notes}</p></section>}
        </aside>
      </div>
    </div>
  );
}

function PaperclipIcon() {
  return <FileSpreadsheet className="size-4 text-[#6550e1]" />;
}

function ContactRow({ icon: Icon, label, value, action }: { icon: typeof Mail; label: string; value: string; action?: React.ReactNode }) {
  return <div className="flex items-start gap-2.5"><Icon className="mt-0.5 size-3.5 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-[11px] leading-4 text-slate-600">{value || "Não informado"}</p></div>{action}</div>;
}

function FinancePanel({ client, compact = false }: { client: Client; compact?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white p-5", !compact && "mt-4")}>
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Resumo financeiro</h2><ReceiptText className="size-4 text-[#6548df]" /></div>
      <div className="mt-4 rounded-lg bg-[#f4f5ff] p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Valor contratual ativo</p><p className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-slate-900">{currency.format(client.contractValue)} <span className="text-[11px] font-normal tracking-normal text-slate-400">{client.contractKind === "fixed" ? "/ mês fixo" : client.contractKind === "one_time" ? "/ projeto" : ""}</span></p></div>
      <div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[10px] font-medium text-slate-400">Próximo vencimento</p><p className="mt-1 text-[11px] font-semibold text-slate-700">{client.nextDueDate ? format(parseISO(client.nextDueDate), "dd 'de' MMM", { locale: ptBR }) : "Não informado"}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[10px] font-medium text-slate-400">Pagamento</p><p className={cn("mt-1 text-[11px] font-semibold", paymentStyles[client.paymentStatus])}>{PAYMENT_STATUS_LABELS[client.paymentStatus]}</p></div></div>
      <button type="button" onClick={() => toast.info("O histórico financeiro será conectado em uma próxima etapa.")} className="mt-3 h-8 w-full rounded-md bg-[#eff0ff] text-[11px] font-medium text-slate-600 transition hover:bg-[#e7e8ff]">Ver histórico de faturas</button>
    </section>
  );
}
