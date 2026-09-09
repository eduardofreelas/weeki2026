export const PAYMENT_PAGE_SIZE = 100;
export const PROVIDERS = ["asaas", "mercadopago", "stripe"] as const;
export type ProviderId = (typeof PROVIDERS)[number];
export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELED"
  | "REFUNDED"
  | "FAILED"
  | "PROCESSING"
  | "PARTIALLY_REFUNDED";
export type PaymentMethod = "pix" | "credit_card" | "bank_slip";
export type ConnectionStatus =
  "connected" | "disconnected" | "reconnect_required" | "error";
export type Environment = "sandbox" | "production";
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  asaas: "Asaas",
  mercadopago: "Mercado Pago",
  stripe: "Stripe",
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELED: "Cancelado",
  REFUNDED: "Estornado",
  FAILED: "Recusado",
  PROCESSING: "Processando",
  PARTIALLY_REFUNDED: "Estorno parcial",
};
export interface Capabilities {
  methods: PaymentMethod[];
  multipleMethods: boolean;
  cancel: boolean;
  refund: boolean;
  maxInstallments: number;
  requiresDocument?: boolean;
  manualRevocation?: boolean;
  checkoutNotice?: string;
}
export interface PublicConnection {
  id: string;
  provider: ProviderId;
  environment: Environment;
  externalAccountId: string;
  accountName: string;
  maskedEmail: string;
  status: ConnectionStatus;
  isDefault: boolean;
  connectedAt: string;
  lastSyncAt: string | null;
  capabilities: Capabilities;
  errorCode?: string;
}
export interface PaymentCharge {
  id: string;
  connectionId: string;
  provider: ProviderId;
  externalId: string | null;
  externalPaymentId?: string;
  customerId: string;
  customerName: string;
  description: string;
  amountMinor: number;
  currency: "BRL";
  status: PaymentStatus;
  providerStatus: string;
  methods: PaymentMethod[];
  paymentMethod?: PaymentMethod;
  dueDate: string;
  paymentUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  refundedMinor: number;
  lastSyncAt: string | null;
  errorCode?: string;
}
export interface PaymentCustomer {
  id: string;
  localId: string;
  name: string;
  email: string;
  document: string;
}
export interface NewCharge {
  customerId: string;
  description: string;
  amountMinor: number;
  dueDate: string;
  methods: PaymentMethod[];
  connectionId?: string;
}
export interface PaymentAudit {
  id: string;
  action: string;
  createdAt: string;
  chargeId?: string;
  connectionId?: string;
  errorCode?: string;
}
export interface PaymentFinanceEntry {
  id: string;
  chargeId: string;
  customerId: string;
  customerName: string;
  description: string;
  kind: "receipt" | "refund";
  amountMinor: number;
  currency: "BRL";
  createdAt: string;
  provider: ProviderId;
  paymentMethod?: PaymentMethod;
}
export interface PaymentsOverview {
  connections: PublicConnection[];
  providers: {
    id: ProviderId;
    configured: boolean;
    connectionMode: "oauth" | "server_provisioned";
  }[];
  workspaceId: string;
  environment: Environment;
}
