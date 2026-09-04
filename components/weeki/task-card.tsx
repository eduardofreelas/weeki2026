"use client";

import { Archive, Copy, MoreHorizontal, Pencil } from "lucide-react";
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

const priorityClasses = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-rose-50 text-rose-700",
};

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
  const isCompleted = task.status === "completed";

  return (
    <article
      draggable
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
        "group relative h-full min-h-[64px] cursor-grab overflow-hidden rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-[0_2px_8px_rgba(30,30,45,0.045)] transition duration-200 hover:z-20 hover:border-[#bdb2ef] hover:shadow-[0_8px_22px_rgba(50,38,102,0.12)] active:cursor-grabbing",
        isCompleted && "bg-slate-50/90 opacity-60",
      )}
    >
      <div className="flex min-w-0 items-start gap-2 pr-5">
        <Checkbox
          checked={isCompleted}
          aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggleComplete}
          className="mt-0.5 size-[17px] rounded-full data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
        />
        <h3 className={cn(
          "line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-[1.35] text-[#27272e]",
          isCompleted && "line-through",
        )}>
          {task.title}
        </h3>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(event) => event.stopPropagation()}
            className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"
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

      <div className="mt-2 flex min-w-0 items-center gap-1.5 pl-[25px]">
        {client ? (
          <>
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} />
            <span className="min-w-0 truncate text-[11px] font-medium text-slate-500">{client.name}</span>
          </>
        ) : (
          <span className="text-[11px] text-slate-400">Sem cliente</span>
        )}
        <span className={cn("ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", priorityClasses[task.priority])}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
    </article>
  );
}
