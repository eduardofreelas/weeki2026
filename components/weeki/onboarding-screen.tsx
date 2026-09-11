"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, HardDrive, Link2, Loader2, Plug, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AvailabilitySettingsPanel } from "@/components/weeki/availability-settings-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WeekiSettings } from "@/features/settings/types";
import type { AccountProfileInput, OnboardingInput, OnboardingStep } from "@/shared/account";
import { ONBOARDING_STEPS } from "@/shared/account";
import { TIMEZONE_OPTIONS, isAvailabilityConfigured, type WeekiAvailability } from "@/shared/availability";
import { cn } from "@/lib/utils";

const stepIcons: Record<Exclude<OnboardingStep, "done">, typeof UserRound> = {
  work: UserRound,
  space: HardDrive,
  availability: CalendarDays,
  connections: Plug,
};

export function OnboardingScreen({
  settings,
  availability,
  availabilitySaving,
  onUpdateSettings,
  onSaveAccountProfile,
  onSaveAvailability,
  onProgress,
}: {
  settings: WeekiSettings;
  availability: WeekiAvailability;
  availabilitySaving?: boolean;
  onUpdateSettings: (updates: Partial<WeekiSettings>) => void;
  onSaveAccountProfile?: (updates: AccountProfileInput) => Promise<void> | void;
  onSaveAvailability: (availability: WeekiAvailability) => Promise<WeekiAvailability> | WeekiAvailability;
  onProgress: (input: OnboardingInput) => Promise<unknown> | unknown;
}) {
  const [stepIndex, setStepIndex] = useState(() => {
    const current = settings.profile.businessName ? 1 : 0;
    return current;
  });
  const [profileDraft, setProfileDraft] = useState(settings.profile);
  const [regionalDraft, setRegionalDraft] = useState(settings.regional);
  const [saving, setSaving] = useState(false);
  const current = ONBOARDING_STEPS[stepIndex];
  const StepIcon = stepIcons[current.id];
  const completedPercent = Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100);
  const canFinishAvailability = useMemo(() => isAvailabilityConfigured(availability), [availability]);

  const persistProfile = async () => {
    onUpdateSettings({ profile: profileDraft, regional: regionalDraft });
    await onSaveAccountProfile?.({
      name: profileDraft.name,
      avatarUrl: profileDraft.avatarUrl,
      phone: profileDraft.phone,
      professionalName: profileDraft.professionalName,
      businessName: profileDraft.businessName,
      businessArea: profileDraft.businessArea,
      workDescription: profileDraft.workDescription,
      workspaceName: profileDraft.workspaceName,
      timezone: regionalDraft.timezone,
    });
  };

  const continueStep = async () => {
    setSaving(true);
    try {
      if (current.id === "work") {
        if (!profileDraft.name.trim() || !profileDraft.professionalName.trim()) {
          toast.error("Informe seu nome e nome profissional.");
          return;
        }
        await persistProfile();
      }
      if (current.id === "space") {
        if (!profileDraft.workspaceName.trim()) {
          toast.error("Informe o nome do espaço.");
          return;
        }
        await persistProfile();
      }
      if (current.id === "availability" && !canFinishAvailability) {
        toast.error("Salve uma disponibilidade válida ou pule por enquanto.");
        return;
      }
      const completedSteps = ONBOARDING_STEPS.slice(0, stepIndex + 1).map((step) => step.id);
      if (stepIndex === ONBOARDING_STEPS.length - 1) {
        await onProgress({ status: "completed", step: "done", completedSteps: [...completedSteps, "done"] });
        toast.success("Conta configurada.");
        return;
      }
      const next = ONBOARDING_STEPS[stepIndex + 1];
      await onProgress({ status: "in_progress", step: next.id, completedSteps });
      setStepIndex((index) => index + 1);
    } catch {
      toast.error("Não foi possível salvar o progresso.");
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      await persistProfile();
      await onProgress({ status: "skipped", step: current.id, completedSteps: ONBOARDING_STEPS.slice(0, stepIndex).map((step) => step.id) });
      toast.success("Você pode concluir a configuração depois.");
    } catch {
      toast.error("Não foi possível salvar o progresso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[#f1efff] text-[#5d48dd]"><StepIcon className="size-5" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5d48dd]">Configuração inicial</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{current.label}</h1>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span>Etapa {stepIndex + 1} de {ONBOARDING_STEPS.length}</span><span>{completedPercent}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#5d48dd]" style={{ width: `${completedPercent}%` }} /></div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="week-board-scroll flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-visible" aria-label="Etapas do onboarding">
            {ONBOARDING_STEPS.map((step, index) => {
              const Icon = stepIcons[step.id];
              return <button key={step.id} type="button" onClick={() => setStepIndex(index)} className={cn("flex h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-card lg:w-full", index === stepIndex && "border-[#b7aefa] bg-[#f7f5ff] text-[#5d48dd]")}><Icon className="size-4" />{step.label}</button>;
            })}
          </nav>

          <section className="min-w-0">
            {current.id === "work" && <WorkStep profile={profileDraft} onChange={setProfileDraft} />}
            {current.id === "space" && <SpaceStep profile={profileDraft} timezone={regionalDraft.timezone} onProfileChange={setProfileDraft} onTimezoneChange={(timezone) => setRegionalDraft((currentRegional) => ({ ...currentRegional, timezone }))} />}
            {current.id === "availability" && <AvailabilitySettingsPanel availability={availability} saving={availabilitySaving} compact onSave={onSaveAvailability} />}
            {current.id === "connections" && <ConnectionsStep />}
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-card sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={skip} disabled={saving} className="h-9 text-xs text-slate-500">Pular por enquanto</Button>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0 || saving} className="h-9 text-xs"><ChevronLeft className="size-3.5" /> Voltar</Button>
            <Button type="button" size="sm" onClick={continueStep} disabled={saving} className="h-9 bg-[#5140df] text-xs">{saving ? <Loader2 className="size-3.5 animate-spin" /> : stepIndex === ONBOARDING_STEPS.length - 1 ? <Check className="size-3.5" /> : <ChevronRight className="size-3.5" />} {stepIndex === ONBOARDING_STEPS.length - 1 ? "Concluir" : "Continuar"}</Button>
          </div>
        </footer>
      </div>
    </main>
  );
}

