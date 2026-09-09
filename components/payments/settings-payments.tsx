"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  RefreshCw,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  paymentPost,
  paymentRequest,
  paymentMessage,
  usePayments,
} from "@/features/payments/api";
import {
  PROVIDER_NAMES,
  type ProviderId,
  type PublicConnection,
  type PaymentAudit,
} from "@/shared/payments";
import { s, PayButton, PayDialog, PaymentAccess, dateLabel } from "./common";
const connectionLabels = {
  connected: "Conectado",
  disconnected: "Não conectado",
  reconnect_required: "Reconexão necessária",
  error: "Erro de conexão",
};
const auditLabels: Record<string, string> = {
  "provider.connected": "Conta conectada",
  "provider.disconnected": "Conta desconectada",
  "provider.default": "Provedor padrão atualizado",
  "charge.created": "Cobrança criada",
  "charge.paid": "Pagamento confirmado",
  "charge.failed": "Pagamento recusado",
  "charge.refunded": "Estorno confirmado",
  "charge.refund_requested": "Estorno solicitado",
  "charge.cancel_requested": "Cancelamento solicitado",
  "webhook.processed": "Pagamento sincronizado",
  "webhook.failed": "Falha na sincronização",
  "integration.failed": "Falha de conexão",
};
export function SettingsPayments() {
  const { overview, error, loading, reload } = usePayments();
  const [busy, setBusy] = useState(false);
  const [disconnect, setDisconnect] = useState<PublicConnection | null>(null);
  const [manage, setManage] = useState<PublicConnection | null>(null);
  const [setup, setSetup] = useState<string | null>(null);
  const [audit, setAudit] = useState<PaymentAudit[]>([]);
  const act = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      if (success) toast.success(success);
    } catch (e) {
      toast.error(paymentMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const connect = (provider: ProviderId, mode: string, configured: boolean) => {
    if (!configured)
      return setSetup(
        `A conexão com ${PROVIDER_NAMES[provider]} precisa ser habilitada pela equipe Weeki antes da autorização da sua conta.`,
      );
    if (mode === "server_provisioned")
      return setSetup(
        "A conexão Asaas é habilitada com segurança pela equipe Weeki para o seu espaço. As chaves da sua conta não são solicitadas nem armazenadas neste navegador.",
      );
    void act(async () => {
      const result = await paymentPost<{ url: string }>(
        `/providers/${provider}/connect`,
      );
      window.location.assign(result.url);
    });
  };
  const openManage = (c: PublicConnection) => {
    setManage(c);
    setAudit([]);
    void paymentRequest<PaymentAudit[]>("/audit")
      .then((events) => setAudit(events.filter((e) => e.connectionId === c.id)))
      .catch((e) => toast.error(paymentMessage(e)));
  };
  const connected =
    overview?.connections.filter((c) => c.status === "connected") || [];
  return (
    <section className={s.root} aria-label="Pagamentos">
      <div className={s.header}>
        <div>
          <h2>Pagamentos</h2>
          <p className={s.muted}>
            Conecte suas contas e escolha como receber pelas suas cobranças.
          </p>
        </div>
        {overview && (
          <div className={s.actions}>
            <span className={s.status}>
              {overview.environment === "sandbox"
                ? "Ambiente de testes"
                : "Produção"}
            </span>
            <PayButton
              disabled={busy}
              onClick={() =>
                void act(() => paymentPost("/auth/logout"), "Sessão encerrada.")
              }
              aria-label="Encerrar sessão de pagamentos"
            >
              <LogOut size={14} />
            </PayButton>
          </div>
        )}
      </div>
      {loading ? (
        <p className={s.muted} role="status">
          Carregando pagamentos…
        </p>
      ) : !overview ? (
        <PaymentAccess error={error} retry={reload} />
      ) : (
        <>
          <h3 className="mb-3">Provedores de pagamento</h3>
          <div className={s.list}>
            {overview.providers.map((provider) => {
              const c =
                overview.connections.find(
                  (c) =>
                    c.provider === provider.id && c.status !== "disconnected",
                ) ||
                overview.connections.find((c) => c.provider === provider.id);
              const active = c?.status === "connected",
                problem =
                  c && ["reconnect_required", "error"].includes(c.status);
              return (
                <article className={s.provider} key={provider.id}>
                  <span className={s.logo} aria-hidden>
                    {PROVIDER_NAMES[provider.id].slice(0, 1)}
                  </span>
                  <div>
                    <div className={s.providerTitle}>
                      <h3>{PROVIDER_NAMES[provider.id]}</h3>
                      <span
                        className={`${s.status} ${active ? s.connected : problem ? s.problem : ""}`}
                      >
                        {connectionLabels[c?.status || "disconnected"]}
                      </span>
                      {c?.isDefault && (
                        <span className={s.muted}>
                          <Check size={12} className="inline" /> Padrão
                        </span>
                      )}
                    </div>
                    <p className={s.muted}>
                      Receba pagamentos através da sua conta{" "}
                      {PROVIDER_NAMES[provider.id]}.
                    </p>
                    {c && c.status !== "disconnected" && (
                      <>
                        <p className="mt-3!">
                          {c.accountName}{" "}
                          <span className={s.muted}>{c.maskedEmail}</span>
                        </p>
                        <div className={s.metadata}>
                          <span>Conectado em {dateLabel(c.connectedAt)}</span>
                          <span>
                            Última sincronização: {dateLabel(c.lastSyncAt)}
                          </span>
                        </div>
                      </>
                    )}
                    {problem && (
                      <p className={`${s.muted} ${s.problem}`}>
                        Verifique a autorização ou a situação da conta no
                        provedor e reconecte.
                      </p>
                    )}
                  </div>
                  <div className={s.actions}>
                    {active ? (
                      <PayButton onClick={() => openManage(c!)}>
                        Gerenciar
                      </PayButton>
                    ) : (
                      <PayButton
                        disabled={busy}
                        onClick={() =>
                          connect(
                            provider.id,
                            provider.connectionMode,
                            provider.configured,
                          )
                        }
                      >
                        {problem ? "Reconectar" : "Conectar"}
                        <ArrowUpRight size={13} />
                      </PayButton>
                    )}
                    {c && c.status !== "disconnected" && (
                      <PayButton
                        disabled={busy}
                        onClick={() => setDisconnect(c)}
                      >
                        Desconectar
                      </PayButton>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className={s.default}>
            <div>
              <h3>Provedor padrão para cobranças</h3>
              <p className={s.muted}>
                Você pode escolher outra conta conectada ao criar uma cobrança.
              </p>
            </div>
            <label className={s.field}>
              <span className="sr-only">Provedor padrão para cobranças</span>
              <select
                className={s.select}
                value={connected.find((c) => c.isDefault)?.id || ""}
                disabled={!connected.length || busy}
                onChange={(e) =>
                  void act(
                    () => paymentPost(`/connections/${e.target.value}/default`),
                    "Provedor padrão atualizado.",
                  )
                }
              >
                {!connected.length && (
                  <option value="">Conecte uma conta primeiro</option>
                )}
                {connected.map((c) => (
                  <option value={c.id} key={c.id}>
                    {PROVIDER_NAMES[c.provider]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={s.muted}>
            <ShieldCheck size={14} className="mr-1.5 inline" />
            Os pagamentos são processados na sua conta do provedor. A Weeki
            acompanha as cobranças.
          </p>
        </>
      )}
      {setup && (
        <PayDialog
          title="Habilitar conexão"
          description={setup}
          onClose={() => setSetup(null)}
        >
          <div className={s.footer}>
            <PayButton primary onClick={() => setSetup(null)}>
              Entendi
            </PayButton>
          </div>
        </PayDialog>
      )}
      {disconnect && (
        <PayDialog
          title={`Desconectar ${PROVIDER_NAMES[disconnect.provider]}?`}
          description="Novas cobranças não poderão ser criadas através desta conta. As cobranças existentes continuarão disponíveis para consulta na Weeki."
          onClose={() => {
            if (!busy) setDisconnect(null);
          }}
        >
          <p className={s.muted}>
            A atualização automática será interrompida. Se necessário, revogue
            também a autorização no painel do provedor.
          </p>
          <div className={s.footer}>
            <PayButton disabled={busy} onClick={() => setDisconnect(null)}>
              Cancelar
            </PayButton>
            <PayButton
              danger
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const r = await paymentPost<{ revocationPending?: boolean }>(
                    `/connections/${disconnect.id}/disconnect`,
                  );
                  setDisconnect(null);
                  if (r.revocationPending)
                    toast.info(
                      "Conta desconectada da Weeki. Conclua a revogação no painel do provedor.",
                    );
                }, "Conta desconectada.")
              }
            >
              {busy ? "Desconectando…" : "Desconectar"}
            </PayButton>
          </div>
        </PayDialog>
      )}
      {manage && (
        <PayDialog
          title={PROVIDER_NAMES[manage.provider]}
          description={`${manage.accountName} · ${manage.maskedEmail}`}
          onClose={() => setManage(null)}
        >
          <dl className={s.details}>
            <div>
              <dt>Status</dt>
              <dd>{connectionLabels[manage.status]}</dd>
            </div>
            <div>
              <dt>Conta</dt>
              <dd>{manage.externalAccountId}</dd>
            </div>
            <div>
              <dt>Conectado em</dt>
              <dd>{dateLabel(manage.connectedAt)}</dd>
            </div>
            <div>
              <dt>Última sincronização</dt>
              <dd>{dateLabel(manage.lastSyncAt)}</dd>
            </div>
          </dl>
          <h3>Atividade recente</h3>
          {audit.length ? (
            audit.slice(0, 8).map((e) => (
              <div className={s.history} key={e.id}>
                <span>{auditLabels[e.action] || "Cobrança atualizada"}</span>
                <span className={s.muted}>{dateLabel(e.createdAt)}</span>
              </div>
            ))
          ) : (
            <p className={s.muted}>Nenhuma atividade recente.</p>
          )}
          <div className={s.footer}>
            <PayButton
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const c = await paymentPost<PublicConnection>(
                    `/connections/${manage.id}/sync`,
                  );
                  setManage(c);
                }, "Conta sincronizada.")
              }
            >
              <RefreshCw size={13} /> Sincronizar conta
            </PayButton>
            <PayButton
              disabled={busy}
              onClick={() =>
                void act(
                  () => paymentPost(`/connections/${manage.id}/retry-webhooks`),
                  "Sincronizações com falha serão tentadas novamente.",
                )
              }
            >
              Reprocessar falhas
            </PayButton>
            <PayButton onClick={() => setManage(null)}>Fechar</PayButton>
          </div>
        </PayDialog>
      )}
    </section>
  );
}
