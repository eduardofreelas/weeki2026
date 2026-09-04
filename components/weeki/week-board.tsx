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
  dateNumber?: string;
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
      if (withoutClient.length) {
        clientColumns.push({ id: "client-none", title: "Sem cliente", clientId: null, tasks: withoutClient });
      }
      return clientColumns;
    }

    return Array.from({ length: showWeekend ? 7 : 5 }, (_, index) => {
      const day = addDays(weekStart, index);
      const dateKey = format(day, "yyyy-MM-dd");
      return {
        id: `day-${dateKey}`,
        title: format(day, "EEE", { locale: ptBR }).replace(".", "").toUpperCase(),
        dateNumber: format(day, "dd"),
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

  return (
    <section className="week-board-scroll snap-x snap-mandatory overflow-x-auto xl:snap-none" aria-label={viewMode === "week" ? "Demandas da semana" : "Demandas por cliente"}>
      <div className="week-columns" style={{ "--weeki-column-count": columns.length } as React.CSSProperties}>
        {columns.map((column) => (
          <div
            key={column.id}
            onDragOver={(event) => { event.preventDefault(); setDragTarget(column.id); }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
            }}
            onDrop={(event) => handleDrop(event, column)}
            className={cn(
              "group/column relative min-h-[470px] snap-start rounded-2xl border border-transparent bg-white/65 p-1.5 transition",
              column.isToday && "border-slate-300 bg-[#eef0ff]",
              dragTarget === column.id && "border-[#8275ee] bg-[#eceaff] shadow-[0_10px_28px_-16px_rgba(79,70,229,0.45)]",
            )}
          >
            <header className="sticky top-0 z-10 flex min-h-12 items-center rounded-xl bg-inherit px-2.5 py-2 backdrop-blur">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {viewMode === "clients" && (
                  column.clientColor
                    ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.clientColor }} />
                    : <span className="grid size-5 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400"><UserRound className="size-3" /></span>
                )}
                <h2 className={cn("truncate text-[11px] font-semibold tracking-[0.04em] text-slate-600", column.isToday && "text-[#4f46e5]", viewMode === "clients" && "text-xs normal-case tracking-normal text-slate-700")}>{column.title}</h2>
                {column.dateNumber && <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#172033]">{column.dateNumber}</span>}
                {column.isToday && <span className="rounded-md bg-[#111827] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">Hoje</span>}
                <span className="ml-auto rounded-md bg-[#f0f1f7] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">{column.tasks.length}</span>
              </div>
            </header>

            <div className="space-y-2 px-1 pb-1">
              {column.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  {...cardProps(task)}
                  contextLabel={viewMode === "clients" && task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : undefined}
                />
              ))}

              <button type="button" onClick={() => createForColumn(column)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-slate-400 transition hover:bg-white hover:text-[#4f46e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]/20">
                <Plus className="size-3.5" /> Adicionar
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
