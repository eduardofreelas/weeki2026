"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO } from "date-fns";
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
  const today = new Date();

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
        title: format(day, "EEEE", { locale: ptBR }),
        dateNumber: format(day, "dd"),
        dateKey,
        tasks: tasks.filter((task) => task.scheduledDate === dateKey).sort(sortByTime),
        isToday: isSameDay(day, today),
      };
    });
  }, [showWeekend, tasks, viewMode, weekStart]);

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
    <section className="week-board-scroll snap-x snap-mandatory overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_10px_36px_rgba(25,25,40,0.045)] lg:snap-none" aria-label={viewMode === "week" ? "Demandas da semana" : "Demandas por cliente"}>
      <div className="week-columns" style={{ "--weeki-column-count": columns.length, "--weeki-board-min-width": `${columns.length * 144 + Math.max(0, columns.length - 1) * 12}px` } as React.CSSProperties}>
        {columns.map((column) => (
          <div
            key={column.id}
            onDragOver={(event) => { event.preventDefault(); setDragTarget(column.id); }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
            }}
            onDrop={(event) => handleDrop(event, column)}
            className={cn(
              "group/column relative min-h-[440px] snap-start overflow-hidden rounded-xl border border-slate-200 bg-[#f8f9fc] transition",
              dragTarget === column.id && "border-[#9d8bed] bg-[#f4f1ff] shadow-[inset_0_0_0_1px_rgba(118,87,255,0.12)]",
              column.isToday && "border-[#cec5f5]",
            )}
          >
            <header className={cn("sticky top-0 z-10 flex h-14 items-center border-b border-slate-200 bg-white/95 px-3 backdrop-blur", column.isToday && "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#7657ff]")}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {viewMode === "clients" && (
                  column.clientColor
                    ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.clientColor }} />
                    : <span className="grid size-5 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400"><UserRound className="size-3" /></span>
                )}
                <h2 className={cn("truncate text-sm font-semibold capitalize text-slate-700", column.isToday && "text-[#6749df]")}>{column.title}</h2>
                {column.dateNumber && <span className={cn("text-xs font-medium text-slate-400", column.isToday && "text-[#8067e8]")}>{column.dateNumber}</span>}
                {viewMode === "clients" && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">{column.tasks.length}</span>}
              </div>
              <button type="button" onClick={() => createForColumn(column)} className="focus-ring grid size-7 shrink-0 place-items-center rounded-lg text-slate-300 opacity-50 transition hover:bg-[#f1efff] hover:text-[#684be6] hover:opacity-100 group-hover/column:opacity-100 focus:opacity-100" aria-label={`Criar demanda em ${column.title}`}>
                <Plus className="size-3.5" />
              </button>
            </header>

            <div className="space-y-2 p-2.5">
              {column.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  {...cardProps(task)}
                  contextLabel={viewMode === "clients" && task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : undefined}
                />
              ))}

              {!column.tasks.length && (
                <button type="button" onClick={() => createForColumn(column)} className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/55 px-4 text-center text-xs text-slate-400 transition hover:border-[#aa9bed] hover:bg-white hover:text-[#674bdd]">
                  <span className="mb-2 grid size-7 place-items-center rounded-lg bg-white text-slate-300 shadow-sm"><Plus className="size-3.5" /></span>
                  Nenhuma demanda
                  <span className="mt-1 text-[11px] text-slate-300">Clique para adicionar</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
