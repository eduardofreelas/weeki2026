"use client";

import { useState } from "react";
import { FileClock, Mail, ReceiptText, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WeekiFiscalController } from "@/features/fiscal/use-weeki-fiscal";
import { FieldLabel, InfoNote, formatFiscalCurrency } from "./common";

export function FiscalAutomationDialog({ controller, onOpenFiscal, onOpenSettings }: { controller: WeekiFiscalController; onOpenFiscal: (noteId?: string) => void; onOpenSettings: () => void }) {
  const action = controller.pendingAction;
  if (!action) return null;

  return <FiscalAutomationDialogContent key={`${action.source}:${action.sourceId}`} controller={controller} action={action} onOpenFiscal={onOpenFiscal} onOpenSettings={onOpenSettings} />;
}

function FiscalAutomationDialogContent({ controller, action, onOpenFiscal, onOpenSettings }: { controller: WeekiFiscalController; action: NonNullable<WeekiFiscalController["pendingAction"]>; onOpenFiscal: (noteId?: string) => void; onOpenSettings: () => void }) {
  const services = controller.state.serviceConfigs.filter((item) => item.active);
  const [serviceId, setServiceId] = useState(() => services.length === 1 ? services[0].id : "");
  const [amount, setAmount] = useState(() => action.amount ? String(action.amount) : "");

  const prepare = () => {
    if (!serviceId) return toast.error("Selecione o serviço fiscal.");
    if (Number(amount) <= 0) return toast.error("Informe o valor do serviço.");
    const input = {
      idempotencyKey: `fiscal:${action.source}:${action.sourceId}`,
      clientId: action.clientId,
      serviceConfigId: serviceId,
      description: action.description,
      amount: Number(amount),
      competenceDate: action.competenceDate,
      origin: action.source === "service" ? "service_completion" as const : "payment_confirmed" as const,
      taskId: action.source === "service" ? action.sourceId : null,
      chargeId: action.source === "payment" ? action.sourceId : null,
    };
    const validation = controller.validateDraft(input);
    const result = controller.createDraft(input, validation.valid);
    if (!result.note) return toast.error(result.issues[0]?.message || "Não foi possível preparar a NFS-e.");
    controller.setPendingAction(null);
    toast.success(validation.valid ? "NFS-e preparada e aguardando integração." : `Rascunho salvo com ${validation.issues.length} pendência${validation.issues.length === 1 ? "" : "s"}.`);
    onOpenFiscal(result.note.id);
  };

  return <Dialog open onOpenChange={(open) => !open && controller.setPendingAction(null)}><DialogContent className="w-[calc(100vw-24px)] max-w-md rounded-xl p-0"><DialogHeader className="border-b border-slate-100 px-5 py-4 text-left dark:border-white/8"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><FileClock className="size-4" /></span><div><DialogTitle className="text-sm font-bold">{action.source === "payment" ? "Pagamento confirmado" : "Serviço concluído"}</DialogTitle><DialogDescription className="mt-1 text-[10px] leading-4">A conclusão foi registrada normalmente. Deseja preparar a NFS-e agora?</DialogDescription></div></div></DialogHeader><div className="space-y-4 px-5 py-4"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.025]"><p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{action.title}</p><p className="mt-1 text-[9px] text-slate-400">Valor da origem: {action.amount ? formatFiscalCurrency(action.amount) : "não informado"}</p></div>{services.length ? <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><FieldLabel required>Serviço fiscal</FieldLabel><Select value={serviceId} onValueChange={setServiceId}><SelectTrigger className="h-9 text-[10px] shadow-none"><ReceiptText className="size-3.5 text-slate-400" /><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}</SelectContent></Select></div><div><FieldLabel required>Valor</FieldLabel><Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-9 text-[10px]" /></div><div><FieldLabel>Competência</FieldLabel><Input type="date" value={action.competenceDate} readOnly className="h-9 bg-slate-50 text-[10px]" /></div></div> : <InfoNote tone="warning">Configure pelo menos um serviço fiscal antes de preparar a nota. <button type="button" className="font-bold underline" onClick={() => { controller.setPendingAction(null); onOpenSettings(); }}>Configurar agora</button></InfoNote>}<div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-[9px] text-slate-500 dark:border-white/10 dark:text-slate-400"><Mail className="size-3.5" /> O envio por e-mail ocorrerá somente depois da autorização real.</div></div><DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-white/8 dark:bg-white/[0.02]"><Button variant="ghost" size="sm" onClick={() => controller.setPendingAction(null)} className="h-8 text-[10px]"><X className="size-3.5" /> Agora não</Button><Button size="sm" onClick={prepare} disabled={!services.length} className="h-8 bg-[#5944df] text-[10px]"><Save className="size-3.5" /> Preparar NFS-e</Button></DialogFooter></DialogContent></Dialog>;
}
