# Conta, onboarding e disponibilidade

Esta entrega adiciona a base autenticada para perfil de conta, workspace, onboarding e disponibilidade sem criar um sistema paralelo de identidade. O backend reutiliza `SessionAuth`, `weeki_payments.users`, `weeki_payments.workspaces`, `memberships` e sessão opaca em cookie HttpOnly.

## Frontend

- `/entrar`, `/criar-conta`, `/recuperar-senha` e `/redefinir-senha` usam telas dedicadas de autenticação.
- A rota principal `/` exige sessão somente quando `NEXT_PUBLIC_AUTH_API_ENABLED=true`.
- Usuário autenticado com onboarding `not_started` ou `in_progress` entra no onboarding progressivo.
- Usuário com onboarding `skipped` entra no produto e vê lembrete discreto para retomar.
- `Configurações` agora contempla Perfil, Negócio, Disponibilidade, Integrações, Equipe, Plano e Segurança.
- `Configurações -> Disponibilidade` e o onboarding usam a mesma fonte de dados e o mesmo componente.
- `/agendar` calcula horários a partir da disponibilidade salva, respeitando duração, intervalo, antecedência e agenda futura.

## Backend

Novas rotas:

- `GET /api/auth/config`
- `GET /api/auth/login`
- `GET /api/auth/signup`
- `GET /api/auth/oauth/google`
- `GET /api/auth/oauth/apple`
- `GET /api/auth/callback`
- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`
- `POST /api/auth/logout`
- `GET /api/account/session`
- `GET /api/account/availability`
- `PATCH /api/account/availability`
- `PATCH /api/account/profile`
- `PATCH /api/account/onboarding`

Todas as mutações passam por `requireOrigin`, sessão autenticada e `workspace_id` derivado do cookie. O navegador não escolhe workspace.

## Banco de dados

A migration `004_account_availability.sql` adiciona:

- campos de workspace: nome, negócio, área, descrição, fuso e `updated_at`;
- `weeki_payments.user_profiles`;
- `weeki_payments.auth_providers`;
- `weeki_payments.onboarding_progress`;
- `weeki_payments.availability_settings`;
- `weeki_payments.availability_periods`;
- `weeki_payments.availability_exceptions`;
- constraint para horários válidos;
- índice por workspace/dia;
- trigger que bloqueia períodos sobrepostos no mesmo dia.

## Variáveis

Para ativar a autenticação real:

```env
NEXT_PUBLIC_AUTH_API_ENABLED=true
APP_ORIGIN=https://seu-dominio
DATABASE_URL=postgres://...
PAYMENTS_ENCRYPTION_KEY=base64-com-32-bytes
OIDC_ISSUER=https://...
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
```

Callbacks a cadastrar no provedor OIDC:

- `APP_ORIGIN/api/auth/callback`
- `APP_ORIGIN/api/payments/auth/callback`

Para direcionar botões sociais quando o provedor exigir hints:

```env
OIDC_PROVIDER_HINT_PARAM=
OIDC_GOOGLE_PROVIDER_HINT=
OIDC_APPLE_PROVIDER_HINT=
OIDC_EMAIL_PROVIDER_HINT=
OIDC_PASSWORD_RESET_URL=
```

Google e Apple dependem de configuração real no provedor de identidade. Nenhum segredo deve ser colocado no frontend ou versionado.

## Testes

- `npm run lint`
- `npm run build`
- `npm run test:server`

Os testes adicionados cobrem persistência e isolamento de disponibilidade, validação contra sobreposição, persistência de perfil/onboarding e proteção HTTP com sessão + CSRF.
