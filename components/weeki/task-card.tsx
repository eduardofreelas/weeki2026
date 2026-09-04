"use client";

import { AlarmClock, Archive, CalendarDays, Check, CheckSquare2, Clock3, Copy, MoreHorizontal, Pencil, RotateCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CLIENTS } from "@/features/tasks/seed";
import { PRIORITY_LABELS, STATUS_LABELS, type Task } from "@/features/tasks/types";

const priorityClasses = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-rose-50 text-rose-700",
};

const statusDots = {
  not_started: "bg-slate-400",
  in_progress: "bg-blue-500",
  waiting: "bg-amber-500",
  review: "bg-violet-500",
  completed: "bg-emerald-500",
};

const formatEstimate = (minutes: number) => minutes >= 60
  ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`
  : `${minutes}min`;

export function TaskCard({
  task,
  onOpen,
  onToggleComplete,
  onDuplicate,
  onArchive,
}: {
  task: Task;
  onOpen: () => void;
  onToggleComplete: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const client = CLIENTS.find((item) => item.id === task.clientId);
  const completedItems = task.checklist.filter((item) => item.completed).length;
  const isCompleted = task.status === "completed";
  const isOverdue = Boolean(task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && !isCompleted);

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/weeki-task", task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir demanda ${task.title}`}
      className={cn(
        "group relative cursor-grab rounded-[15px] border bg-white p-3.5 shadow-[0_2px_10px_rgba(24,24,30,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cbc4f8] hover:shadow-[0_10px_28px_rgba(52,40,108,0.10)] active:cursor-grabbing",
        isCompleted && "opacity-65",
      )}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <Checkbox
          checked={isCompleted}
          aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggleComplete}
          className="mt-0.5 size-[18px] rounded-full data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
        />
        <h3 className={cn("min-w-0 flex-1 text-[14px] font-semibold leading-[1.42] text-[#26262c]", isCompleted && "line-through")}>
          {task.title}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(event) => event.stopPropagation()} className="-mr-1 -mt-1 grid size-7 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100" aria-label="Mais ações">
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onSelect={onOpen}><Pencil /> Editar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}><Copy /> Duplicar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onArchive}><Archive /> Arquivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {client && (
        <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-slate-600">
          <span className="size-2 rounded-full" style={{ backgroundColor: client.color }} />
          <span className="truncate">{client.name}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold", priorityClasses[task.priority])}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
          <span className={cn("size-1.5 rounded-full", statusDots[task.status])} />
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        {task.scheduledTime && <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" /> {task.scheduledTime}</span>}
        {task.estimateMinutes && <span className="inline-flex items-center gap-1"><AlarmClock className="size-3.5" /> {formatEstimate(task.estimateMinutes)}</span>}
        {task.dueDate && <span className={cn("inline-flex items-center gap-1", isOverdue && "font-semibold text-rose-600")}><CalendarDays className="size-3.5" /> {format(parseISO(task.dueDate), "dd/MM")}</span>}
        {task.checklist.length > 0 && (
          <span className={cn("ml-auto inline-flex items-center gap-1", completedItems === task.checklist.length && "text-emerald-600")}>
            {completedItems === task.checklist.length ? <Check className="size-3.5" /> : <CheckSquare2 className="size-3.5" />}
            {completedItems}/{task.checklist.length}
          </span>
        )}
        {task.recurrence.type !== "none" && <RotateCw className="ml-auto size-3.5" aria-label="Demanda recorrente" />}
      </div>
    </article>
  );
}
