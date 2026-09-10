# Auditoria do módulo Fiscal — 10/09/2026

Base auditada: `d256094dbc7982a8a288b4bf45ba1c345128144c` (`main`). A implementação foi feita na branch `codex/fiscal-nfse`, sem apagar ou converter dados existentes.

## Estado encontrado

| Área | Estado antes do módulo Fiscal | Decisão de arquitetura |
| --- | --- | --- |
| Usuários e autenticação | O núcleo da interface ainda é local. O backend de Pagamentos já possui OIDC, sessão HttpOnly, usuários, workspaces e memberships. | Reutilizar `SessionAuth`, `Scope` e autorização por workspace no backend Fiscal. Nunca usar o perfil editável do navegador como identidade. |
| Clientes | Hook local `useWeekiClients`, com nome, documento, contato e endereço. | Acrescentar um bloco fiscal opcional e compatível com registros antigos. Reutilizar campos já existentes e não duplicar nome, documento, e-mail, telefone ou logradouro. |
| Serviços | Não havia cadastro independente de serviços. Demandas são o objeto operacional mais próximo. | Criar configurações fiscais reutilizáveis e desacopladas. O futuro cadastro de Serviços poderá referenciá-las por `localId`. |
| Demandas/tarefas | Persistência local, conclusão manual e vínculo opcional com cliente. | Publicar o evento interno `service.completed`; a conclusão nunca depende do resultado fiscal. |
| Cobranças e financeiro | Histórico local preservado e backend multiprovider separado, com conciliação idempotente. | Publicar `payment.confirmed` no outbox somente após a primeira baixa confirmada. Fiscal não conhece Asaas, Mercado Pago ou Stripe. |
| Configurações | A tela existia, mas o acesso ficava no rodapé do desktop e não fazia parte da navegação móvel. Alguns controles simulavam conexão ou segurança. | Restaurar acesso permanente, criar visão geral, busca e navegação móvel; identificar claramente recursos locais e recursos em standby. |
| Banco | PostgreSQL apenas no backend multiprovider, schema `weeki_payments`. | Migration aditiva `002_fiscal.sql`, com `weeki_core.domain_events` e schema privado `weeki_fiscal`. Nenhuma tabela existente é removida ou reescrita. |
| APIs e webhooks | API Node de mesma origem; webhooks seguros apenas de pagamentos. | Reutilizar sessão, CSRF por `Origin`, limite de body e erros sanitizados. Eventos fiscais externos só serão implementados com contrato oficial homologado. |
| E-mail | Não havia provedor transacional real no projeto auditado. | Criar `NotificationProvider`; envio real fica em standby para evitar confirmação falsa. |
| Arquivos | Anexos atuais são metadados locais; não há object storage privado. | Criar `FiscalDocumentStore`; PDF/XML reais exigem bucket privado e URLs assinadas. |
| Certificado | Não havia KMS, Vault ou secret manager. | Não criar upload no frontend nem armazenar PFX/senha. Banco guarda somente referência opaca e metadados públicos. |

## Riscos identificados e controles

1. **Emissão duplicada:** chave idempotente por workspace, hash do pedido, reserva `PROCESSING` antes da chamada externa e bloqueio de retransmissão após timeout.
2. **Vazamento entre contas:** todas as consultas usam membership e `workspace_id`; chaves estrangeiras compostas impedem relacionamentos cruzados.
3. **Segredo no cliente:** certificado, senha, URLs privadas e referência do cofre não fazem parte dos DTOs públicos.
4. **Contrato fiscal incorreto:** nenhum endpoint, tag XML ou schema da NFS-e Nacional foi inventado. O codec DPS e o transporte falham de forma fechada até a versão oficial ser fixada e homologada.
5. **Falsa sensação de produção:** toda a interface mostra “Ambiente de testes”; emissão, PDF, XML, e-mail, cancelamento fiscal e WhatsApp permanecem indisponíveis sem dependências reais.
6. **Deploy estático:** `out/` entrega somente a experiência visual. API, autenticação e dados fiscais multiusuário exigem o processo Node e PostgreSQL.
7. **Migração de dados locais:** não há associação confiável entre dados de navegadores e identidades OIDC. Nenhuma importação automática é feita.

## Estratégia de migração e rollback

- Criar snapshot/`pg_dump` antes de aplicar a migration em qualquer banco real.
- Aplicar `001_payments.sql` e `002_fiscal.sql` sob lock e controle de versão.
- Manter as chaves `weeki.*.v1` e os dados locais intactos durante a transição.
- Ativar primeiro em homologação, por workspace piloto e com feature flags desligadas por padrão.
- Em rollback, desabilitar o módulo/worker e voltar a versão da aplicação sem apagar schemas ou eventos. Após qualquer emissão real, reconciliar o período antes de retomar.

## Resultado por fase

| Fase | Estado nesta entrega |
| --- | --- |
| 1 — arquitetura, tipos, banco, telas e configurações | Implementada |
| 2 — rascunho, validação, status, histórico e vínculos | Implementada e segura em modo visual/server-side |
| 3 — API Nacional, DPS oficial, XML, assinatura e certificado | Contratos preparados; transmissão real em standby |
| 4 — DANFSe, XML, object storage e e-mail | Interfaces preparadas; execução real em standby |
| 5 — automação por conclusão/pagamento e reprocessamento | Eventos internos e idempotência preparados; worker real em standby |
| 6 — testes, segurança e responsividade | Testes automatizados adicionados; homologação externa e inspeção visual pública ainda necessárias |
