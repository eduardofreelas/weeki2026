"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  KeyRound,
  Laptop,
  Link2,
  LogOut,
  Mail,
  Moon,
  Palette,
  Plug,
  ReceiptText,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AvailabilitySettingsPanel } from "@/components/weeki/availability-settings-panel";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  IntegrationId,
  WeekiProfileSettings,
  WeekiRegionalSettings,
  WeekiSettings,
  WeekiTheme,
} from "@/features/settings/types";
import type {
  QuoteSettings,
  StorefrontSettings,
} from "@/features/operations/types";
import { storefrontPublicUrl } from "@/features/services/pricing";
import { slugifyService } from "@/features/services/defaults";
import type {
  AccountProfileInput,
  ConnectedAuthProvider,
} from "@/shared/account";
import type { WeekiAvailability } from "@/shared/availability";
import { cn } from "@/lib/utils";
import { FiscalSettings } from "@/components/fiscal/fiscal-settings";
import type { WeekiFiscalController } from "@/features/fiscal/use-weeki-fiscal";
import { FISCAL_FLAGS } from "@/features/fiscal/config";

import { SettingsPayments } from "@/components/payments/settings-payments";

type SettingsView =
  | "overview"
  | "payments"
  | "quotes"
  | "storefront"
  | "fiscal"
  | "profile"
  | "business"
  | "availability"
  | "workspace"
  | "appearance"
  | "notifications"
  | "integrations"
  | "team"
  | "plan"
  | "security"
  | "privacy";

const navigation: Array<{
  id: SettingsView;
  label: string;
  icon: typeof UserRound;
}> = [
  { id: "overview", label: "Visão geral", icon: Settings2 },
  { id: "profile", label: "Perfil", icon: UserRound },
  { id: "business", label: "Negócio", icon: BriefcaseBusiness },
  { id: "availability", label: "Disponibilidade", icon: CalendarDays },
  { id: "integrations", label: "Integrações", icon: Plug },
  { id: "team", label: "Equipe", icon: UsersRound },
  { id: "plan", label: "Plano", icon: ReceiptText },
  { id: "security", label: "Segurança", icon: ShieldCheck },
  { id: "workspace", label: "Preferências regionais", icon: Settings2 },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "payments", label: "Pagamentos", icon: Link2 },
  { id: "quotes", label: "Orçamentos", icon: FileText },
  { id: "storefront", label: "Vitrine", icon: ShoppingBag },
  { id: "fiscal", label: "Fiscal", icon: FileText },
  { id: "privacy", label: "Dados e conta", icon: Database },
];

const timezones = [
  { value: "America/Fortaleza", label: "Fortaleza — UTC−03:00" },
  { value: "America/Sao_Paulo", label: "Brasília / São Paulo — UTC−03:00" },
  { value: "America/Manaus", label: "Manaus — UTC−04:00" },
  { value: "America/Rio_Branco", label: "Rio Branco — UTC−05:00" },
  { value: "America/Noronha", label: "Fernando de Noronha — UTC−02:00" },
  { value: "UTC", label: "UTC — Tempo Universal" },
];

const integrationMeta: Record<
  IntegrationId,
  {
    title: string;
    description: string;
    icon: typeof CalendarDays;
    tone: string;
  }
