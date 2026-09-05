"use client";

import {
  AlignLeft,
  Archive,
  CalendarDays,
  Clock3,
  Copy,
  ListChecks,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Repeat2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Client } from "@/features/clients/types";
import { PRIORITY_LABELS, type Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

const formatEstimate = (minutes: number | null) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? remainder.toString().padStart(2, "0") : ""}`;
};

export function TaskCard({
  task,
  clients,
  onOpen,
  onToggleComplete,
  onDuplicate,
  onArchive,
  contextLabel,
  variant = "board",
}: {
  task: Task;
  clients: Client[];
  onOpen: () => void;
  onToggleComplete: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  contextLabel?: string;
  variant?: "board" | "list";
}) {
  const client = clients.find((item) => item.id === task.clientId);
  const isCompleted = task.status === "completed";
  const estimateLabel = formatEstimate(task.estimateMinutes);
  const completedChecklist = task.checklist.filter((item) => item.completed).length;
  const timeLabel = task.scheduledTime
    ? `${task.scheduledTime}${task.dueTime ? ` – ${task.dueTime}` : ""}`
    : "";

  const actionMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(event) => event.stopPropagation()} className={cn("grid size-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700", variant === "board" && "absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100")} aria-label="Mais ações">
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
  );

  const commonProps = {
    draggable: true,
    title: `${task.title}${task.priority === "high" || task.priority === "urgent" ? ` — prioridade ${PRIORITY_LABELS[task.priority].toLowerCase()}` : ""}`,
    onDragStart: (event: React.DragEvent<HTMLElement>) => {
      event.dataTransfer.setData("text/weeki-task", task.id);
      event.dataTransfer.effectAllowed = "move";
    },
    onClick: onOpen,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    },
    role: "button",
    tabIndex: 0,
    "aria-label": `Abrir demanda ${task.title}`,
  };

  if (variant === "list") {
    return (
      <article
        {...commonProps}
        className={cn(
          "group flex min-h-[58px] cursor-grab items-center gap-3 border-b border-slate-100 bg-white px-3.5 py-2.5 transition last:border-b-0 hover:bg-slate-50/80 active:cursor-grabbing sm:px-4",
          isCompleted && "bg-slate-50/60",
        )}
      >
        <Checkbox checked={isCompleted} aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"} onClick={(event) => event.stopPropagation()} onCheckedChange={onToggleComplete} className="size-4 shrink-0 rounded-full border-slate-300 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500" />
        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
          <h3 className={cn("min-w-0 flex-1 truncate text-xs font-semibold text-slate-800", isCompleted && "text-slate-400 line-through")}>{task.title}</h3>
          <div className="mt-1 flex min-w-0 items-center gap-3 text-[11px] font-medium text-slate-500 sm:mt-0 sm:w-[48%]">
            {timeLabel && <span className="flex shrink-0 items-center gap-1 tabular-nums"><Clock3 className="size-3 text-slate-400" />{timeLabel}</span>}
            {contextLabel ? <span className="flex min-w-0 items-center gap-1"><CalendarDays className="size-3 shrink-0 text-slate-400" /><span className="truncate">{contextLabel}</span></span> : client ? <span className="flex min-w-0 items-center gap-1.5"><span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} /><span className="truncate">{client.name}</span></span> : <span className="truncate text-slate-400">Sem cliente</span>}
            {estimateLabel && <span className="ml-auto shrink-0 tabular-nums text-slate-400">{estimateLabel}</span>}
          </div>
        </div>
        {actionMenu}
      </article>
    );
  }

  const hasDetails = Boolean(task.description || task.attachments.length || task.checklist.length || task.recurrence.type !== "none");

  return (
    <article
      {...commonProps}
      className={cn(
        "group relative cursor-grab rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition duration-150 hover:border-[#c9c2ff] hover:shadow-[0_5px_15px_rgba(15,23,42,0.08)] active:cursor-grabbing",
        isCompleted && "border-dashed border-slate-300 bg-slate-50/60 opacity-90 hover:border-slate-400",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5 pr-4">
        <Checkbox checked={isCompleted} aria-label={isCompleted ? "Reabrir demanda" : "Concluir demanda"} onClick={(event) => event.stopPropagation()} onCheckedChange={onToggleComplete} className="mt-0.5 size-4 shrink-0 rounded-full border-slate-300 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500" />
        <div className="min-w-0 flex-1">
          <h3 className={cn("break-words text-xs font-semibold leading-snug text-slate-800", isCompleted && "text-slate-400 line-through")}>{task.title}</h3>
          {timeLabel && <p className={cn("mt-1.5 flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-slate-500", isCompleted && "text-slate-400")}><Clock3 className="size-3 shrink-0 text-slate-400" />{timeLabel}</p>}
          {hasDetails && (
            <div className="mt-2 flex items-center gap-2 text-slate-400">
              {task.description && <span title="Descrição disponível"><AlignLeft className="size-3" /></span>}
              {task.attachments.length > 0 && <span className="flex items-center gap-0.5" title={`${task.attachments.length} anexo(s)`}><Paperclip className="size-3" /><span className="text-[10px] font-medium">{task.attachments.length}</span></span>}
              {task.checklist.length > 0 && <span className="flex items-center gap-0.5" title={`${completedChecklist}/${task.checklist.length} itens concluídos`}><ListChecks className="size-3" /><span className="text-[10px] font-medium">{completedChecklist}/{task.checklist.length}</span></span>}
              {task.recurrence.type !== "none" && <span title="Demanda recorrente"><Repeat2 className="size-3" /></span>}
            </div>
          )}
          <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-2">
            {contextLabel ? <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-slate-500"><CalendarDays className="size-3 shrink-0 text-slate-400" /><span className="truncate">{contextLabel}</span></span> : client ? <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold" style={{ color: client.color }}><span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} /><span className="truncate">{client.name}</span></span> : <span className="truncate text-[11px] text-slate-400">Sem cliente</span>}
            {estimateLabel && <span className="flex shrink-0 items-center gap-1 rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-500"><Clock3 className="size-3 text-slate-400" />{estimateLabel}</span>}
          </div>
        </div>
      </div>
      {actionMenu}
    </article>
  );
}
