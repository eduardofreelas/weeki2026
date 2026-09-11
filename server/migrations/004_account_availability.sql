ALTER TABLE weeki_payments.workspaces ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Meu espaco Weeki';
ALTER TABLE weeki_payments.workspaces ADD COLUMN IF NOT EXISTS business_name text NOT NULL DEFAULT '';
ALTER TABLE weeki_payments.workspaces ADD COLUMN IF NOT EXISTS business_area text NOT NULL DEFAULT '';
ALTER TABLE weeki_payments.workspaces ADD COLUMN IF NOT EXISTS work_description text NOT NULL DEFAULT '';
ALTER TABLE weeki_payments.workspaces ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Fortaleza';
ALTER TABLE weeki_payments.workspaces ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS weeki_payments.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES weeki_payments.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  name text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  professional_name text NOT NULL DEFAULT '',
  terms_accepted_at timestamptz,
  privacy_policy_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_verified_email_unique
  ON weeki_payments.user_profiles (lower(email))
  WHERE email <> '' AND email_verified;

CREATE TABLE IF NOT EXISTS weeki_payments.auth_providers (
  user_id uuid NOT NULL REFERENCES weeki_payments.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('oidc','email','google','apple')),
  issuer text NOT NULL,
  subject text NOT NULL,
  email text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider, issuer, subject),
  UNIQUE(user_id, provider, issuer, subject)
);

CREATE INDEX IF NOT EXISTS auth_providers_user ON weeki_payments.auth_providers(user_id);

CREATE TABLE IF NOT EXISTS weeki_payments.onboarding_progress (
  workspace_id uuid PRIMARY KEY REFERENCES weeki_payments.workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','skipped','completed')),
  step text NOT NULL DEFAULT 'work' CHECK(step IN ('work','space','availability','connections','done')),
  completed_steps text[] NOT NULL DEFAULT '{}',
  skipped_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weeki_payments.availability_settings (
  workspace_id uuid PRIMARY KEY REFERENCES weeki_payments.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES weeki_payments.users(id) ON DELETE SET NULL,
  timezone text NOT NULL,
  default_duration_minutes integer NOT NULL CHECK(default_duration_minutes BETWEEN 5 AND 480),
  buffer_minutes integer NOT NULL CHECK(buffer_minutes BETWEEN 0 AND 240),
  min_notice_minutes integer NOT NULL CHECK(min_notice_minutes >= 0),
  max_future_days integer NOT NULL CHECK(max_future_days BETWEEN 1 AND 730),
  configured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weeki_payments.availability_periods (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.availability_settings(workspace_id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at > starts_at),
  UNIQUE(workspace_id, weekday, starts_at, ends_at)
);

CREATE INDEX IF NOT EXISTS availability_periods_workspace_day
  ON weeki_payments.availability_periods(workspace_id, weekday, starts_at);

CREATE OR REPLACE FUNCTION weeki_payments.prevent_availability_overlap()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM weeki_payments.availability_periods existing
    WHERE existing.workspace_id = NEW.workspace_id
      AND existing.weekday = NEW.weekday
      AND existing.id <> NEW.id
      AND NEW.starts_at < existing.ends_at
      AND existing.starts_at < NEW.ends_at
  ) THEN
    RAISE EXCEPTION 'availability periods cannot overlap';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS availability_periods_no_overlap ON weeki_payments.availability_periods;
CREATE TRIGGER availability_periods_no_overlap
  BEFORE INSERT OR UPDATE ON weeki_payments.availability_periods
  FOR EACH ROW EXECUTE FUNCTION weeki_payments.prevent_availability_overlap();

CREATE TABLE IF NOT EXISTS weeki_payments.availability_exceptions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.availability_settings(workspace_id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  kind text NOT NULL CHECK(kind IN ('available','blocked','holiday','vacation')),
  starts_at time,
  ends_at time,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((starts_at IS NULL AND ends_at IS NULL) OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at))
);

CREATE INDEX IF NOT EXISTS availability_exceptions_workspace_date
  ON weeki_payments.availability_exceptions(workspace_id, exception_date);
