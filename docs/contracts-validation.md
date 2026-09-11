# Validação de Contratos

Cobertura automatizada adicionada em `server/tests/contracts.test.ts`:

- criação manual com snapshot de cliente/negócio/serviço;
- sanitização de HTML perigoso;
- geração de PDF backend com checksum;
- isolamento entre workspaces;
- geração com IA por backend e criação de versão;
- envio para assinatura com idempotência;
- congelamento de versão enviada;
- webhook de assinatura idempotente;
- conclusão da assinatura com documentos assinado/evidência imutáveis.

Validações ainda dependentes de ambiente externo:

- chamada real da OpenAI com `OPENAI_API_KEY`;
- envio real no sandbox Clicksign;
- recebimento real de webhook Clicksign via HTTPS público;
- download real de PDF assinado/certificado do provedor;
- revisão jurídica do modelo base antes de uso comercial.
