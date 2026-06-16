-- Migration 001: Create base schema for QuickBite
-- Run with: psql $DATABASE_URL -f migrations/001_create_schema.sql

-- Drop tables if they exist (for clean re-runs during dev)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  phone       VARCHAR(20),
  address     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurants table
CREATE TABLE restaurants (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  cuisine     VARCHAR(100),
  address     TEXT,
  rating      NUMERIC(2,1) DEFAULT 4.0,
  delivery_time INT DEFAULT 30,   -- minutes
  is_open     BOOLEAN DEFAULT TRUE,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items table
CREATE TABLE menu_items (
  id            SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  price         NUMERIC(8,2) NOT NULL,
  category      VARCHAR(80),
  is_available  BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id            SERIAL PRIMARY KEY,
  user_id       INT REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INT REFERENCES restaurants(id),
  status        VARCHAR(30) DEFAULT 'pending',   -- pending, confirmed, preparing, delivered, cancelled
  total         NUMERIC(10,2) NOT NULL,
  delivery_address TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Order items (line items per order)
CREATE TABLE order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INT REFERENCES orders(id) ON DELETE CASCADE,
  item_id     INT REFERENCES menu_items(id),
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  NUMERIC(8,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
