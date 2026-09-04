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

const priorityBorderClasses = {
  low: "border-slate-300 hover:border-slate-400",
  medium: "border-[#78a8ff] hover:border-[#4c8df7]",
  high: "border-[#f2bd36] hover:border-[#e3a70c]",
  urgent: "border-[#fb6b86] hover:border-[#f43f62]",
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
  const estimateLabel = formatEstimate(task.estimateMinutes);

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
        "group relative min-h-[102px] cursor-grab overflow-hidden rounded-[13px] border bg-white p-4 shadow-[0_2px_8px_rgba(27,31,44,0.025)] transition duration-200 hover:-translate-y-px hover:shadow-[0_9px_24px_rgba(46,51,67,0.08)] active:cursor-grabbing",
        priorityBorderClasses[task.priority],
        isCompleted && "border-emerald-400 bg-emerald-50/20 hover:border-emerald-500",
      )}
    >
      <div className="flex min-w-0 items-start gap-3 pr-5">
        <Checkbox
          checked={isCompleted}
          aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggleComplete}
          className="mt-0.5 size-5 shrink-0 rounded-full border-slate-300 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
        />
        <h3 className={cn("line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-[1.45] tracking-[-0.01em] text-[#262631]", isCompleted && "text-slate-400 line-through")}>
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

      <div className="mt-4 flex min-w-0 items-center gap-2 pl-8">
        {contextLabel ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-500"><CalendarDays className="size-3.5 shrink-0 text-slate-400" /><span className="truncate">{contextLabel}</span></span>
        ) : client ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-500"><span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} /><span className="truncate">{client.name}</span></span>
        ) : (
          <span className="truncate text-[11px] text-slate-400">Sem cliente</span>
        )}
        {estimateLabel && <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums text-slate-500"><Clock3 className="size-3.5 text-slate-400" />{estimateLabel}</span>}
      </div>
    </article>
  );
}
