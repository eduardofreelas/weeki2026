"use client";

import {
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  CirclePlus,
  FileCheck2,
  FileSignature,
  FileText,
  Inbox,
  Search,
  Settings,
  ShoppingBag,
  UserRound,
} from "lucide-react";
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
import type { Client } from "@/features/clients/types";
import type { Task } from "@/features/tasks/types";
import type { Quote, Service } from "@/features/operations/types";
import { FISCAL_FLAGS } from "@/features/fiscal/config";
import type { WeekiArea } from "./sidebar";

export function WeekiCommandPalette({
  open,
  onOpenChange,
  tasks,
  clients,
  quotes,
  services,
  onCreate,
  onOpenTask,
  onToday,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  clients: Client[];
  quotes: Quote[];
  services: Service[];
  onCreate: (date: string | null) => void;
  onOpenTask: (task: Task) => void;
  onToday: () => void;
  onNavigate: (area: WeekiArea) => void;
}) {
  const run = (callback: () => void) => {
    callback();
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Comandos rápidos do Weeki"
      description="Crie ou encontre uma demanda"
      className="top-[36%] max-w-xl rounded-2xl border-slate-200 shadow-2xl"
    >
      <CommandInput placeholder="Buscar cliente, serviço, orçamento ou ação..." />
      <CommandList className="max-h-[360px] p-2">
        <CommandEmpty>Nenhuma demanda ou ação encontrada.</CommandEmpty>
        <CommandGroup heading="Ações rápidas">
          <CommandItem
            onSelect={() =>
              run(() => onCreate(new Date().toISOString().slice(0, 10)))
            }
          >
            <CirclePlus /> Criar demanda para hoje{" "}
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onCreate(null))}>
            <Inbox /> Capturar na Caixa de Entrada
          </CommandItem>
          <CommandItem onSelect={() => run(onToday)}>
            <CalendarDays /> Ir para a semana atual
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate("contracts"))}>
            <FileSignature /> Abrir Contratos
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate("quotes"))}>
            <FileText /> Abrir Orçamentos
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate("services"))}>
            <ShoppingBag /> Abrir Serviços
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate("reports"))}>
            <BarChart3 /> Abrir Relatórios
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate("archives"))}>
            <Archive /> Abrir Arquivados
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate("help"))}>
            <CircleHelp /> Abrir Ajuda
          </CommandItem>
          {FISCAL_FLAGS.moduleEnabled && (
            <CommandItem onSelect={() => run(() => onNavigate("fiscal"))}>
              <FileCheck2 /> Abrir módulo Fiscal
            </CommandItem>
          )}
          <CommandItem onSelect={() => run(() => onNavigate("settings"))}>
            <Settings /> Abrir Configurações
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Operação">
          {quotes.slice(0, 4).map((quote) => (
            <CommandItem
              key={quote.id}
              value={`${quote.number} orçamento`}
              onSelect={() => run(() => onNavigate("quotes"))}
            >
              <FileText />
              <span className="min-w-0 flex-1 truncate">{quote.number}</span>
            </CommandItem>
          ))}
          {services.slice(0, 4).map((service) => (
            <CommandItem
              key={service.id}
              value={`${service.name} serviço vitrine`}
              onSelect={() => run(() => onNavigate("services"))}
            >
              <ShoppingBag />
              <span className="min-w-0 flex-1 truncate">{service.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Demandas">
          {tasks.slice(0, 8).map((task) => {
            const client = clients.find((item) => item.id === task.clientId);
            return (
              <CommandItem
                key={task.id}
                value={`${task.title} ${client?.name ?? ""}`}
                onSelect={() => run(() => onOpenTask(task))}
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="text-emerald-500" />
                ) : (
                  <Search />
                )}
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {client && (
                  <span className="text-xs text-slate-400">{client.name}</span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Clientes">
          {clients.map((client) => (
            <CommandItem key={client.id}>
              <UserRound />
              <span className="flex-1">{client.name}</span>
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: client.color }}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
