# Pagamentos multiprovider — Weeki

## Estado desta entrega

A auditoria do commit publicado `01b19df6b3f3e80e2f1dce75a0bb02d4fb943b31` encontrou um frontend Next.js com exportação estática e dados locais. O indicador Asaas era demonstrativo: não havia backend, autenticação, workspaces, banco ou webhooks. Consulte [auditoria e backup](payments-audit.md).

Esta entrega acrescenta um backend Node/TypeScript, PostgreSQL, sessões autenticadas por OIDC, adapters Asaas/Mercado Pago/Stripe, fila de webhooks, conciliação e interface. A operação real depende da infraestrutura e das credenciais abaixo. Os testes utilizam PostgreSQL embarcado (PGlite) e provedores simulados; não comprovam homologação nas contas externas. Nenhuma transação real foi executada.

O login protege o novo domínio de pagamentos. Tarefas, clientes locais e os demais módulos anteriores continuam como estavam; este trabalho não transforma os módulos locais em um SaaS autenticado completo. Nunca use o perfil editável no navegador para autorizar pagamentos.

## Arquitetura

- `shared/payments.ts`: contratos públicos, capacidades e status internos.
- `server/payments/provider.ts`: interface comum `PaymentProvider`.
- `server/payments/providers/`: adapters isolados; nenhuma API key enviada ao cliente.
- `server/payments/registry.ts`: registro e configuração dos adapters.
- `server/payments/service.ts`: ownership, padrão, idempotência, reserva durável de operações, conciliação e auditoria.
- `server/payments/repository.ts`: SQL parametrizado com escopo de workspace.
- `server/auth.ts`: OIDC Authorization Code + PKCE, nonce, sessões opacas com cookie HttpOnly.
- `server/api.ts`: API de mesma origem, limites de body e erros sanitizados.
- `components/payments/`: Configurações → Pagamentos, cobranças conectadas e lançamentos confirmados.

Fluxo de valores: cliente → checkout do provedor → conta conectada do prestador. A Weeki não cria carteira, não recebe o principal para repasse, não faz split e não cobra application fee nesta entrega. Não recebe dados de cartão nem CVV. Stripe envia todas as operações de cobrança com `Stripe-Account` da conexão verificada.

A UI usa apenas status Weeki: `PENDING`, `PAID`, `OVERDUE`, `CANCELED`, `REFUNDED`, `FAILED`, `PROCESSING`, `PARTIALLY_REFUNDED`. O status bruto permanece no registro para diagnóstico. Atrasos em consultas nunca rebaixam pagamentos confirmados ou estornos já conciliados.

## Banco e isolamento

Migration aditiva `server/migrations/001_payments.sql`, aplicada uma única vez sob lock transacional. Todas as entidades pertencem ao schema privado `weeki_payments`:

| Entidade | Finalidade / proteção |
| --- | --- |
| users, workspaces, memberships | Identidade por issuer + subject; papéis owner/admin/viewer |
| sessions | Hash SHA-256 de sessão aleatória; expiração de 8 horas |
| oauth_states | Hash de state; segredo cifrado; vínculo com sessão, workspace e provedor; uso único, 10 minutos |
| connections | Conta externa, ambiente, metadados públicos e envelope cifrado |
| customers | Snapshot mínimo do cliente, associado ao workspace autenticado |
| charges | Valor inteiro em centavos, moeda, IDs externos imutáveis e status |
| operations | Reserva única por cobrança + operação; impede estorno/cancelamento repetido |
| webhook_events | Referência mínima do evento; unicidade por conexão + evento, tentativas e resultado |
| finance_entries | Uma receita por cobrança e despesas incrementais por estorno |
| audit | Ação, IDs internos, timestamp e código de erro sanitizado |

Não existia RLS. O schema não deve ser exposto via REST público nem ao navegador. `PUBLIC` não possui privilégios. A conexão do backend deve usar um papel restrito, separado do papel de migration. Todas as consultas de usuário verificam membership e workspace; FKs compostas também impedem cobrar um cliente ou conexão de outro workspace. Não há endpoint que consulte um ID externo enviado pelo usuário.

`owner`/`admin` podem alterar pagamentos; `viewer` só consulta. Um primeiro login verificado cria um workspace próprio. A administração de equipes/convites e a migração do restante do app para workspaces são trabalhos separados; não são simuladas nesta entrega.

Ambiente de testes e produção têm contas/padrões independentes. Listas de cobranças e financeiro filtram o ambiente do servidor. Não use uma instância sandbox para manipular conexões de produção.

