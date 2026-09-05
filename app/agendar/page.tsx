"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Check, Clock3, MapPin, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppointmentMode, EventType } from "@/features/appointments/types";
import { APPOINTMENT_MODE_LABELS } from "@/features/appointments/types";
import { useWeekiAppointments } from "@/features/appointments/use-weeki-appointments";
import { cn } from "@/lib/utils";

const subscribeToHydration = () => () => undefined;
const times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
const formatDuration = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;

function ModeIcon({ mode }: { mode: AppointmentMode }) {
  if (mode === "in_person") return <MapPin className="size-3" />;
  if (mode === "phone") return <Phone className="size-3" />;
  return <Video className="size-3" />;
}

export default function PublicBookingPage() {
  const { appointments, eventTypes, autoApproval, addAppointment } = useWeekiAppointments();
  const [selectedTypeId, setSelectedTypeId] = useState(() => {
    if (typeof window === "undefined") return "";
    const slug = new URLSearchParams(window.location.search).get("tipo");
    return eventTypes.find((type) => type.slug === slug)?.id ?? "";
  });
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const publicTypes = eventTypes.filter((type) => type.active && !type.clientOnly);
  const selectedType = publicTypes.find((type) => type.id === selectedTypeId);
  const unavailableTimes = useMemo(() => {
    const requestedDuration = eventTypes.find((type) => type.id === selectedTypeId)?.durationMinutes ?? 30;
    return new Set(times.filter((slot) => {
      const requestedStart = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3));
      return appointments.some((item) => {
        if (item.date !== date || item.status === "cancelled") return false;
        const existingStart = Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3));
        const existingDuration = eventTypes.find((type) => type.id === item.typeId)?.durationMinutes ?? 30;
        return requestedStart < existingStart + existingDuration && existingStart < requestedStart + requestedDuration;
      });
    }));
  }, [appointments, date, eventTypes, selectedTypeId]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedType || !date || !time || !name.trim() || !email.trim()) return;
    addAppointment({
      title: selectedType.name,
      typeId: selectedType.id,
      clientId: null,
      guestName: name.trim(),
      guestEmail: email.trim(),
      guestPhone: phone.trim(),
      date,
      time,
      status: autoApproval ? "confirmed" : "pending",
      mode: selectedType.mode,
      location: "",
      meetingUrl: "",
      notes: notes.trim(),
      source: "Página pública",
    });
    setSuccess(true);
  };

  if (!mounted) return <div className="min-h-screen bg-[#f7f8fc]" />;

  if (success) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f8fc] px-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="size-6" /></span><h1 className="mt-5 text-xl font-bold tracking-[-0.03em] text-slate-900">Solicitação enviada</h1><p className="mt-2 text-sm leading-6 text-slate-500">{autoApproval ? "Seu horário foi confirmado e já está reservado." : "Você receberá a confirmação assim que o horário for aprovado."}</p><div className="mt-5 rounded-lg bg-slate-50 p-4 text-left text-xs text-slate-600"><p className="font-semibold text-slate-800">{selectedType?.name}</p><p className="mt-1">{date.split("-").reverse().join("/")} às {time}</p></div><Button type="button" variant="outline" onClick={() => { setSuccess(false); setSelectedTypeId(""); setTime(""); }} className="mt-5 h-9 rounded-md shadow-none">Fazer outro agendamento</Button></section></main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[25px] font-semibold tracking-[-0.055em] text-[#17171c]">weeki</span><span className="size-2 rounded-full bg-gradient-to-br from-[#8d6cff] to-[#2f80ed]" /></div><Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="size-3.5" />Voltar</Link></header>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#654ce4]">Agendamento online</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-900">Escolha seu atendimento</h1><p className="mt-1 text-sm text-slate-500">Selecione um formato, data e horário disponíveis.</p></div>
            <section className="mt-7"><StepTitle number="1" title="Tipo de atendimento" /><div className="mt-3 grid gap-2 sm:grid-cols-2">{publicTypes.map((type) => <EventOption key={type.id} eventType={type} selected={selectedTypeId === type.id} onSelect={() => { setSelectedTypeId(type.id); setTime(""); }} />)}</div>{!publicTypes.length && <p className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Nenhum atendimento disponível no momento.</p>}</section>
            <section className="mt-7"><StepTitle number="2" title="Data e horário" /><div className="mt-3 max-w-[240px]"><Label className="mb-1.5 block text-[10px] font-semibold uppercase text-slate-500">Data</Label><Input type="date" min={format(new Date(), "yyyy-MM-dd")} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} className="h-9 rounded-md text-xs shadow-none" /></div><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{times.map((slot) => <button key={slot} type="button" disabled={!selectedType || unavailableTimes.has(slot)} onClick={() => setTime(slot)} className={cn("h-9 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-600 transition hover:border-[#9584e8] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300", time === slot && "border-[#654ce4] bg-[#f2efff] text-[#5941d6]")}>{slot}</button>)}</div></section>
            <section className="mt-7"><StepTitle number="3" title="Seus dados" /><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Nome"><Input required value={name} onChange={(event) => setName(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="E-mail"><Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><Field label="Telefone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} className="h-9 rounded-md text-xs shadow-none" /></Field><div className="sm:col-span-2"><Field label="Observações"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="resize-none rounded-md text-xs shadow-none" /></Field></div></div></section>
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><Button type="submit" disabled={!selectedType || !date || !time || !name.trim() || !email.trim()} className="h-9 rounded-md bg-[#5140df] px-4 text-xs shadow-none hover:bg-[#4432cf]"><CalendarDays className="size-3.5" />Solicitar agendamento</Button></div>
          </form>
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-8"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">Resumo</p>{selectedType ? <><h2 className="mt-4 text-base font-semibold text-slate-900">{selectedType.name}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{selectedType.description}</p><div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600"><p className="flex items-center gap-2"><Clock3 className="size-3.5 text-slate-400" />{formatDuration(selectedType.durationMinutes)}</p><p className="flex items-center gap-2"><ModeIcon mode={selectedType.mode} />{APPOINTMENT_MODE_LABELS[selectedType.mode]}</p>{date && time && <p className="flex items-center gap-2"><CalendarDays className="size-3.5 text-slate-400" />{date.split("-").reverse().join("/")} às {time}</p>}</div><p className="mt-5 rounded-md bg-[#f3f1ff] px-3 py-2 text-[11px] text-[#5946d4]">{autoApproval ? "Confirmação imediata após o envio." : "O horário será reservado após aprovação."}</p></> : <div className="py-12 text-center"><CalendarDays className="mx-auto size-6 text-slate-300" /><p className="mt-3 text-xs text-slate-400">Selecione um atendimento para ver os detalhes.</p></div>}</aside>
        </div>
      </div>
    </main>
  );
}

function EventOption({ eventType, selected, onSelect }: { eventType: EventType; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={cn("rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#aaa0e8]", selected && "border-[#6a54e8] bg-[#faf9ff] ring-1 ring-[#6a54e8]/10")}><div className="flex items-start justify-between gap-3"><h2 className="text-sm font-semibold text-slate-900">{eventType.name}</h2><span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", selected ? "border-[#654ce4] bg-[#654ce4] text-white" : "border-slate-300")}><Check className="size-2.5" /></span></div><p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">{eventType.description}</p><div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1"><Clock3 className="size-3" />{formatDuration(eventType.durationMinutes)}</span><span className="flex items-center gap-1"><ModeIcon mode={eventType.mode} />{APPOINTMENT_MODE_LABELS[eventType.mode]}</span></div></button>;
}

function StepTitle({ number, title }: { number: string; title: string }) { return <div className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-md bg-[#ede9ff] text-[10px] font-semibold text-[#5c43d8]">{number}</span><h2 className="text-xs font-semibold text-slate-800">{title}</h2></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-1.5 block text-[10px] font-semibold uppercase text-slate-500">{label}</Label>{children}</div>; }
