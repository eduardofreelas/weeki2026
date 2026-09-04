"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/features/tasks/types";
import { TaskCard } from "./task-card";

export function WeekBoard({
  weekStart,
  tasks,
  showWeekend,
  onCreate,
  onOpen,
  onMove,
  onToggleComplete,
  onDuplicate,
  onArchive,
}: {
  weekStart: Date;
  tasks: Task[];
  showWeekend: boolean;
  onCreate: (date: string) => void;
  onOpen: (task: Task) => void;
  onMove: (taskId: string, date: string) => void;
  onToggleComplete: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
}) {
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dayCount = showWeekend ? 7 : 5;
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => addDays(weekStart, index)), [weekStart, dayCount]);
  const today = new Date();

  return (
    <section className="week-board-scroll min-h-0 flex-1 overflow-x-auto pb-3" aria-label="Quadro da semana">
      <div className="grid min-w-max auto-cols-[252px] grid-flow-col gap-3 pr-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayTasks = tasks.filter((task) => task.scheduledDate === dateKey);
          const isToday = isSameDay(day, today);
          const estimatedMinutes = dayTasks.reduce((total, task) => total + (task.estimateMinutes ?? 0), 0);

          return (
            <div
              key={dateKey}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragTarget(dateKey);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/weeki-task");
                if (taskId) onMove(taskId, dateKey);
                setDragTarget(null);
              }}
              className={cn(
                "relative flex min-h-[500px] flex-col rounded-[18px] border border-[#e5e6ec] bg-[#f1f2f6]/75 p-2.5 transition",
                dragTarget === dateKey && "border-[#8a73f6] bg-[#efecff] shadow-[inset_0_0_0_1px_#8a73f6]",
              )}
            >
              {isToday && <span className="absolute inset-x-8 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-[#7657ff] to-[#2f80ed]" />}
              <header className="flex items-center justify-between px-1.5 pb-3 pt-1.5">
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "grid size-9 place-items-center rounded-xl border bg-white text-sm font-semibold text-slate-700",
                    isToday && "border-transparent bg-[#17171c] text-white shadow-sm",
                  )}>
                    {format(day, "dd")}
                  </span>
                  <div>
                    <h2 className="text-[13px] font-semibold capitalize text-slate-800">{format(day, "EEEE", { locale: ptBR })}</h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {dayTasks.length} {dayTasks.length === 1 ? "demanda" : "demandas"}
                      {estimatedMinutes > 0 && ` · ${Math.round((estimatedMinutes / 60) * 10) / 10}h`}
                    </p>
                  </div>
                </div>
                <button onClick={() => onCreate(dateKey)} className="focus-ring grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-[#684be6]" aria-label={`Criar demanda para ${format(day, "EEEE", { locale: ptBR })}`}>
                  <Plus className="size-4" />
                </button>
              </header>

              <div className="space-y-2.5">
                {dayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={() => onOpen(task)}
                    onToggleComplete={() => onToggleComplete(task.id)}
                    onDuplicate={() => onDuplicate(task.id)}
                    onArchive={() => onArchive(task.id)}
                  />
                ))}
              </div>

              {dayTasks.length === 0 && (
                <button onClick={() => onCreate(dateKey)} className="mt-1 flex min-h-32 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/80 px-5 text-center text-xs text-slate-400 transition hover:border-[#9d8bf5] hover:bg-white/65 hover:text-[#6d55df]">
                  <Plus className="mb-2 size-5" />
                  Solte uma demanda aqui ou clique para criar
                </button>
              )}

              {dayTasks.length > 0 && (
                <button onClick={() => onCreate(dateKey)} className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-slate-400 transition hover:bg-white hover:text-[#684be6]">
                  <Plus className="size-3.5" /> Adicionar demanda
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
