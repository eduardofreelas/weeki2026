"use client";

import { useMemo, useState } from "react";
import { format, isAfter, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileSearch, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Client } from "@/features/clients/types";
import type { FiscalServiceConfig, NfseOrigin, NfseRecord, NfseStatus } from "@/shared/fiscal";
import { NFSE_ORIGIN_LABELS, NFSE_STATUS_LABELS } from "@/shared/fiscal";
import { NfseStatusBadge, formatFiscalCurrency } from "./common";

type PeriodFilter = "month" | "three_months" | "all";

const formatDate = (value: string | null) => {
  if (!value) return "—";
  try { return format(parseISO(value), "dd MMM yyyy", { locale: ptBR }); } catch { return "—"; }
};

export function FiscalNotes({ notes, clients, services, onOpenNote, onIssue }: { notes: NfseRecord[]; clients: Client[]; services: FiscalServiceConfig[]; onOpenNote: (id: string) => void; onIssue: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<NfseStatus | "all">("all");
  const [client, setClient] = useState("all");
  const [service, setService] = useState("all");
  const [origin, setOrigin] = useState<NfseOrigin | "all">("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const threshold = period === "month" ? subMonths(new Date(), 1) : period === "three_months" ? subMonths(new Date(), 3) : null;
    return notes.filter((note) => {
      const haystack = `${note.customer.name} ${note.customer.document} ${note.service.name} ${note.description} ${note.number} ${note.accessKey}`.toLocaleLowerCase("pt-BR");
      const noteDate = parseISO(note.issuedAt || note.createdAt);
      return (!normalized || haystack.includes(normalized))
        && (status === "all" || note.status === status)
        && (client === "all" || note.clientId === client)
        && (service === "all" || note.serviceConfigId === service)
        && (origin === "all" || note.origin === origin)
        && (!threshold || isAfter(noteDate, threshold))
        && (!minimum || note.amount >= Number(minimum))
        && (!maximum || note.amount <= Number(maximum));
    });
  }, [notes, query, status, client, service, origin, period, minimum, maximum]);

  const hasFilters = query || status !== "all" || client !== "all" || service !== "all" || origin !== "all" || period !== "all" || minimum || maximum;
  const clear = () => { setQuery(""); setStatus("all"); setClient("all"); setService("all"); setOrigin("all"); setPeriod("all"); setMinimum(""); setMaximum(""); };

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[210px] flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, documento, serviço ou número" className="h-8 rounded-md bg-slate-50 pl-8 text-[10px] shadow-none dark:bg-white/[0.04]" /></div>
          <Select value={status} onValueChange={(value) => setStatus(value as NfseStatus | "all")}><SelectTrigger className="h-8 w-[150px] rounded-md px-2.5 text-[10px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(NFSE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}><SelectTrigger className="h-8 w-[132px] rounded-md px-2.5 text-[10px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todo o período</SelectItem><SelectItem value="month">Últimos 30 dias</SelectItem><SelectItem value="three_months">Últimos 3 meses</SelectItem></SelectContent></Select>
          <Button type="button" size="sm" variant="outline" onClick={() => setFiltersOpen((current) => !current)} className="h-8 rounded-md px-2.5 text-[10px] shadow-none"><SlidersHorizontal className="size-3.5" /> Mais filtros</Button>
          {hasFilters && <Button type="button" size="sm" variant="ghost" onClick={clear} className="h-8 rounded-md px-2 text-[10px] text-slate-400"><X className="size-3.5" /> Limpar</Button>}
        </div>
        {filtersOpen && <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 dark:border-white/8 sm:grid-cols-2 lg:grid-cols-5"><Select value={client} onValueChange={setClient}><SelectTrigger className="h-8 rounded-md text-[10px] shadow-none"><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={service} onValueChange={setService}><SelectTrigger className="h-8 rounded-md text-[10px] shadow-none"><SelectValue placeholder="Serviço" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os serviços</SelectItem>{services.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={origin} onValueChange={(value) => setOrigin(value as NfseOrigin | "all")}><SelectTrigger className="h-8 rounded-md text-[10px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as origens</SelectItem>{Object.entries(NFSE_ORIGIN_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Input type="number" min="0" step="0.01" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="Valor mínimo" className="h-8 rounded-md text-[10px] shadow-none" /><Input type="number" min="0" step="0.01" value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="Valor máximo" className="h-8 rounded-md text-[10px] shadow-none" /></div>}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/8"><div><h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">Notas fiscais</h2><p className="mt-0.5 text-[9px] text-slate-400">{filtered.length} de {notes.length} registro{notes.length === 1 ? "" : "s"}</p></div></div>
        {filtered.length ? <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[940px] table-fixed text-left"><thead className="bg-slate-50/80 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:bg-white/[0.025]"><tr><th className="w-[20%] px-4 py-2.5">Cliente</th><th className="w-[19%] px-3 py-2.5">Serviço</th><th className="w-[11%] px-3 py-2.5">Valor</th><th className="w-[12%] px-3 py-2.5">Competência</th><th className="w-[12%] px-3 py-2.5">Emissão</th><th className="w-[12%] px-3 py-2.5">NFS-e</th><th className="w-[14%] px-3 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/8">{filtered.map((note) => <tr key={note.id} onClick={() => onOpenNote(note.id)} className="cursor-pointer transition hover:bg-slate-50/70 dark:hover:bg-white/[0.025]"><td className="px-4 py-3"><p className="truncate text-[10px] font-bold text-slate-700 dark:text-slate-200">{note.customer.name}</p><p className="mt-0.5 truncate text-[8px] text-slate-400">{note.customer.document || "Documento pendente"}</p></td><td className="px-3 py-3"><p className="truncate text-[10px] font-semibold text-slate-600 dark:text-slate-300">{note.service.name}</p><p className="mt-0.5 truncate text-[8px] text-slate-400">{note.description}</p></td><td className="px-3 py-3 text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{formatFiscalCurrency(note.amount)}</td><td className="px-3 py-3 text-[9px] text-slate-500">{formatDate(`${note.competenceDate}T12:00:00`)}</td><td className="px-3 py-3 text-[9px] text-slate-500">{formatDate(note.issuedAt)}</td><td className="px-3 py-3"><p className="truncate text-[9px] font-semibold text-slate-600 dark:text-slate-300">{note.number || "—"}</p><p className="mt-0.5 truncate text-[8px] text-slate-400">{note.accessKey || "Sem chave"}</p></td><td className="px-3 py-3"><NfseStatusBadge status={note.status} compact /></td></tr>)}</tbody></table>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/8 lg:hidden">{filtered.map((note) => <button type="button" key={note.id} onClick={() => onOpenNote(note.id)} className="w-full p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.025]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">{note.customer.name}</p><p className="mt-1 truncate text-[9px] text-slate-400">{note.service.name} · {formatDate(`${note.competenceDate}T12:00:00`)}</p></div><NfseStatusBadge status={note.status} compact /></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-white/8"><span className="text-[9px] text-slate-400">{NFSE_ORIGIN_LABELS[note.origin]}</span><span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{formatFiscalCurrency(note.amount)}</span></div></button>)}</div>
        </> : <div className="grid min-h-64 place-items-center px-5 py-10 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400 dark:bg-white/5"><FileSearch className="size-5" /></span><p className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-100">{notes.length ? "Nenhum resultado encontrado" : "Nenhuma NFS-e registrada"}</p><p className="mx-auto mt-1 max-w-sm text-[10px] leading-4 text-slate-400">{notes.length ? "Ajuste os filtros ou limpe a busca." : "Prepare a primeira nota usando os dados de um cliente e serviço."}</p>{notes.length ? <Button size="sm" variant="outline" onClick={clear} className="mt-4 h-8 text-[10px] shadow-none">Limpar filtros</Button> : <Button size="sm" onClick={onIssue} className="mt-4 h-8 bg-[#5944df] text-[10px]">Preparar NFS-e</Button>}</div></div>}
      </section>
    </div>
  );
}
