export type WeekdayKey = "0" | "1" | "2" | "3" | "4" | "5" | "6";

export interface AvailabilityPeriod {
  id: string;
  start: string;
  end: string;
}

export interface DayAvailability {
  enabled: boolean;
  periods: AvailabilityPeriod[];
}

export interface AvailabilityException {
  id: string;
  date: string;
  kind: "available" | "blocked" | "holiday" | "vacation";
  start?: string;
  end?: string;
  note?: string;
}

export interface WeekiAvailability {
  timezone: string;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxFutureDays: number;
  weekly: Record<WeekdayKey, DayAvailability>;
  exceptions: AvailabilityException[];
  configuredAt: string | null;
  updatedAt: string | null;
}

export interface SlotBlock {
  date: string;
  start: string;
  durationMinutes: number;
  bufferMinutes?: number;
  status?: string;
}

export interface AvailabilityValidationResult {
  valid: boolean;
  errors: string[];
}

export const WEEKDAYS: Array<{ key: WeekdayKey; short: string; label: string }> = [
  { key: "0", short: "Dom", label: "Domingo" },
  { key: "1", short: "Seg", label: "Segunda-feira" },
  { key: "2", short: "Ter", label: "Terca-feira" },
  { key: "3", short: "Qua", label: "Quarta-feira" },
  { key: "4", short: "Qui", label: "Quinta-feira" },
  { key: "5", short: "Sex", label: "Sexta-feira" },
  { key: "6", short: "Sab", label: "Sabado" },
];

export const TIMEZONE_OPTIONS = [
  { value: "America/Fortaleza", label: "Fortaleza - UTC-03:00" },
  { value: "America/Sao_Paulo", label: "Brasilia / Sao Paulo - UTC-03:00" },
  { value: "America/Manaus", label: "Manaus - UTC-04:00" },
  { value: "America/Rio_Branco", label: "Rio Branco - UTC-05:00" },
  { value: "America/Noronha", label: "Fernando de Noronha - UTC-02:00" },
  { value: "UTC", label: "UTC - Tempo Universal" },
];

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
export const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60];
export const MIN_NOTICE_OPTIONS = [
  { value: 0, label: "Sem antecedencia minima" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 240, label: "4 horas" },
  { value: 1440, label: "1 dia" },
  { value: 2880, label: "2 dias" },
];
export const MAX_FUTURE_OPTIONS = [
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "180 dias" },
];

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function createDefaultAvailability(timezone = "America/Fortaleza"): WeekiAvailability {
  return {
    timezone,
    defaultDurationMinutes: 60,
    bufferMinutes: 15,
    minNoticeMinutes: 120,
    maxFutureDays: 90,
    weekly: {
      "0": { enabled: false, periods: [] },
      "1": { enabled: false, periods: [{ id: "mon-1", start: "08:00", end: "12:00" }, { id: "mon-2", start: "14:00", end: "18:00" }] },
      "2": { enabled: false, periods: [{ id: "tue-1", start: "08:00", end: "12:00" }, { id: "tue-2", start: "14:00", end: "18:00" }] },
      "3": { enabled: false, periods: [{ id: "wed-1", start: "08:00", end: "12:00" }, { id: "wed-2", start: "14:00", end: "18:00" }] },
      "4": { enabled: false, periods: [{ id: "thu-1", start: "08:00", end: "12:00" }, { id: "thu-2", start: "14:00", end: "18:00" }] },
      "5": { enabled: false, periods: [{ id: "fri-1", start: "08:00", end: "12:00" }, { id: "fri-2", start: "14:00", end: "18:00" }] },
      "6": { enabled: false, periods: [] },
    },
    exceptions: [],
    configuredAt: null,
    updatedAt: null,
  };
}

