CREATE SCHEMA IF NOT EXISTS weeki_payments;
CREATE TABLE weeki_payments.users (id uuid PRIMARY KEY, issuer text NOT NULL, subject text NOT NULL, UNIQUE(issuer,subject));
CREATE TABLE weeki_payments.workspaces (id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE weeki_payments.memberships (workspace_id uuid REFERENCES weeki_payments.workspaces(id), user_id uuid REFERENCES weeki_payments.users(id), role text NOT NULL CHECK(role IN ('owner','admin','viewer')), PRIMARY KEY(workspace_id,user_id));
CREATE TABLE weeki_payments.sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES weeki_payments.users(id), workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id), expires_at timestamptz NOT NULL);
CREATE TABLE weeki_payments.oauth_states (state_hash text PRIMARY KEY, session_hash text NOT NULL, workspace_id uuid, provider text NOT NULL, secret text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE weeki_payments.connections (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id), data jsonb NOT NULL, UNIQUE(id,workspace_id));
CREATE UNIQUE INDEX payment_external_account_unique ON weeki_payments.connections ((data->>'provider'),(data->>'environment'),(data->>'externalAccountId')) WHERE data->>'externalAccountId' <> '';
CREATE UNIQUE INDEX payment_default_unique ON weeki_payments.connections(workspace_id,(data->>'environment')) WHERE data->>'isDefault'='true';
CREATE INDEX payment_connections_workspace ON weeki_payments.connections(workspace_id);
CREATE TABLE weeki_payments.customers (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id), local_id text NOT NULL, data jsonb NOT NULL, UNIQUE(id,workspace_id), UNIQUE(workspace_id,local_id));
CREATE TABLE weeki_payments.charges (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, connection_id uuid NOT NULL, customer_id uuid NOT NULL, request_key text NOT NULL, request_hash text NOT NULL, sync_after timestamptz NOT NULL DEFAULT now(), data jsonb NOT NULL, UNIQUE(id,workspace_id), UNIQUE(workspace_id,request_key), FOREIGN KEY(connection_id,workspace_id) REFERENCES weeki_payments.connections(id,workspace_id), FOREIGN KEY(customer_id,workspace_id) REFERENCES weeki_payments.customers(id,workspace_id), CHECK((data->>'amountMinor')::bigint>0), CHECK(data->>'currency'='BRL'));
CREATE UNIQUE INDEX payment_external_charge_unique ON weeki_payments.charges(connection_id,(data->>'externalId')) WHERE data->>'externalId' IS NOT NULL;
CREATE INDEX payment_charges_workspace ON weeki_payments.charges(workspace_id);
CREATE INDEX payment_charges_sync_due ON weeki_payments.charges(sync_after);
CREATE TABLE weeki_payments.webhook_events (id uuid PRIMARY KEY, connection_id uuid NOT NULL REFERENCES weeki_payments.connections(id), provider text NOT NULL, external_id text NOT NULL, event_type text NOT NULL, data jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), error_code text, UNIQUE(connection_id,external_id));
CREATE INDEX payment_webhook_queue ON weeki_payments.webhook_events(status,next_attempt_at);
CREATE TABLE weeki_payments.operations (charge_id uuid NOT NULL REFERENCES weeki_payments.charges(id), kind text NOT NULL, operation_key text NOT NULL, status text NOT NULL, PRIMARY KEY(charge_id,kind));
CREATE TABLE weeki_payments.finance_entries (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, charge_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('receipt','refund')), total_minor bigint NOT NULL CHECK(total_minor>0), data jsonb NOT NULL, FOREIGN KEY(charge_id,workspace_id) REFERENCES weeki_payments.charges(id,workspace_id), UNIQUE(charge_id,kind,total_minor));
CREATE UNIQUE INDEX payment_single_receipt ON weeki_payments.finance_entries(charge_id) WHERE kind='receipt';
CREATE TABLE weeki_payments.audit (id uuid PRIMARY KEY, workspace_id uuid REFERENCES weeki_payments.workspaces(id), data jsonb NOT NULL);
-- This schema is server-only. No browser role or public REST exposure. Parameterized ownership predicates
-- and composite FKs are enforced by the repository. Deployment role must not be a superuser.
REVOKE ALL ON SCHEMA weeki_payments FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA weeki_payments FROM PUBLIC;
