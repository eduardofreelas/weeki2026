"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  addDays,
  addWeeks,
  format,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Inbox,
  Kanban,
  LayoutList,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { AppointmentsScreen } from "@/components/weeki/appointments-screen";
import { AuthScreen } from "@/components/weeki/auth-screen";
import { BillingScreen } from "@/components/weeki/billing-screen";
import { ClientsScreen } from "@/components/weeki/clients-screen";
import { ContractsScreen } from "@/components/weeki/contracts-screen";
import { DashboardScreen } from "@/components/weeki/dashboard-screen";
import { FinanceScreen } from "@/components/weeki/finance-screen";
import { FiscalAutomationDialog } from "@/components/fiscal/fiscal-automation-dialog";
import {
  FiscalScreen,
  type FiscalView,
} from "@/components/fiscal/fiscal-screen";
import { OnboardingScreen } from "@/components/weeki/onboarding-screen";
import { WeekiCommandPalette } from "@/components/weeki/command-palette";
import { OperationsScreen } from "@/components/weeki/operations-screen";
import { ReportsScreen } from "@/components/weeki/reports-screen";
import {
  MobileNavigation,
  WeekiSidebar,
  type WeekiArea,
} from "@/components/weeki/sidebar";
import { SettingsScreen } from "@/components/weeki/settings-screen";
import { TaskCard } from "@/components/weeki/task-card";
import { TaskSheet } from "@/components/weeki/task-sheet";
import {
  WeekBoard,
  WeekSummary,
  isWeekLayoutMode,
  type WeekLayoutMode,
  type WeekViewMode,
} from "@/components/weeki/week-board";
import { useWeekiClients } from "@/features/clients/use-weeki-clients";
import { useWeekiBilling } from "@/features/billing/use-weeki-billing";
import { useWeekiContracts } from "@/features/contracts/use-weeki-contracts";
import { publishServiceCompleted } from "@/features/fiscal/events";
import { FISCAL_FLAGS } from "@/features/fiscal/config";
import { useWeekiFiscal } from "@/features/fiscal/use-weeki-fiscal";
import {
  shouldShowOnboarding,
  useWeekiAccount,
} from "@/features/account/use-weeki-account";
import { useWeekiAvailability } from "@/features/availability/use-weeki-availability";
import { useWeekiReports } from "@/features/reports/use-weeki-reports";
import { useWeekiOperations } from "@/features/operations/use-weeki-operations";
import type {
  Engagement,
  Opportunity,
  OperationsView,
  Service,
} from "@/features/operations/types";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  type Task,
  type TaskDraft,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/types";
import { useWeekiTasks } from "@/features/tasks/use-weeki-tasks";
import { useWeekiSettings } from "@/features/settings/use-weeki-settings";
import { cn } from "@/lib/utils";

const initialWeek = () => startOfWeek(new Date(), { weekStartsOn: 1 });
const subscribeToHydration = () => () => undefined;
const areaHeader: Record<WeekiArea, { group: string; page: string }> = {
  dashboard: { group: "Visão geral", page: "Início" },
  week: { group: "Planejamento", page: "Minha Semana" },
  engagements: { group: "Trabalho", page: "Atendimentos" },
  clients: { group: "Relacionamento", page: "Clientes" },
  commercial: { group: "Comercial", page: "Oportunidades e orçamentos" },
  services: { group: "Comercial", page: "Serviços" },
  contracts: { group: "Relacionamento", page: "Contratos" },
  appointments: { group: "Atendimentos", page: "Agenda" },
  reports: { group: "Relacionamento", page: "Relatórios" },
  finance: { group: "Gestão", page: "Financeiro" },
  billing: { group: "Gestão", page: "Cobranças" },
  fiscal: { group: "Gestão", page: "Fiscal" },
  settings: { group: "Conta", page: "Configurações" },
};

