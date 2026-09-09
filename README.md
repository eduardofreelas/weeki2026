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

## Arquitetura

```text
app/                 rotas (home SPA + /agendar)
components/ui/       primitivos shadcn (Button, Input, Dialog, Sheet…)
components/weeki/    telas e widgets do produto
features/*/          tipos, seed e hooks de persistência local
lib/                 cn, formatadores BR, sanitização
public/              favicon e .htaccess (Hostinger)
shared/              contratos compartilhados do domínio de pagamentos
server/              API, autenticação, migrations, adapters, webhooks e workers
```

Os módulos anteriores ainda usam hooks `use-weeki-*.ts` e chaves `weeki.*.v1`. Pagamentos conectados usam exclusivamente a API autenticada e não tratam dados locais como recebimentos confirmados.

### Variáveis de ambiente

Nenhuma é necessária para executar o protótipo estático. Sem configuração, a área de pagamentos abre em modo visual, não faz chamadas externas e não simula conexões. Para ativar a API no build, use `NEXT_PUBLIC_PAYMENTS_API_ENABLED=true`; o backend exige as variáveis privadas listadas em `.env.example`. Nunca use prefixo `NEXT_PUBLIC_` para secrets nem versione um `.env` preenchido.

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
npm run db:migrate:payments
npm run start:payments
```

## Limitações conhecidas (propositalmente não “fingidas”)

- tarefas, clientes, agenda e configurações gerais ainda persistem localmente;
- `/agendar` não entrega o pedido a outro dispositivo;
- anexos são metadados, sem armazenamento de objetos;
- pagamentos dependem de PostgreSQL, OIDC, HTTPS e credenciais sandbox configurados externamente;
- os itens Início, Demandas, Relatórios, Arquivados e Ajuda permanecem “Em breve”.

## Pagamentos multiprovider

A evolução de Cobranças com backend, autenticação e adapters está documentada em [docs/payments.md](docs/payments.md), incluindo implantação Node, migration, webhooks, variáveis privadas e homologação. Leia também a [auditoria e estratégia de preservação](docs/payments-audit.md). O frontend estático continua compilável; o recebimento integrado exige a configuração externa descrita no documento.

Para ativação, siga a [checklist externa](docs/payments-external-checklist.md). Os testes executados e os limites da verificação estão no [registro de validação](docs/payments-validation.md).
