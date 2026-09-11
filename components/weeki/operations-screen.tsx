"use client";

import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  KanbanSquare,
  Plus,
  Save,
  Tag,
  Timer,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/features/clients/types";
import type { WeekiOperationsController } from "@/features/operations/use-weeki-operations";
import {
  DELIVERABLE_STATUS_LABELS,
  ENGAGEMENT_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  RECURRENCE_LABELS,
  quoteItemSubtotal,
  quoteSubtotal,
  type Deliverable,
  type Engagement,
  type EngagementStatus,
  type Opportunity,
  type OperationsView,
  type Quote,
  type Service,
  type ServiceRecurrence,
} from "@/features/operations/types";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";
import type { WeekiArea } from "./sidebar";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Props = {
  view: OperationsView;
  controller: WeekiOperationsController;
  clients: Client[];
  tasks: Task[];
  onNavigate: (area: WeekiArea) => void;
  onNewTask: (
    clientId: string,
    engagementId?: string,
    serviceId?: string | null,
  ) => void;
  onCreateStandardTasks: (
    engagement: Engagement,
    service: Service | null,
  ) => void;
  onConvertOpportunity: (opportunity: Opportunity) => void;
};

export function OperationsScreen({
  view,
  controller,
  clients,
  tasks,
  onNavigate,
  onNewTask,
  onCreateStandardTasks,
  onConvertOpportunity,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [opportunityDialog, setOpportunityDialog] = useState(false);
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [engagementDialog, setEngagementDialog] = useState(false);
  const [deliverableDialog, setDeliverableDialog] = useState(false);
  const [timeDialog, setTimeDialog] = useState(false);
  const [serviceDraft, setServiceDraft] = useState(serviceDefaults());
  const [opportunityDraft, setOpportunityDraft] = useState(
    opportunityDefaults(),
  );
  const [quoteDraft, setQuoteDraft] = useState(quoteDefaults());
  const [engagementDraft, setEngagementDraft] = useState(engagementDefaults());
  const [deliverableDraft, setDeliverableDraft] = useState(
    deliverableDefaults(),
  );
  const [timeDraft, setTimeDraft] = useState(timeDefaults());
  const [commercialTab, setCommercialTab] = useState<
    "opportunities" | "quotes"
  >("opportunities");

  const activeServices = controller.services.filter(
    (service) => !service.archivedAt,
  );
  const selectedEngagement =
    controller.engagements.find((item) => item.id === selectedId) ?? null;

  const openNewService = () => {
    setServiceDraft(serviceDefaults());
    setServiceDialog(true);
  };
  const openNewOpportunity = () => {
    setOpportunityDraft(opportunityDefaults());
    setOpportunityDialog(true);
  };
  const openNewQuote = () => {
    setQuoteDraft(quoteDefaults(activeServices[0]?.id ?? ""));
    setQuoteDialog(true);
  };
  const openNewEngagement = () => {
    setEngagementDraft(
      engagementDefaults(clients[0]?.id ?? "", activeServices[0]?.id ?? ""),
    );
    setEngagementDialog(true);
  };

  const saveService = () => {
    if (!serviceDraft.name.trim())
      return toast.error("Informe o nome do serviço.");
    controller.addService({
      ...serviceDraft,
      name: serviceDraft.name.trim(),
      standardTasks: serviceDraft.standardTasks
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setServiceDialog(false);
    toast.success("Serviço criado.");
  };

  const saveOpportunity = () => {
    if (!opportunityDraft.name.trim())
      return toast.error("Informe o nome da oportunidade.");
    controller.addOpportunity({
      ...opportunityDraft,
      name: opportunityDraft.name.trim(),
    });
    setOpportunityDialog(false);
    toast.success("Oportunidade registrada.");
  };

  const saveQuote = () => {
    if (!quoteDraft.clientId && !quoteDraft.opportunityId)
      return toast.error("Selecione um cliente ou oportunidade.");
    if (!quoteDraft.items[0].description.trim())
      return toast.error("Adicione pelo menos um item ao orçamento.");
    const created = controller.addQuote({
      ...quoteDraft,
      items: quoteDraft.items.map((item) => ({
        ...item,
        description: item.description.trim(),
      })),
    });
    if (quoteDraft.opportunityId) {
      const opportunity = controller.opportunities.find(
        (item) => item.id === quoteDraft.opportunityId,
      );
      if (opportunity) {
        controller.updateOpportunity(opportunity.id, {
          ...opportunity,
          quoteId: created.id,
          status: opportunity.status === "new" ? "quote_requested" : opportunity.status,
        });
      }
    }
    setQuoteDialog(false);
    toast.success("Orçamento criado.");
  };

  const saveEngagement = () => {
    if (!engagementDraft.clientId || !engagementDraft.name.trim())
      return toast.error("Informe o nome e o cliente do atendimento.");
    const created = controller.addEngagement({
      ...engagementDraft,
      name: engagementDraft.name.trim(),
    });
    setSelectedId(created.id);
    setEngagementDialog(false);
    toast.success("Atendimento criado.");
    const service =
      controller.services.find((item) => item.id === created.serviceId) ?? null;
    if (service?.standardTasks.length) onCreateStandardTasks(created, service);
  };

  const saveDeliverable = () => {
    if (!selectedEngagement || !deliverableDraft.title.trim())
      return toast.error("Informe o título da entrega.");
    controller.addDeliverable({
      title: deliverableDraft.title.trim(),
      description: deliverableDraft.description,
      date: deliverableDraft.date,
      attachments: deliverableDraft.attachments,
      links: deliverableDraft.linksText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: deliverableDraft.notes,
      status: deliverableDraft.status,
      engagementId: selectedEngagement.id,
    });
    setDeliverableDialog(false);
    toast.success("Entrega registrada.");
  };

  const saveTime = () => {
    if (!selectedEngagement || !timeDraft.minutes || timeDraft.minutes < 1)
      return toast.error("Informe uma duração válida.");
    controller.addTimeEntry({
      ...timeDraft,
      engagementId: selectedEngagement.id,
      clientId: selectedEngagement.clientId,
    });
    setTimeDialog(false);
    toast.success("Tempo registrado.");
  };

  const approveQuote = (quote: Quote) => {
    controller.setQuoteStatus(quote.id, "approved");
    if (!quote.clientId) {
      toast.success(
        "Orçamento aprovado. Converta-o em cliente e atendimento quando houver um cliente definido.",
      );
      return;
    }
    if (quote.engagementId) return;
    const serviceId = quote.items[0]?.serviceId ?? null;
    const service =
      controller.services.find((item) => item.id === serviceId) ?? null;
    const created = controller.addEngagement({
      name: `${service?.name ?? "Serviço"} — ${format(new Date(), "MMMM/yyyy", { locale: ptBR })}`,
      clientId: quote.clientId,
      serviceId,
      responsible: "",
      status: "planning",
      description: quote.description,
      startDate: format(new Date(), "yyyy-MM-dd"),
      dueDate: "",
      value: quoteSubtotal(quote),
      quoteId: quote.id,
      contractId: null,
      recurrence: service?.recurrence ?? "none",
      cycleValue: quoteSubtotal(quote),
    });
    controller.updateQuote(quote.id, {
      ...quote,
      engagementId: created.id,
      status: "approved",
      approvedAt: quote.approvedAt ?? new Date().toISOString(),
    });
    if (service?.standardTasks.length) onCreateStandardTasks(created, service);
    setSelectedId(created.id);
    toast.success("Aprovado e convertido em atendimento.");
  };

  const tabs = [
    {
      id: "engagements" as const,
      label: "Atendimentos",
      icon: BriefcaseBusiness,
    },
    { id: "commercial" as const, label: "Comercial", icon: KanbanSquare },
    { id: "services" as const, label: "Serviços", icon: Tag },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#654ce4]">
            Operação
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {view === "engagements"
              ? "Atendimentos"
              : view === "commercial"
                ? "Comercial"
                : "Serviços"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Conecte oportunidade, orçamento e execução do serviço em um fluxo
            contínuo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "engagements" && (
            <Button type="button" size="sm" onClick={openNewEngagement}>
              <Plus className="size-3.5" /> Novo atendimento
            </Button>
          )}
          {view === "commercial" && (
            <Button
              type="button"
              size="sm"
              onClick={
                commercialTab === "opportunities"
                  ? openNewOpportunity
                  : openNewQuote
              }
            >
              <Plus className="size-3.5" />{" "}
              {commercialTab === "opportunities"
                ? "Nova oportunidade"
                : "Novo orçamento"}
            </Button>
          )}
          {view === "services" && (
            <Button type="button" size="sm" onClick={openNewService}>
              <Plus className="size-3.5" /> Novo serviço
            </Button>
          )}
        </div>
      </div>
      <nav className="mt-5 flex gap-1 overflow-x-auto rounded-lg bg-[#eef0ff] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              onNavigate(tab.id === "commercial" ? "commercial" : tab.id)
            }
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium text-slate-500",
              view === tab.id &&
                "bg-white font-semibold text-slate-800 shadow-sm",
            )}
          >
            <tab.icon
              className={cn("size-3.5", view === tab.id && "text-[#654ce4]")}
            />
            {tab.label}
          </button>
        ))}
      </nav>
      {view === "engagements" && (
        <EngagementsView
          controller={controller}
          clients={clients}
          tasks={tasks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={openNewEngagement}
          onNewTask={onNewTask}
          onNewDeliverable={() => {
            setDeliverableDraft(deliverableDefaults());
            setDeliverableDialog(true);
          }}
          onNewTime={() => {
            setTimeDraft(timeDefaults());
            setTimeDialog(true);
          }}
        />
      )}
      {view === "commercial" && (
        <CommercialView
          controller={controller}
          clients={clients}
          tab={commercialTab}
          onTab={setCommercialTab}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewOpportunity={openNewOpportunity}
          onNewQuote={openNewQuote}
          onApprove={approveQuote}
          onConvertOpportunity={onConvertOpportunity}
        />
      )}
      {view === "services" && (
        <ServicesView
          services={activeServices}
          onNew={openNewService}
          onArchive={(id) => {
            controller.archiveService(id);
            toast.success("Serviço arquivado.");
          }}
        />
      )}

      <ServiceDialog
        open={serviceDialog}
        onOpenChange={setServiceDialog}
        draft={serviceDraft}
        onChange={setServiceDraft}
        onSave={saveService}
      />
      <OpportunityDialog
        open={opportunityDialog}
        onOpenChange={setOpportunityDialog}
        draft={opportunityDraft}
        onChange={setOpportunityDraft}
        services={activeServices}
        onSave={saveOpportunity}
      />
      <QuoteDialog
        open={quoteDialog}
        onOpenChange={setQuoteDialog}
        draft={quoteDraft}
        onChange={setQuoteDraft}
        clients={clients}
        opportunities={controller.opportunities}
        services={activeServices}
        onSave={saveQuote}
      />
      <EngagementDialog
        open={engagementDialog}
        onOpenChange={setEngagementDialog}
        draft={engagementDraft}
        onChange={setEngagementDraft}
        clients={clients}
        services={activeServices}
        onSave={saveEngagement}
      />
      <DeliverableDialog
        open={deliverableDialog}
        onOpenChange={setDeliverableDialog}
        draft={deliverableDraft}
        onChange={setDeliverableDraft}
        onSave={saveDeliverable}
      />
      <TimeDialog
        open={timeDialog}
        onOpenChange={setTimeDialog}
        draft={timeDraft}
        onChange={setTimeDraft}
        onSave={saveTime}
      />
    </div>
  );
}

