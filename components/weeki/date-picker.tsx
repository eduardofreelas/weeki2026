"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

const safeParse = (value?: string | null) => {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function DatePicker({
  value,
  onChange,
  min,
  placeholder = "Selecionar data",
  className,
  required = false,
}: {
  value: string | null;
  onChange: (value: string) => void;
  min?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const selectedDate = safeParse(value);
  const minimumDate = safeParse(min);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());

  const calendarDays = useMemo(() => {
    const firstVisibleDay = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, index) => addDays(firstVisibleDay, index));
  }, [visibleMonth]);

  const chooseDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setVisibleMonth(date);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen && selectedDate) setVisibleMonth(selectedDate);
    }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={selectedDate ? `Alterar data ${format(selectedDate, "dd/MM/yyyy")}` : placeholder}
          className={cn(
            "focus-ring flex h-8 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-xs font-medium shadow-none transition hover:border-slate-300",
            selectedDate ? "text-slate-800" : "text-slate-400",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-slate-400" />
          <span className="flex-1">{selectedDate ? format(selectedDate, "dd/MM/yyyy") : placeholder}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[80] w-[284px] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_45px_-12px_rgba(15,23,42,0.22)] outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="pl-1 text-sm font-semibold capitalize tracking-[-0.01em] text-slate-900">
              {format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, -1))} className="focus-ring grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100" aria-label="Mês anterior"><ChevronLeft className="size-4" /></button>
              <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, 1))} className="focus-ring grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100" aria-label="Próximo mês"><ChevronRight className="size-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}>
            {weekDays.map((day, index) => <span key={`${day}-${index}`} className="grid h-7 place-items-center text-[10px] font-semibold text-slate-400">{day}</span>)}
            {calendarDays.map((day) => {
              const disabled = Boolean(minimumDate && isBefore(startOfDay(day), startOfDay(minimumDate)));
              const selected = Boolean(selectedDate && isSameDay(day, selectedDate));
              const today = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => chooseDate(day)}
                  className={cn(
                    "focus-ring grid size-8 place-items-center rounded-md text-xs font-medium tabular-nums text-slate-700 transition hover:bg-[#f1efff] hover:text-[#5b3fd3] disabled:pointer-events-none disabled:opacity-25",
                    !isSameMonth(day, visibleMonth) && "text-slate-300",
                    today && !selected && "bg-slate-100 font-semibold text-slate-900",
                    selected && "bg-[#5b46e8] font-semibold text-white hover:bg-[#4f3bd5] hover:text-white",
                  )}
                  aria-pressed={selected}
                  aria-label={format(day, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
            {!required ? <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="focus-ring h-7 rounded-md px-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">Limpar</button> : <span />}
            <button type="button" onClick={() => chooseDate(new Date())} disabled={Boolean(minimumDate && isBefore(startOfDay(new Date()), startOfDay(minimumDate)))} className="focus-ring h-7 rounded-md px-2 text-xs font-semibold text-[#5b46e8] transition hover:bg-[#f1efff] disabled:pointer-events-none disabled:opacity-30">Hoje</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
