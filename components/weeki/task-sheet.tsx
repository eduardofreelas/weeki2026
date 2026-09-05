"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlignLeft,
  Archive,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CirclePlus,
  Clock3,
  FileText,
  History,
  Link2,
  Paperclip,
  Plus,
  Repeat2,
  Tags,
  Timer,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/weeki/date-picker";
import { RichTextEditor } from "@/components/weeki/rich-text-editor";
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

const emptyDraft = (scheduledDate: string | null, scheduledTime = "", clientId: string | null = null): TaskDraft => ({
  title: "",
  description: "",
  clientId,
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
  recurrence: { type: "none", days: [], endDate: "" },
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
  recurrence: { ...task.recurrence, days: [...task.recurrence.days], endDate: task.recurrence.endDate ?? "" },
  archivedAt: task.archivedAt,
});

function FieldLabel({ children, optional = false }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
      {children}
      {optional && <span className="text-[11px] font-normal text-slate-400">Opcional</span>}
    </Label>
  );
}

function ModalFieldLabel({ children, optional = false }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
      {children}
      {optional && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-400">Opcional</span>}
    </Label>
  );
}

function SectionTitle({ title, description, icon: Icon }: { title: string; description?: string; icon: LucideIcon }) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1.5">
          <Icon className="size-4 text-slate-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h3>
        </div>
        <span className="ml-2 h-px flex-1 bg-slate-200" />
      </div>
      {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
    </div>
  );
}

