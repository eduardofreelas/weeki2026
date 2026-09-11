# Relatórios

O módulo de Relatórios transforma dados já existentes na Weeki em documentos profissionais para clientes. A V1 roda de forma funcional no frontend estático, usando clientes, demandas, anexos/links, estimativas de tempo, cobranças e lançamentos financeiros armazenados localmente. A migration `005_reports.sql` deixa o backend preparado para persistência multi-tenant, snapshots imutáveis, links públicos, eventos e recorrência.

## V1 local

- Navegação principal em `Relatórios`.
- Página com visão geral, listagem, modelos e agendamentos.
- Fluxo de criação por etapas: dados básicos, seleção automática, seleção individual, blocos e identidade visual.
- Editor em blocos com capa, resumo executivo, indicadores, atividades, entregáveis/evidências, horas, financeiro, andamento, próximas etapas, observações, conclusão e assinatura.
- Geração de PDF real no navegador, com paginação A4 textual.
- Link compartilhável com token não sequencial, expiração, senha local opcional, revogação, visualização, aprovação e solicitação de ajuste.
- Preparo de e-mail por `mailto:` com assunto, mensagem, link e orientação de anexo PDF.
- Histórico operacional por evento.
- Campos em demandas: incluir em relatórios, descrição para relatório, categoria para relatório e observações de evidência.

## Segurança e backend

No frontend estático, os dados continuam no navegador. Para produção autenticada, a migration cria o schema server-only `weeki_reports` com:

- `reports`, `versions`, `sections`, `items`, `templates`, `schedules`, `shares`, `events` e `task_report_metadata`;
- chaves compostas por `workspace_id`;
- índices por workspace, cliente, status, período, tipo, origem e token;
- Row Level Security habilitado e permissões públicas revogadas;
- armazenamento de token por hash no backend, não por ID sequencial;
- snapshots imutáveis em versões para impedir alterações silenciosas após envio;
- metadados de relatório em tarefas sem depender de uma tabela server-side de demandas ainda inexistente.

O endpoint público futuro deve buscar apenas por `token_hash`, validar revogação, expiração e senha no servidor, e devolver a versão imutável do relatório.

## IA

`features/reports/ai.ts` prepara payloads e guardrails para IA. A ação deve usar somente o contexto selecionado do relatório: cliente, período, atividades e métricas. A V1 não chama um provedor externo nem inventa conteúdo; quando o backend de IA for ativado, a mutation deve consumir esse payload e retornar texto editável.

## PDF

A V1 gera PDF por estrutura de documento e texto paginado, evitando screenshot da interface. O backend contém `server/reports/pdf.ts` para a mesma direção arquitetural. Imagens, tabelas avançadas e renderização tipográfica rica podem evoluir no renderer server-side sem mudar o contrato do módulo.
