"use client";

import { useMemo, useRef, useState } from "react";
import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
  ImagePlus,
  Link2,
  MapPin,
  MonitorPlay,
  Palette,
  Phone,
  Rocket,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/weeki/rich-text-editor";
import type {
  AppointmentMode,
  EventType,
  EventTypeDraft,
  EventVisibility,
} from "@/features/appointments/types";
import { APPOINTMENT_MODE_LABELS } from "@/features/appointments/types";
import { cn } from "@/lib/utils";

type EditorDraft = EventTypeDraft & {
  visibility: EventVisibility;
  bookingWindowStart: string;
  bookingWindowEnd: string;
  timezone: string;
  autoDetectTimezone: boolean;
  location: string;
  additionalHosts: string[];
  emailReminder: boolean;
  calendarInvite: boolean;
  coverImage: string;
};

const durationOptions = [15, 30, 45, 60];
const previewTimes = ["09:00", "10:30", "14:00", "16:00"];
const today = () => format(new Date(), "yyyy-MM-dd");

const slugify = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const stripHtml = (value: string) => value
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<\/p>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();

const formatDuration = (minutes: number) => minutes < 60
  ? `${minutes} min`
  : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;

const makeDraft = (eventType: EventType | null): EditorDraft => eventType ? {
  name: eventType.name,
  description: eventType.description,
  durationMinutes: eventType.durationMinutes,
  mode: eventType.mode,
  price: eventType.price,
  includedInPlan: eventType.includedInPlan,
  clientOnly: eventType.clientOnly,
  active: eventType.active,
  slug: eventType.slug,
  color: eventType.color,
  visibility: eventType.visibility ?? (eventType.clientOnly ? "private" : "public"),
  bookingWindowStart: eventType.bookingWindowStart ?? "",
  bookingWindowEnd: eventType.bookingWindowEnd ?? "",
  timezone: eventType.timezone ?? "America/Sao_Paulo",
  autoDetectTimezone: eventType.autoDetectTimezone ?? true,
  location: eventType.location ?? "",
  additionalHosts: eventType.additionalHosts ?? [],
  emailReminder: eventType.emailReminder ?? true,
  calendarInvite: eventType.calendarInvite ?? true,
  coverImage: eventType.coverImage ?? "",
} : {
  name: "",
  description: "",
  durationMinutes: 30,
  mode: "google_meet",
  price: null,
  includedInPlan: false,
  clientOnly: false,
  active: false,
  slug: "",
  color: "#4f46e5",
  visibility: "public",
  bookingWindowStart: "",
  bookingWindowEnd: "",
  timezone: "America/Sao_Paulo",
  autoDetectTimezone: true,
  location: "",
  additionalHosts: [],
  emailReminder: true,
  calendarInvite: true,
  coverImage: "",
};

