# Auditoria e preservação — 09/09/2026

Base publicada: `01b19df6b3f3e80e2f1dce75a0bb02d4fb943b31`, árvore `5fd0b0b561622dd00346782fa0dc9c5c40be0de8`.
Backup Git local e no GitHub: `backup/before-multiprovider-20260909` (mesma árvore publicada; a branch remota aponta para o commit publicado acima).

## Constatações antes da alteração

- Next.js 16 / React 19 / TypeScript / Tailwind 4 / Montserrat. Exportação estática (`out`).
- Não existem servidor de API, autenticação, entidades de usuário/workspace, migrations, banco configurado ou webhooks. Drizzle instalado, mas sem schema/conexão.
- Asaas é demonstrativo: nenhum pagamento externo é criado. Configurações armazena um booleano que simula conexão; Cobranças usa outro booleano independente.
- Cobranças, clientes e financeiro são locais. Chaves: `weeki.billing.charges.v1`, `weeki.billing.gateway.v1`, `weeki.clients.v1`, `weeki.finance.transactions.v1`. Confirmar lista completa via exportação antes de migrar.
- Baixa manual cria receita local com ID `billing-${charge.id}`. Links demonstrativos são rotas relativas sem checkout real.
- Perfil/segurança das configurações também são protótipos, não constituem identidade confiável. Não podem autorizar operações financeiras.

## Estratégia

1. Acrescentar serviço Node e PostgreSQL isolados. Manter exportação estática existente; servir API/autenticação pelo mesmo domínio com proxy.
2. Autenticar por OIDC no servidor, criar sessão HttpOnly e derivar workspace por membership; nunca pelo perfil local.
3. Preservar integralmente registros locais como histórico demonstrativo. Não transformar links locais em pagamentos reais e não importar automaticamente dados de um navegador para um usuário autenticado.
4. Importação de cobranças externas existentes, se descobertas fora deste código, exige confirmação da conta, consulta no provedor e script controlado. Sem recriação, sem alterar IDs, valores ou status do arquivo de origem.
5. Migration SQL aditiva em schema próprio. Backup `pg_dump` antes de aplicar; migração transacional/versionada. Rollback operacional: desabilitar API e restaurar frontend anterior; não apagar tabelas financeiras.
6. Créditos/estornos confirmados terão livro de conciliação exclusivo do servidor; a UI não pode marcá-los como pagos localmente.

## Dependências externas

PostgreSQL, execução Node persistente, HTTPS/proxy, provedor de identidade OIDC, aplicação Mercado Pago, Stripe Connect e credenciais Asaas provisionadas no servidor. Sem essas configurações a interface deve mostrar indisponibilidade, jamais conexão simulada.
