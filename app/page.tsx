"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, endOfWeek, format, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Inbox,
  PanelTop,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { WeekiCommandPalette } from "@/components/weeki/command-palette";
import { MobileNavigation, WeekiSidebar } from "@/components/weeki/sidebar";
import { TaskSheet } from "@/components/weeki/task-sheet";
import { WeekBoard } from "@/components/weeki/week-board";
import { CLIENTS } from "@/features/tasks/seed";
import { STATUS_LABELS, type Task, type TaskDraft, type TaskStatus } from "@/features/tasks/types";
import { useWeekiTasks } from "@/features/tasks/use-weeki-tasks";

const initialWeek = () => startOfWeek(new Date(), { weekStartsOn: 1 });

export default function Home() {
  const { tasks, addTask, updateTask, moveTask, toggleComplete, duplicateTask, archiveTask } = useWeekiTasks();
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [showWeekend, setShowWeekend] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekEndVisible = addDays(weekStart, showWeekend ? 6 : 4);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        setSelectedTask(null);
        setInitialDate(todayKey);
        setSheetOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [todayKey]);

  useEffect(() => setMounted(true), []);

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
  const completed = tasksInWeek.filter((task) => task.status === "completed").length;
  const openCount = tasksInWeek.length - completed;
  const dueToday = tasks.filter((task) => task.dueDate === todayKey && task.status !== "completed").length;
  const overdue = tasks.filter((task) => task.dueDate && task.dueDate < todayKey && task.status !== "completed").length;
  const progress = tasksInWeek.length ? Math.round((completed / tasksInWeek.length) * 100) : 0;

  const openNewTask = (date: string | null) => {
    setSelectedTask(null);
    setInitialDate(date);
    setSheetOpen(true);
  };

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setInitialDate(task.scheduledDate);
    setSheetOpen(true);
  };

  const saveTask = (draft: TaskDraft, taskId?: string) => {
    if (taskId) {
      updateTask(taskId, draft);
      toast.success("Demanda atualizada.");
    } else {
      addTask(draft);
      toast.success(draft.scheduledDate ? "Demanda adicionada à semana." : "Demanda salva na Caixa de Entrada.");
    }
  };

  const handleMove = (taskId: string, date: string) => {
    moveTask(taskId, date);
    toast.success("Demanda movida.");
  };

  const handleDuplicate = (taskId: string) => {
    duplicateTask(taskId);
    toast.success("Demanda duplicada.");
  };

  const handleArchive = (taskId: string) => {
    archiveTask(taskId);
    toast.success("Demanda arquivada.");
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
    <div className="min-h-screen bg-[#f6f7fb]">
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
            <button onClick={() => setCommandOpen(true)} className="focus-ring hidden h-9 min-w-[240px] items-center gap-2 rounded-xl border bg-[#f8f8fa] px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white lg:flex">
              <Search className="size-4" /><span className="flex-1">Buscar no Weeki</span><kbd className="rounded-md border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">Ctrl K</kbd>
            </button>
            <button onClick={() => setCommandOpen(true)} className="focus-ring grid size-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 lg:hidden" aria-label="Buscar"><Search className="size-[18px]" /></button>
            <button className="focus-ring relative grid size-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100" aria-label="Notificações"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#7657ff] ring-2 ring-white" /></button>
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#202026] to-[#3a3a45] text-xs font-semibold text-white">EV</span>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1760px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-7" style={{ minHeight: "calc(100vh - 68px)" }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#7158e7]"><Sparkles className="size-3.5" /> PLANEJAMENTO SEMANAL</div>
              <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[#1d1d23] sm:text-[32px]">Minha Semana</h1>
              <p className="mt-1 text-sm text-slate-500">
                {format(weekStart, "dd 'de' MMMM", { locale: ptBR })} — {format(weekEndVisible, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => openNewTask(null)} className="bg-white"><Inbox /> Capturar ideia</Button>
              <Button onClick={() => openNewTask(todayKey)} className="bg-gradient-to-r from-[#7657ff] to-[#356fd7] px-5 shadow-[0_8px_22px_rgba(103,77,225,0.2)] hover:opacity-90"><Plus /> Criar demanda</Button>
            </div>
          </div>

          <section className="mt-5 grid gap-3 md:grid-cols-[1.45fr_1fr_1fr_1fr]" aria-label="Resumo da semana">
            <div className="flex min-h-[92px] items-center gap-4 rounded-2xl border bg-[#17171c] px-5 text-white shadow-[0_10px_28px_rgba(20,20,28,0.08)]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"><Target className="size-5 text-[#a995ff]" /></span>
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><p className="text-xs font-medium text-white/55">Progresso da semana</p><p className="text-sm font-semibold">{progress}%</p></div><Progress value={progress} className="mt-2 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-[#8b70ff] [&_[data-slot=progress-indicator]]:to-[#438cf1]" /><p className="mt-2 text-[11px] text-white/45">{completed} de {tasksInWeek.length} demandas concluídas</p></div>
            </div>
            <div className="flex min-h-[92px] items-center gap-3 rounded-2xl border bg-white px-4"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><PanelTop className="size-[18px]" /></span><div><p className="text-[11px] font-medium text-slate-400">Em aberto</p><p className="mt-0.5 text-xl font-semibold tracking-tight text-slate-800">{openCount}</p></div></div>
            <div className="flex min-h-[92px] items-center gap-3 rounded-2xl border bg-white px-4"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><Target className="size-[18px]" /></span><div><p className="text-[11px] font-medium text-slate-400">Vencem hoje</p><p className="mt-0.5 text-xl font-semibold tracking-tight text-slate-800">{dueToday}</p></div></div>
            <button onClick={() => openNewTask(null)} className="flex min-h-[92px] items-center gap-3 rounded-2xl border bg-white px-4 text-left transition hover:border-[#bdb1f2] hover:shadow-sm"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Inbox className="size-[18px]" /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-slate-400">Caixa de Entrada</p><p className="mt-0.5 text-xl font-semibold tracking-tight text-slate-800">{inboxTasks.length}</p></div>{overdue > 0 && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600">{overdue} atrasadas</span>}</button>
          </section>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-xl border bg-white p-1 shadow-sm">
              <button onClick={() => setWeekStart((current) => addWeeks(current, -1))} className="focus-ring grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Semana anterior"><ChevronLeft className="size-4" /></button>
              <button onClick={() => setWeekStart(initialWeek())} className="focus-ring h-8 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">Hoje</button>
              <button onClick={() => setWeekStart((current) => addWeeks(current, 1))} className="focus-ring grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Próxima semana"><ChevronRight className="size-4" /></button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[190px] flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar demandas..." className="h-10 bg-white pl-9 shadow-sm sm:w-[210px]" />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}>
                <SelectTrigger className="h-10 min-w-[132px] bg-white shadow-sm"><SlidersHorizontal className="size-4" /><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-10 min-w-[122px] bg-white shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{CLIENTS.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
              </Select>
              <label className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-medium text-slate-600 shadow-sm"><Switch checked={showWeekend} onCheckedChange={setShowWeekend} /> Fim de semana</label>
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1">
            <WeekBoard
              weekStart={weekStart}
              tasks={filteredTasks}
              showWeekend={showWeekend}
              onCreate={openNewTask}
              onOpen={openTask}
              onMove={handleMove}
              onToggleComplete={toggleComplete}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
            />
          </div>
        </div>
      </main>

      <TaskSheet open={sheetOpen} onOpenChange={setSheetOpen} task={selectedTask} initialDate={initialDate} clients={CLIENTS} onSave={saveTask} onArchive={handleArchive} />
      <WeekiCommandPalette open={commandOpen} onOpenChange={setCommandOpen} tasks={tasks} onCreate={openNewTask} onOpenTask={openTask} onToday={() => setWeekStart(initialWeek())} />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
