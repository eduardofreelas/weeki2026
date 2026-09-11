# Weeki

Workspace operacional para prestadores de serviços. O frontend Next.js continua compatível com exportação estática; o domínio de pagamentos integrado acrescenta um processo Node, PostgreSQL e autenticação OIDC.

## O que já funciona

- Minha Semana (quadro e lista), Caixa de Entrada, command bar (`Ctrl/Cmd + K`);
- demandas com cliente, status, prioridade, datas, tags, checklist, recorrência e anexos (metadados);
- cadastro de clientes;
- agenda interna e página pública `/agendar` (grava no **mesmo navegador**);
- financeiro e cobranças locais preservados em abas próprias;
- interface multiprovider com Asaas, Mercado Pago e Stripe no modo visual estático;
- pagamentos conectados após ativação explícita do backend e homologação externa.
- central profissional de Configurações, acessível no desktop, mobile e busca rápida;
- módulo Fiscal/NFS-e em sandbox visual, com perfil, serviços, emissão assistida, notas e histórico;
- backend Fiscal desacoplado e seguro, com a integração nacional real em standby;
- módulo Contratos com criação progressiva, modelos, snapshots, versões, editor, PDF backend, IA server-side e arquitetura Clicksign em standby até credenciais.
- base autenticada de conta, onboarding e disponibilidade, reaproveitando OIDC, sessão HttpOnly e workspace quando o backend estiver habilitado.

## Arquitetura

```text
app/                 rotas (home SPA + /agendar)
components/ui/       primitivos shadcn (Button, Input, Dialog, Sheet…)
components/weeki/    telas e widgets do produto
features/*/          tipos, seed e hooks de persistência local
lib/                 cn, formatadores BR, sanitização
public/              favicon e .htaccess (Hostinger)
shared/              contratos compartilhados de conta, disponibilidade, pagamentos, Fiscal e Contratos
server/              API, autenticação, migrations, providers, webhooks e workers
```

Os módulos anteriores ainda usam hooks `use-weeki-*.ts` e chaves `weeki.*.v1`. Pagamentos conectados usam exclusivamente a API autenticada e não tratam dados locais como recebimentos confirmados.

### Variáveis de ambiente

Nenhuma é necessária para executar o protótipo estático. Sem configuração, Conta, Pagamentos, Fiscal e Contratos abrem em modo visual/local, não fazem chamadas externas e não simulam conexões, notas autorizadas, assinatura eletrônica ou documentos finais assinados. O backend exige as variáveis privadas listadas em `.env.example`. Nunca use prefixo `NEXT_PUBLIC_` para secrets nem versione um `.env` preenchido.

### Design system

Tokens em `app/globals.css` (`--background`, `--primary`, `--radius` 8px, `--ring`). Botões: variantes `default | secondary | outline | ghost | destructive` e tamanhos `sm | default | lg`. Preferir essas classes a hex avulso.

### Execução local

Node.js 22+.

```bash
npm ci
npm run dev
```

### Build

```bash
npm run build
```

A pasta `out/` pode ser publicada em `public_html/`; ela inclui toda a interface de pagamentos em modo visual. Para habilitar conexões reais, cobranças integradas e sincronização:

```bash
npm run test:payments
npm run build:full
npm run db:migrate
npm run start:payments
```

## Limitações conhecidas (propositalmente não “fingidas”)

- tarefas, clientes, agenda e configurações gerais ainda persistem localmente;
- `/agendar` usa disponibilidade local no protótipo estático e só entrega pedidos entre dispositivos após ativação do backend autenticado;
- anexos são metadados, sem armazenamento de objetos;
- pagamentos dependem de PostgreSQL, OIDC, HTTPS e credenciais sandbox configurados externamente;
- emissão NFS-e real depende de credenciamento, documentação oficial fixada, certificado em KMS/Vault e homologação;
- IA e assinatura de contratos dependem de OpenAI, Clicksign sandbox, segredo de webhook e homologação;
- os itens Início, Demandas, Relatórios, Arquivados e Ajuda permanecem “Em breve”.

## Conta, onboarding e disponibilidade

A base autenticada de conta, onboarding e disponibilidade está documentada em [docs/account-availability.md](docs/account-availability.md). Ela adiciona rotas de login/cadastro/recuperação, Configurações → Disponibilidade, cálculo de slots na página pública e migration de perfil/workspace/onboarding/disponibilidade. Google e Apple ficam tecnicamente preparados via OIDC, mas dependem de credenciais reais do provedor de identidade.

## Pagamentos multiprovider

A evolução de Cobranças com backend, autenticação e adapters está documentada em [docs/payments.md](docs/payments.md), incluindo implantação Node, migration, webhooks, variáveis privadas e homologação. Leia também a [auditoria e estratégia de preservação](docs/payments-audit.md). O frontend estático continua compilável; o recebimento integrado exige a configuração externa descrita no documento.

Para ativação, siga a [checklist externa](docs/payments-external-checklist.md). Os testes executados e os limites da verificação estão no [registro de validação](docs/payments-validation.md).

## Fiscal / NFS-e

A arquitetura, os estados, as rotas, a migration, os controles de idempotência e tudo que permanece em standby estão em [docs/fiscal.md](docs/fiscal.md). Leia também a [auditoria de preservação](docs/fiscal-audit.md) e a [checklist externa de homologação](docs/fiscal-external-checklist.md).

## Contratos

A arquitetura, endpoints, variáveis, estados, migration, IA e assinatura eletrônica estão em [docs/contracts.md](docs/contracts.md). Para ativação real, siga a [checklist externa](docs/contracts-external-checklist.md) e o [registro de validação](docs/contracts-validation.md).
