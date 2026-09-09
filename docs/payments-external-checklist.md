# Checklist de ativação externa

O código implementa as integrações, mas a ativação depende dos itens abaixo. Configure segredos exclusivamente nas variáveis privadas do servidor ou no secret manager. Não envie chaves pelo chat, GitHub, arquivos públicos ou frontend.

## Infraestrutura e login

- [ ] Aplicação Node 22.13+ persistente, PostgreSQL e domínio HTTPS de mesma origem.
- [ ] Configurar `APP_ORIGIN`, `DATABASE_URL` e `PAYMENTS_ENCRYPTION_KEY` (32 bytes aleatórios em base64; backup cifrado separado).
- [ ] Exportar os dados locais da Weeki, criar snapshot do banco quando existente e validar a restauração.
- [ ] Aplicar `npm run db:migrate:payments` com papel de migration e configurar papel restrito para runtime.
- [ ] Cadastrar aplicação web OIDC com Authorization Code, PKCE e `client_secret_post`; configurar issuer, Client ID e Client Secret. Callback: `APP_ORIGIN/api/payments/auth/callback`.
- [ ] Configurar build `npm run build:full` e inicialização `npm run start:payments`. Publicar somente `out/` não ativa as APIs.
- [ ] Configurar reinício, monitoramento, rate limiting no proxy e supressão de query strings de OAuth nos logs.

## Provedores

| Provedor | Configurar externamente | Callback / webhook |
| --- | --- | --- |
| Asaas | Conta sandbox do prestador, API key individual provisionada pelo administrador via comando seguro no servidor e `PAYMENTS_ALERT_EMAIL`. A ativação é assistida nesta versão. | Webhook criado pelo adapter: `APP_ORIGIN/webhooks/asaas/CONNECTION_UUID` |
| Mercado Pago | Aplicação OAuth com PKCE, permissões `offline_access/read/write`, `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET` e usuários de teste. | Callback: `APP_ORIGIN/api/payments/oauth/mercadopago/callback`. Notificações de pagamento: `APP_ORIGIN/webhooks/mercadopago/CONNECTION_UUID` |
| Stripe | Connect Standard OAuth, conta conectada de teste, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e métodos habilitados na conta. | Callback: `APP_ORIGIN/api/payments/oauth/stripe/callback`. Webhook de contas conectadas: `APP_ORIGIN/webhooks/stripe` |

A lista de eventos Stripe, instruções de provisionamento Asaas e detalhes de cada configuração estão em [payments.md](payments.md). Não há credenciais inventadas nem indicadores de conexão simulada na nova seção.

## Homologação antes da produção

- [ ] Manter `PAYMENTS_ENVIRONMENT=sandbox` e `PAYMENTS_LIVE_ENABLED=false`.
- [ ] Testar autorização, reconexão, troca de padrão e desconexão em contas de teste.
- [ ] Validar checkout e confirmação, recusa, cancelamento, estorno, notificações duplicadas e credenciais revogadas em cada provedor.
- [ ] Confirmar no painel do provedor que a cobrança pertence à conta do prestador.
- [ ] Verificar Pix/boleto/cartão efetivamente habilitados; não presumir disponibilidade por provedor.
- [ ] Inspecionar desktop, tablet e smartphone, incluindo tema escuro. A inspeção visual local foi bloqueada pelo navegador remoto nesta execução.
- [ ] Monitorar fila de webhooks e conciliação. Testar preservação do histórico após desconexão.
- [ ] Só depois da homologação, configurar credenciais live e mudar o ambiente para produção com `PAYMENTS_LIVE_ENABLED=true`.

## Limites desta entrega

- O Asaas anterior no repositório era demonstrativo. Os dados locais permanecem acessíveis e não são convertidos em recebimentos reais.
- Se houver uma integração Asaas real fora deste código, seu banco precisa ser inventariado antes do cutover. Não foi criado um importador que adivinhe ownership ou refaça cobranças.
- O login protege o domínio de pagamentos; a migração de tarefas e outros módulos locais para backend autenticado é separada.
- Links Stripe Checkout expiram em até 24 horas; o vencimento da Weeki não estende a validade. Não há renovação automática nesta versão.
- Desconectar preserva histórico. Revogação de chaves Asaas e da autorização Mercado Pago também deve ser feita no painel do provedor quando necessário.
- Testes automatizados passam com transportes simulados; homologação real em sandbox e inspeção visual ainda precisam ser executadas.
