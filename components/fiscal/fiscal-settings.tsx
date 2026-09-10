"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BellRing,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  FileKey2,
  FileText,
  Fingerprint,
  FlaskConical,
  LockKeyhole,
  Mail,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  ServerCog,
  Settings2,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FISCAL_FLAGS } from "@/features/fiscal/config";
import type { WeekiFiscalController } from "@/features/fiscal/use-weeki-fiscal";
import { validateIssuer } from "@/features/fiscal/validation";
import {
  FISCAL_AUTOMATION_LABELS,
  type FiscalAutomationMode,
  type FiscalProfile,
  type FiscalServiceConfig,
  type FiscalTaxRegime,
} from "@/shared/fiscal";
import { formatCpfCnpj, formatPhoneBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FieldLabel, FiscalPanel, InfoNote, SandboxBanner, formatFiscalCurrency } from "./common";

export type FiscalSettingsSection = "company" | "services" | "certificate" | "automation" | "provider";

const sections: Array<{ id: FiscalSettingsSection; label: string; description: string; icon: typeof Building2 }> = [
  { id: "company", label: "Dados fiscais", description: "Empresa e tributação", icon: Building2 },
  { id: "services", label: "Serviços", description: "Regras reutilizáveis", icon: ReceiptText },
  { id: "certificate", label: "Certificado digital", description: "A1 e validade", icon: FileKey2 },
  { id: "automation", label: "Automação", description: "Gatilhos e entregas", icon: BellRing },
  { id: "provider", label: "Integração", description: "Ambiente e provedor", icon: ServerCog },
];

const taxRegimes: Array<{ value: FiscalTaxRegime; label: string }> = [
  { value: "mei", label: "MEI" },
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "presumed_profit", label: "Lucro Presumido" },
  { value: "actual_profit", label: "Lucro Real" },
  { value: "other", label: "Outro" },
];

const emptyService = (): Omit<FiscalServiceConfig, "id" | "createdAt" | "updatedAt"> => ({
  localId: "",
  name: "",
  fiscalDescription: "",
  serviceCode: "",
  taxationCode: "",
  defaultAmount: 0,
  incidenceCity: "",
  incidenceCityCode: "",
  operationNature: "",
  tax: {
    issRate: 0,
    issWithheld: false,
    inssWithheld: false,
    irWithheld: false,
    csllWithheld: false,
    pisWithheld: false,
    cofinsWithheld: false,
    approximateTaxAmount: 0,
  },
  active: true,
});

