import type {
  ServiceAvailabilityStatus,
  ServiceChargingUnit,
  ServiceDeadline,
  ServiceDuration,
  ServiceHiringSettings,
  ServicePaymentSettings,
  ServicePricing,
  ServiceStatus,
  StorefrontSettings,
  WeekiServiceDetails,
} from "./types";

export const serviceCategories = [
  "Design",
  "Consultoria",
  "Engenharia",
  "Fotografia",
  "Marketing",
  "Manutenção",
  "Saúde",
  "Beleza",
  "Educação",
  "Digital",
  "Comunicação",
];

export function slugifyService(value: string, fallback = "servico") {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
}

export function publicServiceToken(seed: string) {
  return `wks_${slugifyService(seed).replace(/-/g, "_")}`;
}

export function defaultServicePricing(
  amount = 0,
  unit: ServiceChargingUnit = "project",
): ServicePricing {
  return {
    type: amount > 0 ? "fixed" : "on_request",
    amount,
    unit,
    customUnit: "",
    label: "",
  };
}

export function defaultServiceDeadline(days = 15): ServiceDeadline {
  return {
    value: days,
    unit: "business_days",
    customText: days > 0 ? `${days} dias úteis` : "",
  };
}

export function defaultServiceDuration(
  value = 1,
  unit: ServiceDuration["unit"] = "custom",
  customText = "",
): ServiceDuration {
  return { value, unit, customText };
}

export function defaultHiringSettings(
  type: ServiceHiringSettings["type"] = "request_quote",
): ServiceHiringSettings {
  return {
    type,
    autoCreateClient: true,
    autoCreateDemand: false,
    autoCreateContract: false,
    autoCreateBilling: type === "buy_now" || type === "hire_and_schedule",
    reserveTimeWhenScheduled:
      type === "schedule" || type === "hire_and_schedule",
    intakeTitle: "Conte um pouco sobre o que você precisa",
    confirmationMessage:
      "Recebemos sua solicitação. Em breve entraremos em contato com os próximos passos.",
  };
}

export function defaultPaymentSettings(): ServicePaymentSettings {
  return {
    methods: ["pix"],
    mode: "full",
    depositPercent: 30,
    maxInstallments: 1,
    notes: "Pagamento por checkout seguro do provedor conectado.",
    providerPreference: "default",
    requirePaymentBeforeScheduling: false,
    createChargeAutomatically: false,
  };
}

export function defaultStorefrontSettings(): StorefrontSettings {
  const now = new Date().toISOString();
  return {
    enabled: true,
    slug: "eduardo",
    publicName: "Eduardo Vieira",
    businessName: "Weeki",
    headline:
      "Serviços profissionais com escopo claro, agenda e contratação organizada.",
    about:
      "Use esta vitrine para apresentar serviços, receber solicitações, organizar contratações e manter o histórico comercial dentro da Weeki.",
    logoUrl: "",
    avatarUrl: "",
    coverUrl: "",
    location: "",
    siteUrl: "",
    instagramUrl: "",
    whatsapp: "",
    email: "eduardo@weeki.com.br",
    customDomain: "",
    theme: "minimal",
    accentColor: "#654ce4",
    serviceOrder: [],
    featuredServiceIds: [],
    categories: ["Design", "Digital", "Consultoria", "Comunicação"],
    showPrices: true,
    showRatings: false,
    seoTitle: "Vitrine de Serviços | Weeki",
    seoDescription:
      "Conheça os serviços, veja detalhes e solicite orçamento, agendamento ou contratação.",
    previousSlugs: [],
    updatedAt: now,
  };
}

export function createDefaultServiceDetails(input: {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  defaultPrice?: number;
  unit?: string;
  defaultDurationDays?: number;
  status?: ServiceStatus;
  availabilityStatus?: ServiceAvailabilityStatus;
  slug?: string;
}): WeekiServiceDetails {
  const slug = input.slug || slugifyService(input.name, input.id || "servico");
  const amount = Number.isFinite(input.defaultPrice)
    ? Number(input.defaultPrice)
    : 0;
  const description = input.description || "";
  return {
    slug,
    status: input.status ?? "draft",
    availabilityStatus: input.availabilityStatus ?? "available",
    summary: description.slice(0, 160),
    fullDescription: description ? `<p>${description}</p>` : "",
    coverImage: "",
    gallery: [],
    portfolio: [],
    videos: [],
    links: [],
    pricing: defaultServicePricing(amount, unitFromLegacy(input.unit)),
    variants: [],
    extras: [],
    includedItems: [],
    excludedItems: [],
    deadline: defaultServiceDeadline(input.defaultDurationDays ?? 15),
    duration: defaultServiceDuration(
      input.defaultDurationDays ?? 1,
      "custom",
      input.unit === "hora" ? "1 hora" : "",
    ),
    hiring: defaultHiringSettings("request_quote"),
    payment: defaultPaymentSettings(),
    scheduling: {
      enabled: false,
      durationMinutes: input.unit === "hora" ? 60 : 45,
      bufferMinutes: 15,
      minimumNoticeHours: 24,
      maximumAdvanceDays: 30,
      allowedWeekdays: [1, 2, 3, 4, 5],
      specificHours: ["09:00", "14:00"],
      useWorkspaceAvailability: true,
    },
    faq: [],
    customFields: [],
    serviceTerms: "",
    seo: {
      title: input.name,
      description: description.slice(0, 160),
      imageUrl: "",
      noIndex: false,
    },
    analytics: {
      storefrontViews: 0,
      serviceViews: 0,
      ctaClicks: 0,
      quoteRequests: 0,
      purchases: 0,
      appointments: 0,
      lastViewedAt: null,
    },
    featured: false,
    inStorefront: input.status === "published",
    publicToken: publicServiceToken(slug),
    fiscal: {
      serviceCode: "",
      cnae: "",
      municipalCode: "",
      issRate: 0,
      fiscalDescription: "",
    },
    automations: {
      createDemandOnOrder: false,
      createContractOnPayment: false,
      requestReviewOnCompletion: true,
      suggestNfseOnCompletion: true,
    },
  };
}

function unitFromLegacy(unit?: string): ServiceChargingUnit {
  const normalized = (unit || "").toLocaleLowerCase("pt-BR");
  if (normalized.includes("hora")) return "hour";
  if (normalized.includes("dia")) return "day";
  if (normalized.includes("sess")) return "session";
  if (normalized.includes("mês") || normalized.includes("mes")) return "month";
  if (normalized.includes("página") || normalized.includes("pagina"))
    return "page";
  if (normalized.includes("m²") || normalized.includes("m2"))
    return "square_meter";
  if (normalized.includes("km")) return "km";
  if (normalized.includes("pacote")) return "package";
  if (normalized.includes("projeto")) return "project";
  return "project";
}
