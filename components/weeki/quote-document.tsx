"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/features/clients/types";
import type { Quote, QuoteSettings } from "@/features/operations/types";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_UNIT_LABELS,
  quoteGeneralDiscount,
  quoteItemSubtotal,
  quoteSubtotal,
  quoteTaxTotal,
  quoteTotal,
} from "@/features/operations/types";
import type { WeekiSettings } from "@/features/settings/types";
import { formatBRL, formatDateBR } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

type Props = {
  quote: Quote;
  client: Client | null;
  settings: WeekiSettings;
  quoteSettings: QuoteSettings;
  compact?: boolean;
  publicMode?: boolean;
  onApprove?: (acceptedBy: string) => void;
  onReject?: (reason: string) => void;
};

function unitLabel(item: Quote["items"][number]) {
  return item.unit === "custom"
    ? item.customUnit || "personalizada"
    : QUOTE_UNIT_LABELS[item.unit ?? "unit"];
}

function paymentSummary(quote: Quote) {
  if (quote.paymentDetails.trim()) return quote.paymentDetails;
  if (quote.paymentCondition === "installments") {
    return `${quote.installments || 1} parcelas.`;
  }
  if (quote.paymentCondition === "down_payment") {
    return `${quote.downPaymentPercent || 0}% na aprovação e restante conforme combinado.`;
  }
  return quote.paymentMethod || "Conforme combinado.";
}

function HtmlBlock({ value }: { value: string }) {
  if (!value.trim()) return null;
  return (
    <div
      className="prose prose-sm max-w-none text-[11px] leading-5 text-slate-600 prose-ul:my-1 prose-li:my-0"
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }}
    />
  );
}

