"use client";

import { AlertTriangle, Archive, Copy, MoreHorizontal, Pencil } from "lucide-react";
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
  low: "before:bg-transparent",
  medium: "before:bg-transparent",
  high: "before:bg-orange-400",
  urgent: "before:bg-rose-500",
};

const formatEstimate = (minutes: number | null) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? `${remainder}` : ""}`;
};

export function TaskCard({
  task,
  onOpen,
  onToggleComplete,
  onDuplicate,
  onArchive,
  displayHeight,
  hasConflict = false,
}: {
  task: Task;
  onOpen: () => void;
  onToggleComplete: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  displayHeight?: number;
  hasConflict?: boolean;
}) {
  const client = CLIENTS.find((item) => item.id === task.clientId);
  const isCompleted = task.status === "completed";
  const isTiny = displayHeight !== undefined && displayHeight < 38;
  const isCompact = displayHeight !== undefined && displayHeight < 66;
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
        "group relative h-full cursor-grab overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(30,30,45,0.045)] transition duration-200 before:absolute before:inset-y-0 before:left-0 before:w-[3px] hover:z-20 hover:border-[#bdb2ef] hover:shadow-[0_8px_22px_rgba(50,38,102,0.12)] active:cursor-grabbing",
        displayHeight === undefined && "min-h-[62px] p-2.5",
        isCompact && !isTiny && "p-1.5 pl-2",
        isTiny && "px-1.5 py-1 pl-2",
        priorityBarClasses[task.priority],
        isCompleted && "bg-slate-50/90 opacity-60",
      )}
    >
      <div className={cn("flex min-w-0 items-start gap-2", !isTiny && "pr-5", isTiny && "items-center gap-1.5")}>
        <Checkbox
          checked={isCompleted}
          aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggleComplete}
          className={cn(
            "mt-0.5 size-[16px] shrink-0 rounded-full data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500",
            isTiny && "mt-0 size-3.5",
          )}
        />
        <h3 className={cn(
          "min-w-0 flex-1 font-semibold text-[#27272e]",
          isTiny ? "truncate text-[11px] leading-4" : isCompact ? "line-clamp-1 text-xs leading-4" : "line-clamp-2 text-sm leading-[1.35]",
          isCompleted && "line-through",
        )}>
          {task.title}
          {isTiny && client && <span className="font-normal text-slate-400"> · {client.name}</span>}
        </h3>
      </div>

      {!isTiny && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(event) => event.stopPropagation()}
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"
              aria-label="Mais ações"
            >
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
      )}

      {!isTiny && (
        <div className={cn("flex min-w-0 items-center gap-1.5 pl-6", isCompact ? "mt-1" : "mt-2")}>
          {client ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} />
              <span className="min-w-0 truncate text-[11px] font-medium text-slate-500">{client.name}</span>
            </>
          ) : (
            <span className="truncate text-[11px] text-slate-400">Sem cliente</span>
          )}
          {timeLabel && !isCompact && <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums text-slate-400">{timeLabel}</span>}
          {hasConflict && (
            <span title="Conflito de horário" className="ml-auto text-amber-500" aria-label="Conflito de horário">
              <AlertTriangle className="size-3.5" />
            </span>
          )}
        </div>
      )}
    </article>
  );
}