export function FiscalSettings({ controller, initialSection = "company", embedded = false }: { controller: WeekiFiscalController; initialSection?: FiscalSettingsSection; embedded?: boolean }) {
  const [section, setSection] = useState<FiscalSettingsSection>(initialSection);
  const [profile, setProfile] = useState<FiscalProfile>(controller.state.profile);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [serviceDraft, setServiceDraft] = useState(emptyService);

  const profileIssues = useMemo(() => validateIssuer(profile), [profile]);
  const updateAddress = (key: keyof FiscalProfile["address"], value: string) => setProfile((current) => ({ ...current, address: { ...current.address, [key]: value } }));
  const saveProfile = () => {
    controller.updateProfile(profile);
    toast.success(profileIssues.length ? "Dados fiscais salvos. Algumas informações ainda estão pendentes." : "Dados fiscais atualizados.");
  };
  const openService = (service?: FiscalServiceConfig) => {
    setServiceId(service?.id);
    setServiceDraft(service ? {
      localId: service.localId,
      name: service.name,
      fiscalDescription: service.fiscalDescription,
      serviceCode: service.serviceCode,
      taxationCode: service.taxationCode,
      defaultAmount: service.defaultAmount,
      incidenceCity: service.incidenceCity,
      incidenceCityCode: service.incidenceCityCode,
      operationNature: service.operationNature,
      tax: { ...service.tax },
      active: service.active,
    } : emptyService());
    setServiceOpen(true);
  };
  const saveService = () => {
    if (!serviceDraft.name.trim()) return toast.error("Informe o nome do serviço.");
    controller.saveServiceConfig({ ...serviceDraft, name: serviceDraft.name.trim(), fiscalDescription: serviceDraft.fiscalDescription.trim() }, serviceId);
    setServiceOpen(false);
    toast.success(serviceId ? "Configuração fiscal atualizada." : "Serviço fiscal configurado.");
  };

  return (
    <div className={cn("space-y-4", embedded && "max-w-[1120px]")}>
      <SandboxBanner />
      <div className="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav className="week-board-scroll flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-card lg:sticky lg:top-[84px] lg:block lg:space-y-1" aria-label="Configurações fiscais">
          {sections.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={cn("flex min-w-[155px] shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04] lg:w-full lg:min-w-0", section === item.id && "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200")}><span className={cn("grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400", section === item.id && "bg-white text-violet-600 shadow-sm dark:bg-violet-500/15 dark:text-violet-300")}><item.icon className="size-3.5" /></span><span className="min-w-0"><span className="block truncate text-[10px] font-bold">{item.label}</span><span className="mt-0.5 block truncate text-[8px] text-slate-400">{item.description}</span></span>{section === item.id && <ChevronRight className="ml-auto hidden size-3.5 lg:block" />}</button>)}
        </nav>

        <div className="min-w-0">
          {section === "company" && <FiscalCompanySettings profile={profile} issues={profileIssues} onChange={setProfile} onAddress={updateAddress} onSave={saveProfile} />}
          {section === "services" && <FiscalServicesSettings services={controller.state.serviceConfigs} onAdd={() => openService()} onEdit={openService} onToggle={controller.setServiceActive} />}
          {section === "certificate" && <FiscalCertificateSettings controller={controller} />}
          {section === "automation" && <FiscalAutomationSettings controller={controller} />}
          {section === "provider" && <FiscalProviderSettings />}
        </div>
      </div>

      <ServiceDialog open={serviceOpen} onOpenChange={setServiceOpen} draft={serviceDraft} onChange={setServiceDraft} onSave={saveService} editing={Boolean(serviceId)} />
    </div>
  );
}

