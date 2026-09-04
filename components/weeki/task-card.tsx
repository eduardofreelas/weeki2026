"use client";

import { Archive, CalendarDays, Clock3, Copy, ListChecks, MoreHorizontal, Paperclip, Pencil } from "lucide-react";
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
  low: "border-slate-200 hover:border-slate-300",
  medium: "border-indigo-200 hover:border-indigo-300",
  high: "border-amber-300 hover:border-amber-400",
  urgent: "border-rose-300 hover:border-rose-400",
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
  const timeLabel = [task.scheduledTime, estimateLabel].filter(Boolean).join(" · ");
  const checklistDone = task.checklist.filter((item) => item.completed).length;

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
        "group relative cursor-grab overflow-hidden rounded-xl border bg-white p-3 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.12)] transition duration-200 hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.22)] active:cursor-grabbing",
        priorityBorderClasses[task.priority],
        isCompleted && "border-teal-200 bg-slate-50/70 hover:border-teal-300",
      )}
    >
      <div className="mb-2.5 flex min-w-0 items-center gap-1.5 pr-5">
        {contextLabel ? (
          <span className="flex min-w-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"><CalendarDays className="size-3 shrink-0" /><span className="truncate">{contextLabel}</span></span>
        ) : client ? (
          <span className="min-w-0 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${client.color}14`, color: client.color }}>{client.name}</span>
        ) : (
          <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">Sem cliente</span>
        )}
        {timeLabel && <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-medium tabular-nums text-slate-500"><Clock3 className="size-3" />{timeLabel}</span>}
      </div>

      <div className="flex min-w-0 items-start gap-2.5 pr-4">
        <Checkbox
          checked={isCompleted}
          aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggleComplete}
          className="mt-0.5 size-4 shrink-0 rounded-[5px] border-slate-300 data-[state=checked]:border-[#111827] data-[state=checked]:bg-[#111827]"
        />
        <h3 className={cn("line-clamp-3 min-w-0 flex-1 text-[13px] font-medium leading-[1.45] tracking-[-0.005em] text-[#1a2232]", isCompleted && "font-normal text-slate-400 line-through")}>
          {task.title}
        </h3>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button onClick={(event) => event.stopPropagation()} className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md bg-white/80 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100" aria-label="Mais ações">
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem onSelect={onOpen}><Pencil /> Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}><Copy /> Duplicar</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onArchive}><Archive /> Arquivar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {(task.checklist.length > 0 || task.attachments.length > 0) && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2 pl-[26px] text-[10px] font-medium text-slate-400">
          {task.checklist.length > 0 && <span className="flex items-center gap-1"><ListChecks className="size-3" />{checklistDone}/{task.checklist.length}</span>}
          {task.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="size-3" />{task.attachments.length}</span>}
        </div>
      )}
    </article>
  );
}
