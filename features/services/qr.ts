import { downloadTextFile } from "./pricing";

export function qrCodeImageUrl(value: string, accentColor = "#111827") {
  const color = accentColor.replace("#", "");
  return `https://quickchart.io/qr?size=360&margin=2&dark=${encodeURIComponent(color)}&light=ffffff&text=${encodeURIComponent(value)}`;
}

export async function downloadQrCodeSvg({
  value,
  filename,
  label,
  accentColor = "#111827",
}: {
  value: string;
  filename: string;
  label: string;
  accentColor?: string;
}) {
  const escapedValue = escapeXml(value);
  const escapedLabel = escapeXml(label);
  const imageUrl = qrCodeImageUrl(value, accentColor);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="480" viewBox="0 0 420 480">
  <rect width="420" height="480" rx="28" fill="#ffffff"/>
  <rect x="30" y="30" width="360" height="360" rx="18" fill="#f8fafc"/>
  <image href="${escapeXml(imageUrl)}" x="42" y="42" width="336" height="336"/>
  <text x="210" y="425" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">${escapedLabel}</text>
  <text x="210" y="450" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" fill="#64748b">${escapedValue}</text>
</svg>`;
  downloadTextFile(`${filename}.svg`, svg, "image/svg+xml;charset=utf-8");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
