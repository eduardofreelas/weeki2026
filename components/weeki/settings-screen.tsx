"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Laptop,
  Link2,
  LogOut,
  Mail,
  Moon,
  Palette,
  Plug,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { IntegrationId, WeekiProfileSettings, WeekiRegionalSettings, WeekiSettings, WeekiTheme } from "@/features/settings/types";
import { cn } from "@/lib/utils";

import { SettingsPayments } from "@/components/payments/settings-payments";

type SettingsView = "payments" | "profile" | "workspace" | "appearance" | "notifications" | "integrations" | "security" | "privacy";

const navigation: Array<{ id: SettingsView; label: string; icon: typeof UserRound }> = [
  { id: "profile", label: "Perfil", icon: UserRound },
  { id: "workspace", label: "Preferências", icon: Settings2 },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "integrations", label: "Integrações", icon: Plug },
  { id: "payments", label: "Pagamentos", icon: Link2 },
  { id: "security", label: "Segurança", icon: ShieldCheck },
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

const integrationMeta: Record<IntegrationId, { title: string; description: string; icon: typeof CalendarDays; tone: string }> = {
  google_calendar: { title: "Google Calendar", description: "Sincronize compromissos e disponibilidade.", icon: CalendarDays, tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300" },
  google_drive: { title: "Google Drive", description: "Organize arquivos e pastas por cliente.", icon: HardDrive, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" },
  trello: { title: "Trello", description: "Importe quadros, listas e cartões existentes.", icon: UsersRound, tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300" },
  asaas: { title: "Asaas", description: "Receba cobranças diretamente na sua conta.", icon: Link2, tone: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300" },
};

export function SettingsScreen({ settings, onUpdateSettings, initialPayments = false }: { settings: WeekiSettings; onUpdateSettings: (updates: Partial<WeekiSettings>) => void; initialPayments?: boolean }) {
  const [view, setView] = useState<SettingsView>(initialPayments ? "payments" : "profile");
  const [profileDraft, setProfileDraft] = useState(settings.profile);
  const [regionalDraft, setRegionalDraft] = useState(settings.regional);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const initials = useMemo(() => profileDraft.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "WK", [profileDraft.name]);

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!profileDraft.name.trim() || !profileDraft.email.trim()) return toast.error("Informe nome e e-mail.");
    onUpdateSettings({ profile: profileDraft });
    toast.success("Perfil atualizado.");
  };

  const saveRegional = (event: FormEvent) => {
    event.preventDefault();
    onUpdateSettings({ regional: regionalDraft });
    toast.success("Preferências atualizadas.");
  };

  const changeTheme = (theme: WeekiTheme) => onUpdateSettings({ appearance: { ...settings.appearance, theme } });

  const setNotification = (key: keyof WeekiSettings["notifications"], checked: boolean) => {
    onUpdateSettings({ notifications: { ...settings.notifications, [key]: checked } });
  };

  const setIntegration = (id: IntegrationId, connected: boolean) => {
    onUpdateSettings({ integrations: { ...settings.integrations, [id]: connected } });
    toast.success(connected ? `${integrationMeta[id].title} conectado.` : `${integrationMeta[id].title} desconectado.`);
  };

  const exportData = () => {
    const data: Record<string, unknown> = {};
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("weeki.")) continue;
      const value = window.localStorage.getItem(key);
      try { data[key] = value ? JSON.parse(value) : null; } catch { data[key] = value; }
    }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
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
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-[#efedff] text-[#5b44df] dark:bg-violet-500/10 dark:text-violet-300"><Settings2 className="size-4" /></span>
        <div><h1 className="text-[23px] font-bold tracking-[-0.035em] text-slate-900 dark:text-white sm:text-[25px]">Configurações</h1><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Personalize seu espaço de trabalho e proteja sua conta.</p></div>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:gap-8">
        <nav className="week-board-scroll flex gap-1 overflow-x-auto border-b border-slate-200 pb-2 dark:border-white/10 lg:sticky lg:top-[88px] lg:block lg:space-y-1 lg:overflow-visible lg:border-0 lg:pb-0" aria-label="Seções das configurações">
          {navigation.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={cn("flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-[11px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white lg:w-full", view === item.id && "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-white/[0.08] dark:text-white dark:ring-white/10")}><item.icon className={cn("size-4", view === item.id && "text-[#6048df]")} /><span>{item.label}</span>{view === item.id && <ChevronRight className="ml-auto hidden size-3.5 text-slate-300 lg:block" />}</button>)}
        </nav>

        <div className="min-w-0">
          {view === "payments" && <SettingsPayments />}
          {view === "profile" && <ProfileSettings profile={profileDraft} initials={initials} onChange={setProfileDraft} onSubmit={saveProfile} />}
          {view === "workspace" && <RegionalSettings regional={regionalDraft} onChange={setRegionalDraft} onSubmit={saveRegional} />}
          {view === "appearance" && <AppearanceSettings settings={settings} onUpdateSettings={onUpdateSettings} onThemeChange={changeTheme} />}
          {view === "notifications" && <NotificationSettings settings={settings} onChange={setNotification} />}
          {view === "integrations" && <><button type="button" onClick={() => setView("payments")} className="mb-4 text-xs font-medium text-violet-500">Asaas, Mercado Pago e Stripe → Pagamentos</button><IntegrationsSettings settings={settings} onChange={setIntegration} /></>}
          {view === "security" && <SecuritySettings settings={settings} onUpdateSettings={onUpdateSettings} onPassword={() => setPasswordOpen(true)} />}
          {view === "privacy" && <PrivacySettings settings={settings} onUpdateSettings={onUpdateSettings} onExport={exportData} onDelete={() => setDeleteOpen(true)} />}
        </div>
      </div>

      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function ProfileSettings({ profile, initials, onChange, onSubmit }: { profile: WeekiProfileSettings; initials: string; onChange: (profile: WeekiProfileSettings) => void; onSubmit: (event: FormEvent) => void }) {
  return <SettingsPanel title="Perfil" description="Informações usadas para identificar você no Weeki.">
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 dark:border-white/8 sm:flex-row sm:items-center sm:px-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#202026] to-[#4b3ab8] text-base font-semibold text-white">{initials}</span>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Foto do perfil</p><p className="mt-1 text-[10px] leading-4 text-slate-400">JPG ou PNG de até 5 MB. Recomendado: 400 × 400 px.</p></div>
        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => toast.info("O envio de imagem será habilitado com o armazenamento do perfil.")} className="h-8 rounded-md px-2.5 text-[10px] shadow-none">Alterar foto</Button><Button type="button" variant="ghost" size="sm" className="h-8 rounded-md px-2 text-[10px] text-slate-400">Remover</Button></div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <SettingsField label="Nome completo"><Input value={profile.name} onChange={(event) => onChange({ ...profile, name: event.target.value })} className="h-9 rounded-md text-xs shadow-none" /></SettingsField>
        <SettingsField label="E-mail"><Input type="email" value={profile.email} onChange={(event) => onChange({ ...profile, email: event.target.value })} className="h-9 rounded-md text-xs shadow-none" /></SettingsField>
        <SettingsField label="Telefone"><Input value={profile.phone} onChange={(event) => onChange({ ...profile, phone: event.target.value })} placeholder="(85) 99999-9999" className="h-9 rounded-md text-xs shadow-none" /></SettingsField>
        <SettingsField label="Cargo ou função"><Input value={profile.role} onChange={(event) => onChange({ ...profile, role: event.target.value })} className="h-9 rounded-md text-xs shadow-none" /></SettingsField>
        <div className="sm:col-span-2"><SettingsField label="Nome do negócio"><Input value={profile.businessName} onChange={(event) => onChange({ ...profile, businessName: event.target.value })} className="h-9 rounded-md text-xs shadow-none sm:max-w-md" /></SettingsField></div>
      </div>
      <PanelFooter><Button type="submit" size="sm" className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none"><Save className="size-3.5" /> Salvar alterações</Button></PanelFooter>
    </form>
  </SettingsPanel>;
}

function RegionalSettings({ regional, onChange, onSubmit }: { regional: WeekiRegionalSettings; onChange: (regional: WeekiRegionalSettings) => void; onSubmit: (event: FormEvent) => void }) {
  return <SettingsPanel title="Preferências regionais" description="Defina como datas, horários e valores aparecem no seu espaço.">
    <form onSubmit={onSubmit}>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="sm:col-span-2"><SettingsField label="Fuso horário" hint="Usado em demandas, lembretes, eventos e cobranças."><Select value={regional.timezone} onValueChange={(timezone) => onChange({ ...regional, timezone })}><SelectTrigger className="h-9 rounded-md text-xs shadow-none sm:max-w-md"><Clock3 className="size-3.5 text-slate-400" /><SelectValue /></SelectTrigger><SelectContent>{timezones.map((timezone) => <SelectItem key={timezone.value} value={timezone.value}>{timezone.label}</SelectItem>)}</SelectContent></Select></SettingsField></div>
        <SettingsField label="Idioma"><Select value={regional.language} onValueChange={() => undefined}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt-BR">Português (Brasil)</SelectItem></SelectContent></Select></SettingsField>
        <SettingsField label="Moeda"><Select value={regional.currency} onValueChange={() => undefined}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BRL">Real brasileiro (R$)</SelectItem></SelectContent></Select></SettingsField>
        <SettingsField label="Formato de data"><Select value={regional.dateFormat} onValueChange={(dateFormat) => onChange({ ...regional, dateFormat: dateFormat as WeekiRegionalSettings["dateFormat"] })}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dd/MM/yyyy">31/12/2026</SelectItem><SelectItem value="yyyy-MM-dd">2026-12-31</SelectItem></SelectContent></Select></SettingsField>
        <SettingsField label="Formato de horário"><Select value={regional.timeFormat} onValueChange={(timeFormat) => onChange({ ...regional, timeFormat: timeFormat as WeekiRegionalSettings["timeFormat"] })}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24h">24 horas — 18:30</SelectItem><SelectItem value="12h">12 horas — 6:30 PM</SelectItem></SelectContent></Select></SettingsField>
        <SettingsField label="Primeiro dia da semana"><Select value={regional.weekStartsOn} onValueChange={(weekStartsOn) => onChange({ ...regional, weekStartsOn: weekStartsOn as WeekiRegionalSettings["weekStartsOn"] })}><SelectTrigger className="h-9 rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monday">Segunda-feira</SelectItem><SelectItem value="sunday">Domingo</SelectItem></SelectContent></Select></SettingsField>
      </div>
      <PanelFooter><Button type="submit" size="sm" className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none"><Save className="size-3.5" /> Salvar preferências</Button></PanelFooter>
    </form>
  </SettingsPanel>;
}

function AppearanceSettings({ settings, onUpdateSettings, onThemeChange }: { settings: WeekiSettings; onUpdateSettings: (updates: Partial<WeekiSettings>) => void; onThemeChange: (theme: WeekiTheme) => void }) {
  const themes: Array<{ value: WeekiTheme; title: string; description: string; icon: typeof Sun }> = [{ value: "light", title: "Claro", description: "Interface sempre clara", icon: Sun }, { value: "dark", title: "Escuro", description: "Mais confortável à noite", icon: Moon }, { value: "system", title: "Sistema", description: "Segue seu dispositivo", icon: Laptop }];
  return <div className="space-y-4">
    <SettingsPanel title="Aparência" description="Escolha como a interface da Weeki deve aparecer.">
      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">{themes.map((theme) => <button key={theme.value} type="button" onClick={() => onThemeChange(theme.value)} className={cn("relative rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.025]", settings.appearance.theme === theme.value && "border-[#8d79ec] bg-[#faf9ff] ring-1 ring-[#d9d4ff] dark:border-violet-400/60 dark:bg-violet-500/8 dark:ring-violet-500/20")}><span className="mb-4 grid size-8 place-items-center rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300"><theme.icon className="size-4" /></span><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{theme.title}</p><p className="mt-1 text-[10px] text-slate-400">{theme.description}</p>{settings.appearance.theme === theme.value && <span className="absolute right-3 top-3 grid size-4 place-items-center rounded-full bg-[#654fe4] text-white"><Check className="size-2.5" /></span>}</button>)}</div>
    </SettingsPanel>
    <SettingsPanel title="Densidade da interface" description="Ajuste o espaço entre elementos sem alterar o tamanho dos textos."><div className="p-4 sm:p-5"><div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/[0.04]">{([{ value: "comfortable", label: "Confortável" }, { value: "compact", label: "Compacta" }] as const).map((item) => <button key={item.value} type="button" onClick={() => onUpdateSettings({ appearance: { ...settings.appearance, density: item.value } })} className={cn("h-8 rounded px-3 text-[10px] font-medium text-slate-500", settings.appearance.density === item.value && "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-white/10 dark:text-white dark:ring-white/10")}>{item.label}</button>)}</div></div></SettingsPanel>
  </div>;
}

function NotificationSettings({ settings, onChange }: { settings: WeekiSettings; onChange: (key: keyof WeekiSettings["notifications"], checked: boolean) => void }) {
  return <div className="space-y-4">
    <SettingsPanel title="Canais de notificação" description="Escolha onde deseja receber os avisos da Weeki."><div className="divide-y divide-slate-100 dark:divide-white/8"><ToggleRow icon={Bell} title="Notificações no aplicativo" description="Avisos na central de notificações." checked={settings.notifications.inApp} onChange={(checked) => onChange("inApp", checked)} /><ToggleRow icon={Mail} title="Notificações por e-mail" description="Resumo e alertas enviados ao seu e-mail." checked={settings.notifications.email} onChange={(checked) => onChange("email", checked)} /></div></SettingsPanel>
    <SettingsPanel title="O que você quer acompanhar" description="Controle quais acontecimentos devem gerar alertas."><div className="divide-y divide-slate-100 dark:divide-white/8"><ToggleRow title="Resumo diário" description="Planejamento do dia enviado pela manhã." checked={settings.notifications.dailySummary} onChange={(checked) => onChange("dailySummary", checked)} /><ToggleRow title="Prazos de demandas" description="Lembretes de vencimentos próximos e atrasos." checked={settings.notifications.deadlineReminders} onChange={(checked) => onChange("deadlineReminders", checked)} /><ToggleRow title="Agendamentos" description="Avisos antes de reuniões e compromissos." checked={settings.notifications.appointmentReminders} onChange={(checked) => onChange("appointmentReminders", checked)} /><ToggleRow title="Cobranças e pagamentos" description="Mudanças de status, vencimentos e recebimentos." checked={settings.notifications.paymentUpdates} onChange={(checked) => onChange("paymentUpdates", checked)} /><ToggleRow title="Novidades da Weeki" description="Atualizações importantes e novos recursos." checked={settings.notifications.productNews} onChange={(checked) => onChange("productNews", checked)} /></div></SettingsPanel>
  </div>;
}

function IntegrationsSettings({ settings, onChange }: { settings: WeekiSettings; onChange: (id: IntegrationId, connected: boolean) => void }) {
  return <SettingsPanel title="Integrações" description="Conecte as ferramentas que já fazem parte da sua rotina."><div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">{(Object.keys(integrationMeta) as IntegrationId[]).filter(id => id !== "asaas").map((id) => { const item = integrationMeta[id]; const connected = settings.integrations[id]; return <article key={id} className="rounded-lg border border-slate-200 p-4 dark:border-white/10"><div className="flex items-start gap-3"><span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", item.tone)}><item.icon className="size-[18px]" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">{item.title}</h3>{connected && <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><span className="size-1 rounded-full bg-current" />Conectado</span>}</div><p className="mt-1 text-[10px] leading-4 text-slate-400">{item.description}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/8"><span className="text-[9px] text-slate-400">{connected ? "Sincronização ativa" : "Não conectado"}</span><Button type="button" variant={connected ? "ghost" : "outline"} size="xs" onClick={() => onChange(id, !connected)} className={cn("h-7 rounded-md px-2 text-[9px] shadow-none", connected && "text-rose-500")}>{connected ? "Desconectar" : "Conectar"}{!connected && <ExternalLink className="size-3" />}</Button></div></article>; })}</div></SettingsPanel>;
}

