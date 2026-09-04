"use client";

import { Archive, CalendarDays, Clock3, Copy, MoreHorizontal, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CLIENTS } from "@/features/tasks/seed";
import { PRIORITY_LABELS, type Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

const priorityBarClasses = {
  low: "before:bg-slate-200",
  medium: "before:bg-transparent",
  high: "before:bg-orange-400",
  urgent: "before:bg-rose-500",
};

const formatEstimate = (minutes: number | null) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? remainder.toString().padStart(2, "0") : ""}`;
};

export function TaskCard({
  task,
  onOpen,
  onToggleComplete,
  onDuplicate,
  onArchive,
  contextLabel,
}: {
  task: Task;
  onOpen: () => void;
  onToggleComplete: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  contextLabel?: string;
}) {
  const client = CLIENTS.find((item) => item.id === task.clientId);
  const isCompleted = task.status === "completed";
  const timeLabel = [task.scheduledTime, formatEstimate(task.estimateMinutes)].filter(Boolean).join(" · ");

  return (
    <article
      draggable
      title={`${task.title}${task.priority === "high" || task.priority === "urgent" ? ` — prioridade ${PRIORITY_LABELS[task.priority].toLowerCase()}` : ""}`}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/weeki-task", task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir demanda ${task.title}`}
      className={cn(
        "group relative min-h-[86px] cursor-grab overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_2px_9px_rgba(25,25,38,0.04)] transition duration-200 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full hover:-translate-y-0.5 hover:border-[#bcb0ee] hover:shadow-[0_10px_26px_rgba(56,43,112,0.1)] active:cursor-grabbing",
        priorityBarClasses[task.priority],
        isCompleted && "bg-slate-50/90 opacity-60",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5 pr-5">
        <Checkbox
          checked={isCompleted}
          aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggleComplete}
          className="mt-0.5 size-4 shrink-0 rounded-full data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
        />
        <h3 className={cn("line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-[1.4] text-[#282830]", isCompleted && "line-through")}>
          {task.title}
        </h3>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button onClick={(event) => event.stopPropagation()} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100" aria-label="Mais ações">
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

      <div className="mt-3 flex min-w-0 items-center gap-2 pl-[26px]">
        {contextLabel ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-500"><CalendarDays className="size-3.5 shrink-0 text-slate-400" /><span className="truncate">{contextLabel}</span></span>
        ) : client ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-500"><span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} /><span className="truncate">{client.name}</span></span>
        ) : (
          <span className="truncate text-[11px] text-slate-400">Sem cliente</span>
        )}
        {timeLabel && <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-medium tabular-nums text-slate-400"><Clock3 className="size-3" />{timeLabel}</span>}
      </div>
    </article>
  );
}
