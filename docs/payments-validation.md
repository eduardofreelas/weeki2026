# Registro de validação — 09/09/2026

## Executado localmente

| Verificação | Resultado |
| --- | --- |
| `npm run test:payments` | 35 testes aprovados; nenhum erro, skip ou transação real |
| `npm run lint` | Sem erros ou warnings em todo o repositório; o script antigo, que apontava para um arquivo inexistente, foi corrigido |
| `npm run build:full` | Frontend Next.js, verificação de tipos, exportação estática e backend TypeScript compilados |
| `git diff --check` | Sem erros de whitespace |

A branch também incorpora a `main` em `f72f2a7615e1a3e72deebc82635356e17c1c4e3f`, preservando as correções posteriores de UX, sanitização, confirmações, sincronização local e build.

Os testes usam PGlite (PostgreSQL embarcado), sessões HTTP de teste e transportes simulados. Cobrem conexão/desconexão, padrão, criação idempotente, pagamento confirmado/recusado, cancelamento, refund integral/parcial, evento duplicado/fora de ordem, timeout, indisponibilidade, credencial expirada, ownership de conexão/cobrança, FKs entre workspaces, OAuth de uso único, assinatura de webhook, CSRF, conciliação e histórico após desconexão.

O workflow `.github/workflows/payments.yml` repete os comandos principais em Node 22 sem secrets reais. A execução local usou Node 24.19.0. O resultado do CI remoto deve ser conferido no pull request; não se presume aprovação a partir dos testes locais.

## Não comprovado nesta execução

- Não havia acesso a PostgreSQL ou credenciais de produção. A migration não foi executada em um banco do usuário, e não houve transação externa.
- OAuth, métodos comerciais e webhooks ainda requerem homologação em cada conta sandbox.
- O navegador remoto retornou `ERR_BLOCKED_BY_CLIENT` ao abrir o preview local. A responsividade está implementada no CSS, mas não há alegação de inspeção visual aprovada.
- O backup Git preserva o código anterior. Não equivale a um backup do localStorage dos usuários nem de um banco externo.

Consulte [checklist de ativação](payments-external-checklist.md) e [arquitetura/operação](payments.md).
