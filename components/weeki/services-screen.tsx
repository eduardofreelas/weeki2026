"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Archive,
  BarChart3,
  Check,
  Copy,
  CreditCard,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  Grid2X2,
  ImagePlus,
  Link2,
  List,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/weeki/rich-text-editor";
import { ServiceStorefront } from "@/components/weeki/service-storefront";
import type { Client } from "@/features/clients/types";
import type {
  Service,
  ServiceInput,
  ServiceOrder,
  StorefrontSettings,
} from "@/features/operations/types";
import type { WeekiOperationsController } from "@/features/operations/use-weeki-operations";
import {
  createDefaultServiceDetails,
  serviceCategories,
  slugifyService,
} from "@/features/services/defaults";
import {
  formatServiceMoney,
  formatServicePrice,
  publicUrlForPath,
  servicePath,
  servicePublicUrl,
  storefrontPath,
  storefrontPublicUrl,
} from "@/features/services/pricing";
import { downloadQrCodeSvg, qrCodeImageUrl } from "@/features/services/qr";
import {
  SERVICE_AVAILABILITY_LABELS,
  SERVICE_HIRING_LABELS,
  SERVICE_ORDER_STATUS_LABELS,
  SERVICE_PAYMENT_METHOD_LABELS,
  SERVICE_PRICING_LABELS,
  SERVICE_STATUS_LABELS,
  SERVICE_UNIT_LABELS,
  type ServiceAvailabilityStatus,
  type ServiceChargingUnit,
  type ServiceExtra,
  type ServiceHiringType,
  type ServiceImage,
  type ServiceLinkKind,
  type ServiceOrderStatus,
  type ServicePaymentMethod,
  type ServicePaymentMode,
  type ServicePricingType,
  type ServiceStatus,
  type ServiceVariant,
  type ServiceVideoProvider,
} from "@/features/services/types";
import type { WeekiSettings } from "@/features/settings/types";
import { createId, formatDateBR } from "@/lib/format";
import { sanitizeCssUrl } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import type { WeekiArea } from "./sidebar";

type ViewMode = "cards" | "list";
type ServiceDraft = Omit<Service, "id" | "createdAt" | "updatedAt">;