function FiscalCompanySettings({ profile, issues, onChange, onAddress, onSave }: { profile: FiscalProfile; issues: ReturnType<typeof validateIssuer>; onChange: (profile: FiscalProfile) => void; onAddress: (key: keyof FiscalProfile["address"], value: string) => void; onSave: () => void }) {
  return <FiscalPanel title="Dados fiscais" description="Configure uma vez. A Weeki reutilizará estas informações em cada emissão." action={issues.length ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{issues.length} pendência{issues.length === 1 ? "" : "s"}</span> : <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="size-3" /> Completo</span>}>
    <div className="space-y-6 p-4 sm:p-5">
      <section><h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold text-slate-700 dark:text-slate-200"><UserRound className="size-3.5 text-violet-500" /> Identificação</h3><div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><FieldLabel>Tipo de pessoa</FieldLabel><div className="flex gap-2">{[{ value: "individual" as const, label: "Pessoa física", icon: UserRound }, { value: "company" as const, label: "Pessoa jurídica", icon: Building2 }].map((option) => <button type="button" key={option.value} onClick={() => onChange({ ...profile, personType: option.value })} className={cn("flex h-9 items-center gap-2 rounded-md border px-3 text-[10px] font-bold transition", profile.personType === option.value ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200" : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-card")}><option.icon className="size-3.5" /> {option.label}</button>)}</div></div>
        <div><FieldLabel required>{profile.personType === "company" ? "CNPJ" : "CPF"}</FieldLabel><Input inputMode="numeric" value={profile.document} onChange={(event) => onChange({ ...profile, document: formatCpfCnpj(event.target.value) })} placeholder={profile.personType === "company" ? "00.000.000/0001-00" : "000.000.000-00"} className="h-9 text-[11px]" /></div>
        <div><FieldLabel>Inscrição municipal</FieldLabel><Input value={profile.municipalRegistration} onChange={(event) => onChange({ ...profile, municipalRegistration: event.target.value })} placeholder="Quando exigida pelo município" className="h-9 text-[11px]" /></div>
        <div><FieldLabel required>Razão social / nome</FieldLabel><Input value={profile.legalName} onChange={(event) => onChange({ ...profile, legalName: event.target.value })} className="h-9 text-[11px]" /></div>
        {profile.personType === "company" && <div><FieldLabel>Nome fantasia</FieldLabel><Input value={profile.tradeName} onChange={(event) => onChange({ ...profile, tradeName: event.target.value })} className="h-9 text-[11px]" /></div>}
        <div><FieldLabel>E-mail fiscal</FieldLabel><Input type="email" value={profile.email} onChange={(event) => onChange({ ...profile, email: event.target.value })} className="h-9 text-[11px]" /></div>
        <div><FieldLabel>Telefone</FieldLabel><Input value={profile.phone} onChange={(event) => onChange({ ...profile, phone: formatPhoneBR(event.target.value) })} className="h-9 text-[11px]" /></div>
      </div></section>

      <section className="border-t border-slate-100 pt-5 dark:border-white/8"><h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold text-slate-700 dark:text-slate-200"><Settings2 className="size-3.5 text-violet-500" /> Tributação</h3><div className="grid gap-4 sm:grid-cols-2">
        <div><FieldLabel required>Regime tributário</FieldLabel><Select value={profile.taxRegime || undefined} onValueChange={(value) => onChange({ ...profile, taxRegime: value as FiscalTaxRegime, mei: value === "mei", simpleNational: ["mei", "simples_nacional"].includes(value) })}><SelectTrigger className="h-9 text-[11px] shadow-none"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{taxRegimes.map((regime) => <SelectItem key={regime.value} value={regime.value}>{regime.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.025]"><label className="flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-600 dark:text-slate-300"><span>Optante pelo Simples Nacional</span><Switch checked={profile.simpleNational} onCheckedChange={(simpleNational) => onChange({ ...profile, simpleNational })} /></label><label className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"><span>Microempreendedor individual</span><Switch checked={profile.mei} onCheckedChange={(mei) => onChange({ ...profile, mei, simpleNational: mei || profile.simpleNational, taxRegime: mei ? "mei" : profile.taxRegime })} /></label></div>
      </div></section>

      <section className="border-t border-slate-100 pt-5 dark:border-white/8"><h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold text-slate-700 dark:text-slate-200"><Building2 className="size-3.5 text-violet-500" /> Endereço fiscal</h3><div className="grid gap-4 sm:grid-cols-6"><div className="sm:col-span-4"><FieldLabel>Logradouro</FieldLabel><Input value={profile.address.street} onChange={(event) => onAddress("street", event.target.value)} className="h-9 text-[11px]" /></div><div className="sm:col-span-2"><FieldLabel>Número</FieldLabel><Input value={profile.address.number} onChange={(event) => onAddress("number", event.target.value)} className="h-9 text-[11px]" /></div><div className="sm:col-span-3"><FieldLabel>Complemento</FieldLabel><Input value={profile.address.complement} onChange={(event) => onAddress("complement", event.target.value)} className="h-9 text-[11px]" /></div><div className="sm:col-span-3"><FieldLabel>Bairro</FieldLabel><Input value={profile.address.district} onChange={(event) => onAddress("district", event.target.value)} className="h-9 text-[11px]" /></div><div className="sm:col-span-2"><FieldLabel>CEP</FieldLabel><Input value={profile.address.zipCode} onChange={(event) => onAddress("zipCode", event.target.value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"))} className="h-9 text-[11px]" /></div><div className="sm:col-span-3"><FieldLabel required>Município</FieldLabel><Input value={profile.address.city} onChange={(event) => onAddress("city", event.target.value)} className="h-9 text-[11px]" /></div><div className="sm:col-span-1"><FieldLabel required>UF</FieldLabel><Input maxLength={2} value={profile.address.state} onChange={(event) => onAddress("state", event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())} className="h-9 text-[11px] uppercase" /></div></div></section>
      {issues.length > 0 && <InfoNote tone="warning">Você pode salvar agora. A emissão permanecerá bloqueada até que as informações obrigatórias sejam concluídas.</InfoNote>}
    </div>
    <footer className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/[0.02] sm:px-5"><Button size="sm" onClick={onSave} className="h-8 bg-[#5944df] text-[10px]"><Save className="size-3.5" /> Salvar dados fiscais</Button></footer>
  </FiscalPanel>;
}

