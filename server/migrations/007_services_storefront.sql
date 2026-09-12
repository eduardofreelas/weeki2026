CREATE SCHEMA IF NOT EXISTS weeki_services;

CREATE TABLE IF NOT EXISTS weeki_services.services (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  slug text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('draft','published','hidden','archived')),
  availability_status text NOT NULL CHECK (availability_status IN ('available','unavailable','temporarily_unavailable','by_request')),
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed','starting_at','unit','on_request','free')),
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  hiring_type text NOT NULL CHECK (hiring_type IN ('buy_now','request_quote','schedule','contact','hire_and_schedule','consult')),
  featured boolean NOT NULL DEFAULT false,
  in_storefront boolean NOT NULL DEFAULT false,
  fiscal_service_code text,
  fiscal_iss_rate numeric(6, 3),
  data jsonb NOT NULL DEFAULT '{}',
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, lower(slug))
);
CREATE INDEX IF NOT EXISTS weeki_services_workspace_status ON weeki_services.services(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_services_workspace_storefront ON weeki_services.services(workspace_id, in_storefront, featured DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS weeki_services_workspace_category ON weeki_services.services(workspace_id, lower(category), status);

CREATE TABLE IF NOT EXISTS weeki_services.service_categories (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, lower(slug))
);

CREATE TABLE IF NOT EXISTS weeki_services.service_images (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  asset_key text,
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_service_images_service ON weeki_services.service_images(workspace_id, service_id, sort_order);

CREATE TABLE IF NOT EXISTS weeki_services.service_portfolio (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  title text NOT NULL,
  client_name text,
  project_date date,
  image_url text,
  external_url text,
  result text,
  data jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_service_portfolio_service ON weeki_services.service_portfolio(workspace_id, service_id, sort_order);

CREATE TABLE IF NOT EXISTS weeki_services.service_variants (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  name text NOT NULL,
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  highlighted boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_service_variants_service ON weeki_services.service_variants(workspace_id, service_id, sort_order);

CREATE TABLE IF NOT EXISTS weeki_services.service_extras (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  name text NOT NULL,
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  required boolean NOT NULL DEFAULT false,
  allow_quantity boolean NOT NULL DEFAULT false,
  max_quantity integer NOT NULL DEFAULT 1 CHECK (max_quantity > 0),
  data jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_service_extras_service ON weeki_services.service_extras(workspace_id, service_id, sort_order);

CREATE TABLE IF NOT EXISTS weeki_services.service_links (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weeki_services.service_faqs (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weeki_services.service_custom_fields (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','long_text','number','date','select','multi_select','checkbox','file')),
  required boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weeki_services.storefront_settings (
  workspace_id uuid PRIMARY KEY REFERENCES weeki_payments.workspaces(id),
  enabled boolean NOT NULL DEFAULT false,
  slug text NOT NULL,
  public_name text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  custom_domain text,
  accent_color text NOT NULL DEFAULT '#654ce4',
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lower(slug)),
  UNIQUE (lower(custom_domain))
);
CREATE INDEX IF NOT EXISTS weeki_storefront_settings_enabled ON weeki_services.storefront_settings(enabled, lower(slug));

CREATE TABLE IF NOT EXISTS weeki_services.storefront_slug_history (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  old_slug text NOT NULL,
  new_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lower(old_slug))
);

CREATE TABLE IF NOT EXISTS weeki_services.public_tokens (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid,
  token_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('service_view','checkout','upload','review')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at timestamptz,
  access_count integer NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  last_access_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (token_hash),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS weeki_service_tokens_lookup ON weeki_services.public_tokens(token_hash, status, expires_at);

CREATE TABLE IF NOT EXISTS weeki_services.service_orders (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  service_id uuid NOT NULL,
  number text NOT NULL,
  client_id text,
  status text NOT NULL CHECK (status IN ('interest','awaiting_payment','paid','confirmed','in_progress','completed','cancelled')),
  payment_status text NOT NULL CHECK (payment_status IN ('not_required','pending','paid','overdue','cancelled','refunded')),
  total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  quote_id uuid,
  charge_id uuid,
  contract_id uuid,
  engagement_id text,
  appointment_date date,
  appointment_time text,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  UNIQUE (workspace_id, number),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id)
);
CREATE INDEX IF NOT EXISTS weeki_service_orders_workspace_status ON weeki_services.service_orders(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_service_orders_service ON weeki_services.service_orders(workspace_id, service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_service_orders_charge ON weeki_services.service_orders(workspace_id, charge_id) WHERE charge_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS weeki_services.service_order_items (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  order_id uuid NOT NULL,
  service_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('base','variant','extra')),
  source_id uuid,
  name text NOT NULL,
  quantity numeric(14, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL DEFAULT 0 CHECK (unit_price_minor >= 0),
  total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  data jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (order_id, workspace_id) REFERENCES weeki_services.service_orders(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id)
);

CREATE TABLE IF NOT EXISTS weeki_services.analytics_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES weeki_payments.workspaces(id),
  service_id uuid,
  order_id uuid,
  kind text NOT NULL CHECK (kind IN ('storefront_view','service_view','cta_click','quote_request','purchase','appointment','checkout_abandoned')),
  ip_hash text,
  user_agent_hash text,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weeki_service_analytics_workspace ON weeki_services.analytics_events(workspace_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS weeki_service_analytics_service ON weeki_services.analytics_events(workspace_id, service_id, created_at DESC);

CREATE TABLE IF NOT EXISTS weeki_services.service_reviews (
  id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  service_id uuid NOT NULL,
  order_id uuid,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden')),
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, workspace_id),
  FOREIGN KEY (service_id, workspace_id) REFERENCES weeki_services.services(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (order_id, workspace_id) REFERENCES weeki_services.service_orders(id, workspace_id) ON DELETE SET NULL
);

ALTER TABLE weeki_services.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.storefront_slug_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.public_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeki_services.service_reviews ENABLE ROW LEVEL SECURITY;

-- Services/storefront are server-owned. Private queries must scope by authenticated workspace_id.
-- Public storefront queries must resolve only active storefront slug/custom_domain and published services.
-- Checkout totals, variant prices and extra prices must be recalculated server-side from stored records.
-- Uploads require MIME/size validation, virus scanning when available, signed object keys and rate limits.
-- Public endpoints must hash IP/user-agent where logged and must never trust prices or service IDs from the browser alone.
REVOKE ALL ON SCHEMA weeki_services FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA weeki_services FROM PUBLIC;
