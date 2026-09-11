"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingCharge } from "@/features/billing/types";
import type { Client } from "@/features/clients/types";
import type { Engagement, Quote } from "@/features/operations/types";
import {
  ENGAGEMENT_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
} from "@/features/operations/types";
import type { Task } from "@/features/tasks/types";
import type { WeekiArea } from "./sidebar";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function DashboardScreen({
  tasks,
  clients,
  engagements,
  quotes,
  charges,
  onNavigate,
  onCreate,
}: {
  tasks: Task[];
  clients: Client[];
  engagements: Engagement[];
  quotes: Quote[];
  charges: BillingCharge[];
  onNavigate: (area: WeekiArea) => void;
  onCreate: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const activeEngagements = engagements.filter(
    (item) => !["completed", "cancelled"].includes(item.status),
  );
  const overdueTasks = tasks.filter(
    (task) =>
      task.dueDate && task.dueDate < today && task.status !== "completed",
  );
  const pendingCharges = charges.filter((charge) =>
    ["pending", "overdue"].includes(charge.status),
  );
  const overdueCharges = charges.filter(
    (charge) => charge.status === "overdue",
  );
  const pendingQuotes = quotes.filter((quote) =>
    ["sent", "viewed"].includes(quote.status),
  );
  const todayTasks = tasks.filter(
    (task) => task.scheduledDate === today && task.status !== "completed",
  );
  const receivable = pendingCharges.reduce(
    (total, charge) => total + charge.amount,
    0,
  );
  const received = charges
    .filter((charge) => charge.status === "paid")
    .reduce((total, charge) => total + charge.amount, 0);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#654ce4]">
            Visão geral
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Bom dia, organize seu trabalho
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe clientes, serviços, prazos e recebimentos em um só lugar.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onCreate}>
          <Plus className="size-3.5" /> Criar
        </Button>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Atendimentos ativos"
          value={String(activeEngagements.length)}
          detail={`${engagements.filter((item) => item.status === "waiting_client").length} aguardando cliente`}
          icon={ClipboardList}
          tone="violet"
          onClick={() => onNavigate("engagements")}
        />
        <Metric
          label="A receber"
          value={currency.format(receivable)}
          detail={`${overdueCharges.length} cobrança(s) vencida(s)`}
          icon={WalletCards}
          tone="amber"
          onClick={() => onNavigate("billing")}
        />
        <Metric
          label="Recebido"
          value={currency.format(received)}
          detail="Registros locais confirmados"
          icon={CheckCircle2}
          tone="emerald"
          onClick={() => onNavigate("finance")}
        />
        <Metric
          label="Orçamentos aguardando"
          value={String(pendingQuotes.length)}
          detail="Retorno comercial pendente"
          icon={FileText}
          tone="blue"
          onClick={() => onNavigate("commercial")}
        />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Atendimentos ativos
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                O trabalho que está em andamento agora.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("engagements")}
              className="h-8 text-[11px]"
            >
              Ver todos <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
            {activeEngagements.slice(0, 5).map((engagement) => {
              const client = clients.find(
                (item) => item.id === engagement.clientId,
              );
              return (
                <button
                  key={engagement.id}
                  type="button"
                  onClick={() => onNavigate("engagements")}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#efedff] text-[10px] font-bold text-[#654ce4]">
                    {client?.initials ?? "AT"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800">
                      {engagement.name}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-slate-400">
                      {client?.name ?? "Cliente"} · prazo{" "}
                      {formatDate(engagement.dueDate)}
                    </span>
                  </span>
                  <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600 sm:inline-flex">
                    {ENGAGEMENT_STATUS_LABELS[engagement.status]}
                  </span>
                </button>
              );
            })}
            {!activeEngagements.length && (
              <Empty
                title="Nenhum atendimento ativo"
                description="Crie o primeiro atendimento para começar a acompanhar a execução."
                action="Criar atendimento"
                onClick={() => onNavigate("engagements")}
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Hoje</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Prioridades para o dia.
              </p>
            </div>
            <CalendarDays className="size-4 text-[#654ce4]" />
          </div>
          <div className="mt-4 space-y-2">
            {todayTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5"
              >
                <span className="mt-0.5 size-2 rounded-full bg-[#654ce4]" />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-slate-700">
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {task.scheduledTime || "Sem horário"}
                  </p>
                </div>
              </div>
            ))}
            {!todayTasks.length && (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                Nenhuma tarefa para hoje.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigate("week")}
            className="mt-3 h-8 w-full text-[11px]"
          >
            Abrir Minha Semana
          </Button>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <DashboardList
          title="Atenção"
          icon={AlertCircle}
          tone="rose"
          items={overdueTasks
            .slice(0, 4)
            .map((task) => ({
              title: task.title,
              detail: `Prazo ${formatDate(task.dueDate)}`,
            }))}
          empty="Nenhuma tarefa atrasada."
          action={() => onNavigate("week")}
        />
        <DashboardList
          title="Cobranças pendentes"
          icon={ReceiptText}
          tone="amber"
          items={pendingCharges
            .slice(0, 4)
            .map((charge) => ({
              title: charge.description,
              detail: `${currency.format(charge.amount)} · vence ${formatDate(charge.dueDate)}`,
            }))}
          empty="Nenhuma cobrança pendente."
          action={() => onNavigate("billing")}
        />
        <DashboardList
          title="Orçamentos"
          icon={FileText}
          tone="blue"
          items={quotes
            .filter((quote) => quote.status !== "cancelled")
            .slice(0, 4)
            .map((quote) => ({
              title: quote.number,
              detail: `${QUOTE_STATUS_LABELS[quote.status]} · ${currency.format(quote.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}`,
            }))}
          empty="Nenhum orçamento criado."
          action={() => onNavigate("commercial")}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof WalletCards;
  tone: "violet" | "amber" | "emerald" | "blue";
  onClick: () => void;
}) {
  const styles = {
    violet: "bg-[#efedff] text-[#654ce4]",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
    >
      <span
        className={`grid size-9 place-items-center rounded-lg ${styles[tone]}`}
      >
        <Icon className="size-4" />
      </span>
      <span className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="mt-1 block text-xl font-bold tracking-tight text-slate-900">
        {value}
      </span>
      <span className="mt-1 block truncate text-[10px] text-slate-400">
        {detail}
      </span>
    </button>
  );
}

function DashboardList({
  title,
  icon: Icon,
  tone,
  items,
  empty,
  action,
}: {
  title: string;
  icon: typeof AlertCircle;
  tone: "rose" | "amber" | "blue";
  items: Array<{ title: string; detail: string }>;
  empty: string;
  action: () => void;
}) {
  const styles = {
    rose: "text-rose-500 bg-rose-50",
    amber: "text-amber-600 bg-amber-50",
    blue: "text-blue-600 bg-blue-50",
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span
          className={`grid size-8 place-items-center rounded-lg ${styles[tone]}`}
        >
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={action}
            className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
          >
            <p className="truncate text-[11px] font-semibold text-slate-700">
              {item.title}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">
              {item.detail}
            </p>
          </button>
        ))}
        {!items.length && (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-[10px] text-slate-400">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

function Empty({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-[10px] leading-4 text-slate-400">
        {description}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        className="mt-3 h-8 text-[10px]"
      >
        <Plus className="size-3.5" /> {action}
      </Button>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "sem prazo";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}
