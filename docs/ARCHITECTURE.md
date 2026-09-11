# Arquitetura Weeki (estado atual)

A Weeki está em uma transição controlada. O frontend Next.js pode ser exportado estaticamente, e os módulos anteriores — semana, clientes, agenda, gestão financeira e seu histórico de cobranças — ainda hidratam seed e persistem JSON no navegador por hooks em `features/`.

O domínio de pagamentos conectados é separado e servidor-first. `server/` fornece API Node, sessões OIDC, PostgreSQL, autorização por workspace, adapters Asaas/Mercado Pago/Stripe, webhooks e workers. `shared/payments.ts` define o contrato público consumido por `features/payments/` e `components/payments/`. Credenciais e efeitos financeiros nunca são confiados ao perfil ou ao `localStorage`.

O domínio Fiscal segue a mesma fronteira de segurança: DTOs compartilhados, `FiscalProvider`, service/repository escopados por workspace e schema privado `weeki_fiscal`. No frontend estático, a experiência NFS-e é um sandbox visual local claramente identificado. Certificado, DPS/XML oficial, API Nacional, documentos e notificações permanecem server-only e em standby. O pagamento apenas publica `payment.confirmed`; não conhece nem chama o módulo fiscal.

O domínio de Contratos adiciona `shared/contracts.ts`, `weeki_contracts`, `ContractService`, `SignatureProvider` e `ClicksignSignatureProvider`. O frontend local cria, edita e versiona contratos com snapshots dos cadastros atuais; o backend autenticado fica responsável por IA, PDF, idempotência de envio, webhooks, evidências e isolamento por workspace. Contrato, assinatura e status comercial são estados separados.

Publicar somente `out/` mantém o protótipo estático, mas deixa pagamentos conectados, emissão fiscal real, IA de contratos e assinatura eletrônica indisponíveis. A implantação completa serve frontend e APIs na mesma origem por `npm run start:payments`. Consulte [payments.md](payments.md), [fiscal.md](fiscal.md) e [contracts.md](contracts.md) para topologia, segurança, migrations e homologação.

Google Drive, Trello, Zoom e demais integrações continuam apenas como interface. A migração futura dos outros módulos deve preservar os tipos existentes quando adequado e substituir os hooks por clientes HTTP com ownership validado no backend.

Configurações é uma área permanente da aplicação. Ela possui visão geral, busca, acesso fixo no desktop, acesso direto no mobile e estados explícitos para diferenciar preferências locais de recursos que exigem o backend autenticado.
