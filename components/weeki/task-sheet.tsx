"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  Check,
  ChevronDown,
  CirclePlus,
  FileText,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Client, RecurrenceType, Task, TaskDraft, TaskPriority, TaskStatus } from "@/features/tasks/types";
import { PRIORITY_LABELS, RECURRENCE_LABELS, STATUS_LABELS } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const weekDays = [
  { value: 1, short: "S", label: "Segunda" },
  { value: 2, short: "T", label: "Terça" },
  { value: 3, short: "Q", label: "Quarta" },
  { value: 4, short: "Q", label: "Quinta" },
  { value: 5, short: "S", label: "Sexta" },
  { value: 6, short: "S", label: "Sábado" },
  { value: 0, short: "D", label: "Domingo" },
];

const estimateOptions = [
  { value: null, label: "Sem estimativa" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 240, label: "4h" },
];

const emptyDraft = (scheduledDate: string | null, scheduledTime = ""): TaskDraft => ({
  title: "",
  description: "",
  clientId: null,
  status: "not_started",
  priority: "medium",
  scheduledDate,
  scheduledTime,
  dueDate: "",
  dueTime: "",
  estimateMinutes: null,
  tags: [],
  checklist: [],
  attachments: [],
  notes: "",
  recurrence: { type: "none", days: [] },
  archivedAt: null,
});

const taskToDraft = (task: Task): TaskDraft => ({
  title: task.title,
  description: task.description,
  clientId: task.clientId,
  status: task.status,
  priority: task.priority,
  scheduledDate: task.scheduledDate,
  scheduledTime: task.scheduledTime,
  dueDate: task.dueDate,
  dueTime: task.dueTime,
  estimateMinutes: task.estimateMinutes,
  tags: [...task.tags],
  checklist: task.checklist.map((item) => ({ ...item })),
  attachments: task.attachments.map((item) => ({ ...item })),
  notes: task.notes,
  recurrence: { ...task.recurrence, days: [...task.recurrence.days] },
  archivedAt: task.archivedAt,
});

function FieldLabel({ children, optional = false }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
      {children}
      {optional && <span className="text-xs font-normal text-slate-400">Opcional</span>}
    </Label>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>}
    </div>
  );
}

