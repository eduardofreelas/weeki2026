"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Plus } from "lucide-react";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

const HOUR_HEIGHT = 88;
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

const formatDailyLoad = (tasks: Task[]) => {
  const minutes = tasks.reduce((total, task) => total + (task.estimateMinutes ?? 0), 0);
  if (!minutes) return "Sem tempo estimado";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours ? `${hours}h` : ""}${remainder ? `${remainder.toString().padStart(hours ? 2 : 1, "0")}min` : ""} planejadas`;
};

type PositionedTask = {
  task: Task;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

function positionTasks(tasks: Task[], startHour: number, endHour: number, preview?: { taskId: string; minutes: number } | null): PositionedTask[] {
  const startLimit = startHour * 60;
  const endLimit = endHour * 60;
  const scheduled = tasks
    .map((task) => {
      const rawStart = timeToMinutes(task.scheduledTime);
      if (rawStart === null) return null;
      const duration = Math.max(15, preview?.taskId === task.id ? preview.minutes : (task.estimateMinutes ?? 60));
      const start = Math.min(Math.max(rawStart, startLimit), endLimit - 15);
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
    top: ((item.start - startLimit) / 60) * HOUR_HEIGHT + 2,
    height: Math.max(24, ((item.end - item.start) / 60) * HOUR_HEIGHT - 4),
  }));
}

export function WeekBoard({
  weekStart,
  tasks,
  onCreate,
  onOpen,
  onMove,
  onResize,
  onToggleComplete,
  onDuplicate,
  onArchive,
}: {
  weekStart: Date;
  tasks: Task[];
  onCreate: (date: string, time?: string) => void;
  onOpen: (task: Task) => void;
  onMove: (taskId: string, date: string, time?: string) => void;
  onResize: (taskId: string, estimateMinutes: number) => void;
  onToggleComplete: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
}) {
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{ taskId: string; minutes: number } | null>(null);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const today = new Date();

  useEffect(() => {
    const todayIndex = days.findIndex((day) => isSameDay(day, today));
    setMobileDayIndex(todayIndex >= 0 ? todayIndex : 0);
  }, [days]);

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
  const gridTemplate = `52px repeat(${days.length}, minmax(0, 1fr))`;

  const cardProps = (task: Task) => ({
    task,
    onOpen: () => onOpen(task),
    onToggleComplete: () => onToggleComplete(task.id),
    onDuplicate: () => onDuplicate(task.id),
    onArchive: () => onArchive(task.id),
  });

  const startResize = (event: React.PointerEvent<HTMLButtonElement>, task: Task) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const initialDuration = task.estimateMinutes ?? 60;
    let nextDuration = initialDuration;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaMinutes = ((moveEvent.clientY - startY) / HOUR_HEIGHT) * 60;
      nextDuration = Math.min(12 * 60, Math.max(15, Math.round((initialDuration + deltaMinutes) / 15) * 15));
      setResizePreview({ taskId: task.id, minutes: nextDuration });
    };

    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      setResizePreview(null);
      if (nextDuration !== initialDuration) onResize(task.id, nextDuration);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
  };

  const mobileDay = days[mobileDayIndex];
  const mobileDateKey = format(mobileDay, "yyyy-MM-dd");
  const mobileTasks = tasks.filter((task) => task.scheduledDate === mobileDateKey);
  const mobileTimedTasks = mobileTasks
    .filter((task) => task.scheduledTime)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const mobileUntimedTasks = mobileTasks.filter((task) => !task.scheduledTime);

  return (
    <>
      <section className="week-board-scroll hidden h-[calc(100vh-218px)] min-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(27,27,40,0.035)] md:block" aria-label="Agenda da semana">
        <div className="min-w-[700px] lg:min-w-0">
          <div className="sticky top-0 z-40 grid border-b border-slate-200 bg-white/95 backdrop-blur" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-50 bg-white/95" aria-hidden="true" />
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              const dateKey = format(day, "yyyy-MM-dd");
              return (
                <header key={dateKey} className={cn("group/day relative flex h-[54px] min-w-0 items-center border-l border-slate-200 px-2.5", isToday && "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#7657ff]")}>
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <h2 className={cn("truncate text-sm font-semibold capitalize text-slate-700", isToday && "text-[#6749df]")}>
                      {format(day, "EEEE", { locale: ptBR })}
                    </h2>
                    <span className={cn("text-xs font-medium text-slate-400", isToday && "text-[#8067e8]")}>
                      {format(day, "dd")}
                    </span>
                    <button onClick={() => onCreate(dateKey)} className="focus-ring ml-0.5 grid size-6 shrink-0 place-items-center rounded-md text-slate-300 opacity-30 transition hover:bg-[#f1efff] hover:text-[#684be6] hover:opacity-100 group-hover/day:opacity-100 focus:opacity-100" aria-label={`Criar demanda para ${format(day, "EEEE", { locale: ptBR })}`}>
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </header>
              );
            })}
          </div>

          <div className="grid border-b border-slate-200 bg-[#fafafd]" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-30 flex min-h-[78px] items-start justify-end bg-[#fafafd] px-2 pt-3 text-[10px] font-medium leading-4 text-slate-400">
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
                  className={cn("min-h-[78px] border-l border-slate-200 p-1.5 transition", dragTarget === `untimed-${dateKey}` && "bg-[#f0edff]")}
                >
                  <div className="space-y-1.5">
                    {untimedTasks.map((task) => <TaskCard key={task.id} {...cardProps(task)} />)}
                  </div>
                  {!untimedTasks.length && (
                    <button onClick={() => onCreate(dateKey)} className="flex h-full min-h-[64px] w-full items-center justify-center rounded-lg text-slate-200 transition hover:bg-white hover:text-[#8a73ef]" aria-label={`Adicionar demanda sem horário em ${format(day, "EEEE", { locale: ptBR })}`}>
                      <Plus className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-30 bg-white shadow-[4px_0_10px_rgba(30,30,45,0.025)]" style={{ height: timelineHeight }} aria-hidden="true">
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
              const positionedTasks = positionTasks(dayTasks, startHour, endHour, resizePreview);
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
                    <button
                      key={hour}
                      type="button"
                      onClick={() => onCreate(dateKey, minutesToTime(hour * 60))}
                      className="group/hour absolute inset-x-0 z-0 border-t border-slate-100 text-left transition hover:bg-[#faf9ff]"
                      style={{ top: index * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      aria-label={`Criar demanda às ${hour.toString().padStart(2, "0")}:00 de ${format(day, "EEEE", { locale: ptBR })}`}
                    >
                      <span className="absolute left-2 top-2 flex items-center gap-1 text-[10px] font-medium text-[#8067e8] opacity-0 transition group-hover/hour:opacity-100"><Plus className="size-3" /> adicionar</span>
                    </button>
                  ))}

                  {showCurrentTime && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 border-t border-[#7657ff]/55" style={{ top: currentTimeTop }}>
                      <span className="absolute -left-1 -top-1 size-2 rounded-full bg-[#7657ff]" />
                    </div>
                  )}

                  {positionedTasks.map(({ task, top, height, lane, lanes }) => {
                    const width = 100 / lanes;
                    return (
                      <div
                        key={task.id}
                        className="group/task absolute z-10 px-1"
                        style={{ top, height, left: `${lane * width}%`, width: `${width}%` }}
                      >
                        <TaskCard {...cardProps(task)} displayHeight={height} hasConflict={lanes > 1} />
                        <button
                          type="button"
                          onPointerDown={(event) => startResize(event, task)}
                          className="absolute inset-x-3 bottom-0 z-30 h-2 cursor-ns-resize rounded-full opacity-0 transition group-hover/task:opacity-100"
                          aria-label={`Alterar duração de ${task.title}`}
                          title="Arraste para alterar a duração"
                        >
                          <span className="mx-auto block h-0.5 w-6 rounded-full bg-slate-400/70" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(27,27,40,0.035)] md:hidden" aria-label="Agenda do dia">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/95 px-3 py-3 backdrop-blur">
          <button type="button" onClick={() => setMobileDayIndex((current) => Math.max(0, current - 1))} disabled={mobileDayIndex === 0} className="focus-ring grid size-9 place-items-center rounded-lg text-slate-500 disabled:opacity-25" aria-label="Dia anterior"><ChevronLeft className="size-5" /></button>
          <div className="text-center">
            <p className="text-sm font-semibold capitalize text-slate-800">{format(mobileDay, "EEEE, dd", { locale: ptBR })}</p>
            <p className="mt-0.5 text-xs text-slate-400">{formatDailyLoad(mobileTimedTasks)}</p>
          </div>
          <button type="button" onClick={() => setMobileDayIndex((current) => Math.min(4, current + 1))} disabled={mobileDayIndex === 4} className="focus-ring grid size-9 place-items-center rounded-lg text-slate-500 disabled:opacity-25" aria-label="Próximo dia"><ChevronRight className="size-5" /></button>
        </header>

        <div className="p-3">
          {mobileUntimedTasks.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sem horário</p>
              <div className="space-y-2">{mobileUntimedTasks.map((task) => <TaskCard key={task.id} {...cardProps(task)} />)}</div>
            </div>
          )}

          <div className="space-y-3">
            {mobileTimedTasks.map((task) => (
              <div key={task.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2">
                <time className="pt-2 text-xs font-semibold tabular-nums text-slate-400">{task.scheduledTime}</time>
                <TaskCard {...cardProps(task)} />
              </div>
            ))}
          </div>

          {!mobileTasks.length && (
            <button type="button" onClick={() => onCreate(mobileDateKey)} className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400 transition hover:border-[#a998ef] hover:bg-[#faf9ff] hover:text-[#684be6]">
              <span className="mb-2 grid size-9 place-items-center rounded-lg bg-[#f1efff] text-[#7657ff]"><Plus className="size-4" /></span>
              Nenhuma demanda neste dia
              <span className="mt-1 text-xs">Toque para adicionar</span>
            </button>
          )}

          {mobileTasks.length > 0 && (
            <button type="button" onClick={() => onCreate(mobileDateKey)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-slate-400 transition hover:bg-[#f4f1ff] hover:text-[#684be6]"><Plus className="size-4" /> Adicionar demanda</button>
          )}
        </div>
      </section>
    </>
  );
}
