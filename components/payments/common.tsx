"use client";
import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { LogIn, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { paymentRequest, type PaymentsApiError } from "@/features/payments/api";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_PAGE_SIZE,
  type PaymentStatus,
} from "@/shared/payments";
import s from "./payments.module.css";
export { s };
export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dateLabel = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? value + "T12:00:00" : value,
      ).toLocaleDateString("pt-BR")
    : "—";
export const methodLabels = {
  pix: "Pix",
  bank_slip: "Boleto",
  credit_card: "Cartão",
};
export function PayButton({
  children,
  primary,
  danger,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${s.button} ${primary ? s.primary : ""} ${danger ? s.danger : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function PayDialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={`${s.root} ${s.dialog}`}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          <DialogDescription className="text-xs leading-5">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function PayStatus({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`${s.status} ${status === "PAID" ? s.connected : ["FAILED", "OVERDUE"].includes(status) ? s.problem : ""}`}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
export function PaymentAccess({
  error,
  retry,
}: {
  error: PaymentsApiError | null;
  retry: () => void;
}) {
  const [loginEnabled, setLoginEnabled] = useState(false);
  useEffect(() => {
    void paymentRequest<{ loginEnabled: boolean }>("/health")
      .then((r) => setLoginEnabled(r.loginEnabled))
      .catch(() => setLoginEnabled(false));
  }, []);
  return (
    <div className={s.notice} role="status">
      <h3>
        {error?.code === "UNAUTHENTICATED"
          ? "Entre para acessar seus pagamentos"
          : "Pagamentos aguardando configuração"}
      </h3>
      <p className={s.muted}>
        {error?.code === "UNAUTHENTICATED"
          ? "Use sua conta Weeki para conectar provedores e acompanhar suas cobranças com segurança."
          : error?.message ||
            "A configuração de pagamentos ainda não foi concluída."}
      </p>
      <div className={s.actions}>
        {loginEnabled && (
          <a
            className={`${s.button} ${s.primary}`}
            href="/api/payments/auth/login"
          >
            <LogIn size={14} /> Entrar na Weeki
          </a>
        )}
        <PayButton onClick={retry}>
          <RefreshCw size={13} /> Tentar novamente
        </PayButton>
      </div>
    </div>
  );
}

export function PaymentPagination({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className={s.header} style={{ marginTop: 16 }}>
      <span className={s.muted}>
        Página {page + 1} · {count} registros nesta página
      </span>
      <div className={s.actions}>
        <PayButton disabled={page === 0} onClick={() => onChange(page - 1)}>
          Anterior
        </PayButton>
        <PayButton
          disabled={count < PAYMENT_PAGE_SIZE}
          onClick={() => onChange(page + 1)}
        >
          Próxima
        </PayButton>
      </div>
    </div>
  );
}
