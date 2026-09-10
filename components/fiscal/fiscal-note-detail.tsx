"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpRight,
  Building2,
  CircleAlert,
  Copy,
  Download,
  FileCode2,
  FileText,
  History,
  Link2,
  Mail,
  RefreshCw,
  RotateCcw,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NfseRecord } from "@/shared/fiscal";
import { NFSE_ORIGIN_LABELS } from "@/shared/fiscal";
import { NfseStatusBadge, SandboxBanner, formatFiscalCurrency } from "./common";

const safeDate = (value: string | null, pattern = "dd/MM/yyyy 'às' HH:mm") => {
  if (!value) return "—";
  try { return format(parseISO(value), pattern, { locale: ptBR }); } catch { return "—"; }
};

function DataItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : undefined}><dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt><dd className="mt-1 break-words text-[11px] font-semibold leading-4 text-slate-700 dark:text-slate-200">{value || "—"}</dd></div>;
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card"><h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold text-slate-800 dark:text-slate-100"><span className="grid size-6 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Icon className="size-3.5" /></span>{title}</h3><dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">{children}</dl></section>;
}

export function FiscalNoteDetail({ note, open, onOpenChange, onCancel, onRetry, onNavigateRelated }: { note: NfseRecord | null; open: boolean; onOpenChange: (open: boolean) => void; onCancel: (id: string) => void; onRetry: (id: string) => void; onNavigateRelated?: (area: "clients" | "billing") => void }) {
  const [tab, setTab] = useState("details");
  if (!note) return null;
  const canUseDocuments = note.status === "AUTHORIZED" && note.documents.length > 0;
  const canCancelLocal = ["DRAFT", "PENDING", "REJECTED", "ERROR"].includes(note.status);
  const latestError = note.errors[0];

  const unavailable = (action: string) => toast.info(`${action} ficará disponível após a autorização real da NFS-e.`);
  const copyLink = async () => {
    if (!note.accessKey) return unavailable("O link seguro");
    await navigator.clipboard.writeText(`${window.location.origin}/fiscal/notas/${note.id}`);
    toast.success("Link seguro copiado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-3xl flex-col gap-0 overflow-hidden rounded-xl border-slate-200 bg-[#f7f8fb] p-0 dark:border-white/10 dark:bg-background sm:max-h-[90vh]">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 text-left dark:border-white/10 dark:bg-card sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
            <div><div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-base font-bold tracking-[-0.02em] text-slate-900 dark:text-white">{note.number ? `NFS-e ${note.number}` : "Registro de NFS-e"}</DialogTitle><NfseStatusBadge status={note.status} compact /></div><DialogDescription className="mt-1 text-[10px] text-slate-400">{note.customer.name} · {note.service.name}</DialogDescription></div>
            <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatFiscalCurrency(note.amount)}</p>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 dark:border-white/10 dark:bg-card sm:px-6"><TabsList className="h-11 gap-5 bg-transparent p-0"><TabsTrigger value="details" className="h-11 rounded-none border-b-2 border-transparent bg-transparent px-0 text-[10px] font-bold shadow-none data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:shadow-none"><FileText className="size-3.5" /> Detalhes</TabsTrigger><TabsTrigger value="history" className="h-11 rounded-none border-b-2 border-transparent bg-transparent px-0 text-[10px] font-bold shadow-none data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:shadow-none"><History className="size-3.5" /> Histórico <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-500 dark:bg-white/10">{note.events.length}</span></TabsTrigger></TabsList></div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <TabsContent value="details" className="m-0 space-y-3">
              {note.environment === "sandbox" && <SandboxBanner />}
              {latestError && <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/8 dark:text-rose-200"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="text-[11px] font-bold">Não foi possível emitir a NFS-e</p><p className="mt-1 text-[10px] leading-4 opacity-80">{latestError.userMessage}</p><p className="mt-1 text-[9px] opacity-60">Referência: {latestError.code}</p></div></div>}
              <div className="grid gap-3 lg:grid-cols-2">
                <DetailSection title="Dados da NFS-e" icon={FileText}>
                  <DataItem label="Número" value={note.number} /><DataItem label="Série" value={note.series} /><DataItem label="Chave" value={note.accessKey} wide /><DataItem label="Emissão" value={safeDate(note.issuedAt)} /><DataItem label="Competência" value={safeDate(`${note.competenceDate}T12:00:00`, "dd/MM/yyyy")} /><DataItem label="Município" value={note.municipality} /><DataItem label="Valor" value={formatFiscalCurrency(note.amount)} /><DataItem label="ISS" value={formatFiscalCurrency(note.issAmount)} /><DataItem label="Retenções" value={formatFiscalCurrency(note.withholdingAmount)} /><DataItem label="Descrição" value={note.description} wide />
                </DetailSection>
                <div className="space-y-3">
                  <DetailSection title="Prestador" icon={Building2}><DataItem label="Razão social" value={note.issuer.legalName} wide /><DataItem label="CPF/CNPJ" value={note.issuer.document} /><DataItem label="Inscrição municipal" value={note.issuer.municipalRegistration} /><DataItem label="Município" value={`${note.issuer.address.city}${note.issuer.address.state ? ` — ${note.issuer.address.state}` : ""}`} wide /></DetailSection>
                  <DetailSection title="Tomador" icon={UserRound}><DataItem label="Nome / razão social" value={note.customer.name} wide /><DataItem label="CPF/CNPJ" value={note.customer.document} /><DataItem label="Inscrição municipal" value={note.customer.municipalRegistration} /><DataItem label="Endereço" value={note.customer.address.street} wide /><DataItem label="E-mail" value={note.customer.email} /><DataItem label="Telefone" value={note.customer.phone} /></DetailSection>
                </div>
              </div>
              <DetailSection title="Origem e vínculos" icon={Link2}><DataItem label="Origem" value={NFSE_ORIGIN_LABELS[note.origin]} /><DataItem label="Serviço" value={note.service.name} /><DataItem label="Demanda" value={note.taskId || "Sem vínculo"} /><DataItem label="Cobrança" value={note.chargeId || "Sem vínculo"} /></DetailSection>
            </TabsContent>

            <TabsContent value="history" className="m-0">
              <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-5">
                <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                  {note.events.map((event) => <div key={event.id} className="relative flex gap-4"><span className="relative z-10 mt-0.5 grid size-[15px] shrink-0 place-items-center rounded-full border-[4px] border-white bg-violet-500 dark:border-card" /><div className="min-w-0"><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{event.title}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{event.description}</p><p className="mt-1 text-[9px] text-slate-400">{safeDate(event.createdAt)}</p></div></div>)}
                </div>
              </section>
            </TabsContent>
          </div>
        </Tabs>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-card sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" disabled={!canUseDocuments} onClick={() => unavailable("O DANFSe")} className="h-8 rounded-md px-2.5 text-[9px] shadow-none"><FileText className="size-3.5" /> DANFSe</Button>
            <Button size="sm" variant="outline" disabled={!canUseDocuments} onClick={() => unavailable("O download do PDF")} className="h-8 rounded-md px-2.5 text-[9px] shadow-none"><Download className="size-3.5" /> PDF</Button>
            <Button size="sm" variant="outline" disabled={!canUseDocuments} onClick={() => unavailable("O download do XML")} className="h-8 rounded-md px-2.5 text-[9px] shadow-none"><FileCode2 className="size-3.5" /> XML</Button>
            <Button size="sm" variant="outline" disabled={note.status !== "AUTHORIZED" || !note.customer.email} onClick={() => unavailable("O envio por e-mail")} className="h-8 rounded-md px-2.5 text-[9px] shadow-none"><Mail className="size-3.5" /> Enviar</Button>
            <Button size="sm" variant="ghost" disabled={!note.accessKey} onClick={copyLink} className="h-8 rounded-md px-2.5 text-[9px]"><Copy className="size-3.5" /> Link</Button>
            <div className="ml-auto flex gap-1.5">
              {note.clientId && <Button size="sm" variant="ghost" onClick={() => onNavigateRelated?.("clients")} className="h-8 rounded-md px-2 text-[9px]">Cliente <ArrowUpRight className="size-3" /></Button>}
              {note.chargeId && <Button size="sm" variant="ghost" onClick={() => onNavigateRelated?.("billing")} className="h-8 rounded-md px-2 text-[9px]">Cobrança <ArrowUpRight className="size-3" /></Button>}
              {["REJECTED", "ERROR"].includes(note.status) && <Button size="sm" variant="outline" onClick={() => onRetry(note.id)} className="h-8 rounded-md px-2.5 text-[9px] shadow-none"><RefreshCw className="size-3.5" /> Corrigir e tentar novamente</Button>}
              {note.status === "AUTHORIZED" && <Button size="sm" variant="outline" disabled className="h-8 rounded-md px-2.5 text-[9px] shadow-none"><RotateCcw className="size-3.5" /> Substituir</Button>}
              {canCancelLocal && <Button size="sm" variant="ghost" onClick={() => { onCancel(note.id); onOpenChange(false); }} className="h-8 rounded-md px-2 text-[9px] text-rose-600 hover:bg-rose-50 hover:text-rose-700"><XCircle className="size-3.5" /> Cancelar preparo</Button>}
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
