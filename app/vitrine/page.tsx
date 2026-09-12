"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, CreditCard, Loader2, Send, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { ServiceStorefront } from "@/components/weeki/service-storefront";
import { useWeekiAppointments } from "@/features/appointments/use-weeki-appointments";
import { useWeekiBilling } from "@/features/billing/use-weeki-billing";
import { useWeekiClients } from "@/features/clients/use-weeki-clients";
import { useWeekiOperations } from "@/features/operations/use-weeki-operations";
import type { Service } from "@/features/operations/types";
import {
  QUOTE_UNIT_LABELS,
  type QuoteItem,
  type QuoteUnit,
} from "@/features/operations/types";
import {
  calculateServiceCheckoutTotal,
  formatServiceMoney,
  servicePlanLabel,
  snapshotSelectedExtras,
} from "@/features/services/pricing";
import {
  SERVICE_PAYMENT_METHOD_LABELS,
  type ServiceOrderAnswer,
  type ServiceCustomField,
  type ServicePaymentMethod,
} from "@/features/services/types";
import { useWeekiSettings } from "@/features/settings/use-weeki-settings";
import { createId } from "@/lib/format";

export default function StorefrontPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-100 text-slate-500">
          <Loader2 className="size-5 animate-spin" />
        </main>
      }
    >
      <StorefrontClient />
    </Suspense>
  );
}

