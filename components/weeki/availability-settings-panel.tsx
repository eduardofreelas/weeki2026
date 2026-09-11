"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Check, Clock3, Copy, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  BUFFER_OPTIONS,
  DURATION_OPTIONS,
  MAX_FUTURE_OPTIONS,
  MIN_NOTICE_OPTIONS,
  TIMEZONE_OPTIONS,
  WEEKDAYS,
  isAvailabilityConfigured,
  normalizeAvailability,
  validateAvailability,
  type AvailabilityPeriod,
  type WeekdayKey,
  type WeekiAvailability,
} from "@/shared/availability";
import { cn } from "@/lib/utils";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clonePeriod = (period: AvailabilityPeriod): AvailabilityPeriod => ({ ...period, id: makeId() });
const fallbackPeriod = (): AvailabilityPeriod => ({ id: makeId(), start: "09:00", end: "17:00" });

export function AvailabilitySettingsPanel({
  availability,
  saving = false,
  compact = false,
  onSave,
  onDirtyChange,
}: {
  availability: WeekiAvailability;
  saving?: boolean;
  compact?: boolean;
  onSave: (availability: WeekiAvailability) => Promise<WeekiAvailability> | WeekiAvailability;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => normalizeAvailability(availability));
  const [saved, setSaved] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Record<WeekdayKey, WeekdayKey | "weekdays" | "all">>({
    "0": "weekdays",
    "1": "weekdays",
    "2": "weekdays",
    "3": "weekdays",
    "4": "weekdays",
    "5": "weekdays",
    "6": "weekdays",
  });
  const normalizedOriginal = useMemo(() => normalizeAvailability(availability), [availability]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(normalizedOriginal);
  const validation = useMemo(() => validateAvailability(draft), [draft]);
  const configured = isAvailabilityConfigured(normalizedOriginal);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(normalizeAvailability(availability));
    setSaved(false);
  }, [availability]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const updateDay = (key: WeekdayKey, updater: (day: WeekiAvailability["weekly"][WeekdayKey]) => WeekiAvailability["weekly"][WeekdayKey]) => {
    setDraft((current) => normalizeAvailability({
      ...current,
      weekly: {
        ...current.weekly,
        [key]: updater(current.weekly[key]),
      },
    }));
    setSaved(false);
  };

  const toggleDay = (key: WeekdayKey, enabled: boolean) => updateDay(key, (day) => ({
    enabled,
    periods: enabled && day.periods.length === 0 ? [fallbackPeriod()] : day.periods,
  }));

  const updatePeriod = (dayKey: WeekdayKey, periodId: string, field: "start" | "end", value: string) => updateDay(dayKey, (day) => ({
    ...day,
    periods: day.periods.map((period) => period.id === periodId ? { ...period, [field]: value } : period),
  }));

  const addPeriod = (dayKey: WeekdayKey) => updateDay(dayKey, (day) => ({
    enabled: true,
    periods: [...day.periods, fallbackPeriod()],
  }));

  const removePeriod = (dayKey: WeekdayKey, periodId: string) => updateDay(dayKey, (day) => ({
    ...day,
    periods: day.periods.filter((period) => period.id !== periodId),
  }));

  const copyFrom = (source: WeekdayKey) => {
    const target = copyTargets[source];
    const targets = target === "all"
      ? WEEKDAYS.map((day) => day.key).filter((key) => key !== source)
      : target === "weekdays"
        ? WEEKDAYS.map((day) => day.key).filter((key) => key !== source && key !== "0" && key !== "6")
        : [target].filter((key) => key !== source);
    if (!targets.length) return;
    setDraft((current) => {
      const sourceDay = current.weekly[source];
      const weekly = { ...current.weekly };
      targets.forEach((targetKey) => {
        weekly[targetKey] = {
          enabled: sourceDay.enabled,
          periods: sourceDay.periods.map(clonePeriod),
        };
      });
      return normalizeAvailability({ ...current, weekly });
    });
    setSaved(false);
    toast.success("Horários copiados.");
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const result = validateAvailability(draft);
    if (!result.valid) {
      toast.error(result.errors[0] || "Revise os horários informados.");
      return;
    }
    const savedAvailability = await onSave(normalizeAvailability(draft));
    setDraft(normalizeAvailability(savedAvailability));
    setSaved(true);
    toast.success("Disponibilidade salva.");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#15151b]", compact && "rounded-lg")}>
        <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 dark:border-white/8 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Agenda semanal</h2>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">Defina dias e períodos em que você pode receber agendamentos.</p>
          </div>
          <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-semibold", configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {configured ? <Check className="size-3" /> : <AlertCircle className="size-3" />}
            {configured ? "Configurada" : "Pendente"}
          </span>
        </header>

        <div className="divide-y divide-slate-100 dark:divide-white/8">
          {WEEKDAYS.map((day) => {
            const config = draft.weekly[day.key];
            return (
              <div key={day.key} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[180px_minmax(0,1fr)_210px]">
                <div className="flex items-center gap-3">
                  <Switch checked={config.enabled} onCheckedChange={(checked) => toggleDay(day.key, checked)} className="data-[state=checked]:bg-[#654fe4]" aria-label={`Ativar ${day.label}`} />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{day.label}</p>
                    <p className="mt-0.5 text-[9px] text-slate-400">{config.enabled ? `${config.periods.length} período(s)` : "Indisponível"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {config.enabled ? config.periods.map((period) => (
                    <div key={period.id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,130px)_minmax(0,130px)_36px]">
                      <Field label="Início">
                        <Input type="time" value={period.start} onChange={(event) => updatePeriod(day.key, period.id, "start", event.target.value)} className="h-9 rounded-md bg-white text-xs shadow-none dark:bg-card" />
                      </Field>
                      <Field label="Fim">
                        <Input type="time" value={period.end} onChange={(event) => updatePeriod(day.key, period.id, "end", event.target.value)} className="h-9 rounded-md bg-white text-xs shadow-none dark:bg-card" />
                      </Field>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removePeriod(day.key, period.id)} aria-label={`Remover período de ${day.label}`} className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )) : <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-[10px] text-slate-400 dark:border-white/10">Ative o dia para adicionar horários.</p>}
                  <Button type="button" variant="ghost" size="sm" onClick={() => addPeriod(day.key)} className="h-8 px-2 text-[10px] text-[#5d48dd]">
                    <Plus className="size-3.5" /> Adicionar período
                  </Button>
                </div>

                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.04em] text-slate-400">Copiar para</span>
                    <select
                      value={copyTargets[day.key]}
                      onChange={(event) => setCopyTargets((current) => ({ ...current, [day.key]: event.target.value as WeekdayKey | "weekdays" | "all" }))}
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-[10px] text-slate-600 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30 dark:bg-card dark:text-slate-200"
                    >
                      <option value="weekdays">Dias úteis</option>
                      <option value="all">Todos os dias</option>
                      {WEEKDAYS.filter((item) => item.key !== day.key).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                  </label>
                  <Button type="button" variant="outline" size="icon-sm" onClick={() => copyFrom(day.key)} aria-label={`Copiar horários de ${day.label}`}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#15151b]">
        <header className="border-b border-slate-100 px-4 py-4 dark:border-white/8 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Preferências de agendamento</h2>
          <p className="mt-1 text-[10px] leading-4 text-slate-400">Esses valores serão usados para calcular horários livres nos agendamentos.</p>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5 sm:p-5">
          <Field label="Fuso horário">
            <Select value={draft.timezone} onValueChange={(timezone) => setDraft((current) => normalizeAvailability({ ...current, timezone }))}>
              <SelectTrigger className="h-9 w-full rounded-md text-xs shadow-none"><Clock3 className="size-3.5 text-slate-400" /><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONE_OPTIONS.map((timezone) => <SelectItem key={timezone.value} value={timezone.value}>{timezone.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Duração padrão">
            <Select value={String(draft.defaultDurationMinutes)} onValueChange={(value) => setDraft((current) => normalizeAvailability({ ...current, defaultDurationMinutes: Number(value) }))}>
              <SelectTrigger className="h-9 w-full rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{DURATION_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>{value} min</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Intervalo">
            <Select value={String(draft.bufferMinutes)} onValueChange={(value) => setDraft((current) => normalizeAvailability({ ...current, bufferMinutes: Number(value) }))}>
              <SelectTrigger className="h-9 w-full rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{BUFFER_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>{value} min</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Antecedência">
            <Select value={String(draft.minNoticeMinutes)} onValueChange={(value) => setDraft((current) => normalizeAvailability({ ...current, minNoticeMinutes: Number(value) }))}>
              <SelectTrigger className="h-9 w-full rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{MIN_NOTICE_OPTIONS.map((item) => <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Agenda futura">
            <Select value={String(draft.maxFutureDays)} onValueChange={(value) => setDraft((current) => normalizeAvailability({ ...current, maxFutureDays: Number(value) }))}>
              <SelectTrigger className="h-9 w-full rounded-md text-xs shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{MAX_FUTURE_OPTIONS.map((item) => <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      {(!validation.valid || dirty || saved) && (
        <div className={cn("flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-[10px] leading-4 sm:flex-row sm:items-center sm:justify-between", validation.valid ? "border-blue-100 bg-blue-50 text-blue-700" : "border-amber-100 bg-amber-50 text-amber-800")}>
          <div className="min-w-0">
            {!validation.valid ? validation.errors.slice(0, 3).map((error) => <p key={error}>{error}</p>) : dirty ? <p>Você tem alterações não salvas.</p> : saved ? <p>Disponibilidade salva com sucesso.</p> : null}
          </div>
          <Button type="submit" size="sm" disabled={saving || !validation.valid || !dirty} className="h-8 shrink-0 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none">
            <Save className="size-3.5" /> {saving ? "Salvando..." : "Salvar disponibilidade"}
          </Button>
        </div>
      )}

      {!dirty && !saved && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !validation.valid} className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none">
            <Save className="size-3.5" /> {saving ? "Salvando..." : "Salvar disponibilidade"}
          </Button>
        </div>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Label className="block">
      <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.04em] text-slate-500 dark:text-slate-300">{label}</span>
      {children}
    </Label>
  );
}
