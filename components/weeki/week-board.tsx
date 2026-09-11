"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListTodo,
  Plus,
  Timer,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Client } from "@/features/clients/types";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/types";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

export type WeekViewMode = "week" | "clients";
export type WeekLayoutMode = "board" | "kanban" | "list" | "calendar" | "table";
export const WEEK_LAYOUTS: WeekLayoutMode[] = ["kanban", "board", "list", "calendar", "table"];

const STATUS_ORDER: TaskStatus[] = ["not_started", "in_progress", "waiting", "review", "completed"];

const STATUS_PILL: Record<TaskStatus, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-violet-50 text-violet-700",
  waiting: "bg-amber-50 text-amber-700",
  review: "bg-sky-50 text-sky-700",
  completed: "bg-emerald-50 text-emerald-700",
};

const PRIORITY_PILL: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-[#f1efff] text-[#5b45dc]",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-rose-50 text-rose-700",
};

const sortByTime = (a: Task, b: Task) => {
  if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
  if (a.scheduledTime) return -1;
  if (b.scheduledTime) return 1;
  return a.createdAt.localeCompare(b.createdAt);
};

const sortByDateAndTime = (a: Task, b: Task) => {
  const dateComparison = (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "");
  return dateComparison || sortByTime(a, b);
};

const isOverdue = (task: Task, todayKey: string) =>
  Boolean(task.dueDate && task.dueDate < todayKey && task.status !== "completed");

