export type ClientStatus = "active" | "negotiating" | "inactive";
export type ClientKind = "company" | "person";
export type ContractKind = "fixed" | "one_time" | "none";
export type PaymentStatus = "paid" | "pending" | "overdue" | "none";

export interface ClientFile {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

export interface ClientLink {
  id: string;
  label: string;
  url: string;
}

export interface Client {
  id: string;
  name: string;
  color: string;
  initials: string;
  logoUrl: string;
  kind: ClientKind;
  document: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  notes: string;
  status: ClientStatus;
  segment: string;
  contractValue: number;
  contractKind: ContractKind;
  nextDueDate: string;
  paymentStatus: PaymentStatus;
  files: ClientFile[];
  links: ClientLink[];
  createdAt: string;
  updatedAt: string;
}

export type ClientDraft = Omit<Client, "id" | "initials" | "createdAt" | "updatedAt">;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Ativo",
  negotiating: "Em negociação",
  inactive: "Inativo",
};

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  company: "Pessoa jurídica",
  person: "Pessoa física",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Em dia / Pago",
  pending: "Pendente",
  overdue: "Em atraso",
  none: "Não informado",
};