## Execução e implantação

Pré-requisitos: Node 22.13+, PostgreSQL persistente, HTTPS público, OIDC e saída HTTPS para APIs dos provedores. Não basta publicar apenas `out/` para ativar pagamentos.

```sh
npm ci
npm run test:payments
npm run build:full
# Configure .env ou variáveis privadas do host antes dos próximos comandos.
npm run db:migrate:payments
npm run start:payments
```

O processo Node serve o frontend já compilado em `out/`, `/api/payments/*` e `/webhooks/*`. Também executa o worker de eventos a cada 2 segundos e a conciliação periódica. Deve permanecer ativo, com reinício automático e monitoramento. O build estático anterior (`npm run build`) e `npm start` continuam disponíveis para o protótipo; eles não disponibilizam as APIs.

Na Hostinger, configure uma aplicação Node que execute `npm run build:full` no build e `npm run start:payments` na inicialização. A disponibilidade de Node persistente/PostgreSQL depende da infraestrutura contratada; não foi possível verificar o painel da hospedagem nesta execução. Mantenha a aplicação inteira na mesma origem, ou encaminhe `/api/payments/*` e `/webhooks/*` ao backend por proxy. Não habilite CORS irrestrito.

Use `.env.example` como inventário. `PAYMENTS_ENVIRONMENT=sandbox` é o padrão. Produção requer também `PAYMENTS_LIVE_ENABLED=true`, configurado explicitamente no servidor após homologação. Secrets não entram no build Next nem usam prefixo `NEXT_PUBLIC_`.

No PostgreSQL, aplique a migration com papel proprietário. Conceda ao papel de runtime somente `USAGE` no schema e `SELECT, INSERT, UPDATE, DELETE` nas tabelas do schema. Não conceda `CREATE`, acesso de superusuário ou acesso público. Use TLS com verificação do certificado e backups criptografados oferecidos pelo provedor do banco. Nunca desabilite a verificação TLS.

## Autenticação

Cadastre uma aplicação web confidencial no seu provedor OIDC e configure `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`. O issuer e os endpoints descobertos devem usar HTTPS. O fluxo usa Authorization Code, PKCE S256, nonce, validação de assinatura/JWKS, issuer, audience e expiração do ID token. O client deve aceitar `client_secret_post`. O callback é:

`APP_ORIGIN/api/payments/auth/callback`

O perfil local da Weeki não é uma identidade confiável. A sessão vem exclusivamente do backend. Requisições mutáveis exigem `Origin` exata e sessão válida; callbacks OAuth usam state de uso único vinculado à sessão. Não registre query strings de callbacks em proxy, APM ou analytics, pois podem conter códigos de autorização.

## Asaas

Uma API key por conta recebedora, mantida exclusivamente no cofre do servidor. Esta entrega não inventa OAuth Asaas nem pede ao usuário uma chave em um formulário de frontend. **A ativação inicial é assistida**, via comando administrativo com o usuário/workspace autorizados:

```sh
# USER_UUID e WORKSPACE_UUID são IDs do backend verificados pelo administrador.
# O arquivo de entrada deve ser temporário, protegido (0600), fora do repositório e do diretório público.
npm run payments:provision-asaas -- USER_UUID WORKSPACE_UUID < /caminho-protegido/chave-asaas
```

Não envie a chave pela conversa, não use argumentos de linha de comando para o segredo e não armazene o arquivo no repositório. Em implantação profissional, use um secret manager/pipe seguro e descarte o arquivo temporário pelo processo operacional aprovado.

A conexão consulta `/myAccount/commercialInfo` e `/wallets/`, verifica a conta e configura um webhook com token próprio. Cobranças usam `/payments`, `externalReference` com UUID Weeki, cliente com CPF/CNPJ, `invoiceUrl` hospedada e um método por cobrança (Pix, boleto ou cartão). Suporte depende da habilitação comercial da conta. O backend propaga indisponibilidade com mensagem sanitizada, nunca envia número de cartão.

Cancelamento e estorno usam endpoints oficiais. Estorno depende do método, estado e saldo permitidos pelo Asaas. A confirmação vem da API/webhook; não é uma baixa manual. Na reconexão, a identidade externa precisa ser a mesma para atualizar cobranças antigas. A conexão reutiliza o registro e localiza webhook já associado à sua URL. Após falha entre criação de webhook e gravação no banco, confira hooks órfãos no painel antes de repetir ativação.

