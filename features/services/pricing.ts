import type { Service } from "@/features/operations/types";
import type {
  ServiceExtra,
  ServiceHiringType,
  ServiceOrderExtraSnapshot,
  ServicePricing,
  ServiceVariant,
  StorefrontSettings,
} from "./types";
import {
  SERVICE_HIRING_LABELS,
  SERVICE_PRICING_LABELS,
  SERVICE_UNIT_LABELS,
} from "./types";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatServiceMoney(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

export function formatServiceUnit(
  pricing: Pick<ServicePricing, "unit" | "customUnit">,
) {
  return pricing.unit === "custom"
    ? pricing.customUnit || "unidade"
    : SERVICE_UNIT_LABELS[pricing.unit];
}

export function serviceBaseAmount(service: Service, planId?: string | null) {
  const selected = planId
    ? service.variants.find((variant) => variant.id === planId)
    : null;
  if (selected) return selected.price;
  if (service.pricing.type === "free" || service.pricing.type === "on_request")
    return 0;
  return service.pricing.amount || service.defaultPrice || 0;
}

export function formatServicePrice(service: Service) {
  if (service.pricing.type === "on_request") return "Sob consulta";
  if (service.pricing.type === "free") return "Gratuito";
  const amount = formatServiceMoney(
    service.pricing.amount || service.defaultPrice,
  );
  if (service.pricing.type === "starting_at") return `A partir de ${amount}`;
  if (service.pricing.type === "unit")
    return `${amount} / ${formatServiceUnit(service.pricing)}`;
  return amount;
}

export function serviceCtaLabel(type: ServiceHiringType) {
  if (type === "buy_now") return "Comprar agora";
  if (type === "request_quote") return "Solicitar orçamento";
  if (type === "schedule") return "Agendar";
  if (type === "hire_and_schedule") return "Contratar e agendar";
  if (type === "contact") return "Entrar em contato";
  return SERVICE_HIRING_LABELS[type];
}

export function servicePricingSummary(service: Service) {
  return `${SERVICE_PRICING_LABELS[service.pricing.type]} · ${formatServicePrice(service)}`;
}

export function calculateServiceCheckoutTotal({
  service,
  planId,
  extras,
}: {
  service: Service;
  planId?: string | null;
  extras?: Array<{ id: string; quantity: number }>;
}) {
  const selectedExtras = new Map(
    (extras ?? []).map((extra) => [extra.id, Math.max(0, extra.quantity)]),
  );
  const base = serviceBaseAmount(service, planId);
  const requiredExtras = service.extras.filter((extra) => extra.required);
  const optionalExtras = service.extras.filter((extra) =>
    selectedExtras.has(extra.id),
  );
  const uniqueExtras = [...requiredExtras, ...optionalExtras].filter(
    (extra, index, items) =>
      items.findIndex((item) => item.id === extra.id) === index,
  );
  const extrasTotal = uniqueExtras.reduce((total, extra) => {
    const quantity = extra.required
      ? Math.max(1, selectedExtras.get(extra.id) ?? 1)
      : Math.max(0, selectedExtras.get(extra.id) ?? 0);
    return total + extra.price * quantity;
  }, 0);
  return base + extrasTotal;
}

export function snapshotSelectedExtras(
  service: Service,
  extras: Array<{ id: string; quantity: number }>,
): ServiceOrderExtraSnapshot[] {
  const selected = new Map(extras.map((extra) => [extra.id, extra.quantity]));
  return service.extras
    .filter((extra) => extra.required || selected.has(extra.id))
    .map((extra) => ({
      id: extra.id,
      name: extra.name,
      price: extra.price,
      quantity: extra.required
        ? Math.max(1, selected.get(extra.id) ?? 1)
        : Math.max(1, selected.get(extra.id) ?? 1),
    }));
}

export function storefrontPath(settings: Pick<StorefrontSettings, "slug">) {
  return `/vitrine?slug=${encodeURIComponent(settings.slug)}`;
}

export function servicePath(
  settings: Pick<StorefrontSettings, "slug">,
  service: Pick<Service, "slug">,
) {
  return `${storefrontPath(settings)}&service=${encodeURIComponent(service.slug)}`;
}

export function publicUrlForPath(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function servicePublicUrl(
  settings: Pick<StorefrontSettings, "slug">,
  service: Pick<Service, "slug">,
) {
  return publicUrlForPath(servicePath(settings, service));
}

export function storefrontPublicUrl(
  settings: Pick<StorefrontSettings, "slug">,
) {
  return publicUrlForPath(storefrontPath(settings));
}

export function servicePlanLabel(variant?: ServiceVariant | null) {
  return variant?.name || "Plano padrão";
}

export function describeServiceExtras(extras: ServiceExtra[]) {
  if (!extras.length) return "Sem extras selecionados";
  return extras.map((extra) => extra.name).join(", ");
}

export function downloadTextFile(
  filename: string,
  content: string,
  type: string,
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