export function timeToMinutes(time: string) {
  if (!timePattern.test(time)) return Number.NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function normalizeAvailability(input?: Partial<WeekiAvailability> | null): WeekiAvailability {
  const defaults = createDefaultAvailability(input?.timezone || "America/Fortaleza");
  const weekly = WEEKDAYS.reduce<Record<WeekdayKey, DayAvailability>>((result, day) => {
    const current = input?.weekly?.[day.key] ?? defaults.weekly[day.key];
    const periods = [...(current.periods || [])]
      .map((period, index) => ({
        id: period.id || `${day.key}-${index + 1}`,
        start: period.start || "",
        end: period.end || "",
      }))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    result[day.key] = { enabled: Boolean(current.enabled), periods };
    return result;
  }, {} as Record<WeekdayKey, DayAvailability>);

  return {
    ...defaults,
    ...input,
    timezone: input?.timezone || defaults.timezone,
    defaultDurationMinutes: Number(input?.defaultDurationMinutes || defaults.defaultDurationMinutes),
    bufferMinutes: Number(input?.bufferMinutes ?? defaults.bufferMinutes),
    minNoticeMinutes: Number(input?.minNoticeMinutes ?? defaults.minNoticeMinutes),
    maxFutureDays: Number(input?.maxFutureDays || defaults.maxFutureDays),
    weekly,
    exceptions: input?.exceptions || [],
    configuredAt: input?.configuredAt ?? null,
    updatedAt: input?.updatedAt ?? null,
  };
}

export function validateAvailability(input: WeekiAvailability): AvailabilityValidationResult {
  const availability = normalizeAvailability(input);
  const errors: string[] = [];
  if (!availability.timezone.trim()) errors.push("Informe o fuso horario.");
  if (availability.defaultDurationMinutes < 5 || availability.defaultDurationMinutes > 480) errors.push("A duracao padrao precisa ficar entre 5 e 480 minutos.");
  if (availability.bufferMinutes < 0 || availability.bufferMinutes > 240) errors.push("O intervalo entre agendamentos precisa ficar entre 0 e 240 minutos.");
  if (availability.minNoticeMinutes < 0) errors.push("A antecedencia minima nao pode ser negativa.");
  if (availability.maxFutureDays < 1 || availability.maxFutureDays > 730) errors.push("O periodo futuro precisa ficar entre 1 e 730 dias.");

  let activePeriods = 0;
  for (const day of WEEKDAYS) {
    const config = availability.weekly[day.key];
    if (!config.enabled) continue;
    if (!config.periods.length) errors.push(`${day.label}: adicione pelo menos um periodo ou desative o dia.`);
    const seen = new Set<string>();
    const ordered = [...config.periods].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    ordered.forEach((period, index) => {
      const start = timeToMinutes(period.start);
      const end = timeToMinutes(period.end);
      if (!timePattern.test(period.start) || !timePattern.test(period.end)) {
        errors.push(`${day.label}: use horarios validos no formato HH:mm.`);
        return;
      }
      if (end <= start) errors.push(`${day.label}: o horario final precisa ser maior que o inicial.`);
      const key = `${period.start}-${period.end}`;
      if (seen.has(key)) errors.push(`${day.label}: remova intervalos duplicados.`);
      seen.add(key);
      const previous = ordered[index - 1];
      if (previous && timeToMinutes(previous.end) > start) errors.push(`${day.label}: os periodos nao podem se sobrepor.`);
      activePeriods += 1;
    });
  }

  if (activePeriods === 0) errors.push("Configure pelo menos um periodo de atendimento.");
  return { valid: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export function isAvailabilityConfigured(input?: WeekiAvailability | null) {
  if (!input) return false;
  const normalized = normalizeAvailability(input);
  return validateAvailability(normalized).valid;
}

export function totalWeeklyAvailableMinutes(input: WeekiAvailability) {
  const availability = normalizeAvailability(input);
  return WEEKDAYS.reduce((total, day) => {
    const config = availability.weekly[day.key];
    if (!config.enabled) return total;
    return total + config.periods.reduce((sum, period) => sum + Math.max(0, timeToMinutes(period.end) - timeToMinutes(period.start)), 0);
  }, 0);
}

export function listAvailableSlots(input: WeekiAvailability, date: string, blocks: SlotBlock[] = [], now = new Date()) {
  const availability = normalizeAvailability(input);
  if (!isAvailabilityConfigured(availability) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return [];
  const dayKey = String(target.getDay()) as WeekdayKey;
  const day = availability.weekly[dayKey];
  if (!day.enabled) return [];

  const minDateTime = new Date(now.getTime() + availability.minNoticeMinutes * 60000);
  const maxDate = new Date(now);
  maxDate.setHours(23, 59, 59, 999);
  maxDate.setDate(maxDate.getDate() + availability.maxFutureDays);
  if (target > maxDate) return [];

  const duration = availability.defaultDurationMinutes;
  const slotStep = 15;
  const activeBlocks = blocks.filter((block) => block.date === date && block.status !== "cancelled");
  const slots: string[] = [];

  for (const period of day.periods) {
    const start = timeToMinutes(period.start);
    const end = timeToMinutes(period.end);
    for (let cursor = start; cursor + duration <= end; cursor += slotStep) {
      const slot = minutesToTime(cursor);
      if (new Date(`${date}T${slot}:00`) < minDateTime) continue;
      const slotEnd = cursor + duration + availability.bufferMinutes;
      const conflicts = activeBlocks.some((block) => {
        const blockStart = timeToMinutes(block.start);
        const blockEnd = blockStart + block.durationMinutes + (block.bufferMinutes ?? availability.bufferMinutes);
        return cursor < blockEnd && blockStart < slotEnd;
      });
      if (!conflicts) slots.push(slot);
    }
  }

  return slots;
}