`PAYMENTS_ALERT_EMAIL` deve estar configurado para alertas do webhook. O token de webhook é diferente da API key e fica cifrado. Endpoint: `APP_ORIGIN/webhooks/asaas/CONNECTION_UUID`.

Ao desconectar, remove-se o webhook quando possível e apagam-se as credenciais do cofre; a chave do Asaas deve ser revogada pelo titular no painel se não for mais utilizada. Histórico não é apagado.

## Mercado Pago

Cadastre a aplicação, habilite OAuth com PKCE e permissões `offline_access`, `read`, `write`. Configure `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET` e exatamente:

`APP_ORIGIN/api/payments/oauth/mercadopago/callback`

Fluxo: Configurações → Pagamentos → Conectar → autorização oficial → callback → `/oauth/token` no servidor. O refresh token é cifrado e renovado antes da expiração. Indisponibilidade transitória não é confundida com revogação. Revogação/credencial inválida exigem nova autorização.

O adapter usa Checkout Pro Preferences com token OAuth do recebedor, referência Weeki e checkout hospedado. Pix/cartão/boleto são oferecidos conforme métodos ativos retornados pela API. Não há parcelamento nesta versão. O boleto depende da disponibilidade do fluxo e da conta. A preferência expira no vencimento informado. `collector_id`, referência, ambiente, valor e moeda são conciliados no backend.

Webhook: `APP_ORIGIN/webhooks/mercadopago/CONNECTION_UUID`, já informado na preferência. Configure notificações `payment` e a chave secreta na aplicação. A validação usa `x-signature` e `x-request-id`, manifesto oficial `id:DATA_ID;request-id:REQUEST_ID;ts:TIMESTAMP;`. O body não é usado para confiar em valor, status, conta ou ID de evento: consulta-se o pagamento canônico. Timestamp tolerado: 5 minutos.

Preferências têm pesquisa oficial por `external_reference` (janela do provedor: últimos 90 dias). Ela permite recuperar um POST cujo retorno se perdeu, sem criar outra cobrança. Resultados ambíguos, múltiplos pagamentos aprovados, paginação maior que o limite de segurança ou chargebacks exigem conciliação assistida; não se inventa uma baixa/estorno. Uma preferência não deve ser tratada como garantia de pagamento único do provedor.

Desconectar destrói tokens locais. A revogação da autorização no painel Mercado Pago permanece sob controle do titular; não foi inventado um endpoint de revogação não documentado. Cobranças existentes continuam consultáveis na Weeki; sincronização exige reconexão.

## Stripe Connect

Habilite Connect com contas Standard e OAuth. Configure `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` do ambiente correto. Callback:

`APP_ORIGIN/api/payments/oauth/stripe/callback`

O fluxo oficial conduz ao cadastro/autorização da conta. A conta precisa concluir seu onboarding e estar habilitada para cobrar (`charges_enabled`). O token OAuth verifica a identidade da conta e o modo test/live. Todos os requests de cobranças usam a conta conectada (`Stripe-Account`). Não se usa destination charge, separate charge and transfer nem repasse da Weeki.

Checkout Sessions em BRL com Direct Charges. Cartão/Pix/boleto só aparecem quando a capacidade correspondente estiver ativa (`card_payments`, `pix_payments`, `boleto_payments`). A disponibilidade também depende de país, contrato e liberação do Stripe. Não existe promessa de Pix ou boleto para toda conta.

**Checkout Sessions expiram em até 24 horas.** O vencimento Weeki é informativo e não estende essa validade; a interface informa isso. Renovação automática de link expirado não está nesta entrega. Cancelamento expira a sessão aberta ou cancela PaymentIntent elegível. Refund usa PaymentIntent na conta conectada com chave de idempotência.

