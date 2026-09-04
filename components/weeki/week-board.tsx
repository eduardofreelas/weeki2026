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
  dateLabel?: string;
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
        title: format(day, "EEEE", { locale: ptBR }),
        dateLabel: format(day, "dd 'de' MMMM", { locale: ptBR }),
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
              "group/column relative min-h-[520px] snap-start border-l border-slate-200/90 transition first:border-l-0",
              dragTarget === column.id && "bg-[#f8f6ff] shadow-[inset_0_0_0_1px_rgba(118,87,255,0.08)]",
            )}
          >
            <header className="sticky top-0 z-10 flex min-h-[76px] items-start bg-[#fbfcfe]/95 px-4 py-4 backdrop-blur">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {viewMode === "clients" && (
                  column.clientColor
                    ? <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: column.clientColor }} />
                    : <span className="grid size-5 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400"><UserRound className="size-3" /></span>
                )}
                <div className="min-w-0">
                  <h2 className={cn("truncate text-[15px] font-semibold capitalize tracking-[-0.015em] text-[#272731]", column.isToday && "text-[#6749df]")}>{column.title}</h2>
                  {column.dateLabel && <p className={cn("mt-1 truncate text-[11px] font-medium text-slate-400", column.isToday && "text-[#8a77df]")}>{column.dateLabel}</p>}
                  {viewMode === "clients" && <p className="mt-1 text-[11px] text-slate-400">{column.tasks.length} {column.tasks.length === 1 ? "demanda" : "demandas"}</p>}
                </div>
              </div>
              <button type="button" onClick={() => createForColumn(column)} className="focus-ring grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-[#f1efff] hover:text-[#684be6]" aria-label={`Criar demanda em ${column.title}`}>
                <Plus className="size-4" />
              </button>
            </header>

            <div className="space-y-3 px-4 pb-6">
              {column.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  {...cardProps(task)}
                  contextLabel={viewMode === "clients" && task.scheduledDate ? format(parseISO(task.scheduledDate), "EEE, dd MMM", { locale: ptBR }) : undefined}
                />
              ))}

              {!column.tasks.length && (
                <button type="button" onClick={() => createForColumn(column)} className="flex min-h-24 w-full items-center justify-center rounded-xl border border-dashed border-transparent px-4 text-center text-xs text-slate-300 opacity-0 transition hover:border-slate-200 hover:bg-white/60 hover:text-[#674bdd] group-hover/column:opacity-100 focus:opacity-100">
                  <Plus className="mr-1.5 size-3.5" /> Adicionar demanda
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