export function EventTypeEditor({
  eventType,
  publicUrl,
  onBack,
  onSave,
}: {
  eventType: EventType | null;
  publicUrl: string;
  onBack: () => void;
  onSave: (draft: EventTypeDraft, action: "draft" | "publish") => void;
}) {
  const [draft, setDraft] = useState<EditorDraft>(() => makeDraft(eventType));
  const [slugTouched, setSlugTouched] = useState(Boolean(eventType?.slug));
  const [hostInput, setHostInput] = useState("");
  const [customDurationOpen, setCustomDurationOpen] = useState(!durationOptions.includes(draft.durationMinutes));
  const [previewDate, setPreviewDate] = useState(() => addDays(new Date(), 1));
  const [previewTime, setPreviewTime] = useState("10:30");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const eventLink = `${publicUrl}?tipo=${encodeURIComponent(draft.slug || "seu-evento")}`;
  const previewDays = useMemo(() => {
    const monthStart = startOfMonth(previewDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    return Array.from({ length: 35 }, (_, index) => addDays(gridStart, index));
  }, [previewDate]);

  const save = (action: "draft" | "publish") => {
    if (!draft.name.trim()) {
      toast.error("Informe o título do evento.");
      return;
    }
    const slug = slugify(draft.slug || draft.name);
    if (!slug) {
      toast.error("Defina um endereço válido para o evento.");
      return;
    }
    if (draft.bookingWindowStart && draft.bookingWindowEnd && draft.bookingWindowEnd < draft.bookingWindowStart) {
      toast.error("A data final deve ser posterior à abertura das reservas.");
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      slug,
      active: action === "publish" ? true : eventType ? draft.active : false,
    }, action);
  };

  const addHost = () => {
    const email = hostInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (draft.additionalHosts.includes(email)) {
      toast.info("Este participante já foi adicionado.");
      return;
    }
    update("additionalHosts", [...draft.additionalHosts, email]);
    setHostInput("");
  };

  const uploadCover = (file?: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      toast.error("Use uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 675;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        toast.error("Não foi possível processar a imagem.");
        return;
      }
      const targetRatio = canvas.width / canvas.height;
      const sourceRatio = image.width / image.height;
      const sourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
      const sourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
      const sourceX = (image.width - sourceWidth) / 2;
      const sourceY = (image.height - sourceHeight) / 2;
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      update("coverImage", canvas.toDataURL("image/webp", 0.82));
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Não foi possível abrir a imagem selecionada.");
    };
    image.src = objectUrl;
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-900">
            <ArrowLeft className="size-3.5" /> Tipos de Eventos
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[25px] font-bold tracking-[-0.04em] text-slate-900 sm:text-[28px]">Configurar evento</h1>
            <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-md px-2 text-[9px] font-semibold", draft.active ? "bg-emerald-50 text-emerald-700" : "bg-[#efedff] text-[#5a46d8]") }>
              <span className="size-1.5 rounded-full bg-current" /> {draft.active ? "Publicado" : "Em rascunho"}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Defina informações, regras de agendamento e acompanhe a experiência do cliente em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600">
            Ativo na página pública
            <Switch size="sm" checked={draft.active} onCheckedChange={(checked) => update("active", checked)} />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => save("draft")} className="h-8 rounded-md bg-white px-3 text-[11px] shadow-none">{eventType ? "Salvar alterações" : "Salvar rascunho"}</Button>
          <Button type="button" size="sm" onClick={() => save("publish")} className="h-8 rounded-md bg-[#111827] px-3 text-[11px] shadow-none hover:bg-[#1f2937]"><Rocket className="size-3.5" />Publicar evento</Button>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="space-y-4">
          <EditorSection icon={FileText} title="Identificação do evento" aside="Etapa 1 de 4">
            <Field label="Título do evento" required>
              <Input
                autoFocus
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setDraft((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }));
                }}
                placeholder="Ex.: Reunião de alinhamento"
                className="h-9 rounded-md text-xs shadow-none"
              />
            </Field>
            <Field label="Link personalizado do evento">
              <div className="flex h-9 items-center rounded-md bg-[#f2f3fb] px-3 ring-1 ring-inset ring-slate-200 focus-within:ring-[#7b67e7]">
                <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">{publicUrl.replace(/^https?:\/\//, "")}?tipo=</span>
                <input
                  value={draft.slug}
                  onChange={(event) => { setSlugTouched(true); update("slug", slugify(event.target.value)); }}
                  placeholder="nome-do-evento"
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none"
                />
                <button type="button" onClick={() => navigator.clipboard.writeText(eventLink).then(() => toast.success("Link copiado.")).catch(() => toast.error("Não foi possível copiar o link."))} className="grid size-7 place-items-center rounded text-slate-400 hover:bg-white hover:text-[#5b47df]" aria-label="Copiar link"><Copy className="size-3.5" /></button>
              </div>
            </Field>
            <Field label="Visibilidade">
              <div className="grid gap-2 sm:grid-cols-2">
                <VisibilityCard value="public" selected={draft.visibility === "public"} title="Público" description="Visível na página geral para qualquer visitante." onSelect={() => update("visibility", "public")} />
                <VisibilityCard value="private" selected={draft.visibility === "private"} title="Privado / oculto" description="Somente quem receber o link direto poderá agendar." onSelect={() => update("visibility", "private")} />
              </div>
            </Field>
          </EditorSection>

          <EditorSection icon={Clock3} title="Duração e janela de disponibilidade">
            <Field label="Duração da sessão">
              <div className="flex flex-wrap gap-1.5">
                {durationOptions.map((minutes) => (
                  <button key={minutes} type="button" onClick={() => { update("durationMinutes", minutes); setCustomDurationOpen(false); }} className={cn("h-8 rounded-md px-3 text-[11px] font-medium transition", draft.durationMinutes === minutes && !customDurationOpen ? "bg-[#111827] text-white" : "bg-[#f1f3fb] text-slate-600 hover:bg-[#e8ebf7]")}>{minutes} min</button>
                ))}
                <button type="button" onClick={() => setCustomDurationOpen(true)} className={cn("h-8 rounded-md px-3 text-[11px] font-medium transition", customDurationOpen ? "bg-[#111827] text-white" : "bg-[#f1f3fb] text-slate-600 hover:bg-[#e8ebf7]")}>Personalizado</button>
                {customDurationOpen && <Input type="number" min={5} max={480} value={draft.durationMinutes} onChange={(event) => update("durationMinutes", Math.max(5, Number(event.target.value) || 5))} className="h-8 w-24 rounded-md text-xs shadow-none" aria-label="Duração personalizada em minutos" />}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Abertura das reservas">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => update("bookingWindowStart", "")} className={cn("h-9 shrink-0 rounded-md border px-3 text-[10px] font-medium", !draft.bookingWindowStart ? "border-[#7c68e8] bg-[#f0eeff] text-[#5d48dc]" : "border-slate-200 bg-white text-slate-500")}>Imediata</button>
                  <Input type="date" min={today()} value={draft.bookingWindowStart} onChange={(event) => update("bookingWindowStart", event.target.value)} className="h-9 min-w-0 rounded-md text-xs shadow-none" aria-label="Data de abertura" />
                </div>
              </Field>
              <Field label="Encerramento / limite">
                <Input type="date" min={draft.bookingWindowStart || today()} value={draft.bookingWindowEnd} onChange={(event) => update("bookingWindowEnd", event.target.value)} className="h-9 rounded-md text-xs shadow-none" />
              </Field>
            </div>
            <Field label="Fuso horário base">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] text-slate-400">Horário usado para organizar as reservas.</span>
                <label className="flex items-center gap-2 text-[10px] font-medium text-[#5c48dc]"><Globe2 className="size-3.5" />Detectar automaticamente para o convidado <Switch size="sm" checked={draft.autoDetectTimezone} onCheckedChange={(checked) => update("autoDetectTimezone", checked)} /></label>
              </div>
              <select value={draft.timezone} onChange={(event) => update("timezone", event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-[#f7f8fc] px-3 text-xs text-slate-700 outline-none focus:border-[#8d7be7]">
                <option value="America/Sao_Paulo">América/São Paulo — Brasília (GMT-3)</option>
                <option value="America/Manaus">América/Manaus (GMT-4)</option>
                <option value="America/Noronha">América/Noronha (GMT-2)</option>
                <option value="Europe/Lisbon">Europa/Lisboa</option>
                <option value="America/New_York">América/Nova York</option>
              </select>
            </Field>
          </EditorSection>

          <EditorSection icon={Video} title="Canal e local da reunião">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ChannelCard mode="google_meet" current={draft.mode} title="Google Meet" description="Link automático" icon={MonitorPlay} onSelect={() => update("mode", "google_meet")} />
              <ChannelCard mode="video" current={draft.mode} title="Zoom Meetings" description="Conectar via OAuth" icon={Video} onSelect={() => update("mode", "video")} />
              <ChannelCard mode="in_person" current={draft.mode} title="Presencial / sala" description="Endereço do encontro" icon={MapPin} onSelect={() => update("mode", "in_person")} />
              <ChannelCard mode="phone" current={draft.mode} title="Telefone" description="Ligação direta" icon={Phone} onSelect={() => update("mode", "phone")} />
            </div>
            {draft.mode === "in_person" && <Field label="Endereço ou sala"><Input value={draft.location} onChange={(event) => update("location", event.target.value)} placeholder="Informe o local do atendimento" className="h-9 rounded-md text-xs shadow-none" /></Field>}
            <div className="flex flex-col gap-3 rounded-lg bg-[#f3f4fb] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-semibold text-slate-800">Valor do atendimento</p><p className="mt-0.5 text-[10px] text-slate-500">Deixe vazio para oferecer gratuitamente.</p></div>
              <div className="flex h-9 w-full items-center rounded-md border border-slate-200 bg-white px-3 sm:w-36"><span className="text-[10px] text-slate-400">R$</span><input type="number" min="0" step="0.01" value={draft.price ?? ""} onChange={(event) => update("price", event.target.value ? Number(event.target.value) : null)} placeholder="0,00" className="min-w-0 flex-1 bg-transparent text-right text-xs font-semibold text-slate-800 outline-none" /></div>
            </div>
          </EditorSection>

          <EditorSection icon={FileText} title="Descrição e orientações ao cliente" aside="Editor de texto">
            <RichTextEditor value={draft.description} onChange={(value) => update("description", value)} placeholder="Descreva a pauta, materiais necessários e o objetivo do encontro..." maxLength={3000} />
          </EditorSection>

          <EditorSection icon={UsersRound} title="Participantes e lembretes automáticos">
            <Field label="Anfitriões adicionais / notificar por e-mail">
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-[#f7f8fc] p-1.5 focus-within:border-[#8d7be7]">
                {draft.additionalHosts.map((email) => <span key={email} className="inline-flex h-7 items-center gap-1 rounded bg-white px-2 text-[10px] text-slate-600 ring-1 ring-slate-200">{email}<button type="button" onClick={() => update("additionalHosts", draft.additionalHosts.filter((item) => item !== email))} className="text-slate-400 hover:text-rose-500" aria-label={`Remover ${email}`}><X className="size-3" /></button></span>)}
                <input type="email" value={hostInput} onChange={(event) => setHostInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addHost(); } }} onBlur={addHost} placeholder="Digite um e-mail e pressione Enter" className="h-7 min-w-[210px] flex-1 bg-transparent px-1 text-xs outline-none" />
              </div>
            </Field>
            <div className="space-y-2">
              <ReminderRow icon={BellRing} title="Lembrete por e-mail (1 hora antes)" description="Ajuda a reduzir ausências e envia as orientações do encontro." checked={draft.emailReminder} onChange={(checked) => update("emailReminder", checked)} />
              <ReminderRow icon={CalendarDays} title="Convite para Google/Apple Agenda" description="Envia um arquivo .ICS logo após a confirmação." checked={draft.calendarInvite} onChange={(checked) => update("calendarInvite", checked)} />
            </div>
          </EditorSection>

          <EditorSection icon={Palette} title="Capa e personalização visual">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-28 w-full overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-[#0f172a] via-[#334155] to-[#7c6be6] sm:w-44">
                {draft.coverImage && <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${draft.coverImage})` }} />}
              </div>
              <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">Banner do cabeçalho</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Formato 16:9, mínimo 1200 × 675 px. PNG, JPG ou WebP até 5 MB.</p><div className="mt-3 flex flex-wrap gap-2"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadCover(event.target.files?.[0])} /><Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 rounded-md bg-[#111827] px-3 text-[10px] shadow-none"><ImagePlus className="size-3.5" />{draft.coverImage ? "Alterar capa" : "Adicionar capa"}</Button><Button type="button" variant="secondary" size="sm" onClick={() => update("coverImage", "")} className="h-8 rounded-md px-3 text-[10px] shadow-none">Usar gradiente Weeki</Button></div></div>
            </div>
          </EditorSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <div className="flex items-center justify-between"><p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><Globe2 className="size-3.5 text-[#5b47df]" />Pré-visualização da página pública</p><span className="inline-flex items-center gap-1 rounded bg-[#efedff] px-1.5 py-1 text-[9px] font-semibold text-[#5b47df]"><span className="size-1.5 rounded-full bg-[#6550e8]" />Em tempo real</span></div>
          <PublicPreview draft={draft} eventLink={eventLink} days={previewDays} selectedDate={previewDate} selectedTime={previewTime} onDateChange={setPreviewDate} onTimeChange={setPreviewTime} />
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#f0edff] text-[#5a46d8]"><BellRing className="size-4" /></span><div><p className="text-xs font-semibold text-slate-800">Dica de conversão</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Descrições objetivas, duração clara e lembretes automáticos ajudam o cliente a concluir o agendamento.</p></div></div>
        </aside>
      </div>
    </div>
  );
}

function EditorSection({ icon: Icon, title, aside, children }: { icon: typeof CalendarDays; title: string; aside?: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><header className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-[#f0eeff] text-[#5b47df]"><Icon className="size-3.5" /></span><h2 className="text-sm font-semibold tracking-[-0.015em] text-slate-900">{title}</h2></div>{aside && <span className="text-[9px] font-medium text-slate-400">{aside}</span>}</header>{children}</section>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-[10px] font-semibold text-slate-600">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</Label>{children}</div>;
}

function VisibilityCard({ value, selected, title, description, onSelect }: { value: EventVisibility; selected: boolean; title: string; description: string; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={cn("flex items-start gap-2.5 rounded-lg border p-3 text-left transition", selected ? "border-[#8a76eb] bg-[#f3f1ff]" : "border-transparent bg-[#f5f6fb] hover:border-slate-200")}><span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", selected ? "border-[#654fe4]" : "border-slate-300")}>{selected && <span className="size-2 rounded-full bg-[#654fe4]" />}</span><span><span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">{title}{value === "public" && <span className="rounded bg-[#6550e8] px-1 py-0.5 text-[8px] uppercase text-white">Recomendado</span>}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{description}</span></span></button>;
}

function ChannelCard({ mode, current, title, description, icon: Icon, onSelect }: { mode: AppointmentMode; current: AppointmentMode; title: string; description: string; icon: typeof Video; onSelect: () => void }) {
  const active = current === mode;
  return <button type="button" onClick={onSelect} className={cn("min-h-28 rounded-lg border p-3 text-left transition", active ? "border-[#6955e8] bg-[#efedff] ring-1 ring-[#6955e8]" : "border-transparent bg-[#f3f4fb] hover:border-slate-200")}><span className="flex items-center justify-between"><span className={cn("grid size-8 place-items-center rounded-md", active ? "bg-[#5c48dd] text-white" : "bg-white text-slate-600")}><Icon className="size-4" /></span>{active && <Check className="size-3.5 text-[#5c48dd]" />}</span><span className="mt-3 block text-[11px] font-semibold text-slate-800">{title}</span><span className="mt-0.5 block text-[9px] leading-3 text-slate-500">{description}</span></button>;
}

function ReminderRow({ icon: Icon, title, description, checked, onChange }: { icon: typeof CalendarDays; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#f3f4fb] p-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-[#5b47df]"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-slate-800">{title}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[#5b47df]" /></label>;
}

function PublicPreview({ draft, eventLink, days, selectedDate, selectedTime, onDateChange, onTimeChange }: { draft: EditorDraft; eventLink: string; days: Date[]; selectedDate: Date; selectedTime: string; onDateChange: (date: Date) => void; onTimeChange: (time: string) => void }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.06)]"><div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-[#f6f7fb] px-3"><span className="size-2 rounded-full bg-slate-300" /><span className="size-2 rounded-full bg-slate-300" /><span className="size-2 rounded-full bg-slate-300" /><div className="ml-2 flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded bg-white px-2 text-[8px] text-slate-400"><Link2 className="size-2.5" /><span className="truncate">{eventLink.replace(/^https?:\/\//, "")}</span></div><button type="button" onClick={() => window.open(eventLink, "_blank")} className="grid size-6 place-items-center text-slate-400 hover:text-slate-700" aria-label="Abrir página pública"><ExternalLink className="size-3" /></button></div><div className="h-28 bg-gradient-to-br from-[#0f172a] via-[#334155] to-[#7c6be6] bg-cover bg-center" style={draft.coverImage ? { backgroundImage: `url(${draft.coverImage})` } : undefined}><div className="flex h-full items-start justify-end bg-gradient-to-t from-slate-950/25 to-transparent p-3">{draft.price !== null && draft.price > 0 && <span className="rounded-md bg-white/95 px-2 py-1 text-[9px] font-semibold text-slate-800">R$ {draft.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}</div></div><div className="p-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-[#111827] text-[9px] font-semibold text-white">WK</span><div><p className="text-[10px] font-semibold text-slate-800">Sua empresa</p><p className="text-[8px] text-slate-400">Atendimento profissional</p></div></div><h2 className="mt-4 text-base font-semibold tracking-[-0.025em] text-slate-900">{draft.name || "Título do seu evento"}</h2><div className="mt-2 flex flex-wrap gap-1.5"><PreviewChip icon={Clock3} label={formatDuration(draft.durationMinutes)} /><PreviewChip icon={draft.mode === "in_person" ? MapPin : draft.mode === "phone" ? Phone : Video} label={APPOINTMENT_MODE_LABELS[draft.mode]} /><PreviewChip icon={Globe2} label={draft.timezone === "America/Sao_Paulo" ? "GMT-3" : "Fuso local"} /></div><p className="mt-3 line-clamp-3 text-[10px] leading-4 text-slate-500">{stripHtml(draft.description) || "Adicione uma descrição objetiva para explicar como funciona o encontro e o que o cliente deve preparar."}</p></div><div className="border-t border-slate-100 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-semibold text-slate-700">Selecione uma data e horário</p><span className="text-[9px] font-medium capitalize text-slate-500">{format(selectedDate, "MMMM yyyy", { locale: ptBR })}</span></div><div className="grid gap-3 sm:grid-cols-[1fr_92px]"><div><div className="grid grid-cols-7 text-center text-[8px] font-semibold text-slate-400">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-y-0.5">{days.map((day) => <button key={day.toISOString()} type="button" onClick={() => onDateChange(day)} className={cn("grid aspect-square place-items-center rounded text-[8px] text-slate-600", !isSameMonth(day, selectedDate) && "text-slate-300", isSameDay(day, selectedDate) && "bg-[#111827] font-semibold text-white")}>{format(day, "d")}</button>)}</div></div><div className="space-y-1.5">{previewTimes.map((time) => <button key={time} type="button" onClick={() => onTimeChange(time)} className={cn("h-7 w-full rounded-md border text-[9px] font-medium", time === selectedTime ? "border-[#5b47df] bg-[#5b47df] text-white" : "border-slate-100 bg-slate-50 text-slate-700")}>{time}</button>)}</div></div><Button type="button" onClick={() => toast.info("Essa é uma pré-visualização. Publique o evento para receber reservas.")} className="mt-3 h-8 w-full rounded-md bg-[#111827] text-[10px] shadow-none">Confirmar e continuar <ChevronRight className="size-3.5" /></Button></div><div className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-[#fafbfc] py-3 text-[8px] text-slate-400"><CalendarDays className="size-3" />Agendamento protegido pela Weeki</div></div>;
}

function PreviewChip({ icon: Icon, label }: { icon: typeof Clock3; label: string }) {
  return <span className="inline-flex h-5 items-center gap-1 rounded bg-[#f0eeff] px-1.5 text-[8px] font-medium text-[#5a46d8]"><Icon className="size-2.5" />{label}</span>;
}
