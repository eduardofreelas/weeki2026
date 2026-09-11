CREATE SCHEMA IF NOT EXISTS weeki_contracts;

CREATE TABLE IF NOT EXISTS weeki_contracts.contracts (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  number text NOT NULL,
  client_id text,
  related_service_id text,
  related_task_id text,
  related_project_id text,
  proposal_id text,
  charge_id text,
  current_version_id uuid,
  editorial_status text NOT NULL CHECK (editorial_status IN ('draft','review','ready')),
  signature_status text NOT NULL CHECK (signature_status IN ('not_started','preparing','sent','viewed','partially_signed','signed','declined','expired','cancelled','error')),
  contract_status text NOT NULL CHECK (contract_status IN ('pending','active','ending_soon','ended','terminated','cancelled','archived')),
  ai_generated boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, number)
);
CREATE INDEX IF NOT EXISTS weeki_contracts_workspace_status ON weeki_contracts.contracts(workspace_id, contract_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_contracts_workspace_client ON weeki_contracts.contracts(workspace_id, client_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_contracts_workspace_signature ON weeki_contracts.contracts(workspace_id, signature_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_contracts_workspace_links ON weeki_contracts.contracts(workspace_id, related_task_id, charge_id);

CREATE TABLE IF NOT EXISTS weeki_contracts.templates (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  name text NOT NULL,
  favorite boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_contract_templates_workspace ON weeki_contracts.templates(workspace_id, archived_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS weeki_contracts.versions (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  content_hash text NOT NULL,
  immutable boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, contract_id, version),
  FOREIGN KEY (contract_id, workspace_id) REFERENCES weeki_contracts.contracts(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_contract_versions_contract ON weeki_contracts.versions(workspace_id, contract_id, version DESC);

CREATE TABLE IF NOT EXISTS weeki_contracts.parties (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  role text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (contract_id, workspace_id) REFERENCES weeki_contracts.contracts(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_contract_parties_contract ON weeki_contracts.parties(workspace_id, contract_id);

CREATE TABLE IF NOT EXISTS weeki_contracts.signers (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  email text NOT NULL,
  signing_order integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('not_started','preparing','sent','viewed','partially_signed','signed','declined','expired','cancelled','error')),
  external_id text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (contract_id, workspace_id) REFERENCES weeki_contracts.contracts(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_contract_signers_contract ON weeki_contracts.signers(workspace_id, contract_id, signing_order);
CREATE INDEX IF NOT EXISTS weeki_contract_signers_external ON weeki_contracts.signers(workspace_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS weeki_contracts.documents (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  version_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('preview_pdf','signature_pdf','signed_pdf','evidence','attachment')),
  storage_key text NOT NULL,
  checksum text NOT NULL,
  content_type text NOT NULL,
  size bigint NOT NULL CHECK (size >= 0),
  immutable boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (contract_id, workspace_id) REFERENCES weeki_contracts.contracts(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, workspace_id) REFERENCES weeki_contracts.versions(id, workspace_id),
  UNIQUE (workspace_id, contract_id, kind, checksum)
);
CREATE INDEX IF NOT EXISTS weeki_contract_documents_contract ON weeki_contracts.documents(workspace_id, contract_id, created_at DESC);

CREATE TABLE IF NOT EXISTS weeki_contracts.signature_requests (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  version_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('clicksign')),
  external_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('not_started','preparing','sent','viewed','partially_signed','signed','declined','expired','cancelled','error')),
  request_key text NOT NULL,
  request_hash text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, contract_id, request_key),
  UNIQUE (provider, external_id),
  FOREIGN KEY (contract_id, workspace_id) REFERENCES weeki_contracts.contracts(id, workspace_id),
  FOREIGN KEY (version_id, workspace_id) REFERENCES weeki_contracts.versions(id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_contract_signature_contract ON weeki_contracts.signature_requests(workspace_id, contract_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_contract_signature_status ON weeki_contracts.signature_requests(workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS weeki_contracts.signature_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  signature_request_id uuid,
  contract_id uuid,
  provider text NOT NULL CHECK (provider IN ('clicksign')),
  external_id text NOT NULL,
  event_type text NOT NULL,
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retry','processed','ignored','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  error_code text,
  UNIQUE (provider, external_id)
);
CREATE INDEX IF NOT EXISTS weeki_contract_signature_event_queue ON weeki_contracts.signature_events(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS weeki_contract_signature_event_contract ON weeki_contracts.signature_events(workspace_id, contract_id, received_at DESC);

CREATE TABLE IF NOT EXISTS weeki_contracts.audit (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  contract_id uuid,
  action text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weeki_contract_audit_workspace ON weeki_contracts.audit(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_contract_audit_contract ON weeki_contracts.audit(workspace_id, contract_id, created_at DESC);

-- The contracts schema is server-only. Parameterized authorization and composite keys enforce tenant isolation.
REVOKE ALL ON SCHEMA weeki_contracts FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA weeki_contracts FROM PUBLIC;