export function TaskSheet({
  open,
  onOpenChange,
  task,
  initialDate,
  initialTime = "",
  clients,
  onSave,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  initialDate: string | null;
  initialTime?: string;
  clients: Client[];
  onSave: (draft: TaskDraft, taskId?: string, options?: { silent?: boolean }) => void;
  onArchive: (taskId: string) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft(initialDate, initialTime));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customEstimateOpen, setCustomEstimateOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [autoSaveState, setAutoSaveState] = useState<"saving" | "saved" | null>(null);
  const lastSavedRef = useRef("");
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd");

  useEffect(() => {
    if (!open) return;
    const nextDraft = task ? taskToDraft(task) : emptyDraft(initialDate, initialTime);
    setDraft(nextDraft);
    lastSavedRef.current = JSON.stringify(nextDraft);
    setAdvancedOpen(false);
    setShowDatePicker(Boolean(nextDraft.scheduledDate && nextDraft.scheduledDate !== todayKey && nextDraft.scheduledDate !== tomorrowKey));
    setCustomEstimateOpen(Boolean(nextDraft.estimateMinutes && !estimateOptions.some((option) => option.value === nextDraft.estimateMinutes)));
    setTagInput("");
    setChecklistInput("");
    setAutoSaveState(task ? "saved" : null);
  }, [open, task?.id, initialDate, initialTime, todayKey, tomorrowKey]);

  useEffect(() => {
    if (!open || !task || !draft.title.trim()) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) return;
    setAutoSaveState("saving");
    const timer = window.setTimeout(() => {
      onSave({ ...draft, title: draft.title.trim() }, task.id, { silent: true });
      lastSavedRef.current = serialized;
      setAutoSaveState("saved");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, open, task?.id, onSave]);

  const checklistProgress = useMemo(() => {
    if (!draft.checklist.length) return 0;
    return Math.round((draft.checklist.filter((item) => item.completed).length / draft.checklist.length) * 100);
  }, [draft.checklist]);

  const addTag = () => {
    const tags = tagInput.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!tags.length) return;
    setDraft((current) => ({ ...current, tags: Array.from(new Set([...current.tags, ...tags])).slice(0, 8) }));
    setTagInput("");
  };

  const addChecklistItem = () => {
    const label = checklistInput.trim();
    if (!label) return;
    setDraft((current) => ({
      ...current,
      checklist: [...current.checklist, { id: makeId(), label, completed: false }],
    }));
    setChecklistInput("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      toast.error("Dê um título para a demanda.");
      return;
    }
    onSave({ ...draft, title: draft.title.trim() }, task?.id);
    onOpenChange(false);
  };

  const renderEstimate = () => (
    <div>
      <FieldLabel optional>Tempo estimado</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {estimateOptions.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => { setDraft((current) => ({ ...current, estimateMinutes: option.value })); setCustomEstimateOpen(false); }}
            className={cn(
              "focus-ring rounded-lg border bg-white px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:border-[#a895f2] hover:text-[#6548df]",
              draft.estimateMinutes === option.value && !customEstimateOpen && "border-[#8068e8] bg-[#f4f1ff] text-[#6548df]",
            )}
          >
            {option.label}
          </button>
        ))}
        <button type="button" onClick={() => setCustomEstimateOpen(true)} className={cn("focus-ring rounded-lg border bg-white px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:border-[#a895f2] hover:text-[#6548df]", customEstimateOpen && "border-[#8068e8] bg-[#f4f1ff] text-[#6548df]")}>Personalizado</button>
      </div>
      {customEstimateOpen && (
        <div className="mt-2 flex items-center gap-2">
          <Input type="number" min={15} step={15} value={draft.estimateMinutes ?? ""} onChange={(event) => setDraft((current) => ({ ...current, estimateMinutes: event.target.value ? Number(event.target.value) : null }))} className="max-w-32 bg-white" aria-label="Tempo personalizado em minutos" />
          <span className="text-xs text-slate-400">minutos</span>
        </div>
      )}
    </div>
  );

  const renderTags = () => (
    <div>
      <FieldLabel optional>Tags</FieldLabel>
      <Input
        value={tagInput}
        onChange={(event) => setTagInput(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }}
        placeholder="+ Adicionar tag e pressionar Enter"
        className="bg-white"
      />
      {draft.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {draft.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-[#eeeaff] px-2 py-1 text-xs font-medium text-[#6246d8]">
              {tag}
              <button type="button" onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))} aria-label={`Remover tag ${tag}`}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden border-l border-slate-200 bg-[#fbfbfd] p-0 sm:max-w-[600px]" showCloseButton={false}>
        <form onSubmit={submit} className="flex h-full min-h-0 flex-1 flex-col">
          <SheetHeader className="shrink-0 border-b bg-white px-5 py-4 pr-16 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#6f52ec]">
                {task ? <FileText className="size-[18px]" /> : <CirclePlus className="size-[18px]" />}
              </div>
              <div>
                <SheetTitle className="text-base">{task ? "Gerenciar demanda" : "Nova demanda"}</SheetTitle>
                <SheetDescription className="mt-1 text-xs">
                  {task ? "Edite os detalhes. As alterações são salvas automaticamente." : "Crie agora e organize os detalhes quando precisar."}
                </SheetDescription>
              </div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="absolute right-5 top-5 grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </SheetHeader>

          {!task ? (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-5">
                <div>
                  <FieldLabel>O que precisa ser feito?</FieldLabel>
                  <Input autoFocus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Digite o título da demanda..." className="h-11 bg-white text-base" />
                </div>

                <div>
                  <FieldLabel optional>Cliente</FieldLabel>
                  <Select value={draft.clientId ?? "__none"} onValueChange={(value) => setDraft((current) => ({ ...current, clientId: value === "__none" ? null : value }))}>
                    <SelectTrigger className="h-11 w-full bg-white"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem cliente</SelectItem>
                      {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <FieldLabel optional>Quando?</FieldLabel>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => { setDraft((current) => ({ ...current, scheduledDate: todayKey })); setShowDatePicker(false); }} className={cn("focus-ring rounded-xl border bg-white px-2 py-2.5 text-sm font-medium text-slate-500 transition", draft.scheduledDate === todayKey && !showDatePicker && "border-[#8068e8] bg-[#f4f1ff] text-[#6548df]")}>Hoje</button>
                    <button type="button" onClick={() => { setDraft((current) => ({ ...current, scheduledDate: tomorrowKey })); setShowDatePicker(false); }} className={cn("focus-ring rounded-xl border bg-white px-2 py-2.5 text-sm font-medium text-slate-500 transition", draft.scheduledDate === tomorrowKey && !showDatePicker && "border-[#8068e8] bg-[#f4f1ff] text-[#6548df]")}>Amanhã</button>
                    <button type="button" onClick={() => setShowDatePicker(true)} className={cn("focus-ring rounded-xl border bg-white px-2 py-2.5 text-sm font-medium text-slate-500 transition", showDatePicker && "border-[#8068e8] bg-[#f4f1ff] text-[#6548df]")}>Escolher data</button>
                  </div>
                  {showDatePicker && <Input type="date" value={draft.scheduledDate ?? ""} onChange={(event) => setDraft((current) => ({ ...current, scheduledDate: event.target.value || null }))} className="mt-2 bg-white" />}
                </div>

                <div>
                  <FieldLabel optional>Horário</FieldLabel>
                  <Input type="time" value={draft.scheduledTime} onChange={(event) => setDraft((current) => ({ ...current, scheduledTime: event.target.value }))} className="bg-white" />
                </div>

                <button type="button" onClick={() => setAdvancedOpen((current) => !current)} className="focus-ring flex w-full items-center justify-between rounded-xl border border-dashed bg-white px-3 py-3 text-sm font-semibold text-[#674bdd] transition hover:border-[#a895f2] hover:bg-[#faf9ff]">
                  <span>{advancedOpen ? "Ocultar opções" : "+ Mais opções"}</span>
                  <ChevronDown className={cn("size-4 transition", advancedOpen && "rotate-180")} />
                </button>

                {advancedOpen && (
                  <div className="space-y-6 border-t pt-5">
                    <div>
                      <FieldLabel optional>Descrição</FieldLabel>
                      <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Contexto, orientações ou resultado esperado..." className="min-h-24 resize-y bg-white" />
                    </div>
                    <div>
                      <FieldLabel>Prioridade</FieldLabel>
                      <Select value={draft.priority} onValueChange={(value) => setDraft((current) => ({ ...current, priority: value as TaskPriority }))}>
                        <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {renderEstimate()}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><FieldLabel optional>Prazo</FieldLabel><Input type="date" value={draft.dueDate} min={draft.scheduledDate ?? undefined} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} className="bg-white" /></div>
                      <div><FieldLabel optional>Horário limite</FieldLabel><Input type="time" value={draft.dueTime} onChange={(event) => setDraft((current) => ({ ...current, dueTime: event.target.value }))} className="bg-white" /></div>
                    </div>
                    <div>
                      <FieldLabel optional>Repetição</FieldLabel>
                      <Select value={draft.recurrence.type} onValueChange={(value) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, type: value as RecurrenceType } }))}>
                        <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(RECURRENCE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                      {draft.recurrence.type === "custom" && <div className="mt-3 flex flex-wrap gap-2">{weekDays.map((day) => { const active = draft.recurrence.days.includes(day.value); return <button key={day.label} type="button" title={day.label} onClick={() => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, days: active ? current.recurrence.days.filter((value) => value !== day.value) : [...current.recurrence.days, day.value] } }))} className={cn("grid size-9 place-items-center rounded-lg border text-xs font-semibold transition", active ? "border-[#7657ff] bg-[#7657ff] text-white" : "bg-white text-slate-500 hover:border-[#9b88ef]")}>{day.short}</button>; })}</div>}
                    </div>
                    {renderTags()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b bg-white px-5 pt-4 sm:px-6">
                <Input autoFocus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Título da demanda" className="h-auto rounded-none border-0 px-0 pb-4 text-xl font-semibold tracking-[-0.02em] shadow-none focus-visible:ring-0" />
              </div>

              <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0 overflow-hidden">
                <div className="shrink-0 border-b bg-white px-4 sm:px-6">
                  <TabsList variant="line" className="grid h-12 w-full grid-cols-4 gap-0 overflow-visible p-0">
                    <TabsTrigger value="details" className="h-12 rounded-none px-1 text-xs after:bottom-0 after:bg-[#7657ff]">Detalhes</TabsTrigger>
                    <TabsTrigger value="checklist" className="h-12 rounded-none px-1 text-xs after:bottom-0 after:bg-[#7657ff]">Checklist</TabsTrigger>
                    <TabsTrigger value="files" className="h-12 rounded-none px-1 text-xs after:bottom-0 after:bg-[#7657ff]">Anexos</TabsTrigger>
                    <TabsTrigger value="activity" className="h-12 rounded-none px-1 text-xs after:bottom-0 after:bg-[#7657ff]">Atividade</TabsTrigger>
                  </TabsList>
                </div>

                <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
                  <TabsContent value="details" className="m-0 space-y-7 p-5 sm:p-6">
                    <section>
                      <SectionTitle title="Organização" />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <FieldLabel optional>Cliente</FieldLabel>
                          <Select value={draft.clientId ?? "__none"} onValueChange={(value) => setDraft((current) => ({ ...current, clientId: value === "__none" ? null : value }))}>
                            <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="__none">Sem cliente</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <FieldLabel>Status</FieldLabel>
                          <Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as TaskStatus }))}>
                            <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <FieldLabel>Prioridade</FieldLabel>
                          <Select value={draft.priority} onValueChange={(value) => setDraft((current) => ({ ...current, priority: value as TaskPriority }))}>
                            <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    <section>
                      <SectionTitle title="Descrição" description="Contexto, orientações ou resultado esperado." />
                      <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Adicione os detalhes da demanda..." className="min-h-28 resize-y bg-white" />
                    </section>

                    <section>
                      <SectionTitle title="Agendamento" description="Quando pretende fazer?" />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><FieldLabel optional>Data</FieldLabel><Input type="date" value={draft.scheduledDate ?? ""} onChange={(event) => setDraft((current) => ({ ...current, scheduledDate: event.target.value || null }))} className="bg-white" /></div>
                        <div><FieldLabel optional>Horário</FieldLabel><Input type="time" value={draft.scheduledTime} onChange={(event) => setDraft((current) => ({ ...current, scheduledTime: event.target.value }))} className="bg-white" /></div>
                      </div>
                    </section>

                    <section>
                      <SectionTitle title="Prazo" description="Até quando precisa estar pronto?" />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><FieldLabel optional>Data</FieldLabel><Input type="date" value={draft.dueDate} min={draft.scheduledDate ?? undefined} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} className="bg-white" /></div>
                        <div><FieldLabel optional>Horário limite</FieldLabel><Input type="time" value={draft.dueTime} onChange={(event) => setDraft((current) => ({ ...current, dueTime: event.target.value }))} className="bg-white" /></div>
                      </div>
                    </section>

                    <section>{renderEstimate()}</section>

                    <section>
                      <SectionTitle title="Repetição" />
                      <Select value={draft.recurrence.type} onValueChange={(value) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, type: value as RecurrenceType } }))}>
                        <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(RECURRENCE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                      {draft.recurrence.type === "custom" && <div className="mt-3 flex flex-wrap gap-2">{weekDays.map((day) => { const active = draft.recurrence.days.includes(day.value); return <button key={day.label} type="button" title={day.label} onClick={() => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, days: active ? current.recurrence.days.filter((value) => value !== day.value) : [...current.recurrence.days, day.value] } }))} className={cn("grid size-9 place-items-center rounded-lg border text-xs font-semibold transition", active ? "border-[#7657ff] bg-[#7657ff] text-white" : "bg-white text-slate-500 hover:border-[#9b88ef]")}>{day.short}</button>; })}</div>}
                    </section>

                    <section>{renderTags()}</section>
                  </TabsContent>

                  <TabsContent value="checklist" className="m-0 p-5 sm:p-6">
                    <div className="mb-5">
                      <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-800">Progresso</span><span className="font-semibold text-[#6246d8]">{checklistProgress}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#7657ff] to-[#2f80ed] transition-all" style={{ width: `${checklistProgress}%` }} /></div>
                    </div>
                    <div className="space-y-2">
                      {draft.checklist.map((item) => <div key={item.id} className="group flex items-center gap-3 rounded-xl border bg-white px-3 py-3"><Checkbox checked={item.completed} onCheckedChange={(checked) => setDraft((current) => ({ ...current, checklist: current.checklist.map((currentItem) => currentItem.id === item.id ? { ...currentItem, completed: checked === true } : currentItem) }))} /><span className={cn("flex-1 text-sm", item.completed && "text-slate-400 line-through")}>{item.label}</span><button type="button" onClick={() => setDraft((current) => ({ ...current, checklist: current.checklist.filter((currentItem) => currentItem.id !== item.id) }))} className="text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100" aria-label={`Excluir ${item.label}`}><Trash2 className="size-4" /></button></div>)}
                    </div>
                    <div className="mt-3 flex gap-2"><Input value={checklistInput} onChange={(event) => setChecklistInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChecklistItem(); } }} placeholder="Adicionar item ao checklist" className="bg-white" /><Button type="button" variant="outline" onClick={addChecklistItem}><Plus className="size-4" /><span className="sr-only sm:not-sr-only">Adicionar</span></Button></div>
                  </TabsContent>

                  <TabsContent value="files" className="m-0 p-5 sm:p-6">
                    <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center transition hover:border-[#8b73ef] hover:bg-[#faf9ff]">
                      <span className="mb-3 grid size-11 place-items-center rounded-xl bg-[#eeeaff] text-[#6b50df]"><Paperclip className="size-5" /></span>
                      <span className="text-sm font-semibold text-slate-800">Adicionar arquivos</span>
                      <span className="mt-1 text-xs leading-5 text-slate-500">Selecione documentos, imagens ou links de referência.</span>
                      <input type="file" multiple className="sr-only" onChange={(event) => { const files = Array.from(event.target.files ?? []); setDraft((current) => ({ ...current, attachments: [...current.attachments, ...files.map((file) => ({ id: makeId(), name: file.name, size: file.size, type: file.type }))] })); event.target.value = ""; }} />
                    </label>
                    <div className="mt-4 space-y-2">{draft.attachments.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileText className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{file.name}</p><p className="text-xs text-slate-400">{file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "Arquivo"}</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== file.id) }))} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remover ${file.name}`}><Trash2 className="size-4" /></button></div>)}</div>
                    <Button type="button" variant="ghost" className="mt-3 text-[#6b50df]" onClick={() => { const url = window.prompt("Cole o link de referência:"); if (!url?.trim()) return; setDraft((current) => ({ ...current, attachments: [...current.attachments, { id: makeId(), name: url.trim(), size: 0, type: "link" }] })); }}><Link2 /> Adicionar link</Button>
                  </TabsContent>

                  <TabsContent value="activity" className="m-0 p-5 sm:p-6">
                    <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200">{task.activity.map((item) => <div key={item.id} className="relative flex gap-4"><span className="relative z-10 mt-1.5 size-[15px] shrink-0 rounded-full border-[4px] border-[#fbfbfd] bg-[#7a60eb]" /><div><p className="text-sm font-medium text-slate-700">{item.text}</p><p className="mt-1 text-xs text-slate-400">{format(parseISO(item.createdAt), "dd MMM, HH:mm", { locale: ptBR })}</p></div></div>)}</div>
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}

          <SheetFooter className="shrink-0 flex-row items-center border-t bg-white px-5 py-4 sm:px-6">
            {task ? (
              <>
                <Button type="button" variant="ghost" className="mr-auto px-2 text-slate-500 hover:text-rose-600" onClick={() => { onArchive(task.id); onOpenChange(false); }}><Archive /> <span className="hidden sm:inline">Arquivar</span></Button>
                <span className="hidden text-xs text-slate-400 sm:inline">{autoSaveState === "saving" ? "Salvando..." : "Alterações salvas"}</span>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button type="submit" className="bg-gradient-to-r from-[#7657ff] to-[#356fd7] px-4 shadow-[0_6px_18px_rgba(105,78,226,0.2)] hover:opacity-90">Salvar</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" className="mr-auto" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" className="bg-gradient-to-r from-[#7657ff] to-[#356fd7] px-5 shadow-[0_6px_18px_rgba(105,78,226,0.22)] hover:opacity-90">Criar demanda</Button>
              </>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