function FiscalServicesSettings({ services, onAdd, onEdit, onToggle }: { services: FiscalServiceConfig[]; onAdd: () => void; onEdit: (service: FiscalServiceConfig) => void; onToggle: (id: string, active: boolean) => void }) {
  return <FiscalPanel title="Configuração fiscal dos serviços" description="Cadastre uma vez e reutilize os dados em todas as notas." action={<Button size="sm" onClick={onAdd} className="h-8 bg-[#5944df] px-3 text-[9px]"><Plus className="size-3.5" /> Novo serviço</Button>}>
    {services.length ? <div className="divide-y divide-slate-100 dark:divide-white/8">{services.map((service) => <div key={service.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><ReceiptText className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">{service.name}</p><span className={service.active ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-bold text-slate-500 dark:bg-white/5"}>{service.active ? "Ativo" : "Inativo"}</span></div><p className="mt-1 truncate text-[9px] text-slate-400">Código {service.serviceCode || "pendente"} · ISS {service.tax.issRate.toLocaleString("pt-BR")}% · {service.incidenceCity || "município pendente"}</p></div><p className="hidden shrink-0 text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300 sm:block">{service.defaultAmount ? formatFiscalCurrency(service.defaultAmount) : "Sem valor padrão"}</p><Switch checked={service.active} onCheckedChange={(checked) => onToggle(service.id, checked)} aria-label={`${service.active ? "Desativar" : "Ativar"} ${service.name}`} /><Button size="icon-sm" variant="ghost" onClick={() => onEdit(service)} aria-label={`Editar ${service.name}`}><Pencil className="size-3.5" /></Button></div>)}</div> : <div className="grid min-h-56 place-items-center p-6 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><ReceiptText className="size-5" /></span><p className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-100">Configure seu primeiro serviço</p><p className="mx-auto mt-1 max-w-sm text-[10px] leading-4 text-slate-400">Descrição, código, alíquota e município serão preenchidos automaticamente nas próximas emissões.</p><Button size="sm" onClick={onAdd} className="mt-4 h-8 bg-[#5944df] text-[10px]"><Plus className="size-3.5" /> Configurar serviço</Button></div></div>}
  </FiscalPanel>;
}

