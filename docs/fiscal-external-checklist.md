# Checklist externa para ativar NFS-e

Não envie certificados, senhas ou tokens por chat, e-mail, GitHub ou frontend. Esta checklist deve ser concluída em homologação antes de qualquer emissão real.

## Infraestrutura

- [ ] Aplicação Node 22.13+ persistente e PostgreSQL com backup/restauração testados.
- [ ] Domínio HTTPS de mesma origem para frontend e `/api/fiscal/*`.
- [ ] OIDC configurado e ownership por workspace validado.
- [ ] Papel de migration separado do papel restrito de runtime.
- [ ] KMS/Vault capaz de guardar o PFX A1 e a senha sem retorná-los ao frontend.
- [ ] Rotação, revogação, auditoria e backup da referência do certificado definidos.
- [ ] Object storage privado com criptografia, lifecycle, checksum e URL assinada curta.
- [ ] Provedor transacional de e-mail atual identificado e configurado; não criar outro sem necessidade.
- [ ] Rate limiting/WAF distribuído, logs sanitizados, alertas e monitoramento.

## Fiscal e credenciamento

- [ ] Confirmar com a contabilidade regime, inscrições, códigos, alíquotas, retenções e municípios.
- [ ] Confirmar que o município emissor está aderente e quais parâmetros são obrigatórios.
- [ ] Obter certificado A1 válido e credenciais/autorizações necessárias.
- [ ] Selecionar e fixar as versões oficiais de leiaute, XSD, anexos e DANFSe.
- [ ] Configurar somente as URLs oficiais do ambiente escolhido.
- [ ] Validar autenticação, assinatura XML e cadeia do certificado em produção restrita.
- [ ] Definir retenção legal, acesso e descarte de XML/PDF.

## Homologação

- [ ] Manter `FISCAL_ENVIRONMENT=sandbox`, `FISCAL_LIVE_ENABLED=false`, `NFSE_AUTO_ISSUE_ENABLED=false`.
- [ ] Testar prestador PF/PJ e os regimes efetivamente suportados.
- [ ] Testar tomador PF/PJ, endereço incompleto e documento inválido.
- [ ] Testar serviço, município, ISS e retenções aplicáveis.
- [ ] Testar autorização, rejeição, timeout, consulta e resposta fora de ordem.
- [ ] Confirmar que clique duplo e reentrega de evento não emitem duas notas.
- [ ] Validar DANFSe/PDF e XML contra os documentos oficiais.
- [ ] Testar cancelamento e substituição somente quando o contrato oficial correspondente estiver implementado.
- [ ] Testar e-mail, link seguro, expiração e anexação por referência única.
- [ ] Testar isolamento com dois workspaces e papéis viewer/admin/owner.
- [ ] Validar desktop, notebook, tablet, celular e tema escuro no ambiente público de homologação.
- [ ] Executar restauração do banco e rollback da aplicação sem apagar histórico fiscal.

## Liberação gradual

- [ ] Habilitar `NEXT_PUBLIC_FISCAL_API_ENABLED` apenas depois do cliente HTTP autenticado ser homologado.
- [ ] Habilitar `NFSE_NATIONAL_INTEGRATION_ENABLED` para um workspace piloto.
- [ ] Assinar evidências de homologação antes de `FISCAL_LIVE_ENABLED=true`.
- [ ] Ativar emissão manual real antes das automações.
- [ ] Ativar `NFSE_AUTO_ISSUE_ENABLED` somente após monitoramento, conciliação e alertas.
- [ ] Manter WhatsApp desligado até existir provedor oficial e consentimento adequado.
