"use client";

import { formatBRL, formatDateBR } from "@/lib/format";
import {
  REPORT_BLOCK_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  stripReportHtml,
  type ReportBlock,
  type WeekiReport,
} from "@/shared/reports";

function asciiPdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function escapePdfText(value: string) {
  return asciiPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, width = 88) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function linesForBlock(report: WeekiReport, block: ReportBlock) {
  const lines: string[] = [block.title || REPORT_BLOCK_LABELS[block.kind]];
  if (block.content) lines.push(...stripReportHtml(block.content).split(/\n+/).flatMap((line) => wrap(line)));

  if (block.kind === "cover") {
    lines.push(report.clientName, `${formatDateBR(report.periodStart)} a ${formatDateBR(report.periodEnd)}`, `Responsavel: ${report.responsible}`);
  }

  if (block.kind === "indicators") {
    const metrics = report.metrics.filter((metric) => block.metricIds.includes(metric.id));
    lines.push(...metrics.map((metric) => `${metric.label}: ${metric.value} (${metric.detail})`));
  }

  if (["activities", "in_progress", "hours"].includes(block.kind)) {
    const activities = report.sourceSnapshot.activities.filter((activity) => block.activityIds.includes(activity.id));
    for (const activity of activities) {
      const estimate = activity.estimateMinutes ? ` - ${Math.round((activity.estimateMinutes / 60) * 10) / 10}h` : "";
      lines.push(`${formatDateBR(activity.date)} - ${activity.title} - ${activity.statusLabel}${estimate}`);
      if (activity.description && activity.description !== activity.title) lines.push(...wrap(activity.description, 82).map((line) => `  ${line}`));
    }
  }

  if (["files", "images", "deliverables", "before_after"].includes(block.kind)) {
    const evidences = report.sourceSnapshot.activities.flatMap((activity) => activity.evidences).filter((evidence) => block.evidenceIds.includes(evidence.id));
    if (!evidences.length) lines.push("Sem evidencias selecionadas.");
    for (const evidence of evidences) lines.push(`- ${evidence.title}${evidence.url ? ` (${evidence.url})` : ""}`);
  }

  if (block.kind === "financial") {
    const charges = report.sourceSnapshot.financial.charges;
    const transactions = report.sourceSnapshot.financial.transactions;
    const billed = charges.reduce((total, charge) => total + charge.amount, 0);
    const net = transactions.reduce((total, transaction) => total + (transaction.type === "income" ? transaction.amount : -transaction.amount), 0);
    lines.push(`Cobrancas no periodo: ${charges.length} - ${formatBRL(billed)}`);
    lines.push(`Saldo financeiro selecionado: ${formatBRL(net)}`);
    for (const charge of charges) lines.push(`${charge.code} - ${charge.description} - ${formatBRL(charge.amount)} - ${charge.status}`);
  }

  if (block.kind === "signature") {
    lines.push(report.visual.signature || report.responsible, report.visual.companyName, report.visual.contactEmail);
  }

  return lines;
}

function renderPdf(lines: string[]) {
  const pages: string[][] = [];
  let page: string[] = [];
  for (const line of lines) {
    if (page.length >= 45) {
      pages.push(page);
      page = [];
    }
    page.push(line);
  }
  if (page.length) pages.push(page);

  const objects: string[] = [];
  const pageIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const pageLines of pages) {
    const pageId = objects.length + 1;
    const contentId = objects.length + 2;
    pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const stream = [
      "BT",
      "/F1 11 Tf",
      "64 780 Td",
      ...pageLines.map((line, index) => `${index ? "0 -15 Td " : ""}(${escapePdfText(line)}) Tj`),
      "ET",
    ].join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }
  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return chunks.join("");
}

function fileNameFor(report: WeekiReport) {
  return `${report.number}-${report.title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90)
    .toLocaleLowerCase("pt-BR");
}

export function downloadReportPdf(report: WeekiReport) {
  const lines = [
    report.title,
    report.number,
    REPORT_TYPE_LABELS[report.type],
    REPORT_STATUS_LABELS[report.status],
    `${report.clientName} - ${formatDateBR(report.periodStart)} a ${formatDateBR(report.periodEnd)}`,
    "",
    ...report.blocks
      .filter((block) => block.visible)
      .sort((a, b) => a.order - b.order)
      .flatMap((block) => [...linesForBlock(report, block), ""]),
    report.visual.footer,
  ];
  const blob = new Blob([renderPdf(lines)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileNameFor(report)}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