function FiscalCertificateSettings({ controller }: { controller: WeekiFiscalController }) {
  const certificate = controller.state.certificate;
  return <div className="space-y-3"><FiscalPanel title="Certificado digital A1" description="Usado apenas no servidor para assinatura e autenticação fiscal." action={<span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">{certificate ? "Metadados disponíveis" : "Não configurado"}</span>}>
    <div className="p-4 sm:p-5"><div className="grid gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center dark:border-white/15 dark:bg-white/[0.02]"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-white text-violet-600 shadow-sm ring-1 ring-slate-200 dark:bg-card dark:text-violet-300 dark:ring-white/10"><FileKey2 className="size-5" /></span><div><p className="text-xs font-bold text-slate-800 dark:text-slate-100">Armazenamento seguro necessário</p><p className="mx-auto mt-1 max-w-lg text-[10px] leading-4 text-slate-400">O arquivo A1 e sua senha não serão enviados ao frontend nem gravados no banco em texto puro. A ativação exige KMS/Vault e um fluxo server-only.</p></div><Button size="sm" disabled className="mx-auto h-8 text-[9px]"><LockKeyhole className="size-3.5" /> Configurar com cofre seguro</Button></div></div>
  </FiscalPanel><InfoNote tone="warning"><strong>Standby intencional.</strong> A interface está pronta, mas não existe campo de upload inseguro. Quando o cofre for configurado, a Weeki exibirá apenas titular, CPF/CNPJ, validade e status.</InfoNote></div>;
}

function FiscalAutomationSettings({ controller }: { controller: WeekiFiscalController }) {
  const automation = controller.state.automation;
  const update = (values: Partial<typeof automation>) => controller.updateAutomation({ ...automation, ...values });
  return <FiscalPanel title="Automação fiscal" description="Defina quando preparar uma nota e o que fazer após a autorização." action={<Switch checked={automation.enabled} onCheckedChange={(enabled) => update({ enabled })} aria-label="Ativar automação fiscal" />}>
    <div className="space-y-5 p-4 sm:p-5"><div><FieldLabel>Quando emitir NFS-e?</FieldLabel><Select value={automation.mode} onValueChange={(mode) => update({ mode: mode as FiscalAutomationMode })}><SelectTrigger className="h-9 text-[11px] shadow-none"><Clock3 className="size-3.5 text-slate-400" /><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FISCAL_AUTOMATION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><p className="mt-1.5 text-[9px] leading-4 text-slate-400">A conclusão do serviço nunca será bloqueada por uma falha fiscal.</p></div>
      <div className="space-y-1 rounded-lg border border-slate-200 dark:border-white/10">{[
        { key: "sendEmail" as const, label: "Enviar por e-mail", helper: "Depois da autorização", icon: Mail },
        { key: "saveToClient" as const, label: "Salvar nos arquivos do cliente", helper: "Usa referência ao mesmo documento", icon: FileText },
        { key: "attachToService" as const, label: "Anexar ao serviço", helper: "Mantém o vínculo de origem", icon: ReceiptText },
        { key: "attachToCharge" as const, label: "Anexar à cobrança", helper: "Quando houver cobrança relacionada", icon: Fingerprint },
      ].map((item) => <label key={item.key} className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0 dark:border-white/8"><span className="grid size-7 place-items-center rounded-md bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-300"><item.icon className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold text-slate-700 dark:text-slate-200">{item.label}</span><span className="mt-0.5 block text-[8px] text-slate-400">{item.helper}</span></span><Switch checked={automation[item.key]} onCheckedChange={(checked) => update({ [item.key]: checked })} disabled={!automation.enabled} /></label>)}</div>
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 opacity-65 dark:border-white/10 dark:bg-white/[0.02]"><span className="grid size-7 place-items-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><Smartphone className="size-3.5" /></span><div className="flex-1"><p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">WhatsApp</p><p className="mt-0.5 text-[8px] text-slate-400">Integração oficial futura</p></div><span className="rounded-full bg-white px-2 py-1 text-[8px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-card dark:ring-white/10">EM BREVE</span></div>
      {!FISCAL_FLAGS.autoIssueEnabled && <InfoNote>As preferências podem ser salvas agora, mas gatilhos automáticos permanecem em standby pela feature flag <code>NFSE_AUTO_ISSUE_ENABLED</code>.</InfoNote>}
    </div>
  </FiscalPanel>;
}

function FiscalProviderSettings() {
  return <div className="space-y-3"><FiscalPanel title="Provedor fiscal" description="A aplicação depende do contrato FiscalProvider, não de um fornecedor específico.">
    <div className="p-4 sm:p-5"><div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card sm:flex-row sm:items-center"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-white"><BadgeCheck className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-800 dark:text-slate-100">NFS-e Padrão Nacional</p><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">STANDBY</span></div><p className="mt-1 text-[9px] leading-4 text-slate-400">Adapter preparado para DPS, consulta, cancelamento, substituição, PDF, XML, parâmetros e status.</p></div><span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[9px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200"><FlaskConical className="size-3.5" /> Homologação</span></div></div>
  </FiscalPanel><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card"><p className="flex items-center gap-2 text-[10px] font-bold text-slate-700 dark:text-slate-200"><ShieldCheck className="size-3.5 text-emerald-500" /> Segurança</p><ul className="mt-3 space-y-2 text-[9px] leading-4 text-slate-500 dark:text-slate-400"><li>• Segredos somente no servidor</li><li>• Validação e autorização por workspace</li><li>• Idempotência em toda emissão</li><li>• Payload técnico sanitizado nos logs</li></ul></div><div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card"><p className="flex items-center gap-2 text-[10px] font-bold text-slate-700 dark:text-slate-200"><ServerCog className="size-3.5 text-blue-500" /> Ativação pendente</p><ul className="mt-3 space-y-2 text-[9px] leading-4 text-slate-500 dark:text-slate-400"><li>• PostgreSQL e autenticação</li><li>• Cofre KMS/Vault para certificado</li><li>• Credenciamento e homologação</li><li>• Parâmetros oficiais do município</li></ul></div></div></div>;
}

function ServiceDialog({ open, onOpenChange, draft, onChange, onSave, editing }: { open: boolean; onOpenChange: (open: boolean) => void; draft: Omit<FiscalServiceConfig, "id" | "createdAt" | "updatedAt">; onChange: (draft: Omit<FiscalServiceConfig, "id" | "createdAt" | "updatedAt">) => void; onSave: () => void; editing: boolean }) {
  const setTax = (key: keyof typeof draft.tax, value: number | boolean) => onChange({ ...draft, tax: { ...draft.tax, [key]: value } });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-2xl overflow-y-auto rounded-xl p-0"><DialogHeader className="border-b border-slate-100 px-5 py-4 text-left dark:border-white/8"><DialogTitle className="text-sm font-bold">{editing ? "Editar configuração fiscal" : "Novo serviço fiscal"}</DialogTitle><DialogDescription className="text-[10px]">Esses dados serão reutilizados nas próximas notas.</DialogDescription></DialogHeader><div className="space-y-5 px-5 py-4"><div className="grid gap-4 sm:grid-cols-2"><div><FieldLabel required>Nome do serviço</FieldLabel><Input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="Ex.: Desenvolvimento de site" className="h-9 text-[11px]" /></div><div><FieldLabel>Valor padrão</FieldLabel><Input type="number" min="0" step="0.01" value={draft.defaultAmount || ""} onChange={(event) => onChange({ ...draft, defaultAmount: Number(event.target.value || 0) })} className="h-9 text-[11px]" /></div><div className="sm:col-span-2"><FieldLabel required>Descrição fiscal padrão</FieldLabel><Textarea value={draft.fiscalDescription} onChange={(event) => onChange({ ...draft, fiscalDescription: event.target.value })} className="min-h-20 text-[11px]" /></div><div><FieldLabel required>Código do serviço</FieldLabel><Input value={draft.serviceCode} onChange={(event) => onChange({ ...draft, serviceCode: event.target.value })} placeholder="Conforme lista aplicável" className="h-9 text-[11px]" /></div><div><FieldLabel>Código tributário</FieldLabel><Input value={draft.taxationCode} onChange={(event) => onChange({ ...draft, taxationCode: event.target.value })} className="h-9 text-[11px]" /></div><div><FieldLabel required>Município de incidência</FieldLabel><Input value={draft.incidenceCity} onChange={(event) => onChange({ ...draft, incidenceCity: event.target.value })} className="h-9 text-[11px]" /></div><div><FieldLabel>Natureza da operação</FieldLabel><Input value={draft.operationNature} onChange={(event) => onChange({ ...draft, operationNature: event.target.value })} placeholder="Quando aplicável" className="h-9 text-[11px]" /></div><div><FieldLabel>Alíquota de ISS (%)</FieldLabel><Input type="number" min="0" max="100" step="0.01" value={draft.tax.issRate} onChange={(event) => setTax("issRate", Number(event.target.value || 0))} className="h-9 text-[11px]" /></div></div><div><p className="mb-2 text-[10px] font-bold text-slate-600 dark:text-slate-300">Retenções</p><div className="grid gap-2 sm:grid-cols-3">{[{ key: "issWithheld" as const, label: "ISS retido" }, { key: "inssWithheld" as const, label: "INSS" }, { key: "irWithheld" as const, label: "IR" }, { key: "csllWithheld" as const, label: "CSLL" }, { key: "pisWithheld" as const, label: "PIS" }, { key: "cofinsWithheld" as const, label: "COFINS" }].map((item) => <label key={item.key} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">{item.label}<Switch checked={draft.tax[item.key]} onCheckedChange={(checked) => setTax(item.key, checked)} /></label>)}</div></div><InfoNote>Os códigos e regras devem ser confirmados com a contabilidade e com os parâmetros oficiais do município antes da emissão real.</InfoNote></div><DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-white/8 dark:bg-white/[0.02]"><Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-[10px]">Cancelar</Button><Button size="sm" onClick={onSave} className="h-8 bg-[#5944df] text-[10px]"><Save className="size-3.5" /> Salvar serviço</Button></DialogFooter></DialogContent></Dialog>;
}
