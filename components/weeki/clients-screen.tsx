"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfWeek, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import {
  Building2,
  Check,
  ChevronRight,
  Filter,
  Grid2X2,
  List,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientDetail } from "@/components/weeki/client-detail";
import { ClientForm, emptyClientDraft } from "@/components/weeki/client-form";
import type { Client, ClientDraft, ClientStatus } from "@/features/clients/types";
import { CLIENT_STATUS_LABELS } from "@/features/clients/types";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

type ClientScreenView = "list" | "new" | "detail" | "edit";
type LayoutMode = "list" | "grid";
type DemandFilter = "all" | "with_tasks" | "without_tasks";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusStyles: Record<ClientStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  negotiating: "bg-amber-50 text-amber-700 ring-amber-200",
  inactive: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function ClientsScreen({
  clients,
  tasks,
  onAddClient,
  onUpdateClient,
  onNewTask,
  onOpenTask,
  onToggleTask,
}: {
  clients: Client[];
  tasks: Task[];
  onAddClient: (draft: ClientDraft) => Client;
  onUpdateClient: (id: string, draft: ClientDraft) => Client | null;
  onNewTask: (clientId: string) => void;
  onOpenTask: (task: Task) => void;
  onToggleTask: (taskId: string) => void;
}) {
  const [view, setView] = useState<ClientScreenView>("list");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [layout, setLayout] = useState<LayoutMode>("list");
  const [demandFilter, setDemandFilter] = useState<DemandFilter>("all");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDraft, setQuickDraft] = useState({ name: "", contactName: "", email: "", phone: "" });
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const weekInterval = useMemo(() => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }), []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      setSelectedClientId(null);
      setView("new");
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const taskSummary = (clientId: string) => {
    const all = tasks.filter((task) => task.clientId === clientId);
    const week = all.filter((task) => task.scheduledDate && isWithinInterval(parseISO(task.scheduledDate), weekInterval));
    const completed = week.filter((task) => task.status === "completed").length;
    return { all, week, completed };
  };

  const counts = useMemo(() => ({
    all: clients.length,
    active: clients.filter((client) => client.status === "active").length,
    negotiating: clients.filter((client) => client.status === "negotiating").length,
    inactive: clients.filter((client) => client.status === "inactive").length,
  }), [clients]);

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return clients.filter((client) => {
      const summary = taskSummary(client.id);
      const matchesSearch = !normalizedQuery || `${client.name} ${client.contactName} ${client.email} ${client.website} ${client.segment}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      const matchesStatus = status === "all" || client.status === status;
      const matchesDemands = demandFilter === "all" || (demandFilter === "with_tasks" ? summary.all.length > 0 : summary.all.length === 0);
      return matchesSearch && matchesStatus && matchesDemands;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, demandFilter, query, status, tasks, weekInterval]);

  const openClient = (client: Client) => {
    setSelectedClientId(client.id);
    setView("detail");
  };

  const saveClient = (draft: ClientDraft) => {
    if (view === "edit" && selectedClient) {
      onUpdateClient(selectedClient.id, draft);
      toast.success("Cliente atualizado.");
      setView("detail");
      return;
    }
    const client = onAddClient(draft);
    toast.success("Cliente cadastrado.");
    setSelectedClientId(client.id);
    setView("detail");
  };

  const saveQuickClient = (event: React.FormEvent) => {
    event.preventDefault();
    if (!quickDraft.name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const client = onAddClient({
      ...emptyClientDraft(),
      name: quickDraft.name.trim(),
      contactName: quickDraft.contactName.trim(),
      email: quickDraft.email.trim(),
      phone: quickDraft.phone.trim(),
    });
    setQuickDraft({ name: "", contactName: "", email: "", phone: "" });
    setQuickOpen(false);
    setSelectedClientId(client.id);
    setView("detail");
    toast.success("Cliente cadastrado.");
  };

  if (view === "new") return <ClientForm onCancel={() => setView("list")} onSave={saveClient} />;
  if (view === "edit" && selectedClient) return <ClientForm key={selectedClient.updatedAt} client={selectedClient} onCancel={() => setView("detail")} onSave={saveClient} />;
  if (view === "detail" && selectedClient) return <ClientDetail client={selectedClient} tasks={tasks} onBack={() => setView("list")} onEdit={() => setView("edit")} onNewTask={() => onNewTask(selectedClient.id)} onOpenTask={onOpenTask} onToggleTask={onToggleTask} />;

  const statuses: Array<{ value: ClientStatus | "all"; label: string; count: number }> = [
    { value: "all", label: "Todos", count: counts.all },
    { value: "active", label: "Ativos", count: counts.active },
    { value: "negotiating", label: "Em negociação", count: counts.negotiating },
    { value: "inactive", label: "Inativos", count: counts.inactive },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col px-4 py-5 sm:px-6 lg:px-8" style={{ minHeight: "calc(100vh - 68px)" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-[25px] font-bold tracking-[-0.04em] text-slate-900 sm:text-[27px]">Clientes</h1><p className="mt-1 text-xs text-slate-500">Centralize contatos, demandas, arquivos e contratos.</p></div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
          <div className="relative min-w-[210px] flex-1 sm:w-[280px] sm:flex-none"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar cliente..." className="h-8 rounded-md bg-white pl-8 pr-9 text-xs shadow-none" /><kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[9px] font-semibold text-slate-400">⌘K</kbd></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setQuickOpen(true)} className="h-8 rounded-md bg-white px-3 text-xs shadow-none"><UserRoundPlus className="size-3.5" /> <span className="hidden sm:inline">Cadastro rápido</span><span className="sm:hidden">Rápido</span></Button>
          <Button type="button" size="sm" onClick={() => { setSelectedClientId(null); setView("new"); }} className="h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none hover:bg-[#4432cf]"><Plus className="size-3.5" /> Novo cliente</Button>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="week-board-scroll flex max-w-full overflow-x-auto rounded-lg bg-slate-200/65 p-1">
          {statuses.map((item) => <button key={item.value} type="button" onClick={() => setStatus(item.value)} className={cn("focus-ring flex h-7 shrink-0 items-center gap-2 rounded-md px-3 text-[11px] font-medium text-slate-500 transition hover:text-slate-800", status === item.value && "bg-white font-semibold text-slate-800")}>{item.label}<span className={cn("rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500", item.value === "active" && "bg-emerald-50 text-emerald-700", item.value === "negotiating" && "bg-amber-50 text-amber-700")}>{item.count}</span></button>)}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <button type="button" onClick={() => setLayout("list")} className={cn("focus-ring grid size-7 place-items-center rounded-md text-slate-400 transition", layout === "list" && "bg-slate-100 text-slate-800")} aria-label="Visualização em lista"><List className="size-4" /></button>
            <button type="button" onClick={() => setLayout("grid")} className={cn("focus-ring grid size-7 place-items-center rounded-md text-slate-400 transition", layout === "grid" && "bg-slate-100 text-slate-800")} aria-label="Visualização em grade"><Grid2X2 className="size-3.5" /></button>
          </div>
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" className={cn("h-8 rounded-md bg-white px-2.5 text-[11px] shadow-none", demandFilter !== "all" && "border-[#afa1ed] bg-[#f5f3ff] text-[#6246db]")}><Filter className="size-3.5" /> Filtros</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuCheckboxItem checked={demandFilter === "all"} onCheckedChange={() => setDemandFilter("all")}>Todos os clientes</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={demandFilter === "with_tasks"} onCheckedChange={() => setDemandFilter("with_tasks")}>Com demandas</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={demandFilter === "without_tasks"} onCheckedChange={() => setDemandFilter("without_tasks")}>Sem demandas</DropdownMenuCheckboxItem></DropdownMenuContent></DropdownMenu>
        </div>
      </div>

      {filteredClients.length ? layout === "list" ? (
        <div className="week-board-scroll mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400"><tr><th className="px-5 py-3">Cliente</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Demandas da semana</th><th className="px-4 py-3 text-right">Contrato</th><th className="w-12 px-3 py-3"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody className="divide-y divide-slate-100">{filteredClients.map((client) => <ClientTableRow key={client.id} client={client} summary={taskSummary(client.id)} onOpen={() => openClient(client)} />)}</tbody>
          </table>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[10px] text-slate-400"><span>Mostrando {filteredClients.length} de {clients.length} clientes</span><span>Dados salvos neste navegador</span></footer>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredClients.map((client) => <ClientGridCard key={client.id} client={client} summary={taskSummary(client.id)} onOpen={() => openClient(client)} />)}</div>
      ) : (
        <div className="mt-4 grid min-h-[320px] place-items-center rounded-xl border border-dashed border-slate-200 bg-white text-center"><div><Building2 className="mx-auto size-7 text-slate-300" /><h2 className="mt-3 text-sm font-semibold text-slate-700">Nenhum cliente encontrado</h2><p className="mt-1 text-xs text-slate-400">Ajuste os filtros ou cadastre um novo cliente.</p><Button type="button" size="sm" onClick={() => setView("new")} className="mt-4 h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none"><Plus className="size-3.5" /> Novo cliente</Button></div></div>
      )}

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="max-w-md gap-0 rounded-xl border-slate-200 p-0">
          <form onSubmit={saveQuickClient}>
            <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left"><DialogTitle className="text-base">Cadastro rápido</DialogTitle><DialogDescription className="text-xs">Adicione o essencial agora e complete o perfil depois.</DialogDescription></DialogHeader>
            <div className="space-y-4 px-5 py-5"><div><Label className="mb-1.5 block text-[11px] font-semibold text-slate-700">Nome ou razão social <span className="text-[#6548df]">*</span></Label><Input autoFocus value={quickDraft.name} onChange={(event) => setQuickDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Clínica Lumi" className="h-9 rounded-md text-xs shadow-none" /></div><div><Label className="mb-1.5 block text-[11px] font-semibold text-slate-700">Responsável</Label><Input value={quickDraft.contactName} onChange={(event) => setQuickDraft((current) => ({ ...current, contactName: event.target.value }))} placeholder="Nome do contato" className="h-9 rounded-md text-xs shadow-none" /></div><div className="grid grid-cols-2 gap-3"><div><Label className="mb-1.5 block text-[11px] font-semibold text-slate-700">E-mail</Label><Input type="email" value={quickDraft.email} onChange={(event) => setQuickDraft((current) => ({ ...current, email: event.target.value }))} placeholder="contato@..." className="h-9 rounded-md text-xs shadow-none" /></div><div><Label className="mb-1.5 block text-[11px] font-semibold text-slate-700">Telefone</Label><Input value={quickDraft.phone} onChange={(event) => setQuickDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="(00) 00000-0000" className="h-9 rounded-md text-xs shadow-none" /></div></div></div>
            <DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/60 px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => setQuickOpen(false)} className="h-8 rounded-md text-xs">Cancelar</Button><Button type="submit" size="sm" className="h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none"><Check className="size-3.5" /> Salvar cliente</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientIdentity({ client }: { client: Client }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-semibold" style={{ color: client.color, backgroundColor: `${client.color}10`, border: `1px solid ${client.color}24` }}>
        {client.logoUrl ? (
          // A origem pode ser um data URL ou endereço fornecido pelo usuário.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client.logoUrl} alt="" className="size-full object-cover" />
        ) : client.initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-800">{client.name}</p>
        <p className="mt-1 truncate text-[10px] text-slate-400">{client.website || client.email || "Sem site informado"}</p>
      </div>
    </div>
  );
}

function ClientTableRow({ client, summary, onOpen }: { client: Client; summary: { all: Task[]; week: Task[]; completed: number }; onOpen: () => void }) {
  const progress = summary.week.length ? Math.round((summary.completed / summary.week.length) * 100) : 0;
  return <tr onClick={onOpen} className="group cursor-pointer transition hover:bg-slate-50/70"><td className="px-5 py-3"><ClientIdentity client={client} /></td><td className="px-4 py-3"><p className="flex items-center gap-1.5 text-xs text-slate-600"><span className="size-1.5 rounded-full bg-slate-300" />{client.contactName || "Sem responsável"}</p></td><td className="px-4 py-3"><span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold ring-1 ring-inset", statusStyles[client.status])}><span className="size-1.5 rounded-full bg-current" />{CLIENT_STATUS_LABELS[client.status]}</span></td><td className="px-4 py-3">{summary.week.length ? <div className="flex items-center gap-2.5"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6454e8]" style={{ width: `${progress}%` }} /></div><span className="text-[10px] tabular-nums text-slate-500">{summary.completed} de {summary.week.length} prontas</span></div> : <span className="text-[10px] italic text-slate-400">Nenhuma demanda na semana</span>}</td><td className="px-4 py-3 text-right"><span className="text-xs font-semibold tabular-nums text-slate-800">{client.contractValue ? currency.format(client.contractValue) : "R$ 0,00"}</span><span className="ml-2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[9px] font-semibold uppercase text-slate-400">{client.contractKind === "fixed" ? "Fixo" : client.contractKind === "one_time" ? "Único" : "—"}</span></td><td className="px-3 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="grid size-7 place-items-center rounded-md text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100" aria-label={`Abrir ${client.name}`}><MoreHorizontal className="size-4" /></button></td></tr>;
}

function ClientGridCard({ client, summary, onOpen }: { client: Client; summary: { all: Task[]; week: Task[]; completed: number }; onOpen: () => void }) {
  const progress = summary.week.length ? Math.round((summary.completed / summary.week.length) * 100) : 0;
  return <button type="button" onClick={onOpen} className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#c4b9f4] hover:bg-[#fdfcff]"><div className="flex items-start justify-between gap-3"><ClientIdentity client={client} /><ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#6548df]" /></div><div className="mt-4 flex items-center justify-between"><span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold ring-1 ring-inset", statusStyles[client.status])}><span className="size-1.5 rounded-full bg-current" />{CLIENT_STATUS_LABELS[client.status]}</span><span className="text-xs font-semibold text-slate-800">{client.contractValue ? currency.format(client.contractValue) : "Sem contrato"}</span></div><div className="mt-4 border-t border-slate-100 pt-3"><div className="flex items-center justify-between text-[10px] text-slate-400"><span>{summary.week.length} {summary.week.length === 1 ? "demanda" : "demandas"} na semana</span><span>{progress}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6454e8]" style={{ width: `${progress}%` }} /></div>{client.email && <p className="mt-3 flex items-center gap-1.5 truncate text-[10px] text-slate-400"><Mail className="size-3" />{client.email}</p>}</div></button>;
}