function StorefrontClient() {
  const params = useSearchParams();
  const slug = params.get("slug") || "";
  const serviceSlug = params.get("service") || "";
  const operations = useWeekiOperations();
  const { clients, addClient } = useWeekiClients();
  const billing = useWeekiBilling();
  const appointments = useWeekiAppointments();
  const { settings } = useWeekiSettings();
  const [checkoutService, setCheckoutService] = useState<Service | null>(null);
  const storefront = operations.storefrontSettings;
  const storefrontMatches =
    storefront.enabled &&
    (storefront.slug === slug || storefront.previousSlugs.includes(slug));
  const publicServices = operations.services.filter(
    (service) => service.status === "published" && service.inStorefront,
  );
  const selectedService = publicServices.find(
    (service) => service.slug === serviceSlug,
  );

  useEffect(() => {
    if (!storefrontMatches) return;
    if (selectedService) {
      operations.recordServiceAnalytics(selectedService.id, "serviceViews");
      return;
    }
    publicServices
      .slice(0, 6)
      .forEach((service) =>
        operations.recordServiceAnalytics(service.id, "storefrontViews"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.id, storefrontMatches]);

  if (!storefrontMatches) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <X className="mx-auto size-8 text-slate-300" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Vitrine não encontrada
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            O link pode ter sido alterado, desativado ou ainda não publicado.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5f8] px-3 py-4 sm:px-5 sm:py-7">
      <div className="mx-auto max-w-7xl">
        <ServiceStorefront
          services={operations.services}
          settings={storefront}
          selectedService={selectedService}
          onSelectService={(service) => {
            window.history.pushState(
              null,
              "",
              `/vitrine?slug=${encodeURIComponent(storefront.slug)}&service=${encodeURIComponent(service.slug)}`,
            );
          }}
          onBack={() => {
            window.history.pushState(
              null,
              "",
              `/vitrine?slug=${encodeURIComponent(storefront.slug)}`,
            );
          }}
          onPrimaryAction={(service) => {
            operations.recordServiceAnalytics(service.id, "ctaClicks");
            setCheckoutService(service);
          }}
        />
      </div>
      {checkoutService && (
        <CheckoutSheet
          service={checkoutService}
          onClose={() => setCheckoutService(null)}
          onSubmit={(result) => {
            const existingClient = clients.find(
              (client) =>
                (result.email &&
                  client.email.toLocaleLowerCase("pt-BR") ===
                    result.email.toLocaleLowerCase("pt-BR")) ||
                (result.phone &&
                  client.phone.replace(/\D/g, "") ===
                    result.phone.replace(/\D/g, "")),
            );
            const client =
              existingClient ??
              addClient({
                name: result.name,
                color: "#654ce4",
                logoUrl: "",
                kind:
                  result.document.replace(/\D/g, "").length > 11
                    ? "company"
                    : "person",
                document: result.document,
                contactName: result.name,
                contactRole: "Contato da vitrine",
                email: result.email,
                phone: result.phone,
                website: "",
                address: "",
                notes: result.message,
                status: "negotiating",
                segment: checkoutService.category,
                contractValue: result.total,
                contractKind: "none",
                nextDueDate: "",
                paymentStatus: result.requiresPayment ? "pending" : "none",
                files: [],
                links: [],
              });
            const order = operations.addServiceOrder({
              serviceId: checkoutService.id,
              serviceName: checkoutService.name,
              serviceSlug: checkoutService.slug,
              clientId: client.id,
              clientName: result.name,
              clientEmail: result.email,
              clientPhone: result.phone,
              clientDocument: result.document,
              planId: result.planId,
              planName: result.planName,
              extras: result.extras,
              answers: result.answers,
              message: result.message,
              total: result.total,
              paymentStatus: result.requiresPayment
                ? "pending"
                : "not_required",
              paymentMethod: result.paymentMethod,
              paymentLink: "",
              appointmentDate: result.appointmentDate,
              appointmentTime: result.appointmentTime,
              quoteId: null,
              chargeId: null,
              contractId: null,
              engagementId: null,
              source: "storefront",
              status: result.requiresPayment ? "awaiting_payment" : "interest",
            });
            if (!order) return;
            if (
              checkoutService.hiring.type === "request_quote" ||
              checkoutService.hiring.type === "consult"
            ) {
              const quote = operations.addQuote({
                title: checkoutService.name,
                clientId: client.id,
                opportunityId: null,
                items: quoteItemsFromCheckout(
                  checkoutService,
                  result.planId,
                  result.extras,
                ),
                description: result.message || checkoutService.summary,
                issueDate: new Date().toISOString().slice(0, 10),
                estimatedDeadline: checkoutService.deadline.customText,
                validUntil: new Date(Date.now() + 15 * 86400000)
                  .toISOString()
                  .slice(0, 10),
                responsible: settings.profile.name,
                discountType: "none",
                discountValue: 0,
                taxType: "none",
                taxLabel: "",
                taxValue: 0,
                paymentCondition:
                  checkoutService.payment.mode === "installments"
                    ? "installments"
                    : "custom",
                downPaymentPercent: checkoutService.payment.depositPercent,
                installments: checkoutService.payment.maxInstallments,
                firstDueDate: "",
                paymentDetails: checkoutService.payment.notes,
                estimatedStartDate: "",
                estimatedEndDate: "",
                scope: checkoutService.fullDescription,
                exclusions: checkoutService.excludedItems
                  .map((item) => `<li>${item}</li>`)
                  .join(""),
                notes: result.answers
                  .map((answer) => `${answer.label}: ${String(answer.value)}`)
                  .join("\n"),
                terms: checkoutService.serviceTerms,
                paymentMethod:
                  result.paymentMethod === "not_selected"
                    ? ""
                    : result.paymentMethod,
                status: "awaiting_approval",
                version: 1,
                parentQuoteId: null,
                publicToken: "",
                viewedAt: null,
                approvedAt: null,
                rejectedAt: null,
                rejectionReason: "",
                acceptedBy: "",
                engagementId: null,
                chargeId: null,
                contractId: null,
                events: [],
              });
              operations.recordServiceOrderConversion(
                order.id,
                "quote",
                quote.id,
              );
              operations.recordServiceAnalytics(
                checkoutService.id,
                "quoteRequests",
              );
            }
            if (
              result.requiresPayment &&
              checkoutService.payment.createChargeAutomatically
            ) {
              const charge = billing.addCharge(
                {
                  clientId: client.id,
                  engagementId: null,
                  description: `Contratação ${checkoutService.name}`,
                  amount: result.total,
                  dueDate: new Date(Date.now() + 2 * 86400000)
                    .toISOString()
                    .slice(0, 10),
                  dueTime: "",
                  methods: [billingMethod(result.paymentMethod)],
                  cardMaxInstallments: checkoutService.payment.maxInstallments,
                  passCardFees: false,
                  discountEnabled: false,
                  discountMethod: "pix",
                  discountPercent: 0,
                  remindersEnabled: true,
                  lateFeeEnabled: false,
                  lateFeePercent: 2,
                  dailyInterestPercent: 0.033,
                  message: checkoutService.payment.notes,
                },
                true,
              );
              operations.recordServiceOrderConversion(
                order.id,
                "billing",
                charge.id,
              );
              operations.updateServiceOrder(order.id, {
                paymentLink: charge.paymentLink,
              });
              operations.recordServiceAnalytics(
                checkoutService.id,
                "purchases",
              );
            }
            if (result.appointmentDate && result.appointmentTime) {
              appointments.addAppointment({
                title: checkoutService.name,
                typeId: checkoutService.id,
                clientId: client.id,
                serviceId: checkoutService.id,
                engagementId: null,
                guestName: result.name,
                guestEmail: result.email,
                guestPhone: result.phone,
                date: result.appointmentDate,
                time: result.appointmentTime,
                status: "pending",
                mode: "video",
                location: "",
                meetingUrl: "",
                notes: result.message,
                source: "Vitrine pública",
              });
              operations.recordServiceAnalytics(
                checkoutService.id,
                "appointments",
              );
            }
            setCheckoutService(null);
            alert(checkoutService.hiring.confirmationMessage);
          }}
        />
      )}
    </main>
  );
}

