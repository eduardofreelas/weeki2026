export const WEEKI_DOMAIN_EVENTS = {
  serviceCompleted: "weeki.domain.service.completed",
  paymentConfirmed: "weeki.domain.payment.confirmed",
} as const;

export interface ServiceCompletedEvent {
  taskId: string;
  clientId: string | null;
  title: string;
  description: string;
  completedAt: string;
}

export interface PaymentConfirmedEvent {
  chargeId: string;
  clientId: string;
  description: string;
  amount: number;
  paidAt: string;
}

export function publishServiceCompleted(detail: ServiceCompletedEvent) {
  window.dispatchEvent(new CustomEvent(WEEKI_DOMAIN_EVENTS.serviceCompleted, { detail }));
}

export function publishPaymentConfirmed(detail: PaymentConfirmedEvent) {
  window.dispatchEvent(new CustomEvent(WEEKI_DOMAIN_EVENTS.paymentConfirmed, { detail }));
}