export function TaskSheet({
  open,
  onOpenChange,
  task,
  initialDate,
  initialTime = "",
  initialClientId = null,
  clients,
  onSave,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  initialDate: string | null;
  initialTime?: string;
  initialClientId?: string | null;
  clients: Client[];
  onSave: (draft: TaskDraft, taskId?: string, options?: { silent?: boolean }) => void;
  onArchive: (taskId: string) => void;
}) {
  const initialDraft = task ? taskToDraft(task) : emptyDraft(initialDate, initialTime, initialClientId);
  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(Boolean(initialDraft.scheduledDate && initialDraft.scheduledDate !== format(new Date(), "yyyy-MM-dd") && initialDraft.scheduledDate !== format(addDays(new Date(), 1), "yyyy-MM-dd")));
  const [customEstimateOpen, setCustomEstimateOpen] = useState(Boolean(initialDraft.estimateMinutes && !estimateOptions.some((option) => option.value === initialDraft.estimateMinutes)));
  const [tagInput, setTagInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [autoSaveState, setAutoSaveState] = useState<"saving" | "saved" | null>(task ? "saved" : null);
  const lastSavedRef = useRef(JSON.stringify(initialDraft));
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const taskId = task?.id;

  useEffect(() => {
    if (!open || !taskId || !draft.title.trim()) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) return;
    setAutoSaveState("saving");
    const timer = window.setTimeout(() => {
      onSave({ ...draft, title: draft.title.trim() }, taskId, { silent: true });
      lastSavedRef.current = serialized;
      setAutoSaveState("saved");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, open, taskId, onSave]);

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

  const addLink = () => {
    const value = linkInput.trim();
    if (!value) return;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
    } catch {
      toast.error("Insira um link válido começando com http:// ou https://.");
      return;
    }
    setDraft((current) => ({
      ...current,
      attachments: [...current.attachments, { id: makeId(), name: value, size: 0, type: "link" }],
    }));
    setLinkInput("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      toast.error("Dê um título para a demanda.");
      return;
    }
    if (draft.recurrence.type === "custom" && !draft.recurrence.endDate) {
      toast.error("Escolha a data final da repetição.");
      return;
    }
    onSave({ ...draft, title: draft.title.trim() }, task?.id);
    onOpenChange(false);
  };

  const renderEstimate = (sectioned = false) => (
    <div>
      {sectioned ? <SectionTitle title="Tempo estimado" description="Quanto tempo essa demanda deve levar?" icon={Timer} /> : <FieldLabel optional>Tempo estimado</FieldLabel>}
      <div className="flex flex-wrap gap-1.5">
        {estimateOptions.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => { setDraft((current) => ({ ...current, estimateMinutes: option.value })); setCustomEstimateOpen(false); }}
            className={cn(
              "focus-ring h-8 rounded-lg border bg-white text-xs font-medium transition",
              sectioned ? "border-slate-200 px-3 text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50" : "px-2.5 text-slate-500 hover:border-[#a895f2] hover:text-[#6548df]",
              draft.estimateMinutes === option.value && !customEstimateOpen && (sectioned ? "border-[#ddd6fe] bg-[#f5f3ff] font-semibold text-[#6d28d9]" : "border-[#8068e8] bg-[#f4f1ff] text-[#6548df]"),
            )}
          >
            {option.label}
          </button>
        ))}
        <button type="button" onClick={() => setCustomEstimateOpen(true)} className={cn("focus-ring h-8 rounded-lg border bg-white text-xs font-medium transition", sectioned ? "border-slate-200 px-3 text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50" : "px-2.5 text-slate-500 hover:border-[#a895f2] hover:text-[#6548df]", customEstimateOpen && (sectioned ? "border-[#ddd6fe] bg-[#f5f3ff] font-semibold text-[#6d28d9]" : "border-[#8068e8] bg-[#f4f1ff] text-[#6548df]"))}>Personalizado</button>
      </div>
      {customEstimateOpen && (
        <div className="mt-2 flex items-center gap-2">
          <Input type="number" min={15} step={15} value={draft.estimateMinutes ?? ""} onChange={(event) => setDraft((current) => ({ ...current, estimateMinutes: event.target.value ? Number(event.target.value) : null }))} className="h-8 max-w-28 bg-white text-sm" aria-label="Tempo personalizado em minutos" />
          <span className="text-xs text-slate-400">minutos</span>
        </div>
      )}
    </div>
  );

  const renderTags = (sectioned = false) => (
    <div>
      {sectioned ? <SectionTitle title="Etiquetas" description="Use marcadores curtos para organizar e localizar demandas." icon={Tags} /> : <FieldLabel optional>Tags</FieldLabel>}
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

  const panelContent = (
    <form onSubmit={submit} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <SheetHeader className={cn("shrink-0 border-b border-slate-100 bg-white pr-14", task ? "px-6 pb-4 pt-5" : "px-5 py-4 sm:px-6")}>
            <div className={cn("flex items-start", task ? "gap-3.5" : "gap-3")}>
              <div className={cn(
                "grid shrink-0 place-items-center rounded-xl text-[#694ce1] ring-1 ring-[#7657ff]/10",
                task ? "mt-0.5 size-10 bg-[#f5f3ff]" : "size-9 bg-gradient-to-br from-[#f1edff] to-[#e9efff]",
              )}>
                {task ? <FileText className="size-5" /> : <CirclePlus className="size-4" />}
              </div>
              <div>
                <SheetTitle className={cn("tracking-[-0.01em] text-slate-900", task ? "text-lg font-bold leading-snug" : "text-[15px]")}>{task ? "Gerenciar demanda" : "Nova demanda"}</SheetTitle>
                <SheetDescription className={cn("mt-0.5 leading-4 text-slate-500", task ? "text-xs" : "text-[11px]")}>
                  {task ? "Edite os detalhes. As alterações são salvas automaticamente." : "Crie agora e organize os detalhes quando precisar."}
                </SheetDescription>
              </div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className={cn("absolute grid place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7657ff]/25", task ? "right-5 top-5 size-8 hover:text-slate-600" : "right-4 top-4 size-8 hover:text-slate-700")} aria-label="Fechar">
              <X className={task ? "size-5" : "size-4"} />
            </button>
          </SheetHeader>

          {!task ? (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-4.5">
                <div>
                  <FieldLabel>O que precisa ser feito?</FieldLabel>
                  <Input autoFocus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Digite o título da demanda..." className="h-10 rounded-xl bg-white px-3.5 text-sm shadow-none focus-visible:border-[#7657ff] focus-visible:ring-2 focus-visible:ring-[#7657ff]/15" />
                </div>

                <div>
                  <FieldLabel optional>Cliente</FieldLabel>
                  <Select value={draft.clientId ?? "__none"} onValueChange={(value) => setDraft((current) => ({ ...current, clientId: value === "__none" ? null : value }))}>
                    <SelectTrigger className="h-10 w-full rounded-xl bg-white px-3.5 shadow-none"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem cliente</SelectItem>
                      {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <FieldLabel optional>Quando?</FieldLabel>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 p-1">
                    <button type="button" onClick={() => { setDraft((current) => ({ ...current, scheduledDate: todayKey })); setShowDatePicker(false); }} className={cn("h-8 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7657ff]/20", draft.scheduledDate === todayKey && !showDatePicker && "bg-white text-[#6548df] shadow-sm")}>Hoje</button>
                    <button type="button" onClick={() => { setDraft((current) => ({ ...current, scheduledDate: tomorrowKey })); setShowDatePicker(false); }} className={cn("h-8 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7657ff]/20", draft.scheduledDate === tomorrowKey && !showDatePicker && "bg-white text-[#6548df] shadow-sm")}>Amanhã</button>
                    <button type="button" onClick={() => setShowDatePicker(true)} className={cn("h-8 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7657ff]/20", showDatePicker && "bg-white text-[#6548df] shadow-sm")}>Escolher data</button>
                  </div>
                  {showDatePicker && <DatePicker value={draft.scheduledDate} onChange={(value) => setDraft((current) => ({ ...current, scheduledDate: value || null }))} className="mt-2" />}
                </div>

                <div>
                  <FieldLabel optional>Horário</FieldLabel>
                  <Input type="time" value={draft.scheduledTime} onChange={(event) => setDraft((current) => ({ ...current, scheduledTime: event.target.value }))} className="h-10 rounded-xl bg-white shadow-none" />
                </div>

                <button type="button" onClick={() => setAdvancedOpen((current) => !current)} className="flex h-9 items-center gap-2 rounded-lg px-1 text-xs font-semibold text-[#674bdd] transition hover:text-[#4f35c3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7657ff]/20">
                  <CirclePlus className="size-3.5" />
                  <span>{advancedOpen ? "Ocultar opções" : "Mais opções"}</span>
                  <ChevronDown className={cn("ml-0.5 size-3.5 transition", advancedOpen && "rotate-180")} />
                </button>

                {advancedOpen && (
                  <div className="space-y-6 border-t pt-5">
                    <div>
                      <FieldLabel optional>Descrição</FieldLabel>
                      <RichTextEditor value={draft.description} onChange={(description) => setDraft((current) => ({ ...current, description }))} placeholder="Contexto, orientações ou resultado esperado..." />
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
                      <div><FieldLabel optional>Prazo</FieldLabel><DatePicker value={draft.dueDate} min={draft.scheduledDate ?? undefined} onChange={(value) => setDraft((current) => ({ ...current, dueDate: value }))} /></div>
                      <div><FieldLabel optional>Horário limite</FieldLabel><Input type="time" value={draft.dueTime} onChange={(event) => setDraft((current) => ({ ...current, dueTime: event.target.value }))} className="bg-white" /></div>
                    </div>
                    <div>
                      <FieldLabel optional>Repetição</FieldLabel>
                      <Select value={draft.recurrence.type} onValueChange={(value) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, type: value as RecurrenceType } }))}>
                        <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(RECURRENCE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                      {draft.recurrence.type === "custom" && (
                        <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-white p-3">
                          <div>
                            <p className="mb-2 text-xs font-medium text-slate-500">Repetir nestes dias</p>
                            <div className="flex flex-wrap gap-2">{weekDays.map((day) => { const active = draft.recurrence.days.includes(day.value); return <button key={day.label} type="button" title={day.label} onClick={() => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, days: active ? current.recurrence.days.filter((value) => value !== day.value) : [...current.recurrence.days, day.value] } }))} className={cn("grid size-8 place-items-center rounded-lg border text-xs font-semibold transition", active ? "border-[#7657ff] bg-[#7657ff] text-white" : "bg-white text-slate-500 hover:border-[#9b88ef]")}>{day.short}</button>; })}</div>
                          </div>
                          <div>
                            <FieldLabel>Repetir até</FieldLabel>
                            <DatePicker required min={draft.scheduledDate ?? todayKey} value={draft.recurrence.endDate} onChange={(value) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, endDate: value } }))} />
                          </div>
                        </div>
                      )}
                    </div>
                    {renderTags()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0 overflow-hidden">
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div>
                  <ModalFieldLabel>Título</ModalFieldLabel>
                  <Input autoFocus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Título da demanda" className="h-[52px] rounded-xl border-[#8b5cf6] bg-white px-3.5 text-sm font-medium text-slate-900 shadow-sm focus-visible:border-[#7c3aed] focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/10" />
                </div>

                <div className="-mx-5 mt-4 border-b border-slate-200 px-5 sm:-mx-6 sm:px-6">
                  <TabsList variant="line" className="-mb-px flex h-12 w-full justify-start gap-2 rounded-none bg-transparent p-0 text-slate-500 sm:gap-4">
                    <TabsTrigger value="details" className="h-12 flex-none gap-2 rounded-none border-0 px-1 text-[11px] font-semibold after:bottom-0 after:bg-[#7c3aed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/20 data-[state=active]:text-[#7c3aed] sm:text-xs"><FileText className="size-4" />Detalhes</TabsTrigger>
                    <TabsTrigger value="checklist" className="h-12 flex-none gap-2 rounded-none border-0 px-1 text-[11px] font-semibold after:bottom-0 after:bg-[#7c3aed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/20 data-[state=active]:text-[#7c3aed] sm:text-xs"><CheckCircle2 className="size-4" />Checklist</TabsTrigger>
                    <TabsTrigger value="files" className="h-12 flex-none gap-2 rounded-none border-0 px-1 text-[11px] font-semibold after:bottom-0 after:bg-[#7c3aed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/20 data-[state=active]:text-[#7c3aed] sm:text-xs"><Paperclip className="size-4" />Anexos</TabsTrigger>
                    <TabsTrigger value="activity" className="h-12 flex-none gap-2 rounded-none border-0 px-1 text-[11px] font-semibold after:bottom-0 after:bg-[#7c3aed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/20 data-[state=active]:text-[#7c3aed] sm:text-xs"><History className="size-4" />Atividade</TabsTrigger>
                  </TabsList>
                </div>

                  <TabsContent value="details" className="m-0 space-y-6 pt-5">
                    <section>
                      <SectionTitle title="Organização" icon={BriefcaseBusiness} />
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <div>
                          <ModalFieldLabel optional>Cliente</ModalFieldLabel>
                          <Select value={draft.clientId ?? "__none"} onValueChange={(value) => setDraft((current) => ({ ...current, clientId: value === "__none" ? null : value }))}>
                            <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white px-3 text-xs font-medium shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="__none">Sem cliente</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <ModalFieldLabel>Status</ModalFieldLabel>
                          <Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as TaskStatus }))}>
                            <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white px-3 text-xs font-medium shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <ModalFieldLabel>Prioridade</ModalFieldLabel>
                          <Select value={draft.priority} onValueChange={(value) => setDraft((current) => ({ ...current, priority: value as TaskPriority }))}>
                            <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white px-3 text-xs font-medium shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    <section>
                      <SectionTitle title="Descrição" icon={AlignLeft} />
                      <RichTextEditor value={draft.description} onChange={(description) => setDraft((current) => ({ ...current, description }))} placeholder="Adicione os detalhes da demanda..." />
                    </section>

                    <section>
                      <SectionTitle title="Agendamento" icon={CalendarClock} />
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <div><ModalFieldLabel optional>Data</ModalFieldLabel><DatePicker value={draft.scheduledDate} onChange={(value) => setDraft((current) => ({ ...current, scheduledDate: value || null }))} /></div>
                        <div><ModalFieldLabel optional>Horário</ModalFieldLabel><Input type="time" value={draft.scheduledTime} onChange={(event) => setDraft((current) => ({ ...current, scheduledTime: event.target.value }))} className="h-9 rounded-lg border-slate-200 bg-white px-3 text-xs font-medium shadow-sm" /></div>
                      </div>
                    </section>

                    <section>
                      <SectionTitle title="Prazo" description="Até quando precisa estar pronto?" icon={Clock3} />
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <div><ModalFieldLabel optional>Data</ModalFieldLabel><DatePicker value={draft.dueDate} min={draft.scheduledDate ?? undefined} onChange={(value) => setDraft((current) => ({ ...current, dueDate: value }))} /></div>
                        <div><ModalFieldLabel optional>Horário limite</ModalFieldLabel><Input type="time" value={draft.dueTime} onChange={(event) => setDraft((current) => ({ ...current, dueTime: event.target.value }))} className="h-9 rounded-lg border-slate-200 bg-white px-3 text-xs font-medium shadow-sm" /></div>
                      </div>
                    </section>

                    <section>{renderEstimate(true)}</section>

                    <section>
                      <SectionTitle title="Repetição" description="Defina uma frequência e quando ela deve terminar." icon={Repeat2} />
                      <Select value={draft.recurrence.type} onValueChange={(value) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, type: value as RecurrenceType } }))}>
                        <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white px-3 text-xs font-medium shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(RECURRENCE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                      {draft.recurrence.type === "custom" && (
                        <div className="mt-2.5 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold text-slate-600">Repetir nestes dias</p>
                            <div className="flex flex-wrap gap-1.5">{weekDays.map((day) => { const active = draft.recurrence.days.includes(day.value); return <button key={day.label} type="button" title={day.label} onClick={() => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, days: active ? current.recurrence.days.filter((value) => value !== day.value) : [...current.recurrence.days, day.value] } }))} className={cn("grid size-7 place-items-center rounded-full border text-xs font-medium shadow-sm transition", active ? "border-[#7c3aed] bg-[#7c3aed] font-semibold text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100")}>{day.short}</button>; })}</div>
                          </div>
                          <div>
                            <ModalFieldLabel>Repetir até</ModalFieldLabel>
                            <DatePicker required min={draft.scheduledDate ?? todayKey} value={draft.recurrence.endDate} onChange={(value) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, endDate: value } }))} />
                          </div>
                        </div>
                      )}
                    </section>

                    <section>{renderTags(true)}</section>
                  </TabsContent>

                  <TabsContent value="checklist" className="m-0 py-5">
                    <div className="mb-5">
                      <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-800">Progresso</span><span className="font-semibold text-[#6246d8]">{checklistProgress}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#7657ff] to-[#2f80ed] transition-all" style={{ width: `${checklistProgress}%` }} /></div>
                    </div>
                    <div className="space-y-2">
                      {draft.checklist.map((item) => <div key={item.id} className="group flex items-center gap-3 rounded-xl border bg-white px-3 py-3"><Checkbox checked={item.completed} onCheckedChange={(checked) => setDraft((current) => ({ ...current, checklist: current.checklist.map((currentItem) => currentItem.id === item.id ? { ...currentItem, completed: checked === true } : currentItem) }))} /><span className={cn("flex-1 text-sm", item.completed && "text-slate-400 line-through")}>{item.label}</span><button type="button" onClick={() => setDraft((current) => ({ ...current, checklist: current.checklist.filter((currentItem) => currentItem.id !== item.id) }))} className="text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100" aria-label={`Excluir ${item.label}`}><Trash2 className="size-4" /></button></div>)}
                    </div>
                    <div className="mt-3 flex gap-2"><Input value={checklistInput} onChange={(event) => setChecklistInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChecklistItem(); } }} placeholder="Adicionar item ao checklist" className="bg-white" /><Button type="button" variant="outline" onClick={addChecklistItem}><Plus className="size-4" /><span className="sr-only sm:not-sr-only">Adicionar</span></Button></div>
                  </TabsContent>

                  <TabsContent value="files" className="m-0 py-5">
                    <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center transition hover:border-[#8b73ef] hover:bg-[#faf9ff]">
                      <span className="mb-3 grid size-11 place-items-center rounded-xl bg-[#eeeaff] text-[#6b50df]"><Paperclip className="size-5" /></span>
                      <span className="text-sm font-semibold text-slate-800">Adicionar arquivos</span>
                      <span className="mt-1 text-xs leading-5 text-slate-500">Selecione documentos ou imagens do seu computador.</span>
                      <input type="file" multiple className="sr-only" onChange={(event) => { const files = Array.from(event.target.files ?? []); setDraft((current) => ({ ...current, attachments: [...current.attachments, ...files.map((file) => ({ id: makeId(), name: file.name, size: file.size, type: file.type }))] })); event.target.value = ""; }} />
                    </label>
                    <div className="mt-4 space-y-2">{draft.attachments.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileText className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{file.name}</p><p className="text-xs text-slate-400">{file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "Arquivo"}</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== file.id) }))} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remover ${file.name}`}><Trash2 className="size-4" /></button></div>)}</div>
                    <div className="mt-4">
                      <FieldLabel optional>Adicionar por link</FieldLabel>
                      <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                          <Input value={linkInput} onChange={(event) => setLinkInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} placeholder="https://..." className="bg-white pl-9" />
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={addLink} className="h-9 shrink-0">Adicionar</Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="activity" className="m-0 py-5">
                    <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200">{task.activity.map((item) => <div key={item.id} className="relative flex gap-4"><span className="relative z-10 mt-1.5 size-[15px] shrink-0 rounded-full border-[4px] border-white bg-[#7a60eb]" /><div><p className="text-sm font-medium text-slate-700">{item.text}</p><p className="mt-1 text-xs text-slate-400">{format(parseISO(item.createdAt), "dd MMM, HH:mm", { locale: ptBR })}</p></div></div>)}</div>
                  </TabsContent>
              </div>
            </Tabs>
          )}

          <SheetFooter className={cn("shrink-0 flex-row items-center border-t", task ? "gap-4 border-slate-200/80 bg-slate-50/80 px-5 py-3.5 sm:px-6" : "gap-1.5 border-slate-100 bg-white px-5 py-2.5 sm:px-6")}>
            {task ? (
              <>
                <Button type="button" variant="ghost" size="sm" className="mr-auto h-8 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => { onArchive(task.id); onOpenChange(false); }}><Archive className="size-4" /> <span>Arquivar</span></Button>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">{autoSaveState === "saving" ? "Salvando..." : "Alterações salvas"}</span>
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100/80" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" className="h-9 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#6d28d9]">Salvar</Button>
                </div>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" className="mr-auto h-8 px-2 text-xs text-slate-500" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" size="sm" className="h-8 rounded-lg bg-gradient-to-r from-[#7657ff] to-[#6548df] px-3.5 text-xs shadow-[0_4px_14px_rgba(105,78,226,0.18)] hover:opacity-90"><Plus className="size-3.5" />Criar demanda</Button>
              </>
            )}
          </SheetFooter>
    </form>
  );

  if (task) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="flex h-[calc(100dvh-24px)] max-h-[1016px] w-[calc(100vw-24px)] max-w-xl gap-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-0 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25),0_0_0_1px_rgba(15,23,42,0.06)] sm:h-[92vh] sm:max-w-xl">
          {panelContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[calc(100vw-8px)] max-w-[680px] gap-0 overflow-hidden border-l border-slate-200 bg-white p-0 shadow-[-20px_0_60px_rgba(22,24,35,0.1)] sm:w-[680px] sm:max-w-[calc(100vw-16px)]" showCloseButton={false}>
        {panelContent}
      </SheetContent>
    </Sheet>
  );
}
