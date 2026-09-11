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

type QuoteDocumentContext = {
  quote: Quote;
  client: Client | null;
  settings: WeekiSettings;
  quoteSettings: QuoteSettings;
};

const textEncoder = new TextEncoder();

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function plain(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .trim();
}

function pdfEscape(value: string) {
  return plain(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(value: string, limit: number) {
  const words = plain(stripHtml(value)).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
      continue;
    }
    if (`${line} ${word}`.length > limit) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function unitLabel(quote: Quote, item: Quote["items"][number]) {
  const saved = item.unit ?? "unit";
  return saved === "custom"
    ? item.customUnit || "personalizada"
    : QUOTE_UNIT_LABELS[saved];
}

function paymentSummary(quote: Quote) {
  if (quote.paymentDetails.trim()) return quote.paymentDetails.trim();
  if (quote.paymentCondition === "installments") {
    return `${quote.installments || 1} parcelas.`;
  }
  if (quote.paymentCondition === "down_payment") {
    return `${quote.downPaymentPercent || 0}% na aprovacao e restante conforme combinado.`;
  }
  return quote.paymentMethod || "Conforme combinado.";
}

function safeFileName(value: string) {
  return (
    plain(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 72) || "orcamento"
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function addPdfObject(objects: string[], value: string) {
  objects.push(value);
  return objects.length;
}

function pdfBytes(objects: string[], rootObjectId: number) {
  const offsets = [0];
  let body = "%PDF-1.4\n";
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(textEncoder.encode(body).length);
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = textEncoder.encode(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${rootObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return textEncoder.encode(body);
}

function createQuotePdf({
  quote,
  client,
  settings,
  quoteSettings,
}: QuoteDocumentContext) {
  const objects: string[] = [];
  const pageContents: string[] = [];
  let current = "";
  let y = 790;

  const addPage = () => {
    if (current) pageContents.push(current);
    current = "";
    y = 790;
  };
  const ensure = (height: number) => {
    if (y - height < 56) addPage();
  };
  const text = (
    x: number,
    value: string,
    options: { size?: number; bold?: boolean; leading?: number } = {},
  ) => {
    const size = options.size ?? 10;
    ensure(options.leading ?? size + 7);
    current += `BT /F${options.bold ? 2 : 1} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET\n`;
    y -= options.leading ?? size + 7;
  };
  const at = (
    x: number,
    yPos: number,
    value: string,
    size = 9,
    bold = false,
  ) => {
    current += `BT /F${bold ? 2 : 1} ${size} Tf ${x} ${yPos} Td (${pdfEscape(value)}) Tj ET\n`;
  };
  const rule = () => {
    ensure(12);
    current += `0.86 0.88 0.92 RG 48 ${y} m 548 ${y} l S\n`;
    y -= 14;
  };
  const section = (title: string, value: string) => {
    const content = stripHtml(value);
    if (!content) return;
    ensure(40);
    text(48, title, { size: 11, bold: true, leading: 16 });
    wrap(content, 92).forEach((line) =>
      text(48, line, { size: 9, leading: 13 }),
    );
    y -= 5;
  };

  text(48, settings.profile.businessName || settings.profile.name || "Weeki", {
    size: 16,
    bold: true,
    leading: 20,
  });
  at(400, 792, "ORCAMENTO", 14, true);
  at(400, 774, quote.number, 10);
  at(400, 760, `Versao ${quote.version}`, 9);
  if (quoteSettings.showPhone && settings.profile.phone) {
    text(48, settings.profile.phone, { size: 9, leading: 13 });
  }
  if (settings.profile.email) {
    text(48, settings.profile.email, { size: 9, leading: 13 });
  }
  rule();
  text(48, quote.title, { size: 15, bold: true, leading: 20 });
  text(48, `Status: ${QUOTE_STATUS_LABELS[quote.status]}`, {
    size: 9,
    leading: 13,
  });
  at(340, y + 13, `Emissao: ${formatDateBR(quote.issueDate)}`, 9);
  at(340, y, `Validade: ${formatDateBR(quote.validUntil)}`, 9);
  y -= 10;
  rule();
  text(48, "Cliente", { size: 11, bold: true, leading: 15 });
  text(48, client?.name || "Cliente nao informado", {
    size: 10,
    bold: true,
    leading: 14,
  });
  if (client?.document && quoteSettings.showDocument)
    text(48, client.document, { size: 9, leading: 12 });
  if (client?.email) text(48, client.email, { size: 9, leading: 12 });
  if (client?.phone && quoteSettings.showPhone)
    text(48, client.phone, { size: 9, leading: 12 });
  if (client?.address && quoteSettings.showAddress)
    text(48, client.address, { size: 9, leading: 12 });
  y -= 7;
  rule();
  text(48, "Itens", { size: 11, bold: true, leading: 18 });
  ensure(42);
  current += `0.96 0.97 0.99 rg 48 ${y - 4} 500 20 re f\n`;
  at(56, y, "Descricao", 8, true);
  at(330, y, "Qtd", 8, true);
  at(370, y, "Un.", 8, true);
  at(420, y, "Unitario", 8, true);
  at(492, y, "Subtotal", 8, true);
  y -= 26;
  quote.items.forEach((item, index) => {
    const lines = wrap(
      `${item.name || item.description} ${item.description}`,
      52,
    );
    ensure(20 + lines.length * 12);
    at(56, y, `${index + 1}. ${lines[0]}`, 8.5, true);
    lines
      .slice(1)
      .forEach((line, lineIndex) => at(66, y - 12 * (lineIndex + 1), line, 8));
    at(330, y, String(item.quantity), 8.5);
    at(370, y, unitLabel(quote, item), 8.5);
    at(420, y, formatBRL(item.unitPrice), 8.5);
    at(492, y, formatBRL(quoteItemSubtotal(item)), 8.5);
    y -= Math.max(28, 16 + lines.length * 12);
    current += `0.92 0.94 0.97 RG 48 ${y + 8} m 548 ${y + 8} l S\n`;
  });
  y -= 5;
  const totals = [
    ["Subtotal", formatBRL(quoteSubtotal(quote))],
    ["Desconto", `- ${formatBRL(quoteGeneralDiscount(quote))}`],
    [quote.taxLabel || "Taxas/impostos", formatBRL(quoteTaxTotal(quote))],
    ["Total", formatBRL(quoteTotal(quote))],
  ];
  totals.forEach(([label, value], index) => {
    ensure(18);
    at(
      365,
      y,
      label,
      index === totals.length - 1 ? 11 : 9,
      index === totals.length - 1,
    );
    at(
      470,
      y,
      value,
      index === totals.length - 1 ? 11 : 9,
      index === totals.length - 1,
    );
    y -= 17;
  });
  section("Condicoes de pagamento", paymentSummary(quote));
  section(
    "Prazo e previsao",
    `${quote.estimatedDeadline}${quote.estimatedStartDate ? `\nInicio previsto: ${formatDateBR(quote.estimatedStartDate)}` : ""}${quote.estimatedEndDate ? `\nConclusao prevista: ${formatDateBR(quote.estimatedEndDate)}` : ""}`,
  );
  section("Escopo", quote.scope || quote.description);
  section("Nao incluso", quote.exclusions);
  section("Observacoes", quote.notes);
  section("Termos e condicoes", quote.terms);
  if (quoteSettings.footerText) {
    ensure(30);
    rule();
    text(48, quoteSettings.footerText, { size: 8, leading: 12 });
  }
  if (current) pageContents.push(current);

  const fontRegularId = addPdfObject(
    objects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  const fontBoldId = addPdfObject(
    objects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );
  const pageObjectIds: number[] = [];
  pageContents.forEach((content) => {
    const contentId = addPdfObject(
      objects,
      `<< /Length ${textEncoder.encode(content).length} >>\nstream\n${content}endstream`,
    );
    const pageId = addPdfObject(
      objects,
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageObjectIds.push(pageId);
  });
  const pagesId = addPdfObject(
    objects,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`,
  );
  pageObjectIds.forEach((pageId) => {
    objects[pageId - 1] = objects[pageId - 1].replace(
      "/Parent 0 0 R",
      `/Parent ${pagesId} 0 R`,
    );
  });
  const catalogId = addPdfObject(
    objects,
    `<< /Type /Catalog /Pages ${pagesId} 0 R >>`,
  );
  return pdfBytes(objects, catalogId);
}

function xml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(index: number) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

function worksheetXml(rows: Array<Array<string | number>>) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="8" width="22" customWidth="1"/></cols><sheetData>${rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, cellIndex) => {
            const ref = `${colName(cellIndex)}${rowIndex + 1}`;
            if (typeof cell === "number")
              return `<c r="${ref}"><v>${cell}</v></c>`;
            return `<c r="${ref}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`;
}

function quoteRows({ quote, client }: QuoteDocumentContext) {
  return [
    ["Informações"],
    ["Número", quote.number],
    ["Título", quote.title],
    ["Cliente", client?.name ?? ""],
    ["Data", formatDateBR(quote.issueDate)],
    ["Validade", formatDateBR(quote.validUntil)],
    ["Status", QUOTE_STATUS_LABELS[quote.status]],
    ["Responsável", quote.responsible],
    [],
    ["Itens"],
    [
      "Nome",
      "Descrição",
      "Quantidade",
      "Unidade",
      "Valor unitário",
      "Desconto",
      "Acréscimo",
      "Subtotal",
    ],
    ...quote.items.map((item) => [
      item.name ?? item.description,
      stripHtml(item.description),
      item.quantity,
      unitLabel(quote, item),
      item.unitPrice,
      item.discountType === "percent"
        ? `${item.discountValue ?? 0}%`
        : (item.discountValue ?? item.discount),
      item.addition,
      quoteItemSubtotal(item),
    ]),
    [],
    ["Resumo"],
    ["Subtotal", quoteSubtotal(quote)],
    ["Desconto geral", quoteGeneralDiscount(quote)],
    [quote.taxLabel || "Taxas/impostos", quoteTaxTotal(quote)],
    ["Total", quoteTotal(quote)],
    [],
    ["Condições comerciais"],
    ["Pagamento", paymentSummary(quote)],
    ["Prazo", quote.estimatedDeadline],
    [
      "Início previsto",
      quote.estimatedStartDate ? formatDateBR(quote.estimatedStartDate) : "",
    ],
    [
      "Conclusão prevista",
      quote.estimatedEndDate ? formatDateBR(quote.estimatedEndDate) : "",
    ],
    ["Escopo", stripHtml(quote.scope)],
    ["Não incluso", stripHtml(quote.exclusions)],
    ["Observações", stripHtml(quote.notes)],
    ["Termos", stripHtml(quote.terms)],
  ];
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let index = 0; index < 8; index += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((size, part) => size + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function zip(files: Array<{ name: string; content: string }>) {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file) => {
    const name = textEncoder.encode(file.name);
    const content = textEncoder.encode(file.content);
    const crc = crc32(content);
    const local = concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(content.length),
      uint32(content.length),
      uint16(name.length),
      uint16(0),
      name,
      content,
    ]);
    const centralHeader = concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(content.length),
      uint32(content.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      name,
    ]);
    locals.push(local);
    central.push(centralHeader);
    offset += local.length;
  });
  const centralBytes = concat(central);
  const localBytes = concat(locals);
  const end = concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralBytes.length),
    uint32(localBytes.length),
    uint16(0),
  ]);
  return concat([localBytes, centralBytes, end]);
}

function xlsxBytes(context: QuoteDocumentContext) {
  const files = [
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Orçamento" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml(quoteRows(context)),
    },
  ];
  return zip(files);
}

export function downloadQuotePdf(context: QuoteDocumentContext) {
  const bytes = createQuotePdf(context);
  downloadBlob(
    new Blob([bytes], { type: "application/pdf" }),
    `${safeFileName(context.quote.number)}-${safeFileName(context.quote.title)}.pdf`,
  );
}

export function downloadQuoteXlsx(context: QuoteDocumentContext) {
  const bytes = xlsxBytes(context);
  downloadBlob(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${safeFileName(context.quote.number)}-${safeFileName(context.quote.title)}.xlsx`,
  );
}
