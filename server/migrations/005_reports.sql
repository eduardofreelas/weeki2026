CREATE SCHEMA IF NOT EXISTS weeki_reports;

CREATE TABLE IF NOT EXISTS weeki_reports.reports (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  number text NOT NULL,
  client_id text,
  type text NOT NULL CHECK (type IN ('monthly_services','activities','project','hours','financial','appointments','technical','custom')),
  status text NOT NULL CHECK (status IN ('draft','in_progress','review','ready','sent','viewed','approved','adjustment_requested','archived')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  current_version_id uuid,
  data jsonb NOT NULL,
  archived_at timestamptz,
  finalized_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, number),
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS weeki_reports_workspace_status ON weeki_reports.reports(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_reports_workspace_client ON weeki_reports.reports(workspace_id, client_id, period_end DESC);
CREATE INDEX IF NOT EXISTS weeki_reports_workspace_type ON weeki_reports.reports(workspace_id, type, period_end DESC);

CREATE TABLE IF NOT EXISTS weeki_reports.versions (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  report_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  snapshot_hash text NOT NULL,
  immutable boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES weeki_payments.users(id),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, report_id, version),
  FOREIGN KEY (report_id, workspace_id) REFERENCES weeki_reports.reports(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_report_versions_report ON weeki_reports.versions(workspace_id, report_id, version DESC);
CREATE INDEX IF NOT EXISTS weeki_report_versions_hash ON weeki_reports.versions(workspace_id, snapshot_hash);

CREATE TABLE IF NOT EXISTS weeki_reports.sections (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  report_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cover','executive_summary','indicators','text','activities','projects','services','appointments','deliverables','files','images','before_after','hours','financial','in_progress','next_steps','observations','conclusion','signature')),
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (report_id, workspace_id) REFERENCES weeki_reports.reports(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_report_sections_report ON weeki_reports.sections(workspace_id, report_id, sort_order);

CREATE TABLE IF NOT EXISTS weeki_reports.items (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  report_id uuid NOT NULL,
  section_id uuid,
  source_type text NOT NULL CHECK (source_type IN ('task','client','project','service','appointment','file','billing','finance','contract','manual')),
  source_id text,
  included boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (report_id, workspace_id) REFERENCES weeki_reports.reports(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, workspace_id) REFERENCES weeki_reports.sections(id, workspace_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS weeki_report_items_report ON weeki_reports.items(workspace_id, report_id, source_type);
CREATE INDEX IF NOT EXISTS weeki_report_items_source ON weeki_reports.items(workspace_id, source_type, source_id) WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS weeki_reports.templates (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('monthly_services','activities','project','hours','financial','appointments','technical','custom')),
  favorite boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_report_templates_workspace ON weeki_reports.templates(workspace_id, archived_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS weeki_reports.schedules (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  client_id text NOT NULL,
  template_id uuid,
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly')),
  next_run_at timestamptz NOT NULL,
  last_report_id uuid,
  active boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (template_id, workspace_id) REFERENCES weeki_reports.templates(id, workspace_id),
  FOREIGN KEY (last_report_id, workspace_id) REFERENCES weeki_reports.reports(id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_report_schedules_due ON weeki_reports.schedules(workspace_id, active, next_run_at);
CREATE INDEX IF NOT EXISTS weeki_report_schedules_client ON weeki_reports.schedules(workspace_id, client_id, active);

CREATE TABLE IF NOT EXISTS weeki_reports.shares (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  report_id uuid NOT NULL,
  token_hash text NOT NULL,
  allow_view boolean NOT NULL DEFAULT true,
  allow_download boolean NOT NULL DEFAULT false,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  access_count integer NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  last_access_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (token_hash),
  FOREIGN KEY (report_id, workspace_id) REFERENCES weeki_reports.reports(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_report_shares_report ON weeki_reports.shares(workspace_id, report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_report_shares_valid ON weeki_reports.shares(token_hash, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS weeki_reports.events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  report_id uuid,
  share_id uuid,
  kind text NOT NULL,
  actor_user_id uuid REFERENCES weeki_payments.users(id),
  actor_label text NOT NULL DEFAULT '',
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weeki_report_events_report ON weeki_reports.events(workspace_id, report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_report_events_kind ON weeki_reports.events(workspace_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS weeki_reports.task_report_metadata (
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  task_id text NOT NULL,
  include_in_reports boolean NOT NULL DEFAULT true,
  report_description text NOT NULL DEFAULT '',
  report_category text NOT NULL DEFAULT 'other' CHECK (report_category IN ('design','development','social_media','support','consulting','maintenance','engineering','architecture','photography','administrative','other')),
  evidence_notes text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, task_id)
);
CREATE INDEX IF NOT EXISTS weeki_task_report_metadata_workspace ON weeki_reports.task_report_metadata(workspace_id, include_in_reports, report_category);

ALTER TABLE weeki_reports.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_reports.task_report_metadata ENABLE ROW LEVEL SECURITY;

-- Reports are server-owned. Repositories must scope every query by workspace_id from the authenticated session.
-- Public report access must look up token_hash only, validate revocation/expiration/password server-side,
-- and return the immutable version snapshot instead of live mutable records.
REVOKE ALL ON SCHEMA weeki_reports FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA weeki_reports FROM PUBLIC;
