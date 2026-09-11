import { createHash } from "node:crypto";
import { stripHtml } from "../../shared/contracts.js";

function winAnsi(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ]/g, " ");
}

function escapePdfText(value: string) {
  return winAnsi(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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

export function contractPdfChecksum(pdf: Buffer) {
  return createHash("sha256").update(pdf).digest("hex");
}

export function renderContractPdf(input: { title: string; html: string; footer?: string }) {
  const paragraphs = stripHtml(input.html)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = [
    input.title,
    "",
    ...paragraphs.flatMap((paragraph) => wrap(paragraph)),
    "",
    input.footer || "Documento gerado pela Weeki.",
  ];
  const pages: string[][] = [];
  let page: string[] = [];
  for (const line of lines) {
    if (page.length >= 42) {
      pages.push(page);
      page = [];
    }
    page.push(line);
  }
  if (page.length) pages.push(page);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const pageLines of pages) {
    const contentId = objects.length + 2;
    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    contentObjectIds.push(contentId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const stream = [
      "BT",
      "/F1 12 Tf",
      "72 770 Td",
      ...pageLines.map((line, index) => `${index ? "0 -16 Td " : ""}(${escapePdfText(line)}) Tj`),
      "ET",
    ].join("\n");
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const chunks = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
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
