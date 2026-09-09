# Arquitetura Weeki (estado atual)

A Weeki está em uma transição controlada. O frontend Next.js pode ser exportado estaticamente, e os módulos anteriores — semana, clientes, agenda, gestão financeira e seu histórico de cobranças — ainda hidratam seed e persistem JSON no navegador por hooks em `features/`.

O domínio de pagamentos conectados é separado e servidor-first. `server/` fornece API Node, sessões OIDC, PostgreSQL, autorização por workspace, adapters Asaas/Mercado Pago/Stripe, webhooks e workers. `shared/payments.ts` define o contrato público consumido por `features/payments/` e `components/payments/`. Credenciais e efeitos financeiros nunca são confiados ao perfil ou ao `localStorage`.

Publicar somente `out/` mantém o protótipo estático, mas deixa pagamentos conectados indisponíveis. A implantação completa serve frontend e API na mesma origem por `npm run start:payments`. Consulte [payments.md](payments.md) para topologia, segurança, migrations e homologação.

Google Drive, Trello, Zoom e demais integrações continuam apenas como interface. A migração futura dos outros módulos deve preservar os tipos existentes quando adequado e substituir os hooks por clientes HTTP com ownership validado no backend.