function WorkStep({ profile, onChange }: { profile: WeekiSettings["profile"]; onChange: (profile: WeekiSettings["profile"]) => void }) {
  return <Panel title="Seu trabalho" description="Use dados leves e úteis para personalizar a Weeki.">
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
      <Field label="Nome completo"><Input value={profile.name} onChange={(event) => onChange({ ...profile, name: event.target.value })} className="h-10 text-sm shadow-none" /></Field>
      <Field label="Nome profissional"><Input value={profile.professionalName} onChange={(event) => onChange({ ...profile, professionalName: event.target.value })} className="h-10 text-sm shadow-none" /></Field>
      <Field label="Área de atuação"><Input value={profile.businessArea} onChange={(event) => onChange({ ...profile, businessArea: event.target.value })} placeholder="Consultoria, terapia, advocacia..." className="h-10 text-sm shadow-none" /></Field>
      <Field label="Telefone ou WhatsApp"><Input value={profile.phone} onChange={(event) => onChange({ ...profile, phone: event.target.value })} placeholder="(85) 99999-9999" className="h-10 text-sm shadow-none" /></Field>
      <div className="sm:col-span-2"><Field label="Descrição curta"><Textarea value={profile.workDescription} onChange={(event) => onChange({ ...profile, workDescription: event.target.value })} rows={4} className="resize-none text-sm shadow-none" /></Field></div>
    </div>
  </Panel>;
}

function SpaceStep({ profile, timezone, onProfileChange, onTimezoneChange }: { profile: WeekiSettings["profile"]; timezone: string; onProfileChange: (profile: WeekiSettings["profile"]) => void; onTimezoneChange: (timezone: string) => void }) {
  return <Panel title="Seu espaço" description="Defina como o workspace será reconhecido dentro da Weeki.">
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
      <Field label="Nome do espaço"><Input value={profile.workspaceName} onChange={(event) => onProfileChange({ ...profile, workspaceName: event.target.value })} className="h-10 text-sm shadow-none" /></Field>
      <Field label="Nome da empresa ou marca"><Input value={profile.businessName} onChange={(event) => onProfileChange({ ...profile, businessName: event.target.value })} className="h-10 text-sm shadow-none" /></Field>
      <div className="sm:col-span-2"><Field label="Fuso horário"><Select value={timezone} onValueChange={onTimezoneChange}><SelectTrigger className="h-10 w-full text-sm shadow-none sm:max-w-md"><SelectValue /></SelectTrigger><SelectContent>{TIMEZONE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field></div>
    </div>
  </Panel>;
}

function ConnectionsStep() {
  const items = [
    { title: "Asaas", description: "Cobranças e recebimentos", icon: Link2 },
    { title: "Google Drive", description: "Arquivos por cliente", icon: HardDrive },
    { title: "Trello", description: "Quadros e cartões", icon: Plug },
  ];
  return <Panel title="Conexões" description="Integrações opcionais podem ser ativadas depois nas Configurações.">
    <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
      {items.map((item) => <article key={item.title} className="rounded-lg border border-slate-200 p-4 dark:border-white/10"><span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"><item.icon className="size-4" /></span><h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3><p className="mt-1 text-[10px] leading-4 text-slate-400">{item.description}</p><span className="mt-4 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500 dark:bg-white/[0.06]">Opcional</span></article>)}
    </div>
  </Panel>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card"><header className="border-b border-slate-100 px-4 py-4 dark:border-white/8 sm:px-5"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-[10px] leading-4 text-slate-400">{description}</p></header>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</span>{children}</Label>;
}
