"use client";

import { CalendarDays, CheckCircle2, CirclePlus, Inbox, Search, UserRound } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { CLIENTS } from "@/features/tasks/seed";
import type { Task } from "@/features/tasks/types";

export function WeekiCommandPalette({
  open,
  onOpenChange,
  tasks,
  onCreate,
  onOpenTask,
  onToday,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onCreate: (date: string | null) => void;
  onOpenTask: (task: Task) => void;
  onToday: () => void;
}) {
  const run = (callback: () => void) => {
    callback();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Comandos rápidos do Weeki" description="Crie ou encontre uma demanda" className="top-[36%] max-w-xl rounded-2xl border-slate-200 shadow-2xl">
      <CommandInput placeholder="Buscar demanda, cliente ou ação..." />
      <CommandList className="max-h-[360px] p-2">
        <CommandEmpty>Nenhuma demanda ou ação encontrada.</CommandEmpty>
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => run(() => onCreate(new Date().toISOString().slice(0, 10)))}><CirclePlus /> Criar demanda para hoje <CommandShortcut>N</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => onCreate(null))}><Inbox /> Capturar na Caixa de Entrada</CommandItem>
          <CommandItem onSelect={() => run(onToday)}><CalendarDays /> Ir para a semana atual</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Demandas">
          {tasks.slice(0, 8).map((task) => {
            const client = CLIENTS.find((item) => item.id === task.clientId);
            return (
              <CommandItem key={task.id} value={`${task.title} ${client?.name ?? ""}`} onSelect={() => run(() => onOpenTask(task))}>
                {task.status === "completed" ? <CheckCircle2 className="text-emerald-500" /> : <Search />}
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {client && <span className="text-xs text-slate-400">{client.name}</span>}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Clientes">
          {CLIENTS.map((client) => <CommandItem key={client.id}><UserRound /><span className="flex-1">{client.name}</span><span className="size-2 rounded-full" style={{ backgroundColor: client.color }} /></CommandItem>)}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
