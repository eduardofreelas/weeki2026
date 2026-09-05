"use client";

import { useId, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  ImagePlus,
  Link2,
  Plus,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Client, ClientDraft, ClientFile, ClientLink, ClientStatus, ContractKind, PaymentStatus } from "@/features/clients/types";
import { cn } from "@/lib/utils";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const emptyClientDraft = (): ClientDraft => ({
  name: "",
  color: "#7657ff",
  logoUrl: "",
  kind: "company",
  document: "",
  contactName: "",
  contactRole: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  notes: "",
  status: "active",
  segment: "",
  contractValue: 0,
  contractKind: "none",
  nextDueDate: "",
  paymentStatus: "none",
  files: [],
  links: [],
});

const toDraft = (client: Client): ClientDraft => ({
  name: client.name,
  color: client.color,
  logoUrl: client.logoUrl,
  kind: client.kind,
  document: client.document,
  contactName: client.contactName,
  contactRole: client.contactRole,
  email: client.email,
  phone: client.phone,
  website: client.website,
  address: client.address,
  notes: client.notes,
  status: client.status,
  segment: client.segment,
  contractValue: client.contractValue,
  contractKind: client.contractKind,
  nextDueDate: client.nextDueDate,
  paymentStatus: client.paymentStatus,
  files: client.files.map((file) => ({ ...file })),
  links: client.links.map((link) => ({ ...link })),
});

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return <Label className="mb-1.5 block text-[11px] font-semibold text-slate-700">{children}{required && <span className="ml-1 text-[#6d4ce8]">*</span>}</Label>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#6552e8]" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ClientForm({
  client,
  onCancel,
  onSave,
}: {
  client?: Client | null;
  onCancel: () => void;
  onSave: (draft: ClientDraft) => void;
}) {
  const avatarInputId = useId();
  const fileInputId = useId();
  const [draft, setDraft] = useState<ClientDraft>(() => client ? toDraft(client) : emptyClientDraft());
  const [linkInput, setLinkInput] = useState("");

  const update = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const now = new Date().toISOString();
    const files: ClientFile[] = Array.from(fileList).map((file) => ({
      id: makeId(),
      name: file.name,
      size: file.size,
      type: file.type,
      createdAt: now,
    }));
    update("files", [...draft.files, ...files]);
  };

  const selectLogo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem em PNG, JPG ou SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("logoUrl", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const addLink = () => {
    const value = linkInput.trim();
    if (!value) return;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("invalid protocol");
      const label = url.hostname.replace(/^www\./, "").split(".")[0] || "Link";
      const link: ClientLink = { id: makeId(), label: label.charAt(0).toUpperCase() + label.slice(1), url: url.toString() };
      update("links", [...draft.links, link]);
      setLinkInput("");
    } catch {
      toast.error("Insira um link válido começando com http:// ou https://.");
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
  };

  return (
    <div className="mx-auto w-full max-w-[980px] pb-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <button type="button" onClick={onCancel} className="transition hover:text-slate-700">Clientes</button>
            <span>/</span>
            <span className="text-slate-600">{client ? "Editar cadastro" : "Novo cadastro"}</span>
          </div>
          <h1 className="text-[25px] font-bold tracking-[-0.035em] text-slate-900">{client ? "Editar cliente" : "Novo cliente"}</h1>
          <p className="mt-1 text-xs text-slate-500">{client ? "Atualize os dados e mantenha o histórico centralizado." : "Cadastre as informações essenciais para organizar o relacionamento."}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 rounded-md bg-white px-3 text-xs shadow-none"><ArrowLeft className="size-3.5" /> Voltar para lista</Button>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="space-y-6">
          <FormSection title="Dados do cliente" description="Identificação, contato e contexto do relacionamento.">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <label htmlFor={avatarInputId} className="group relative grid size-[72px] shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-[#8d79ec] hover:text-[#6548df]">
                  {/* A origem pode ser um data URL ou endereço fornecido pelo usuário. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {draft.logoUrl ? <img src={draft.logoUrl} alt="Prévia do cliente" className="size-full object-cover" /> : <ImagePlus className="size-5" />}
                  <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full border border-slate-200 bg-white text-[#6548df]"><Plus className="size-3" /></span>
                </label>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Logotipo ou foto do cliente</p>
                  <p className="mt-1 text-[11px] text-slate-400">PNG, JPG ou SVG até 2 MB</p>
                </div>
                <input id={avatarInputId} type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" onChange={(event) => { selectLogo(event.target.files?.[0]); event.target.value = ""; }} />
              </div>

              <div>
                <FieldLabel required>Nome ou razão social</FieldLabel>
                <Input autoFocus value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ex.: Clínica Lumi" className="h-9 rounded-md bg-white px-3 text-xs shadow-none" />
              </div>

              <div>
                <FieldLabel>Tipo de cliente</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "person" as const, label: "Pessoa física", icon: UserRound },
                    { value: "company" as const, label: "Pessoa jurídica", icon: Building2 },
                  ]).map((option) => (
                    <button key={option.value} type="button" onClick={() => update("kind", option.value)} className={cn("focus-ring flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition", draft.kind === option.value ? "border-[#9f8cf1] bg-[#f4f1ff] text-[#6044d7]" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}>
                      <option.icon className="size-3.5" />{option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><FieldLabel>{draft.kind === "company" ? "CNPJ" : "CPF"}</FieldLabel><Input value={draft.document} onChange={(event) => update("document", event.target.value)} placeholder={draft.kind === "company" ? "00.000.000/0001-00" : "000.000.000-00"} className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
                <div><FieldLabel>Responsável</FieldLabel><Input value={draft.contactName} onChange={(event) => update("contactName", event.target.value)} placeholder="Nome do contato" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
                <div><FieldLabel>E-mail</FieldLabel><Input type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="contato@empresa.com" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
                <div><FieldLabel>Telefone / WhatsApp</FieldLabel><Input type="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(00) 00000-0000" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
                <div><FieldLabel>Cargo do responsável</FieldLabel><Input value={draft.contactRole} onChange={(event) => update("contactRole", event.target.value)} placeholder="Ex.: Diretora de Operações" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
                <div><FieldLabel>Segmento</FieldLabel><Input value={draft.segment} onChange={(event) => update("segment", event.target.value)} placeholder="Ex.: Saúde, indústria, turismo" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
              </div>

              <div><FieldLabel>Site</FieldLabel><Input value={draft.website} onChange={(event) => update("website", event.target.value)} placeholder="empresa.com.br" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
              <div><FieldLabel>Endereço</FieldLabel><Input value={draft.address} onChange={(event) => update("address", event.target.value)} placeholder="Rua, número, cidade — UF" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
              <div><FieldLabel>Observações</FieldLabel><Textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Como esse cliente costuma trabalhar..." className="min-h-24 rounded-md px-3 py-2.5 text-xs shadow-none" /></div>
            </div>
          </FormSection>

          <FormSection title="Contrato e acompanhamento" description="Dados rápidos para a visão geral do cliente.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><FieldLabel>Status</FieldLabel><Select value={draft.status} onValueChange={(value) => update("status", value as ClientStatus)}><SelectTrigger className="h-9 w-full rounded-md px-3 text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="negotiating">Em negociação</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent></Select></div>
              <div><FieldLabel>Tipo de contrato</FieldLabel><Select value={draft.contractKind} onValueChange={(value) => update("contractKind", value as ContractKind)}><SelectTrigger className="h-9 w-full rounded-md px-3 text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem contrato</SelectItem><SelectItem value="fixed">Mensal fixo</SelectItem><SelectItem value="one_time">Projeto único</SelectItem></SelectContent></Select></div>
              <div><FieldLabel>Valor</FieldLabel><Input type="number" min="0" step="0.01" value={draft.contractValue || ""} onChange={(event) => update("contractValue", Number(event.target.value || 0))} placeholder="0,00" className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
              <div><FieldLabel>Próximo vencimento</FieldLabel><Input type="date" value={draft.nextDueDate} onChange={(event) => update("nextDueDate", event.target.value)} className="h-9 rounded-md px-3 text-xs shadow-none" /></div>
              <div className="sm:col-span-2"><FieldLabel>Situação do pagamento</FieldLabel><Select value={draft.paymentStatus} onValueChange={(value) => update("paymentStatus", value as PaymentStatus)}><SelectTrigger className="h-9 w-full rounded-md px-3 text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Não informado</SelectItem><SelectItem value="paid">Em dia / Pago</SelectItem><SelectItem value="pending">Pendente</SelectItem><SelectItem value="overdue">Em atraso</SelectItem></SelectContent></Select></div>
            </div>
          </FormSection>

          <FormSection title="Links e arquivos" description="Centralize documentos, propostas e acessos importantes.">
            <div className="grid gap-4 lg:grid-cols-2">
              <label htmlFor={fileInputId} className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 text-center transition hover:border-[#8f7aed] hover:bg-[#faf9ff]">
                <span className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-[#6850df]"><UploadCloud className="size-4" /></span>
                <span className="mt-2 text-xs font-semibold text-slate-700">Selecione arquivos</span>
                <span className="mt-0.5 text-[10px] text-slate-400">PDF, DOCX, PNG ou outros documentos</span>
                <input id={fileInputId} type="file" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                <FieldLabel>Adicionar link rápido</FieldLabel>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1"><Link2 className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={linkInput} onChange={(event) => setLinkInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} placeholder="https://drive.google.com/..." className="h-8 rounded-md pl-8 text-xs shadow-none" /></div>
                  <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-8 rounded-md px-2.5 text-[11px] shadow-none"><Plus className="size-3.5" /> Adicionar</Button>
                </div>
                <div className="mt-3 space-y-1.5">
                  {draft.links.length ? draft.links.map((link) => <div key={link.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"><Link2 className="size-3.5 text-[#6850df]" /><span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">{link.label} · {link.url}</span><button type="button" onClick={() => update("links", draft.links.filter((item) => item.id !== link.id))} className="text-slate-300 hover:text-rose-500" aria-label={`Remover ${link.label}`}><Trash2 className="size-3.5" /></button></div>) : <p className="py-2 text-center text-[11px] text-slate-400">Nenhum link adicionado</p>}
                </div>
              </div>
            </div>

            {draft.files.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{draft.files.map((file) => <div key={file.id} className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-2"><span className="grid size-7 place-items-center rounded-md bg-[#f1efff] text-[#6850df]"><FileText className="size-3.5" /></span><span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-600">{file.name}</span><button type="button" onClick={() => update("files", draft.files.filter((item) => item.id !== file.id))} className="text-slate-300 hover:text-rose-500" aria-label={`Remover ${file.name}`}><Trash2 className="size-3.5" /></button></div>)}</div>}
          </FormSection>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Cliente disponível na operação</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Ao desativar, ele deixa de aparecer nos indicadores principais.</p>
            </div>
            <Switch checked={draft.status !== "inactive"} onCheckedChange={(checked) => update("status", checked ? "active" : "inactive")} className="data-[state=checked]:bg-[#5d49e7] shadow-none" aria-label="Ativar ou desativar cliente" />
          </div>
        </div>

        <footer className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 rounded-md px-3 text-xs text-slate-500">Cancelar</Button>
          <Button type="submit" size="sm" className="h-8 rounded-md bg-[#5542e2] px-3.5 text-xs text-white shadow-none hover:bg-[#4935d1]"><Check className="size-3.5" /> {client ? "Salvar alterações" : "Salvar cliente"}</Button>
        </footer>
      </form>
    </div>
  );
}