function EngagementsView({
  controller,
  clients,
  tasks,
  selectedId,
  onSelect,
  onNew,
  onNewTask,
  onNewDeliverable,
  onNewTime,
}: {
  controller: WeekiOperationsController;
  clients: Client[];
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewTask: (
    clientId: string,
    engagementId?: string,
    serviceId?: string | null,
  ) => void;
  onNewDeliverable: () => void;
  onNewTime: () => void;
}) {
  const selected =
    controller.engagements.find((item) => item.id === selectedId) ?? null;
  const active = controller.engagements.filter(
    (item) => !["completed", "cancelled"].includes(item.status),
  );
  const totalValue = active.reduce((sum, item) => sum + item.value, 0);
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          title="Atendimentos ativos"
          value={String(active.length)}
          detail="Em execução ou planejamento"
          icon={BriefcaseBusiness}
        />
        <Metric
          title="Valor em andamento"
          value={currency.format(totalValue)}
          detail="Soma dos atendimentos ativos"
          icon={WalletCards}
        />
        <Metric
          title="Aguardando cliente"
          value={String(
            controller.engagements.filter(
              (item) => item.status === "waiting_client",
            ).length,
          )}
          detail="Próximas ações dependem de retorno"
          icon={UserRound}
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Todos os atendimentos
              </h2>
              <p className="text-[10px] text-slate-400">
                O serviço central do cliente.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNew}
              className="h-8 px-2 text-[10px]"
            >
              <Plus className="size-3.5" /> Novo
            </Button>
          </div>
          <div className="divide-y divide-slate-100">
            {controller.engagements.map((engagement) => {
              const client = clients.find(
                (item) => item.id === engagement.clientId,
              );
              const taskList = tasks.filter(
                (task) => task.engagementId === engagement.id,
              );
              const completed = taskList.filter(
                (task) => task.status === "completed",
              ).length;
              return (
                <button
                  key={engagement.id}
                  type="button"
                  onClick={() => onSelect(engagement.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
                    selectedId === engagement.id && "bg-[#f7f6ff]",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#efedff] text-[10px] font-bold text-[#654ce4]">
                    {client?.initials ?? "AT"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800">
                      {engagement.name}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-slate-400">
                      {client?.name ?? "Cliente"} · {completed}/
                      {taskList.length || 0} tarefas
                    </span>
                  </span>
                  <span
                    className="mt-0.5 size-2 rounded-full"
                    style={{ backgroundColor: statusColor(engagement.status) }}
                  />
                </button>
              );
            })}
            {!controller.engagements.length && (
              <EmptyState
                icon={BriefcaseBusiness}
                title="Nenhum atendimento ainda"
                description="Crie um atendimento e centralize a execução do serviço."
                action="Criar atendimento"
                onClick={onNew}
              />
            )}
          </div>
        </section>
        {selected ? (
          <EngagementDetail
            engagement={selected}
            controller={controller}
            clients={clients}
            tasks={tasks}
            onNewTask={onNewTask}
            onNewDeliverable={onNewDeliverable}
            onNewTime={onNewTime}
          />
        ) : (
          <EmptyState
            icon={BriefcaseBusiness}
            title="Selecione um atendimento"
            description="Aqui você verá tarefas, ciclos, entregas, tempo e situação financeira."
          />
        )}
      </div>
    </>
  );
}

function EngagementDetail({
  engagement,
  controller,
  clients,
  tasks,
  onNewTask,
  onNewDeliverable,
  onNewTime,
}: {
  engagement: Engagement;
  controller: WeekiOperationsController;
  clients: Client[];
  tasks: Task[];
  onNewTask: (
    clientId: string,
    engagementId?: string,
    serviceId?: string | null,
  ) => void;
  onNewDeliverable: () => void;
  onNewTime: () => void;
}) {
  const client = clients.find((item) => item.id === engagement.clientId);
  const service =
    controller.services.find((item) => item.id === engagement.serviceId) ??
    null;
  const linkedTasks = tasks.filter(
    (task) => task.engagementId === engagement.id,
  );
  const completedTasks = linkedTasks.filter(
    (task) => task.status === "completed",
  ).length;
  const progress = linkedTasks.length
    ? Math.round((completedTasks / linkedTasks.length) * 100)
    : 0;
  const deliverables = controller.deliverables.filter(
    (item) => item.engagementId === engagement.id,
  );
  const timeEntries = controller.timeEntries.filter(
    (item) => item.engagementId === engagement.id,
  );
  const minutes = timeEntries.reduce((sum, item) => sum + item.minutes, 0);
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-[#efedff] text-[#654ce4]">
                <BriefcaseBusiness className="size-4" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#654ce4]">
                Atendimento
              </span>
            </div>
            <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
              {engagement.name}
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              {client?.name ?? "Cliente"}
              {service ? ` · ${service.name}` : ""}
            </p>
          </div>
          <Select
            value={engagement.status}
            onValueChange={(value) =>
              controller.setEngagementStatus(
                engagement.id,
                value as EngagementStatus,
              )
            }
          >
            <SelectTrigger className="h-8 w-[170px] rounded-md text-[10px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENGAGEMENT_STATUS_LABELS).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Summary label="Valor" value={currency.format(engagement.value)} />
          <Summary label="Prazo" value={formatDate(engagement.dueDate)} />
          <Summary
            label="Progresso"
            value={`${completedTasks}/${linkedTasks.length} · ${progress}%`}
          />
          <Summary label="Horas" value={formatMinutes(minutes)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onNewTask(
                engagement.clientId,
                engagement.id,
                engagement.serviceId,
              )
            }
          >
            <Plus className="size-3.5" /> Nova tarefa
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewDeliverable}
          >
            <FolderOpen className="size-3.5" /> Registrar entrega
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onNewTime}>
            <Timer className="size-3.5" /> Registrar tempo
          </Button>
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <Panel
          title="Tarefas"
          icon={CheckCircle2}
          action={
            <span className="text-[10px] text-slate-400">
              {completedTasks} concluídas
            </span>
          }
        >
          {linkedTasks.length ? (
            <div className="space-y-2">
              {linkedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      task.status === "completed"
                        ? "bg-emerald-500"
                        : "bg-violet-400",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700",
                      task.status === "completed" &&
                        "text-slate-400 line-through",
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {task.dueDate ? formatDate(task.dueDate) : "sem prazo"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <SmallEmpty text="Nenhuma tarefa vinculada. Crie a primeira para acompanhar o progresso." />
          )}
        </Panel>
        <Panel
          title="Ciclos"
          icon={CalendarDays}
          action={
            <span className="text-[10px] text-slate-400">
              {
                controller.cycles.filter(
                  (item) => item.engagementId === engagement.id,
                ).length
              }{" "}
              ciclos
            </span>
          }
        >
          {controller.cycles.filter(
            (item) => item.engagementId === engagement.id,
          ).length ? (
            <div className="space-y-2">
              {controller.cycles
                .filter((item) => item.engagementId === engagement.id)
                .map((cycle) => (
                  <div
                    key={cycle.id}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span className="size-2 rounded-full bg-blue-500" />
                    <span className="flex-1 text-[11px] font-medium text-slate-700">
                      {cycle.label}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {cycle.status === "open" ? "Aberto" : "Fechado"}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <SmallEmpty
              text={
                engagement.recurrence === "none"
                  ? "Serviço único, sem ciclos recorrentes."
                  : "Crie o primeiro ciclo deste serviço recorrente."
              }
            />
          )}
        </Panel>
        <Panel
          title="Entregas"
          icon={FolderOpen}
          action={
            <span className="text-[10px] text-slate-400">
              {deliverables.length} registradas
            </span>
          }
        >
          {deliverables.length ? (
            <div className="space-y-2">
              {deliverables.map((item) => (
                <div key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700">
                      {item.title}
                    </span>
                    <Select
                      value={item.status}
                      onValueChange={(value) =>
                        controller.setDeliverableStatus(
                          item.id,
                          value as Deliverable["status"],
                        )
                      }
                    >
                      <SelectTrigger className="h-6 w-[130px] border-0 bg-white text-[9px] shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DELIVERABLE_STATUS_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">
                    {item.description || "Sem descrição."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <SmallEmpty text="Registre o que foi efetivamente entregue ao cliente." />
          )}
        </Panel>
        <Panel
          title="Tempo e contexto"
          icon={Clock3}
          action={
            <span className="text-[10px] font-semibold text-slate-500">
              {formatMinutes(minutes)}
            </span>
          }
        >
          {timeEntries.length ? (
            <div className="space-y-2">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="flex-1 truncate text-[11px] text-slate-700">
                    {entry.description || "Tempo trabalhado"}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500">
                    {formatMinutes(entry.minutes)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <SmallEmpty text="Registre horas manualmente para acompanhar o valor efetivo do serviço." />
          )}
        </Panel>
      </div>
    </section>
  );
}

function CommercialView({
  controller,
  clients,
  tab,
  onTab,
  selectedId,
  onSelect,
  onNewOpportunity,
  onNewQuote,
  onApprove,
  onConvertOpportunity,
}: {
  controller: WeekiOperationsController;
  clients: Client[];
  tab: "opportunities" | "quotes";
  onTab: (tab: "opportunities" | "quotes") => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewOpportunity: () => void;
  onNewQuote: () => void;
  onApprove: (quote: Quote) => void;
  onConvertOpportunity: (opportunity: Opportunity) => void;
}) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onTab("opportunities")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px] font-semibold text-slate-500",
              tab === "opportunities" && "bg-white text-slate-800 shadow-sm",
            )}
          >
            Oportunidades{" "}
            <span className="ml-1 text-[10px] text-slate-400">
              {controller.opportunities.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onTab("quotes")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px] font-semibold text-slate-500",
              tab === "quotes" && "bg-white text-slate-800 shadow-sm",
            )}
          >
            Orçamentos{" "}
            <span className="ml-1 text-[10px] text-slate-400">
              {controller.quotes.length}
            </span>
          </button>
        </div>
        <span className="text-[10px] text-slate-400">
          Fluxo: oportunidade → orçamento → atendimento
        </span>
      </div>
      {tab === "opportunities" ? (
        <OpportunityTable
          opportunities={controller.opportunities}
          services={controller.services}
          onNew={onNewOpportunity}
          onSelect={onSelect}
          onConvert={onConvertOpportunity}
        />
      ) : (
        <QuoteTable
          quotes={controller.quotes}
          clients={clients}
          onNew={onNewQuote}
          onApprove={onApprove}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      )}
    </section>
  );
}

function OpportunityTable({
  opportunities,
  services,
  onNew,
  onSelect,
  onConvert,
}: {
  opportunities: Opportunity[];
  services: Service[];
  onNew: () => void;
  onSelect: (id: string) => void;
  onConvert: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="overflow-x-auto">
      {opportunities.length ? (
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Oportunidade</th>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3">Próxima ação</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opportunities.map((item) => (
              <tr key={item.id} className="text-[11px] text-slate-600">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    {item.company || "Sem empresa"}{" "}
                    {item.clientId ? "· cliente convertido" : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {services.find((service) => service.id === item.serviceId)
                    ?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <p>{item.nextAction || "—"}</p>
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    {formatDate(item.nextActionDate)}
                  </p>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {currency.format(item.estimatedValue)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">
                    {OPPORTUNITY_STATUS_LABELS[item.status]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelect(item.id)}
                    className="h-7 px-2 text-[10px]"
                  >
                    Abrir <ChevronRight className="size-3" />
                  </Button>
                  {!item.clientId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onConvert(item)}
                      className="ml-1 h-7 text-[10px]"
                    >
                      Converter
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          icon={KanbanSquare}
          title="Nenhuma oportunidade ainda"
          description="Registre potenciais trabalhos antes de eles virarem clientes ou atendimentos."
          action="Criar oportunidade"
          onClick={onNew}
        />
      )}
    </div>
  );
}

function QuoteTable({
  quotes,
  clients,
  onNew,
  onApprove,
  onSelect,
  selectedId,
}: {
  quotes: Quote[];
  clients: Client[];
  onNew: () => void;
  onApprove: (quote: Quote) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      {quotes.length ? (
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Orçamento</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Validade</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote) => (
              <tr
                key={quote.id}
                className={cn(
                  "text-[11px] text-slate-600",
                  selectedId === quote.id && "bg-violet-50/40",
                )}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(quote.id)}
                    className="text-left"
                  >
                    <p className="font-semibold text-slate-800">
                      {quote.number}
                    </p>
                    <p className="mt-0.5 max-w-[260px] truncate text-[9px] text-slate-400">
                      {quote.description || "Sem descrição"}
                    </p>
                  </button>
                </td>
                <td className="px-4 py-3">
                  {clients.find((client) => client.id === quote.clientId)
                    ?.name ?? "Sem cliente"}
                </td>
                <td className="px-4 py-3">{formatDate(quote.validUntil)}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {currency.format(quoteSubtotal(quote))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[9px] font-semibold",
                      quote.status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : quote.status === "rejected"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {QUOTE_STATUS_LABELS[quote.status]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {!["approved", "cancelled", "rejected"].includes(
                    quote.status,
                  ) &&
                    quote.clientId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onApprove(quote)}
                        className="h-7 text-[10px]"
                      >
                        <CheckCircle2 className="size-3" /> Aprovar
                      </Button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          icon={FileText}
          title="Nenhum orçamento ainda"
          description="Crie seu primeiro orçamento e transforme oportunidades em novos serviços."
          action="Criar orçamento"
          onClick={onNew}
        />
      )}
    </div>
  );
}

function ServicesView({
  services,
  onNew,
  onArchive,
}: {
  services: Service[];
  onNew: () => void;
  onArchive: (id: string) => void;
}) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Modelos de serviço
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Preço, recorrência e tarefas padrão reutilizáveis.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNew}
          className="h-8 text-[10px]"
        >
          <Plus className="size-3.5" /> Novo serviço
        </Button>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <article
            key={service.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#efedff] text-[#654ce4]">
                <Tag className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xs font-bold text-slate-800">
                  {service.name}
                </h3>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {service.category || "Sem categoria"} ·{" "}
                  {RECURRENCE_LABELS[service.recurrence]}
                </p>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-slate-500">
              {service.description || "Sem descrição."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-slate-400">
                  Preço padrão
                </p>
                <p className="mt-1 text-xs font-bold text-slate-800">
                  {currency.format(service.defaultPrice)}
                  {service.unit ? (
                    <span className="text-[9px] font-normal text-slate-400">
                      {" "}
                      / {service.unit}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[9px] uppercase tracking-wide text-slate-400">
                  Tarefas padrão
                </p>
                <p className="mt-1 text-xs font-bold text-slate-800">
                  {service.standardTasks.length}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {service.defaultDurationDays
                  ? `${service.defaultDurationDays} dias`
                  : "Prazo não definido"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onArchive(service.id)}
                className="h-7 px-2 text-[10px] text-slate-400 hover:text-rose-600"
              >
                <Archive className="size-3" /> Arquivar
              </Button>
            </div>
          </article>
        ))}
        {!services.length && (
          <div className="col-span-full">
            <EmptyState
              icon={Tag}
              title="Nenhum serviço cadastrado"
              description="Cadastre seus serviços para reaproveitar preços, prazos e tarefas em novos atendimentos."
              action="Criar serviço"
              onClick={onNew}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ServiceDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReturnType<typeof serviceDefaults>;
  onChange: (draft: ReturnType<typeof serviceDefaults>) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-2xl overflow-y-auto rounded-xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-sm">Novo serviço</DialogTitle>
          <DialogDescription className="text-[10px]">
            Crie um modelo operacional reutilizável.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              placeholder="Ex.: Gestão de redes sociais"
            />
          </Field>
          <Field label="Categoria">
            <Input
              value={draft.category}
              onChange={(event) =>
                onChange({ ...draft, category: event.target.value })
              }
              placeholder="Comunicação, Digital..."
            />
          </Field>
          <Field label="Preço padrão">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.defaultPrice}
              onChange={(event) =>
                onChange({
                  ...draft,
                  defaultPrice: Number(event.target.value || 0),
                })
              }
            />
          </Field>
          <Field label="Unidade">
            <Input
              value={draft.unit}
              onChange={(event) =>
                onChange({ ...draft, unit: event.target.value })
              }
              placeholder="projeto, mês, hora"
            />
          </Field>
          <Field label="Recorrência">
            <Select
              value={draft.recurrence}
              onValueChange={(value) =>
                onChange({ ...draft, recurrence: value as ServiceRecurrence })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prazo padrão (dias)">
            <Input
              type="number"
              min="0"
              value={draft.defaultDurationDays}
              onChange={(event) =>
                onChange({
                  ...draft,
                  defaultDurationDays: Number(event.target.value || 0),
                })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descrição">
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  onChange({ ...draft, description: event.target.value })
                }
                rows={3}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Tarefas padrão">
              <Textarea
                value={draft.standardTasks}
                onChange={(event) =>
                  onChange({ ...draft, standardTasks: event.target.value })
                }
                placeholder="Uma tarefa por linha"
                rows={4}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Elas poderão ser criadas automaticamente ao iniciar um
                atendimento.
              </p>
            </Field>
          </div>
        </div>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onSave}>
            <Save className="size-3.5" /> Salvar serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpportunityDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  services,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReturnType<typeof opportunityDefaults>;
  onChange: (draft: ReturnType<typeof opportunityDefaults>) => void;
  services: Service[];
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-xl rounded-xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-sm">Nova oportunidade</DialogTitle>
          <DialogDescription className="text-[10px]">
            Registre um potencial trabalho sem criar um CRM complexo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              placeholder="Nome do contato ou projeto"
            />
          </Field>
          <Field label="Empresa">
            <Input
              value={draft.company}
              onChange={(event) =>
                onChange({ ...draft, company: event.target.value })
              }
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={draft.phone}
              onChange={(event) =>
                onChange({ ...draft, phone: event.target.value })
              }
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={draft.email}
              onChange={(event) =>
                onChange({ ...draft, email: event.target.value })
              }
            />
          </Field>
          <Field label="Serviço de interesse">
            <Select
              value={draft.serviceId || "none"}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  serviceId: value === "none" ? null : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ainda não definido</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Origem">
            <Input
              value={draft.source}
              onChange={(event) =>
                onChange({ ...draft, source: event.target.value })
              }
              placeholder="Indicação, site..."
            />
          </Field>
          <Field label="Valor estimado">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.estimatedValue}
              onChange={(event) =>
                onChange({
                  ...draft,
                  estimatedValue: Number(event.target.value || 0),
                })
              }
            />
          </Field>
          <Field label="Próxima ação">
            <Input
              value={draft.nextAction}
              onChange={(event) =>
                onChange({ ...draft, nextAction: event.target.value })
              }
            />
          </Field>
          <Field label="Data da ação">
            <Input
              type="date"
              value={draft.nextActionDate}
              onChange={(event) =>
                onChange({ ...draft, nextActionDate: event.target.value })
              }
            />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onValueChange={(value) =>
                onChange({ ...draft, status: value as Opportunity["status"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OPPORTUNITY_STATUS_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <Textarea
                value={draft.notes}
                onChange={(event) =>
                  onChange({ ...draft, notes: event.target.value })
                }
                rows={3}
              />
            </Field>
          </div>
        </div>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onSave}>
            <Save className="size-3.5" /> Salvar oportunidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuoteDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  clients,
  opportunities,
  services,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReturnType<typeof quoteDefaults>;
  onChange: (draft: ReturnType<typeof quoteDefaults>) => void;
  clients: Client[];
  opportunities: Opportunity[];
  services: Service[];
  onSave: () => void;
}) {
  const item = draft.items[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-2xl overflow-y-auto rounded-xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-sm">Novo orçamento</DialogTitle>
          <DialogDescription className="text-[10px]">
            Valores e condições ficam registrados para aprovação e conversão.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Cliente">
            <Select
              value={draft.clientId || "none"}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  clientId: value === "none" ? null : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecionar depois</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Oportunidade">
            <Select
              value={draft.opportunityId || "none"}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  opportunityId: value === "none" ? null : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem oportunidade</SelectItem>
                {opportunities.map((opportunity) => (
                  <SelectItem key={opportunity.id} value={opportunity.id}>
                    {opportunity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Serviço">
              <Select
                value={item.serviceId || "none"}
                onValueChange={(value) => {
                  const service = services.find((entry) => entry.id === value);
                  onChange({
                    ...draft,
                    items: [
                      {
                        ...item,
                        serviceId: value === "none" ? null : value,
                        description: service?.name ?? item.description,
                        unitPrice: service?.defaultPrice ?? item.unitPrice,
                      },
                    ],
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Adicionar manualmente</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descrição do item" required>
              <Input
                value={item.description}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    items: [{ ...item, description: event.target.value }],
                  })
                }
                placeholder="O que será entregue"
              />
            </Field>
          </div>
          <Field label="Quantidade">
            <Input
              type="number"
              min="1"
              step="1"
              value={item.quantity}
              onChange={(event) =>
                onChange({
                  ...draft,
                  items: [
                    { ...item, quantity: Number(event.target.value || 1) },
                  ],
                })
              }
            />
          </Field>
          <Field label="Valor unitário">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.unitPrice}
              onChange={(event) =>
                onChange({
                  ...draft,
                  items: [
                    { ...item, unitPrice: Number(event.target.value || 0) },
                  ],
                })
              }
            />
          </Field>
          <Field label="Desconto">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.discount}
              onChange={(event) =>
                onChange({
                  ...draft,
                  items: [
                    { ...item, discount: Number(event.target.value || 0) },
                  ],
                })
              }
            />
          </Field>
          <Field label="Acréscimo">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.addition}
              onChange={(event) =>
                onChange({
                  ...draft,
                  items: [
                    { ...item, addition: Number(event.target.value || 0) },
                  ],
                })
              }
            />
          </Field>
          <div className="rounded-lg bg-[#f5f3ff] p-3 sm:col-span-2">
            <p className="text-[10px] font-semibold text-[#654ce4]">
              Total do orçamento
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {currency.format(quoteItemSubtotal(item))}
            </p>
          </div>
          <Field label="Prazo estimado">
            <Input
              value={draft.estimatedDeadline}
              onChange={(event) =>
                onChange({ ...draft, estimatedDeadline: event.target.value })
              }
              placeholder="Ex.: 30 dias"
            />
          </Field>
          <Field label="Validade">
            <Input
              type="date"
              value={draft.validUntil}
              onChange={(event) =>
                onChange({ ...draft, validUntil: event.target.value })
              }
            />
          </Field>
          <Field label="Forma de pagamento">
            <Input
              value={draft.paymentMethod}
              onChange={(event) =>
                onChange({ ...draft, paymentMethod: event.target.value })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Condições e observações">
              <Textarea
                value={draft.terms}
                onChange={(event) =>
                  onChange({ ...draft, terms: event.target.value })
                }
                rows={3}
              />
            </Field>
          </div>
        </div>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onSave}>
            <Save className="size-3.5" /> Salvar orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EngagementDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  clients,
  services,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReturnType<typeof engagementDefaults>;
  onChange: (draft: ReturnType<typeof engagementDefaults>) => void;
  clients: Client[];
  services: Service[];
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-xl rounded-xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-sm">Novo atendimento</DialogTitle>
          <DialogDescription className="text-[10px]">
            Conecte cliente, serviço, execução e prazo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              placeholder="Ex.: Gestão de Comunicação — Setembro"
            />
          </Field>
          <Field label="Cliente" required>
            <Select
              value={draft.clientId}
              onValueChange={(value) => onChange({ ...draft, clientId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Serviço">
            <Select
              value={draft.serviceId || "none"}
              onValueChange={(value) => {
                const service = services.find((item) => item.id === value);
                onChange({
                  ...draft,
                  serviceId: value === "none" ? null : value,
                  value: service?.defaultPrice ?? draft.value,
                  recurrence: service?.recurrence ?? draft.recurrence,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem serviço</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valor">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.value}
              onChange={(event) =>
                onChange({ ...draft, value: Number(event.target.value || 0) })
              }
            />
          </Field>
          <Field label="Início">
            <Input
              type="date"
              value={draft.startDate}
              onChange={(event) =>
                onChange({ ...draft, startDate: event.target.value })
              }
            />
          </Field>
          <Field label="Prazo">
            <Input
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                onChange({ ...draft, dueDate: event.target.value })
              }
            />
          </Field>
          <Field label="Recorrência">
            <Select
              value={draft.recurrence}
              onValueChange={(value) =>
                onChange({ ...draft, recurrence: value as ServiceRecurrence })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onValueChange={(value) =>
                onChange({ ...draft, status: value as EngagementStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENGAGEMENT_STATUS_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descrição">
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  onChange({ ...draft, description: event.target.value })
                }
                rows={3}
              />
            </Field>
          </div>
        </div>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onSave}>
            <Save className="size-3.5" /> Criar atendimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliverableDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReturnType<typeof deliverableDefaults>;
  onChange: (draft: ReturnType<typeof deliverableDefaults>) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-lg rounded-xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-sm">Registrar entrega</DialogTitle>
          <DialogDescription className="text-[10px]">
            Mantenha o histórico do que foi efetivamente entregue.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4">
          <Field label="Título" required>
            <Input
              value={draft.title}
              onChange={(event) =>
                onChange({ ...draft, title: event.target.value })
              }
            />
          </Field>
          <Field label="Data">
            <Input
              type="date"
              value={draft.date}
              onChange={(event) =>
                onChange({ ...draft, date: event.target.value })
              }
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={draft.description}
              onChange={(event) =>
                onChange({ ...draft, description: event.target.value })
              }
              rows={4}
            />
          </Field>
          <Field label="Links">
            <Input
              value={draft.linksText}
              onChange={(event) =>
                onChange({ ...draft, linksText: event.target.value })
              }
              placeholder="Um link por linha"
            />
          </Field>
        </div>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onSave}>
            <Save className="size-3.5" /> Registrar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReturnType<typeof timeDefaults>;
  onChange: (draft: ReturnType<typeof timeDefaults>) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-lg rounded-xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-sm">Registrar tempo</DialogTitle>
          <DialogDescription className="text-[10px]">
            O registro manual já permite calcular horas por atendimento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Descrição" required>
            <Input
              value={draft.description}
              onChange={(event) =>
                onChange({ ...draft, description: event.target.value })
              }
              placeholder="O que foi feito"
            />
          </Field>
          <Field label="Data">
            <Input
              type="date"
              value={draft.date}
              onChange={(event) =>
                onChange({ ...draft, date: event.target.value })
              }
            />
          </Field>
          <Field label="Minutos" required>
            <Input
              type="number"
              min="1"
              step="15"
              value={draft.minutes}
              onChange={(event) =>
                onChange({ ...draft, minutes: Number(event.target.value || 0) })
              }
            />
          </Field>
        </div>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onSave}>
            <Save className="size-3.5" /> Registrar tempo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof BriefcaseBusiness;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#efedff] text-[#654ce4]">
          <Icon className="size-4" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </span>
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[9px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-bold text-slate-800">{value}</p>
    </div>
  );
}
function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof BriefcaseBusiness;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-[#654ce4]" />
        <h3 className="text-xs font-semibold text-slate-800">{title}</h3>
        <span className="ml-auto">{action}</span>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-[10px] font-semibold text-slate-600">
      {label}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: typeof BriefcaseBusiness;
  title: string;
  description: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="grid min-h-64 place-items-center px-5 py-10 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#efedff] text-[#654ce4]">
          <Icon className="size-5" />
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-slate-400">
          {description}
        </p>
        {action && onClick && (
          <Button
            type="button"
            size="sm"
            onClick={onClick}
            className="mt-4 h-8 text-[10px]"
          >
            <Plus className="size-3.5" /> {action}
          </Button>
        )}
      </div>
    </div>
  );
}
function SmallEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-[10px] leading-4 text-slate-400">
      {text}
    </p>
  );
}
function statusColor(status: EngagementStatus) {
  return {
    planning: "#94a3b8",
    waiting_start: "#f59e0b",
    in_progress: "#7c3aed",
    waiting_client: "#f59e0b",
    review: "#2563eb",
    completed: "#10b981",
    cancelled: "#ef4444",
  }[status];
}
function formatDate(value: string) {
  if (!value) return "sem prazo";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}
function formatMinutes(minutes: number) {
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? `${String(minutes % 60).padStart(2, "0")}` : ""}`;
}
function serviceDefaults() {
  return {
    name: "",
    description: "",
    category: "",
    defaultPrice: 0,
    billingType: "fixed" as const,
    unit: "projeto",
    defaultDurationDays: 0,
    fiscalCode: "",
    taxRate: 0,
    contractTemplateId: null,
    standardTasks: "",
    recurrence: "none" as ServiceRecurrence,
    archivedAt: null,
  };
}
function opportunityDefaults() {
  return {
    name: "",
    company: "",
    phone: "",
    email: "",
    serviceId: null as string | null,
    source: "",
    estimatedValue: 0,
    notes: "",
    nextAction: "",
    nextActionDate: "",
    status: "new" as Opportunity["status"],
    clientId: null as string | null,
    quoteId: null as string | null,
  };
}
function quoteDefaults(serviceId = "") {
  return {
    clientId: null as string | null,
    opportunityId: null as string | null,
    items: [
      {
        id: `item-${Date.now()}`,
        serviceId: serviceId || null,
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        addition: 0,
      },
    ],
    description: "",
    estimatedDeadline: "",
    validUntil: "",
    notes: "",
    terms: "",
    paymentMethod: "",
    status: "draft" as const,
    approvedAt: null as string | null,
    engagementId: null as string | null,
  };
}
function engagementDefaults(clientId = "", serviceId = "") {
  return {
    name: "",
    clientId,
    serviceId: serviceId || null,
    responsible: "",
    status: "planning" as EngagementStatus,
    description: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: "",
    value: 0,
    quoteId: null as string | null,
    contractId: null as string | null,
    recurrence: "none" as ServiceRecurrence,
    cycleValue: 0,
  };
}
function deliverableDefaults() {
  return {
    title: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    attachments: [] as string[],
    links: [] as string[],
    linksText: "",
    notes: "",
    status: "preparing" as Deliverable["status"],
  };
}
function timeDefaults() {
  return {
    taskId: null as string | null,
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    minutes: 60,
    billable: true,
  };
}