function SecuritySettings({ settings, onUpdateSettings, onPassword }: { settings: WeekiSettings; onUpdateSettings: (updates: Partial<WeekiSettings>) => void; onPassword: () => void }) {
  return <div className="space-y-4">
    <SettingsPanel title="Acesso e autenticação" description="Adicione camadas extras de proteção à sua conta."><div className="divide-y divide-slate-100 dark:divide-white/8"><ActionRow icon={KeyRound} title="Senha" description="Última alteração não registrada" action="Alterar senha" onClick={onPassword} /><ToggleRow icon={Smartphone} title="Autenticação em duas etapas" description="Exige um código adicional ao entrar." checked={settings.security.twoFactorEnabled} onChange={(checked) => onUpdateSettings({ security: { ...settings.security, twoFactorEnabled: checked } })} /><ToggleRow icon={Mail} title="Alertas de novo acesso" description="Receba um e-mail quando sua conta for acessada." checked={settings.security.loginAlerts} onChange={(checked) => onUpdateSettings({ security: { ...settings.security, loginAlerts: checked } })} /></div></SettingsPanel>
    <SettingsPanel title="Sessões" description="Dispositivos que acessaram sua conta."><div className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300"><Laptop className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Windows · Chrome</p><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Esta sessão</span></div><p className="mt-1 text-[10px] text-slate-400">Fortaleza, CE · Ativo agora</p></div></div><div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-white/8 sm:flex-row sm:items-end sm:justify-between"><SettingsField label="Encerrar sessão após"><Select value={settings.security.sessionTimeout} onValueChange={(sessionTimeout) => onUpdateSettings({ security: { ...settings.security, sessionTimeout: sessionTimeout as WeekiSettings["security"]["sessionTimeout"] } })}><SelectTrigger className="h-8 w-[180px] rounded-md text-[10px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7d">7 dias sem atividade</SelectItem><SelectItem value="30d">30 dias sem atividade</SelectItem><SelectItem value="90d">90 dias sem atividade</SelectItem></SelectContent></Select></SettingsField><Button type="button" variant="outline" size="sm" onClick={() => toast.info("Não há outras sessões ativas.")} className="h-8 rounded-md px-2.5 text-[10px] shadow-none"><LogOut className="size-3.5" /> Encerrar outras sessões</Button></div></div></SettingsPanel>
  </div>;
}

