export type FinanceTransactionType = "income" | "expense";
export type FinanceTransactionStatus = "paid" | "pending" | "overdue";
export type FinanceRecurrence = "monthly" | "weekly" | "yearly";
export type FinancePaymentMethod = "pix" | "bank_transfer" | "credit_card" | "bank_slip" | "cash" | "other";

export interface FinanceTransaction {
  id: string;
  type: FinanceTransactionType;
  description: string;
  clientId: string | null;
  partnerName: string;
  category: string;
  amount: number;
  dueDate: string;
  paidDate: string;
  status: FinanceTransactionStatus;
  paymentMethod: FinancePaymentMethod;
  account: string;
  recurring: boolean;
  recurrence: FinanceRecurrence;
  recurrenceEndDate: string;
  notes: string;
  attachmentName: string;
  createdAt: string;
  updatedAt: string;
}

export type FinanceTransactionDraft = Omit<FinanceTransaction, "id" | "createdAt" | "updatedAt">;

export const FINANCE_STATUS_LABELS: Record<FinanceTransactionStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Em atraso",
};

export const PAYMENT_METHOD_LABELS: Record<FinancePaymentMethod, string> = {
  pix: "Pix",
  bank_transfer: "Transferência",
  credit_card: "Cartão",
  bank_slip: "Boleto",
  cash: "Dinheiro",
  other: "Outro",
};

export const INCOME_CATEGORIES = ["Serviços recorrentes", "Projeto avulso", "Consultoria", "Comissão", "Outras receitas"];
export const EXPENSE_CATEGORIES = ["Software e ferramentas", "Marketing", "Infraestrutura", "Impostos", "Serviços terceirizados", "Outras despesas"];