const formatEstimate = (minutes: number) => {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h${remainder.toString().padStart(2, "0")}` : `${hours}h`;
};

type BoardColumn = {
  id: string;
  title: string;
  dateLabel?: string;
  longDateLabel?: string;
  dateKey?: string;
  clientId?: string | null;
  clientColor?: string;
  tasks: Task[];
  isToday?: boolean;
};

type WeekBoardProps = {
  weekStart: Date;
  tasks: Task[];
  clients: Client[];
  viewMode: WeekViewMode;
  layoutMode: WeekLayoutMode;
  showWeekend: boolean;
  onCreate: (date: string | null, time?: string, clientId?: string | null) => void;
  onOpen: (task: Task) => void;
  onMove: (taskId: string, date: string, time?: string) => void;
  onChangeClient: (taskId: string, clientId: string | null) => void;
  onChangeStatus: (taskId: string, status: TaskStatus) => void;
  onChangePriority: (taskId: string, priority: TaskPriority) => void;
  onToggleComplete: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
};

export function WeekSummary({ tasks, todayKey }: { tasks: Task[]; todayKey: string }) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const overdue = tasks.filter((task) => isOverdue(task, todayKey)).length;
  const inProgress = tasks.filter((task) => task.status === "in_progress" || task.status === "review").length;
  const minutes = tasks.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const cards = [
    { label: "Demandas", value: String(total), detail: "nesta visão", icon: ListTodo, tone: "text-[#5b45dc] bg-[#efedff]" },
    { label: "Concluídas", value: `${completed}`, detail: `${progress}% da semana`, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Em curso", value: String(inProgress), detail: "andamento e revisão", icon: Clock3, tone: "text-sky-600 bg-sky-50" },
    { label: "Atrasadas", value: String(overdue), detail: overdue ? "requerem atenção" : "nenhum atraso", icon: AlertTriangle, tone: overdue ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-100" },
    { label: "Esforço", value: minutes ? formatEstimate(minutes) : "—", detail: "tempo estimado", icon: Timer, tone: "text-amber-600 bg-amber-50" },
  ];

  return (
    <section className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo da semana">
      {cards.map((card) => (
        <article key={card.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", card.tone)}>
            <card.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className="truncate text-lg font-semibold tracking-tight text-slate-900">{card.value}</p>
            <p className="truncate text-xs text-slate-400">{card.detail}</p>
          </div>
        </article>
      ))}
      <div className="sm:col-span-2 xl:col-span-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-[#6954e8] to-[#21b6a8]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}

export function WeekBoard({
  weekStart,
  tasks,
  clients,
  viewMode,
  layoutMode,
  showWeekend,
  onCreate,
  onOpen,
  onMove,
  onChangeClient,
  onChangeStatus,
  onChangePriority,
  onToggleComplete,
  onDuplicate,
  onArchive,
}: WeekBoardProps) {
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const columns = useMemo<BoardColumn[]>(() => {
    if (viewMode === "clients") {
      const clientColumns: BoardColumn[] = clients.map((client) => ({
        id: `client-${client.id}`,
        title: client.name,
        clientId: client.id,
        clientColor: client.color,
        tasks: tasks.filter((task) => task.clientId === client.id).sort(sortByDateAndTime),
      }));
      const withoutClient = tasks.filter((task) => !task.clientId).sort(sortByDateAndTime);
      if (withoutClient.length) clientColumns.push({ id: "client-none", title: "Sem cliente", clientId: null, tasks: withoutClient });
      return clientColumns;
    }

    const days = layoutMode === "calendar" ? 7 : showWeekend ? 7 : 5;
    return Array.from({ length: days }, (_, index) => {
      const day = addDays(weekStart, index);
      const dateKey = format(day, "yyyy-MM-dd");
      const dayName = format(day, "EEEE", { locale: ptBR }).replace("-feira", "");
      return {
        id: `day-${dateKey}`,
        title: dayName,
        dateLabel: format(day, "dd"),
        longDateLabel: format(day, "dd 'de' MMMM", { locale: ptBR }),
        dateKey,
        tasks: tasks.filter((task) => task.scheduledDate === dateKey).sort(sortByTime),
        isToday: dateKey === todayKey,
      };
    });
  }, [clients, layoutMode, showWeekend, tasks, todayKey, viewMode, weekStart]);

  const cardProps = (task: Task) => ({
    task,
    clients,
    onOpen: () => onOpen(task),
    onToggleComplete: () => onToggleComplete(task.id),
    onDuplicate: () => onDuplicate(task.id),
    onArchive: () => onArchive(task.id),
  });

  const readTaskId = (event: React.DragEvent) => event.dataTransfer.getData("text/weeki-task");

  const handleColumnDrop = (event: React.DragEvent<HTMLDivElement>, column: BoardColumn) => {
    event.preventDefault();
    const taskId = readTaskId(event);
    if (!taskId) return;
    if (viewMode === "week" && column.dateKey) onMove(taskId, column.dateKey);
    if (viewMode === "clients") onChangeClient(taskId, column.clientId ?? null);
    setDragTarget(null);
  };

  const createForColumn = (column: BoardColumn) => {
    if (viewMode === "week") onCreate(column.dateKey ?? null);
    else onCreate(format(weekStart, "yyyy-MM-dd"), "", column.clientId ?? null);
  };

  const dropProps = (column: BoardColumn) => ({
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragTarget(column.id);
    },
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => handleColumnDrop(event, column),
  });

  if (layoutMode === "kanban") {
    return (
      <KanbanView
        tasks={tasks}
        dragTarget={dragTarget}
        setDragTarget={setDragTarget}
        weekStart={weekStart}
        onCreate={onCreate}
        onChangeStatus={onChangeStatus}
        onMove={onMove}
        cardProps={cardProps}
      />
    );
  }

  if (layoutMode === "calendar") {
    return (
      <CalendarView
        columns={columns}
        dragTarget={dragTarget}
        todayKey={todayKey}
        dropProps={dropProps}
        createForColumn={createForColumn}
        cardProps={cardProps}
        onCreate={onCreate}
      />
    );
  }

  if (layoutMode === "table") {
    return (
      <TableView
        tasks={[...tasks].sort(sortByDateAndTime)}
        clients={clients}
        todayKey={todayKey}
        onOpen={onOpen}
        onCreate={() => onCreate(format(weekStart, "yyyy-MM-dd"))}
        onChangeStatus={onChangeStatus}
        onChangePriority={onChangePriority}
        onToggleComplete={onToggleComplete}
      />
    );
  }

  if (layoutMode === "list") {
    return (
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]" aria-label={viewMode === "week" ? "Demandas da semana em lista" : "Demandas por cliente em lista"}>
        {columns.map((column) => (
          <div key={column.id} {...dropProps(column)} className={cn("border-b border-slate-200 last:border-b-0", dragTarget === column.id && "bg-[#f8f7ff]")}>
            <header className={cn("flex min-h-12 items-center gap-3 bg-slate-50/70 px-3.5 sm:px-4", column.isToday && "bg-[#f5f3ff]")}>
              {viewMode === "clients" && (column.clientColor ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.clientColor }} /> : <UserRound className="size-4 text-slate-400" />)}
              <h2 className={cn("text-sm font-semibold capitalize text-slate-800", column.isToday && "text-[#4f46e5]")}>{column.title}</h2>
              {column.longDateLabel && <span className={cn("text-xs font-medium text-slate-400", column.isToday && "text-[#7771e9]")}>{column.longDateLabel}</span>}
              <span className="text-xs font-medium text-slate-400">{column.tasks.length} {column.tasks.length === 1 ? "demanda" : "demandas"}</span>
              <LoadMeter minutes={column.tasks.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0)} />
              <button type="button" onClick={() => createForColumn(column)} className="focus-ring ml-auto grid size-7 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-[#4f46e5]" aria-label={`Criar demanda em ${column.title}`}><Plus className="size-4" /></button>
            </header>
            {column.tasks.length ? column.tasks.map((task) => (
              <TaskCard key={task.id} {...cardProps(task)} variant="list" contextLabel={viewMode === "clients" && task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : undefined} />
            )) : (
              <button type="button" onClick={() => createForColumn(column)} className="flex h-12 w-full items-center justify-center gap-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-50 hover:text-[#5b46e8]"><Plus className="size-3.5" /> Adicionar demanda</button>
            )}
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="week-board-scroll overflow-x-auto pb-2" aria-label={viewMode === "week" ? "Demandas da semana em painel" : "Demandas por cliente em painel"}>
      <div className="week-columns" style={{ "--weeki-column-count": columns.length } as React.CSSProperties}>
        {columns.map((column) => (
          <div
            key={column.id}
            {...dropProps(column)}
            className={cn(
              "group/column flex min-h-[540px] flex-col rounded-lg border border-slate-200/90 bg-white/60 p-3 transition-colors hover:bg-white/85",
              column.isToday && "border-[#d5ceff] bg-[#f6f5ff] ring-1 ring-[#645efb]/10",
              dragTarget === column.id && "border-[#b8adff] bg-[#f5f3ff]",
            )}
          >
            <header className={cn("mb-3 flex min-h-9 items-start border-b border-slate-100 pb-3", column.isToday && "border-[#e4e0ff]")}>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {viewMode === "clients" && (column.clientColor ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.clientColor }} /> : <UserRound className="size-4 shrink-0 text-slate-400" />)}
                <h2 className={cn("truncate text-sm font-semibold capitalize tracking-tight text-slate-900", column.isToday && "text-[#4f46e5]")}>{column.title}</h2>
                {column.dateLabel && <span className={cn("text-xs font-semibold tabular-nums text-slate-400", column.isToday && "text-[#7168eb]")}>{column.dateLabel}</span>}
                {column.isToday && <span className="size-1.5 shrink-0 rounded-full bg-[#4f46e5]" aria-label="Hoje" />}
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-500">{column.tasks.length}</span>
              </div>
              <button type="button" onClick={() => createForColumn(column)} className={cn("focus-ring grid size-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-[#f1efff] hover:text-[#4f46e5]", column.isToday && "text-[#6a5ce4]")} aria-label={`Criar demanda em ${column.title}`}><Plus className="size-4" /></button>
            </header>

            <div className="space-y-2.5">
              {column.tasks.map((task) => (
                <TaskCard key={task.id} {...cardProps(task)} contextLabel={viewMode === "clients" && task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : undefined} />
              ))}
              {!column.tasks.length && (
                <button type="button" onClick={() => createForColumn(column)} className="flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 text-center text-xs text-slate-400 opacity-100 transition hover:border-slate-300 hover:bg-white/60 hover:text-foreground md:border-transparent md:opacity-0 md:group-hover/column:opacity-100 focus:opacity-100"><Plus className="mr-1.5 size-3.5" /> Adicionar demanda</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function KanbanView({
  tasks,
  dragTarget,
  setDragTarget,
  weekStart,
  onCreate,
  onChangeStatus,
  onMove,
  cardProps,
}: {
  tasks: Task[];
  dragTarget: string | null;
  setDragTarget: (id: string | null) => void;
  weekStart: Date;
  onCreate: (date: string | null) => void;
  onChangeStatus: (taskId: string, status: TaskStatus) => void;
  onMove: (taskId: string, date: string, time?: string) => void;
  cardProps: (task: Task) => {
    task: Task;
    clients: Client[];
    onOpen: () => void;
    onToggleComplete: () => void;
    onDuplicate: () => void;
    onArchive: () => void;
  };
}) {
  return (
    <section className="week-board-scroll overflow-x-auto pb-2" aria-label="Kanban por status">
      <div className="week-columns" style={{ "--weeki-column-count": STATUS_ORDER.length } as React.CSSProperties}>
        {STATUS_ORDER.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status).sort(sortByDateAndTime);
          const columnId = `status-${status}`;
          return (
            <div
              key={status}
              onDragOver={(event) => { event.preventDefault(); setDragTarget(columnId); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null); }}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/weeki-task");
                if (taskId) {
                  onChangeStatus(taskId, status);
                  const dropped = tasks.find((task) => task.id === taskId);
                  if (dropped && !dropped.scheduledDate) onMove(taskId, format(weekStart, "yyyy-MM-dd"));
                }
                setDragTarget(null);
              }}
              className={cn(
                "group/column flex min-h-[540px] flex-col rounded-lg border border-slate-200/90 bg-white p-3",
                dragTarget === columnId && "border-[#b8adff] bg-[#f5f3ff]",
              )}
            >
              <header className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{STATUS_LABELS[status]}</h2>
                <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", STATUS_PILL[status])}>{columnTasks.length}</span>
                <button type="button" onClick={() => onCreate(format(weekStart, "yyyy-MM-dd"))} className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-[#f1efff] hover:text-[#4f46e5]" aria-label={`Nova demanda em ${STATUS_LABELS[status]}`}>
                  <Plus className="size-4" />
                </button>
              </header>
              <div className="space-y-2.5">
                {columnTasks.map((task) => (
                  <div key={task.id} className="relative">
                    <TaskCard
                      {...cardProps(task)}
                      contextLabel={task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : "Sem data"}
                    />
                  </div>
                ))}
                {!columnTasks.length && (
                  <button type="button" onClick={() => onCreate(format(weekStart, "yyyy-MM-dd"))} className="flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 hover:border-slate-300">
                    <Plus className="mr-1.5 size-3.5" /> Mover ou criar aqui
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CalendarView({
  columns,
  dragTarget,
  todayKey,
  dropProps,
  createForColumn,
  cardProps,
  onCreate,
}: {
  columns: BoardColumn[];
  dragTarget: string | null;
  todayKey: string;
  dropProps: (column: BoardColumn) => {
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  };
  createForColumn: (column: BoardColumn) => void;
  cardProps: (task: Task) => {
    task: Task;
    clients: Client[];
    onOpen: () => void;
    onToggleComplete: () => void;
    onDuplicate: () => void;
    onArchive: () => void;
  };
  onCreate: (date: string | null, time?: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Calendário da semana">
      <div className="grid grid-cols-1 md:grid-cols-7">
        {columns.map((column) => (
          <div
            key={column.id}
            {...dropProps(column)}
            className={cn(
              "flex min-h-[420px] flex-col border-b border-slate-100 p-3 md:border-b-0 md:border-r md:last:border-r-0",
              column.isToday && "bg-[#f8f7ff]",
              dragTarget === column.id && "bg-[#f3f0ff]",
            )}
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className={cn("text-xs font-semibold uppercase tracking-wide text-slate-400", column.isToday && "text-[#6a5ce4]")}>{column.title}</p>
                <p className={cn("text-xl font-semibold tabular-nums text-slate-800", column.isToday && "text-[#4f46e5]")}>{column.dateLabel}</p>
              </div>
              <button type="button" onClick={() => createForColumn(column)} className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-[#4f46e5]" aria-label={`Criar em ${column.title}`}>
                <Plus className="size-4" />
              </button>
            </header>
            <div className="space-y-2">
              {column.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/weeki-task", task.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => cardProps(task).onOpen()}
                  className={cn(
                    "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-[#c9c2ff]",
                    task.status === "completed" && "opacity-60",
                    isOverdue(task, todayKey) && "border-rose-200 bg-rose-50/50",
                  )}
                >
                  <p className="truncate text-xs font-semibold text-slate-800">{task.title}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    {task.scheduledTime || "Sem horário"}
                    <span className={cn("rounded px-1.5 py-0.5 font-medium", STATUS_PILL[task.status])}>{STATUS_LABELS[task.status]}</span>
                  </p>
                </button>
              ))}
              {!column.tasks.length && (
                <button type="button" onClick={() => column.dateKey && onCreate(column.dateKey)} className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 hover:border-slate-300">
                  Livre
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TableView({
  tasks,
  clients,
  todayKey,
  onOpen,
  onCreate,
  onChangeStatus,
  onChangePriority,
  onToggleComplete,
}: {
  tasks: Task[];
  clients: Client[];
  todayKey: string;
  onOpen: (task: Task) => void;
  onCreate: () => void;
  onChangeStatus: (taskId: string, status: TaskStatus) => void;
  onChangePriority: (taskId: string, priority: TaskPriority) => void;
  onToggleComplete: (taskId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<"date" | "title" | "status" | "priority">("date");
  const sorted = [...tasks].sort((a, b) => {
    if (sortKey === "title") return a.title.localeCompare(b.title, "pt-BR");
    if (sortKey === "status") return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (sortKey === "priority") return ["urgent", "high", "medium", "low"].indexOf(a.priority) - ["urgent", "high", "medium", "low"].indexOf(b.priority);
    return sortByDateAndTime(a, b);
  });

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Tabela de demandas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">{tasks.length} demandas</p>
        <div className="flex items-center gap-2">
          <Select value={sortKey} onValueChange={(value) => setSortKey(value as typeof sortKey)}>
            <SelectTrigger className="h-8 w-[160px] rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Ordenar por data</SelectItem>
              <SelectItem value="title">Ordenar por título</SelectItem>
              <SelectItem value="status">Ordenar por status</SelectItem>
              <SelectItem value="priority">Ordenar por prioridade</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={onCreate}><Plus className="size-3.5" /> Nova demanda</Button>
        </div>
      </div>
      {sorted.length ? (
        <>
          <div className="week-board-scroll hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3">Demanda</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3 text-right">Estimativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((task) => {
                  const client = clients.find((item) => item.id === task.clientId);
                  return (
                    <tr key={task.id} className={cn("text-sm text-slate-600 transition hover:bg-slate-50/80", isOverdue(task, todayKey) && "bg-rose-50/40")}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={task.status === "completed"}
                          onChange={() => onToggleComplete(task.id)}
                          className="size-4 accent-[#5b45dc]"
                          aria-label={task.status === "completed" ? "Reabrir demanda" : "Concluir demanda"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => onOpen(task)} className="block max-w-[280px] truncate text-left font-semibold text-slate-800 hover:text-[#5b45dc]">
                          {task.title}
                        </button>
                        {isOverdue(task, todayKey) && <p className="mt-0.5 text-xs font-medium text-rose-600">Vencida em {format(parseISO(task.dueDate), "dd MMM", { locale: ptBR })}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {client ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: client.color }} />
                            {client.name}
                          </span>
                        ) : <span className="text-xs text-slate-400">Sem cliente</span>}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : "Inbox"}
                        {task.scheduledTime ? ` · ${task.scheduledTime}` : ""}
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <Select value={task.status} onValueChange={(value) => onChangeStatus(task.id, value as TaskStatus)}>
                          <SelectTrigger className="h-8 w-[170px] rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <Select value={task.priority} onValueChange={(value) => onChangePriority(task.id, value as TaskPriority)}>
                          <SelectTrigger className="h-8 w-[120px] rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
                          <SelectContent>{(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((priority) => <SelectItem key={priority} value={priority}>{PRIORITY_LABELS[priority]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-500">{task.estimateMinutes ? formatEstimate(task.estimateMinutes) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {sorted.map((task) => {
              const client = clients.find((item) => item.id === task.clientId);
              return (
                <button key={task.id} type="button" onClick={() => onOpen(task)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{task.title}</span>
                    <span className="mt-1 block text-xs text-slate-400">{client?.name ?? "Sem cliente"} · {task.scheduledDate ? format(parseISO(task.scheduledDate), "dd MMM", { locale: ptBR }) : "Inbox"}</span>
                    <span className="mt-2 flex gap-1.5">
                      <span className={cn("rounded px-1.5 py-0.5 text-xs", STATUS_PILL[task.status])}>{STATUS_LABELS[task.status]}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-xs", PRIORITY_PILL[task.priority])}>{PRIORITY_LABELS[task.priority]}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid min-h-56 place-items-center px-4 text-center">
          <div>
            <ListTodo className="mx-auto size-7 text-slate-300" />
            <h2 className="mt-3 text-sm font-semibold text-slate-700">Nenhuma demanda nesta visão</h2>
            <p className="mt-1 text-xs text-slate-400">Crie uma demanda ou ajuste os filtros da semana.</p>
            <Button type="button" size="sm" onClick={onCreate} className="mt-4"><Plus className="size-3.5" /> Nova demanda</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function LoadMeter({ minutes }: { minutes: number }) {
  if (!minutes) return null;
  return <span className="hidden rounded-md bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500 sm:inline">{formatEstimate(minutes)}</span>;
}

export function isWeekLayoutMode(value: string | null): value is WeekLayoutMode {
  return Boolean(value && WEEK_LAYOUTS.includes(value as WeekLayoutMode));
}
