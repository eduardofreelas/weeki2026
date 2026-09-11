"use client";

import { formatBRL, formatDateBR } from "@/lib/format";
import { sanitizeCssUrl } from "@/lib/sanitize";
import {
  REPORT_ACTIVITY_CATEGORY_LABELS,
  REPORT_BLOCK_LABELS,
  REPORT_TYPE_LABELS,
  type ReportActivitySnapshot,
  type ReportBlock,
  type ReportEvidenceSnapshot,
  type ReportMetric,
  type WeekiReport,
} from "@/shared/reports";
import { cn } from "@/lib/utils";

function blockActivities(report: WeekiReport, block: ReportBlock) {
  return report.sourceSnapshot.activities.filter((activity) => block.activityIds.includes(activity.id));
}

function blockEvidence(report: WeekiReport, block: ReportBlock) {
  return report.sourceSnapshot.activities
    .flatMap((activity) => activity.evidences)
    .filter((evidence) => block.evidenceIds.includes(evidence.id));
}

function blockMetrics(report: WeekiReport, block: ReportBlock) {
  return report.metrics.filter((metric) => block.metricIds.includes(metric.id));
}

function LogoMark({ src, label, color }: { src: string; label: string; color: string }) {
  const safeSrc = sanitizeCssUrl(src);
  return (
    <span className="grid size-12 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600">
      {safeSrc ? (
        // User-provided logo URLs are sanitized before rendering.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeSrc} alt="" className="size-full object-cover" />
      ) : (
        <span style={{ color }}>{label.slice(0, 2).toLocaleUpperCase("pt-BR") || "WK"}</span>
      )}
    </span>
  );
}

