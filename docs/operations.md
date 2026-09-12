# Operação de atendimentos — fechamento funcional V1

O módulo de Operação concentra as entidades que conectam a rotina de um prestador de serviços sem criar um CRM genérico:

```text
Oportunidade → Orçamento → Atendimento → Tarefas / Entregas / Horas → Cobrança → Financeiro / Fiscal / Relatório
```

## Entidades

- **Serviço**: catálogo comercial reaproveitado por vitrine, orçamentos, atendimentos, contratos e Fiscal/NFS-e. A V1 preserva os IDs antigos para manter os vínculos já existentes.
- **Oportunidade**: registro comercial leve, com origem, próxima ação, valor estimado e status.
- **Orçamento**: itens, quantidade, preço unitário, desconto, acréscimo, validade, prazo, condições e status.
- **Atendimento**: registro central do serviço prestado para um cliente, com responsável, datas, valor, recorrência e vínculos para evolução futura.
- **Ciclo**: período simples de um atendimento recorrente, sem motor de assinaturas.
- **Entrega**: evidência interna do que foi enviado ou aprovado pelo cliente.
- **Tempo**: lançamento manual de minutos, ligado opcionalmente à tarefa, atendimento e cliente.

## Persistência atual

Em modo estático, os dados são persistidos no navegador em `weeki.operations.v1`, seguindo o mesmo padrão dos módulos legados de tarefas, clientes, agenda, cobranças e financeiro. O modelo é tipado e não usa arrays mockados como fonte de dados depois da hidratação inicial.

Quando a aplicação autenticada for migrada para o backend, essa fronteira pode ser substituída por repositórios escopados por workspace sem alterar os componentes: os IDs já são não sequenciais, os registros possuem timestamps e os relacionamentos são explícitos.

## Fluxos fechados

1. Criar oportunidade e convertê-la em cliente, evitando duplicidade por e-mail ou nome.
2. Criar orçamento com itens livres ou serviços cadastrados, copiando os dados para o snapshot do orçamento.
3. Aprovar orçamento e gerar cobrança, contrato ou atendimento.
4. Criar automaticamente tarefas padrão ao iniciar um atendimento quando houver serviço com esse padrão.
5. Acompanhar progresso, ciclos, entregas e tempo no atendimento.
6. Navegar do dashboard para orçamentos, cobranças, financeiro, comercial e Minha Semana.

Integrações reais de cobrança, NFS-e, assinatura e IA continuam respeitando o modo standby já documentado nos módulos server-first existentes.
