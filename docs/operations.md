# Operação legada — vínculo interno V1

O módulo visual de Atendimentos/Comercial foi removido da navegação. Este domínio permanece como vínculo interno para preservar histórico e integrações entre serviços, orçamentos, tarefas, cobranças, contratos e relatórios.

```text
Serviço → Orçamento → Demanda interna → Tarefas / Entregas / Horas → Cobrança → Financeiro / Fiscal / Relatório
```

## Entidades

- **Serviço**: catálogo reaproveitado por vitrine, orçamentos, vínculos internos, contratos e Fiscal/NFS-e. A V1 preserva os IDs antigos para manter os vínculos já existentes.
- **Oportunidade**: registro legado leve, com origem, próxima ação, valor estimado e status.
- **Orçamento**: itens, quantidade, preço unitário, desconto, acréscimo, validade, prazo, condições e status.
- **Demanda interna**: registro central do serviço prestado para um cliente, com responsável, datas, valor, recorrência e vínculos para evolução futura.
- **Ciclo**: período simples de um atendimento recorrente, sem motor de assinaturas.
- **Entrega**: evidência interna do que foi enviado ou aprovado pelo cliente.
- **Tempo**: lançamento manual de minutos, ligado opcionalmente à tarefa, atendimento e cliente.

## Persistência atual

Em modo estático, os dados são persistidos no navegador em `weeki.operations.v1`, seguindo o mesmo padrão dos módulos legados de tarefas, clientes, agenda, cobranças e financeiro. O modelo é tipado e não usa arrays mockados como fonte de dados depois da hidratação inicial.

Quando a aplicação autenticada for migrada para o backend, essa fronteira pode ser substituída por repositórios escopados por workspace sem alterar os componentes: os IDs já são não sequenciais, os registros possuem timestamps e os relacionamentos são explícitos.

## Fluxos fechados

1. Criar orçamento com itens livres ou serviços cadastrados, copiando os dados para o snapshot do orçamento.
2. Aprovar orçamento e gerar cobrança, contrato ou demanda interna.
3. Criar automaticamente tarefas padrão quando houver serviço com esse padrão.
4. Preservar ciclos, entregas e tempo como dados internos para histórico.
5. Navegar do dashboard para serviços, orçamentos, cobranças, financeiro e Minha Semana.

Integrações reais de cobrança, NFS-e, assinatura e IA continuam respeitando o modo standby já documentado nos módulos server-first existentes.
