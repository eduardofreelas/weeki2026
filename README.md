# Weeki

Primeira versão funcional do workspace operacional Weeki, com foco na tela **Minha Semana**.

## O que já funciona

- visão semanal de segunda a sexta, com fim de semana opcional;
- criação rápida de demanda (apenas o título é obrigatório);
- edição de descrição, cliente, status, prioridade, datas, horários e tempo estimado;
- tags, checklist, recorrência, observações, anexos e histórico de atividade;
- conclusão, duplicação, arquivamento e movimentação por arrastar e soltar;
- filtros por status e cliente, busca e command bar (`Ctrl/Cmd + K`);
- Caixa de Entrada para demandas ainda não planejadas;
- persistência local no navegador;
- layout responsivo para desktop e dispositivos móveis.

## Arquitetura

O projeto usa Next.js, React e TypeScript com exportação estática. A camada de estado está isolada em `features/tasks/use-weeki-tasks.ts`, permitindo trocar o armazenamento local por uma API sem reescrever a interface.

```text
app/                  rota e tema global
components/ui/        componentes de interface reutilizáveis
components/weeki/     componentes próprios do produto
features/tasks/       domínio, dados iniciais e persistência de demandas
public/               arquivos públicos e configuração Apache
```

## Desenvolvimento

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

## Build para Hostinger

```bash
npm run build:hostinger
```

O conteúdo da pasta `out/` deve ser enviado para `public_html/`. O arquivo `.htaccess` já acompanha o build para suportar futuras rotas do aplicativo.

## Próxima evolução recomendada

1. API e banco de dados PostgreSQL.
2. Autenticação e workspaces por usuário.
3. Cadastro completo de clientes.
4. Sincronização de anexos com armazenamento de objetos.
5. Testes automatizados do fluxo de demandas.
