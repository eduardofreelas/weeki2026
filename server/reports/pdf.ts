import { createHash } from "node:crypto";
import { REPORT_TYPE_LABELS, stripReportHtml, type WeekiReport } from "../../shared/reports.js";

function cleanPdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function escapePdfText(value: string) {
  return cleanPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, width = 92) {
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

export function reportPdfChecksum(pdf: Buffer) {
  return createHash("sha256").update(pdf).digest("hex");
}

export function renderReportPdf(report: WeekiReport) {
  const lines = [
    report.title,
    report.number,
    REPORT_TYPE_LABELS[report.type],
    `${report.clientName} - ${report.periodStart} a ${report.periodEnd}`,
    "",
    ...report.blocks
      .filter((block) => block.visible)
      .sort((a, b) => a.order - b.order)
      .flatMap((block) => [
        block.title,
        ...wrap(stripReportHtml(block.content || "")),
        ...report.metrics.filter((metric) => block.metricIds.includes(metric.id)).map((metric) => `${metric.label}: ${metric.value}`),
        ...report.sourceSnapshot.activities.filter((activity) => block.activityIds.includes(activity.id)).map((activity) => `${activity.date} - ${activity.title} - ${activity.statusLabel}`),
        "",
      ]),
    report.visual.footer,
  ];

  const pages: string[][] = [];
  let page: string[] = [];
  for (const line of lines) {
    if (page.length >= 44) {
      pages.push(page);
      page = [];
    }
    page.push(line);
  }
  if (page.length) pages.push(page);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const pageLines of pages) {
    const pageId = objects.length + 1;
    const contentId = objects.length + 2;
    pageObjectIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const stream = [
      "BT",
      "/F1 11 Tf",
      "64 780 Td",
      ...pageLines.map((line, index) => `${index ? "0 -15 Td " : ""}(${escapePdfText(line)}) Tj`),
      "ET",
    ].join("\n");
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "latin1"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = Buffer.byteLength(chunks.join(""), "latin1");
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "latin1");
}