export default function Home() {
  const {
    tasks,
    addTask,
    updateTask,
    moveTask,
    assignTaskClient,
    setTaskStatus,
    setTaskPriority,
    toggleComplete,
    duplicateTask,
    archiveTask,
  } = useWeekiTasks();
  const { clients, addClient, updateClient } = useWeekiClients();
  const billing = useWeekiBilling();
  const operations = useWeekiOperations();
  const contracts = useWeekiContracts();
  const reports = useWeekiReports();
  const fiscal = useWeekiFiscal(clients);
  const { settings, updateSettings } = useWeekiSettings();
  const account = useWeekiAccount();
  const availabilityController = useWeekiAvailability(
    settings.regional.timezone,
    account.session?.availability,
  );
  const [activeArea, setActiveArea] = useState<WeekiArea>("week");
  const [operationsView, setOperationsView] =
    useState<OperationsView>("engagements");
  const [initialPayments, setInitialPayments] = useState(false);
  const [initialSettingsView, setInitialSettingsView] = useState<
    "availability" | "payments" | undefined
  >();
  const [fiscalView, setFiscalView] = useState<FiscalView>("overview");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const area = params.get("area");
    if (
      area === "dashboard" ||
      area === "engagements" ||
      area === "commercial" ||
      area === "services" ||
      area === "billing" ||
      area === "settings" ||
      area === "reports" ||
      (area === "fiscal" && FISCAL_FLAGS.moduleEnabled)
    ) {
      // Restore the target after an authenticated provider callback.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveArea(area);
      if (
        area === "commercial" ||
        area === "services" ||
        area === "engagements"
      )
        setOperationsView(
          area === "commercial"
            ? "commercial"
            : area === "services"
              ? "services"
              : "engagements",
        );
      setInitialPayments(params.get("section") === "payments");
      setInitialSettingsView(
        params.get("section") === "availability"
          ? "availability"
          : params.get("section") === "payments"
            ? "payments"
            : undefined,
      );
      if (area === "fiscal") {
        const section = params.get("section");
        if (
          section === "notes" ||
          section === "issue" ||
          section === "settings"
        )
          setFiscalView(section);
      }
      if (params.has("payment_error"))
        toast.error(
          "Não foi possível concluir a conexão. Verifique a autorização e tente novamente.",
        );
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const navigateArea = useCallback((area: WeekiArea) => {
    if (area === "settings") {
      setInitialPayments(false);
      setInitialSettingsView(undefined);
    }
    if (
      area === "engagements" ||
      area === "commercial" ||
      area === "services"
    ) {
      setOperationsView(
        area === "commercial"
          ? "commercial"
          : area === "services"
            ? "services"
            : "engagements",
      );
    }
    setActiveArea(area);
  }, []);
  const openPayments = () => {
    setInitialPayments(true);
    setInitialSettingsView("payments");
    setActiveArea("settings");
  };
  const openAvailabilitySettings = useCallback(() => {
    setInitialPayments(false);
    setInitialSettingsView("availability");
    setActiveArea("settings");
  }, []);

  const [weekStart, setWeekStart] = useState(initialWeek);
  const [viewMode, setViewMode] = useState<WeekViewMode>("week");
  const [layoutMode, setLayoutMode] = useState<WeekLayoutMode>(() => {
    if (typeof window === "undefined") return "board";
    const savedLayout = window.localStorage.getItem("weeki.week-layout.v1");
    return isWeekLayoutMode(savedLayout) ? savedLayout : "board";
  });
  const [showWeekend, setShowWeekend] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const [initialTime, setInitialTime] = useState("");
  const [initialClientId, setInitialClientId] = useState<string | null>(null);
  const [initialEngagementId, setInitialEngagementId] = useState<string | null>(
    null,
  );
  const [initialServiceId, setInitialServiceId] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const profileInitials =
    settings.profile.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "WK";

  useEffect(() => {
    const profile = account.session?.profile;
    if (!profile) return;
    const nextProfile = {
      ...settings.profile,
      name: profile.name || settings.profile.name,
      email: profile.email || settings.profile.email,
      avatarUrl: profile.avatarUrl,
      phone: profile.phone,
      professionalName:
        profile.professionalName ||
        profile.name ||
        settings.profile.professionalName,
      businessName: profile.businessName || settings.profile.businessName,
      businessArea: profile.businessArea || settings.profile.businessArea,
      workDescription:
        profile.workDescription || settings.profile.workDescription,
      workspaceName: profile.workspaceName || settings.profile.workspaceName,
    };
    const nextRegional = {
      ...settings.regional,
      timezone: profile.timezone || settings.regional.timezone,
    };
    if (
      JSON.stringify(nextProfile) !== JSON.stringify(settings.profile) ||
      nextRegional.timezone !== settings.regional.timezone
    ) {
      updateSettings({ profile: nextProfile, regional: nextRegional });
    }
  }, [
    account.session?.profile,
    settings.profile,
    settings.regional,
    updateSettings,
  ]);

  const saveAvailability = useCallback(
    async (availability: typeof availabilityController.availability) => {
      const saved = await availabilityController.saveAvailability(availability);
      if (account.accountApiEnabled && account.authenticated)
        await account.reload();
      return saved;
    },
    [account, availabilityController],
  );

  const saveAccountProfile = useCallback(
    async (updates: Parameters<typeof account.updateProfile>[0]) => {
      if (!account.accountApiEnabled || !account.authenticated) return;
      await account.updateProfile(updates);
    },
    [account],
  );

  const changeLayoutMode = (mode: WeekLayoutMode) => {
    setLayoutMode(mode);
    window.localStorage.setItem("weeki.week-layout.v1", mode);
  };

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const weekEnd = addDays(weekStart, showWeekend ? 6 : 4);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (
        activeArea === "week" &&
        event.key.toLowerCase() === "n" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        setSelectedTask(null);
        setInitialDate(todayKey);
        setInitialTime("");
        setInitialClientId(null);
        setSheetOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeArea, todayKey]);

  const tasksInWeek = useMemo(
    () =>
      tasks.filter((task) => {
        if (!task.scheduledDate) return false;
        return isWithinInterval(parseISO(task.scheduledDate), {
          start: weekStart,
          end: weekEnd,
        });
      }),
    [tasks, weekStart, weekEnd],
  );

  const filteredTasks = useMemo(
    () =>
      tasksInWeek.filter((task) => {
        const client = clients.find((item) => item.id === task.clientId);
        const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
        const matchesQuery =
          !normalizedQuery ||
          `${task.title} ${task.description} ${client?.name ?? ""} ${task.tags.join(" ")}`
            .toLocaleLowerCase("pt-BR")
            .includes(normalizedQuery);
        return (
          matchesQuery &&
          (statusFilter === "all" || task.status === statusFilter) &&
          (clientFilter === "all" || task.clientId === clientFilter) &&
          (priorityFilter === "all" || task.priority === priorityFilter)
        );
      }),
    [tasksInWeek, query, statusFilter, clientFilter, priorityFilter, clients],
  );

  const inboxTasks = tasks.filter((task) => !task.scheduledDate);
  const hasActiveFilters = Boolean(
    query.trim() || statusFilter !== "all" || clientFilter !== "all" || priorityFilter !== "all",
  );

  const openNewTask = useCallback(
    (
      date: string | null,
      time = "",
      clientId: string | null = null,
      engagementId: string | null = null,
      serviceId: string | null = null,
    ) => {
      setSelectedTask(null);
      setInitialDate(date);
      setInitialTime(time);
      setInitialClientId(clientId);
      setInitialEngagementId(engagementId);
      setInitialServiceId(serviceId);
      setSheetOpen(true);
    },
    [],
  );

  const openTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setInitialDate(task.scheduledDate);
    setInitialTime(task.scheduledTime);
    setInitialClientId(task.clientId);
    setInitialEngagementId(task.engagementId ?? null);
    setInitialServiceId(task.serviceId ?? null);
    setSheetOpen(true);
  }, []);

  const saveTask = useCallback(
    (draft: TaskDraft, taskId?: string, options?: { silent?: boolean }) => {
      if (taskId) {
        updateTask(taskId, draft, !options?.silent);
        setSelectedTask((current) =>
          current?.id === taskId
            ? { ...current, ...draft, updatedAt: new Date().toISOString() }
            : current,
        );
        if (!options?.silent) toast.success("Demanda atualizada.");
      } else {
        addTask(draft);
        toast.success(
          draft.scheduledDate
            ? "Demanda adicionada à semana."
            : "Demanda salva na Caixa de Entrada.",
        );
      }
    },
    [addTask, updateTask],
  );

  const createStandardTasks = useCallback(
    (engagement: Engagement, service: Service | null) => {
      if (!service?.standardTasks.length) return;
      const startDate = engagement.startDate || todayKey;
      service.standardTasks.forEach((title) =>
        addTask({
          title,
          description: "",
          clientId: engagement.clientId,
          serviceId: service.id,
          engagementId: engagement.id,
          status: "not_started",
          priority: "medium",
          scheduledDate: startDate,
          scheduledTime: "",
          dueDate: engagement.dueDate || startDate,
          dueTime: "",
          estimateMinutes: null,
          tags: [service.category].filter(Boolean),
          checklist: [],
          attachments: [],
          notes: "",
          recurrence: { type: "none", days: [], endDate: "" },
          report: {
            includeInReports: true,
            description: title,
            category: "other",
            evidenceNotes: "",
          },
          archivedAt: null,
        }),
      );
      toast.success(`${service.standardTasks.length} tarefas padrão criadas.`);
    },
    [addTask, todayKey],
  );

  const convertOpportunity = useCallback(
    (opportunity: Opportunity) => {
      const targetName = (
        opportunity.company || opportunity.name
      ).toLocaleLowerCase("pt-BR");
      const existing = clients.find(
        (client) =>
          (opportunity.email && client.email === opportunity.email) ||
          client.name.toLocaleLowerCase("pt-BR") === targetName,
      );
      const client =
        existing ??
        addClient({
          name: opportunity.company || opportunity.name,
          color: "#654ce4",
          logoUrl: "",
          kind: "company",
          document: "",
          contactName: opportunity.name,
          contactRole: "Contato principal",
          email: opportunity.email,
          phone: opportunity.phone,
          website: "",
          address: "",
          notes: opportunity.notes,
          status: "active",
          segment: "",
          contractValue: 0,
          contractKind: "none",
          nextDueDate: "",
          paymentStatus: "none",
          files: [],
          links: [],
        });
      operations.updateOpportunity(opportunity.id, {
        ...opportunity,
        clientId: client.id,
        status: "won",
      });
      const relatedQuote = operations.quotes.find(
        (quote) => quote.opportunityId === opportunity.id,
      );
      if (relatedQuote) {
        operations.updateQuote(relatedQuote.id, {
          ...relatedQuote,
          clientId: client.id,
        });
      }
      toast.success(
        existing
          ? "Oportunidade vinculada ao cliente existente."
          : "Cliente criado a partir da oportunidade.",
      );
      navigateArea("engagements");
    },
    [addClient, clients, navigateArea, operations],
  );

  const handleMove = useCallback(
    (taskId: string, date: string, time?: string) => {
      const previous = tasks.find((task) => task.id === taskId);
      moveTask(taskId, date, time);
      toast.success(
        "Demanda movida.",
        previous
          ? {
              action: {
                label: "Desfazer",
                onClick: () =>
                  moveTask(
                    taskId,
                    previous.scheduledDate,
                    previous.scheduledTime,
                  ),
              },
            }
          : undefined,
      );
    },
    [moveTask, tasks],
  );

  const handleChangeClient = useCallback(
    (taskId: string, clientId: string | null) => {
      const previous = tasks.find((task) => task.id === taskId);
      assignTaskClient(taskId, clientId);
      toast.success(
        "Cliente da demanda atualizado.",
        previous
          ? {
              action: {
                label: "Desfazer",
                onClick: () => assignTaskClient(taskId, previous.clientId),
              },
            }
          : undefined,
      );
    },
    [assignTaskClient, tasks],
  );

  const handleChangeStatus = useCallback(
    (taskId: string, status: TaskStatus) => {
      const previous = tasks.find((task) => task.id === taskId);
      setTaskStatus(taskId, status);
      toast.success("Status atualizado.", previous ? {
        action: { label: "Desfazer", onClick: () => setTaskStatus(taskId, previous.status) },
      } : undefined);
    },
    [setTaskStatus, tasks],
  );

  const handleChangePriority = useCallback(
    (taskId: string, priority: TaskPriority) => {
      const previous = tasks.find((task) => task.id === taskId);
      setTaskPriority(taskId, priority);
      toast.success("Prioridade atualizada.", previous ? {
        action: { label: "Desfazer", onClick: () => setTaskPriority(taskId, previous.priority) },
      } : undefined);
    },
    [setTaskPriority, tasks],
  );

  const handleToggleComplete = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      const wasCompleted = task?.status === "completed";
      toggleComplete(taskId);
      if (task && !wasCompleted) {
        publishServiceCompleted({
          taskId: task.id,
          clientId: task.clientId,
          title: task.title,
          description: task.description,
          completedAt: new Date().toISOString(),
        });
      }
      toast.success(wasCompleted ? "Demanda reaberta." : "Demanda concluída.", {
        action: { label: "Desfazer", onClick: () => toggleComplete(taskId) },
      });
    },
    [tasks, toggleComplete],
  );

  const handleDuplicate = useCallback(
    (taskId: string) => {
      duplicateTask(taskId);
      toast.success("Demanda duplicada.");
    },
    [duplicateTask],
  );

  const handleArchive = useCallback(
    (taskId: string) => {
      archiveTask(taskId);
      toast.success("Demanda arquivada.");
    },
    [archiveTask],
  );

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setClientFilter("all");
    setPriorityFilter("all");
  };

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-semibold tracking-tight">weeki</span>
          <span className="size-2.5 rounded-full bg-sidebar-primary" />
        </div>
      </div>
    );
  }

  if (account.loading || availabilityController.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-slate-500">
        Carregando sua conta...
      </div>
    );
  }

  if (
    account.accountApiEnabled &&
    (!account.authConfigured || !account.authenticated)
  ) {
    return <AuthScreen controller={account} />;
  }

  if (shouldShowOnboarding(account.session)) {
    return (
      <OnboardingScreen
        settings={settings}
        availability={availabilityController.availability}
        availabilitySaving={availabilityController.saving}
        onUpdateSettings={updateSettings}
        onSaveAccountProfile={saveAccountProfile}
        onSaveAvailability={saveAvailability}
        onProgress={account.updateOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <WeekiSidebar
        inboxCount={inboxTasks.length}
        activeArea={activeArea}
        onNavigate={navigateArea}
        onInbox={() => {
          setActiveArea("week");
          setInboxOpen(true);
        }}
        profileName={settings.profile.name}
        profileInitials={profileInitials}
        fiscalView={fiscalView}
        onFiscalNavigate={(view) => {
          setFiscalView(view);
          setActiveArea("fiscal");
        }}
      />
      <MobileNavigation activeArea={activeArea} onNavigate={navigateArea} />

      <main className="min-h-screen md:ml-64">
        <header className="flex h-16 items-center border-b border-border bg-card px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-xl font-semibold tracking-tight text-foreground">
              weeki
            </span>
            <span className="size-2 rounded-full bg-ring" />
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-400 md:flex">
            <span>{areaHeader[activeArea].group}</span>
            <span>/</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {areaHeader[activeArea].page}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="hidden h-9 gap-1.5 bg-white text-xs sm:flex"
            >
              <Plus className="size-3.5" /> Criar
            </Button>
            <button
              onClick={() => setCommandOpen(true)}
              className="focus-ring hidden h-9 min-w-[240px] items-center gap-2 rounded-lg border bg-[#f8f8fa] px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white lg:flex"
            >
              <Search className="size-4" />
              <span className="flex-1">Buscar no Weeki</span>
              <kbd className="rounded-md border bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-400">
                Ctrl K
              </kbd>
            </button>
            <button
              onClick={() => setCommandOpen(true)}
              className="focus-ring grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 lg:hidden"
              aria-label="Buscar"
            >
              <Search className="size-[18px]" />
            </button>
            <button
              className="focus-ring relative grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              aria-label="Notificações"
            >
              <Bell className="size-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => navigateArea("settings")}
              aria-label="Abrir configurações do perfil"
              className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#202026] to-[#3a3a45] text-xs font-semibold text-white transition hover:ring-2 hover:ring-[#7657ff]/30"
            >
              {profileInitials}
            </button>
          </div>
        </header>

        {account.session?.onboarding.status === "skipped" && (
          <div className="border-b border-amber-100 bg-amber-50/70 px-4 py-2 text-xs text-amber-800 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-2">
              <span className="font-semibold">
                Configuração inicial incompleta.
              </span>
              <span className="text-amber-700">
                Você pode continuar sem perder os dados já salvos.
              </span>
              <button
                type="button"
                onClick={() =>
                  void account.updateOnboarding({
                    status: "in_progress",
                    step:
                      account.session?.onboarding.step === "done"
                        ? "work"
                        : account.session?.onboarding.step || "work",
                  })
                }
                className="ml-auto font-semibold text-[#5d48dd]"
              >
                Retomar configuração
              </button>
            </div>
          </div>
        )}

        {activeArea === "dashboard" ? (
          <DashboardScreen
            tasks={tasks}
            clients={clients}
            engagements={operations.engagements}
            quotes={operations.quotes}
            charges={billing.charges}
            onNavigate={navigateArea}
            onCreate={() => setCommandOpen(true)}
          />
        ) : activeArea === "engagements" ||
          activeArea === "commercial" ||
          activeArea === "services" ? (
          <OperationsScreen
            view={operationsView}
            controller={operations}
            clients={clients}
            tasks={tasks}
            onNavigate={navigateArea}
            onNewTask={(clientId, engagementId, serviceId) =>
              openNewTask(
                todayKey,
                "",
                clientId,
                engagementId ?? null,
                serviceId ?? null,
              )
            }
            onCreateStandardTasks={createStandardTasks}
            onConvertOpportunity={convertOpportunity}
          />
        ) : activeArea === "clients" ? (
          <ClientsScreen
            clients={clients}
            tasks={tasks}
            contracts={contracts.contracts}
            engagements={operations.engagements}
            quotes={operations.quotes}
            onAddClient={addClient}
            onUpdateClient={updateClient}
            onNewTask={(clientId) => openNewTask(todayKey, "", clientId)}
            onOpenTask={openTask}
            onToggleTask={handleToggleComplete}
          />
        ) : activeArea === "contracts" ? (
          <ContractsScreen
            clients={clients}
            tasks={tasks}
            settings={settings}
            controller={contracts}
          />
        ) : activeArea === "reports" ? (
          <ReportsScreen
            clients={clients}
            tasks={tasks}
            settings={settings}
            controller={reports}
          />
        ) : activeArea === "appointments" ? (
          <AppointmentsScreen
            clients={clients}
            availability={availabilityController.availability}
            onConfigureAvailability={openAvailabilitySettings}
          />
        ) : activeArea === "finance" ? (
          <FinanceScreen clients={clients} />
        ) : activeArea === "billing" ? (
          <BillingScreen
            clients={clients}
            onPayments={openPayments}
            controller={billing}
          />
        ) : activeArea === "fiscal" && FISCAL_FLAGS.moduleEnabled ? (
          <FiscalScreen
            controller={fiscal}
            clients={clients}
            view={fiscalView}
            onViewChange={setFiscalView}
            onNavigateArea={navigateArea}
          />
        ) : activeArea === "settings" ? (
          <SettingsScreen
            key={`${String(initialPayments)}-${initialSettingsView ?? "overview"}`}
            initialPayments={initialPayments}
            initialView={initialSettingsView}
            settings={settings}
            onUpdateSettings={updateSettings}
            fiscalController={fiscal}
            availability={availabilityController.availability}
            availabilitySaving={availabilityController.saving}
            onSaveAvailability={saveAvailability}
            onSaveAccountProfile={saveAccountProfile}
            authConfigured={account.authConfigured}
            providers={account.session?.providers ?? []}
            onLogout={account.logout}
          />
        ) : (
          <div
            className="mx-auto flex max-w-[1720px] flex-col px-4 py-5 sm:px-6 lg:px-8"
            style={{ minHeight: "calc(100vh - 4rem)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">
                    Minha Semana
                  </h1>
                  <span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-100 px-2 text-xs font-medium tabular-nums text-slate-600">
                    {format(weekStart, "dd MMM", { locale: ptBR })} —{" "}
                    {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Planeje, priorize e acompanhe o trabalho da semana em Kanban, dias, lista, calendário ou tabela.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInboxOpen((current) => !current)}
                  className={cn(
                    "bg-white",
                    inboxOpen && "border-ring bg-accent text-accent-foreground",
                  )}
                >
                  <Inbox />
                  <span className="hidden sm:inline">Caixa de Entrada</span>
                  <span className="sm:hidden">Caixa</span>
                  {inboxTasks.length > 0 && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                      {inboxTasks.length}
                    </span>
                  )}
                </Button>
                <Button size="sm" onClick={() => openNewTask(todayKey)}>
                  <Plus />
                  <span className="hidden sm:inline">Nova demanda</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              </div>
            </div>

            <WeekSummary tasks={filteredTasks} todayKey={todayKey} />

            <div className="week-board-scroll mt-4 flex items-center justify-between gap-3 overflow-x-auto border-y border-slate-200/80 bg-white py-2.5">
              <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
                <div className="flex w-fit items-center gap-0.5 rounded-lg border bg-slate-50 p-0.5 shadow-sm">
                  <button
                    onClick={() =>
                      setWeekStart((current) => addWeeks(current, -1))
                    }
                    className="focus-ring grid size-8 place-items-center rounded-md text-slate-500 hover:bg-white"
                    aria-label="Semana anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => setWeekStart(initialWeek())}
                    className="focus-ring h-8 rounded-md px-2.5 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() =>
                      setWeekStart((current) => addWeeks(current, 1))
                    }
                    className="focus-ring grid size-8 place-items-center rounded-md text-slate-500 hover:bg-white"
                    aria-label="Próxima semana"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div
                  className="flex items-center rounded-lg border bg-slate-100 p-0.5"
                  aria-label="Agrupar demandas por semana ou cliente"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode("week")}
                    className={cn(
                      "focus-ring flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition",
                      viewMode === "week"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-200/70",
                    )}
                  >
                    <CalendarDays className="size-3" /> Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("clients")}
                    className={cn(
                      "focus-ring flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition",
                      viewMode === "clients"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-200/70",
                    )}
                  >
                    <UsersRound className="size-3" /> Clientes
                  </button>
                </div>

                <div
                  className="flex items-center rounded-lg border bg-slate-100 p-0.5"
                  aria-label="Layout das demandas"
                >
                  {([
                    { value: "kanban" as const, label: "Kanban", icon: Kanban },
                    { value: "board" as const, label: "Dias", icon: Columns3 },
                    { value: "list" as const, label: "Lista", icon: LayoutList },
                    { value: "calendar" as const, label: "Calendário", icon: CalendarRange },
                    { value: "table" as const, label: "Tabela", icon: Table2 },
                  ]).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => changeLayoutMode(item.value)}
                      className={cn(
                        "focus-ring flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition",
                        layoutMode === item.value
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-200/70",
                      )}
                    >
                      <item.icon className="size-3.5" />
                      <span className="hidden lg:inline">{item.label}</span>
                    </button>
                  ))}
                </div>

                {layoutMode !== "calendar" && layoutMode !== "kanban" && layoutMode !== "table" && (
                <button
                  type="button"
                  onClick={() => setShowWeekend((current) => !current)}
                  aria-pressed={showWeekend}
                  className={cn(
                    "focus-ring flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-slate-300",
                    showWeekend &&
                      "border-ring bg-accent text-accent-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "relative h-4 w-7 rounded-full bg-slate-200 transition",
                      showWeekend && "bg-[#7657ff]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow-sm transition",
                        showWeekend && "translate-x-3",
                      )}
                    />
                  </span>
                  Sáb e dom
                </button>
                )}
              </div>

              <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
                <div className="relative w-[170px] shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar demandas"
                    aria-label="Buscar demandas"
                    className="h-8 rounded-lg bg-white pl-8 pr-2.5 text-xs shadow-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileFiltersOpen((current) => !current)}
                  className="h-8 rounded-lg bg-white px-2 text-xs sm:hidden"
                >
                  <SlidersHorizontal /> Filtros
                </Button>
                <div
                  className={cn(
                    "contents",
                    !mobileFiltersOpen && "max-sm:hidden",
                  )}
                >
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as TaskStatus | "all")
                    }
                  >
                    <SelectTrigger className="h-8 w-[138px] shrink-0 rounded-lg bg-white px-2.5 text-xs shadow-sm">
                      <SlidersHorizontal className="size-3" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="h-8 w-[132px] shrink-0 rounded-lg bg-white px-2.5 text-xs shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={priorityFilter}
                    onValueChange={(value) => setPriorityFilter(value as TaskPriority | "all")}
                  >
                    <SelectTrigger className="h-8 w-[132px] shrink-0 rounded-lg bg-white px-2.5 text-xs shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as prioridades</SelectItem>
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8 px-2 text-xs text-slate-400"
                  >
                    <X /> Limpar
                  </Button>
                )}
              </div>
            </div>

            {inboxOpen && (
              <section
                className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_6px_24px_rgba(27,27,40,0.03)]"
                aria-label="Caixa de Entrada"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                      Caixa de Entrada
                    </h2>
                    <p className="text-xs text-slate-400">
                      Arraste para o Kanban, os dias ou o calendário para agendar.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openNewTask(null)}
                  >
                    <Plus /> Capturar
                  </Button>
                </div>
                {inboxTasks.length > 0 ? (
                  <div className="week-board-scroll flex gap-2 overflow-x-auto pb-1">
                    {inboxTasks.map((task) => (
                      <div key={task.id} className="w-[240px] shrink-0">
                        <TaskCard
                          task={task}
                          clients={clients}
                          onOpen={() => openTask(task)}
                          onToggleComplete={() => handleToggleComplete(task.id)}
                          onDuplicate={() => handleDuplicate(task.id)}
                          onArchive={() => handleArchive(task.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openNewTask(null)}
                    className="flex h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-slate-400 transition hover:border-[#a998ef] hover:text-[#684be6]"
                  >
                    <Plus className="size-4" /> Capturar uma demanda sem data
                  </button>
                )}
              </section>
            )}

            <div className="mt-3 min-h-0 flex-1">
              <WeekBoard
                weekStart={weekStart}
                tasks={filteredTasks}
                clients={clients}
                viewMode={viewMode}
                layoutMode={layoutMode}
                showWeekend={showWeekend}
                onCreate={openNewTask}
                onOpen={openTask}
                onMove={handleMove}
                onChangeClient={handleChangeClient}
                onChangeStatus={handleChangeStatus}
                onChangePriority={handleChangePriority}
                onToggleComplete={handleToggleComplete}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
              />
            </div>
          </div>
        )}
      </main>

      <TaskSheet
        key={`${sheetOpen ? "open" : "closed"}-${selectedTask?.id ?? "new"}-${initialDate ?? "inbox"}-${initialTime}-${initialClientId ?? "none"}-${initialEngagementId ?? "none"}`}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        task={selectedTask}
        initialDate={initialDate}
        initialTime={initialTime}
        initialClientId={initialClientId}
        initialEngagementId={initialEngagementId}
        initialServiceId={initialServiceId}
        clients={clients}
        onSave={saveTask}
        onArchive={handleArchive}
      />
      <WeekiCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        tasks={tasks}
        clients={clients}
        engagements={operations.engagements}
        opportunities={operations.opportunities}
        quotes={operations.quotes}
        services={operations.services}
        onCreate={openNewTask}
        onOpenTask={openTask}
        onToday={() => setWeekStart(initialWeek())}
        onNavigate={navigateArea}
      />
      {FISCAL_FLAGS.moduleEnabled && (
        <FiscalAutomationDialog
          controller={fiscal}
          onOpenFiscal={() => {
            setFiscalView("notes");
            setActiveArea("fiscal");
          }}
          onOpenSettings={() => {
            setFiscalView("settings");
            setActiveArea("fiscal");
          }}
        />
      )}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
