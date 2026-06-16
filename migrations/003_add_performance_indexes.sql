-- Migration 003: Add targeted performance indexes based on EXPLAIN ANALYZE findings
-- Run with: psql $DATABASE_URL -f migrations/003_add_performance_indexes.sql
-- Each index is justified by the EXPLAIN ANALYZE finding that demanded it.

-- ─────────────────────────────────────────────────────────────────────────────
-- ORDERS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

-- EXPLAIN ANALYZE showed a Seq Scan on orders (cost 0..35.80) filtering by user_id;
-- every call to GET /api/orders/history scans the entire table without this index.
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON orders(user_id);

-- EXPLAIN ANALYZE showed ORDER BY created_at DESC causing a sort node with high cost;
-- this index lets Postgres avoid the sort entirely for DESC order history queries.
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON orders(created_at DESC);

-- Composite index covers both the WHERE user_id = $1 filter and ORDER BY created_at DESC
-- in a single index scan, eliminating both the Seq Scan and the Sort node simultaneously.
CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON orders(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- ORDER_ITEMS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

-- EXPLAIN ANALYZE showed a Seq Scan on order_items for every N+1 loop iteration
-- (WHERE order_id = $1); this index turns each lookup from O(n) to O(log n).
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

-- EXPLAIN ANALYZE showed a Seq Scan on order_items when joining to menu_items
-- (WHERE item_id = $1 for popularity counts); this index supports that join efficiently.
CREATE INDEX IF NOT EXISTS idx_order_items_item_id
  ON order_items(item_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MENU_ITEMS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

-- EXPLAIN ANALYZE showed a Seq Scan on menu_items when filtering by restaurant_id
-- for menu listing; this index makes per-restaurant menu lookups O(log n).
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id
  ON menu_items(restaurant_id);

-- Partial index on available items only — queries always filter is_available = true,
-- so indexing only those rows reduces index size and improves cache efficiency.
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available
  ON menu_items(restaurant_id) WHERE is_available = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- RESTAURANTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

-- EXPLAIN ANALYZE showed a Seq Scan on restaurants with filter is_open = true
-- on the restaurant list endpoint; this partial index covers only open restaurants.
CREATE INDEX IF NOT EXISTS idx_restaurants_open_rating
  ON restaurants(rating DESC) WHERE is_open = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

-- EXPLAIN ANALYZE showed a Seq Scan on users during login (WHERE email = $1);
-- a unique index on email speeds up auth and also enforces the uniqueness constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email);