function PrivacySettings({ settings, onUpdateSettings, onExport, onDelete }: { settings: WeekiSettings; onUpdateSettings: (updates: Partial<WeekiSettings>) => void; onExport: () => void; onDelete: () => void }) {
  return <div className="space-y-4">
    <SettingsPanel title="Privacidade e dados" description="Controle o uso dos seus dados e mantenha uma cópia local."><div className="divide-y divide-slate-100 dark:divide-white/8"><ToggleRow title="Análises de uso" description="Ajude a melhorar o produto com dados de uso anônimos." checked={settings.privacy.usageAnalytics} onChange={(usageAnalytics) => onUpdateSettings({ privacy: { ...settings.privacy, usageAnalytics } })} /><ToggleRow title="Personalização" description="Use seu histórico para tornar sugestões mais relevantes." checked={settings.privacy.personalization} onChange={(personalization) => onUpdateSettings({ privacy: { ...settings.privacy, personalization } })} /><ActionRow icon={Download} title="Exportar meus dados" description="Baixe demandas, clientes e preferências em JSON." action="Exportar" onClick={onExport} /></div></SettingsPanel>
    <section className="overflow-hidden rounded-xl border border-rose-200 bg-white dark:border-rose-500/25 dark:bg-[#15151b]"><div className="border-b border-rose-100 px-4 py-4 dark:border-rose-500/15 sm:px-5"><h2 className="text-sm font-semibold text-rose-700 dark:text-rose-300">Área de risco</h2><p className="mt-1 text-[10px] leading-4 text-slate-400">Ações permanentes que afetam sua conta e seus dados.</p></div><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Excluir conta</p><p className="mt-1 max-w-xl text-[10px] leading-4 text-slate-400">Remove dados locais, preferências, demandas, clientes, agenda, financeiro e cobranças deste navegador.</p></div><Button type="button" variant="outline" size="sm" onClick={onDelete} className="h-8 shrink-0 rounded-md border-rose-200 px-2.5 text-[10px] text-rose-600 shadow-none hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"><Trash2 className="size-3.5" /> Excluir conta</Button></div></section>
  </div>;
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const submit = () => {
    if (currentPassword.length < 6 || newPassword.length < 8) return toast.error("Confira as senhas informadas.");
    toast.success("Senha atualizada.");
    setCurrentPassword(""); setNewPassword(""); onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-sm gap-0 rounded-xl p-0"><DialogHeader className="border-b border-slate-100 px-5 py-4 text-left dark:border-white/8"><DialogTitle className="text-base">Alterar senha</DialogTitle><DialogDescription className="mt-1 text-[10px]">Use pelo menos 8 caracteres na nova senha.</DialogDescription></DialogHeader><div className="space-y-4 px-5 py-5"><SettingsField label="Senha atual"><Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></SettingsField><SettingsField label="Nova senha"><div className="relative"><Input type={visible ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-9 rounded-md pr-9 text-xs shadow-none" /><button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">{visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button></div></SettingsField><div className="grid grid-cols-3 gap-1"><span className={cn("h-1 rounded-full", newPassword.length >= 1 ? "bg-amber-400" : "bg-slate-100")} /><span className={cn("h-1 rounded-full", newPassword.length >= 8 ? "bg-amber-400" : "bg-slate-100")} /><span className={cn("h-1 rounded-full", newPassword.length >= 12 ? "bg-emerald-500" : "bg-slate-100")} /></div></div><DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-white/8 dark:bg-white/[0.025]"><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 rounded-md text-[10px]">Cancelar</Button><Button type="button" size="sm" onClick={submit} className="h-8 rounded-md bg-[#5140df] px-3 text-[10px] shadow-none">Atualizar senha</Button></DialogFooter></DialogContent></Dialog>;
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [confirmation, setConfirmation] = useState("");
  const deleteAccount = () => {
    if (confirmation !== "EXCLUIR") return;
    const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith("weeki.")));
    keys.forEach((key) => window.localStorage.removeItem(key));
    toast.success("Dados da conta removidos.");
    window.setTimeout(() => window.location.reload(), 500);
  };
  return <Dialog open={open} onOpenChange={(next) => { setConfirmation(""); onOpenChange(next); }}><DialogContent className="max-w-md gap-0 rounded-xl p-0"><DialogHeader className="border-b border-rose-100 px-5 py-4 text-left dark:border-rose-500/15"><span className="mb-2 grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"><Trash2 className="size-4" /></span><DialogTitle className="text-base">Excluir conta e dados?</DialogTitle><DialogDescription className="mt-1 text-[10px] leading-4">Esta ação não pode ser desfeita. Todos os dados da Weeki armazenados neste navegador serão apagados.</DialogDescription></DialogHeader><div className="px-5 py-5"><label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Digite <strong>EXCLUIR</strong> para confirmar</label><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="EXCLUIR" className="mt-2 h-9 rounded-md text-xs shadow-none" /></div><DialogFooter className="flex-row border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-white/8 dark:bg-white/[0.025]"><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 rounded-md text-[10px]">Cancelar</Button><Button type="button" variant="destructive" size="sm" disabled={confirmation !== "EXCLUIR"} onClick={deleteAccount} className="h-8 rounded-md px-3 text-[10px] shadow-none">Excluir permanentemente</Button></DialogFooter></DialogContent></Dialog>;
}

function SettingsPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#15151b]"><header className="border-b border-slate-100 px-4 py-4 dark:border-white/8 sm:px-5"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-[10px] leading-4 text-slate-400">{description}</p></header>{children}</section>; }
function SettingsField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>{children}{hint && <span className="mt-1.5 block text-[9px] leading-4 text-slate-400">{hint}</span>}</label>; }
function PanelFooter({ children }: { children: ReactNode }) { return <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/[0.02] sm:px-5">{children}</div>; }
function ToggleRow({ icon: Icon, title, description, checked, onChange }: { icon?: typeof Bell; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">{Icon && <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300"><Icon className="size-3.5" /></span>}<div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{title}</p><p className="mt-0.5 text-[9px] leading-4 text-slate-400">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-[#654fe4]" /></div>; }
function ActionRow({ icon: Icon, title, description, action, onClick }: { icon: typeof Download; title: string; description: string; action: string; onClick: () => void }) { return <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300"><Icon className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{title}</p><p className="mt-0.5 text-[9px] leading-4 text-slate-400">{description}</p></div><Button type="button" variant="outline" size="sm" onClick={onClick} className="h-8 rounded-md px-2.5 text-[10px] shadow-none">{action}</Button></div>; }
