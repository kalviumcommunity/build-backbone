-- Migration 002: Seed data for QuickBite
-- Realistic Bangalore food delivery data

-- Seed users (password = "password123" bcrypt hash)
INSERT INTO users (name, email, password, phone, address) VALUES
  ('Seed User',      'seed@quickbite.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9876543210', 'Koramangala, Bangalore'),
  ('Rahul Sharma',   'rahul@example.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9812345678', 'Indiranagar, Bangalore'),
  ('Priya Nair',     'priya@example.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9988776655', 'HSR Layout, Bangalore'),
  ('Kiran Rao',      'kiran@example.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9123456789', 'Whitefield, Bangalore'),
  ('Aisha Khan',     'aisha@example.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9234567890', 'JP Nagar, Bangalore'),
  ('Vikram Singh',   'vikram@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9345678901', 'Marathahalli, Bangalore'),
  ('Deepa Menon',    'deepa@example.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9456789012', 'BTM Layout, Bangalore'),
  ('Arjun Reddy',    'arjun@example.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9567890123', 'Electronic City, Bangalore'),
  ('Meera Pillai',   'meera@example.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9678901234', 'Bellandur, Bangalore'),
  ('Suresh Kumar',   'suresh@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lbe2', '9789012345', 'Yelahanka, Bangalore');

-- Seed restaurants (Bangalore-style)
INSERT INTO restaurants (name, cuisine, address, rating, delivery_time, is_open) VALUES
  ('Meghana Foods',         'Andhra',        'Residency Road, Bangalore',      4.5, 25, true),
  ('Empire Restaurant',     'North Indian',  'Church Street, Bangalore',       4.2, 30, true),
  ('CTR Shivajinagar',      'South Indian',  'Shivajinagar, Bangalore',        4.7, 20, true),
  ('Truffles Koramangala',  'Continental',   'Koramangala 5th Block',          4.4, 35, true),
  ('Udupi Brahmin',         'Udupi',         'Malleshwaram, Bangalore',         4.3, 20, true),
  ('Biryani Zone',          'Biryani',       'HSR Layout, Bangalore',          4.1, 40, true),
  ('Smoke House Deli',      'Continental',   'Indiranagar, Bangalore',         4.0, 35, true),
  ('The Punjabi Dhaba',     'Punjabi',       'Jayanagar, Bangalore',           3.9, 30, true),
  ('Onesta Pizza',          'Italian',       'Koramangala, Bangalore',         4.6, 25, true),
  ('Koshy''s',              'Multi-Cuisine', 'St. Marks Road, Bangalore',      4.5, 30, true);

-- Seed menu items for restaurant 1 (Meghana Foods)
INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
  (1, 'Chicken Biryani',      'Hyderabadi dum biryani with raita',        220, 'Biryani'),
  (1, 'Mutton Biryani',       'Slow cooked mutton dum biryani',           280, 'Biryani'),
  (1, 'Boneless Chicken',     'Andhra style spicy boneless chicken',      180, 'Starters'),
  (1, 'Prawn Masala',         'Fresh prawns in tangy masala',             320, 'Mains'),
  (1, 'Paneer Biryani',       'Fragrant paneer dum biryani',              200, 'Biryani');

-- Seed menu items for restaurant 2 (Empire)
INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
  (2, 'Butter Chicken',       'Creamy tomato-based chicken curry',        250, 'Mains'),
  (2, 'Mutton Rogan Josh',    'Kashmiri slow-cooked mutton',              300, 'Mains'),
  (2, 'Dal Makhani',          'Black lentils cooked overnight',           160, 'Mains'),
  (2, 'Garlic Naan',          'Butter garlic naan from tandoor',           50, 'Breads'),
  (2, 'Paneer Tikka',         'Marinated paneer grilled in tandoor',      200, 'Starters');

