CREATE SCHEMA IF NOT EXISTS weeki_core;
CREATE TABLE IF NOT EXISTS weeki_core.domain_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  event_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_code text,
  UNIQUE (workspace_id, event_type, aggregate_id)
);
CREATE INDEX IF NOT EXISTS weeki_domain_events_queue ON weeki_core.domain_events(status,next_attempt_at);

CREATE SCHEMA IF NOT EXISTS weeki_fiscal;
CREATE TABLE IF NOT EXISTS weeki_fiscal.profiles (
  workspace_id uuid PRIMARY KEY REFERENCES weeki_payments.workspaces(id),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS weeki_fiscal.automation_settings (
  workspace_id uuid PRIMARY KEY REFERENCES weeki_payments.workspaces(id),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS weeki_fiscal.certificates (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  secret_reference text NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, secret_reference)
);
CREATE TABLE IF NOT EXISTS weeki_fiscal.service_configs (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  local_service_id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, local_service_id)
);
CREATE INDEX IF NOT EXISTS weeki_fiscal_service_workspace ON weeki_fiscal.service_configs(workspace_id);
CREATE TABLE IF NOT EXISTS weeki_fiscal.nfse (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  service_config_id uuid,
  request_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','PENDING','PROCESSING','AUTHORIZED','REJECTED','CANCELLED','ERROR')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, request_key),
  FOREIGN KEY (service_config_id, workspace_id) REFERENCES weeki_fiscal.service_configs(id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_fiscal_nfse_workspace ON weeki_fiscal.nfse(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_fiscal_nfse_status ON weeki_fiscal.nfse(workspace_id,status);
CREATE TABLE IF NOT EXISTS weeki_fiscal.nfse_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  nfse_id uuid NOT NULL,
  kind text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (nfse_id, workspace_id) REFERENCES weeki_fiscal.nfse(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_fiscal_events_note ON weeki_fiscal.nfse_events(workspace_id,nfse_id,created_at DESC);
CREATE TABLE IF NOT EXISTS weeki_fiscal.nfse_documents (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  nfse_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pdf','xml')),
  storage_key text NOT NULL,
  checksum text NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (nfse_id, workspace_id) REFERENCES weeki_fiscal.nfse(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (nfse_id, kind, checksum)
);
CREATE TABLE IF NOT EXISTS weeki_fiscal.nfse_errors (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  nfse_id uuid NOT NULL,
  code text NOT NULL,
  provider text NOT NULL,
  attempt integer NOT NULL CHECK (attempt > 0),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (nfse_id, workspace_id) REFERENCES weeki_fiscal.nfse(id, workspace_id) ON DELETE CASCADE
);

-- All fiscal tables are server-only. The application role must not be a superuser.
-- Workspace ownership is enforced in parameterized repositories and composite foreign keys.
REVOKE ALL ON SCHEMA weeki_core FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA weeki_core FROM PUBLIC;
REVOKE ALL ON SCHEMA weeki_fiscal FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA weeki_fiscal FROM PUBLIC;
