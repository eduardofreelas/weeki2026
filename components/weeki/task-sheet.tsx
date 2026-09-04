"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  CalendarClock,
  Check,
  CirclePlus,
  FileText,
  Link2,
  Paperclip,
  Plus,
  RotateCw,
  Tag,
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

const emptyDraft = (scheduledDate: string | null): TaskDraft => ({
  title: "",
  description: "",
  clientId: null,
  status: "not_started",
  priority: "medium",
  scheduledDate,
  scheduledTime: "",
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

function FieldLabel({ children, optional = false }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
      {children}
      {optional && <span className="font-normal text-slate-400">Opcional</span>}
    </Label>
  );
}

export function TaskSheet({
  open,
  onOpenChange,
  task,
  initialDate,
  clients,
  onSave,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  initialDate: string | null;
  clients: Client[];
  onSave: (draft: TaskDraft, taskId?: string) => void;
  onArchive: (taskId: string) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft(initialDate));
  const [tagInput, setTagInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(task ? {
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
    } : emptyDraft(initialDate));
    setTagInput("");
    setChecklistInput("");
  }, [open, task, initialDate]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden border-l border-slate-200 bg-[#fbfbfd] p-0 sm:max-w-[720px]" showCloseButton={false}>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader className="border-b bg-white px-5 py-4 pr-16 sm:px-7">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#6f52ec]">
                {task ? <FileText className="size-[18px]" /> : <CirclePlus className="size-[18px]" />}
              </div>
              <div>
                <SheetTitle className="text-base">{task ? "Detalhes da demanda" : "Nova demanda"}</SheetTitle>
                <SheetDescription className="mt-1 text-xs">
                  {task ? "Edite as informações e acompanhe o andamento." : "Só o título é obrigatório. Organize o restante quando quiser."}
                </SheetDescription>
              </div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="absolute right-5 top-5 grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </SheetHeader>

          <div className="border-b bg-white px-5 pt-5 sm:px-7">
            <Input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="O que precisa ser feito?"
              className="h-auto rounded-none border-0 px-0 pb-4 text-xl font-semibold tracking-[-0.02em] shadow-none placeholder:font-medium placeholder:text-slate-300 focus-visible:ring-0 md:text-xl"
            />
          </div>

          <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0">
            <div className="border-b bg-white px-5 sm:px-7">
              <TabsList variant="line" className="h-11 w-full justify-start gap-5 overflow-x-auto">
                <TabsTrigger value="details" className="flex-none px-0">Detalhes</TabsTrigger>
                <TabsTrigger value="checklist" className="flex-none px-0">Checklist {draft.checklist.length > 0 && `(${draft.checklist.length})`}</TabsTrigger>
                <TabsTrigger value="files" className="flex-none px-0">Anexos {draft.attachments.length > 0 && `(${draft.attachments.length})`}</TabsTrigger>
                <TabsTrigger value="activity" className="flex-none px-0">Atividade</TabsTrigger>
              </TabsList>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="details" className="m-0 space-y-6 p-5 sm:p-7">
                <div>
                  <FieldLabel optional>Descrição</FieldLabel>
                  <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Contexto, orientações ou resultado esperado..." className="min-h-24 resize-y bg-white" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel optional>Cliente</FieldLabel>
                    <Select value={draft.clientId ?? "__none"} onValueChange={(value) => setDraft((current) => ({ ...current, clientId: value === "__none" ? null : value }))}>
                      <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sem cliente</SelectItem>
                        {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                      </SelectContent>
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
                  <div>
                    <FieldLabel optional>Tempo estimado</FieldLabel>
                    <Select value={draft.estimateMinutes?.toString() ?? "__none"} onValueChange={(value) => setDraft((current) => ({ ...current, estimateMinutes: value === "__none" ? null : Number(value) }))}>
                      <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Não informar</SelectItem>
                        <SelectItem value="15">15 minutos</SelectItem><SelectItem value="30">30 minutos</SelectItem><SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem><SelectItem value="120">2 horas</SelectItem><SelectItem value="240">4 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarClock className="size-4 text-[#7057e7]" /> Planejamento e prazo</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><FieldLabel optional>Data agendada</FieldLabel><Input type="date" value={draft.scheduledDate ?? ""} onChange={(event) => setDraft((current) => ({ ...current, scheduledDate: event.target.value || null }))} /></div>
                    <div><FieldLabel optional>Horário</FieldLabel><Input type="time" value={draft.scheduledTime} onChange={(event) => setDraft((current) => ({ ...current, scheduledTime: event.target.value }))} /></div>
                    <div><FieldLabel optional>Vencimento</FieldLabel><Input type="date" value={draft.dueDate} min={draft.scheduledDate ?? undefined} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></div>
                    <div><FieldLabel optional>Horário limite</FieldLabel><Input type="time" value={draft.dueTime} onChange={(event) => setDraft((current) => ({ ...current, dueTime: event.target.value }))} /></div>
                  </div>
                </div>

                <div>
                  <FieldLabel optional><Tag className="size-3.5" /> Tags</FieldLabel>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="Ex.: Design, Site" className="bg-white" />
                    <Button type="button" variant="outline" onClick={addTag}>Adicionar</Button>
                  </div>
                  {draft.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{draft.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-[#eeeaff] px-2 py-1 text-xs font-medium text-[#6246d8]">{tag}<button type="button" onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))} aria-label={`Remover tag ${tag}`}><X className="size-3" /></button></span>)}</div>}
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800"><RotateCw className="size-4 text-[#7057e7]" /> Repetição</div>
                  <Select value={draft.recurrence.type} onValueChange={(value) => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, type: value as RecurrenceType } }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(RECURRENCE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                  {draft.recurrence.type === "custom" && <div className="mt-3 flex flex-wrap gap-2">{weekDays.map((day) => { const active = draft.recurrence.days.includes(day.value); return <button key={day.label} type="button" title={day.label} onClick={() => setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, days: active ? current.recurrence.days.filter((value) => value !== day.value) : [...current.recurrence.days, day.value] } }))} className={cn("grid size-9 place-items-center rounded-lg border text-xs font-semibold transition", active ? "border-[#7657ff] bg-[#7657ff] text-white" : "bg-white text-slate-500 hover:border-[#9b88ef]")}>{day.short}</button>; })}</div>}
                </div>

                <div><FieldLabel optional>Observações</FieldLabel><Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Informações rápidas que não podem se perder..." className="min-h-20 bg-white" /></div>
              </TabsContent>

              <TabsContent value="checklist" className="m-0 p-5 sm:p-7">
                <div className="mb-5 rounded-2xl border bg-white p-4">
                  <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-800">Progresso</span><span className="font-semibold text-[#6246d8]">{checklistProgress}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#7657ff] to-[#2f80ed] transition-all" style={{ width: `${checklistProgress}%` }} /></div>
                </div>
                <div className="space-y-2">
                  {draft.checklist.map((item) => <div key={item.id} className="group flex items-center gap-3 rounded-xl border bg-white px-3 py-3"><Checkbox checked={item.completed} onCheckedChange={(checked) => setDraft((current) => ({ ...current, checklist: current.checklist.map((currentItem) => currentItem.id === item.id ? { ...currentItem, completed: checked === true } : currentItem) }))} /><span className={cn("flex-1 text-sm", item.completed && "text-slate-400 line-through")}>{item.label}</span><button type="button" onClick={() => setDraft((current) => ({ ...current, checklist: current.checklist.filter((currentItem) => currentItem.id !== item.id) }))} className="text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100" aria-label={`Excluir ${item.label}`}><Trash2 className="size-4" /></button></div>)}
                </div>
                <div className="mt-3 flex gap-2"><Input value={checklistInput} onChange={(event) => setChecklistInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChecklistItem(); } }} placeholder="Adicionar item ao checklist" className="bg-white" /><Button type="button" variant="outline" onClick={addChecklistItem}><Plus /> Adicionar</Button></div>
              </TabsContent>

              <TabsContent value="files" className="m-0 p-5 sm:p-7">
                <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center transition hover:border-[#8b73ef] hover:bg-[#faf9ff]">
                  <span className="mb-3 grid size-11 place-items-center rounded-xl bg-[#eeeaff] text-[#6b50df]"><Paperclip className="size-5" /></span>
                  <span className="text-sm font-semibold text-slate-800">Adicionar arquivos</span>
                  <span className="mt-1 text-xs leading-5 text-slate-500">Selecione documentos, imagens ou links de referência.</span>
                  <input type="file" multiple className="sr-only" onChange={(event) => { const files = Array.from(event.target.files ?? []); setDraft((current) => ({ ...current, attachments: [...current.attachments, ...files.map((file) => ({ id: makeId(), name: file.name, size: file.size, type: file.type }))] })); event.target.value = ""; }} />
                </label>
                <div className="mt-4 space-y-2">{draft.attachments.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileText className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{file.name}</p><p className="text-xs text-slate-400">{file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "Arquivo"}</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== file.id) }))} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remover ${file.name}`}><Trash2 className="size-4" /></button></div>)}</div>
                <Button type="button" variant="ghost" className="mt-3 text-[#6b50df]" onClick={() => {
                  const url = window.prompt("Cole o link de referência:");
                  if (!url?.trim()) return;
                  setDraft((current) => ({ ...current, attachments: [...current.attachments, { id: makeId(), name: url.trim(), size: 0, type: "link" }] }));
                }}><Link2 /> Adicionar link</Button>
              </TabsContent>

              <TabsContent value="activity" className="m-0 p-5 sm:p-7">
                {task ? <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200">{task.activity.map((item) => <div key={item.id} className="relative flex gap-4"><span className="relative z-10 mt-1.5 size-[15px] shrink-0 rounded-full border-[4px] border-[#fbfbfd] bg-[#7a60eb]" /><div><p className="text-sm font-medium text-slate-700">{item.text}</p><p className="mt-1 text-xs text-slate-400">{format(parseISO(item.createdAt), "dd MMM, HH:mm", { locale: ptBR })}</p></div></div>)}</div> : <div className="grid min-h-56 place-items-center text-center"><div><span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400"><Check className="size-5" /></span><p className="text-sm font-semibold text-slate-700">A atividade começa após salvar</p><p className="mt-1 text-xs text-slate-400">Alterações importantes serão registradas aqui.</p></div></div>}
              </TabsContent>
            </div>
          </Tabs>

          <SheetFooter className="flex-row items-center border-t bg-white px-5 py-4 sm:px-7">
            {task && <Button type="button" variant="ghost" className="mr-auto text-slate-500 hover:text-rose-600" onClick={() => { onArchive(task.id); onOpenChange(false); }}><Archive /> Arquivar</Button>}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-gradient-to-r from-[#7657ff] to-[#356fd7] px-5 shadow-[0_6px_18px_rgba(105,78,226,0.22)] hover:opacity-90">{task ? "Salvar alterações" : "Criar demanda"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
