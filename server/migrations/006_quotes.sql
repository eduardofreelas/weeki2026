CREATE SCHEMA IF NOT EXISTS weeki_quotes;

CREATE TABLE IF NOT EXISTS weeki_quotes.quotes (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  number text NOT NULL,
  client_id text,
  opportunity_id text,
  current_version_id uuid,
  status text NOT NULL CHECK (status IN ('draft','sent','viewed','awaiting_approval','approved','rejected','expired','cancelled')),
  title text NOT NULL,
  total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  issue_date date NOT NULL,
  valid_until date,
  responsible_user_id uuid REFERENCES weeki_payments.users(id),
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, number)
);
CREATE INDEX IF NOT EXISTS weeki_quotes_workspace_status ON weeki_quotes.quotes(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_quotes_workspace_client ON weeki_quotes.quotes(workspace_id, client_id, created_at DESC) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS weeki_quotes_workspace_validity ON weeki_quotes.quotes(workspace_id, valid_until, status);

CREATE TABLE IF NOT EXISTS weeki_quotes.quote_items (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  saved_item_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  unit_price_minor bigint NOT NULL DEFAULT 0 CHECK (unit_price_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  addition_minor bigint NOT NULL DEFAULT 0 CHECK (addition_minor >= 0),
  total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (quote_id, workspace_id) REFERENCES weeki_quotes.quotes(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_quote_items_quote ON weeki_quotes.quote_items(workspace_id, quote_id, sort_order);
CREATE INDEX IF NOT EXISTS weeki_quote_items_saved_item ON weeki_quotes.quote_items(workspace_id, saved_item_id) WHERE saved_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS weeki_quotes.quote_versions (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  number text NOT NULL,
  snapshot_hash text NOT NULL,
  immutable boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES weeki_payments.users(id),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, quote_id, version),
  FOREIGN KEY (quote_id, workspace_id) REFERENCES weeki_quotes.quotes(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_quote_versions_quote ON weeki_quotes.quote_versions(workspace_id, quote_id, version DESC);
CREATE INDEX IF NOT EXISTS weeki_quote_versions_hash ON weeki_quotes.quote_versions(workspace_id, snapshot_hash);

CREATE TABLE IF NOT EXISTS weeki_quotes.saved_items (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  name text NOT NULL,
  internal_code text,
  default_unit text NOT NULL,
  default_price_minor bigint NOT NULL DEFAULT 0 CHECK (default_price_minor >= 0),
  fiscal_code text,
  active boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_quote_saved_items_workspace ON weeki_quotes.saved_items(workspace_id, active, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS weeki_quote_saved_items_code ON weeki_quotes.saved_items(workspace_id, lower(internal_code)) WHERE internal_code IS NOT NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS weeki_quotes.quote_templates (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  name text NOT NULL,
  favorite boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_quote_templates_workspace ON weeki_quotes.quote_templates(workspace_id, archived_at, favorite DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS weeki_quotes.quote_settings (
  workspace_id uuid PRIMARY KEY REFERENCES weeki_payments.workspaces(id),
  prefix text NOT NULL DEFAULT 'ORC',
  default_validity_days integer NOT NULL DEFAULT 15 CHECK (default_validity_days > 0),
  default_deadline_days integer NOT NULL DEFAULT 30 CHECK (default_deadline_days > 0),
  currency text NOT NULL DEFAULT 'BRL',
  decimal_places integer NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 4),
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weeki_quotes.public_tokens (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at timestamptz,
  access_count integer NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  last_access_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (token_hash),
  FOREIGN KEY (quote_id, workspace_id) REFERENCES weeki_quotes.quotes(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_quote_public_tokens_quote ON weeki_quotes.public_tokens(workspace_id, quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_quote_public_tokens_lookup ON weeki_quotes.public_tokens(token_hash, status, expires_at);

CREATE TABLE IF NOT EXISTS weeki_quotes.quote_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  quote_id uuid,
  public_token_id uuid,
  kind text NOT NULL,
  actor_user_id uuid REFERENCES weeki_payments.users(id),
  actor_label text NOT NULL DEFAULT '',
  ip_hash text,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weeki_quote_events_quote ON weeki_quotes.quote_events(workspace_id, quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_quote_events_kind ON weeki_quotes.quote_events(workspace_id, kind, created_at DESC);

ALTER TABLE weeki_quotes.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_quotes.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_quotes.quote_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_quotes.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_quotes.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_quotes.quote_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_quotes.public_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_quotes.quote_events ENABLE ROW LEVEL SECURITY;

-- Quotes are server-owned. Runtime repositories must scope every private query by workspace_id
-- from the authenticated session and recalculate monetary totals server-side.
-- Public quote access must look up only token_hash, validate revocation/expiration/rate limits,
-- and write view/approval/refusal events without exposing sequential IDs.
REVOKE ALL ON SCHEMA weeki_quotes FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA weeki_quotes FROM PUBLIC;
