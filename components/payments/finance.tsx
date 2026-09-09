"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import {
  paymentMessage,
  paymentRequest,
  usePayments,
} from "@/features/payments/api";
import {
  PROVIDER_NAMES,
  PAYMENT_PAGE_SIZE,
  type PaymentFinanceEntry,
} from "@/shared/payments";
import {
  s,
  PayButton,
  PaymentAccess,
  PaymentPagination,
  money,
  dateLabel,
} from "./common";
export function ConnectedFinance({ legacy }: { legacy: ReactNode }) {
  const { overview, error, loading, reload } = usePayments();
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState("connected"),
    [entries, setEntries] = useState<PaymentFinanceEntry[]>([]),
    [failure, setFailure] = useState("");
  const refresh = useCallback(async () => {
    if (!overview) {
      setEntries([]);
      return;
    }
    try {
      setEntries(
        await paymentRequest<PaymentFinanceEntry[]>(
          `/finance?offset=${page * PAYMENT_PAGE_SIZE}`,
        ),
      );
      setFailure("");
    } catch (e) {
      setEntries([]);
      setFailure(paymentMessage(e));
    }
  }, [overview, page]);
  // Fetch authenticated server state on mount; no credentials or payment data are persisted in the browser.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  const receipts = entries
      .filter((e) => e.kind === "receipt")
      .reduce((n, e) => n + e.amountMinor, 0),
    refunds = entries
      .filter((e) => e.kind === "refund")
      .reduce((n, e) => n + e.amountMinor, 0);
  return (
    <>
      <section className={`${s.root} ${s.page}`}>
        <div className={s.header}>
          <div>
            <h2 className="text-[23px]!">Financeiro</h2>
            <p className={s.muted}>
              Recebimentos confirmados e estornos das suas cobranças.
            </p>
          </div>
          <PayButton
            onClick={() => {
              void reload();
              void refresh();
            }}
          >
            <RefreshCw size={14} /> Atualizar
          </PayButton>
        </div>
        <div
          className={s.tabs}
          role="tablist"
          aria-label="Origem dos lançamentos"
        >
          <button
            className={s.tab}
            role="tab"
            aria-selected={tab === "connected"}
            onClick={() => setTab("connected")}
          >
            Contas conectadas
          </button>
          <button
            className={s.tab}
            role="tab"
            aria-selected={tab === "local"}
            onClick={() => setTab("local")}
          >
            Gestão local
          </button>
        </div>
        {tab === "local" ? (
          <p className={s.muted}>
            Lançamentos manuais e dados da versão anterior, preservados neste
            navegador.
          </p>
        ) : loading ? (
          <p role="status">Carregando lançamentos…</p>
        ) : !overview ? (
          <PaymentAccess error={error} retry={reload} />
        ) : (
          <>
            <p className={s.muted}>
              {overview.environment === "sandbox"
                ? "Ambiente de testes"
                : "Produção"}{" "}
              · Valores brutos; taxas e saldo bancário são consultados no
              provedor.
            </p>
            <p className={`${s.muted} mt-4!`}>Valores da página atual</p>
            <div className={`${s.stats} mt-5`}>
              <div>
                <span className={s.muted}>Recebimentos</span>
                <strong>{money(receipts)}</strong>
              </div>
              <div>
                <span className={s.muted}>Estornos</span>
                <strong>{money(refunds)}</strong>
              </div>
              <div>
                <span className={s.muted}>Após estornos</span>
                <strong>{money(receipts - refunds)}</strong>
              </div>
            </div>
            {failure && (
              <p role="alert" className={s.notice}>
                {failure}
              </p>
            )}
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Descrição / Cliente</th>
                    <th>Provedor</th>
                    <th>Tipo</th>
                    <th>Data do registro</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {e.description}
                        <p className={s.muted}>{e.customerName}</p>
                      </td>
                      <td>{PROVIDER_NAMES[e.provider]}</td>
                      <td>
                        {e.kind === "receipt" ? "Recebimento" : "Estorno"}
                      </td>
                      <td>{dateLabel(e.createdAt)}</td>
                      <td>
                        {e.kind === "refund" ? "− " : "+ "}
                        {money(e.amountMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaymentPagination
              page={page}
              count={entries.length}
              onChange={setPage}
            />
            {!entries.length && (
              <p className={s.empty}>
                Os lançamentos aparecem após a confirmação do provedor.
              </p>
            )}
          </>
        )}
      </section>
      {tab === "local" && legacy}
    </>
  );
}
