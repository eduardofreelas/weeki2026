"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileClock,
  ReceiptText,
  Save,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/features/clients/types";
import type { WeekiFiscalController } from "@/features/fiscal/use-weeki-fiscal";
import { formatCpfCnpj } from "@/lib/format";
import { FieldLabel, FiscalPanel, InfoNote, SandboxBanner, formatFiscalCurrency } from "./common";

const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface FormState {
  clientId: string;
  serviceConfigId: string;
  description: string;
  amount: string;
  competenceDate: string;
  customerDocument: string;
  customerAddress: string;
  customerZipCode: string;
  customerCity: string;
  customerState: string;
  customerEmail: string;
  serviceCode: string;
  serviceDescription: string;
  incidenceCity: string;
  issRate: string;
}

const initialForm = (): FormState => ({
  clientId: "",
  serviceConfigId: "",
  description: "",
  amount: "",
  competenceDate: format(new Date(), "yyyy-MM-dd"),
  customerDocument: "",
  customerAddress: "",
  customerZipCode: "",
  customerCity: "",
  customerState: "",
  customerEmail: "",
  serviceCode: "",
  serviceDescription: "",
  incidenceCity: "",
  issRate: "",
});

export function FiscalIssue({ controller, clients, onBack, onSettings, onCreated }: { controller: WeekiFiscalController; clients: Client[]; onBack: () => void; onSettings: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [attempted, setAttempted] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(makeId);
  const services = controller.state.serviceConfigs.filter((item) => item.active);
  const selectedClient = clients.find((item) => item.id === form.clientId);
  const selectedService = services.find((item) => item.id === form.serviceConfigId);

  const input = useMemo(() => ({
    idempotencyKey,
    clientId: form.clientId,
    serviceConfigId: form.serviceConfigId,
    description: form.description,
    amount: Number(form.amount || 0),
    competenceDate: form.competenceDate,
    origin: "manual" as const,
    customerOverride: {
      document: form.customerDocument,
      email: form.customerEmail,
      address: {
        street: form.customerAddress,
        zipCode: form.customerZipCode,
        city: form.customerCity,
        state: form.customerState,
      },
    },
    serviceOverride: {
      serviceCode: form.serviceCode,
      fiscalDescription: form.serviceDescription,
      incidenceCity: form.incidenceCity,
      tax: { issRate: Number(form.issRate || 0) },
    },
  }), [form, idempotencyKey]);

  const validation = useMemo(() => controller.validateDraft(input), [controller, input]);

  const selectClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId);
    setAttempted(false);
    setForm((current) => ({
      ...current,
      clientId,
      customerDocument: client?.document ?? "",
      customerAddress: client?.address ?? "",
      customerZipCode: client?.fiscal?.zipCode ?? "",
      customerCity: client?.fiscal?.city ?? "",
      customerState: client?.fiscal?.state ?? "",
      customerEmail: client?.fiscal?.fiscalEmail || client?.email || "",
    }));
  };

  const selectService = (serviceConfigId: string) => {
    const service = services.find((item) => item.id === serviceConfigId);
    setAttempted(false);
    setForm((current) => ({
      ...current,
      serviceConfigId,
      description: service?.fiscalDescription ?? "",
      amount: service?.defaultAmount ? String(service.defaultAmount) : "",
      serviceCode: service?.serviceCode ?? "",
      serviceDescription: service?.fiscalDescription ?? "",
      incidenceCity: service?.incidenceCity ?? "",
      issRate: service ? String(service.tax.issRate) : "",
    }));
  };

  const save = (queued: boolean) => {
    setAttempted(true);
    const result = controller.createDraft(input, queued);
    if (!result.note) {
      toast.error(result.issues.length === 1 ? result.issues[0].message : `Precisamos de ${result.issues.length} informações para preparar esta NFS-e.`);
      return;
    }
    if (result.duplicate) {
      toast.info("Este pedido já foi registrado. Abrimos o registro existente para evitar duplicidade.");
    } else {
      toast.success(queued ? "NFS-e preparada e colocada em espera segura." : "Rascunho de NFS-e salvo.");
    }
    setIdempotencyKey(makeId());
    onCreated(result.note.id);
  };

  const missing = attempted ? validation.issues : [];
  const has = (field: string) => missing.some((issue) => issue.field === field);
  const issuerIssues = missing.filter((issue) => issue.section === "issuer" || issue.section === "certificate");

  return (
    <div className="mx-auto max-w-[1050px] space-y-4">
      <SandboxBanner />
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"><ArrowLeft className="size-3.5" /> Voltar para visão geral</button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <FiscalPanel title="1. Cliente e serviço" description="A Weeki reutiliza os dados já cadastrados e mostra somente o que estiver faltando.">
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div><FieldLabel required>Cliente</FieldLabel><Select value={form.clientId} onValueChange={selectClient}><SelectTrigger className="h-9 rounded-md text-[11px] shadow-none"><UserRound className="size-3.5 text-slate-400" /><SelectValue placeholder="Selecione o cliente" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
              <div><FieldLabel required>Serviço</FieldLabel><Select value={form.serviceConfigId} onValueChange={selectService}><SelectTrigger className="h-9 rounded-md text-[11px] shadow-none"><ReceiptText className="size-3.5 text-slate-400" /><SelectValue placeholder="Selecione o serviço" /></SelectTrigger><SelectContent>{services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}</SelectContent></Select></div>
              {!services.length && <div className="sm:col-span-2"><InfoNote tone="warning">Nenhum serviço fiscal está configurado. <button type="button" onClick={onSettings} className="font-bold underline underline-offset-2">Configurar um serviço</button></InfoNote></div>}
            </div>
          </FiscalPanel>

          <FiscalPanel title="2. Dados da prestação" description="Informações específicas desta nota.">
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div><FieldLabel required>Valor do serviço</FieldLabel><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">R$</span><Input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" className={has("amount") ? "h-9 border-rose-300 pl-9 text-[11px]" : "h-9 pl-9 text-[11px]"} /></div></div>
              <div><FieldLabel required>Data de competência</FieldLabel><Input type="date" value={form.competenceDate} onChange={(event) => setForm((current) => ({ ...current, competenceDate: event.target.value }))} className={has("competenceDate") ? "h-9 border-rose-300 text-[11px]" : "h-9 text-[11px]"} /></div>
              <div className="sm:col-span-2"><FieldLabel required>Descrição do serviço</FieldLabel><Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descreva o serviço prestado" className={has("description") ? "min-h-24 border-rose-300 text-[11px]" : "min-h-24 text-[11px]"} /></div>
            </div>
          </FiscalPanel>

          {attempted && missing.length > 0 && <FiscalPanel title={`Precisamos de ${missing.length} informaç${missing.length === 1 ? "ão" : "ões"} para preparar esta NFS-e`} description="Apenas os campos pendentes aparecem abaixo.">
            <div className="space-y-4 p-4 sm:p-5">
              {issuerIssues.length > 0 && <InfoNote tone="warning"><div className="flex flex-wrap items-center justify-between gap-2"><span>{issuerIssues[0].message}{issuerIssues.length > 1 ? ` e mais ${issuerIssues.length - 1}.` : ""}</span><button type="button" onClick={onSettings} className="font-bold underline underline-offset-2">Corrigir dados da empresa</button></div></InfoNote>}
              <div className="grid gap-4 sm:grid-cols-2">
                {has("customer.document") && <div><FieldLabel required>CPF/CNPJ do cliente</FieldLabel><Input value={form.customerDocument} onChange={(event) => setForm((current) => ({ ...current, customerDocument: formatCpfCnpj(event.target.value) }))} className="h-9 text-[11px]" /></div>}
                {has("customer.address.city") && <div><FieldLabel required>Município do cliente</FieldLabel><Input value={form.customerCity} onChange={(event) => setForm((current) => ({ ...current, customerCity: event.target.value }))} className="h-9 text-[11px]" /></div>}
                {has("customer.address.state") && <div><FieldLabel required>UF do cliente</FieldLabel><Input maxLength={2} value={form.customerState} onChange={(event) => setForm((current) => ({ ...current, customerState: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") }))} className="h-9 text-[11px] uppercase" /></div>}
                {has("service.serviceCode") && <div><FieldLabel required>Código do serviço</FieldLabel><Input value={form.serviceCode} onChange={(event) => setForm((current) => ({ ...current, serviceCode: event.target.value }))} className="h-9 text-[11px]" /></div>}
                {has("service.fiscalDescription") && <div className="sm:col-span-2"><FieldLabel required>Descrição fiscal padrão</FieldLabel><Input value={form.serviceDescription} onChange={(event) => setForm((current) => ({ ...current, serviceDescription: event.target.value }))} className="h-9 text-[11px]" /></div>}
                {has("service.incidenceCity") && <div><FieldLabel required>Município de incidência</FieldLabel><Input value={form.incidenceCity} onChange={(event) => setForm((current) => ({ ...current, incidenceCity: event.target.value }))} className="h-9 text-[11px]" /></div>}
                {has("service.tax.issRate") && <div><FieldLabel required>Alíquota de ISS (%)</FieldLabel><Input type="number" min="0" max="100" step="0.01" value={form.issRate} onChange={(event) => setForm((current) => ({ ...current, issRate: event.target.value }))} className="h-9 text-[11px]" /></div>}
              </div>
            </div>
          </FiscalPanel>}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-[84px] lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card">
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><WandSparkles className="size-3.5" /></span><h2 className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Resumo da emissão</h2></div>
            <dl className="mt-4 space-y-3">
              <div><dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Cliente</dt><dd className="mt-1 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{selectedClient?.name || "Não selecionado"}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Serviço</dt><dd className="mt-1 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{selectedService?.name || "Não selecionado"}</dd></div>
              <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/8"><div><dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Valor</dt><dd className="mt-1 text-base font-bold tracking-[-0.03em] text-slate-900 dark:text-white">{formatFiscalCurrency(Number(form.amount || 0))}</dd></div>{validation.valid ? <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600"><CheckCircle2 className="size-3.5" /> Dados válidos</span> : <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600"><CircleAlert className="size-3.5" /> {validation.issues.length} pendência{validation.issues.length === 1 ? "" : "s"}</span>}</div>
            </dl>
          </section>
          <InfoNote>A emissão real permanece bloqueada. “Preparar para emissão” apenas valida e coloca o registro em espera; não cria DPS, XML, número ou chave fiscal.</InfoNote>
          <div className="grid gap-2">
            <Button type="button" onClick={() => save(true)} className="h-9 rounded-lg bg-[#5944df] text-[10px]"><FileClock className="size-3.5" /> Preparar para emissão <ArrowRight className="ml-auto size-3.5" /></Button>
            <Button type="button" variant="outline" onClick={() => save(false)} className="h-9 rounded-lg bg-white text-[10px] shadow-none"><Save className="size-3.5" /> Salvar como rascunho</Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-card"><p className="flex items-center gap-2 text-[10px] font-bold text-slate-700 dark:text-slate-200"><Building2 className="size-3.5 text-slate-400" /> Prestador</p><p className="mt-2 truncate text-[10px] text-slate-500">{controller.state.profile.legalName || "Dados fiscais não configurados"}</p><p className="mt-0.5 text-[9px] text-slate-400">{controller.state.profile.document || "CPF/CNPJ pendente"}</p></div>
        </aside>
      </div>
    </div>
  );
}
