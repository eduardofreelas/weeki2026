"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, UserRound } from "lucide-react";
import { CLIENTS } from "@/features/tasks/seed";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

export type WeekViewMode = "week" | "clients";
export type WeekLayoutMode = "board" | "list";

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

export function WeekBoard({
  weekStart,
  tasks,
  viewMode,
  layoutMode,
  showWeekend,
  onCreate,
  onOpen,
  onMove,
  onChangeClient,
  onToggleComplete,
  onDuplicate,
  onArchive,
}: {
  weekStart: Date;
  tasks: Task[];
  viewMode: WeekViewMode;
  layoutMode: WeekLayoutMode;
  showWeekend: boolean;
  onCreate: (date: string | null, time?: string, clientId?: string | null) => void;
  onOpen: (task: Task) => void;
  onMove: (taskId: string, date: string, time?: string) => void;
  onChangeClient: (taskId: string, clientId: string | null) => void;
  onToggleComplete: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
}) {
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const columns = useMemo<BoardColumn[]>(() => {
    if (viewMode === "clients") {
      const clientColumns: BoardColumn[] = CLIENTS.map((client) => ({
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

    return Array.from({ length: showWeekend ? 7 : 5 }, (_, index) => {
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
  }, [showWeekend, tasks, todayKey, viewMode, weekStart]);

  const cardProps = (task: Task) => ({
    task,
    onOpen: () => onOpen(task),
    onToggleComplete: () => onToggleComplete(task.id),
    onDuplicate: () => onDuplicate(task.id),
    onArchive: () => onArchive(task.id),
  });

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, column: BoardColumn) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/weeki-task");
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
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragTarget(column.id); },
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => handleDrop(event, column),
  });

  if (layoutMode === "list") {
    return (
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]" aria-label={viewMode === "week" ? "Demandas da semana em lista" : "Demandas por cliente em lista"}>
        {columns.map((column) => (
          <div key={column.id} {...dropProps(column)} className={cn("border-b border-slate-200 last:border-b-0", dragTarget === column.id && "bg-[#f8f7ff]")}>
            <header className={cn("flex min-h-12 items-center gap-3 bg-slate-50/70 px-3.5 sm:px-4", column.isToday && "bg-[#f5f3ff]")}>
              {viewMode === "clients" && (column.clientColor ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.clientColor }} /> : <UserRound className="size-4 text-slate-400" />)}
              <h2 className={cn("text-xs font-bold capitalize text-slate-800", column.isToday && "text-[#4f46e5]")}>{column.title}</h2>
              {column.longDateLabel && <span className={cn("text-[11px] font-medium text-slate-400", column.isToday && "text-[#7771e9]")}>{column.longDateLabel}</span>}
              <span className="text-[10px] font-medium text-slate-400">{column.tasks.length} {column.tasks.length === 1 ? "demanda" : "demandas"}</span>
              <button type="button" onClick={() => createForColumn(column)} className="focus-ring ml-auto grid size-7 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-[#4f46e5]" aria-label={`Criar demanda em ${column.title}`}><Plus className="size-4" /></button>
            </header>
            {column.tasks.length ? column.tasks.map((task) => (
              <TaskCard key={task.id} {...cardProps(task)} variant="list" contextLabel={viewMode === "clients" && task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : undefined} />
            )) : (
              <button type="button" onClick={() => createForColumn(column)} className="flex h-12 w-full items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-50 hover:text-[#5b46e8]"><Plus className="size-3.5" /> Adicionar demanda</button>
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
              "group/column flex min-h-[540px] flex-col rounded-[14px] border border-slate-200/90 bg-white/60 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.025)] transition-colors hover:bg-white/85",
              column.isToday && "border-[#d5ceff] bg-[#f6f5ff] ring-1 ring-[#645efb]/10",
              dragTarget === column.id && "border-[#b8adff] bg-[#f5f3ff]",
            )}
          >
            <header className={cn("mb-3 flex min-h-9 items-start border-b border-slate-100 pb-3", column.isToday && "border-[#e4e0ff]")}>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {viewMode === "clients" && (column.clientColor ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.clientColor }} /> : <UserRound className="size-4 shrink-0 text-slate-400" />)}
                <h2 className={cn("truncate text-xs font-bold capitalize tracking-[-0.01em] text-slate-900", column.isToday && "text-[#4f46e5]")}>{column.title}</h2>
                {column.dateLabel && <span className={cn("text-xs font-semibold tabular-nums text-slate-400", column.isToday && "text-[#7168eb]")}>{column.dateLabel}</span>}
                {column.isToday && <span className="size-1.5 shrink-0 rounded-full bg-[#4f46e5]" aria-label="Hoje" />}
              </div>
              <button type="button" onClick={() => createForColumn(column)} className={cn("focus-ring grid size-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-[#f1efff] hover:text-[#4f46e5]", column.isToday && "text-[#6a5ce4]")} aria-label={`Criar demanda em ${column.title}`}><Plus className="size-3.5" /></button>
            </header>

            <div className="space-y-2.5">
              {column.tasks.map((task) => (
                <TaskCard key={task.id} {...cardProps(task)} contextLabel={viewMode === "clients" && task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : undefined} />
              ))}
              {!column.tasks.length && (
                <button type="button" onClick={() => createForColumn(column)} className="flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-transparent px-3 text-center text-[11px] text-slate-300 opacity-0 transition hover:border-slate-200 hover:bg-white/60 hover:text-[#5b46e8] group-hover/column:opacity-100 focus:opacity-100"><Plus className="mr-1.5 size-3.5" /> Adicionar demanda</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
