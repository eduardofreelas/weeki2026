"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarClock,
  Check,
  ExternalLink,
  Link2,
  MapPin,
  MessageCircle,
  Play,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Service, StorefrontSettings } from "@/features/operations/types";
import {
  SERVICE_AVAILABILITY_LABELS,
  SERVICE_HIRING_LABELS,
} from "@/features/services/types";
import {
  formatServicePrice,
  formatServiceUnit,
  serviceCtaLabel,
} from "@/features/services/pricing";
import { sanitizeCssUrl, sanitizeRichHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

export function ServiceStorefront({
  services,
  settings,
  selectedService,
  onSelectService,
  onBack,
  onPrimaryAction,
  onShareStorefront,
  onShareService,
  compact = false,
}: {
  services: Service[];
  settings: StorefrontSettings;
  selectedService?: Service | null;
  onSelectService?: (service: Service) => void;
  onBack?: () => void;
  onPrimaryAction?: (service: Service) => void;
  onShareStorefront?: () => void;
  onShareService?: (service: Service) => void;
  compact?: boolean;
}) {
  const [category, setCategory] = useState("all");
  const publishedServices = useMemo(
    () =>
      services
        .filter(
          (service) =>
            service.status === "published" &&
            service.inStorefront &&
            service.availabilityStatus !== "unavailable",
        )
        .sort((a, b) => {
          const orderA = settings.serviceOrder.indexOf(a.id);
          const orderB = settings.serviceOrder.indexOf(b.id);
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          if (orderA !== -1 || orderB !== -1) {
            return (
              (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
            );
          }
          return a.name.localeCompare(b.name, "pt-BR");
        }),
    [services, settings.serviceOrder],
  );
  const categories = Array.from(
    new Set([
      ...settings.categories,
      ...publishedServices.map((service) => service.category).filter(Boolean),
    ]),
  );
  const filteredServices =
    category === "all"
      ? publishedServices
      : publishedServices.filter((service) => service.category === category);

  if (selectedService) {
    return (
      <ServiceDetailPage
        service={selectedService}
        settings={settings}
        onBack={onBack}
        onPrimaryAction={onPrimaryAction}
        onShare={onShareService}
        compact={compact}
      />
    );
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-slate-900 shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
        compact && "rounded-2xl shadow-none",
      )}
    >
      <section
        className={cn(
          "relative isolate min-h-[320px] overflow-hidden bg-slate-950 px-6 py-7 text-white sm:px-8",
          compact && "min-h-[230px] px-5 py-5",
        )}
      >
        {settings.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sanitizeCssUrl(settings.coverUrl)}
            alt=""
            className="absolute inset-0 -z-20 size-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,#7657ff,transparent_34%),linear-gradient(135deg,#111827,#020617_68%,#312e81)]" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/15" />
        <div className="flex items-center justify-between gap-3">
          <Identity settings={settings} compact={compact} />
          <div className="flex items-center gap-2">
            {settings.location && (
              <span className="hidden items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur sm:inline-flex">
                <MapPin className="size-3" /> {settings.location}
              </span>
            )}
            {onShareStorefront && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onShareStorefront}
                className="h-8 rounded-full bg-white/12 px-3 text-xs text-white hover:bg-white/20"
              >
                <Share2 className="size-3.5" /> Compartilhar
              </Button>
            )}
          </div>
        </div>
        <div className="mt-12 max-w-3xl">
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Vitrine de Serviços
          </p>
          <h1
            className={cn(
              "mt-4 text-4xl font-semibold tracking-tight sm:text-6xl",
              compact && "text-3xl sm:text-4xl",
            )}
          >
            {settings.headline || "Serviços profissionais sob medida."}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
            {settings.about}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {settings.whatsapp && (
              <ContactPill icon={MessageCircle} label={settings.whatsapp} />
            )}
            {settings.email && (
              <ContactPill icon={Link2} label={settings.email} />
            )}
            {settings.siteUrl && (
              <a
                href={settings.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80"
              >
                Site <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Serviços publicados
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Escolha como quer começar
            </h2>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            <CategoryButton
              active={category === "all"}
              label="Todos"
              onClick={() => setCategory("all")}
            />
            {categories.map((item) => (
              <CategoryButton
                key={item}
                active={category === item}
                label={item}
                onClick={() => setCategory(item)}
              />
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredServices.map((service) => (
            <ServicePublicCard
              key={service.id}
              service={service}
              settings={settings}
              onClick={() => onSelectService?.(service)}
            />
          ))}
          {!filteredServices.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
              Nenhum serviço publicado nesta categoria.
            </div>
          )}
        </div>
      </section>
    </article>
  );
}

function ServiceDetailPage({
  service,
  settings,
  onBack,
  onPrimaryAction,
  onShare,
  compact,
}: {
  service: Service;
  settings: StorefrontSettings;
  onBack?: () => void;
  onPrimaryAction?: (service: Service) => void;
  onShare?: (service: Service) => void;
  compact?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-slate-900 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <section className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="relative min-h-[360px] bg-slate-950">
          <ServiceImage
            service={service}
            className="absolute inset-0 size-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mb-5 text-xs font-semibold text-white/70 hover:text-white"
              >
                ← Voltar para a vitrine
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-semibold">
                {service.category}
              </span>
              {service.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900">
                  <Sparkles className="size-3" /> Destaque
                </span>
              )}
            </div>
            <h1
              className={cn(
                "mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl",
                compact && "text-3xl sm:text-4xl",
              )}
            >
              {service.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
              {service.summary || service.description}
            </p>
          </div>
        </div>
        <aside className="border-l border-slate-100 bg-slate-50/70 p-5 sm:p-7">
          <Identity settings={settings} dark />
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Investimento
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatServicePrice(service)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {service.deadline.customText ||
                `Prazo estimado: ${service.deadline.value} ${service.deadline.unit}`}
            </p>
            <Button
              type="button"
              size="lg"
              onClick={() => onPrimaryAction?.(service)}
              className="mt-5 h-11 w-full rounded-full"
              style={{ backgroundColor: settings.accentColor }}
            >
              {serviceCtaLabel(service.hiring.type)}
            </Button>
            <div className="mt-3 flex gap-2">
              {onShare && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onShare(service)}
                  className="h-9 flex-1 rounded-full text-xs"
                >
                  <Share2 className="size-3.5" /> Compartilhar
                </Button>
              )}
              <span className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-slate-200 text-xs font-medium text-slate-500">
                {SERVICE_AVAILABILITY_LABELS[service.availabilityStatus]}
              </span>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
            <strong className="text-slate-800">Como funciona:</strong>{" "}
            {SERVICE_HIRING_LABELS[service.hiring.type]}.{" "}
            {service.payment.notes ||
              "O pagamento usa checkout seguro do provedor conectado."}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-7">
          <PublicSection title="Descrição">
            <div
              className="prose prose-sm max-w-none text-slate-600 prose-li:my-0"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichHtml(
                  service.fullDescription || `<p>${service.description}</p>`,
                ),
              }}
            />
          </PublicSection>

          {!!service.variants.length && (
            <PublicSection title="Planos e opções">
              <div className="grid gap-3 sm:grid-cols-2">
                {service.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className={cn(
                      "rounded-2xl border border-slate-200 p-4",
                      variant.highlighted &&
                        "border-violet-200 bg-violet-50/40",
                    )}
                  >
                    <p className="text-sm font-semibold">{variant.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {variant.description}
                    </p>
                    <p className="mt-3 text-xl font-semibold">
                      {formatServicePrice({
                        ...service,
                        pricing: {
                          ...service.pricing,
                          type: "fixed",
                          amount: variant.price,
                        },
                      })}
                    </p>
                    {!!variant.includedItems.length && (
                      <ul className="mt-3 space-y-1 text-xs text-slate-500">
                        {variant.includedItems.map((item) => (
                          <li key={item} className="flex gap-2">
                            <Check className="mt-0.5 size-3 text-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </PublicSection>
          )}

          {!!service.extras.length && (
            <PublicSection title="Extras disponíveis">
              <div className="grid gap-3 sm:grid-cols-2">
                {service.extras.map((extra) => (
                  <div
                    key={extra.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <p className="text-sm font-semibold">{extra.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {extra.description}
                    </p>
                    <p className="mt-3 text-sm font-semibold">
                      +{" "}
                      {formatServicePrice({
                        ...service,
                        pricing: {
                          ...service.pricing,
                          type: "fixed",
                          amount: extra.price,
                        },
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </PublicSection>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <PublicSection title="O que está incluso">
              <Checklist
                items={service.includedItems}
                empty="Itens inclusos serão combinados no orçamento."
              />
            </PublicSection>
            <PublicSection title="Não incluso">
              <Checklist
                items={service.excludedItems}
                empty="Nenhuma exclusão cadastrada."
                muted
              />
            </PublicSection>
          </div>

          {!!service.portfolio.length && (
            <PublicSection title="Portfólio">
              <div className="grid gap-4 sm:grid-cols-2">
                {service.portfolio.map((item) => (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-slate-200"
                  >
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sanitizeCssUrl(item.imageUrl)}
                        alt={item.title}
                        className="h-40 w-full object-cover"
                      />
                    )}
                    <div className="p-4">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.description}
                      </p>
                      {item.result && (
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          Resultado: {item.result}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </PublicSection>
          )}

          {!!service.videos.length && (
            <PublicSection title="Vídeos">
              <div className="grid gap-4 sm:grid-cols-2">
                {service.videos.map((video) => (
                  <article
                    key={video.id}
                    className="overflow-hidden rounded-2xl border border-slate-200"
                  >
                    {video.embedUrl ? (
                      <iframe
                        src={video.embedUrl}
                        title={video.title}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex aspect-video items-center justify-center bg-slate-100 text-slate-500"
                      >
                        <Play className="size-6" />
                      </a>
                    )}
                    <p className="p-3 text-xs font-semibold">{video.title}</p>
                  </article>
                ))}
              </div>
            </PublicSection>
          )}
        </div>

        <aside className="space-y-4">
          <PublicSection title="Prazo e duração">
            <div className="space-y-3 text-sm">
              <InfoLine
                label="Prazo"
                value={
                  service.deadline.customText ||
                  `${service.deadline.value} ${service.deadline.unit}`
                }
              />
              <InfoLine
                label="Duração"
                value={
                  service.duration.customText ||
                  `${service.duration.value} ${service.duration.unit}`
                }
              />
              {service.scheduling.enabled && (
                <InfoLine
                  label="Agenda"
                  value={`${service.scheduling.durationMinutes} min · antecedência mínima ${service.scheduling.minimumNoticeHours}h`}
                />
              )}
            </div>
          </PublicSection>

          {!!service.faq.length && (
            <PublicSection title="Perguntas frequentes">
              <div className="space-y-2">
                {service.faq.map((faq) => (
                  <details
                    key={faq.id}
                    className="rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <summary className="cursor-pointer text-xs font-semibold">
                      {faq.question}
                    </summary>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </PublicSection>
          )}

          {!!service.links.length && (
            <PublicSection title="Links relacionados">
              <div className="space-y-2">
                {service.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50"
                  >
                    {link.label}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            </PublicSection>
          )}

          {service.serviceTerms && (
            <PublicSection title="Termos do serviço">
              <p className="text-xs leading-5 text-slate-500">
                {service.serviceTerms}
              </p>
            </PublicSection>
          )}
        </aside>
      </section>
    </article>
  );
}

function ServicePublicCard({
  service,
  settings,
  onClick,
}: {
  service: Service;
  settings: StorefrontSettings;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="relative h-56 overflow-hidden bg-slate-100">
        <ServiceImage service={service} className="size-full" />
        {service.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">
            Destaque
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {service.category}
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            {service.duration.customText ||
              `${service.duration.value} ${formatServiceUnit(service.pricing)}`}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-900">
          {service.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
          {service.summary || service.description}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-900">
            {settings.showPrices ? formatServicePrice(service) : "Consulte"}
          </span>
          <span
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: settings.accentColor }}
          >
            Ver detalhes
          </span>
        </div>
      </div>
    </button>
  );
}

function Identity({
  settings,
  dark = false,
  compact = false,
}: {
  settings: StorefrontSettings;
  dark?: boolean;
  compact?: boolean;
}) {
  const name = settings.publicName || settings.businessName || "Profissional";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "WK";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-2xl font-semibold",
          compact ? "size-10 text-sm" : "size-12 text-base",
          dark ? "bg-slate-900 text-white" : "bg-white/16 text-white",
        )}
        style={dark ? { backgroundColor: settings.accentColor } : undefined}
      >
        {settings.logoUrl || settings.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sanitizeCssUrl(settings.logoUrl || settings.avatarUrl)}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            dark ? "text-slate-900" : "text-white",
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            "block truncate text-xs",
            dark ? "text-slate-400" : "text-white/58",
          )}
        >
          {settings.businessName || "Serviços profissionais"}
        </span>
      </span>
    </div>
  );
}

function ContactPill({
  icon: Icon,
  label,
}: {
  icon: typeof MessageCircle;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
      <Icon className="size-3" /> {label}
    </span>
  );
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
      )}
    >
      {label}
    </button>
  );
}

function ServiceImage({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) {
  const cover = sanitizeCssUrl(
    service.coverImage ||
      service.gallery.find((image) => image.isCover)?.url ||
      service.gallery[0]?.url,
  );
  if (cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover}
        alt={service.name}
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid place-items-center bg-gradient-to-br from-slate-900 via-violet-900 to-slate-800 text-5xl font-semibold text-white",
        className,
      )}
    >
      {service.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function PublicSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Checklist({
  items,
  empty,
  muted = false,
}: {
  items: string[];
  empty: string;
  muted?: boolean;
}) {
  if (!items.length) return <p className="text-xs text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-slate-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <Check
            className={cn(
              "mt-0.5 size-4 shrink-0",
              muted ? "text-slate-300" : "text-emerald-500",
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <CalendarClock className="mt-0.5 size-4 text-slate-400" />
      <p>
        <span className="block text-xs font-semibold text-slate-500">
          {label}
        </span>
        <span className="block text-sm text-slate-800">
          {value || "Não informado"}
        </span>
      </p>
    </div>
  );
}
