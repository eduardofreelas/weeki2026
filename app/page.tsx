"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { addDays, addWeeks, format, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { WeekiCommandPalette } from "@/components/weeki/command-palette";
import { MobileNavigation, WeekiSidebar } from "@/components/weeki/sidebar";
import { TaskCard } from "@/components/weeki/task-card";
import { TaskSheet } from "@/components/weeki/task-sheet";
import { WeekBoard, type WeekViewMode } from "@/components/weeki/week-board";
import { CLIENTS } from "@/features/tasks/seed";
import { type Task, type TaskDraft, type TaskStatus } from "@/features/tasks/types";
import { useWeekiTasks } from "@/features/tasks/use-weeki-tasks";
import { cn } from "@/lib/utils";

const initialWeek = () => startOfWeek(new Date(), { weekStartsOn: 1 });
const subscribeToHydration = () => () => undefined;
const statusOptions: Array<{ value: TaskStatus | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "not_started", label: "Pendentes" },
  { value: "in_progress", label: "Em andamento" },
  { value: "waiting", label: "Aguardando" },
  { value: "review", label: "Em revisão" },
  { value: "completed", label: "Concluídas" },
];

export default function Home() {
  const { tasks, addTask, updateTask, moveTask, assignTaskClient, toggleComplete, duplicateTask, archiveTask } = useWeekiTasks();
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [viewMode, setViewMode] = useState<WeekViewMode>("week");
  const [showWeekend, setShowWeekend] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const [initialTime, setInitialTime] = useState("");
  const [initialClientId, setInitialClientId] = useState<string | null>(null);
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const weekEnd = addDays(weekStart, showWeekend ? 6 : 4);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        setSelectedTask(null);
        setInitialDate(todayKey);
        setInitialTime("");
        setInitialClientId(null);
        setSheetOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [todayKey]);

  const tasksInWeek = useMemo(() => tasks.filter((task) => {
    if (!task.scheduledDate) return false;
    return isWithinInterval(parseISO(task.scheduledDate), { start: weekStart, end: weekEnd });
  }), [tasks, weekStart, weekEnd]);

  const filteredTasks = useMemo(() => tasksInWeek.filter((task) => {
    const client = CLIENTS.find((item) => item.id === task.clientId);
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !normalizedQuery || `${task.title} ${task.description} ${client?.name ?? ""} ${task.tags.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    return matchesQuery && (statusFilter === "all" || task.status === statusFilter) && (clientFilter === "all" || task.clientId === clientFilter);
  }), [tasksInWeek, query, statusFilter, clientFilter]);

  const inboxTasks = tasks.filter((task) => !task.scheduledDate);
  const hasActiveFilters = Boolean(query.trim() || statusFilter !== "all" || clientFilter !== "all");
  const completedCount = tasksInWeek.filter((task) => task.status === "completed").length;
  const progress = tasksInWeek.length ? Math.round((completedCount / tasksInWeek.length) * 100) : 0;

  const openNewTask = useCallback((date: string | null, time = "", clientId: string | null = null) => {
    setSelectedTask(null);
    setInitialDate(date);
    setInitialTime(time);
    setInitialClientId(clientId);
    setSheetOpen(true);
  }, []);

  const openTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setInitialDate(task.scheduledDate);
    setInitialTime(task.scheduledTime);
    setInitialClientId(task.clientId);
    setSheetOpen(true);
  }, []);

  const saveTask = useCallback((draft: TaskDraft, taskId?: string, options?: { silent?: boolean }) => {
    if (taskId) {
      updateTask(taskId, draft, !options?.silent);
      setSelectedTask((current) => current?.id === taskId ? { ...current, ...draft, updatedAt: new Date().toISOString() } : current);
      if (!options?.silent) toast.success("Demanda atualizada.");
    } else {
      addTask(draft);
      toast.success(draft.scheduledDate ? "Demanda adicionada à semana." : "Demanda salva na Caixa de Entrada.");
    }
  }, [addTask, updateTask]);

  const handleMove = useCallback((taskId: string, date: string, time?: string) => {
    const previous = tasks.find((task) => task.id === taskId);
    moveTask(taskId, date, time);
    toast.success("Demanda movida.", previous ? {
      action: {
        label: "Desfazer",
        onClick: () => moveTask(taskId, previous.scheduledDate, previous.scheduledTime),
      },
    } : undefined);
  }, [moveTask, tasks]);

  const handleChangeClient = useCallback((taskId: string, clientId: string | null) => {
    const previous = tasks.find((task) => task.id === taskId);
    assignTaskClient(taskId, clientId);
    toast.success("Cliente da demanda atualizado.", previous ? {
      action: {
        label: "Desfazer",
        onClick: () => assignTaskClient(taskId, previous.clientId),
      },
    } : undefined);
  }, [assignTaskClient, tasks]);

  const handleToggleComplete = useCallback((taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    const wasCompleted = task?.status === "completed";
    toggleComplete(taskId);
    toast.success(wasCompleted ? "Demanda reaberta." : "Demanda concluída.", {
      action: { label: "Desfazer", onClick: () => toggleComplete(taskId) },
    });
  }, [tasks, toggleComplete]);

  const handleDuplicate = useCallback((taskId: string) => {
    duplicateTask(taskId);
    toast.success("Demanda duplicada.");
  }, [duplicateTask]);

  const handleArchive = useCallback((taskId: string) => {
    archiveTask(taskId);
    toast.success("Demanda arquivada.");
  }, [archiveTask]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setClientFilter("all");
  };

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#101014] text-white">
        <div className="flex items-center gap-2">
          <span className="text-[30px] font-semibold tracking-[-0.055em]">weeki</span>
          <span className="size-2.5 rounded-full bg-gradient-to-br from-[#8d6cff] to-[#2f80ed] shadow-[0_0_20px_#7657ff]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <WeekiSidebar inboxCount={inboxTasks.length} onSearch={() => setCommandOpen(true)} />
      <MobileNavigation />

      <main className="min-h-screen md:ml-[252px]">
        <header className="flex h-16 items-center border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-[22px] font-semibold tracking-[-0.055em] text-[#141b2b]">weeki</span>
            <span className="size-2 rounded-full bg-[#4f46e5]" />
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-[#f7f8ff] p-0.5">
              <button onClick={() => setWeekStart((current) => addWeeks(current, -1))} className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900" aria-label="Semana anterior"><ChevronLeft className="size-4" /></button>
              <button onClick={() => setWeekStart(initialWeek())} className="h-8 px-3 text-xs font-semibold text-slate-700">Esta semana</button>
              <button onClick={() => setWeekStart((current) => addWeeks(current, 1))} className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900" aria-label="Próxima semana"><ChevronRight className="size-4" /></button>
            </div>
            <span className="hidden text-xs font-medium tabular-nums text-slate-500 lg:inline">{format(weekStart, "dd", { locale: ptBR })} — {format(weekEnd, "dd MMM, yyyy", { locale: ptBR })}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setInboxOpen((current) => !current)} className={cn("h-9 px-2.5 text-xs text-slate-600", inboxOpen && "bg-[#eef0ff] text-[#4f46e5]")}>
              <Inbox className="size-4" /><span className="hidden lg:inline">Caixa de Entrada</span>
              {inboxTasks.length > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{inboxTasks.length}</span>}
            </Button>
            <Button size="sm" onClick={() => openNewTask(todayKey)} className="h-9 rounded-lg bg-[#0d1729] px-3.5 text-xs shadow-none hover:bg-[#1f2937]"><Plus className="size-4" /><span className="hidden sm:inline">Nova demanda</span><span className="sm:hidden">Nova</span></Button>
            <span className="hidden size-9 place-items-center rounded-full bg-[#0d1729] text-[10px] font-semibold text-white sm:grid">EV</span>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1680px] flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-6" style={{ minHeight: "calc(100vh - 64px)" }}>
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_2px_12px_-8px_rgba(15,23,42,0.14)] sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"><span className="size-1.5 rounded-full bg-[#4f46e5]" /> Visão operacional</p>
                <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.045em] text-[#111827] sm:text-[32px]">Minha Semana</h1>
                <p className="mt-1 text-xs text-slate-500">{format(weekStart, "dd 'a'", { locale: ptBR })} {format(weekEnd, "dd 'de' MMMM, yyyy", { locale: ptBR })} · Organize as entregas no seu ritmo</p>
              </div>

              <div className="w-full rounded-2xl bg-[#f0f1ff] px-4 py-3 lg:w-[320px]">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600"><span>Progresso da semana</span><strong className="font-semibold tabular-nums text-[#111827]">{completedCount}/{tasksInWeek.length} ({progress}%)</strong></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#111827] transition-all" style={{ width: `${progress}%` }} /></div>
                <p className="mt-2 text-[10px] text-slate-400">{tasksInWeek.length - completedCount} demandas ainda em andamento</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="week-board-scroll flex max-w-full gap-1 overflow-x-auto pb-0.5" aria-label="Filtrar por status">
                {statusOptions.map((option) => (
                  <button key={option.value} type="button" onClick={() => setStatusFilter(option.value)} className={cn("h-7 shrink-0 rounded-full px-3 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900", statusFilter === option.value && "bg-[#111827] text-white shadow-sm hover:bg-[#111827] hover:text-white")}>{option.label}</button>
                ))}
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <div className="relative min-w-[150px] flex-1 sm:flex-none">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar demandas" className="h-8 rounded-lg bg-[#f7f8fc] pl-8 text-xs shadow-none sm:w-[170px]" />
                </div>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-8 min-w-[132px] flex-1 rounded-lg bg-[#f7f8fc] text-xs shadow-none sm:flex-none"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{CLIENTS.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex h-8 items-center rounded-lg bg-[#f1f2f8] p-0.5" aria-label="Modo de visualização">
                  <button type="button" onClick={() => setViewMode("week")} className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-500 transition", viewMode === "week" && "bg-white text-slate-900 shadow-sm")}><CalendarDays className="size-3.5" /> Semana</button>
                  <button type="button" onClick={() => setViewMode("clients")} className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-500 transition", viewMode === "clients" && "bg-white text-slate-900 shadow-sm")}><UsersRound className="size-3.5" /> Clientes</button>
                </div>
                <button type="button" onClick={() => setShowWeekend((current) => !current)} aria-pressed={showWeekend} className={cn("flex h-8 items-center gap-1.5 rounded-lg bg-[#f1f2f8] px-2.5 text-[11px] font-medium text-slate-500 transition", showWeekend && "bg-[#e9e7ff] text-[#4f46e5]")}><span className={cn("relative h-3.5 w-6 rounded-full bg-slate-300 transition", showWeekend && "bg-[#4f46e5]")}><span className={cn("absolute left-0.5 top-0.5 size-2.5 rounded-full bg-white transition", showWeekend && "translate-x-2.5")} /></span>Fim de semana</button>
                {hasActiveFilters && <button type="button" onClick={clearFilters} className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Limpar filtros"><X className="size-3.5" /></button>}
              </div>
            </div>
          </section>

          {inboxOpen && (
            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_16px_-10px_rgba(15,23,42,0.2)]" aria-label="Caixa de Entrada">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Caixa de Entrada</h2>
                  <p className="text-xs text-slate-400">Arraste uma demanda para um dia da semana.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => openNewTask(null)} className="text-[#674bdd]"><Plus /> Capturar</Button>
              </div>
              {inboxTasks.length > 0 ? (
                <div className="week-board-scroll flex gap-2 overflow-x-auto pb-1">
                  {inboxTasks.map((task) => (
                    <div key={task.id} className="w-[240px] shrink-0">
                      <TaskCard task={task} onOpen={() => openTask(task)} onToggleComplete={() => handleToggleComplete(task.id)} onDuplicate={() => handleDuplicate(task.id)} onArchive={() => handleArchive(task.id)} />
                    </div>
                  ))}
                </div>
              ) : (
                <button type="button" onClick={() => openNewTask(null)} className="flex h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-slate-400 transition hover:border-[#a998ef] hover:text-[#684be6]"><Plus className="size-4" /> Capturar uma demanda sem data</button>
              )}
            </section>
          )}

          <div className="mt-2 min-h-0 flex-1">
            <WeekBoard
              weekStart={weekStart}
              tasks={filteredTasks}
              viewMode={viewMode}
              showWeekend={showWeekend}
              onCreate={openNewTask}
              onOpen={openTask}
              onMove={handleMove}
              onChangeClient={handleChangeClient}
              onToggleComplete={handleToggleComplete}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
            />
          </div>

          <div className="mt-2 hidden items-center justify-between px-3 pb-2 text-[10px] text-slate-400 lg:flex">
            <span className="flex items-center gap-3"><span><kbd className="mr-1 rounded bg-[#eceef7] px-1.5 py-0.5 text-slate-600">N</kbd>Nova demanda</span><span>Arraste cartões entre as colunas</span></span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-teal-500" /> Salvo neste navegador</span>
          </div>
        </div>
      </main>

      <TaskSheet key={`${sheetOpen ? "open" : "closed"}-${selectedTask?.id ?? "new"}-${initialDate ?? "inbox"}-${initialTime}-${initialClientId ?? "none"}`} open={sheetOpen} onOpenChange={setSheetOpen} task={selectedTask} initialDate={initialDate} initialTime={initialTime} initialClientId={initialClientId} clients={CLIENTS} onSave={saveTask} onArchive={handleArchive} />
      <WeekiCommandPalette open={commandOpen} onOpenChange={setCommandOpen} tasks={tasks} onCreate={openNewTask} onOpenTask={openTask} onToday={() => setWeekStart(initialWeek())} />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
