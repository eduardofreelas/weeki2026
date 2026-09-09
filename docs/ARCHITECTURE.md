# Arquitetura Weeki (estado atual)

A aplicação é um SPA Next.js exportado estaticamente. Cada área (semana, clientes, agenda, financeiro, cobranças) consome um hook em `features/` que hidrata seed na primeira visita e persiste JSON no navegador.

Integrações (Asaas, Zoom, e-mail/WhatsApp de cobrança) são **interface apenas**. Não há webhooks, rate limit ou RLS porque não há backend.

Quando o backend existir, o contrato recomendado é manter os tipos em `features/*/types.ts` e substituir os hooks por clients HTTP, validando ownership no servidor.
