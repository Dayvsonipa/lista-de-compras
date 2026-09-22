CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'pt-BR'
    CHECK (preferred_language IN ('pt-BR', 'en', 'es')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  collect_prices_on_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_id, user_id)
);

CREATE TABLE IF NOT EXISTS family_invites (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopping_categories (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_products (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  normalized_name VARCHAR(140) NOT NULL,
  category_id UUID REFERENCES shopping_categories(id) ON DELETE SET NULL,
  last_unit_price NUMERIC(12, 2),
  last_purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_products_last_price_nonnegative CHECK (last_unit_price IS NULL OR last_unit_price >= 0),
  UNIQUE (family_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  category_id UUID REFERENCES shopping_categories(id) ON DELETE SET NULL,
  product_id UUID REFERENCES family_products(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  quantity VARCHAR(40) NOT NULL DEFAULT '',
  unit_price NUMERIC(12, 2),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopping_items_unit_price_nonnegative CHECK (unit_price IS NULL OR unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS purchase_sessions (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_sessions_total_nonnegative CHECK (total_amount >= 0)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES purchase_sessions(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  product_id UUID REFERENCES family_products(id) ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  category_name VARCHAR(60),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2),
  total_price NUMERIC(14, 2),
  purchased_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purchased_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT purchase_items_unit_price_nonnegative CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT purchase_items_total_nonnegative CHECK (total_price IS NULL OR total_price >= 0)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_family
  ON family_members (family_id);

CREATE INDEX IF NOT EXISTS idx_family_invites_family_expiry
  ON family_invites (family_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopping_items_family_status_created
  ON shopping_items (family_id, completed, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_categories_family_name
  ON shopping_categories (family_id, LOWER(name))
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_shopping_categories_family_order
  ON shopping_categories (family_id, active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_shopping_items_family_updated
  ON shopping_items (family_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_products_family_name
  ON family_products (family_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_purchase_sessions_family_date
  ON purchase_sessions (family_id, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product_date
  ON purchase_items (family_id, product_id, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry
  ON sessions (user_id, expires_at);
