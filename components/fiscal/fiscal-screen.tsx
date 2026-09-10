"use client";

import { useMemo, useState } from "react";
import {
  FilePlus2,
  Files,
  LayoutDashboard,
  ReceiptText,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Client } from "@/features/clients/types";
import type { WeekiFiscalController } from "@/features/fiscal/use-weeki-fiscal";
import { cn } from "@/lib/utils";
import { FiscalIssue } from "./fiscal-issue";
import { FiscalNoteDetail } from "./fiscal-note-detail";
import { FiscalNotes } from "./fiscal-notes";
import { FiscalOverview } from "./fiscal-overview";
import { FiscalSettings } from "./fiscal-settings";

export type FiscalView = "overview" | "notes" | "issue" | "settings";

const navigation: Array<{ id: FiscalView; label: string; icon: typeof ReceiptText }> = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "notes", label: "Notas fiscais", icon: Files },
  { id: "issue", label: "Emitir NFS-e", icon: FilePlus2 },
  { id: "settings", label: "Configurações fiscais", icon: Settings2 },
];

export function FiscalScreen({ controller, clients, view, onViewChange, onNavigateArea }: { controller: WeekiFiscalController; clients: Client[]; view: FiscalView; onViewChange: (view: FiscalView) => void; onNavigateArea?: (area: "clients" | "billing") => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNote = useMemo(() => controller.state.notes.find((note) => note.id === selectedId) ?? null, [controller.state.notes, selectedId]);

  const openNote = (id: string) => {
    setSelectedId(id);
    if (view !== "notes") onViewChange("notes");
  };

  const retry = (id: string) => {
    const result = controller.queueNote(id);
    if (result.issues.length) toast.error(`Revise ${result.issues.length} informaç${result.issues.length === 1 ? "ão" : "ões"} antes de tentar novamente.`);
    else toast.info("Registro validado. A transmissão continuará em standby até a integração nacional ser ativada.");
  };

  const cancel = (id: string) => {
    controller.cancelPreparedNote(id);
    toast.success("Preparação cancelada. Nenhuma ação foi enviada ao ambiente fiscal.");
  };

  return (
    <div className="mx-auto w-full max-w-[1540px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><ReceiptText className="size-4" /></span><div><h1 className="text-[23px] font-bold tracking-[-0.035em] text-slate-900 dark:text-white sm:text-[25px]">Fiscal</h1><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">NFS-e simples, conectada aos clientes, serviços e cobranças.</p></div></div>
        {view !== "issue" && <Button size="sm" onClick={() => onViewChange("issue")} className="h-8 rounded-md bg-[#5944df] px-3 text-[10px]"><FilePlus2 className="size-3.5" /> Emitir NFS-e</Button>}
      </div>

      <nav className="week-board-scroll mt-5 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-white/10" aria-label="Seções do módulo Fiscal">
        {navigation.map((item) => <button type="button" key={item.id} onClick={() => onViewChange(item.id)} className={cn("flex h-10 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-[10px] font-bold text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200", view === item.id && "border-violet-600 text-violet-600 dark:text-violet-300")}><item.icon className="size-3.5" /> {item.label}</button>)}
      </nav>

      <div className="mt-4">
        {view === "overview" && <FiscalOverview state={controller.state} onNavigate={onViewChange} onDismissOnboarding={controller.dismissOnboarding} onOpenNote={openNote} />}
        {view === "notes" && <FiscalNotes notes={controller.state.notes} clients={clients} services={controller.state.serviceConfigs} onOpenNote={openNote} onIssue={() => onViewChange("issue")} />}
        {view === "issue" && <FiscalIssue controller={controller} clients={clients} onBack={() => onViewChange("overview")} onSettings={() => onViewChange("settings")} onCreated={openNote} />}
        {view === "settings" && <FiscalSettings controller={controller} />}
      </div>

      <FiscalNoteDetail note={selectedNote} open={Boolean(selectedNote)} onOpenChange={(open) => !open && setSelectedId(null)} onCancel={cancel} onRetry={retry} onNavigateRelated={(area) => { setSelectedId(null); onNavigateArea?.(area); }} />
    </div>
  );
}