function CheckoutSheet({
  service,
  onClose,
  onSubmit,
}: {
  service: Service;
  onClose: () => void;
  onSubmit: (result: CheckoutResult) => void;
}) {
  const [planId, setPlanId] = useState(
    service.variants.find((item) => item.highlighted)?.id ??
      service.variants[0]?.id ??
      null,
  );
  const [extras, setExtras] = useState<Array<{ id: string; quantity: number }>>(
    service.extras
      .filter((extra) => extra.required)
      .map((extra) => ({ id: extra.id, quantity: 1 })),
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState(
    service.scheduling.specificHours[0] ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<
    ServicePaymentMethod | "not_selected"
  >(service.payment.methods[0] ?? "not_selected");
  const selectedPlan = service.variants.find(
    (variant) => variant.id === planId,
  );
  const total = calculateServiceCheckoutTotal({ service, planId, extras });
  const requiresPayment =
    service.hiring.type === "buy_now" ||
    service.hiring.type === "hire_and_schedule";
  const requiresSchedule =
    service.hiring.type === "schedule" ||
    service.hiring.type === "hire_and_schedule";
  const canSubmit = name.trim() && (email.trim() || phone.trim());
  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      planId,
      planName: servicePlanLabel(selectedPlan),
      extras: snapshotSelectedExtras(service, extras),
      name,
      email,
      phone,
      document,
      message,
      answers: service.customFields.map((field) => ({
        fieldId: field.id,
        label: field.label,
        value: answers[field.id] ?? "",
      })),
      appointmentDate,
      appointmentTime,
      total,
      requiresPayment,
      paymentMethod,
    });
  };
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-slate-200 px-5 py-4 text-left">
          <SheetTitle>{service.name}</SheetTitle>
          <SheetDescription>
            Escolha opções, preencha seus dados e confirme a solicitação.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-5">
          <CheckoutStep number="1" title="Serviço">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold">{service.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {service.summary}
              </p>
            </div>
          </CheckoutStep>

          {!!service.variants.length && (
            <CheckoutStep number="2" title="Opções">
              <div className="grid gap-2">
                {service.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setPlanId(variant.id)}
                    className={`rounded-2xl border px-4 py-3 text-left ${planId === variant.id ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"}`}
                  >
                    <span className="block text-sm font-semibold">
                      {variant.name}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {variant.description}
                    </span>
                    <span className="mt-2 block text-sm font-semibold">
                      {formatServiceMoney(variant.price)}
                    </span>
                  </button>
                ))}
              </div>
            </CheckoutStep>
          )}

          {!!service.extras.length && (
            <CheckoutStep number="3" title="Extras">
              <div className="space-y-2">
                {service.extras.map((extra) => {
                  const selected = extras.find((item) => item.id === extra.id);
                  return (
                    <label
                      key={extra.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(selected) || extra.required}
                        disabled={extra.required}
                        onChange={(event) =>
                          setExtras((current) =>
                            event.target.checked
                              ? [...current, { id: extra.id, quantity: 1 }]
                              : current.filter((item) => item.id !== extra.id),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {extra.name} {extra.required && "(obrigatório)"}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {extra.description}
                        </span>
                      </span>
                      <span className="font-semibold">
                        + {formatServiceMoney(extra.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </CheckoutStep>
          )}

          <CheckoutStep number="4" title="Dados do cliente">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome"
              />
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-mail"
              />
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="WhatsApp"
              />
              <Input
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                placeholder="CPF/CNPJ opcional"
              />
            </div>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={service.hiring.intakeTitle}
              className="mt-3 min-h-24"
            />
          </CheckoutStep>

          {!!service.customFields.length && (
            <CheckoutStep number="5" title="Perguntas do serviço">
              <div className="space-y-3">
                {service.customFields.map((field) => (
                  <DynamicField
                    key={field.id}
                    field={field}
                    value={answers[field.id]}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [field.id]: value,
                      }))
                    }
                  />
                ))}
              </div>
            </CheckoutStep>
          )}

          {requiresSchedule && (
            <CheckoutStep number="6" title="Agendamento">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  value={appointmentDate}
                  onChange={(event) => setAppointmentDate(event.target.value)}
                />
                <Select
                  value={appointmentTime}
                  onValueChange={setAppointmentTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {(service.scheduling.specificHours.length
                      ? service.scheduling.specificHours
                      : ["09:00", "14:00"]
                    ).map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CheckoutStep>
          )}

          {requiresPayment && (
            <CheckoutStep number="7" title="Pagamento">
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as ServicePaymentMethod)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {service.payment.methods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {SERVICE_PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Os dados de cartão não são armazenados pela Weeki. O pagamento
                real deve ocorrer no checkout seguro do provedor conectado.
              </p>
            </CheckoutStep>
          )}

          <div className="sticky bottom-0 -mx-5 border-t border-slate-200 bg-white/95 p-5 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-2xl font-semibold">
                {formatServiceMoney(total)}
              </span>
            </div>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="h-11 w-full rounded-full"
            >
              {requiresPayment ? <CreditCard /> : <Send />}
              {requiresPayment
                ? "Continuar para pagamento"
                : "Enviar solicitação"}
            </Button>
            <div className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Preços e totais deverão ser revalidados no backend.
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface CheckoutResult {
  planId: string | null;
  planName: string;
  extras: Array<{ id: string; name: string; price: number; quantity: number }>;
  name: string;
  email: string;
  phone: string;
  document: string;
  message: string;
  answers: ServiceOrderAnswer[];
  appointmentDate: string;
  appointmentTime: string;
  total: number;
  requiresPayment: boolean;
  paymentMethod: ServicePaymentMethod | "not_selected";
}

function quoteItemsFromCheckout(
  service: Service,
  planId: string | null,
  extras: CheckoutResult["extras"],
): QuoteItem[] {
  const selectedPlan = service.variants.find(
    (variant) => variant.id === planId,
  );
  const unit = quoteUnitFromService(service.pricing.unit);
  const base: QuoteItem = {
    id: createId(),
    serviceId: service.id,
    savedItemId: service.id,
    name: selectedPlan
      ? `${service.name} — ${selectedPlan.name}`
      : service.name,
    description:
      selectedPlan?.description || service.summary || service.description,
    quantity: 1,
    unit,
    customUnit: unit === "custom" ? service.pricing.customUnit : "",
    unitPrice:
      selectedPlan?.price ?? service.pricing.amount ?? service.defaultPrice,
    discountType: "none",
    discountValue: 0,
    discount: 0,
    addition: 0,
    fiscalCode: service.fiscal.serviceCode,
    taxRate: service.fiscal.issRate,
  };
  return [
    base,
    ...extras.map((extra) => ({
      id: createId(),
      serviceId: service.id,
      savedItemId: service.id,
      name: extra.name,
      description: `Extra do serviço ${service.name}`,
      quantity: extra.quantity,
      unit: "unit" as QuoteUnit,
      customUnit: "",
      unitPrice: extra.price,
      discountType: "none" as const,
      discountValue: 0,
      discount: 0,
      addition: 0,
      fiscalCode: service.fiscal.serviceCode,
      taxRate: service.fiscal.issRate,
    })),
  ];
}

function quoteUnitFromService(unit: Service["pricing"]["unit"]): QuoteUnit {
  const mapped: Partial<Record<Service["pricing"]["unit"], QuoteUnit>> = {
    unit: "unit",
    hour: "hour",
    day: "day",
    session: "session",
    month: "month",
    project: "project",
    page: "page",
    square_meter: "square_meter",
    km: "km",
    package: "package",
    custom: "custom",
  };
  return mapped[unit] && QUOTE_UNIT_LABELS[mapped[unit]]
    ? mapped[unit]
    : "unit";
}

function billingMethod(method: ServicePaymentMethod | "not_selected") {
  if (method === "credit_card" || method === "bank_slip") return method;
  return "pix";
}

function CheckoutStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="grid size-6 place-items-center rounded-full bg-slate-900 text-[11px] text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: ServiceCustomField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
          {field.label}
        </span>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );
  }
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {field.label}
      </span>
      {field.type === "long_text" ? (
        <Textarea
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      ) : (
        <Input
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? "date"
                : "text"
          }
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </label>
  );
}