> = {
  google_calendar: {
    title: "Google Calendar",
    description: "Sincronize compromissos e disponibilidade.",
    icon: CalendarDays,
    tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  },
  google_drive: {
    title: "Google Drive",
    description: "Organize arquivos e pastas por cliente.",
    icon: HardDrive,
    tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  trello: {
    title: "Trello",
    description: "Importe quadros, listas e cartões existentes.",
    icon: UsersRound,
    tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  },
  asaas: {
    title: "Asaas",
    description: "Receba cobranças diretamente na sua conta.",
    icon: Link2,
    tone: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
  },
};

export function SettingsScreen({
  settings,
  onUpdateSettings,
  quoteSettings,
  onUpdateQuoteSettings,
  storefrontSettings,
  onUpdateStorefrontSettings,
  fiscalController,
  availability,
  onSaveAvailability,
  onSaveAccountProfile,
  availabilitySaving = false,
  initialPayments = false,
  initialView,
  authConfigured = false,
  providers = [],
  onLogout,
}: {
  settings: WeekiSettings;
  onUpdateSettings: (updates: Partial<WeekiSettings>) => void;
  quoteSettings: QuoteSettings;
  onUpdateQuoteSettings: (settings: QuoteSettings) => void;
  storefrontSettings: StorefrontSettings;
  onUpdateStorefrontSettings: (settings: StorefrontSettings) => void;
  fiscalController: WeekiFiscalController;
  availability: WeekiAvailability;
  onSaveAvailability: (
    availability: WeekiAvailability,
  ) => Promise<WeekiAvailability> | WeekiAvailability;
  onSaveAccountProfile?: (updates: AccountProfileInput) => Promise<void> | void;
  availabilitySaving?: boolean;
  initialPayments?: boolean;
  initialView?: SettingsView;
  authConfigured?: boolean;
  providers?: ConnectedAuthProvider[];
  onLogout?: () => Promise<void> | void;
}) {
  const [view, setView] = useState<SettingsView>(
    initialView ?? (initialPayments ? "payments" : "overview"),
  );
  const [navigationQuery, setNavigationQuery] = useState("");
  const [profileDraft, setProfileDraft] = useState(settings.profile);
  const [regionalDraft, setRegionalDraft] = useState(settings.regional);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const initials = useMemo(
    () =>
      profileDraft.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "WK",
    [profileDraft.name],
  );
  const visibleNavigation = useMemo(() => {
    const query = navigationQuery.trim().toLocaleLowerCase("pt-BR");
    const enabledNavigation = navigation.filter(
      (item) => item.id !== "fiscal" || FISCAL_FLAGS.moduleEnabled,
    );
    return query
      ? enabledNavigation.filter((item) =>
          item.label.toLocaleLowerCase("pt-BR").includes(query),
        )
      : enabledNavigation;
  }, [navigationQuery]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileDraft.name.trim() || !profileDraft.email.trim())
      return toast.error("Informe nome e e-mail.");
    try {
      onUpdateSettings({ profile: profileDraft });
      await onSaveAccountProfile?.({
        name: profileDraft.name,
        avatarUrl: profileDraft.avatarUrl,
        phone: profileDraft.phone,
        professionalName: profileDraft.professionalName,
        businessName: profileDraft.businessName,
        businessArea: profileDraft.businessArea,
        workDescription: profileDraft.workDescription,
        workspaceName: profileDraft.workspaceName,
      });
      toast.success("Perfil atualizado.");
    } catch {
      toast.error("Não foi possível salvar o perfil.");
    }
  };

  const saveRegional = async (event: FormEvent) => {
    event.preventDefault();
    try {
      onUpdateSettings({ regional: regionalDraft });
      await onSaveAccountProfile?.({ timezone: regionalDraft.timezone });
      toast.success("Preferências atualizadas.");
    } catch {
      toast.error("Não foi possível salvar as preferências.");
    }
  };

  const changeTheme = (theme: WeekiTheme) =>
    onUpdateSettings({ appearance: { ...settings.appearance, theme } });

  const setNotification = (
    key: keyof WeekiSettings["notifications"],
    checked: boolean,
  ) => {
    onUpdateSettings({
      notifications: { ...settings.notifications, [key]: checked },
    });
  };

  const exportData = () => {
    const data: Record<string, unknown> = {};
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("weeki.")) continue;
      const value = window.localStorage.getItem(key);
      try {
        data[key] = value ? JSON.parse(value) : null;
      } catch {
        data[key] = value;
      }
    }
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `weeki-dados-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Seus dados foram exportados.");
  };

  return (
    <div className="mx-auto w-full max-w-[1450px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[#efedff] text-[#5b44df] dark:bg-violet-500/10 dark:text-violet-300">
            <Settings2 className="size-4" />
          </span>
          <div>
            <h1 className="text-[23px] font-bold tracking-[-0.035em] text-slate-900 dark:text-white sm:text-[25px]">
              Configurações
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Centralize sua conta, preferências, integrações, pagamentos e
              emissão fiscal.
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={navigationQuery}
            onChange={(event) => setNavigationQuery(event.target.value)}
            placeholder="Buscar configuração"
            className="h-9 rounded-lg bg-white pl-9 text-[11px] shadow-none dark:bg-card"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-[9px] leading-4 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/8 dark:text-blue-200">
        <HardDrive className="size-3.5 shrink-0" />
        <span>
          <strong>Modo local protegido pelo dispositivo.</strong> Preferências
          visuais funcionam neste navegador; recursos de conta, conexões e
          segurança serão ativados somente pelo backend autenticado.
        </span>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:gap-8">
        <nav
          className="week-board-scroll flex gap-1 overflow-x-auto border-b border-slate-200 pb-2 dark:border-white/10 lg:sticky lg:top-[88px] lg:block lg:space-y-1 lg:overflow-visible lg:border-0 lg:pb-0"
          aria-label="Seções das configurações"
        >
          {visibleNavigation.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setView(item.id);
                setNavigationQuery("");
              }}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-[11px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white lg:w-full",
                view === item.id &&
                  "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-white/[0.08] dark:text-white dark:ring-white/10",
              )}
            >
              <item.icon
                className={cn("size-4", view === item.id && "text-[#6048df]")}
              />
              <span>{item.label}</span>
              {view === item.id && (
                <ChevronRight className="ml-auto hidden size-3.5 text-slate-300 lg:block" />
              )}
            </button>
          ))}
          {!visibleNavigation.length && (
            <p className="px-3 py-2 text-[10px] text-slate-400">
              Nenhuma seção encontrada.
            </p>
          )}
        </nav>

        <div className="min-w-0">
          {view === "overview" && (
            <SettingsOverview
              settings={settings}
              availability={availability}
              fiscalController={fiscalController}
              quoteSettings={quoteSettings}
              storefrontSettings={storefrontSettings}
              onNavigate={setView}
            />
          )}
          {view === "payments" && <SettingsPayments />}
          {view === "quotes" && (
            <QuoteSettingsPanel
              quoteSettings={quoteSettings}
              onSave={onUpdateQuoteSettings}
            />
          )}
          {view === "storefront" && (
            <StorefrontSettingsPanel
              storefrontSettings={storefrontSettings}
              onSave={onUpdateStorefrontSettings}
            />
          )}
          {view === "fiscal" && (
            <FiscalSettings controller={fiscalController} embedded />
          )}
          {view === "profile" && (
            <ProfileSettings
              profile={profileDraft}
              initials={initials}
              onChange={setProfileDraft}
              onSubmit={saveProfile}
            />
          )}
          {view === "business" && (
            <BusinessSettings
              profile={profileDraft}
              onChange={setProfileDraft}
              onSubmit={saveProfile}
            />
          )}
          {view === "availability" && (
            <AvailabilitySettingsPanel
              availability={availability}
              saving={availabilitySaving}
              onSave={onSaveAvailability}
            />
          )}
          {view === "workspace" && (
            <RegionalSettings
              regional={regionalDraft}
              onChange={setRegionalDraft}
              onSubmit={saveRegional}
            />
          )}
          {view === "appearance" && (
            <AppearanceSettings
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onThemeChange={changeTheme}
            />
          )}
          {view === "notifications" && (
            <NotificationSettings
              settings={settings}
              onChange={setNotification}
            />
          )}
          {view === "integrations" && (
            <>
              <button
                type="button"
                onClick={() => setView("payments")}
                className="mb-4 text-xs font-medium text-violet-500"
              >
                Asaas, Mercado Pago e Stripe → Pagamentos
              </button>
              <IntegrationsSettings />
            </>
          )}
          {view === "team" && <TeamSettings />}
          {view === "plan" && (
            <PlanSettings onPayments={() => setView("payments")} />
          )}
          {view === "security" && (
            <SecuritySettings
              settings={settings}
              authConfigured={authConfigured}
              providers={providers}
              onLogout={onLogout}
            />
          )}
          {view === "privacy" && (
            <PrivacySettings
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onExport={exportData}
              onDelete={() => setDeleteOpen(true)}
            />
          )}
        </div>
      </div>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function SettingsOverview({
  settings,
  availability,
  fiscalController,
  quoteSettings,
  storefrontSettings,
  onNavigate,
}: {
  settings: WeekiSettings;
  availability: WeekiAvailability;
  fiscalController: WeekiFiscalController;
  quoteSettings: QuoteSettings;
  storefrontSettings: StorefrontSettings;
  onNavigate: (view: SettingsView) => void;
}) {
  const profileComplete = Boolean(
    settings.profile.name.trim() && settings.profile.email.trim(),
  );
  const availabilityComplete = Boolean(availability.configuredAt);
  const fiscalSteps = [
    Boolean(fiscalController.state.profile.configuredAt),
    fiscalController.state.serviceConfigs.some((service) => service.active),
    fiscalController.state.certificate?.status === "active",
  ];
  const fiscalProgress = fiscalSteps.filter(Boolean).length;
  const enabledNotifications = Object.values(settings.notifications).filter(
    Boolean,
  ).length;
  const timezoneName =
    timezones
      .find((item) => item.value === settings.regional.timezone)
      ?.label.split("—")[0]
      .trim() || settings.regional.timezone;
  const cards: Array<{
    id: SettingsView;
    title: string;
    description: string;
    status: string;
    icon: typeof UserRound;
    tone: string;
  }> = [
    {
      id: "profile",
      title: "Perfil",
      description: "Identidade pessoal e contato",
      status: profileComplete ? "Completo" : "Revisar dados",
      icon: UserRound,
      tone: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    },
    {
      id: "business",
      title: "Negócio",
      description: "Nome profissional, área e espaço",
      status: settings.profile.businessName ? "Configurado" : "Pendente",
      icon: BriefcaseBusiness,
      tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    },
    {
      id: "availability",
      title: "Disponibilidade",
      description: "Dias, horários e regras de agendamento",
      status: availabilityComplete ? "Configurada" : "Pendente",
      icon: CalendarDays,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      id: "workspace",
      title: "Preferências regionais",
      description: "Idioma, fuso, datas e moeda",
      status: `${timezoneName} · ${settings.regional.currency}`,
      icon: Settings2,
      tone: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300",
    },
    {
      id: "appearance",
      title: "Aparência",
      description: "Tema e densidade da interface",
      status:
        settings.appearance.theme === "system"
          ? "Automático"
          : settings.appearance.theme === "dark"
            ? "Escuro"
            : "Claro",
      icon: Palette,
      tone: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
    },
    {
      id: "notifications",
      title: "Notificações",
      description: "Canais e alertas importantes",
      status: `${enabledNotifications} preferências ativas`,
      icon: Bell,
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    },
    {
      id: "integrations",
      title: "Integrações",
      description: "Drive, Calendar e Trello",
      status: "Em standby",
      icon: Plug,
      tone: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300",
    },
    {
      id: "team",
      title: "Equipe",
      description: "Papéis, convites e permissões",
      status: "Preparado",
      icon: UsersRound,
      tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    },
    {
      id: "plan",
      title: "Plano",
      description: "Assinatura, uso e cobrança",
      status: "Gerenciar",
      icon: ReceiptText,
      tone: "bg-lime-50 text-lime-700 dark:bg-lime-500/10 dark:text-lime-200",
    },
    {
      id: "payments",
      title: "Pagamentos",
      description: "Asaas, Mercado Pago e Stripe",
      status: "Modo visual",
      icon: Link2,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      id: "quotes",
      title: "Orçamentos",
      description: "Numeração, textos padrão e documento",
      status: `${quoteSettings.prefix} · ${quoteSettings.defaultValidityDays} dias`,
      icon: FileText,
      tone: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    },
    {
      id: "storefront",
      title: "Vitrine",
      description: "Página pública, contatos, slug e compartilhamento",
      status: storefrontSettings.enabled
        ? `/${storefrontSettings.slug}`
        : "Desativada",
      icon: ShoppingBag,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    ...(FISCAL_FLAGS.moduleEnabled
      ? [
          {
            id: "fiscal" as const,
            title: "Fiscal",
            description: "Dados, serviços e automações NFS-e",
            status: `${fiscalProgress}/3 etapas preparadas`,
            icon: ReceiptText,
            tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
          },
        ]
      : []),
    {
      id: "security",
      title: "Segurança",
      description: "Acesso, sessões e proteção",
      status: "Requer autenticação",
      icon: ShieldCheck,
      tone: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    },
    {
      id: "privacy",
      title: "Dados e conta",
      description: "Exportação, privacidade e exclusão",
      status: "Gerenciar",
      icon: Database,
      tone: "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300",
    },
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-violet-50/70 dark:border-white/10 dark:from-[#15151b] dark:via-[#15151b] dark:to-violet-500/8">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
              <Settings2 className="size-3" /> Central de configurações
            </span>
            <h2 className="mt-3 text-lg font-bold tracking-[-0.025em] text-slate-900 dark:text-white">
              Tudo do seu workspace em um só lugar
            </h2>
            <p className="mt-1 max-w-xl text-[10px] leading-4 text-slate-500 dark:text-slate-400">
              Organize as preferências da Weeki sem formulários desnecessários.
              Cada área deixa claro o que já funciona e o que depende de
              ativação segura.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onNavigate("profile")}
            className="h-8 shrink-0 bg-[#5944df] text-[10px]"
          >
            <UserRound className="size-3.5" /> Revisar perfil
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onNavigate(card.id)}
            className="group flex min-h-28 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-sm dark:border-white/10 dark:bg-[#15151b] dark:hover:border-violet-500/30"
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                card.tone,
              )}
            >
              <card.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                  {card.title}
                </span>
                <ChevronRight className="size-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
              </span>
              <span className="mt-1 block text-[9px] leading-4 text-slate-400">
                {card.description}
              </span>
              <span className="mt-3 inline-flex rounded-full bg-slate-50 px-2 py-1 text-[8px] font-semibold text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                {card.status}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StorefrontSettingsPanel({
  storefrontSettings,
  onSave,
}: {
  storefrontSettings: StorefrontSettings;
  onSave: (settings: StorefrontSettings) => void;
}) {
  const [draft, setDraft] = useState(storefrontSettings);
  const update = <K extends keyof StorefrontSettings>(
    key: K,
    value: StorefrontSettings[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.slug.trim()) return toast.error("Informe um slug público.");
    onSave({ ...draft, slug: slugifyService(draft.slug) });
    toast.success("Vitrine atualizada.");
  };
  const copyLink = async () => {
    await navigator.clipboard?.writeText(storefrontPublicUrl(draft));
    toast.success("Link da vitrine copiado.");
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <SettingsPanel
        title="Vitrine pública"
        description="Página do prestador para divulgar serviços, receber solicitações e preparar checkout."
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <SettingsField
            label="Status"
            hint="Quando desativada, a rota pública mostra vitrine indisponível."
          >
            <div className="flex h-9 items-center justify-between rounded-md border border-slate-200 px-3 dark:border-white/10">
              <span className="text-[10px] text-slate-500">
                {draft.enabled ? "Ativa" : "Desativada"}
              </span>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(checked) => update("enabled", checked)}
                className="data-[state=checked]:bg-[#654fe4]"
              />
            </div>
          </SettingsField>
          <SettingsField
            label="Slug público"
            hint="Use letras, números e hífen. Slugs antigos devem virar redirects no backend."
          >
            <Input
              value={draft.slug}
              onChange={(event) =>
                update("slug", slugifyService(event.target.value))
              }
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Nome público">
            <Input
              value={draft.publicName}
              onChange={(event) => update("publicName", event.target.value)}
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Empresa ou marca">
            <Input
              value={draft.businessName}
              onChange={(event) => update("businessName", event.target.value)}
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Chamada da vitrine">
            <Input
              value={draft.headline}
              onChange={(event) => update("headline", event.target.value)}
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Cor de destaque">
            <Input
              type="color"
              value={draft.accentColor}
              onChange={(event) => update("accentColor", event.target.value)}
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="WhatsApp">
            <Input
              value={draft.whatsapp}
              onChange={(event) => update("whatsapp", event.target.value)}
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="E-mail">
            <Input
              value={draft.email}
              onChange={(event) => update("email", event.target.value)}
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField
            label="Domínio próprio futuro"
            hint="A arquitetura aceita o campo, mas DNS/SSL dependem de infraestrutura externa."
          >
            <Input
              value={draft.customDomain}
              onChange={(event) => update("customDomain", event.target.value)}
              placeholder="servicos.minhaempresa.com.br"
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="SEO da vitrine">
            <Input
              value={draft.seoTitle}
              onChange={(event) => update("seoTitle", event.target.value)}
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              Sobre
            </span>
            <Textarea
              value={draft.about}
              onChange={(event) => update("about", event.target.value)}
              className="min-h-24 rounded-md text-xs shadow-none"
            />
          </label>
        </div>
        <PanelFooter>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="h-8 rounded-md px-3 text-[10px] shadow-none"
            >
              Copiar link
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 rounded-md px-3 text-[10px] shadow-none"
            >
              <Save className="size-3.5" /> Salvar vitrine
            </Button>
          </div>
        </PanelFooter>
      </SettingsPanel>
      <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-[9px] leading-4 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/8 dark:text-blue-200">
        Link atual: {storefrontPublicUrl(draft)}. Duplicidade de slug, palavras
        reservadas, redirects e rate limit devem ser validados pelo backend
        quando a vitrine sair do modo local.
      </div>
    </form>
  );
}

function QuoteSettingsPanel({
  quoteSettings,
  onSave,
}: {
  quoteSettings: QuoteSettings;
  onSave: (settings: QuoteSettings) => void;
}) {
  const [draft, setDraft] = useState(quoteSettings);
  const update = <K extends keyof QuoteSettings>(
    key: K,
    value: QuoteSettings[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      ...draft,
      prefix: draft.prefix.trim().toLocaleUpperCase("pt-BR") || "ORC",
      defaultValidityDays: Math.max(1, draft.defaultValidityDays),
      defaultDeadlineDays: Math.max(1, draft.defaultDeadlineDays),
      decimalPlaces: Math.min(4, Math.max(0, draft.decimalPlaces)),
    });
    toast.success("Configurações de orçamentos salvas.");
  };

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Orçamentos"
        description="Defina a numeração, textos padrão e informações exibidas nos documentos comerciais."
      >
        <form onSubmit={submit}>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
            <SettingsField label="Prefixo da numeração">
              <Input
                value={draft.prefix}
                onChange={(event) => update("prefix", event.target.value)}
                className="h-9 rounded-md text-xs uppercase shadow-none"
              />
            </SettingsField>
            <SettingsField label="Validade padrão">
              <Input
                type="number"
                min="1"
                value={draft.defaultValidityDays}
                onChange={(event) =>
                  update("defaultValidityDays", Number(event.target.value || 1))
                }
                className="h-9 rounded-md text-xs shadow-none"
              />
            </SettingsField>
            <SettingsField label="Prazo padrão">
              <Input
                type="number"
                min="1"
                value={draft.defaultDeadlineDays}
                onChange={(event) =>
                  update("defaultDeadlineDays", Number(event.target.value || 1))
                }
                className="h-9 rounded-md text-xs shadow-none"
              />
            </SettingsField>
            <SettingsField label="Moeda">
              <Select
                value={draft.currency}
                onValueChange={(value) =>
                  update("currency", value as QuoteSettings["currency"])
                }
              >
                <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real brasileiro</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>
            <div className="sm:col-span-2">
              <SettingsField label="Condições de pagamento padrão">
                <textarea
                  value={draft.defaultPaymentTerms}
                  onChange={(event) =>
                    update("defaultPaymentTerms", event.target.value)
                  }
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-none outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </SettingsField>
            </div>
            <div className="sm:col-span-2">
              <SettingsField label="Termos padrão">
                <textarea
                  value={draft.defaultTerms}
                  onChange={(event) =>
                    update("defaultTerms", event.target.value)
                  }
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-none outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </SettingsField>
            </div>
            <div className="sm:col-span-2">
              <SettingsField label="Observações padrão">
                <textarea
                  value={draft.defaultNotes}
                  onChange={(event) =>
                    update("defaultNotes", event.target.value)
                  }
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-none outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </SettingsField>
            </div>
            <SettingsField label="Casas decimais">
              <Input
                type="number"
                min="0"
                max="4"
                value={draft.decimalPlaces}
                onChange={(event) =>
                  update("decimalPlaces", Number(event.target.value || 2))
                }
                className="h-9 rounded-md text-xs shadow-none"
              />
            </SettingsField>
            <div className="sm:col-span-2 lg:col-span-4">
              <SettingsField label="Rodapé do documento">
                <Input
                  value={draft.footerText}
                  onChange={(event) => update("footerText", event.target.value)}
                  className="h-9 rounded-md text-xs shadow-none"
                />
              </SettingsField>
            </div>
          </div>
          <div className="grid gap-2 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5 dark:border-white/8">
            <QuoteToggle
              title="Exibir logo"
              checked={draft.showLogo}
              onChange={(checked) => update("showLogo", checked)}
            />
            <QuoteToggle
              title="Exibir CPF/CNPJ"
              checked={draft.showDocument}
              onChange={(checked) => update("showDocument", checked)}
            />
            <QuoteToggle
              title="Exibir endereço"
              checked={draft.showAddress}
              onChange={(checked) => update("showAddress", checked)}
            />
            <QuoteToggle
              title="Exibir telefone"
              checked={draft.showPhone}
              onChange={(checked) => update("showPhone", checked)}
            />
            <QuoteToggle
              title="Exibir assinatura"
              checked={draft.showSignature}
              onChange={(checked) => update("showSignature", checked)}
            />
          </div>
          <PanelFooter>
            <Button
              type="submit"
              size="sm"
              className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none"
            >
              <Save className="size-3.5" /> Salvar orçamentos
            </Button>
          </PanelFooter>
        </form>
      </SettingsPanel>
      <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[9px] leading-4 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200">
        Logotipo empresarial dedicado, domínio público, envio transacional e
        aceite com IP dependem do backend autenticado e armazenamento público
        seguro.
      </div>
    </div>
  );
}

function QuoteToggle({
  title,
  checked,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.025]">
      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#654fe4]"
      />
    </div>
  );
}

function ProfileSettings({
  profile,
  initials,
  onChange,
  onSubmit,
}: {
  profile: WeekiProfileSettings;
  initials: string;
  onChange: (profile: WeekiProfileSettings) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <SettingsPanel
      title="Perfil"
      description="Informações usadas para identificar você no Weeki."
    >
      <form onSubmit={onSubmit}>
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 dark:border-white/8 sm:flex-row sm:items-center sm:px-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#202026] to-[#4b3ab8] text-base font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Foto do perfil
            </p>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              JPG ou PNG de até 5 MB. Recomendado: 400 × 400 px.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...profile, avatarUrl: "" })}
              disabled={!profile.avatarUrl}
              className="h-8 rounded-md px-2 text-[10px] text-slate-400"
            >
              Remover
            </Button>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <SettingsField label="Nome completo">
            <Input
              value={profile.name}
              onChange={(event) =>
                onChange({ ...profile, name: event.target.value })
              }
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="E-mail">
            <Input
              type="email"
              value={profile.email}
              onChange={(event) =>
                onChange({ ...profile, email: event.target.value })
              }
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Telefone">
            <Input
              value={profile.phone}
              onChange={(event) =>
                onChange({ ...profile, phone: event.target.value })
              }
              placeholder="(85) 99999-9999"
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Cargo ou função">
            <Input
              value={profile.role}
              onChange={(event) =>
                onChange({ ...profile, role: event.target.value })
              }
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <div className="sm:col-span-2">
            <SettingsField label="URL da foto ou avatar">
              <Input
                type="url"
                value={profile.avatarUrl}
                onChange={(event) =>
                  onChange({ ...profile, avatarUrl: event.target.value })
                }
                placeholder="https://..."
                className="h-9 rounded-md text-xs shadow-none sm:max-w-xl"
              />
            </SettingsField>
          </div>
        </div>
        <PanelFooter>
          <Button
            type="submit"
            size="sm"
            className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none"
          >
            <Save className="size-3.5" /> Salvar alterações
          </Button>
        </PanelFooter>
      </form>
    </SettingsPanel>
  );
}

function BusinessSettings({
  profile,
  onChange,
  onSubmit,
}: {
  profile: WeekiProfileSettings;
  onChange: (profile: WeekiProfileSettings) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <SettingsPanel
      title="Negócio"
      description="Informações públicas e operacionais do seu espaço de trabalho."
    >
      <form onSubmit={onSubmit}>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <SettingsField label="Nome profissional">
            <Input
              value={profile.professionalName}
              onChange={(event) =>
                onChange({ ...profile, professionalName: event.target.value })
              }
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Nome da empresa ou marca">
            <Input
              value={profile.businessName}
              onChange={(event) =>
                onChange({ ...profile, businessName: event.target.value })
              }
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Área de atuação">
            <Input
              value={profile.businessArea}
              onChange={(event) =>
                onChange({ ...profile, businessArea: event.target.value })
              }
              placeholder="Consultoria, advocacia, saúde..."
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <SettingsField label="Nome do espaço">
            <Input
              value={profile.workspaceName}
              onChange={(event) =>
                onChange({ ...profile, workspaceName: event.target.value })
              }
              className="h-9 rounded-md text-xs shadow-none"
            />
          </SettingsField>
          <div className="sm:col-span-2">
            <SettingsField label="Descrição curta">
              <textarea
                value={profile.workDescription}
                onChange={(event) =>
                  onChange({ ...profile, workDescription: event.target.value })
                }
                rows={4}
                className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-none outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder="Explique em poucas linhas como você ajuda seus clientes."
              />
            </SettingsField>
          </div>
        </div>
        <PanelFooter>
          <Button
            type="submit"
            size="sm"
            className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none"
          >
            <Save className="size-3.5" /> Salvar negócio
          </Button>
        </PanelFooter>
      </form>
    </SettingsPanel>
  );
}

function RegionalSettings({
  regional,
  onChange,
  onSubmit,
}: {
  regional: WeekiRegionalSettings;
  onChange: (regional: WeekiRegionalSettings) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <SettingsPanel
      title="Preferências regionais"
      description="Defina como datas, horários e valores aparecem no seu espaço."
    >
      <form onSubmit={onSubmit}>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div className="sm:col-span-2">
            <SettingsField
              label="Fuso horário"
              hint="Usado em demandas, lembretes, eventos e cobranças."
            >
              <Select
                value={regional.timezone}
                onValueChange={(timezone) =>
                  onChange({ ...regional, timezone })
                }
              >
                <SelectTrigger className="h-9 rounded-md text-xs shadow-none sm:max-w-md">
                  <Clock3 className="size-3.5 text-slate-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((timezone) => (
                    <SelectItem key={timezone.value} value={timezone.value}>
                      {timezone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>
          </div>
          <SettingsField label="Idioma">
            <Select value={regional.language} onValueChange={() => undefined}>
              <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Moeda">
            <Select value={regional.currency} onValueChange={() => undefined}>
              <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real brasileiro (R$)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Formato de data">
            <Select
              value={regional.dateFormat}
              onValueChange={(dateFormat) =>
                onChange({
                  ...regional,
                  dateFormat: dateFormat as WeekiRegionalSettings["dateFormat"],
                })
              }
            >
              <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dd/MM/yyyy">31/12/2026</SelectItem>
                <SelectItem value="yyyy-MM-dd">2026-12-31</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Formato de horário">
            <Select
              value={regional.timeFormat}
              onValueChange={(timeFormat) =>
                onChange({
                  ...regional,
                  timeFormat: timeFormat as WeekiRegionalSettings["timeFormat"],
                })
              }
            >
              <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 horas — 18:30</SelectItem>
                <SelectItem value="12h">12 horas — 6:30 PM</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Primeiro dia da semana">
            <Select
              value={regional.weekStartsOn}
              onValueChange={(weekStartsOn) =>
                onChange({
                  ...regional,
                  weekStartsOn:
                    weekStartsOn as WeekiRegionalSettings["weekStartsOn"],
                })
              }
            >
              <SelectTrigger className="h-9 rounded-md text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Segunda-feira</SelectItem>
                <SelectItem value="sunday">Domingo</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
        <PanelFooter>
          <Button
            type="submit"
            size="sm"
            className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none"
          >
            <Save className="size-3.5" /> Salvar preferências
          </Button>
        </PanelFooter>
      </form>
    </SettingsPanel>
  );
}

function AppearanceSettings({
  settings,
  onUpdateSettings,
  onThemeChange,
}: {
  settings: WeekiSettings;
  onUpdateSettings: (updates: Partial<WeekiSettings>) => void;
  onThemeChange: (theme: WeekiTheme) => void;
}) {
  const themes: Array<{
    value: WeekiTheme;
    title: string;
    description: string;
    icon: typeof Sun;
  }> = [
    {
      value: "light",
      title: "Claro",
      description: "Interface sempre clara",
      icon: Sun,
    },
    {
      value: "dark",
      title: "Escuro",
      description: "Mais confortável à noite",
      icon: Moon,
    },
    {
      value: "system",
      title: "Sistema",
      description: "Segue seu dispositivo",
      icon: Laptop,
    },
  ];
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Aparência"
        description="Escolha como a interface da Weeki deve aparecer."
      >
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          {themes.map((theme) => (
            <button
              key={theme.value}
              type="button"
              onClick={() => onThemeChange(theme.value)}
              className={cn(
                "relative rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.025]",
                settings.appearance.theme === theme.value &&
                  "border-[#8d79ec] bg-[#faf9ff] ring-1 ring-[#d9d4ff] dark:border-violet-400/60 dark:bg-violet-500/8 dark:ring-violet-500/20",
              )}
            >
              <span className="mb-4 grid size-8 place-items-center rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                <theme.icon className="size-4" />
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {theme.title}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {theme.description}
              </p>
              {settings.appearance.theme === theme.value && (
                <span className="absolute right-3 top-3 grid size-4 place-items-center rounded-full bg-[#654fe4] text-white">
                  <Check className="size-2.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      </SettingsPanel>
      <SettingsPanel
        title="Densidade da interface"
        description="Ajuste o espaço entre elementos sem alterar o tamanho dos textos."
      >
        <div className="p-4 sm:p-5">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/[0.04]">
            {(
              [
                { value: "comfortable", label: "Confortável" },
                { value: "compact", label: "Compacta" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    appearance: { ...settings.appearance, density: item.value },
                  })
                }
                className={cn(
                  "h-8 rounded px-3 text-[10px] font-medium text-slate-500",
                  settings.appearance.density === item.value &&
                    "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-white/10 dark:text-white dark:ring-white/10",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </SettingsPanel>
    </div>
  );
}

function NotificationSettings({
  settings,
  onChange,
}: {
  settings: WeekiSettings;
  onChange: (
    key: keyof WeekiSettings["notifications"],
    checked: boolean,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Canais de notificação"
        description="Escolha onde deseja receber os avisos da Weeki."
      >
        <div className="divide-y divide-slate-100 dark:divide-white/8">
          <ToggleRow
            icon={Bell}
            title="Notificações no aplicativo"
            description="Avisos na central de notificações."
            checked={settings.notifications.inApp}
            onChange={(checked) => onChange("inApp", checked)}
          />
          <ToggleRow
            icon={Mail}
            title="Notificações por e-mail"
            description="Resumo e alertas enviados ao seu e-mail."
            checked={settings.notifications.email}
            onChange={(checked) => onChange("email", checked)}
          />
        </div>
      </SettingsPanel>
      <SettingsPanel
        title="O que você quer acompanhar"
        description="Controle quais acontecimentos devem gerar alertas."
      >
        <div className="divide-y divide-slate-100 dark:divide-white/8">
          <ToggleRow
            title="Resumo diário"
            description="Planejamento do dia enviado pela manhã."
            checked={settings.notifications.dailySummary}
            onChange={(checked) => onChange("dailySummary", checked)}
          />
          <ToggleRow
            title="Prazos de demandas"
            description="Lembretes de vencimentos próximos e atrasos."
            checked={settings.notifications.deadlineReminders}
            onChange={(checked) => onChange("deadlineReminders", checked)}
          />
          <ToggleRow
            title="Agendamentos"
            description="Avisos antes de reuniões e compromissos."
            checked={settings.notifications.appointmentReminders}
            onChange={(checked) => onChange("appointmentReminders", checked)}
          />
          <ToggleRow
            title="Cobranças e pagamentos"
            description="Mudanças de status, vencimentos e recebimentos."
            checked={settings.notifications.paymentUpdates}
            onChange={(checked) => onChange("paymentUpdates", checked)}
          />
          <ToggleRow
            title="Novidades da Weeki"
            description="Atualizações importantes e novos recursos."
            checked={settings.notifications.productNews}
            onChange={(checked) => onChange("productNews", checked)}
          />
        </div>
      </SettingsPanel>
    </div>
  );
}

function IntegrationsSettings() {
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Integrações"
        description="Conecte as ferramentas que já fazem parte da sua rotina."
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {(Object.keys(integrationMeta) as IntegrationId[])
            .filter((id) => id !== "asaas")
            .map((id) => {
              const item = integrationMeta[id];
              return (
                <article
                  key={id}
                  className="rounded-lg border border-slate-200 p-4 dark:border-white/10"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        item.tone,
                      )}
                    >
                      <item.icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {item.title}
                        </h3>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                          EM BREVE
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/8">
                    <span className="text-[9px] text-slate-400">
                      Integração em standby
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled
                      className="h-7 rounded-md px-2 text-[9px] shadow-none"
                    >
                      Conectar
                      <ExternalLink className="size-3" />
                    </Button>
                  </div>
                </article>
              );
            })}
        </div>
      </SettingsPanel>
      <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[9px] leading-4 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200">
        Nenhuma conexão é simulada. Os botões serão habilitados somente quando
        OAuth, backend e verificação de conta estiverem configurados.
      </div>
    </div>
  );
}

function TeamSettings() {
  return (
    <SettingsPanel
      title="Equipe"
      description="Convites e permissões ficam vinculados ao workspace autenticado."
    >
      <div className="p-4 sm:p-5">
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center dark:border-white/10 dark:bg-white/[0.025]">
          <UsersRound className="mx-auto size-6 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Estrutura preparada para equipes
          </h3>
          <p className="mx-auto mt-1 max-w-md text-[10px] leading-4 text-slate-400">
            O backend já isola dados por workspace e membership. Convites,
            papéis avançados e auditoria de equipe serão habilitados em uma
            etapa própria.
          </p>
        </div>
      </div>
    </SettingsPanel>
  );
}

function PlanSettings({ onPayments }: { onPayments: () => void }) {
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Plano"
        description="Assinatura, uso e cobrança da conta Weeki."
      >
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <article className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              Plano atual
            </p>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              Workspace local
            </h3>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              Sem cobrança ativa neste modo.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              Uso
            </p>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              Sem limite aplicado
            </h3>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              Métricas reais dependem do backend autenticado.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              Cobranças
            </p>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              Pagamentos separados
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPayments}
              className="mt-3 h-8 rounded-md px-2.5 text-[10px] shadow-none"
            >
              Abrir pagamentos
            </Button>
          </article>
        </div>
      </SettingsPanel>
    </div>
  );
}

function SecuritySettings({
  settings,
  authConfigured,
  providers,
  onLogout,
}: {
  settings: WeekiSettings;
  authConfigured: boolean;
  providers: ConnectedAuthProvider[];
  onLogout?: () => Promise<void> | void;
}) {
  const hasEmailProvider = providers.some(
    (provider) => provider.provider === "email",
  );
  return (
    <div className="space-y-4">
      {!authConfigured && (
        <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[9px] leading-4 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200">
          <strong>Proteção em standby.</strong> Senha, provedores sociais,
          alertas e sessões dependem do backend autenticado e das credenciais
          OIDC.
        </div>
      )}
      <SettingsPanel
        title="Acesso e autenticação"
        description="Camadas de proteção vinculadas ao provedor de identidade."
      >
        <div className="divide-y divide-slate-100 dark:divide-white/8">
          <ActionRow
            icon={KeyRound}
            title="Senha"
            description={
              hasEmailProvider
                ? "Gerenciada pelo provedor de identidade conectado"
                : "Conta social conectada; senha local não é obrigatória"
            }
            action="Gerenciada fora da Weeki"
            onClick={() => undefined}
            disabled
          />
          <ToggleRow
            icon={Smartphone}
            title="Autenticação em duas etapas"
            description="Exigirá configuração no provedor de identidade."
            checked={settings.security.twoFactorEnabled}
            onChange={() => undefined}
            disabled
          />
          <ToggleRow
            icon={Mail}
            title="Alertas de novo acesso"
            description="Avisos de sessões reconhecidos pelo servidor."
            checked={settings.security.loginAlerts}
            onChange={() => undefined}
            disabled
          />
        </div>
      </SettingsPanel>
      <SettingsPanel
        title="Provedores conectados"
        description="Métodos de entrada associados à sua conta."
      >
        <div className="divide-y divide-slate-100 dark:divide-white/8">
          {providers.length ? (
            providers.map((provider) => (
              <div
                key={`${provider.provider}-${provider.issuer}`}
                className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                  <ShieldCheck className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                    {provider.label}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] leading-4 text-slate-400">
                    {provider.email || provider.issuer}
                  </p>
                </div>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700">
                  Conectado
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-5 text-[10px] text-slate-400 sm:px-5">
              Nenhum provedor autenticado nesta sessão local.
            </div>
          )}
        </div>
      </SettingsPanel>
      <SettingsPanel
        title="Sessões"
        description="Dispositivos autenticados aparecerão aqui."
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300">
              <Laptop className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Este navegador
                </p>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                  {authConfigured ? "SESSÃO HTTPONLY" : "MODO LOCAL"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {authConfigured
                  ? "A sessão é opaca, expira no servidor e não expõe token ao frontend."
                  : "Sem sessão de conta ativa nesta versão visual."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-white/8 sm:flex-row sm:items-end sm:justify-between">
            <SettingsField label="Encerrar sessão após">
              <Select value={settings.security.sessionTimeout} disabled>
                <SelectTrigger className="h-8 w-[180px] rounded-md text-[10px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 dias sem atividade</SelectItem>
                  <SelectItem value="30d">30 dias sem atividade</SelectItem>
                  <SelectItem value="90d">90 dias sem atividade</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!onLogout || !authConfigured}
              onClick={() => void onLogout?.()}
              className="h-8 rounded-md px-2.5 text-[10px] shadow-none"
            >
              <LogOut className="size-3.5" /> Encerrar sessão
            </Button>
          </div>
        </div>
      </SettingsPanel>
    </div>
  );
}

function PrivacySettings({
  settings,
  onUpdateSettings,
  onExport,
  onDelete,
}: {
  settings: WeekiSettings;
  onUpdateSettings: (updates: Partial<WeekiSettings>) => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Privacidade e dados"
        description="Controle o uso dos seus dados e mantenha uma cópia local."
      >
        <div className="divide-y divide-slate-100 dark:divide-white/8">
          <ToggleRow
            title="Análises de uso"
            description="Ajude a melhorar o produto com dados de uso anônimos."
            checked={settings.privacy.usageAnalytics}
            onChange={(usageAnalytics) =>
              onUpdateSettings({
                privacy: { ...settings.privacy, usageAnalytics },
              })
            }
          />
          <ToggleRow
            title="Personalização"
            description="Use seu histórico para tornar sugestões mais relevantes."
            checked={settings.privacy.personalization}
            onChange={(personalization) =>
              onUpdateSettings({
                privacy: { ...settings.privacy, personalization },
              })
            }
          />
          <ActionRow
            icon={Download}
            title="Exportar meus dados"
            description="Baixe demandas, clientes e preferências em JSON."
            action="Exportar"
            onClick={onExport}
          />
        </div>
      </SettingsPanel>
      <section className="overflow-hidden rounded-xl border border-rose-200 bg-white dark:border-rose-500/25 dark:bg-[#15151b]">
        <div className="border-b border-rose-100 px-4 py-4 dark:border-rose-500/15 sm:px-5">
          <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            Área de risco
          </h2>
          <p className="mt-1 text-[10px] leading-4 text-slate-400">
            Ações permanentes que afetam sua conta e seus dados.
          </p>
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Excluir conta
            </p>
            <p className="mt-1 max-w-xl text-[10px] leading-4 text-slate-400">
              Remove dados locais, preferências, demandas, clientes, agenda,
              financeiro e cobranças deste navegador.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="h-8 shrink-0 rounded-md border-rose-200 px-2.5 text-[10px] text-rose-600 shadow-none hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="size-3.5" /> Excluir conta
          </Button>
        </div>
      </section>
    </div>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const deleteAccount = () => {
    if (confirmation !== "EXCLUIR") return;
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    ).filter((key): key is string => Boolean(key?.startsWith("weeki.")));
    keys.forEach((key) => window.localStorage.removeItem(key));
    toast.success("Dados da conta removidos.");
    window.setTimeout(() => window.location.reload(), 500);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setConfirmation("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0 rounded-xl p-0">
        <DialogHeader className="border-b border-rose-100 px-5 py-4 text-left dark:border-rose-500/15">
          <span className="mb-2 grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <Trash2 className="size-4" />
          </span>
          <DialogTitle className="text-base">
            Excluir conta e dados?
          </DialogTitle>
          <DialogDescription className="mt-1 text-[10px] leading-4">
            Esta ação não pode ser desfeita. Todos os dados da Weeki armazenados
            neste navegador serão apagados.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 py-5">
          <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            Digite <strong>EXCLUIR</strong> para confirmar
          </label>
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="EXCLUIR"
            className="mt-2 h-9 rounded-md text-xs shadow-none"
          />
        </div>
        <DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-white/8 dark:bg-white/[0.025]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-md text-[10px]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={confirmation !== "EXCLUIR"}
            onClick={deleteAccount}
            className="h-8 rounded-md px-3 text-[10px] shadow-none"
          >
            Excluir permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#15151b]">
      <header className="border-b border-slate-100 px-4 py-4 dark:border-white/8 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-1 text-[10px] leading-4 text-slate-400">
          {description}
        </p>
      </header>
      {children}
    </section>
  );
}
function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[9px] leading-4 text-slate-400">
          {hint}
        </span>
      )}
    </label>
  );
}
function PanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/[0.02] sm:px-5">
      {children}
    </div>
  );
}
function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  icon?: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 sm:px-5",
        disabled && "opacity-60",
      )}
    >
      {Icon && (
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
          <Icon className="size-3.5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </p>
        <p className="mt-0.5 text-[9px] leading-4 text-slate-400">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-[#654fe4]"
      />
    </div>
  );
}
function ActionRow({
  icon: Icon,
  title,
  description,
  action,
  onClick,
  disabled = false,
}: {
  icon: typeof Download;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 sm:px-5",
        disabled && "opacity-60",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </p>
        <p className="mt-0.5 text-[9px] leading-4 text-slate-400">
          {description}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className="h-8 rounded-md px-2.5 text-[10px] shadow-none"
      >
        {action}
      </Button>
    </div>
  );
}