export function QuoteDocument({
  quote,
  client,
  settings,
  quoteSettings,
  compact = false,
  publicMode = false,
  onApprove,
  onReject,
}: Props) {
  const [acceptedBy, setAcceptedBy] = useState(
    client?.contactName || client?.name || "",
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const businessName =
    settings.profile.businessName ||
    settings.profile.professionalName ||
    settings.profile.name ||
    "Weeki";
  const initials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "WK";
  const locked = quote.status === "approved" || quote.status === "rejected";

  return (
    <article
      className={cn(
        "mx-auto bg-white text-slate-900 shadow-sm",
        compact
          ? "max-w-[760px] rounded-xl border border-slate-200"
          : "min-h-[980px] w-full max-w-[820px] rounded-sm border border-slate-200",
      )}
    >
      <div className={cn("p-5 sm:p-8", compact && "sm:p-6")}>
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {quoteSettings.showLogo && (
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 text-sm font-semibold text-white">
                {settings.profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.profile.avatarUrl}
                    alt={businessName}
                    className="size-full object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
            )}
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {businessName}
              </h1>
              <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-slate-500">
                {settings.profile.email && <p>{settings.profile.email}</p>}
                {quoteSettings.showPhone && settings.profile.phone && (
                  <p>{settings.profile.phone}</p>
                )}
                {quoteSettings.showAddress &&
                  settings.profile.workDescription && (
                    <p>{settings.profile.workDescription}</p>
                  )}
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Orçamento
            </p>
            <p className="mt-1 text-base font-bold">{quote.number}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Versão {quote.version}
            </p>
            <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              {QUOTE_STATUS_LABELS[quote.status]}
            </span>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 py-6 md:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)]">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {quote.title || "Orçamento sem título"}
            </h2>
            {quote.description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {quote.description}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[11px] md:grid-cols-1">
            <div>
              <dt className="font-semibold uppercase tracking-[0.08em] text-slate-400">
                Emissão
              </dt>
              <dd className="mt-1 text-slate-700">
                {formatDateBR(quote.issueDate)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.08em] text-slate-400">
                Validade
              </dt>
              <dd className="mt-1 text-slate-700">
                {formatDateBR(quote.validUntil)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.08em] text-slate-400">
                Responsável
              </dt>
              <dd className="mt-1 text-slate-700">
                {quote.responsible || settings.profile.name || "Não informado"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-4 border-b border-slate-200 py-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Cliente
            </p>
            <h3 className="mt-2 text-sm font-semibold">
              {client?.name || "Cliente não informado"}
            </h3>
            <div className="mt-2 space-y-0.5 text-[11px] leading-4 text-slate-500">
              {quoteSettings.showDocument && client?.document && (
                <p>{client.document}</p>
              )}
              {client?.email && <p>{client.email}</p>}
              {quoteSettings.showPhone && client?.phone && (
                <p>{client.phone}</p>
              )}
              {quoteSettings.showAddress && client?.address && (
                <p>{client.address}</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Condições
            </p>
            <p className="mt-2 text-[12px] leading-5 text-slate-700">
              {paymentSummary(quote)}
            </p>
          </div>
        </section>

        <section className="py-6">
          <h3 className="text-sm font-semibold">Itens do orçamento</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <div className="hidden grid-cols-[minmax(0,1fr)_72px_82px_110px_110px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:grid">
              <span>Descrição</span>
              <span>Qtd.</span>
              <span>Unidade</span>
              <span>Unitário</span>
              <span className="text-right">Subtotal</span>
            </div>
            <div className="divide-y divide-slate-200">
              {quote.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 px-3 py-3 text-[11px] md:grid-cols-[minmax(0,1fr)_72px_82px_110px_110px]"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {item.name || item.description}
                    </p>
                    {item.description && (
                      <p className="mt-1 leading-4 text-slate-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <p className="text-slate-600">{item.quantity}</p>
                  <p className="text-slate-600">{unitLabel(item)}</p>
                  <p className="text-slate-600">{formatBRL(item.unitPrice)}</p>
                  <p className="font-semibold text-slate-900 md:text-right">
                    {formatBRL(quoteItemSubtotal(item))}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="ml-auto mt-4 w-full max-w-sm space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Subtotal</span>
              <strong>{formatBRL(quoteSubtotal(quote))}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Desconto</span>
              <strong>- {formatBRL(quoteGeneralDiscount(quote))}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">
                {quote.taxLabel || "Taxas/impostos"}
              </span>
              <strong>{formatBRL(quoteTaxTotal(quote))}</strong>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base">
              <span>Total</span>
              <strong>{formatBRL(quoteTotal(quote))}</strong>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-2">
          <Info
            title="Prazo estimado"
            value={
              quote.estimatedDeadline ||
              `${quoteSettings.defaultDeadlineDays} dias`
            }
          />
          <Info
            title="Previsão"
            value={
              [
                quote.estimatedStartDate &&
                  `Início: ${formatDateBR(quote.estimatedStartDate)}`,
                quote.estimatedEndDate &&
                  `Conclusão: ${formatDateBR(quote.estimatedEndDate)}`,
              ]
                .filter(Boolean)
                .join(" · ") || "A combinar"
            }
          />
        </section>

        {(quote.scope || quote.exclusions || quote.notes || quote.terms) && (
          <section className="space-y-5 border-t border-slate-200 pt-6">
            {quote.scope && (
              <DocumentSection title="Escopo">
                <HtmlBlock value={quote.scope} />
              </DocumentSection>
            )}
            {quote.exclusions && (
              <DocumentSection title="Não incluso">
                <HtmlBlock value={quote.exclusions} />
              </DocumentSection>
            )}
            {quote.notes && (
              <DocumentSection title="Observações adicionais">
                <HtmlBlock value={quote.notes} />
              </DocumentSection>
            )}
            {quote.terms && (
              <DocumentSection title="Termos e condições">
                <HtmlBlock value={quote.terms} />
              </DocumentSection>
            )}
          </section>
        )}

        {quoteSettings.showSignature && (
          <section className="mt-10 grid gap-8 sm:grid-cols-2">
            <div className="border-t border-slate-300 pt-2 text-center text-[11px] text-slate-500">
              {businessName}
            </div>
            <div className="border-t border-slate-300 pt-2 text-center text-[11px] text-slate-500">
              {client?.name || "Cliente"}
            </div>
          </section>
        )}

        {quoteSettings.footerText && (
          <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[10px] leading-4 text-slate-400">
            {quoteSettings.footerText}
          </footer>
        )}
      </div>

      {publicMode && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
          {locked ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-center">
              <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {quote.status === "approved"
                  ? "Orçamento aprovado"
                  : "Orçamento recusado"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                O histórico comercial foi preservado na Weeki.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Quem está aprovando
                </span>
                <input
                  value={acceptedBy}
                  onChange={(event) => setAcceptedBy(event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400"
                />
              </label>
              <Button
                type="button"
                onClick={() => onApprove?.(acceptedBy.trim())}
                className="h-9 bg-slate-900 text-xs hover:bg-slate-800"
              >
                <CheckCircle2 className="size-3.5" /> Aprovar orçamento
              </Button>
              <div className="md:w-48">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onReject?.(rejectionReason.trim())}
                  className="h-9 w-full border-rose-200 text-xs text-rose-600 hover:bg-rose-50"
                >
                  <XCircle className="size-3.5" /> Recusar
                </Button>
              </div>
              <Textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Motivo da recusa, opcional"
                className="min-h-16 text-xs md:col-span-3"
              />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DocumentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-[12px] font-medium text-slate-700">{value}</p>
    </div>
  );
}
