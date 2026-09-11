"use client";

import { Suspense, useEffect, useMemo } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { QuoteDocument } from "@/components/weeki/quote-document";
import { useWeekiClients } from "@/features/clients/use-weeki-clients";
import { useWeekiOperations } from "@/features/operations/use-weeki-operations";
import { useWeekiSettings } from "@/features/settings/use-weeki-settings";

export default function PublicQuotePage() {
  return (
    <Suspense fallback={<PublicQuoteShell />}>
      <PublicQuoteContent />
    </Suspense>
  );
}

function PublicQuoteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { clients } = useWeekiClients();
  const operations = useWeekiOperations();
  const { settings } = useWeekiSettings();

  const quote = useMemo(
    () => operations.quotes.find((item) => item.publicToken === token) ?? null,
    [operations.quotes, token],
  );
  const client = quote
    ? (clients.find((item) => item.id === quote.clientId) ?? null)
    : null;

  useEffect(() => {
    if (
      !quote ||
      quote.viewedAt ||
      ["approved", "rejected", "cancelled"].includes(quote.status)
    )
      return;
    operations.setQuoteStatus(quote.id, "viewed");
  }, [operations, quote]);

  const approve = (acceptedBy: string) => {
    if (!quote) return;
    operations.setQuoteStatus(quote.id, "approved", {
      acceptedBy: acceptedBy || client?.name || "Cliente",
    });
    toast.success("Orçamento aprovado.");
  };

  const reject = (reason: string) => {
    if (!quote) return;
    operations.setQuoteStatus(quote.id, "rejected", {
      rejectionReason: reason,
    });
    toast.success("Recusa registrada.");
  };

  return (
    <main className="min-h-screen bg-[#f4f5f8] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto mb-4 flex max-w-[920px] items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          className="h-8 text-[11px] text-slate-500"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Button>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Aceite comercial de orçamento
        </p>
      </div>

      {quote ? (
        <QuoteDocument
          quote={quote}
          client={client}
          settings={settings}
          quoteSettings={operations.quoteSettings}
          publicMode
          onApprove={approve}
          onReject={reject}
        />
      ) : (
        <section className="mx-auto grid min-h-[70vh] max-w-xl place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div>
            <AlertCircle className="mx-auto size-8 text-amber-500" />
            <h1 className="mt-3 text-lg font-semibold">
              Orçamento não encontrado
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Verifique se o link está completo. Nesta versão local, o orçamento
              precisa existir neste navegador.
            </p>
          </div>
        </section>
      )}
      <Toaster position="bottom-right" richColors />
    </main>
  );
}

function PublicQuoteShell() {
  return (
    <main className="min-h-screen bg-[#f4f5f8] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[70vh] max-w-xl place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div>
          <AlertCircle className="mx-auto size-8 text-slate-300" />
          <h1 className="mt-3 text-lg font-semibold">Carregando orçamento</h1>
        </div>
      </section>
    </main>
  );
}