-- Seed menu items for restaurant 3 (CTR)
INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
  (3, 'Masala Dosa',          'Crispy dosa with potato masala',            80, 'Breakfast'),
  (3, 'Rava Idli',            'Soft rava idli with coconut chutney',       70, 'Breakfast'),
  (3, 'Filter Coffee',        'Traditional Bangalore filter coffee',        40, 'Beverages'),
  (3, 'Vada',                 'Crispy medu vada with sambar',              60, 'Breakfast'),
  (3, 'Pongal',               'Rice and lentil porridge with ghee',        90, 'Breakfast');

-- Seed menu items for restaurant 4 (Truffles)
INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
  (4, 'Classic Burger',       'Juicy beef patty with cheese',             220, 'Burgers'),
  (4, 'Pasta Arrabiata',      'Penne in spicy tomato sauce',              200, 'Pasta'),
  (4, 'Truffle Fries',        'Crispy fries with truffle oil',            180, 'Sides'),
  (4, 'Chicken Caesar',       'Classic caesar salad with chicken',        240, 'Salads'),
  (4, 'Chocolate Brownie',    'Warm brownie with vanilla ice cream',      160, 'Desserts');

-- Seed menu items for restaurants 5-10
INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
  (5, 'Thali',                'South Indian vegetarian thali',            150, 'Mains'),
  (5, 'Sambar Rice',          'Rice with homestyle sambar',                80, 'Mains'),
  (6, 'Chicken Biryani',      'Hyderabadi style biryani',                 180, 'Biryani'),
  (6, 'Paneer Biryani',       'Vegetarian dum biryani',                   160, 'Biryani'),
  (7, 'Club Sandwich',        'Triple decker club sandwich',              280, 'Sandwiches'),
  (7, 'Grilled Chicken',      'Herb marinated grilled chicken',           350, 'Mains'),
  (8, 'Rajma Chawal',         'Red kidney beans with basmati rice',       140, 'Mains'),
  (8, 'Lassi',                'Sweet mango lassi',                         60, 'Beverages'),
  (9, 'Margherita Pizza',     'Classic tomato and mozzarella',            280, 'Pizza'),
  (9, 'BBQ Chicken Pizza',    'Smoky BBQ chicken on crispy base',         320, 'Pizza'),
  (10,'English Breakfast',    'Eggs, toast, baked beans, sausage',        280, 'Breakfast'),
  (10,'Irish Stew',           'Traditional lamb stew',                    350, 'Mains');

-- Seed orders: ~80 orders across 10 users to simulate load
-- User 1 (seed@quickbite.com) has 20 orders so history N+1 is obvious
DO $$
DECLARE
  user_id INT;
  restaurant_id INT;
  order_id INT;
  item_id INT;
  order_total NUMERIC;
BEGIN
  FOR i IN 1..80 LOOP
    user_id := ((i - 1) % 10) + 1;
    restaurant_id := ((i - 1) % 10) + 1;

    INSERT INTO orders (user_id, restaurant_id, status, total, delivery_address, created_at)
    VALUES (
      user_id,
      restaurant_id,
      CASE (i % 4)
        WHEN 0 THEN 'delivered'
        WHEN 1 THEN 'delivered'
        WHEN 2 THEN 'preparing'
        ELSE 'pending'
      END,
      0,  -- will update after inserting items
      'Test Address, Bangalore',
      NOW() - (i || ' hours')::INTERVAL
    )
    RETURNING id INTO order_id;

    -- Insert 2-4 items per order
    FOR j IN 1..(2 + (i % 3)) LOOP
      -- pick a menu item from the right restaurant
      SELECT id, price INTO item_id, order_total
      FROM menu_items
      WHERE restaurant_id = ((order_id - 1) % 10) + 1
      ORDER BY id
      LIMIT 1 OFFSET (j - 1);

      IF item_id IS NOT NULL THEN
        INSERT INTO order_items (order_id, item_id, quantity, unit_price)
        VALUES (order_id, item_id, j % 3 + 1, order_total);
      END IF;
    END LOOP;

    -- Update order total
    UPDATE orders
    SET total = (
      SELECT COALESCE(SUM(quantity * unit_price), 0)
      FROM order_items WHERE order_id = orders.id
    )
    WHERE id = order_id;
  END LOOP;
END $$;
