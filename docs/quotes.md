# Orçamentos

O módulo de Orçamentos substitui Serviços como área principal da navegação comercial. Os antigos serviços permanecem como catálogo interno de itens salvos para não quebrar atendimentos, tarefas, Fiscal/NFS-e e contratos.

Fluxo funcional da V1:

Clientes → Orçamentos → Aprovação → Contrato / Cobrança / Atendimento → Relatórios / Fiscal

## Funcionalidades

- Tela principal com indicadores, filtros por status, cliente, período, valor e validade.
- Criação e edição de orçamento com cliente existente ou novo cliente.
- Itens livres com quantidade, unidade, preço, desconto por item, desconto geral, taxa/imposto e total automático.
- Catálogo interno de itens salvos, reutilizando a estrutura anterior de serviços.
- Modelos de orçamento a partir de propostas existentes.
- Preview A4 em tempo real com identidade do workspace.
- PDF real gerado no navegador como documento vetorial simples.
- Exportação Excel `.xlsx` real em OpenXML.
- Envio preparado por e-mail, WhatsApp e link público por token não sequencial.
- Página pública `/orcamento/?token=...` para visualização, aprovação e recusa comercial.
- Histórico de eventos por orçamento.
- Duplicação e revisão sem apagar versões anteriores.
- Conversão de orçamento aprovado em rascunho de cobrança, contrato ou atendimento.
- Configurações em **Configurações → Orçamentos** para prefixo, validade, prazo, textos padrão, rodapé, moeda e exibição de dados.

## Persistência local

A V1 visual continua usando `weeki.operations.v1` no navegador para manter compatibilidade com a exportação estática atual. A migração de leitura adiciona campos novos a orçamentos antigos sem apagar dados existentes.

## Backend preparado

A migration `server/migrations/006_quotes.sql` adiciona o schema server-only `weeki_quotes`:

- `quotes`
- `quote_items`
- `quote_versions`
- `quote_events`
- `saved_items`
- `quote_templates`
- `quote_settings`
- `public_tokens`

O schema referencia `weeki_payments.workspaces`, habilita RLS, revoga acesso público e deixa comentários operacionais para que repositórios futuros sempre filtrem por `workspace_id`, recalculem totais no servidor e consultem links públicos por hash de token.

## Pendências externas

- Persistência multi-tenant real dos orçamentos e clientes.
- APIs privadas e públicas para salvar, enviar, aprovar e recusar orçamentos.
- Hash de token, IP hash, rate limiting e logs de acesso no backend.
- Envio transacional de e-mail.
- Integração oficial com WhatsApp.
- PDF backend com armazenamento e auditoria imutável.
- Domínio público definitivo, como `app.weeki.com.br/orcamento/[token]`.
