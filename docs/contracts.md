# Contratos

O módulo de Contratos segue o domínio da Weeki: Cliente -> Serviço/Demanda -> Arquivos -> Proposta/Orçamento -> Contrato -> Cobrança -> Financeiro. O frontend permanece funcional em modo local para criação, edição, modelos, snapshots e versões; IA, PDF backend, assinatura real e webhooks só são expostos quando o backend e as credenciais estiverem ativos.

## Funcionalidades

- Navegação principal, busca rápida e tela `Contratos`.
- Criação progressiva: IA, modelo, zero ou proposta/orçamento referenciado por arquivo do cliente.
- Snapshot de negócio, cliente, serviço/demanda, proposta e cobrança no momento da criação.
- Modelo base de Prestação de Serviços com variáveis internas estáveis.
- Editor rico com sanitização, prévia, autosave local controlado pelo usuário e versões formais.
- Partes, signatários, assinatura simultânea ou em ordem, validação de e-mail e CPF/CNPJ por formato.
- Página de detalhe com resumo, documento, versões, signatários e histórico.
- Seção de contratos dentro do perfil do cliente.
- Backend com PDF, IA OpenAI, `SignatureProvider`, Clicksign, webhooks, idempotência e auditoria.

## Endpoints

Todas as rotas privadas usam sessão OIDC e escopo server-side por `workspace_id`.

- `GET /api/contracts/health`
- `GET /api/contracts/overview`
- `GET /api/contracts`
- `POST /api/contracts`
- `GET /api/contracts/:id`
- `PUT /api/contracts/:id`
- `POST /api/contracts/:id/versions`
- `POST /api/contracts/:id/pdf`
- `POST /api/contracts/ai/generate`
- `POST /api/contracts/:id/signature/send`
- `POST /api/contracts/:id/signature/remind`
- `POST /api/contracts/:id/signature/cancel`
- `POST /webhooks/clicksign`

Mutações exigem mesma origem. Webhooks não usam sessão, mas passam pela assinatura do provedor.

## Banco

A migration `003_contracts.sql` cria o schema privado `weeki_contracts`:

- `contracts`
- `templates`
- `versions`
- `parties`
- `signers`
- `documents`
- `signature_requests`
- `signature_events`
- `audit`

As tabelas referenciam `weeki_payments.workspaces`, usam índices por workspace/status/cliente, preservam versões e documentos imutáveis, e mantêm eventos de webhook idempotentes.

## IA

A geração usa a OpenAI Responses API exclusivamente no backend. O payload enviado é minimizado para dados de negócio, cliente, serviço, valores e cláusulas necessárias. O retorno é JSON estruturado, sanitizado e versionado quando associado a um contrato.

Variáveis:

- `CONTRACTS_AI_ENABLED=true`
- `OPENAI_API_KEY`
- `OPENAI_CONTRACTS_MODEL`
- `NEXT_PUBLIC_CONTRACTS_AI_ENABLED=true`

O aviso jurídico é exibido antes da geração e antes do envio: conteúdo de IA é sugestão e não substitui revisão jurídica.

## Assinatura

O domínio usa `SignatureProvider`, hoje implementado por `ClicksignSignatureProvider`. A Weeki normaliza os status para não acoplar interface e regras comerciais aos nomes do provedor.

Variáveis:

- `CONTRACTS_SIGNATURE_ENABLED=true`
- `CONTRACTS_ENVIRONMENT=sandbox`
- `CONTRACTS_LIVE_ENABLED=false`
- `CLICKSIGN_ACCESS_TOKEN`
- `CLICKSIGN_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CONTRACTS_SIGNATURE_ENABLED=true`

Produção só deve usar `CONTRACTS_ENVIRONMENT=production` com `CONTRACTS_LIVE_ENABLED=true` depois de homologação.

## Homologação

1. Configure PostgreSQL, OIDC e `PAYMENTS_ENCRYPTION_KEY`.
2. Rode `npm run build:payments && npm run db:migrate`.
3. Configure OpenAI e Clicksign em sandbox.
4. Sirva tudo na mesma origem com `npm run start:payments`.
5. Crie cliente, demanda, cobrança opcional e contrato.
6. Gere PDF no backend e confira hash/documento.
7. Envie para Clicksign com signatários reais de sandbox.
8. Configure webhook `APP_ORIGIN/webhooks/clicksign`.
9. Valide eventos duplicados, assinatura parcial, conclusão, PDF assinado e evidência.
10. Só então habilite as flags públicas de IA/assinatura na interface.

Sem credenciais externas, o módulo não afirma assinatura funcional: os botões reais permanecem desabilitados e o usuário vê o modo local.
