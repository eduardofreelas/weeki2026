# Serviços e Vitrine Pública

O módulo Serviços volta a ser uma área principal da Weeki, agora como catálogo comercial, portfólio, vitrine pública e origem de contratações.

Fluxo funcional da V1:

Serviço → Vitrine pública → Detalhe do serviço → Plano/extras → Dados do cliente → Orçamento, agendamento ou cobrança → Contrato / Demanda / Financeiro / Fiscal

## Funcionalidades

- Tela principal com cards e lista.
- Status independente da disponibilidade: rascunho, publicado, oculto, arquivado; disponível, indisponível, temporariamente indisponível e sob consulta.
- Cadastro profissional com abas para informações principais, mídia/galeria, portfólio, vídeos, links, preço, planos, extras, contratação, SEO e dados fiscais opcionais.
- Publicação na vitrine, destaque, compartilhamento, abertura de página pública e QR Code.
- Preços flexíveis: fixo, a partir de, por unidade, sob consulta e gratuito.
- Planos/variações e extras com recálculo automático no checkout.
- Itens inclusos, não inclusos, prazo, duração, FAQ e campos personalizados.
- Configurações da vitrine com slug, nome público, marca, contatos, sobre, cor de destaque, SEO e domínio próprio futuro.
- Rota pública `/vitrine?slug=...` e detalhe `/vitrine?slug=...&service=...`.
- Checkout local com etapas de serviço, opções, extras, dados do cliente, perguntas, agendamento e pagamento quando aplicável.
- Contratações originadas da vitrine com status, valor, pagamento, cliente, agenda e conversões.
- Analytics básico: visualizações, cliques, solicitações, compras, agendamentos e conversão.
- Conversão de contratação em orçamento, cobrança, contrato ou demanda/atendimento.

## Relação com Orçamentos

Os serviços cadastrados continuam disponíveis na criação de orçamentos. Ao selecionar um serviço, o orçamento recebe nome, descrição, unidade, preço e dados fiscais opcionais, mas o usuário pode alterar os valores no orçamento sem alterar o cadastro original.

## Relação com Cobranças e Pagamentos

Quando o serviço exige compra ou contratação com agenda, a V1 cria uma cobrança local com o provedor configurado como destino conceitual. A Weeki não armazena dados de cartão. Na ativação backend, o checkout deve redirecionar para Asaas, Mercado Pago ou Stripe e considerar receita apenas após confirmação do pagamento.

## Relação com Agenda

Serviços com agendamento usam duração, intervalo, antecedência e horários permitidos. A V1 registra o agendamento no navegador; a versão backend deve validar disponibilidade e reservar horário no servidor.

## Relação com Contratos, Demandas e Fiscal

Uma contratação pode gerar contrato e demanda com snapshot do serviço, cliente, plano, extras e valor. Dados fiscais são opcionais no serviço e servem como referência futura para NFS-e. A emissão fiscal automática continua condicionada às configurações do módulo Fiscal.

## Backend preparado

A migration `server/migrations/007_services_storefront.sql` adiciona o schema server-only `weeki_services` com:

- `services`
- `service_categories`
- `service_images`
- `service_portfolio`
- `service_variants`
- `service_extras`
- `service_links`
- `service_faqs`
- `service_custom_fields`
- `storefront_settings`
- `storefront_slug_history`
- `public_tokens`
- `service_orders`
- `service_order_items`
- `analytics_events`
- `service_reviews`

O schema habilita RLS, revoga acesso público, referencia `weeki_payments.workspaces` e documenta as regras de segurança para repositórios futuros.

## Segurança e pontos server-side

- Toda rota privada deve validar sessão, workspace e permissão no servidor.
- Rotas públicas devem buscar vitrine por slug/domínio ativo e apenas serviços publicados.
- Totais do checkout, preço de plano e preço de extra devem ser recalculados no backend.
- Uploads devem validar MIME, tamanho, assinatura de objeto, antivírus quando disponível e expiração de URL.
- Tokens públicos devem ser armazenados por hash, com revogação, expiração e rate limit.
- Analytics deve registrar IP/user-agent apenas como hash.
- Checkout não deve confiar em IDs ou preços enviados pelo navegador.

## Pendências externas

- APIs privadas e públicas do módulo.
- Persistência multi-tenant real para serviços, vitrine, pedidos e analytics.
- Checkout real com Asaas, Mercado Pago e Stripe.
- Webhooks para confirmação, estorno e cancelamento de pagamentos.
- Envio transacional de e-mail/WhatsApp.
- Armazenamento de arquivos/imagens.
- Domínio próprio com DNS/SSL e redirects de slugs antigos.
- Avaliações públicas moderadas.
