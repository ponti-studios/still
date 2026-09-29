-- PostgreSQL target schema. Items remain canonical through the full lifecycle;
-- purchase intent, acquisition, and retirement are related lifecycle records.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE item_status AS ENUM ('idea','wanted','planned','ordered','delivered','owned','sold','gifted','donated','disposed','lost','stolen');
CREATE TYPE ownership_role AS ENUM ('personal','shared','household','business');
CREATE TYPE inventory_behavior AS ENUM ('serialized','quantity');
CREATE TYPE order_status AS ENUM ('draft','placed','partially_received','received','cancelled','returned');
CREATE TYPE retirement_type AS ENUM ('sold','gifted','donated','disposed','lost','stolen');
CREATE TYPE packing_status AS ENUM ('planning','packing','packed','in_transit','unpacked','cancelled');

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
  icon text, color text, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL, sort_order integer NOT NULL DEFAULT 0, UNIQUE(category_id,name)
);
CREATE TABLE brands (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, website_url text, notes text);
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, location_type text NOT NULL DEFAULT 'place',
  parent_location_id uuid REFERENCES locations(id) ON DELETE SET NULL, address text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(parent_location_id,name)
);
CREATE TABLE containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, container_type text,
  parent_container_id uuid REFERENCES containers(id) ON DELETE SET NULL,
  current_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  description text, weight_kg numeric(10,3), volume_cbm numeric(10,4), archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_item_id text UNIQUE,
  name text NOT NULL, brand_id uuid REFERENCES brands(id) ON DELETE SET NULL, model text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  status item_status NOT NULL DEFAULT 'idea', ownership_role ownership_role NOT NULL DEFAULT 'personal',
  inventory_behavior inventory_behavior NOT NULL DEFAULT 'serialized', quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK(quantity >= 0),
  size text, color text, serial_number text, description text, notes text, product_url text,
  weight_kg numeric(10,3), volume_cbm numeric(10,4),
  current_container_id uuid REFERENCES containers(id) ON DELETE SET NULL,
  current_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  CHECK (subcategory_id IS NULL OR category_id IS NOT NULL)
);
CREATE INDEX items_status_idx ON items(status) WHERE deleted_at IS NULL;
CREATE INDEX items_category_idx ON items(category_id) WHERE deleted_at IS NULL;
CREATE INDEX items_name_search_idx ON items USING gin(to_tsvector('english', name));
CREATE TABLE purchase_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  priority smallint CHECK(priority BETWEEN 1 AND 5), target_price numeric(12,2), currency char(3) NOT NULL DEFAULT 'GBP',
  desired_by date, intended_vendor text, product_url text, reason text, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text, vendor text NOT NULL,
  status order_status NOT NULL DEFAULT 'draft', placed_at timestamptz, expected_at date, delivered_at timestamptz,
  subtotal numeric(12,2), tax numeric(12,2), shipping numeric(12,2), currency char(3) NOT NULL DEFAULT 'GBP',
  tracking_url text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT, quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK(quantity > 0),
  unit_price numeric(12,2), received_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(received_quantity >= 0),
  notes text, UNIQUE(order_id,item_id)
);
CREATE TABLE acquisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  order_line_id uuid REFERENCES order_lines(id) ON DELETE SET NULL, acquired_at date NOT NULL DEFAULT CURRENT_DATE,
  acquisition_type text NOT NULL DEFAULT 'purchase', purchase_price numeric(12,2), currency char(3) NOT NULL DEFAULT 'GBP',
  vendor text, condition text, warranty_until date, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE retirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  retired_at date NOT NULL DEFAULT CURRENT_DATE, retirement_type retirement_type NOT NULL,
  proceeds numeric(12,2), recipient text, reason text, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE item_location_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  from_location_id uuid REFERENCES locations(id) ON DELETE SET NULL, to_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  from_container_id uuid REFERENCES containers(id) ON DELETE SET NULL, to_container_id uuid REFERENCES containers(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now(), notes text
);
CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, icon text, color text,
  is_smart boolean NOT NULL DEFAULT false, filter_definition jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collection_items (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE, sort_order integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(collection_id,item_id)
);
CREATE TABLE packing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, status packing_status NOT NULL DEFAULT 'planning',
  origin_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  starts_at date, ends_at date, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE packing_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES packing_sessions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  container_id uuid REFERENCES containers(id) ON DELETE SET NULL, quantity numeric(12,3) NOT NULL DEFAULT 1,
  packed_at timestamptz, unpacked_at timestamptz, notes text, UNIQUE(session_id,item_id)
);
CREATE TABLE activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  event_type text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_item_time_idx ON activity_events(item_id,occurred_at DESC);

-- The app/service layer changes items.status as milestones occur and records a
-- matching acquisition, retirement, or activity event in the same transaction.