export function ServicesScreen({
  controller,
  clients,
  settings,
  onNavigate,
  onCreateQuoteFromOrder,
  onCreateBillingFromOrder,
  onCreateContractFromOrder,
  onCreateProjectFromOrder,
}: {
  controller: WeekiOperationsController;
  clients: Client[];
  settings: WeekiSettings;
  onNavigate: (area: WeekiArea) => void;
  onCreateQuoteFromOrder: (
    order: ServiceOrder,
  ) => { id: string; number: string } | null;
  onCreateBillingFromOrder: (
    order: ServiceOrder,
  ) => { id: string; code: string } | null;
  onCreateContractFromOrder: (
    order: ServiceOrder,
  ) => { id: string; number: string } | null;
  onCreateProjectFromOrder: (order: ServiceOrder) => { id: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "all">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(() =>
    createBlankServiceDraft(settings),
  );
  const [previewService, setPreviewService] = useState<Service | null>(null);
  const [storefrontDraft, setStorefrontDraft] = useState<StorefrontSettings>(
    controller.storefrontSettings,
  );

  const activeServices = controller.services.filter(
    (service) => service.status !== "archived",
  );
  const categories = Array.from(
    new Set([
      ...serviceCategories,
      ...controller.services.map((service) => service.category).filter(Boolean),
    ]),
  );
  const filteredServices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return activeServices.filter((service) => {
      const searchable =
        `${service.name} ${service.category} ${service.summary} ${service.description}`.toLocaleLowerCase(
          "pt-BR",
        );
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (statusFilter === "all" || service.status === statusFilter) &&
        (categoryFilter === "all" || service.category === categoryFilter)
      );
    });
  }, [activeServices, categoryFilter, query, statusFilter]);

  const published = controller.services.filter(
    (service) => service.status === "published" && service.inStorefront,
  );
  const totalViews = controller.services.reduce(
    (sum, service) =>
      sum + service.analytics.serviceViews + service.analytics.storefrontViews,
    0,
  );
  const totalOrders = controller.serviceOrders.length;
  const paidOrders = controller.serviceOrders.filter(
    (order) => order.paymentStatus === "paid",
  );
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);

  const openNew = () => {
    setEditingId(null);
    setDraft(createBlankServiceDraft(settings));
    setEditorOpen(true);
  };
  const editService = (service: Service) => {
    setEditingId(service.id);
    setDraft(toServiceDraft(service));
    setEditorOpen(true);
  };
  const saveService = () => {
    if (!draft.name.trim()) return toast.error("Informe o nome do serviço.");
    if (!plainText(draft.fullDescription || draft.description).trim())
      return toast.error("Informe uma descrição do serviço.");
    if (
      draft.pricing.type !== "on_request" &&
      draft.pricing.type !== "free" &&
      draft.pricing.amount <= 0
    ) {
      return toast.error(
        "Informe o preço ou marque como sob consulta/gratuito.",
      );
    }
    const payload: ServiceInput = {
      ...draft,
      slug: slugifyService(draft.slug || draft.name),
      description: plainText(draft.fullDescription || draft.description).slice(
        0,
        280,
      ),
      defaultPrice: draft.pricing.amount,
      unit: legacyUnit(draft.pricing.unit),
      defaultDurationDays:
        draft.deadline.unit === "business_days" ||
        draft.deadline.unit === "days"
          ? Math.max(1, draft.deadline.value)
          : draft.defaultDurationDays,
      archivedAt: draft.status === "archived" ? new Date().toISOString() : null,
    };
    if (editingId) {
      controller.updateService(editingId, payload);
      toast.success("Serviço atualizado.");
    } else {
      const created = controller.addService(payload);
      setEditingId(created.id);
      toast.success("Serviço criado.");
    }
    setEditorOpen(false);
  };

  const shareStorefront = async () => {
    const url = storefrontPublicUrl(controller.storefrontSettings);
    await navigator.clipboard?.writeText(url);
    toast.success("Link da vitrine copiado.");
  };
  const shareService = async (service: Service) => {
    const url = servicePublicUrl(controller.storefrontSettings, service);
    await navigator.clipboard?.writeText(url);
    toast.success("Link do serviço copiado.");
  };
  const openPublicService = (service: Service) => {
    controller.recordServiceAnalytics(service.id, "ctaClicks");
    window.open(
      servicePublicUrl(controller.storefrontSettings, service),
      "_blank",
      "noopener,noreferrer",
    );
  };
  const openPublicStorefront = () => {
    window.open(
      storefrontPublicUrl(controller.storefrontSettings),
      "_blank",
      "noopener,noreferrer",
    );
  };
  const saveStorefront = () => {
    controller.updateStorefrontSettings(storefrontDraft);
    toast.success("Configurações da vitrine salvas.");
  };

  const convertOrder = (
    order: ServiceOrder,
    target: "quote" | "billing" | "contract" | "project",
  ) => {
    const created =
      target === "quote"
        ? onCreateQuoteFromOrder(order)
        : target === "billing"
          ? onCreateBillingFromOrder(order)
          : target === "contract"
            ? onCreateContractFromOrder(order)
            : onCreateProjectFromOrder(order);
    if (!created) return;
    controller.recordServiceOrderConversion(order.id, target, created.id);
    const area =
      target === "quote"
        ? "quotes"
        : target === "billing"
          ? "billing"
          : target === "contract"
            ? "contracts"
            : "engagements";
    toast.success(`${conversionLabel(target)} criado.`);
    onNavigate(area);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#654ce4]">
            Catálogo comercial
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Serviços
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre, organize e divulgue os serviços que você oferece.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPublicStorefront}
          >
            <ExternalLink className="size-3.5" /> Abrir vitrine
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={shareStorefront}
          >
            <Share2 className="size-3.5" /> Compartilhar vitrine
          </Button>
          <Button type="button" size="sm" onClick={openNew}>
            <Plus className="size-3.5" /> Novo serviço
          </Button>
        </div>
      </div>

      <section className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric
          title="Serviços ativos"
          value={String(activeServices.length)}
          detail={`${published.length} na vitrine`}
          icon={ShoppingBag}
        />
        <Metric
          title="Visualizações"
          value={String(totalViews)}
          detail="Vitrine + páginas"
          icon={Eye}
        />
        <Metric
          title="Contratações"
          value={String(totalOrders)}
          detail={`${paidOrders.length} pagas`}
          icon={CreditCard}
        />
        <Metric
          title="Receita confirmada"
          value={formatServiceMoney(revenue)}
          detail="Pagamentos confirmados"
          icon={BarChart3}
        />
      </section>

      <Tabs defaultValue="services" className="mt-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-auto flex-wrap justify-start bg-slate-100">
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="storefront">Vitrine pública</TabsTrigger>
            <TabsTrigger value="orders">Contratações</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 lg:w-72 lg:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar serviço"
                className="h-9 rounded-xl bg-slate-50 pl-9 text-xs"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ServiceStatus | "all")
              }
            >
              <SelectTrigger className="h-9 w-[150px] rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[150px] rounded-xl text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "grid size-8 place-items-center rounded-lg text-slate-400",
                  viewMode === "cards" && "bg-white text-slate-900 shadow-sm",
                )}
                aria-label="Ver cards"
              >
                <Grid2X2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "grid size-8 place-items-center rounded-lg text-slate-400",
                  viewMode === "list" && "bg-white text-slate-900 shadow-sm",
                )}
                aria-label="Ver lista"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <TabsContent value="services" className="mt-4">
          {viewMode === "cards" ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  storefrontSettings={controller.storefrontSettings}
                  onEdit={() => editService(service)}
                  onPreview={() => setPreviewService(service)}
                  onDuplicate={() => {
                    const copy = controller.duplicateService(service.id);
                    if (copy) toast.success("Serviço duplicado.");
                  }}
                  onPublish={() =>
                    controller.setServiceStatus(service.id, "published")
                  }
                  onHide={() =>
                    controller.setServiceStatus(service.id, "hidden")
                  }
                  onArchive={() => controller.archiveService(service.id)}
                  onDelete={() => {
                    const removed = controller.deleteService(service.id);
                    toast[removed ? "success" : "error"](
                      removed
                        ? "Serviço excluído."
                        : "Não excluí: há vínculos, publicação ativa ou histórico.",
                    );
                  }}
                  onShare={() => void shareService(service)}
                  onOpenPublic={() => openPublicService(service)}
                  onToggleStorefront={(checked) =>
                    controller.toggleServiceStorefront(service.id, checked)
                  }
                  onDownloadQr={() =>
                    void downloadQrCodeSvg({
                      value: servicePublicUrl(
                        controller.storefrontSettings,
                        service,
                      ),
                      filename: `qr-${service.slug}`,
                      label: service.name,
                      accentColor: controller.storefrontSettings.accentColor,
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <ServiceList
              services={filteredServices}
              storefrontSettings={controller.storefrontSettings}
              onEdit={editService}
              onShare={(service) => void shareService(service)}
              onOpen={openPublicService}
            />
          )}
          {!filteredServices.length && (
            <EmptyState
              title="Nenhum serviço encontrado"
              description="Crie um serviço básico com nome, descrição e preço; depois complete fotos, extras e contratação."
              action="Novo serviço"
              onClick={openNew}
            />
          )}
        </TabsContent>

        <TabsContent value="storefront" className="mt-4">
          <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <StorefrontSettingsPanel
              draft={storefrontDraft}
              onChange={setStorefrontDraft}
              onSave={saveStorefront}
              onShare={shareStorefront}
              onQr={() =>
                void downloadQrCodeSvg({
                  value: storefrontPublicUrl(controller.storefrontSettings),
                  filename: `qr-vitrine-${controller.storefrontSettings.slug}`,
                  label: controller.storefrontSettings.publicName,
                  accentColor: controller.storefrontSettings.accentColor,
                })
              }
            />
            <div className="min-w-0">
              <ServiceStorefront
                services={controller.services}
                settings={controller.storefrontSettings}
                onSelectService={setPreviewService}
                onShareStorefront={shareStorefront}
                onShareService={(service) => void shareService(service)}
                onPrimaryAction={(service) => setPreviewService(service)}
                compact
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <OrdersTable
            orders={controller.serviceOrders}
            clients={clients}
            onStatus={(order, status) =>
              controller.setServiceOrderStatus(order.id, status)
            }
            onConvert={convertOrder}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsPanel
            services={controller.services}
            orders={controller.serviceOrders}
          />
        </TabsContent>
      </Tabs>

      <ServiceEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        draft={draft}
        onChange={setDraft}
        onSave={saveService}
        categories={categories}
      />

      <Sheet
        open={Boolean(previewService)}
        onOpenChange={(open) => !open && setPreviewService(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-5xl"
        >
          <SheetHeader className="border-b border-slate-200 px-5 py-4 text-left">
            <SheetTitle>Prévia pública</SheetTitle>
            <SheetDescription>
              Visualização da página individual do serviço na vitrine.
            </SheetDescription>
          </SheetHeader>
          <div className="bg-slate-100 p-4">
            {previewService && (
              <ServiceStorefront
                services={controller.services}
                settings={controller.storefrontSettings}
                selectedService={previewService}
                onBack={() => setPreviewService(null)}
                onShareService={(service) => void shareService(service)}
                onPrimaryAction={(service) => openPublicService(service)}
                compact
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ServiceCard({
  service,
  storefrontSettings,
  onEdit,
  onPreview,
  onDuplicate,
  onPublish,
  onHide,
  onArchive,
  onDelete,
  onShare,
  onOpenPublic,
  onToggleStorefront,
  onDownloadQr,
}: {
  service: Service;
  storefrontSettings: StorefrontSettings;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  onHide: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onShare: () => void;
  onOpenPublic: () => void;
  onToggleStorefront: (checked: boolean) => void;
  onDownloadQr: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-48 bg-slate-100">
        {sanitizeCssUrl(service.coverImage) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sanitizeCssUrl(service.coverImage)}
            alt={service.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-slate-900 via-violet-900 to-slate-700 text-4xl font-semibold text-white">
            {service.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <StatusPill label={SERVICE_STATUS_LABELS[service.status]} />
          {service.featured && <StatusPill label="Destaque" accent />}
        </div>
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-8 rounded-full bg-white/90"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onEdit}>
                <Edit3 /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onPreview}>
                <Eye /> Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={service.status === "published" ? onHide : onPublish}
              >
                {service.status === "published" ? <EyeOff /> : <Eye />}
                {service.status === "published"
                  ? "Despublicar/ocultar"
                  : "Publicar"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onToggleStorefront.bind(null, !service.inStorefront)}
              >
                <Sparkles />{" "}
                {service.inStorefront
                  ? "Remover da vitrine"
                  : "Adicionar à vitrine"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onShare}>
                <Share2 /> Compartilhar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenPublic}>
                <ExternalLink /> Abrir página pública
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDownloadQr}>
                <QrCode /> Baixar QR Code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onArchive}>
                <Archive /> Arquivar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {service.category}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-900">
              {service.name}
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            {SERVICE_AVAILABILITY_LABELS[service.availabilityStatus]}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
          {service.summary || service.description}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2">
          <MiniStat label="Preço" value={formatServicePrice(service)} />
          <MiniStat
            label="Vendas"
            value={String(service.analytics.purchases)}
          />
          <MiniStat
            label="Views"
            value={String(
              service.analytics.serviceViews +
                service.analytics.storefrontViews,
            )}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Switch
              checked={service.inStorefront}
              onCheckedChange={onToggleStorefront}
              className="data-[state=checked]:bg-[#654ce4]"
            />
            Na vitrine
          </label>
          <span className="truncate text-[10px] text-slate-400">
            {publicUrlForPath(servicePath(storefrontSettings, service))}
          </span>
        </div>
      </div>
    </article>
  );
}

function ServiceList({
  services,
  storefrontSettings,
  onEdit,
  onShare,
  onOpen,
}: {
  services: Service[];
  storefrontSettings: StorefrontSettings;
  onEdit: (service: Service) => void;
  onShare: (service: Service) => void;
  onOpen: (service: Service) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Serviço</th>
            <th className="px-4 py-3">Preço</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Vitrine</th>
            <th className="px-4 py-3">Analytics</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {services.map((service) => (
            <tr key={service.id}>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{service.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {service.category} ·{" "}
                  {SERVICE_AVAILABILITY_LABELS[service.availabilityStatus]}
                </p>
              </td>
              <td className="px-4 py-3 text-xs font-semibold">
                {formatServicePrice(service)}
              </td>
              <td className="px-4 py-3">
                <StatusPill label={SERVICE_STATUS_LABELS[service.status]} />
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {service.inStorefront
                  ? "Publicado na vitrine"
                  : "Fora da vitrine"}
                <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-400">
                  {publicUrlForPath(servicePath(storefrontSettings, service))}
                </p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {service.analytics.serviceViews +
                  service.analytics.storefrontViews}{" "}
                views · {service.analytics.ctaClicks} cliques
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(service)}
                    className="h-8 text-xs"
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onShare(service)}
                    className="h-8 text-xs"
                  >
                    Link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onOpen(service)}
                    className="h-8 text-xs"
                  >
                    Abrir
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceEditorSheet({
  open,
  onOpenChange,
  draft,
  onChange,
  onSave,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
  onSave: () => void;
  categories: string[];
}) {
  const update = <K extends keyof ServiceDraft>(
    key: K,
    value: ServiceDraft[K],
  ) => onChange({ ...draft, [key]: value });
  const updateNested = <K extends keyof ServiceDraft>(
    key: K,
    value: Partial<ServiceDraft[K]>,
  ) =>
    onChange({
      ...draft,
      [key]: { ...(draft[key] as object), ...value } as ServiceDraft[K],
    });
  const addText = (
    key: "includedItems" | "excludedItems" | "standardTasks",
  ) => {
    const value = window.prompt("Informe o item");
    if (!value?.trim()) return;
    update(key, [...draft[key], value.trim()] as ServiceDraft[typeof key]);
  };
  const removeText = (
    key: "includedItems" | "excludedItems" | "standardTasks",
    index: number,
  ) =>
    update(
      key,
      draft[key].filter(
        (_, itemIndex) => itemIndex !== index,
      ) as ServiceDraft[typeof key],
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-6xl"
      >
        <SheetHeader className="border-b border-slate-200 px-5 py-4 text-left">
          <SheetTitle>{draft.name ? draft.name : "Novo serviço"}</SheetTitle>
          <SheetDescription>
            Para publicar rapidamente, preencha nome, descrição e preço. O
            restante é opcional.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 p-5">
            <Tabs defaultValue="main">
              <TabsList className="mb-5 h-auto flex-wrap justify-start bg-slate-100">
                <TabsTrigger value="main">Principal</TabsTrigger>
                <TabsTrigger value="media">Mídia e portfólio</TabsTrigger>
                <TabsTrigger value="price">Preço</TabsTrigger>
                <TabsTrigger value="checkout">Contratação</TabsTrigger>
                <TabsTrigger value="seo">SEO/Fiscal</TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome do serviço">
                    <Input
                      value={draft.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        onChange({
                          ...draft,
                          name,
                          slug: slugifyService(name),
                          seo: { ...draft.seo, title: name },
                        });
                      }}
                      placeholder="Criação de Identidade Visual"
                    />
                  </Field>
                  <Field label="Categoria">
                    <Input
                      value={draft.category}
                      list="weeki-service-categories"
                      onChange={(event) =>
                        update("category", event.target.value)
                      }
                      placeholder="Design, consultoria..."
                    />
                    <datalist id="weeki-service-categories">
                      {categories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Status">
                    <Select
                      value={draft.status}
                      onValueChange={(value) =>
                        update("status", value as ServiceStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SERVICE_STATUS_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Disponibilidade">
                    <Select
                      value={draft.availabilityStatus}
                      onValueChange={(value) =>
                        update(
                          "availabilityStatus",
                          value as ServiceAvailabilityStatus,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SERVICE_AVAILABILITY_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Resumo para cards">
                  <Textarea
                    value={draft.summary}
                    onChange={(event) => update("summary", event.target.value)}
                    placeholder="Desenvolvimento completo da identidade visual da sua marca."
                    className="min-h-20"
                  />
                </Field>
                <Field label="Descrição completa">
                  <RichTextEditor
                    value={draft.fullDescription}
                    onChange={(value) => update("fullDescription", value)}
                    placeholder="Explique o serviço, etapas, entregáveis e diferenciais."
                    maxLength={5000}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextList
                    title="O que está incluso"
                    items={draft.includedItems}
                    onAdd={() => addText("includedItems")}
                    onRemove={(index) => removeText("includedItems", index)}
                  />
                  <TextList
                    title="Não incluso"
                    items={draft.excludedItems}
                    onAdd={() => addText("excludedItems")}
                    onRemove={(index) => removeText("excludedItems", index)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-5">
                <Field label="Imagem de capa">
                  <Input
                    value={draft.coverImage}
                    onChange={(event) =>
                      update("coverImage", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </Field>
                <MediaManager draft={draft} onChange={onChange} />
                <PortfolioManager draft={draft} onChange={onChange} />
                <VideosLinksFaq draft={draft} onChange={onChange} />
              </TabsContent>

              <TabsContent value="price" className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label="Tipo de preço">
                    <Select
                      value={draft.pricing.type}
                      onValueChange={(value) =>
                        updateNested("pricing", {
                          type: value as ServicePricingType,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SERVICE_PRICING_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Valor">
                    <Input
                      type="number"
                      min="0"
                      value={draft.pricing.amount}
                      onChange={(event) => {
                        const amount = Number(event.target.value);
                        updateNested("pricing", { amount });
                        onChange({
                          ...draft,
                          pricing: { ...draft.pricing, amount },
                          defaultPrice: amount,
                        });
                      }}
                    />
                  </Field>
                  <Field label="Unidade">
                    <Select
                      value={draft.pricing.unit}
                      onValueChange={(value) =>
                        updateNested("pricing", {
                          unit: value as ServiceChargingUnit,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SERVICE_UNIT_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Unidade personalizada">
                    <Input
                      value={draft.pricing.customUnit}
                      onChange={(event) =>
                        updateNested("pricing", {
                          customUnit: event.target.value,
                        })
                      }
                      disabled={draft.pricing.unit !== "custom"}
                    />
                  </Field>
                </div>
                <VariantManager draft={draft} onChange={onChange} />
                <ExtraManager draft={draft} onChange={onChange} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prazo estimado">
                    <Input
                      value={draft.deadline.customText}
                      onChange={(event) =>
                        updateNested("deadline", {
                          customText: event.target.value,
                        })
                      }
                      placeholder="5 a 10 dias úteis"
                    />
                  </Field>
                  <Field label="Duração">
                    <Input
                      value={draft.duration.customText}
                      onChange={(event) =>
                        updateNested("duration", {
                          customText: event.target.value,
                        })
                      }
                      placeholder="1 hora, mensal, 15 dias..."
                    />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="checkout" className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tipo de contratação">
                    <Select
                      value={draft.hiring.type}
                      onValueChange={(value) =>
                        updateNested("hiring", {
                          type: value as ServiceHiringType,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SERVICE_HIRING_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Mensagem de confirmação">
                    <Input
                      value={draft.hiring.confirmationMessage}
                      onChange={(event) =>
                        updateNested("hiring", {
                          confirmationMessage: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <ToggleCard
                    label="Criar cliente automaticamente"
                    checked={draft.hiring.autoCreateClient}
                    onChange={(checked) =>
                      updateNested("hiring", { autoCreateClient: checked })
                    }
                  />
                  <ToggleCard
                    label="Criar demanda após contratação"
                    checked={draft.hiring.autoCreateDemand}
                    onChange={(checked) =>
                      updateNested("hiring", { autoCreateDemand: checked })
                    }
                  />
                  <ToggleCard
                    label="Criar cobrança automaticamente"
                    checked={draft.hiring.autoCreateBilling}
                    onChange={(checked) =>
                      updateNested("hiring", { autoCreateBilling: checked })
                    }
                  />
                  <ToggleCard
                    label="Criar contrato após pagamento"
                    checked={draft.hiring.autoCreateContract}
                    onChange={(checked) =>
                      updateNested("hiring", { autoCreateContract: checked })
                    }
                  />
                  <ToggleCard
                    label="Usar disponibilidade da agenda"
                    checked={draft.scheduling.useWorkspaceAvailability}
                    onChange={(checked) =>
                      updateNested("scheduling", {
                        useWorkspaceAvailability: checked,
                      })
                    }
                  />
                  <ToggleCard
                    label="Agendamento habilitado"
                    checked={draft.scheduling.enabled}
                    onChange={(checked) =>
                      updateNested("scheduling", { enabled: checked })
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label="Duração agenda (min)">
                    <Input
                      type="number"
                      value={draft.scheduling.durationMinutes}
                      onChange={(event) =>
                        updateNested("scheduling", {
                          durationMinutes: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Intervalo (min)">
                    <Input
                      type="number"
                      value={draft.scheduling.bufferMinutes}
                      onChange={(event) =>
                        updateNested("scheduling", {
                          bufferMinutes: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Antecedência mínima (h)">
                    <Input
                      type="number"
                      value={draft.scheduling.minimumNoticeHours}
                      onChange={(event) =>
                        updateNested("scheduling", {
                          minimumNoticeHours: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Agenda futura (dias)">
                    <Input
                      type="number"
                      value={draft.scheduling.maximumAdvanceDays}
                      onChange={(event) =>
                        updateNested("scheduling", {
                          maximumAdvanceDays: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label="Pagamento">
                    <Select
                      value={draft.payment.mode}
                      onValueChange={(value) =>
                        updateNested("payment", {
                          mode: value as ServicePaymentMode,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Integral</SelectItem>
                        <SelectItem value="deposit">Sinal</SelectItem>
                        <SelectItem value="installments">Parcelado</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Sinal (%)">
                    <Input
                      type="number"
                      value={draft.payment.depositPercent}
                      onChange={(event) =>
                        updateNested("payment", {
                          depositPercent: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Parcelas máximas">
                    <Input
                      type="number"
                      value={draft.payment.maxInstallments}
                      onChange={(event) =>
                        updateNested("payment", {
                          maxInstallments: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Gateway preferido">
                    <Select
                      value={draft.payment.providerPreference}
                      onValueChange={(value) =>
                        updateNested("payment", {
                          providerPreference:
                            value as typeof draft.payment.providerPreference,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Padrão</SelectItem>
                        <SelectItem value="asaas">Asaas</SelectItem>
                        <SelectItem value="mercadopago">
                          Mercado Pago
                        </SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <PaymentMethodsEditor draft={draft} onChange={onChange} />
                <CustomFieldsManager draft={draft} onChange={onChange} />
                <Field label="Termos comerciais do serviço">
                  <Textarea
                    value={draft.serviceTerms}
                    onChange={(event) =>
                      update("serviceTerms", event.target.value)
                    }
                    className="min-h-24"
                    placeholder="Cancelamento, reagendamento, revisões, reembolso..."
                  />
                </Field>
              </TabsContent>

              <TabsContent value="seo" className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Slug público">
                    <Input
                      value={draft.slug}
                      onChange={(event) =>
                        update("slug", slugifyService(event.target.value))
                      }
                    />
                  </Field>
                  <Field label="Título SEO">
                    <Input
                      value={draft.seo.title}
                      onChange={(event) =>
                        updateNested("seo", { title: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Descrição SEO">
                  <Textarea
                    value={draft.seo.description}
                    onChange={(event) =>
                      updateNested("seo", { description: event.target.value })
                    }
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Código de serviço fiscal">
                    <Input
                      value={draft.fiscal.serviceCode}
                      onChange={(event) => {
                        updateNested("fiscal", {
                          serviceCode: event.target.value,
                        });
                        onChange({
                          ...draft,
                          fiscal: {
                            ...draft.fiscal,
                            serviceCode: event.target.value,
                          },
                          fiscalCode: event.target.value,
                        });
                      }}
                    />
                  </Field>
                  <Field label="Alíquota ISS (%)">
                    <Input
                      type="number"
                      value={draft.fiscal.issRate}
                      onChange={(event) => {
                        const issRate = Number(event.target.value);
                        onChange({
                          ...draft,
                          fiscal: { ...draft.fiscal, issRate },
                          taxRate: issRate,
                        });
                      }}
                    />
                  </Field>
                </div>
                <Field label="Descrição fiscal">
                  <Textarea
                    value={draft.fiscal.fiscalDescription}
                    onChange={(event) =>
                      updateNested("fiscal", {
                        fiscalDescription: event.target.value,
                      })
                    }
                  />
                </Field>
                <TextList
                  title="Tarefas padrão da demanda"
                  items={draft.standardTasks}
                  onAdd={() => addText("standardTasks")}
                  onRemove={(index) => removeText("standardTasks", index)}
                />
              </TabsContent>
            </Tabs>
          </div>
          <aside className="border-l border-slate-200 bg-slate-50 p-5">
            <div className="sticky top-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Prévia do card
                </p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="h-36 bg-slate-100">
                    {sanitizeCssUrl(draft.coverImage) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sanitizeCssUrl(draft.coverImage)}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center bg-slate-900 text-4xl font-semibold text-white">
                        {draft.name.slice(0, 1).toUpperCase() || "S"}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {draft.category || "Categoria"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {draft.name || "Nome do serviço"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {draft.summary || "Resumo do serviço para a vitrine."}
                    </p>
                    <p className="mt-3 text-sm font-semibold">
                      {formatServicePrice({
                        ...draft,
                        id: "preview",
                        createdAt: "",
                        updatedAt: "",
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-800">
                <strong>Publicação simples:</strong> nome, descrição e preço
                bastam para publicar. Imagens, extras, FAQ, fiscal e automações
                podem ser completados depois.
              </div>
              <Button type="button" className="w-full" onClick={onSave}>
                <Check className="size-4" /> Salvar serviço
              </Button>
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MediaManager({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
}) {
  const addImageUrl = () => {
    const url = window.prompt("Cole a URL da imagem");
    if (!url?.trim()) return;
    const image: ServiceImage = {
      id: createId(),
      url: url.trim(),
      alt: draft.name,
      caption: "",
      source: "url",
      sortOrder: draft.gallery.length + 1,
      isCover: !draft.coverImage && !draft.gallery.length,
      createdAt: new Date().toISOString(),
    };
    onChange({
      ...draft,
      coverImage: draft.coverImage || image.url,
      gallery: [...draft.gallery, image],
    });
  };
  const uploadImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      if (!file.type.startsWith("image/"))
        return toast.error("Envie apenas imagens.");
      if (file.size > 1_500_000)
        return toast.error("Use imagens de até 1,5 MB no modo local.");
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || "");
        const image: ServiceImage = {
          id: createId(),
          url,
          alt: file.name,
          caption: "",
          source: "upload",
          sortOrder: draft.gallery.length + 1,
          isCover: !draft.coverImage && !draft.gallery.length,
          createdAt: new Date().toISOString(),
        };
        onChange({
          ...draft,
          coverImage: draft.coverImage || url,
          gallery: [...draft.gallery, image],
        });
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };
  const remove = (id: string) =>
    onChange({
      ...draft,
      gallery: draft.gallery.filter((image) => image.id !== id),
      coverImage:
        draft.coverImage === draft.gallery.find((image) => image.id === id)?.url
          ? ""
          : draft.coverImage,
    });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Imagem e galeria</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Upload local ou URL. O backend deverá validar tipo/tamanho no modo
            público.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addImageUrl}
          >
            <Link2 className="size-3.5" /> URL
          </Button>
          <Label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <ImagePlus className="size-3.5" /> Upload
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={uploadImages}
            />
          </Label>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {draft.gallery.map((image) => (
          <div
            key={image.id}
            className="overflow-hidden rounded-xl border border-slate-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sanitizeCssUrl(image.url)}
              alt={image.alt}
              className="h-32 w-full object-cover"
            />
            <div className="flex items-center justify-between gap-2 p-2">
              <Button
                type="button"
                variant={draft.coverImage === image.url ? "default" : "outline"}
                size="sm"
                onClick={() => onChange({ ...draft, coverImage: image.url })}
                className="h-7 text-[10px]"
              >
                Principal
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(image.id)}
                className="h-7 text-[10px] text-rose-600"
              >
                Remover
              </Button>
            </div>
          </div>
        ))}
        {!draft.gallery.length && (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400 sm:col-span-2 xl:col-span-3">
            Adicione fotos de trabalhos anteriores, exemplos ou resultados.
          </div>
        )}
      </div>
    </section>
  );
}

function PortfolioManager({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
}) {
  const add = () =>
    onChange({
      ...draft,
      portfolio: [
        ...draft.portfolio,
        {
          id: createId(),
          title: "Novo projeto",
          description: "",
          imageUrl: "",
          gallery: [],
          clientName: "",
          projectDate: "",
          externalUrl: "",
          result: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  const update = (
    id: string,
    updates: Partial<ServiceDraft["portfolio"][number]>,
  ) =>
    onChange({
      ...draft,
      portfolio: draft.portfolio.map((item) =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item,
      ),
    });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <HeaderAction
        title="Portfólio"
        description="Projetos realizados ligados a este serviço."
        action="Adicionar projeto"
        onClick={add}
      />
      <div className="mt-4 space-y-3">
        {draft.portfolio.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2"
          >
            <Input
              value={item.title}
              onChange={(event) =>
                update(item.id, { title: event.target.value })
              }
              placeholder="Título do projeto"
            />
            <Input
              value={item.clientName}
              onChange={(event) =>
                update(item.id, { clientName: event.target.value })
              }
              placeholder="Cliente opcional"
            />
            <Input
              value={item.imageUrl}
              onChange={(event) =>
                update(item.id, { imageUrl: event.target.value })
              }
              placeholder="Imagem/URL"
            />
            <Input
              value={item.externalUrl}
              onChange={(event) =>
                update(item.id, { externalUrl: event.target.value })
              }
              placeholder="Link externo"
            />
            <Textarea
              value={item.description}
              onChange={(event) =>
                update(item.id, { description: event.target.value })
              }
              placeholder="Descrição"
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...draft,
                    portfolio: draft.portfolio.filter(
                      (entry) => entry.id !== item.id,
                    ),
                  })
                }
                className="text-rose-600"
              >
                Remover projeto
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VideosLinksFaq({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
}) {
  const addVideo = () =>
    onChange({
      ...draft,
      videos: [
        ...draft.videos,
        {
          id: createId(),
          title: "Vídeo",
          url: "",
          provider: "youtube",
          embedUrl: "",
        },
      ],
    });
  const addLink = () =>
    onChange({
      ...draft,
      links: [
        ...draft.links,
        { id: createId(), label: "Link", url: "", kind: "other", icon: "" },
      ],
    });
  const addFaq = () =>
    onChange({
      ...draft,
      faq: [...draft.faq, { id: createId(), question: "", answer: "" }],
    });
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <MiniManager title="Vídeos" action="Adicionar" onClick={addVideo}>
        {draft.videos.map((video) => (
          <div
            key={video.id}
            className="space-y-2 rounded-xl border border-slate-200 p-3"
          >
            <Input
              value={video.title}
              onChange={(event) =>
                onChange({
                  ...draft,
                  videos: draft.videos.map((item) =>
                    item.id === video.id
                      ? { ...item, title: event.target.value }
                      : item,
                  ),
                })
              }
              placeholder="Título"
            />
            <Input
              value={video.url}
              onChange={(event) =>
                onChange({
                  ...draft,
                  videos: draft.videos.map((item) =>
                    item.id === video.id
                      ? {
                          ...item,
                          url: event.target.value,
                          embedUrl: embedUrl(event.target.value, item.provider),
                        }
                      : item,
                  ),
                })
              }
              placeholder="YouTube/Vimeo/link"
            />
            <Select
              value={video.provider}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  videos: draft.videos.map((item) =>
                    item.id === video.id
                      ? {
                          ...item,
                          provider: value as ServiceVideoProvider,
                          embedUrl: embedUrl(
                            item.url,
                            value as ServiceVideoProvider,
                          ),
                        }
                      : item,
                  ),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
                <SelectItem value="external">Link externo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </MiniManager>
      <MiniManager
        title="Links relacionados"
        action="Adicionar"
        onClick={addLink}
      >
        {draft.links.map((link) => (
          <div
            key={link.id}
            className="space-y-2 rounded-xl border border-slate-200 p-3"
          >
            <Input
              value={link.label}
              onChange={(event) =>
                onChange({
                  ...draft,
                  links: draft.links.map((item) =>
                    item.id === link.id
                      ? { ...item, label: event.target.value }
                      : item,
                  ),
                })
              }
              placeholder="Nome"
            />
            <Input
              value={link.url}
              onChange={(event) =>
                onChange({
                  ...draft,
                  links: draft.links.map((item) =>
                    item.id === link.id
                      ? { ...item, url: event.target.value }
                      : item,
                  ),
                })
              }
              placeholder="URL"
            />
            <Select
              value={link.kind}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  links: draft.links.map((item) =>
                    item.id === link.id
                      ? { ...item, kind: value as ServiceLinkKind }
                      : item,
                  ),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="behance">Behance</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="portfolio">Portfólio</SelectItem>
                <SelectItem value="google_drive">Google Drive</SelectItem>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </MiniManager>
      <MiniManager title="FAQ" action="Adicionar" onClick={addFaq}>
        {draft.faq.map((faq) => (
          <div
            key={faq.id}
            className="space-y-2 rounded-xl border border-slate-200 p-3"
          >
            <Input
              value={faq.question}
              onChange={(event) =>
                onChange({
                  ...draft,
                  faq: draft.faq.map((item) =>
                    item.id === faq.id
                      ? { ...item, question: event.target.value }
                      : item,
                  ),
                })
              }
              placeholder="Pergunta"
            />
            <Textarea
              value={faq.answer}
              onChange={(event) =>
                onChange({
                  ...draft,
                  faq: draft.faq.map((item) =>
                    item.id === faq.id
                      ? { ...item, answer: event.target.value }
                      : item,
                  ),
                })
              }
              placeholder="Resposta"
            />
          </div>
        ))}
      </MiniManager>
    </div>
  );
}

function VariantManager({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
}) {
  const add = () =>
    onChange({
      ...draft,
      variants: [
        ...draft.variants,
        {
          id: createId(),
          name: "Novo plano",
          description: "",
          price: draft.pricing.amount || 0,
          includedItems: [],
          highlighted: false,
          duration: "",
          conditions: "",
        },
      ],
    });
  const update = (id: string, updates: Partial<ServiceVariant>) =>
    onChange({
      ...draft,
      variants: draft.variants.map((variant) =>
        variant.id === id ? { ...variant, ...updates } : variant,
      ),
    });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <HeaderAction
        title="Variações / planos"
        description="Planos diferentes para o mesmo serviço."
        action="Adicionar plano"
        onClick={add}
      />
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {draft.variants.map((variant) => (
          <div
            key={variant.id}
            className="space-y-3 rounded-xl border border-slate-200 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={variant.name}
                onChange={(event) =>
                  update(variant.id, { name: event.target.value })
                }
                placeholder="Plano Essencial"
              />
              <Input
                type="number"
                value={variant.price}
                onChange={(event) =>
                  update(variant.id, { price: Number(event.target.value) })
                }
                placeholder="Valor"
              />
            </div>
            <Textarea
              value={variant.description}
              onChange={(event) =>
                update(variant.id, { description: event.target.value })
              }
              placeholder="Descrição do plano"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <Switch
                  checked={variant.highlighted}
                  onCheckedChange={(checked) =>
                    update(variant.id, { highlighted: checked })
                  }
                />
                Destacar plano
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...draft,
                    variants: draft.variants.filter(
                      (item) => item.id !== variant.id,
                    ),
                  })
                }
                className="text-rose-600"
              >
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExtraManager({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
}) {
  const add = () =>
    onChange({
      ...draft,
      extras: [
        ...draft.extras,
        {
          id: createId(),
          name: "Novo extra",
          description: "",
          price: 0,
          required: false,
          allowQuantity: false,
          maxQuantity: 1,
          imageUrl: "",
        },
      ],
    });
  const update = (id: string, updates: Partial<ServiceExtra>) =>
    onChange({
      ...draft,
      extras: draft.extras.map((extra) =>
        extra.id === id ? { ...extra, ...updates } : extra,
      ),
    });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <HeaderAction
        title="Extras / adicionais"
        description="Adicionais opcionais ou obrigatórios recalculados no checkout."
        action="Adicionar extra"
        onClick={add}
      />
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {draft.extras.map((extra) => (
          <div
            key={extra.id}
            className="space-y-3 rounded-xl border border-slate-200 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={extra.name}
                onChange={(event) =>
                  update(extra.id, { name: event.target.value })
                }
                placeholder="Manual da marca"
              />
              <Input
                type="number"
                value={extra.price}
                onChange={(event) =>
                  update(extra.id, { price: Number(event.target.value) })
                }
                placeholder="Valor"
              />
            </div>
            <Textarea
              value={extra.description}
              onChange={(event) =>
                update(extra.id, { description: event.target.value })
              }
              placeholder="Descrição"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <Switch
                  checked={extra.required}
                  onCheckedChange={(checked) =>
                    update(extra.id, { required: checked })
                  }
                />
                Obrigatório
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <Switch
                  checked={extra.allowQuantity}
                  onCheckedChange={(checked) =>
                    update(extra.id, { allowQuantity: checked })
                  }
                />
                Permitir quantidade
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...draft,
                    extras: draft.extras.filter((item) => item.id !== extra.id),
                  })
                }
                className="text-rose-600"
              >
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaymentMethodsEditor({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
}) {
  const methods = Object.keys(
    SERVICE_PAYMENT_METHOD_LABELS,
  ) as ServicePaymentMethod[];
  const toggle = (method: ServicePaymentMethod) => {
    const exists = draft.payment.methods.includes(method);
    onChange({
      ...draft,
      payment: {
        ...draft.payment,
        methods: exists
          ? draft.payment.methods.filter((item) => item !== method)
          : [...draft.payment.methods, method],
      },
    });
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Formas de pagamento</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {methods.map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => toggle(method)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              draft.payment.methods.includes(method)
                ? "border-violet-200 bg-violet-50 text-violet-700"
                : "border-slate-200 text-slate-500",
            )}
          >
            {SERVICE_PAYMENT_METHOD_LABELS[method]}
          </button>
        ))}
      </div>
    </section>
  );
}

function CustomFieldsManager({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
}) {
  const add = () =>
    onChange({
      ...draft,
      customFields: [
        ...draft.customFields,
        {
          id: createId(),
          label: "Nova pergunta",
          type: "text",
          required: false,
          options: [],
          placeholder: "",
          helpText: "",
        },
      ],
    });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <HeaderAction
        title="Campos personalizados"
        description="Perguntas que o cliente responde antes da contratação."
        action="Adicionar pergunta"
        onClick={add}
      />
      <div className="mt-4 space-y-3">
        {draft.customFields.map((field) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_160px_90px]"
          >
            <Input
              value={field.label}
              onChange={(event) =>
                onChange({
                  ...draft,
                  customFields: draft.customFields.map((item) =>
                    item.id === field.id
                      ? { ...item, label: event.target.value }
                      : item,
                  ),
                })
              }
            />
            <Select
              value={field.type}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  customFields: draft.customFields.map((item) =>
                    item.id === field.id
                      ? { ...item, type: value as typeof field.type }
                      : item,
                  ),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="long_text">Texto longo</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="date">Data</SelectItem>
                <SelectItem value="select">Seleção</SelectItem>
                <SelectItem value="multi_select">Múltipla</SelectItem>
                <SelectItem value="checkbox">Checkbox</SelectItem>
                <SelectItem value="file">Upload</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  ...draft,
                  customFields: draft.customFields.filter(
                    (item) => item.id !== field.id,
                  ),
                })
              }
              className="text-rose-600"
            >
              Remover
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function StorefrontSettingsPanel({
  draft,
  onChange,
  onSave,
  onShare,
  onQr,
}: {
  draft: StorefrontSettings;
  onChange: (draft: StorefrontSettings) => void;
  onSave: () => void;
  onShare: () => void;
  onQr: () => void;
}) {
  const update = <K extends keyof StorefrontSettings>(
    key: K,
    value: StorefrontSettings[K],
  ) => onChange({ ...draft, [key]: value });
  const url = publicUrlForPath(storefrontPath(draft));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Configurações da vitrine</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Layout padronizado, profissional e preparado para domínio próprio.
          </p>
        </div>
        <Switch
          checked={draft.enabled}
          onCheckedChange={(checked) => update("enabled", checked)}
        />
      </div>
      <div className="mt-4 space-y-3">
        <Field label="Nome público">
          <Input
            value={draft.publicName}
            onChange={(event) => update("publicName", event.target.value)}
          />
        </Field>
        <Field label="Empresa/marca">
          <Input
            value={draft.businessName}
            onChange={(event) => update("businessName", event.target.value)}
          />
        </Field>
        <Field label="Slug">
          <Input
            value={draft.slug}
            onChange={(event) =>
              update("slug", slugifyService(event.target.value))
            }
          />
        </Field>
        <Field label="Chamada principal">
          <Textarea
            value={draft.headline}
            onChange={(event) => update("headline", event.target.value)}
            className="min-h-20"
          />
        </Field>
        <Field label="Sobre">
          <Textarea
            value={draft.about}
            onChange={(event) => update("about", event.target.value)}
            className="min-h-24"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="WhatsApp">
            <Input
              value={draft.whatsapp}
              onChange={(event) => update("whatsapp", event.target.value)}
            />
          </Field>
          <Field label="E-mail">
            <Input
              value={draft.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </Field>
        </div>
        <Field label="Domínio personalizado futuro">
          <Input
            value={draft.customDomain}
            onChange={(event) => update("customDomain", event.target.value)}
            placeholder="servicos.minhaempresa.com.br"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cor de destaque">
            <Input
              type="color"
              value={draft.accentColor}
              onChange={(event) => update("accentColor", event.target.value)}
            />
          </Field>
          <Field label="Mostrar preços">
            <div className="flex h-10 items-center rounded-md border px-3">
              <Switch
                checked={draft.showPrices}
                onCheckedChange={(checked) => update("showPrices", checked)}
              />
            </div>
          </Field>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Link atual
          </p>
          <p className="mt-1 break-all text-xs text-slate-600">{url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShare}
              className="h-8 text-xs"
            >
              <Copy className="size-3.5" /> Copiar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onQr}
              className="h-8 text-xs"
            >
              <QrCode className="size-3.5" /> QR Code
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeImageUrl(url, draft.accentColor)}
            alt="QR Code da vitrine"
            className="mx-auto size-36"
          />
          <p className="text-[10px] text-slate-400">QR Code da vitrine</p>
        </div>
        <Button type="button" onClick={onSave} className="w-full">
          Salvar vitrine
        </Button>
      </div>
    </section>
  );
}

function OrdersTable({
  orders,
  clients,
  onStatus,
  onConvert,
}: {
  orders: ServiceOrder[];
  clients: Client[];
  onStatus: (order: ServiceOrder, status: ServiceOrderStatus) => void;
  onConvert: (
    order: ServiceOrder,
    target: "quote" | "billing" | "contract" | "project",
  ) => void;
}) {
  if (!orders.length) {
    return (
      <EmptyState
        title="Nenhuma contratação ainda"
        description="As solicitações criadas pela vitrine aparecerão aqui com cliente, serviço, plano, extras, pagamento e agenda."
        action="Abrir vitrine"
        onClick={() => undefined}
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Contratação</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Serviço</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Pagamento</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Integrações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => {
            const client = order.clientId
              ? clients.find((item) => item.id === order.clientId)
              : null;
            return (
              <tr key={order.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{order.number}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateBR(order.createdAt.slice(0, 10))}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">
                    {client?.name || order.clientName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {order.clientEmail || order.clientPhone}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-800">
                    {order.serviceName}
                  </p>
                  <p>
                    {order.planName || "Plano padrão"} · {order.extras.length}{" "}
                    extra(s)
                  </p>
                </td>
                <td className="px-4 py-3 font-semibold">
                  {formatServiceMoney(order.total)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {order.paymentStatus}
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={order.status}
                    onValueChange={(value) =>
                      onStatus(order, value as ServiceOrderStatus)
                    }
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SERVICE_ORDER_STATUS_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(order.quoteId)}
                      onClick={() => onConvert(order, "quote")}
                      className="h-8 text-xs"
                    >
                      <FileText /> Orçamento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(order.chargeId)}
                      onClick={() => onConvert(order, "billing")}
                      className="h-8 text-xs"
                    >
                      <CreditCard /> Cobrança
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(order.contractId)}
                      onClick={() => onConvert(order, "contract")}
                      className="h-8 text-xs"
                    >
                      <FileSignature /> Contrato
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(order.engagementId)}
                      onClick={() => onConvert(order, "project")}
                      className="h-8 text-xs"
                    >
                      Demanda
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsPanel({
  services,
  orders,
}: {
  services: Service[];
  orders: ServiceOrder[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Funil por serviço</h2>
        <div className="mt-4 space-y-3">
          {services.map((service) => {
            const views =
              service.analytics.serviceViews +
              service.analytics.storefrontViews;
            const conversion = views
              ? (service.analytics.ctaClicks / views) * 100
              : 0;
            return (
              <div
                key={service.id}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{service.name}</p>
                    <p className="text-xs text-slate-400">{service.category}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {conversion.toFixed(1)}% conversão
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
                  <MiniStat label="Views" value={String(views)} />
                  <MiniStat
                    label="Cliques"
                    value={String(service.analytics.ctaClicks)}
                  />
                  <MiniStat
                    label="Pedidos"
                    value={String(service.analytics.quoteRequests)}
                  />
                  <MiniStat
                    label="Compras"
                    value={String(service.analytics.purchases)}
                  />
                  <MiniStat
                    label="Agenda"
                    value={String(service.analytics.appointments)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Eventos preparados</h2>
        <div className="mt-3 space-y-2 text-xs text-slate-500">
          {[
            "Serviço contratado → criar demanda",
            "Pagamento confirmado → enviar confirmação",
            "Serviço concluído → solicitar avaliação",
            "Serviço concluído → sugerir NFS-e",
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 px-3 py-2"
            >
              {item}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          Contratações registradas: <strong>{orders.length}</strong>. A emissão
          fiscal continua opcional e depende das configurações do módulo Fiscal.
        </div>
      </section>
    </div>
  );
}

function createBlankServiceDraft(settings: WeekiSettings): ServiceDraft {
  const details = createDefaultServiceDetails({
    name: "",
    description: "",
    category: settings.profile.businessArea || "Serviços",
    defaultPrice: 0,
    unit: "projeto",
    defaultDurationDays: 15,
    status: "draft",
  });
  return {
    name: "",
    description: "",
    category: settings.profile.businessArea || "Serviços",
    defaultPrice: 0,
    billingType: "fixed",
    unit: "projeto",
    defaultDurationDays: 15,
    fiscalCode: "",
    taxRate: 0,
    contractTemplateId: null,
    standardTasks: [],
    recurrence: "none",
    archivedAt: null,
    ...details,
  };
}

function toServiceDraft(service: Service): ServiceDraft {
  const copy = { ...service } as Partial<Service>;
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy as ServiceDraft;
}

function Metric({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-[#654ce4]">
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white px-2 py-2 text-center">
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function StatusPill({
  label,
  accent = false,
}: {
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm",
        accent ? "bg-violet-600 text-white" : "bg-white/92 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextList({
  title,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <HeaderAction
        title={title}
        description=""
        action="Adicionar"
        onClick={onAdd}
      />
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
          >
            <Check className="size-3.5 text-emerald-500" />
            <span className="flex-1">{item}</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-xs text-rose-500"
            >
              remover
            </button>
          </div>
        ))}
        {!items.length && (
          <p className="text-xs text-slate-400">Nenhum item cadastrado.</p>
        )}
      </div>
    </section>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-600">
      {label}
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#654ce4]"
      />
    </label>
  );
}

function HeaderAction({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        className="h-8 text-xs"
      >
        <Plus className="size-3.5" /> {action}
      </Button>
    </div>
  );
}

function MiniManager({
  title,
  action,
  onClick,
  children,
}: {
  title: string;
  action: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <HeaderAction
        title={title}
        description=""
        action={action}
        onClick={onClick}
      />
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function EmptyState({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
      <ShoppingBag className="mx-auto size-8 text-slate-300" />
      <h2 className="mt-3 text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
        {description}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        className="mt-4"
      >
        <Plus className="size-3.5" /> {action}
      </Button>
    </div>
  );
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function legacyUnit(unit: ServiceChargingUnit) {
  if (unit === "hour") return "hora";
  if (unit === "day") return "dia";
  if (unit === "session") return "sessão";
  if (unit === "month") return "mês";
  if (unit === "page") return "página";
  if (unit === "square_meter") return "m²";
  if (unit === "km") return "km";
  if (unit === "package") return "pacote";
  return "projeto";
}

function embedUrl(url: string, provider: ServiceVideoProvider) {
  if (provider === "youtube") {
    const id =
      url.match(/[?&]v=([^&]+)/)?.[1] ||
      url.match(/youtu\.be\/([^?]+)/)?.[1] ||
      "";
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }
  if (provider === "vimeo") {
    const id = url.match(/vimeo\.com\/(\d+)/)?.[1] || "";
    return id ? `https://player.vimeo.com/video/${id}` : "";
  }
  return "";
}

function conversionLabel(target: "quote" | "billing" | "contract" | "project") {
  if (target === "quote") return "Orçamento";
  if (target === "billing") return "Cobrança";
  if (target === "contract") return "Contrato";
  return "Demanda";
}
