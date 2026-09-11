# Checklist externa de Contratos

Use esta lista antes de declarar IA e assinatura eletrônica como operacionais em produção.

- OpenAI: chave server-side ativa, modelo definido em `OPENAI_CONTRACTS_MODEL`, política de retenção/privacidade revisada e logs sem conteúdo contratual completo.
- Clicksign: conta sandbox, token de API, segredo de webhook, URL oficial do ambiente e documentos de teste aprovados.
- Webhook: endpoint `APP_ORIGIN/webhooks/clicksign` com HTTPS, assinatura HMAC validada, replays rejeitados por idempotência e eventos duplicados sem efeito adicional.
- PDF: versão enviada congelada, hash SHA-256 gravado, arquivo final assinado e evidência baixados do provedor.
- Permissões: OIDC ativo, usuários por workspace, papel `owner/admin` para mutações críticas e negação de acesso entre workspaces testada.
- LGPD: confirmação de revisão antes de envio, dados mínimos para IA/provedor, sem treinamento por contrato salvo pela Weeki.
- Produção: `CONTRACTS_ENVIRONMENT=production` e `CONTRACTS_LIVE_ENABLED=true` somente após homologação assinada.