Configure um webhook **Connect / connected accounts** em `APP_ORIGIN/webhooks/stripe`, com `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `account.application.deauthorized`. Configure a mesma versão de API do endpoint e do backend, usando `STRIPE_API_VERSION` se fixar uma versão. Payloads thin não são aceitos; use eventos snapshot.

A assinatura `Stripe-Signature` é validada sobre os bytes originais com tolerância de 5 minutos e suporte a rotação. `event.account` precisa identificar a conexão cadastrada; `livemode` precisa corresponder ao ambiente. A referência assinada localiza o registro, mas status/valor são obtidos novamente na API. Ao desconectar, usa-se `/oauth/deauthorize`; se indisponível, destrói-se acesso local e informa-se revogação pendente.

## Idempotência e conciliação

Criação exige UUID `Idempotency-Key`. A reserva (valor, cliente, conexão, hash do request) é gravada antes do POST ao provedor. Mesma chave e conteúdo devolvem o mesmo registro; mesma chave com conteúdo diferente retorna conflito. Não há retry automático de criação em caso de timeout. O registro permanece `PROCESSING`, consultável e conciliável, sem recriar valores externos.

Estornos e cancelamentos têm reserva única durável **antes** do request remoto. Stripe e Mercado Pago também recebem chave de idempotência. Um crash/timeout deixa a operação reservada e bloqueia repetição cega, inclusive no Asaas. Operações incertas precisam de consulta ao provedor antes de qualquer intervenção manual. Não apague a reserva para tentar novamente sem verificar o resultado externo.

Webhooks validam autenticidade antes de persistir e respondem 200 só depois do insert. A fila deduplica `(connection_id, external_event_id)`. O worker usa `FOR UPDATE SKIP LOCKED` e lock do workspace; evento, status, auditoria e financeiro são processados na mesma transação. Crash reverte o processamento local completo. Erros transitórios usam backoff exponencial a partir de 30 segundos, limitado a uma hora e oito tentativas totais. Erros definitivos ficam `failed`; Gerenciar → Reprocessar falhas permite nova tentativa autorizada.

A conciliação periódica consulta até cinco cobranças por minuto, com lease de 15 minutos por registro, nos últimos 90 dias e em contas conectadas. É compensação para webhooks perdidos, não recriação de cobranças. Consulta manual continua disponível para registros mais antigos. A operação é serializada por workspace, com pool de até 10 conexões; dimensione réplicas/pool e acompanhe a fila antes de ampliar a carga.

`finance_entries` não é uma carteira. Registra valor bruto confirmado e estornos incrementais. Taxas, disponibilidade de saque e saldo permanecem no provedor. Dados locais antigos não são importados nem misturados com esse ledger. O Financeiro mantém a gestão local em uma aba própria. Listas conectadas são paginadas em 100 registros; indicadores e busca se referem à página exibida, identificada na interface. Não são relatórios contábeis consolidados.

## Segurança e operação

- AES-256-GCM com IV aleatório por envelope e AAD `workspace:connection`; chave mestra de 32 bytes fora do banco. Faça backup criptografado da chave em local separado. Perder essa chave impede recuperar conexões.
- Para rotação, suspenda workers, faça backup, recifre cada envelope com sua AAD em transação e só então troque a chave de runtime. Não mude simplesmente a variável sobre dados já cifrados.
- Nenhum log contém body, headers, tokens, CPF, email completo ou resposta bruta do provedor. Use `requestId`, IDs internos e códigos sanitizados para investigação. Configure o proxy/APM para a mesma política.
- HTTPS, cookie HttpOnly + Secure + SameSite=Lax, anti-CSRF por Origin, state/nonce/PKCE; sem segredo em URL/localStorage.
- Limite de body 256 KiB; timeout das APIs 12s por tentativa; somente GET pode ser repetido até três vezes.
- Coloque rate limiting/WAF no proxy, especialmente em login, callback e webhooks. Não use somente um limitador em memória em várias réplicas.
- Rode monitoramento para fila `failed/retry`, tempo desde recebimento, operações reservadas antigas e falhas de autenticação. Guarde acesso administrativo restrito.
- Nunca rode sandbox com contas/credenciais de produção. Testes automatizados injetam transport/adapters e não acessam os endpoints financeiros externos.

## Backup, dados anteriores e rollback

Antes de aplicar em qualquer ambiente com dados: exporte os dados locais pelo recurso de exportação da Weeki; faça snapshot do PostgreSQL e backup criptografado da chave de envelopes; confira restauração em ambiente isolado. O banco e navegadores de produção não estavam acessíveis nesta execução; não há alegação de backup desses dados.

O backup de código é a branch `backup/before-multiprovider-20260909`. A migration só cria o novo schema; não lê, renomeia ou reescreve chaves `weeki.billing.*`, `weeki.finance.*` ou valores antigos. Indicadores Asaas demonstrativos não viram contas conectadas reais.

Se for descoberta uma implantação Asaas real fora do repositório auditado: suspenda o cutover, faça inventário/exportação verificável, vincule cada cobrança ao workspace e conta corretos, preserve ID externo, valor, moeda e status original. Implemente uma migration específica após comparar os dados reais. **Não execute `createCharge` para migrar histórico e não copie registros locais não verificados para o ledger confirmado.** Esta entrega não possui importador genérico que adivinhe essa associação.

Rollback de aplicação: mantenha o banco intacto, pause novas escritas e workers, guarde eventos recebidos, volte ao código anterior com os dados locais preservados. Não faça `DROP SCHEMA` nem restaure snapshot por cima de recebimentos novos. Depois do cutover financeiro, reconciliar o período de rollback é obrigatório antes de retomar.

## Testes e homologação

`npm run test:payments` compila e executa testes de serviço, PostgreSQL/PGlite, API HTTP, adapters e criptografia. Inclui os 15 cenários solicitados e casos de reconciliação, evento fora de ordem, refund parcial, falha de assinatura, anti-CSRF, acesso indevido, reserva após timeout e expiração de OAuth. O CI não recebe secrets reais.

Além dos testes locais, antes da ativação: faça a homologação de cada provedor com contas test/sandbox, callback HTTPS público, conta recebedora autorizada, checkout hospedado, confirmação, cancelamento e estorno simulados, entregas duplicadas e revogação. Stripe Pix/boleto podem depender de habilitação externa. Valide as telas em desktop, notebook, tablet, celular e tema escuro no ambiente de homologação. A inspeção visual nesta execução foi bloqueada pelo navegador remoto ao acessar localhost (`ERR_BLOCKED_BY_CLIENT`); CSS responsivo e compilação foram implementados, mas isso não substitui essa inspeção.

## Troubleshooting

| Sintoma | Verificação / ação |
| --- | --- |
| Pagamentos aguardando configuração | Backend Node não está servindo `/api/payments`, ou OIDC ainda não foi configurado |
| Reentrada solicitada | Sessão expirada: autenticar novamente; nunca recuperar sessão pelo perfil local |
| OAuth não conclui | URI exata, state ainda válido, mesma sessão, issuer/client/scope e modo da aplicação |
| Reconexão necessária | Autorização revogada, conta bloqueada ou credencial inválida; regularizar e autorizar de novo |
| Cobrança em processamento após erro | Sincronizar; manter a reserva e os IDs. Não criar cópia para contornar um timeout |
| Assinatura inválida | Secret correto, body sem transformação, query original, relógio sincronizado e eventos Connect |
| Pagamento não atualiza | Worker ativo, fila pending/retry/failed, webhook configurado e conexão ativa |
| Valor ou referência divergentes | Suspender ação; conciliar manualmente no provedor. Não sobrescrever valor local |
| Estorno incerto | Consultar provedor com ID externo/operação; manter a reserva até diagnóstico |
| Histórico após desconexão | Disponível em leitura. Reconectar a mesma conta para retomar consultas externas |
| Checkout Stripe expirado | A validade do link é independente do vencimento. Não estender uma sessão além do limite oficial |

## Adicionar outro provider futuramente

1. Acrescentar identificador, nome e capacidades em `shared/payments.ts`.
2. Implementar `PaymentProvider` em um adapter, usando somente métodos oficiais.
3. Registrar factory/config no registry e rota reconhecida da API. O serviço/financeiro não precisa de condicionais por provider.
4. Implementar autenticação do webhook e consulta canônica com ownership/valor/ambiente.
5. Adicionar testes de contrato, assinatura, idempotência e isolamento e documentar setup externo.

Efí e Pagar.me não foram implementados.

## Referências oficiais consultadas

- [Asaas — criação de cobrança](https://docs.asaas.com/reference/criar-nova-cobranca), [identidade da conta](https://docs.asaas.com/reference/recuperar-walletid), [webhooks](https://docs.asaas.com/docs/sobre-os-webhooks).
- [Mercado Pago — OAuth/PKCE](https://www.mercadopago.com.br/developers/en/docs/security/oauth/creation), [refresh](https://www.mercadopago.com.ar/developers/en/docs/security/oauth/renewal), [gestão de autorização](https://www.mercadopago.com.br/developers/en/docs/subscriptions/additional-content/security/oauth/management), [pesquisa de preferências](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/preferences/search-preferences/get), [webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/notifications/webhooks).
- [Stripe — Connect OAuth](https://docs.stripe.com/connect/oauth-reference), [Direct Charges](https://docs.stripe.com/connect/direct-charges), [Pix](https://docs.stripe.com/payments/pix), [assinaturas de webhooks](https://docs.stripe.com/webhooks/signature).