function MetricGrid({ metrics, color }: { metrics: ReportMetric[]; color: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900" style={{ color }}>{metric.value}</p>
          <p className="mt-1 text-[10px] text-slate-500">{metric.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ActivitiesTable({ activities }: { activities: ReportActivitySnapshot[] }) {
  if (!activities.length) return <p className="text-xs text-slate-400">Nenhuma atividade selecionada.</p>;
  return (
    <div className="week-board-scroll overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[680px] text-left">
        <thead className="bg-slate-50 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2">Atividade</th>
            <th className="px-3 py-2">Categoria</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Responsável</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-[11px] text-slate-600">
          {activities.map((activity) => (
            <tr key={activity.id}>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{formatDateBR(activity.date)}</td>
              <td className="px-3 py-2">
                <p className="font-medium text-slate-800">{activity.title}</p>
                {activity.description && activity.description !== activity.title && <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{activity.description}</p>}
              </td>
              <td className="px-3 py-2">{REPORT_ACTIVITY_CATEGORY_LABELS[activity.category]}</td>
              <td className="px-3 py-2">{activity.statusLabel}</td>
              <td className="px-3 py-2">{activity.responsible || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: ReportEvidenceSnapshot[] }) {
  if (!evidence.length) return <p className="text-xs text-slate-400">Nenhuma evidência selecionada.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {evidence.map((item) => {
        const safeUrl = sanitizeCssUrl(item.url);
        const showImage = safeUrl && (item.kind === "image" || item.kind === "photo" || item.kind === "screenshot");
        return (
          <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {showImage && (
              // User-provided evidence URLs are sanitized before rendering.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={safeUrl} alt="" className="h-36 w-full object-cover" />
            )}
            <div className="p-3">
              <p className="truncate text-xs font-semibold text-slate-800">{item.title}</p>
              <p className="mt-1 text-[10px] capitalize text-slate-400">{item.kind.replace("_", " ")}</p>
              {item.description && <p className="mt-1 text-[10px] leading-4 text-slate-500">{item.description}</p>}
              {safeUrl && <a href={safeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[10px] font-semibold text-[#6548df]">Visualizar</a>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FinancialBlock({ report }: { report: WeekiReport }) {
  const charges = report.sourceSnapshot.financial.charges;
  const transactions = report.sourceSnapshot.financial.transactions;
  const billed = charges.reduce((total, charge) => total + charge.amount, 0);
  const net = transactions.reduce((total, transaction) => total + (transaction.type === "income" ? transaction.amount : -transaction.amount), 0);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Cobranças no período</p><p className="mt-1 text-lg font-semibold text-slate-900">{formatBRL(billed)}</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Saldo financeiro selecionado</p><p className="mt-1 text-lg font-semibold text-slate-900">{formatBRL(net)}</p></div>
      </div>
      {!charges.length && !transactions.length ? (
        <p className="text-xs text-slate-400">Nenhuma informação financeira foi incluída neste relatório.</p>
      ) : (
        <div className="space-y-1.5">
          {charges.map((charge) => <p key={charge.id} className="rounded-md bg-white px-3 py-2 text-[11px] text-slate-600">{charge.code} - {charge.description} - <span className="font-semibold text-slate-900">{formatBRL(charge.amount)}</span></p>)}
          {transactions.map((transaction) => <p key={transaction.id} className="rounded-md bg-white px-3 py-2 text-[11px] text-slate-600">{transaction.description} - <span className="font-semibold text-slate-900">{formatBRL(transaction.amount)}</span></p>)}
        </div>
      )}
    </div>
  );
}

function ReportBlockView({ report, block }: { report: WeekiReport; block: ReportBlock }) {
  const color = report.visual.primaryColor || "#7657ff";
  const content = block.content?.trim();
  if (block.kind === "cover") {
    return (
      <section className="min-h-[360px] rounded-xl bg-slate-950 p-8 text-white" style={{ background: `linear-gradient(135deg, ${color}, #17171c)` }}>
        <div className="flex items-center justify-between gap-4">
          <LogoMark src={report.visual.providerLogoUrl} label={report.visual.companyName} color={color} />
          <LogoMark src={report.visual.clientLogoUrl} label={report.clientName} color={color} />
        </div>
        <div className="mt-20 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">{REPORT_TYPE_LABELS[report.type]}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{report.title}</h1>
          <p className="mt-4 text-base text-white/78">{report.clientName}</p>
          <p className="mt-1 text-sm text-white/62">{formatDateBR(report.periodStart)} a {formatDateBR(report.periodEnd)}</p>
        </div>
        <div className="mt-16 flex flex-wrap items-center gap-3 text-xs text-white/70">
          <span>{report.responsible}</span>
          <span className="size-1 rounded-full bg-white/45" />
          <span>{formatDateBR(new Date().toISOString().slice(0, 10))}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-200 py-6 last:border-b-0">
      <h2 className="text-base font-semibold text-slate-900">{block.title || REPORT_BLOCK_LABELS[block.kind]}</h2>
      {content && <div className="prose prose-slate mt-3 max-w-none text-xs leading-6 text-slate-600 [&_a]:text-[#6548df] [&_h1]:text-lg [&_h2]:text-base [&_p]:my-2" dangerouslySetInnerHTML={{ __html: content }} />}
      {block.kind === "indicators" && <div className="mt-3"><MetricGrid metrics={blockMetrics(report, block)} color={color} /></div>}
      {block.kind === "activities" && <div className="mt-3"><ActivitiesTable activities={blockActivities(report, block)} /></div>}
      {block.kind === "in_progress" && <div className="mt-3"><ActivitiesTable activities={blockActivities(report, block)} /></div>}
      {block.kind === "hours" && <div className="mt-3"><ActivitiesTable activities={blockActivities(report, block)} /></div>}
      {["files", "images", "deliverables", "before_after"].includes(block.kind) && <div className="mt-3"><EvidenceList evidence={blockEvidence(report, block)} /></div>}
      {block.kind === "financial" && <div className="mt-3"><FinancialBlock report={report} /></div>}
      {block.kind === "signature" && (
        <div className="mt-8 max-w-xs border-t border-slate-300 pt-3">
          <p className="text-sm font-semibold text-slate-900">{report.visual.signature || report.responsible}</p>
          <p className="mt-1 text-xs text-slate-500">{report.visual.companyName}</p>
          <p className="mt-1 text-[11px] text-slate-400">{report.visual.contactEmail || report.visual.contactPhone}</p>
        </div>
      )}
    </section>
  );
}

export function ReportPreview({ report, className, publicMode = false }: { report: WeekiReport; className?: string; publicMode?: boolean }) {
  const blocks = report.blocks.filter((block) => block.visible).sort((a, b) => a.order - b.order);
  return (
    <article className={cn("mx-auto w-full max-w-[900px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6", publicMode && "border-transparent shadow-none", className)}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{report.number}</p>
          <p className="mt-1 text-xs text-slate-500">{report.clientName} - {formatDateBR(report.periodStart)} a {formatDateBR(report.periodEnd)}</p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{REPORT_TYPE_LABELS[report.type]}</span>
      </header>
      {blocks.length ? blocks.map((block) => <ReportBlockView key={block.id} report={report} block={block} />) : <div className="grid min-h-40 place-items-center text-center text-xs text-slate-400">Nenhum bloco visível neste relatório.</div>}
      <footer className="pt-5 text-[10px] text-slate-400">{report.visual.footer}</footer>
    </article>
  );
}
