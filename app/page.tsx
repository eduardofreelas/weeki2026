"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { addDays, addWeeks, format, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Inbox,
  LayoutList,
  Plus,
  Search,
  SlidersHorizontal,
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
import { WeekBoard, type WeekLayoutMode, type WeekViewMode } from "@/components/weeki/week-board";
import { CLIENTS } from "@/features/tasks/seed";
import { STATUS_LABELS, type Task, type TaskDraft, type TaskStatus } from "@/features/tasks/types";
import { useWeekiTasks } from "@/features/tasks/use-weeki-tasks";
import { cn } from "@/lib/utils";

const initialWeek = () => startOfWeek(new Date(), { weekStartsOn: 1 });
const subscribeToHydration = () => () => undefined;

export default function Home() {
  const { tasks, addTask, updateTask, moveTask, assignTaskClient, toggleComplete, duplicateTask, archiveTask } = useWeekiTasks();
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [viewMode, setViewMode] = useState<WeekViewMode>("week");
  const [layoutMode, setLayoutMode] = useState<WeekLayoutMode>(() => {
    if (typeof window === "undefined") return "board";
    const savedLayout = window.localStorage.getItem("weeki.week-layout.v1");
    return savedLayout === "list" ? "list" : "board";
  });
  const [showWeekend, setShowWeekend] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const [initialTime, setInitialTime] = useState("");
  const [initialClientId, setInitialClientId] = useState<string | null>(null);
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const changeLayoutMode = (mode: WeekLayoutMode) => {
    setLayoutMode(mode);
    window.localStorage.setItem("weeki.week-layout.v1", mode);
  };

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
    <div className="min-h-screen bg-[#f8fafc]">
      <WeekiSidebar inboxCount={inboxTasks.length} />
      <MobileNavigation />

      <main className="min-h-screen md:ml-[252px]">
        <header className="flex h-[68px] items-center border-b border-slate-200/80 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-[23px] font-semibold tracking-[-0.055em] text-[#17171c]">weeki</span>
            <span className="size-2 rounded-full bg-gradient-to-br from-[#8d6cff] to-[#2f80ed]" />
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-400 md:flex">
            <span>Planejamento</span><span>/</span><span className="font-medium text-slate-700">Minha Semana</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button onClick={() => setCommandOpen(true)} className="focus-ring hidden h-9 min-w-[240px] items-center gap-2 rounded-lg border bg-[#f8f8fa] px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white lg:flex">
              <Search className="size-4" /><span className="flex-1">Buscar no Weeki</span><kbd className="rounded-md border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">Ctrl K</kbd>
            </button>
            <button onClick={() => setCommandOpen(true)} className="focus-ring grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 lg:hidden" aria-label="Buscar"><Search className="size-[18px]" /></button>
            <button className="focus-ring relative grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100" aria-label="Notificações"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#7657ff] ring-2 ring-white" /></button>
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#202026] to-[#3a3a45] text-xs font-semibold text-white">EV</span>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1720px] flex-col px-4 py-4 sm:px-6 lg:px-8" style={{ minHeight: "calc(100vh - 68px)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-[23px] font-bold tracking-[-0.035em] text-slate-900 sm:text-[25px]">Minha Semana</h1>
                <span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-100 px-2 text-[11px] font-medium tabular-nums text-slate-600">
                  {format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setInboxOpen((current) => !current)} className={cn("rounded-lg bg-white px-3 shadow-sm", inboxOpen && "border-[#b9abf2] bg-[#f4f1ff] text-[#6548df]")}>
                <Inbox /><span className="hidden sm:inline">Caixa de Entrada</span><span className="sm:hidden">Caixa</span>
                {inboxTasks.length > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{inboxTasks.length}</span>}
              </Button>
              <Button size="sm" onClick={() => openNewTask(todayKey)} className="rounded-lg bg-[#4f46e5] px-3 shadow-[0_4px_12px_rgba(79,70,229,0.2)] hover:bg-[#4338ca] sm:px-4"><Plus /><span className="hidden sm:inline">Nova demanda</span><span className="sm:hidden">Nova</span></Button>
            </div>
          </div>

          <div className="week-board-scroll mt-4 flex items-center justify-between gap-3 overflow-x-auto border-y border-slate-200/80 bg-white py-2.5">
            <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
              <div className="flex w-fit items-center gap-0.5 rounded-lg border bg-slate-50 p-0.5 shadow-sm">
                <button onClick={() => setWeekStart((current) => addWeeks(current, -1))} className="focus-ring grid size-7 place-items-center rounded-md text-slate-500 hover:bg-white" aria-label="Semana anterior"><ChevronLeft className="size-4" /></button>
                <button onClick={() => setWeekStart(initialWeek())} className="focus-ring h-7 rounded-md px-2.5 text-xs font-semibold text-slate-700 hover:bg-white">Hoje</button>
                <button onClick={() => setWeekStart((current) => addWeeks(current, 1))} className="focus-ring grid size-7 place-items-center rounded-md text-slate-500 hover:bg-white" aria-label="Próxima semana"><ChevronRight className="size-4" /></button>
              </div>

              <div className="flex items-center rounded-lg border bg-slate-100 p-0.5" aria-label="Agrupar demandas por semana ou cliente">
                <button type="button" onClick={() => setViewMode("week")} className={cn("focus-ring flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition", viewMode === "week" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200/70")}><CalendarDays className="size-3" /> Semana</button>
                <button type="button" onClick={() => setViewMode("clients")} className={cn("focus-ring flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition", viewMode === "clients" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200/70")}><UsersRound className="size-3" /> Clientes</button>
              </div>

              <div className="flex items-center rounded-lg border bg-slate-100 p-0.5" aria-label="Layout das demandas">
                <button type="button" onClick={() => changeLayoutMode("board")} className={cn("focus-ring flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition", layoutMode === "board" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200/70")}><Columns3 className="size-3" /> Painel</button>
                <button type="button" onClick={() => changeLayoutMode("list")} className={cn("focus-ring flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition", layoutMode === "list" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200/70")}><LayoutList className="size-3" /> Lista</button>
              </div>

              <button type="button" onClick={() => setShowWeekend((current) => !current)} aria-pressed={showWeekend} className={cn("focus-ring flex h-7 items-center gap-1.5 rounded-lg border bg-white px-2 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-slate-300", showWeekend && "border-[#c9c2ff] bg-[#f5f3ff] text-[#4f46e5]")}>
                <span className={cn("relative h-4 w-7 rounded-full bg-slate-200 transition", showWeekend && "bg-[#7657ff]")}><span className={cn("absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow-sm transition", showWeekend && "translate-x-3")} /></span>
                Sáb e dom
              </button>
            </div>

            <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
              <div className="relative w-[170px] shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar demandas" className="h-7 rounded-lg bg-white pl-8 pr-2.5 text-[11px] shadow-sm" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setMobileFiltersOpen((current) => !current)} className="h-7 rounded-lg bg-white px-2 text-[11px] sm:hidden"><SlidersHorizontal /> Filtros</Button>
              <div className={cn("contents", !mobileFiltersOpen && "max-sm:hidden")}>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}>
                  <SelectTrigger className="h-7 w-[138px] shrink-0 rounded-lg bg-white px-2.5 text-[11px] shadow-sm"><SlidersHorizontal className="size-3" /><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-7 w-[132px] shrink-0 rounded-lg bg-white px-2.5 text-[11px] shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{CLIENTS.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {hasActiveFilters && <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-[11px] text-slate-400"><X /> Limpar</Button>}
            </div>
          </div>

          {inboxOpen && (
            <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_6px_24px_rgba(27,27,40,0.03)]" aria-label="Caixa de Entrada">
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
                <button type="button" onClick={() => openNewTask(null)} className="flex h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-slate-400 transition hover:border-[#a998ef] hover:text-[#684be6]"><Plus className="size-4" /> Capturar uma demanda sem data</button>
              )}
            </section>
          )}

          <div className="mt-3 min-h-0 flex-1">
            <WeekBoard
              weekStart={weekStart}
              tasks={filteredTasks}
              viewMode={viewMode}
              layoutMode={layoutMode}
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
        </div>
      </main>

      <TaskSheet key={`${sheetOpen ? "open" : "closed"}-${selectedTask?.id ?? "new"}-${initialDate ?? "inbox"}-${initialTime}-${initialClientId ?? "none"}`} open={sheetOpen} onOpenChange={setSheetOpen} task={selectedTask} initialDate={initialDate} initialTime={initialTime} initialClientId={initialClientId} clients={CLIENTS} onSave={saveTask} onArchive={handleArchive} />
      <WeekiCommandPalette open={commandOpen} onOpenChange={setCommandOpen} tasks={tasks} onCreate={openNewTask} onOpenTask={openTask} onToday={() => setWeekStart(initialWeek())} />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
