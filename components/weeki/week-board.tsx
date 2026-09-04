"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

const HOUR_HEIGHT = 76;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
};

const minutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const remainder = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${remainder}`;
};

type PositionedTask = {
  task: Task;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

function positionTasks(tasks: Task[], startHour: number, endHour: number): PositionedTask[] {
  const startLimit = startHour * 60;
  const endLimit = endHour * 60;
  const scheduled = tasks
    .map((task) => {
      const rawStart = timeToMinutes(task.scheduledTime);
      if (rawStart === null) return null;
      const duration = Math.max(60, task.estimateMinutes ?? 60);
      const start = Math.min(Math.max(rawStart, startLimit), endLimit - 60);
      return { task, start, end: Math.min(start + duration, endLimit), lane: 0, lanes: 1 };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result: typeof scheduled = [];
  let group: typeof scheduled = [];
  let groupEnd = -1;

  const finishGroup = () => {
    if (!group.length) return;
    const lanes = Math.max(...group.map((item) => item.lane)) + 1;
    group.forEach((item) => {
      item.lanes = lanes;
      result.push(item);
    });
    group = [];
    groupEnd = -1;
  };

  scheduled.forEach((item) => {
    if (group.length && item.start >= groupEnd) finishGroup();
    let lane = 0;
    while (group.some((current) => current.lane === lane && current.end > item.start)) lane += 1;
    item.lane = lane;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.end);
  });
  finishGroup();

  return result.map((item) => ({
    task: item.task,
    lane: item.lane,
    lanes: item.lanes,
    top: ((item.start - startLimit) / 60) * HOUR_HEIGHT + 4,
    height: Math.max(64, ((item.end - item.start) / 60) * HOUR_HEIGHT - 8),
  }));
}

export function WeekBoard({
  weekStart,
  tasks,
  onCreate,
  onOpen,
  onMove,
  onToggleComplete,
  onDuplicate,
  onArchive,
}: {
  weekStart: Date;
  tasks: Task[];
  onCreate: (date: string) => void;
  onOpen: (task: Task) => void;
  onMove: (taskId: string, date: string, time?: string) => void;
  onToggleComplete: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
}) {
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const today = new Date();

  const { startHour, endHour } = useMemo(() => {
    const timedTasks = tasks
      .map((task) => ({ minutes: timeToMinutes(task.scheduledTime), duration: task.estimateMinutes ?? 60 }))
      .filter((item): item is { minutes: number; duration: number } => item.minutes !== null);
    if (!timedTasks.length) return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
    const earliest = Math.floor(Math.min(...timedTasks.map((item) => item.minutes)) / 60);
    const latest = Math.ceil(Math.max(...timedTasks.map((item) => item.minutes + item.duration)) / 60);
    return {
      startHour: Math.max(0, Math.min(DEFAULT_START_HOUR, earliest)),
      endHour: Math.min(24, Math.max(DEFAULT_END_HOUR, latest)),
    };
  }, [tasks]);

  const timelineHeight = (endHour - startHour) * HOUR_HEIGHT;
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const gridTemplate = `56px repeat(${days.length}, minmax(0, 1fr))`;

  const cardProps = (task: Task) => ({
    task,
    onOpen: () => onOpen(task),
    onToggleComplete: () => onToggleComplete(task.id),
    onDuplicate: () => onDuplicate(task.id),
    onArchive: () => onArchive(task.id),
  });

  return (
    <section className="week-board-scroll h-[calc(100vh-224px)] min-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(27,27,40,0.035)]" aria-label="Agenda da semana">
      <div className="min-w-[690px] md:min-w-0">
        <div className="sticky top-0 z-30 grid border-b border-slate-200 bg-white/95 backdrop-blur" style={{ gridTemplateColumns: gridTemplate }}>
          <div aria-hidden="true" />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const dateKey = format(day, "yyyy-MM-dd");
            return (
              <header key={dateKey} className="flex h-[58px] min-w-0 items-center justify-between border-l border-slate-200 px-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <h2 className={cn("truncate text-sm font-semibold capitalize text-slate-700", isToday && "text-[#6749df]")}>
                    {format(day, "EEEE", { locale: ptBR })}
                  </h2>
                  <span className={cn("text-xs font-medium text-slate-400", isToday && "text-[#8067e8]")}>
                    {format(day, "dd")}
                  </span>
                </div>
                <button onClick={() => onCreate(dateKey)} className="focus-ring grid size-7 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-[#f1efff] hover:text-[#684be6]" aria-label={`Criar demanda para ${format(day, "EEEE", { locale: ptBR })}`}>
                  <Plus className="size-3.5" />
                </button>
              </header>
            );
          })}
        </div>

        <div className="grid border-b border-slate-200 bg-[#fafafd]" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="flex min-h-[82px] items-start justify-end px-2 pt-3 text-[10px] font-medium leading-4 text-slate-400">
            Sem<br />horário
          </div>
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const untimedTasks = tasks.filter((task) => task.scheduledDate === dateKey && !task.scheduledTime);
            return (
              <div
                key={dateKey}
                onDragOver={(event) => { event.preventDefault(); setDragTarget(`untimed-${dateKey}`); }}
                onDragLeave={() => setDragTarget(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData("text/weeki-task");
                  if (taskId) onMove(taskId, dateKey, "");
                  setDragTarget(null);
                }}
                className={cn("min-h-[82px] border-l border-slate-200 p-1.5 transition", dragTarget === `untimed-${dateKey}` && "bg-[#f0edff]")}
              >
                <div className="space-y-1.5">
                  {untimedTasks.map((task) => <TaskCard key={task.id} {...cardProps(task)} />)}
                </div>
                {!untimedTasks.length && (
                  <button onClick={() => onCreate(dateKey)} className="flex h-full min-h-[68px] w-full items-center justify-center rounded-lg text-slate-200 transition hover:bg-white hover:text-[#8a73ef]" aria-label={`Adicionar demanda sem horário em ${format(day, "EEEE", { locale: ptBR })}`}>
                    <Plus className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="relative bg-white" style={{ height: timelineHeight }} aria-hidden="true">
            {hours.map((hour, index) => (
              <span key={hour} className="absolute right-2 text-[10px] font-medium tabular-nums text-slate-400" style={{ top: index * HOUR_HEIGHT + 6 }}>
                {hour.toString().padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const isToday = isSameDay(day, today);
            const dayTasks = tasks.filter((task) => task.scheduledDate === dateKey && task.scheduledTime);
            const positionedTasks = positionTasks(dayTasks, startHour, endHour);
            const nowMinutes = today.getHours() * 60 + today.getMinutes();
            const showCurrentTime = isToday && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;
            const currentTimeTop = ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT;

            return (
              <div
                key={dateKey}
                onDragOver={(event) => { event.preventDefault(); setDragTarget(dateKey); }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData("text/weeki-task");
                  if (taskId) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const rawMinutes = startHour * 60 + ((event.clientY - rect.top) / HOUR_HEIGHT) * 60;
                    const roundedMinutes = Math.round(rawMinutes / 15) * 15;
                    const safeMinutes = Math.min(endHour * 60 - 15, Math.max(startHour * 60, roundedMinutes));
                    onMove(taskId, dateKey, minutesToTime(safeMinutes));
                  }
                  setDragTarget(null);
                }}
                className={cn("relative border-l border-slate-200 transition", dragTarget === dateKey && "bg-[#f8f6ff]")}
                style={{ height: timelineHeight }}
              >
                {hours.map((hour, index) => (
                  <span key={hour} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" style={{ top: index * HOUR_HEIGHT }} />
                ))}

                {showCurrentTime && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-[#7657ff]/55" style={{ top: currentTimeTop }}>
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-[#7657ff]" />
                  </div>
                )}

                {positionedTasks.map(({ task, top, height, lane, lanes }) => {
                  const width = 100 / lanes;
                  return (
                    <div
                      key={task.id}
                      className="absolute z-10 px-1"
                      style={{
                        top,
                        height,
                        left: `${lane * width}%`,
                        width: `${width}%`,
                      }}
                    >
                      <TaskCard {...cardProps(task)} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
