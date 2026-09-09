"use client";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Plus,
  Settings2,
  RefreshCw,
  ExternalLink,
  Search,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/weeki/date-picker";
import type { Client } from "@/features/clients/types";
import {
  paymentRequest,
  paymentPost,
  paymentMessage,
  usePayments,
} from "@/features/payments/api";
import {
  PROVIDER_NAMES,
  PAYMENT_PAGE_SIZE,
  PAYMENT_STATUS_LABELS,
  type PaymentCharge,
  type PaymentCustomer,
  type PaymentStatus,
  type PublicConnection,
  type PaymentMethod,
} from "@/shared/payments";
import {
  s,
  PaymentPagination,
  PayButton,
  PayDialog,
  PayStatus,
  PaymentAccess,
  money,
  dateLabel,
  methodLabels,
} from "./common";
export function ConnectedCharges({
  clients,
  onSettings,
  legacy,
}: {
  clients: Client[];
  onSettings: () => void;
  legacy: ReactNode;
}) {
  const { overview, loading, error, reload } = usePayments();
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState("connected"),
    [charges, setCharges] = useState<PaymentCharge[]>([]),
    [form, setForm] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState<string | null>(null);
  const loadCharges = useCallback(async () => {
    if (!overview) {
      setCharges([]);
      return;
    }
    try {
      setCharges(
        await paymentRequest<PaymentCharge[]>(
          `/charges?offset=${page * PAYMENT_PAGE_SIZE}`,
        ),
      );
      setLoadError(null);
    } catch (e) {
      setCharges([]);
      setLoadError(paymentMessage(e));
    }
  }, [overview, page]);
  // Fetch authenticated server state on mount; no credentials or payment data are persisted in the browser.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCharges();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadCharges();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadCharges]);
  const refresh = async () => {
    setBusy(true);
    await reload();
    await loadCharges();
    setBusy(false);
  };
  const connected =
    overview?.connections.filter((c) => c.status === "connected") || [];
  const current = charges.find((c) => c.id === selected);
  const filtered = charges.filter(
    (c) =>
      (status === "all" || c.status === status) &&
      `${c.description} ${c.customerName}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const pending = charges
    .filter((c) => ["PENDING", "OVERDUE", "PROCESSING"].includes(c.status))
    .reduce((n, c) => n + c.amountMinor, 0);
  const received = charges
    .filter((c) =>
      ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(c.status),
    )
    .reduce((n, c) => n + c.amountMinor - c.refundedMinor, 0);
  return (
    <>
      <div className={`${s.root} ${s.page}`}>
        <div className={s.header}>
          <div>
            <h2 className="text-[23px]!">Cobranças</h2>
            <p className={s.muted}>
              Uma visão das suas cobranças, em todas as contas conectadas.
            </p>
          </div>
          <div className={s.actions}>
            <PayButton onClick={onSettings}>
              <Settings2 size={14} /> Pagamentos
            </PayButton>
            <PayButton
              primary
              disabled={!connected.length}
              onClick={() => setForm(true)}
            >
              <Plus size={14} /> Nova cobrança
            </PayButton>
          </div>
        </div>
        <div
          className={s.tabs}
          role="tablist"
          aria-label="Origem das cobranças"
        >
          <button
            role="tab"
            className={s.tab}
            aria-selected={tab === "connected"}
            onClick={() => setTab("connected")}
          >
            Contas conectadas
          </button>
          <button
            role="tab"
            className={s.tab}
            aria-selected={tab === "legacy"}
            onClick={() => setTab("legacy")}
          >
            Histórico local
          </button>
        </div>
        {tab === "legacy" ? (
          <p className={s.muted}>
            Registros da versão anterior, preservados neste navegador. Links
            demonstrativos e baixas manuais não representam pagamentos
            confirmados por um provedor.
          </p>
        ) : loading ? (
          <p role="status">Carregando cobranças…</p>
        ) : !overview ? (
          <PaymentAccess error={error} retry={reload} />
        ) : (
          <>
            <p className={s.muted}>
              {overview.environment === "sandbox"
                ? "Ambiente de testes · nenhum recebimento real"
                : "Produção · recebimento direto nas contas conectadas"}
            </p>
            {!connected.length && (
              <div className={s.notice}>
                <h3>Conecte uma conta para começar</h3>
                <p className={s.muted}>
                  Escolha seu provedor em Configurações → Pagamentos.
                </p>
                <div className={s.actions}>
                  <PayButton onClick={onSettings}>Conectar provedor</PayButton>
                </div>
              </div>
            )}
            <p className={`${s.muted} mt-4!`}>Valores da página atual</p>
            <div className={`${s.stats} mt-5`}>
              <div>
                <span className={s.muted}>Em aberto</span>
                <strong>{money(pending)}</strong>
              </div>
              <div>
                <span className={s.muted}>Recebido, descontando estornos</span>
                <strong>{money(received)}</strong>
              </div>
              <div>
                <span className={s.muted}>Cobranças</span>
                <strong>{charges.length}</strong>
              </div>
            </div>
            <div className={s.filters}>
              <label className={s.field}>
                <span className="sr-only">Buscar cobranças</span>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-3 text-slate-400"
                  />
                  <input
                    className={s.input}
                    style={{ paddingLeft: 34 }}
                    placeholder="Buscar nesta página"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </label>
              <div className={s.actions}>
                <select
                  className={s.select}
                  style={{ flex: 1 }}
                  aria-label="Filtrar status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Todos os status</option>
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
                <PayButton
                  disabled={busy}
                  onClick={() => void refresh()}
                  aria-label="Atualizar cobranças"
                >
                  <RefreshCw size={14} />
                </PayButton>
              </div>
            </div>
            {loadError && (
              <p role="alert" className={s.notice}>
                {loadError}
              </p>
            )}
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Descrição / Cliente</th>
                    <th>Provedor</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button
                          className={s.textButton}
                          onClick={() => setSelected(c.id)}
                        >
                          {c.description}
                        </button>
                        <p className={s.muted}>{c.customerName}</p>
                      </td>
                      <td>{PROVIDER_NAMES[c.provider]}</td>
                      <td>{money(c.amountMinor)}</td>
                      <td>{dateLabel(c.dueDate)}</td>
                      <td>
                        <PayStatus status={c.status} />
                      </td>
                      <td>
                        <PayButton onClick={() => setSelected(c.id)}>
                          Detalhes
                        </PayButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaymentPagination
              page={page}
              count={charges.length}
              onChange={setPage}
            />
            {!filtered.length && (
              <div className={s.empty}>
                Nenhuma cobrança{" "}
                {query || status !== "all"
                  ? "encontrada com esses filtros."
                  : "neste espaço ainda."}
              </div>
            )}
          </>
        )}
      </div>
      {tab === "legacy" && legacy}
      {form && (
        <ChargeForm
          clients={clients}
          connections={connected}
          onClose={() => setForm(false)}
          onCreated={async (c) => {
            setForm(false);
            setPage(0);
            setTab("connected");
            await loadCharges();
            setSelected(c.id);
          }}
        />
      )}
      {current && (
        <ChargeDetail
          charge={current}
          connection={overview?.connections.find(
            (c) => c.id === current.connectionId,
          )}
          onClose={() => setSelected(null)}
          onUpdate={loadCharges}
        />
      )}
    </>
  );
}
function ChargeForm({
  clients,
  connections,
  onClose,
  onCreated,
}: {
  clients: Client[];
  connections: PublicConnection[];
  onClose: () => void;
  onCreated: (c: PaymentCharge) => Promise<void>;
}) {
  const [connectionId, setConnectionId] = useState(
    connections.find((c) => c.isDefault)?.id || connections[0]?.id || "",
  );
  const connection = connections.find((c) => c.id === connectionId)!;
  const [clientId, setClientId] = useState(""),
    [description, setDescription] = useState(""),
    [amount, setAmount] = useState(""),
    [dueDate, setDueDate] = useState(new Date().toLocaleDateString("en-CA")),
    [methods, setMethods] = useState<PaymentMethod[]>(
      connection?.capabilities.methods.slice(0, 1) || [],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const selectProvider = (id: string) => {
    setConnectionId(id);
    setMethods(
      connections.find((c) => c.id === id)!.capabilities.methods.slice(0, 1),
    );
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    if (!client) return setError("Selecione um cliente.");
    const amountMinor = Math.round(Number(amount.replace(",", ".")) * 100);
    if (
      !Number.isSafeInteger(amountMinor) ||
      amountMinor <= 0 ||
      !/^\d+(?:[,.]\d{1,2})?$/.test(amount)
    )
      return setError("Informe um valor válido, com até duas casas decimais.");
    if (
      !client.email ||
      (connection.capabilities.requiresDocument && !client.document)
    )
      return setError(
        "Complete o e-mail e o CPF/CNPJ no cadastro do cliente antes de continuar.",
      );
    setBusy(true);
    setError("");
    try {
      const customer = await paymentPost<PaymentCustomer>("/customers", {
        localId: client.id,
        name: client.name,
        email: client.email,
        document: client.document.replace(/\D/g, ""),
      });
      const charge = await paymentPost<PaymentCharge>(
        "/charges",
        {
          customerId: customer.id,
          connectionId,
          description,
          amountMinor,
          dueDate,
          methods,
        },
        key,
      );
      await onCreated(charge);
      toast[charge.externalId ? "success" : "info"](
        charge.externalId
          ? "Cobrança criada na conta conectada."
          : "Cobrança registrada. A confirmação do provedor ainda está pendente.",
      );
    } catch (e) {
      setError(paymentMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <PayDialog
      title="Nova cobrança"
      description="O pagamento será processado diretamente na sua conta conectada."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className={s.form} onSubmit={submit}>
        <label className={s.field}>
          Cliente
          <select
            className={s.select}
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Selecione um cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          Descrição
          <input
            className={s.input}
            required
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Consultoria — Setembro"
          />
        </label>
        <div className={s.columns}>
          <label className={s.field}>
            Valor (R$)
            <input
              className={s.input}
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="850,00"
            />
          </label>
          <label className={s.field}>
            Vencimento
            <DatePicker
              className={s.input}
              required
              value={dueDate}
              min={new Date().toLocaleDateString("en-CA")}
              onChange={setDueDate}
            />
          </label>
        </div>
        <label className={s.field}>
          Receber através de
          <select
            className={s.select}
            value={connectionId}
            onChange={(e) => selectProvider(e.target.value)}
          >
            {connections.map((c) => (
              <option value={c.id} key={c.id}>
                {PROVIDER_NAMES[c.provider]}
                {c.isDefault ? " · Padrão" : ""}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className={s.field}>Métodos aceitos</legend>
          <div className={s.methods}>
            {connection.capabilities.methods.map((m) => (
              <label key={m}>
                <input
                  type={
                    connection.capabilities.multipleMethods
                      ? "checkbox"
                      : "radio"
                  }
                  name="payment-method"
                  checked={methods.includes(m)}
                  onChange={(e) =>
                    setMethods(
                      connection.capabilities.multipleMethods
                        ? e.target.checked
                          ? [...methods, m]
                          : methods.filter((v) => v !== m)
                        : [m],
                    )
                  }
                />
                {methodLabels[m]}
              </label>
            ))}
          </div>
        </fieldset>
        {connection.capabilities.checkoutNotice && (
          <p className={s.muted}>{connection.capabilities.checkoutNotice}</p>
        )}
        {error && (
          <p className={s.notice} role="alert">
            {error}
          </p>
        )}
        <div className={s.footer}>
          <PayButton disabled={busy} onClick={onClose}>
            Cancelar
          </PayButton>
          <PayButton type="submit" primary disabled={busy || !methods.length}>
            {busy ? "Criando…" : "Criar cobrança"}
          </PayButton>
        </div>
      </form>
    </PayDialog>
  );
}
function ChargeDetail({
  charge,
  connection,
  onClose,
  onUpdate,
}: {
  charge: PaymentCharge;
  connection?: PublicConnection;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<"cancel" | "refund" | null>(null);
  const connected = connection?.status === "connected";
  const run = async (action: string) => {
    setBusy(true);
    try {
      await paymentPost(`/charges/${charge.id}/${action}`);
      await onUpdate();
      setConfirm(null);
      toast.success(
        action === "sync"
          ? "Cobrança sincronizada."
          : "Solicitação enviada. O status acompanha a confirmação do provedor.",
      );
    } catch (e) {
      toast.error(paymentMessage(e));
      await onUpdate();
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(charge.paymentUrl!);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };
  return (
    <PayDialog
      title={charge.description}
      description={`${charge.customerName} · ${PROVIDER_NAMES[charge.provider]}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <dl className={s.details}>
        <div>
          <dt>Valor</dt>
          <dd>{money(charge.amountMinor)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <PayStatus status={charge.status} />
          </dd>
        </div>
        <div>
          <dt>Vencimento</dt>
          <dd>{dateLabel(charge.dueDate)}</dd>
        </div>
        <div>
          <dt>Última sincronização</dt>
          <dd>{dateLabel(charge.lastSyncAt)}</dd>
        </div>
        <div>
          <dt>Pagamento confirmado</dt>
          <dd>{dateLabel(charge.paidAt)}</dd>
        </div>
        <div>
          <dt>Estornado</dt>
          <dd>{money(charge.refundedMinor)}</dd>
        </div>
      </dl>
      {!connected && (
        <p className={s.notice}>
          A conta está desconectada. O histórico permanece disponível; reconecte
          a mesma conta para atualizar o status.
        </p>
      )}
      {charge.errorCode && (
        <p className={s.notice}>
          O provedor ainda não confirmou esta operação. Atualize o status antes
          de tentar criar outra cobrança. Se o aviso persistir, entre em contato
          com a equipe Weeki.
        </p>
      )}
      {charge.paymentUrl && (
        <div className={s.actions}>
          <a
            className={s.button}
            href={charge.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={13} /> Abrir checkout
          </a>
          <PayButton onClick={() => void copy()}>
            <Copy size={13} /> Copiar link
          </PayButton>
        </div>
      )}
      {confirm ? (
        <div className={s.notice}>
          <h3>
            {confirm === "refund"
              ? `Estornar ${money(charge.amountMinor - charge.refundedMinor)}?`
              : "Cancelar esta cobrança?"}
          </h3>
          <p className={s.muted}>
            {confirm === "refund"
              ? "O valor restante será solicitado ao provedor para devolução ao cliente."
              : "A Weeki solicitará o cancelamento ao provedor, sujeito ao estado atual do pagamento."}
          </p>
          <div className={s.actions}>
            <PayButton disabled={busy} onClick={() => setConfirm(null)}>
              Voltar
            </PayButton>
            <PayButton danger disabled={busy} onClick={() => void run(confirm)}>
              Confirmar {confirm === "refund" ? "estorno" : "cancelamento"}
            </PayButton>
          </div>
        </div>
      ) : (
        <div className={s.actions} style={{ marginTop: 18 }}>
          {connection?.capabilities.cancel &&
            ["PENDING", "OVERDUE", "PROCESSING", "FAILED"].includes(
              charge.status,
            ) && (
              <PayButton
                disabled={busy || !connected || !charge.externalId}
                onClick={() => setConfirm("cancel")}
              >
                Cancelar cobrança
              </PayButton>
            )}
          {connection?.capabilities.refund &&
            (["PAID", "PARTIALLY_REFUNDED"] as PaymentStatus[]).includes(
              charge.status,
            ) && (
              <PayButton
                disabled={busy || !connected}
                onClick={() => setConfirm("refund")}
              >
                Solicitar estorno
              </PayButton>
            )}
        </div>
      )}
      <div className={s.footer}>
        <PayButton
          disabled={busy || !connected}
          onClick={() => void run("sync")}
        >
          <RefreshCw size={13} /> {busy ? "Atualizando…" : "Sincronizar"}
        </PayButton>
        <PayButton onClick={onClose}>Fechar</PayButton>
      </div>
    </PayDialog>
  );
}
