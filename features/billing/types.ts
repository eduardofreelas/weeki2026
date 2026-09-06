export type BillingStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";
export type BillingMethod = "pix" | "credit_card" | "bank_slip";
export type BillingSendChannel = "copied" | "whatsapp" | "email";
export type BillingEventKind = "created" | "updated" | "sent" | "opened" | "paid" | "due_extended" | "cancelled";

export interface BillingEvent {
  id: string;
  kind: BillingEventKind;
  title: string;
  description: string;
  createdAt: string;
}

export interface BillingCharge {
  id: string;
  code: string;
  clientId: string;
  description: string;
  amount: number;
  dueDate: string;
  dueTime: string;
  status: BillingStatus;
  methods: BillingMethod[];
  cardMaxInstallments: number;
  passCardFees: boolean;
  discountEnabled: boolean;
  discountMethod: BillingMethod;
  discountPercent: number;
  remindersEnabled: boolean;
  lateFeeEnabled: boolean;
  lateFeePercent: number;
  dailyInterestPercent: number;
  message: string;
  paymentLink: string;
  accessCount: number;
  lastAccessAt: string;
  paidAt: string;
  sentChannels: BillingSendChannel[];
  events: BillingEvent[];
  createdAt: string;
  updatedAt: string;
}

export type BillingChargeDraft = Omit<BillingCharge, "id" | "code" | "status" | "paymentLink" | "accessCount" | "lastAccessAt" | "paidAt" | "sentChannels" | "events" | "createdAt" | "updatedAt">;

export interface BillingGatewaySettings {
  provider: "asaas";
  connected: boolean;
  environment: "sandbox" | "production";
  pixEnabled: boolean;
  cardEnabled: boolean;
  bankSlipEnabled: boolean;
}

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = {
  pix: "Pix",
  credit_card: "Cartão",
  bank_slip: "Boleto",
};
