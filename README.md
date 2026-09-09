# Weeki

Workspace operacional para prestadores de serviços. Esta versão é um **cliente estático** (Next.js `output: "export"`) com persistência em `localStorage`. Não há API, autenticação nem banco nesta etapa.

## O que já funciona

- Minha Semana (quadro e lista), Caixa de Entrada, command bar (`Ctrl/Cmd + K`);
- demandas com cliente, status, prioridade, datas, tags, checklist, recorrência e anexos (metadados);
- cadastro de clientes;
- agenda interna e página pública `/agendar` (grava no **mesmo navegador**);
- financeiro e cobranças em modo demonstrativo (Asaas ainda não conecta).

## Arquitetura

```text
app/                 rotas (home SPA + /agendar)
components/ui/       primitivos shadcn (Button, Input, Dialog, Sheet…)
components/weeki/    telas e widgets do produto
features/*/          tipos, seed e hooks de persistência local
lib/                 cn, formatadores BR, sanitização
public/              favicon e .htaccess (Hostinger)
```

Estado: hooks `use-weeki-*.ts` leem/gravam chaves `weeki.*.v1`. Trocar por API não exige reescrever as telas, desde que a assinatura dos hooks se mantenha.

### Variáveis de ambiente

Nenhuma obrigatória neste estágio. Não commitar `.env` com secrets quando a API existir.

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

A pasta `out/` vai para `public_html/` na Hostinger. `npm test` hoje só executa o build.

## Limitações conhecidas (propositalmente não “fingidas”)

- sem login, roles ou isolamento entre usuários;
- `/agendar` não entrega o pedido a outro dispositivo;
- valores monetários ainda em `number` (reais), não centavos;
- itens Início, Demandas, Relatórios, Arquivados, Ajuda e Configurações estão visíveis como “Em breve”.

## Próxima evolução

1. API + PostgreSQL + auth/workspaces.
2. Autorização no servidor.
3. Dinheiro em centavos + gateway real e webhooks idempotentes.
4. Booking público persistido no backend do prestador.
5. Testes dos fluxos críticos.
