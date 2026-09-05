"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Gauge,
  Link2,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment, AppointmentDraft, AppointmentMode, AppointmentStatus, EventType, EventTypeDraft } from "@/features/appointments/types";
import { APPOINTMENT_MODE_LABELS, APPOINTMENT_STATUS_LABELS } from "@/features/appointments/types";
import { useWeekiAppointments } from "@/features/appointments/use-weeki-appointments";
import type { Client } from "@/features/clients/types";
import { cn } from "@/lib/utils";

type AgendaTab = "overview" | "types" | "requests" | "history";
type OverviewMode = "upcoming" | "day" | "week";
type RequestFilter = "pending" | "confirmed" | "cancelled" | "all";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const todayKey = () => format(new Date(), "yyyy-MM-dd");
const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const formatDuration = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;

function ModeIcon({ mode, className }: { mode: AppointmentMode; className?: string }) {
  if (mode === "in_person") return <MapPin className={className} />;
  if (mode === "phone") return <Phone className={className} />;
  return <Video className={className} />;
}

const statusStyles: Record<AppointmentStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

export function AppointmentsScreen({ clients }: { clients: Client[] }) {
  const {
    appointments,
    eventTypes,
    autoApproval,
    setAutoApproval,
    addAppointment,
    updateAppointment,
    setAppointmentStatus,
    addEventType,
    updateEventType,
    toggleEventType,
  } = useWeekiAppointments();
  const [tab, setTab] = useState<AgendaTab>("overview");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("upcoming");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("pending");
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const pendingCount = appointments.filter((item) => item.status === "pending").length;
  const typeById = (id: string) => eventTypes.find((type) => type.id === id);
  const chronological = useMemo(() => [...appointments].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)), [appointments]);
  const currentWeekAppointments = chronological.filter((item) => isWithinInterval(parseISO(item.date), { start: weekStart, end: weekEnd }));
  const confirmedThisWeek = currentWeekAppointments.filter((item) => item.status === "confirmed");
  const bookedMinutes = confirmedThisWeek.reduce((total, item) => total + (typeById(item.typeId)?.durationMinutes ?? 30), 0);
  const occupancy = Math.min(100, Math.round((bookedMinutes / (40 * 60)) * 100));
  const nextAppointment = chronological.find((item) => item.status === "confirmed" && `${item.date}T${item.time}` >= format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const publicUrl = typeof window === "undefined" ? "weeki.com.br/agendar" : `${window.location.origin}/agendar`;

  const openNewAppointment = () => {
    setSelectedAppointment(null);
    setAppointmentDialogOpen(true);
  };

  const editAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setAppointmentDialogOpen(true);
  };

  const openNewType = () => {
    setSelectedType(null);
    setTypeDialogOpen(true);
  };

  const editType = (eventType: EventType) => {
    setSelectedType(eventType);
    setTypeDialogOpen(true);
  };

  const copyLink = async (value = publicUrl) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const saveAppointment = (draft: AppointmentDraft) => {
    if (selectedAppointment) {
      updateAppointment(selectedAppointment.id, draft);
      toast.success("Agendamento atualizado.");
    } else {
      addAppointment(draft);
      toast.success(draft.status === "pending" ? "Solicitação adicionada." : "Agendamento confirmado.");
    }
    setAppointmentDialogOpen(false);
  };

  const saveEventType = (draft: EventTypeDraft) => {
    if (selectedType) {
      updateEventType(selectedType.id, draft);
      toast.success("Tipo de evento atualizado.");
    } else {
      addEventType(draft);
      toast.success("Tipo de evento criado.");
    }
    setTypeDialogOpen(false);
  };

  const titles: Record<AgendaTab, { title: string; description: string }> = {
    overview: { title: "Agenda & Atendimentos", description: "Acompanhe compromissos, sessões marcadas e disponibilidade em um só lugar." },
    types: { title: "Tipos de Eventos", description: "Configure formatos, durações, valores e links que seus clientes podem reservar." },
    requests: { title: "Reservas & Solicitações", description: "Confirme horários solicitados e acompanhe as reservas recebidas." },
    history: { title: "Histórico de Agendamentos", description: "Consulte atendimentos concluídos, recusados e cancelados." },
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-400"><span>Agenda</span><span>/</span><span className="text-[#5d48dd]">{tab === "overview" ? "Visão Geral" : tab === "types" ? "Tipos de Eventos" : tab === "requests" ? "Reservas & Solicitações" : "Histórico"}</span></div>
          <h1 className="text-[25px] font-bold tracking-[-0.04em] text-slate-900 sm:text-[28px]">{titles[tab].title}</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{titles[tab].description}</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {tab === "requests" ? (
            <>
              <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600">
                <span>Aprovação automática</span><Switch size="sm" checked={autoApproval} onCheckedChange={setAutoApproval} /><span className={cn("rounded px-1.5 py-0.5", autoApproval ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{autoApproval ? "Ativa" : "Manual"}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => toast.info("A conexão com o Google Calendar será configurada na área de integrações.")} className="h-8 rounded-md bg-white px-2.5 text-[11px] shadow-none"><RefreshCw className="size-3.5" /> Sincronizar</Button>
            </>
          ) : tab === "types" ? (
            <>
              <div className="relative hidden w-[250px] sm:block"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tipos de evento..." className="h-8 rounded-md bg-white pl-8 text-xs shadow-none" /></div>
              <Button type="button" size="sm" onClick={openNewType} className="h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none hover:bg-[#4432cf]"><Plus className="size-3.5" /> Novo tipo de evento</Button>
            </>
          ) : (
            <>
              <div className="flex h-8 max-w-[280px] items-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] text-slate-500"><Link2 className="mr-2 size-3.5 shrink-0" /><span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span><button type="button" onClick={() => copyLink()} className="ml-2 border-l border-slate-200 pl-2 font-semibold text-[#5d48dd]">Copiar</button></div>
              <Button type="button" variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")} className="hidden h-8 rounded-md bg-white px-2.5 text-xs shadow-none sm:flex"><ExternalLink className="size-3.5" /> Página pública</Button>
              <Button type="button" size="sm" onClick={openNewAppointment} className="h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none hover:bg-[#4432cf]"><Plus className="size-3.5" /> Novo agendamento</Button>
            </>
          )}
        </div>
      </div>

      <AgendaTabs tab={tab} onChange={setTab} eventTypeCount={eventTypes.length} pendingCount={pendingCount} />

      {tab === "overview" && (
        <Overview
          appointments={chronological}
          eventTypes={eventTypes}
          clients={clients}
          weekStart={weekStart}
          weekEnd={weekEnd}
          bookedMinutes={bookedMinutes}
          occupancy={occupancy}
          nextAppointment={nextAppointment}
          pendingCount={pendingCount}
          mode={overviewMode}
          query={query}
          typeFilter={typeFilter}
          onModeChange={setOverviewMode}
          onQueryChange={setQuery}
          onTypeFilterChange={setTypeFilter}
          onWeekChange={setWeekStart}
          onEdit={editAppointment}
          onOpenRequests={() => setTab("requests")}
        />
      )}

      {tab === "types" && (
        <EventTypesView
          eventTypes={eventTypes}
          query={query}
          publicUrl={publicUrl}
          onToggle={toggleEventType}
          onEdit={editType}
          onCreate={openNewType}
          onCopy={copyLink}
        />
      )}

      {tab === "requests" && (
        <RequestsView
          appointments={appointments}
          eventTypes={eventTypes}
          clients={clients}
          filter={requestFilter}
          query={query}
          onFilterChange={setRequestFilter}
          onQueryChange={setQuery}
          onStatusChange={(id, status) => {
            setAppointmentStatus(id, status);
            toast.success(status === "confirmed" ? "Agendamento confirmado." : status === "cancelled" ? "Solicitação recusada." : "Status atualizado.");
          }}
          onEdit={editAppointment}
        />
      )}

      {tab === "history" && <HistoryView appointments={appointments} eventTypes={eventTypes} clients={clients} query={query} onQueryChange={setQuery} onEdit={editAppointment} />}

      <AppointmentDialog
        key={`${appointmentDialogOpen}-${selectedAppointment?.id ?? "new"}`}
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        appointment={selectedAppointment}
        appointments={appointments}
        eventTypes={eventTypes.filter((item) => item.active || item.id === selectedAppointment?.typeId)}
        clients={clients}
        onSave={saveAppointment}
      />

      <EventTypeDialog key={`${typeDialogOpen}-${selectedType?.id ?? "new"}`} open={typeDialogOpen} onOpenChange={setTypeDialogOpen} eventType={selectedType} onSave={saveEventType} />
    </div>
  );
}

function AgendaTabs({ tab, onChange, eventTypeCount, pendingCount }: { tab: AgendaTab; onChange: (tab: AgendaTab) => void; eventTypeCount: number; pendingCount: number }) {
  const tabs: Array<{ value: AgendaTab; label: string; count?: number }> = [
    { value: "overview", label: "Visão Geral" },
    { value: "types", label: "Tipos de Eventos", count: eventTypeCount },
    { value: "requests", label: "Reservas & Solicitações", count: pendingCount },
    { value: "history", label: "Histórico" },
  ];
  return <nav className="week-board-scroll mt-6 flex overflow-x-auto border-b border-slate-200" aria-label="Seções da Agenda">{tabs.map((item) => <button key={item.value} type="button" onClick={() => onChange(item.value)} className={cn("flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-1 text-xs font-medium text-slate-500 transition [&+button]:ml-7", tab === item.value && "border-[#654ff0] font-semibold text-[#5945df]")}>{item.label}{item.count !== undefined && <span className={cn("rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500", item.value === "requests" && item.count > 0 && "bg-amber-50 text-amber-700")}>{item.count}{item.value === "requests" && item.count > 0 ? " pendentes" : item.value === "types" ? " tipos" : ""}</span>}</button>)}</nav>;
}

function Overview({ appointments, eventTypes, clients, weekStart, weekEnd, bookedMinutes, occupancy, nextAppointment, pendingCount, mode, query, typeFilter, onModeChange, onQueryChange, onTypeFilterChange, onWeekChange, onEdit, onOpenRequests }: {
  appointments: Appointment[];
  eventTypes: EventType[];
  clients: Client[];
  weekStart: Date;
  weekEnd: Date;
  bookedMinutes: number;
  occupancy: number;
  nextAppointment?: Appointment;
  pendingCount: number;
  mode: OverviewMode;
  query: string;
  typeFilter: string;
  onModeChange: (mode: OverviewMode) => void;
  onQueryChange: (query: string) => void;
  onTypeFilterChange: (type: string) => void;
  onWeekChange: (date: Date) => void;
  onEdit: (appointment: Appointment) => void;
  onOpenRequests: () => void;
}) {
  const clientById = (id: string | null) => clients.find((client) => client.id === id);
  const typeById = (id: string) => eventTypes.find((type) => type.id === id);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const base = appointments.filter((item) => item.status === "confirmed" || item.status === "pending");
  const visible = base.filter((item) => {
    const whenMatches = mode === "upcoming" ? item.date >= todayKey() : mode === "day" ? item.date === todayKey() : isWithinInterval(parseISO(item.date), { start: weekStart, end: weekEnd });
    const searchText = `${item.title} ${clientById(item.clientId)?.name ?? item.guestName}`.toLocaleLowerCase("pt-BR");
    return whenMatches && (typeFilter === "all" || item.typeId === typeFilter) && (!normalizedQuery || searchText.includes(normalizedQuery));
  });
  const grouped = visible.reduce<Record<string, Appointment[]>>((groups, appointment) => {
    (groups[appointment.date] ??= []).push(appointment);
    return groups;
  }, {});
  const nextClient = nextAppointment ? clientById(nextAppointment.clientId) : null;

  return <>
    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Atendimentos esta semana" value={`${appointments.filter((item) => item.status === "confirmed" && isWithinInterval(parseISO(item.date), { start: weekStart, end: weekEnd })).length} agendamentos`} helper={`${formatDuration(bookedMinutes)} reservados`} icon={CalendarDays} tone="violet" />
      <MetricCard label="Próximo compromisso" value={nextAppointment ? `${isToday(parseISO(nextAppointment.date)) ? "Hoje" : format(parseISO(nextAppointment.date), "dd MMM", { locale: ptBR })} às ${nextAppointment.time}` : "Agenda livre"} helper={nextAppointment ? `${nextAppointment.title}${nextClient ? ` • ${nextClient.name}` : ""}` : "Nenhum compromisso futuro"} icon={Clock3} tone="emerald" />
      <MetricCard label="Taxa de ocupação" value={`${occupancy}%`} helper={`${formatDuration(bookedMinutes)} de 40h semanais`} icon={Gauge} tone="blue" progress={occupancy} />
      <button type="button" onClick={onOpenRequests} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-200"><div className="flex items-start justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Solicitações pendentes</p><span className="grid size-7 place-items-center rounded-md bg-amber-50 text-amber-600"><BellRing className="size-3.5" /></span></div><p className="mt-5 text-xl font-bold tracking-[-0.03em] text-amber-600">{pendingCount} para aprovar</p><p className="mt-1 text-[11px] font-medium text-[#5b47df]">Revisar solicitações →</p></button>
    </section>

    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex shrink-0 items-center gap-2"><div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5"><button type="button" onClick={() => onWeekChange(addWeeks(weekStart, -1))} className="grid size-7 place-items-center rounded text-slate-500 hover:bg-white" aria-label="Semana anterior"><ChevronLeft className="size-3.5" /></button><button type="button" onClick={() => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="h-7 px-2.5 text-[11px] font-semibold text-slate-700">Hoje</button><button type="button" onClick={() => onWeekChange(addWeeks(weekStart, 1))} className="grid size-7 place-items-center rounded text-slate-500 hover:bg-white" aria-label="Próxima semana"><ChevronRight className="size-3.5" /></button></div><span className="text-xs font-semibold tabular-nums text-slate-700">{format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}</span></div>
        <div className="flex items-center rounded-md bg-slate-100 p-0.5">{(["upcoming", "day", "week"] as OverviewMode[]).map((value) => <button key={value} type="button" onClick={() => onModeChange(value)} className={cn("h-7 rounded px-2.5 text-[11px] font-medium text-slate-500", mode === value && "bg-white font-semibold text-slate-800")}>{value === "upcoming" ? "Próximos" : value === "day" ? "Por dia" : "Semana"}</button>)}</div>
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none"><div className="relative min-w-[180px] flex-1 sm:w-[250px]"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar atendimentos..." className="h-8 rounded-md pl-8 text-xs shadow-none" /></div><Select value={typeFilter} onValueChange={onTypeFilterChange}><SelectTrigger className="h-8 w-[150px] rounded-md bg-white text-[11px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{eventTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
    </section>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {Object.keys(grouped).length ? Object.entries(grouped).map(([date, items]) => <section key={date}><div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2"><span className={cn("size-2 rounded-full", isToday(parseISO(date)) ? "bg-[#5c4be4]" : "bg-slate-300")} /><h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">{isToday(parseISO(date)) ? "Hoje — " : ""}{format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}</h2><span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{items.length} {items.length === 1 ? "agendamento" : "agendamentos"}</span></div><div className="space-y-2">{items.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} eventType={typeById(appointment.typeId)} client={clientById(appointment.clientId)} onEdit={() => onEdit(appointment)} />)}</div></section>) : <EmptyState title="Nenhum atendimento encontrado" description="Altere o período ou os filtros para visualizar outros horários." />}
      </div>
      <MiniCalendar appointments={appointments} month={weekStart} onMonthChange={onWeekChange} />
    </div>
  </>;
}

function MetricCard({ label, value, helper, icon: Icon, tone, progress }: { label: string; value: string; helper: string; icon: typeof CalendarDays; tone: "violet" | "emerald" | "blue"; progress?: number }) {
  const tones = { violet: "bg-[#f0edff] text-[#654ce4]", emerald: "bg-emerald-50 text-emerald-600", blue: "bg-blue-50 text-blue-600" };
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p><span className={cn("grid size-7 place-items-center rounded-md", tones[tone])}><Icon className="size-3.5" /></span></div><p className="mt-5 truncate text-xl font-bold tracking-[-0.03em] text-slate-900">{value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{helper}</p>{progress !== undefined && <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#5747df]" style={{ width: `${progress}%` }} /></div>}</div>;
}

function AppointmentRow({ appointment, eventType, client, onEdit }: { appointment: Appointment; eventType?: EventType; client?: Client; onEdit: () => void }) {
  return <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"><div className="flex h-14 w-[72px] shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50"><strong className="text-sm tabular-nums text-slate-800">{appointment.time}</strong><span className="text-[10px] text-slate-400">{formatDuration(eventType?.durationMinutes ?? 30)}</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-xs font-semibold text-slate-900">{appointment.title}</h3><span className={cn("inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[9px] font-semibold", statusStyles[appointment.status])}><span className="size-1.5 rounded-full bg-current" />{APPOINTMENT_STATUS_LABELS[appointment.status]}</span></div><p className="mt-1 truncate text-[11px] text-slate-500">{client?.name ?? appointment.guestName ?? "Sem cliente vinculado"}</p><p className="mt-1.5 flex items-center gap-1.5 truncate text-[10px] text-slate-400"><ModeIcon mode={appointment.mode} className="size-3" />{APPOINTMENT_MODE_LABELS[appointment.mode]}{appointment.location ? ` • ${appointment.location}` : ""}</p></div><div className="flex shrink-0 items-center gap-1"><Button type="button" variant="secondary" size="sm" onClick={onEdit} className="h-7 rounded-md px-2.5 text-[10px] shadow-none">Ver detalhes</Button><Button type="button" variant="ghost" size="sm" onClick={onEdit} className="h-7 rounded-md px-2 text-[10px] text-slate-500">Remarcar</Button><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label="Mais opções"><MoreVertical className="size-3.5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onEdit}><Pencil /> Editar agendamento</DropdownMenuItem>{appointment.meetingUrl && <DropdownMenuItem onSelect={() => window.open(appointment.meetingUrl, "_blank")}><ExternalLink /> Abrir chamada</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div></article>;
}

function MiniCalendar({ appointments, month, onMonthChange }: { appointments: Appointment[]; month: Date; onMonthChange: (date: Date) => void }) {
  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const eventDates = new Set(appointments.filter((item) => item.status !== "cancelled").map((item) => item.date));
  return <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-xs font-semibold capitalize text-slate-800">{format(monthStart, "MMMM yyyy", { locale: ptBR })}</h2><div className="flex"><button type="button" onClick={() => onMonthChange(addMonths(month, -1))} className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-50"><ChevronLeft className="size-3.5" /></button><button type="button" onClick={() => onMonthChange(addMonths(month, 1))} className="grid size-7 place-items-center rounded text-slate-400 hover:bg-slate-50"><ChevronRight className="size-3.5" /></button></div></div><div className="mt-4 grid grid-cols-7 text-center text-[9px] font-semibold text-slate-400">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-y-1">{days.map((day) => { const key = format(day, "yyyy-MM-dd"); return <button key={key} type="button" onClick={() => onMonthChange(startOfWeek(day, { weekStartsOn: 1 }))} className={cn("relative grid aspect-square place-items-center rounded-md text-[10px] text-slate-600 hover:bg-slate-50", !isSameMonth(day, monthStart) && "text-slate-300", isToday(day) && "bg-[#5747df] font-semibold text-white hover:bg-[#5747df]")}>{format(day, "d")}{eventDates.has(key) && !isToday(day) && <span className="absolute bottom-1 size-1 rounded-full bg-[#6956ea]" />}</button>; })}</div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#6956ea]" />Com atendimentos</span><button type="button" onClick={() => onMonthChange(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="font-semibold text-[#5d48dd]">Ir para hoje</button></div></aside>;
}

function EventTypesView({ eventTypes, query, publicUrl, onToggle, onEdit, onCreate, onCopy }: { eventTypes: EventType[]; query: string; publicUrl: string; onToggle: (id: string) => void; onEdit: (type: EventType) => void; onCreate: () => void; onCopy: (value?: string) => void }) {
  const filtered = eventTypes.filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  return <>
    <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Link2 className="size-4" /></span><div><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Página pública ativa</p><p className="mt-1 text-xs font-medium text-slate-700">{publicUrl.replace(/^https?:\/\//, "")}</p></div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => onCopy()} className="h-8 rounded-md px-2.5 text-[11px] shadow-none"><Copy className="size-3.5" /> Copiar link</Button><Button type="button" variant="outline" size="sm" onClick={() => toast.info("A personalização da página pública ficará disponível nas configurações da Agenda.")} className="h-8 rounded-md bg-white px-2.5 text-[11px] shadow-none"><Pencil className="size-3.5" /> Personalizar</Button><Button type="button" variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")} className="h-8 rounded-md border-[#ded8ff] bg-[#f5f3ff] px-2.5 text-[11px] text-[#5e48df] shadow-none"><ExternalLink className="size-3.5" /> Visualizar</Button></div></section>
    <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((eventType) => <EventTypeCard key={eventType.id} eventType={eventType} publicUrl={publicUrl} onToggle={() => onToggle(eventType.id)} onEdit={() => onEdit(eventType)} onCopy={onCopy} />)}<button type="button" onClick={onCreate} className="group flex min-h-[250px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-6 text-center transition hover:border-[#9e8df0] hover:bg-[#faf9ff]"><span className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 group-hover:text-[#5d48dd]"><Plus className="size-5" /></span><h2 className="mt-4 text-sm font-semibold text-slate-800">Adicionar formato de atendimento</h2><p className="mt-1 max-w-[240px] text-[11px] leading-4 text-slate-500">Defina duração, modalidade, disponibilidade e valor.</p></button></section>
    <section className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[#5e48df]"><Sparkles className="size-3.5" /> Dica para otimizar sua agenda</p><h2 className="mt-2 text-sm font-semibold text-slate-900">Personalize a experiência de agendamento</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Inclua perguntas prévias e lembretes automáticos para chegar a cada atendimento com o contexto necessário.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="h-8 rounded-md bg-white text-[11px] shadow-none">Formulário prévio</Button><Button type="button" variant="secondary" size="sm" className="h-8 rounded-md bg-[#f1efff] text-[11px] text-[#5e48df] shadow-none"><BellRing className="size-3.5" /> Configurar lembretes</Button></div></section>
  </>;
}

function EventTypeCard({ eventType, publicUrl, onToggle, onEdit, onCopy }: { eventType: EventType; publicUrl: string; onToggle: () => void; onEdit: () => void; onCopy: (value?: string) => void }) {
  const link = `${publicUrl}?tipo=${encodeURIComponent(eventType.slug)}`;
  return <article className={cn("flex min-h-[250px] flex-col rounded-xl border border-slate-200 bg-white p-4", !eventType.active && "bg-slate-50/70 opacity-75")}><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold", eventType.active ? eventType.clientOnly ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}><span className="size-1.5 rounded-full bg-current" />{eventType.active ? eventType.clientOnly ? "Exclusivo para clientes" : "Ativo" : "Pausado"}</span><Switch size="sm" checked={eventType.active} onCheckedChange={onToggle} /></div><h2 className="mt-4 text-sm font-semibold text-slate-900">{eventType.name}</h2><p className="mt-1 min-h-10 text-[11px] leading-4 text-slate-500">{eventType.description}</p><div className="mt-3 flex flex-wrap gap-1.5"><span className="inline-flex h-6 items-center gap-1 rounded-md bg-slate-100 px-2 text-[10px] text-slate-600"><Clock3 className="size-3" />{formatDuration(eventType.durationMinutes)}</span><span className="inline-flex h-6 items-center gap-1 rounded-md bg-slate-100 px-2 text-[10px] text-slate-600"><ModeIcon mode={eventType.mode} className="size-3" />{APPOINTMENT_MODE_LABELS[eventType.mode]}</span><span className={cn("inline-flex h-6 items-center rounded-md px-2 text-[10px] font-semibold", eventType.includedInPlan ? "bg-blue-50 text-blue-700" : eventType.price ? "bg-[#f0edff] text-[#5944d9]" : "bg-emerald-50 text-emerald-700")}>{eventType.includedInPlan ? "Incluído no plano" : eventType.price ? currency.format(eventType.price) : "Gratuito"}</span></div><button type="button" disabled={!eventType.active} onClick={() => onCopy(link)} className="mt-3 flex h-8 items-center justify-between rounded-md bg-slate-50 px-2.5 font-mono text-[9px] text-slate-500 disabled:italic"><span className="truncate">{eventType.active ? link.replace(/^https?:\/\//, "") : "Link temporariamente desativado"}</span><Copy className="ml-2 size-3 shrink-0" /></button><div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3"><Button type="button" variant="secondary" size="sm" onClick={onEdit} className="h-7 rounded-md px-2.5 text-[10px] shadow-none">Editar</Button>{eventType.active && <Button type="button" variant="ghost" size="sm" onClick={() => onCopy(link)} className="h-7 rounded-md px-2.5 text-[10px] text-slate-600"><Share2 className="size-3" /> Compartilhar</Button>}<DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="ml-auto grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><MoreVertical className="size-3.5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onEdit}><Pencil /> Editar</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={onToggle}>{eventType.active ? "Pausar" : "Ativar"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></article>;
}

function RequestsView({ appointments, eventTypes, clients, filter, query, onFilterChange, onQueryChange, onStatusChange, onEdit }: { appointments: Appointment[]; eventTypes: EventType[]; clients: Client[]; filter: RequestFilter; query: string; onFilterChange: (filter: RequestFilter) => void; onQueryChange: (query: string) => void; onStatusChange: (id: string, status: AppointmentStatus) => void; onEdit: (appointment: Appointment) => void }) {
  const counts = { pending: appointments.filter((item) => item.status === "pending").length, confirmed: appointments.filter((item) => item.status === "confirmed").length, cancelled: appointments.filter((item) => item.status === "cancelled").length, all: appointments.length };
  const clientById = (id: string | null) => clients.find((client) => client.id === id);
  const typeById = (id: string) => eventTypes.find((type) => type.id === id);
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const matchesQuery = (item: Appointment) => !normalized || `${item.title} ${clientById(item.clientId)?.name ?? item.guestName}`.toLocaleLowerCase("pt-BR").includes(normalized);
  const visible = appointments.filter((item) => (filter === "all" || item.status === filter) && matchesQuery(item));
  const pending = visible.filter((item) => item.status === "pending");
  const confirmed = appointments.filter((item) => item.status === "confirmed" && matchesQuery(item));
  return <>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="week-board-scroll flex max-w-full gap-1 overflow-x-auto">{(["pending", "confirmed", "cancelled", "all"] as RequestFilter[]).map((value) => <button key={value} type="button" onClick={() => onFilterChange(value)} className={cn("h-8 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600", filter === value && "border-slate-900 bg-slate-900 text-white")}>{value === "pending" ? "Pendentes" : value === "confirmed" ? "Confirmadas" : value === "cancelled" ? "Recusadas / canceladas" : "Todas"} ({counts[value]})</button>)}</div><div className="relative w-full sm:w-[280px]"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Pesquisar por cliente..." className="h-8 rounded-md pl-8 text-xs shadow-none" /></div></div>
    {filter === "pending" || filter === "all" ? <section className="mt-6"><div className="mb-3 flex items-center"><h2 className="text-sm font-semibold text-slate-900">Aguardando sua confirmação</h2><span className="ml-2 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{pending.length} solicitações</span><span className="ml-auto hidden text-[10px] text-slate-400 sm:block">Resposta sugerida em até 24h</span></div><div className="space-y-3">{pending.length ? pending.map((appointment) => <PendingRequestCard key={appointment.id} appointment={appointment} eventType={typeById(appointment.typeId)} client={clientById(appointment.clientId)} onConfirm={() => onStatusChange(appointment.id, "confirmed")} onEdit={() => onEdit(appointment)} onReject={() => onStatusChange(appointment.id, "cancelled")} />) : <EmptyState title="Nenhuma solicitação pendente" description="Novos pedidos feitos pela página pública aparecerão aqui." />}</div></section> : null}
    {(filter === "pending" || filter === "confirmed" || filter === "all") && <ConfirmedTable appointments={confirmed} eventTypes={eventTypes} clients={clients} onEdit={onEdit} onCancel={(id) => onStatusChange(id, "cancelled")} />}
    {filter === "cancelled" && <HistoryTable appointments={visible} eventTypes={eventTypes} clients={clients} onEdit={onEdit} />}
  </>;
}

function PendingRequestCard({ appointment, eventType, client, onConfirm, onEdit, onReject }: { appointment: Appointment; eventType?: EventType; client?: Client; onConfirm: () => void; onEdit: () => void; onReject: () => void }) {
  return <article className="overflow-hidden rounded-xl border border-amber-200 bg-white"><div className="border-l-4 border-amber-400 p-4"><div className="flex flex-col gap-4 xl:flex-row"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-[#efeaff] text-xs font-semibold text-[#6047de]">{client?.initials ?? "NC"}</span><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-900">{client?.name ?? (appointment.guestName || "Novo contato")}</h3><p className="mt-0.5 text-[10px] text-slate-400">{client ? "Cliente cadastrado" : "Contato da página pública"}</p></div><span className="ml-auto rounded-md bg-[#f0edff] px-2 py-1 text-[10px] font-semibold text-[#5c45d8]">{eventType?.name ?? appointment.title} • {formatDuration(eventType?.durationMinutes ?? 30)}</span></div><div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-white text-slate-500"><CalendarDays className="size-3.5" /></span><div><p className="text-[9px] font-semibold uppercase text-slate-400">Data e horário</p><p className="text-[11px] font-medium text-slate-700">{format(parseISO(appointment.date), "EEE, dd MMM", { locale: ptBR })} • {appointment.time}</p></div></div><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-white text-emerald-600"><ModeIcon mode={appointment.mode} className="size-3.5" /></span><div><p className="text-[9px] font-semibold uppercase text-slate-400">Modalidade</p><p className="text-[11px] font-medium text-slate-700">{APPOINTMENT_MODE_LABELS[appointment.mode]}</p></div></div><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-white text-amber-600"><Clock3 className="size-3.5" /></span><div><p className="text-[9px] font-semibold uppercase text-slate-400">Origem</p><p className="text-[11px] font-medium text-slate-700">{appointment.source}</p></div></div></div>{appointment.notes && <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2"><p className="text-[10px] font-semibold text-amber-800">Informações fornecidas</p><p className="mt-0.5 text-[11px] text-slate-600">{appointment.notes}</p></div>}</div><div className="grid shrink-0 gap-2 sm:grid-cols-3 xl:w-[210px] xl:grid-cols-1"><Button type="button" size="sm" onClick={onConfirm} className="h-9 rounded-md bg-emerald-600 text-[11px] shadow-none hover:bg-emerald-700"><Check className="size-3.5" /> Confirmar</Button><Button type="button" variant="outline" size="sm" onClick={onEdit} className="h-9 rounded-md bg-white text-[11px] shadow-none"><CalendarDays className="size-3.5" /> Sugerir horário</Button><Button type="button" variant="outline" size="sm" onClick={onReject} className="h-9 rounded-md border-rose-200 bg-rose-50 text-[11px] text-rose-600 shadow-none"><X className="size-3.5" /> Recusar</Button></div></div></div></article>;
}

function ConfirmedTable({ appointments, eventTypes, clients, onEdit, onCancel }: { appointments: Appointment[]; eventTypes: EventType[]; clients: Client[]; onEdit: (item: Appointment) => void; onCancel: (id: string) => void }) {
  return <section className="mt-7"><div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">Reservas confirmadas</h2><p className="mt-0.5 text-[11px] text-slate-400">Horários garantidos no calendário.</p></div><div className="week-board-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-left"><thead className="border-b border-slate-200 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-[0.05em] text-slate-400"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Data & horário</th><th className="px-4 py-3">Tipo de evento</th><th className="px-4 py-3">Confirmação</th><th className="px-4 py-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{appointments.map((appointment) => { const client = clients.find((item) => item.id === appointment.clientId); const type = eventTypes.find((item) => item.id === appointment.typeId); return <tr key={appointment.id} className="text-[11px] text-slate-600"><td className="px-4 py-3"><p className="font-semibold text-slate-800">{client?.name ?? appointment.guestName}</p><p className="mt-0.5 text-[10px] text-slate-400">{client?.segment || "Contato externo"}</p></td><td className="px-4 py-3"><p>{format(parseISO(appointment.date), "dd 'de' MMMM", { locale: ptBR })}</p><p className="mt-0.5 text-[10px] text-slate-400">{appointment.time}</p></td><td className="px-4 py-3">{type?.name ?? appointment.title} ({formatDuration(type?.durationMinutes ?? 30)})</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Confirmado</span></td><td className="px-4 py-3"><div className="flex gap-1"><Button type="button" variant="secondary" size="sm" onClick={() => onEdit(appointment)} className="h-7 rounded-md px-2 text-[10px] shadow-none">Remarcar</Button><Button type="button" variant="ghost" size="sm" onClick={() => onCancel(appointment.id)} className="h-7 rounded-md px-2 text-[10px] text-rose-600">Cancelar</Button></div></td></tr>; })}</tbody></table></div></section>;
}

function HistoryView({ appointments, eventTypes, clients, query, onQueryChange, onEdit }: { appointments: Appointment[]; eventTypes: EventType[]; clients: Client[]; query: string; onQueryChange: (query: string) => void; onEdit: (appointment: Appointment) => void }) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const visible = [...appointments].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)).filter((item) => !normalized || `${item.title} ${clients.find((client) => client.id === item.clientId)?.name ?? item.guestName}`.toLocaleLowerCase("pt-BR").includes(normalized));
  return <><div className="mt-5 flex justify-end"><div className="relative w-full sm:w-[300px]"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar no histórico..." className="h-8 rounded-md pl-8 text-xs shadow-none" /></div></div><HistoryTable appointments={visible} eventTypes={eventTypes} clients={clients} onEdit={onEdit} /></>;
}

function HistoryTable({ appointments, eventTypes, clients, onEdit }: { appointments: Appointment[]; eventTypes: EventType[]; clients: Client[]; onEdit: (item: Appointment) => void }) {
  return <div className="week-board-scroll mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[780px] text-left"><thead className="border-b border-slate-200 bg-slate-50/70 text-[9px] font-semibold uppercase text-slate-400"><tr><th className="px-4 py-3">Atendimento</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Modalidade</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{appointments.map((appointment) => { const type = eventTypes.find((item) => item.id === appointment.typeId); const client = clients.find((item) => item.id === appointment.clientId); return <tr key={appointment.id} className="text-[11px] text-slate-600"><td className="px-4 py-3 font-semibold text-slate-800">{type?.name ?? appointment.title}</td><td className="px-4 py-3">{client?.name ?? (appointment.guestName || "Sem cliente")}</td><td className="px-4 py-3 tabular-nums">{format(parseISO(appointment.date), "dd/MM/yyyy")} • {appointment.time}</td><td className="px-4 py-3">{APPOINTMENT_MODE_LABELS[appointment.mode]}</td><td className="px-4 py-3"><span className={cn("inline-flex rounded-md border px-2 py-1 text-[10px] font-medium", statusStyles[appointment.status])}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</span></td><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => onEdit(appointment)} className="h-7 rounded-md px-2 text-[10px]">Detalhes</Button></td></tr>; })}</tbody></table>{!appointments.length && <div className="py-12 text-center text-xs text-slate-400">Nenhum agendamento encontrado.</div>}</div>;
}

function AppointmentDialog({ open, onOpenChange, appointment, appointments, eventTypes, clients, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; appointment: Appointment | null; appointments: Appointment[]; eventTypes: EventType[]; clients: Client[]; onSave: (draft: AppointmentDraft) => void }) {
  const defaultType = eventTypes[0];
  const [draft, setDraft] = useState<AppointmentDraft>(() => appointment ? { title: appointment.title, typeId: appointment.typeId, clientId: appointment.clientId, guestName: appointment.guestName, guestEmail: appointment.guestEmail, guestPhone: appointment.guestPhone, date: appointment.date, time: appointment.time, status: appointment.status, mode: appointment.mode, location: appointment.location, meetingUrl: appointment.meetingUrl, notes: appointment.notes, source: appointment.source } : { title: defaultType?.name ?? "Atendimento", typeId: defaultType?.id ?? "", clientId: null, guestName: "", guestEmail: "", guestPhone: "", date: todayKey(), time: "09:00", status: "confirmed", mode: defaultType?.mode ?? "google_meet", location: "", meetingUrl: "", notes: "", source: "Cadastro interno" });
  const selectedType = eventTypes.find((item) => item.id === draft.typeId);
  const update = <K extends keyof AppointmentDraft>(key: K, value: AppointmentDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const duration = selectedType?.durationMinutes ?? 30;
  const start = toMinutes(draft.time);
  const conflict = Boolean(draft.date && draft.time && appointments.some((item) => {
    if (item.id === appointment?.id || item.date !== draft.date || item.status === "cancelled") return false;
    const itemStart = toMinutes(item.time);
    const itemDuration = eventTypes.find((type) => type.id === item.typeId)?.durationMinutes ?? 30;
    return start < itemStart + itemDuration && itemStart < start + duration;
  }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.typeId || !draft.date || !draft.time) { toast.error("Preencha tipo, data e horário."); return; }
    if (!draft.clientId && !draft.guestName.trim()) { toast.error("Selecione um cliente ou informe o contato."); return; }
    if (conflict) { toast.error("Escolha um horário sem conflito."); return; }
    onSave({ ...draft, title: selectedType?.name ?? draft.title, mode: selectedType?.mode ?? draft.mode, guestName: draft.guestName.trim() });
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-2xl gap-0 overflow-y-auto rounded-xl border-slate-200 p-0"><form onSubmit={submit}><DialogHeader className="border-b border-slate-100 px-5 py-4 text-left"><DialogTitle className="text-base">{appointment ? "Gerenciar agendamento" : "Novo agendamento"}</DialogTitle><DialogDescription className="text-xs">Organize cliente, formato e horário do atendimento.</DialogDescription></DialogHeader><div className="space-y-4 px-5 py-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo de evento"><Select value={draft.typeId} onValueChange={(value) => { const type = eventTypes.find((item) => item.id === value); setDraft((current) => ({ ...current, typeId: value, title: type?.name ?? current.title, mode: type?.mode ?? current.mode })); }}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{eventTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Cliente"><Select value={draft.clientId ?? "none"} onValueChange={(value) => update("clientId", value === "none" ? null : value)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Novo contato</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></Field></div>{!draft.clientId && <div className="grid gap-4 sm:grid-cols-3"><Field label="Nome do contato"><Input value={draft.guestName} onChange={(event) => update("guestName", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="E-mail"><Input type="email" value={draft.guestEmail} onChange={(event) => update("guestEmail", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Telefone"><Input value={draft.guestPhone} onChange={(event) => update("guestPhone", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field></div>}<div className="grid gap-4 sm:grid-cols-[1fr_150px_170px]"><Field label="Data"><Input type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Horário"><Input type="time" value={draft.time} onChange={(event) => update("time", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Status"><Select value={draft.status} onValueChange={(value) => update("status", value as AppointmentStatus)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field></div>{conflict && <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700"><BellRing className="size-3.5 shrink-0" />Este horário conflita com outro agendamento. Escolha um novo horário.</div>}<div className="grid gap-4 sm:grid-cols-2"><Field label={draft.mode === "in_person" ? "Local" : "Link da chamada"}><Input value={draft.mode === "in_person" ? draft.location : draft.meetingUrl} onChange={(event) => update(draft.mode === "in_person" ? "location" : "meetingUrl", event.target.value)} placeholder={draft.mode === "in_person" ? "Endereço ou sala" : "https://meet.google.com/..."} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Origem"><Input value={draft.source} onChange={(event) => update("source", event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field></div><Field label="Observações"><Textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} rows={3} className="resize-none rounded-md text-xs shadow-none" /></Field></div><DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/60 px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 rounded-md text-xs">Cancelar</Button><Button type="submit" size="sm" disabled={conflict} className="h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none"><Check className="size-3.5" />{appointment ? "Salvar alterações" : "Criar agendamento"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function EventTypeDialog({ open, onOpenChange, eventType, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; eventType: EventType | null; onSave: (draft: EventTypeDraft) => void }) {
  const [draft, setDraft] = useState<EventTypeDraft>(() => eventType ? { name: eventType.name, description: eventType.description, durationMinutes: eventType.durationMinutes, mode: eventType.mode, price: eventType.price, includedInPlan: eventType.includedInPlan, clientOnly: eventType.clientOnly, active: eventType.active, slug: eventType.slug, color: eventType.color } : { name: "", description: "", durationMinutes: 30, mode: "google_meet", price: null, includedInPlan: false, clientOnly: false, active: true, slug: "", color: "#4f46e5" });
  const update = <K extends keyof EventTypeDraft>(key: K, value: EventTypeDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!draft.name.trim()) { toast.error("Informe o nome do evento."); return; } const slug = (draft.slug || draft.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); onSave({ ...draft, name: draft.name.trim(), slug }); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl gap-0 rounded-xl border-slate-200 p-0"><form onSubmit={submit}><DialogHeader className="border-b border-slate-100 px-5 py-4 text-left"><DialogTitle className="text-base">{eventType ? "Editar tipo de evento" : "Novo tipo de evento"}</DialogTitle><DialogDescription className="text-xs">Configure o formato que aparecerá na sua página de agendamento.</DialogDescription></DialogHeader><div className="space-y-4 px-5 py-5"><Field label="Nome"><Input autoFocus value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ex.: Reunião de diagnóstico" className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Descrição"><Textarea value={draft.description} onChange={(event) => update("description", event.target.value)} rows={2} className="resize-none rounded-md text-xs shadow-none" /></Field><div className="grid gap-4 sm:grid-cols-3"><Field label="Duração"><Select value={String(draft.durationMinutes)} onValueChange={(value) => update("durationMinutes", Number(value))}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent>{[15, 30, 45, 60, 90, 120].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{formatDuration(minutes)}</SelectItem>)}</SelectContent></Select></Field><Field label="Modalidade"><Select value={draft.mode} onValueChange={(value) => update("mode", value as AppointmentMode)}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(APPOINTMENT_MODE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label="Valor"><Input type="number" min="0" step="0.01" value={draft.price ?? ""} onChange={(event) => update("price", event.target.value ? Number(event.target.value) : null)} placeholder="Gratuito" className="h-9 rounded-md text-xs shadow-none" /></Field></div><Field label="Endereço do link"><div className="flex h-9 items-center rounded-md border border-slate-200 bg-white px-3"><span className="text-[10px] text-slate-400">/agendar/</span><input value={draft.slug} onChange={(event) => update("slug", event.target.value)} placeholder="nome-do-evento" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div></Field><div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3"><ToggleField label="Evento ativo" checked={draft.active} onChange={(checked) => update("active", checked)} /><ToggleField label="Só para clientes" checked={draft.clientOnly} onChange={(checked) => update("clientOnly", checked)} /><ToggleField label="Incluído no plano" checked={draft.includedInPlan} onChange={(checked) => update("includedInPlan", checked)} /></div></div><DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/60 px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 rounded-md text-xs">Cancelar</Button><Button type="submit" size="sm" className="h-8 rounded-md bg-[#5140df] px-3 text-xs shadow-none"><Check className="size-3.5" /> Salvar tipo</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-600">{label}</Label>{children}</div>; }
function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">{label}<Switch size="sm" checked={checked} onCheckedChange={onChange} /></label>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-200 bg-white px-4 text-center"><div><CalendarDays className="mx-auto size-6 text-slate-300" /><h2 className="mt-3 text-xs font-semibold text-slate-700">{title}</h2><p className="mt-1 text-[11px] text-slate-400">{description}</p></div></div>; }
