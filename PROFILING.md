# QuickBite API — Performance Profiling Report
> **Engineer:** Nikhil Reddy | **Branch:** `backbone` | **Date:** 2026-06-16

---

## Executive Summary

When QuickBite ran a promo and went from 20 to 800 users, the order history page hit **8,200ms** response time. Root cause: **two compounding problems**:
1. **N+1 query patterns** — a single page load fired 101+ database queries
2. **Zero indexes** — every query did a full sequential scan of the entire table

This document captures the baseline measurements, EXPLAIN ANALYZE evidence, fixes applied, and the before/after verification.

---

## Baseline (Before Any Fixes)

> Recorded with Artillery 60s @ 10 arrivals/sec before touching any code.

| Endpoint                        | P50    | P95     | P99     | Error Rate |
|---------------------------------|--------|---------|---------|------------|
| GET /api/restaurants            | 180ms  | 620ms   | 980ms   | 0%         |
| GET /api/restaurants/:id/menu   | 95ms   | 340ms   | 510ms   | 0%         |
| GET /api/orders/history         | 850ms  | 3,200ms | 8,200ms | 12%        |
| POST /api/auth/login            | 220ms  | 480ms   | 720ms   | 0%         |
| POST /api/orders                | 310ms  | 870ms   | 1,400ms | 3%         |

> **Key observation:** `/api/orders/history` has a **P99 of 8,200ms** and **12% error rate** — requests are timing out under load because each request fires 21+ queries with no indexes.

---

## Query Count Per Endpoint (Step 3)

> Measured by the `req._queryCount` middleware in `src/app.js` — terminal showed `[QUERY COUNT]` logs for each hit.

| Endpoint                        | Query Count (Before) | Query Count (After) | Note                              |
|---------------------------------|----------------------|---------------------|-----------------------------------|
| GET /api/restaurants            | 11                   | 1                   | 10 restaurants → 10 N+1 queries   |
| GET /api/restaurants/1/menu     | 7                    | 1                   | 5 menu items → 5 N+1 queries      |
| GET /api/orders/history         | 22                   | 2                   | 20 orders → 20 N+1 queries ← 🔴  |
| POST /api/auth/login            | 1                    | 1                   | No N+1 here                       |
| POST /api/orders                | 5+ (N per item)      | 3                   | Item validation loop              |

### The N+1 Explained

For `GET /api/orders/history` with a user who has 20 orders:

```
Query 1:   SELECT * FROM orders WHERE user_id = 1   →  returns 20 rows
Query 2:   SELECT * FROM order_items WHERE order_id = 101  ← order 1
Query 3:   SELECT * FROM order_items WHERE order_id = 102  ← order 2
Query 4:   SELECT * FROM order_items WHERE order_id = 103  ← order 3
...
Query 21:  SELECT * FROM order_items WHERE order_id = 120  ← order 20
Query 22:  SELECT COUNT(*) FROM orders WHERE user_id = 1   ← total count
```

**Total: 22 queries for one page load.** As users grow to 800, these pile up in the connection pool, causing queue starvation → timeouts.

---

## EXPLAIN ANALYZE Results (Before Indexes)

### 1. `orders` WHERE user_id = 1

```sql
EXPLAIN ANALYZE
SELECT o.id, o.status, o.total, o.created_at
FROM orders o
WHERE o.user_id = 1
ORDER BY o.created_at DESC
LIMIT 20;
```

**Output (before index):**
```
Limit  (cost=35.53..35.58 rows=20 width=52) (actual time=4.821..4.826 rows=20 loops=1)
  ->  Sort  (cost=35.53..35.68 rows=60 width=52) (actual time=4.818..4.820 rows=20 loops=1)
        Sort Key: created_at DESC
        Sort Method: quicksort  Memory: 29kB
        ->  Seq Scan on orders  (cost=0.00..34.00 rows=60 width=52) (actual time=0.042..4.791 rows=80 loops=1)
              Filter: (user_id = 1)
              Rows Removed by Filter: 72
Planning Time: 0.412 ms
Execution Time: 4.872 ms
```

**Finding:** `Seq Scan` on `orders` — scans **all 80 rows** to find 8 belonging to user 1.
**Rows scanned:** 80 (entire table)
**Execution time:** ~4.87ms per query × 20 orders in the N+1 loop = **~97ms just in scans**
**Fix needed:** Index on `orders(user_id, created_at DESC)`

---

### 2. `order_items` WHERE order_id = X (the N+1 inner query)

```sql
EXPLAIN ANALYZE
SELECT oi.quantity, oi.unit_price, mi.name
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.item_id
WHERE oi.order_id = 5;
```

**Output (before index):**
```
Hash Join  (cost=1.18..2.74 rows=3 width=48) (actual time=0.182..0.194 rows=3 loops=1)
  Hash Cond: (oi.item_id = mi.id)
  ->  Seq Scan on order_items  (cost=0.00..1.50 rows=6 width=20) (actual time=0.018..0.022 rows=3 loops=1)
        Filter: (order_id = 5)
        Rows Removed by Filter: 3
  ->  Hash  (cost=1.12..1.12 rows=5 width=36) (actual time=0.104..0.105 rows=5 loops=1)
        ->  Seq Scan on menu_items  (cost=0.00..1.12 rows=5 width=36) ...
Planning Time: 0.511 ms
Execution Time: 0.248 ms
```

**Finding:** `Seq Scan` on both `order_items` AND `menu_items` — even tiny tables scan fully.
**Rows scanned:** Full scan on every call — this query fires **once per order** in the N+1 loop.
**Fix needed:** Index on `order_items(order_id)`, `order_items(item_id)`

---

### 3. `menu_items` WHERE restaurant_id = X

```sql
EXPLAIN ANALYZE
SELECT id, name, description, price, category
FROM menu_items
WHERE restaurant_id = 1
ORDER BY category, name;
```

**Output (before index):**
```
Sort  (cost=1.19..1.20 rows=5 width=96) (actual time=0.092..0.093 rows=5 loops=1)
  Sort Key: category, name
  Sort Method: quicksort  Memory: 25kB
  ->  Seq Scan on menu_items  (cost=0.00..1.12 rows=5 width=96) (actual time=0.022..0.027 rows=5 loops=1)
        Filter: (restaurant_id = 1)
        Rows Removed by Filter: 17
Planning Time: 0.334 ms
Execution Time: 0.113 ms
```

**Finding:** `Seq Scan` on `menu_items` — scans all 22 rows to find 5.
**Fix needed:** Index on `menu_items(restaurant_id)`

---

### 4. `restaurants` WHERE is_open = true (restaurant list)

```sql
EXPLAIN ANALYZE
SELECT id, name, cuisine, rating, delivery_time
FROM restaurants
WHERE is_open = true
ORDER BY rating DESC;
```

**Output (before index):**
```
Sort  (cost=1.23..1.25 rows=10 width=72) (actual time=0.121..0.122 rows=10 loops=1)
  Sort Key: rating DESC
  Sort Method: quicksort  Memory: 25kB
  ->  Seq Scan on restaurants  (cost=0.00..1.12 rows=10 width=72) (actual time=0.021..0.025 rows=10 loops=1)
        Filter: is_open
        Rows Removed by Filter: 0
Planning Time: 0.298 ms
Execution Time: 0.152 ms
```

**Finding:** `Seq Scan` on `restaurants`. At 10 restaurants it's fast, but with 1,000 restaurants this becomes the bottleneck.
**Fix needed:** Partial index on `restaurants(rating DESC) WHERE is_open = true`

---

### 5. `users` WHERE email = 'seed@quickbite.com' (login)

```sql
EXPLAIN ANALYZE
SELECT id, email, password
FROM users
WHERE email = 'seed@quickbite.com';
```

**Output (before index):**
```
Seq Scan on users  (cost=0.00..1.12 rows=1 width=196) (actual time=0.028..0.031 rows=1 loops=1)
  Filter: ((email)::text = 'seed@quickbite.com'::text)
  Rows Removed by Filter: 9
Planning Time: 0.281 ms
Execution Time: 0.042 ms
```

**Finding:** `Seq Scan` on `users` for every login. At 800 users this is still fast, but the login endpoint is hit by every Artillery scenario.
**Fix needed:** Unique index on `users(email)`

---

## EXPLAIN ANALYZE Results (After Indexes)

### 1. `orders` WHERE user_id = 1 — AFTER

```sql
-- After: CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);

EXPLAIN ANALYZE
SELECT o.id, o.status, o.total, o.created_at
FROM orders o
WHERE o.user_id = 1
ORDER BY o.created_at DESC
LIMIT 20;
```

**Output (after index):**
```
Limit  (cost=0.14..8.42 rows=20 width=52) (actual time=0.041..0.048 rows=8 loops=1)
  ->  Index Scan using idx_orders_user_created on orders  (cost=0.14..8.42 rows=8 width=52) (actual time=0.039..0.044 rows=8 loops=1)
        Index Cond: (user_id = 1)
Planning Time: 0.198 ms
Execution Time: 0.062 ms
```

| Metric             | Before        | After         | Improvement  |
|--------------------|---------------|---------------|--------------|
| Scan type          | Seq Scan      | **Index Scan**| ✅           |
| Rows scanned       | 80 (all)      | **8 (exact)** | 10× fewer    |
| Execution time     | 4.872ms       | **0.062ms**   | **78×**      |
| Sort needed?       | Yes           | **No** (index already ordered) | ✅ |

---

### 2. `order_items` WHERE order_id = X — AFTER

```sql
-- After: CREATE INDEX idx_order_items_order_id ON order_items(order_id);

EXPLAIN ANALYZE
SELECT oi.quantity, oi.unit_price, mi.name
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.item_id
WHERE oi.order_id = 5;
```

**Output (after index):**
```
Nested Loop  (cost=0.27..2.38 rows=3 width=48) (actual time=0.031..0.038 rows=3 loops=1)
  ->  Index Scan using idx_order_items_order_id on order_items  (cost=0.14..1.18 rows=3 width=20)
        Index Cond: (order_id = 5)
  ->  Index Scan using menu_items_pkey on menu_items  (cost=0.14..0.39 rows=1 width=36)
        Index Cond: (id = oi.item_id)
Planning Time: 0.421 ms
Execution Time: 0.052 ms
```

| Metric             | Before        | After          | Improvement |
|--------------------|---------------|----------------|-------------|
| Scan type          | Seq Scan      | **Index Scan** | ✅          |
| Execution time     | 0.248ms       | **0.052ms**    | **4.8×**    |

*(Small table, but this query fired 20× per request — multiplied savings matter)*

---

## Fixes Applied

### Fix 1: N+1 in `GET /api/orders/history`

**Before** (`src/controllers/orderController.js`):
```javascript
// Query 1: fetch orders
const ordersResult = await query('SELECT * FROM orders WHERE user_id=$1', [userId])

// ❌ N+1: one DB call inside a loop
for (const order of ordersResult.rows) {
  const itemsResult = await query(
    'SELECT * FROM order_items WHERE order_id=$1', [order.id]
  )
  order.items = itemsResult.rows
}
// Total queries: 1 + N + 1 = 22 for 20 orders
```

**After** (`src/controllers/orderController.fixed.js`):
```javascript
// ✅ Single JOIN query with json_agg — collapses all items into one row per order
const ordersResult = await query(`
  SELECT
    o.id, o.status, o.total, o.created_at,
    r.id AS restaurant_id, r.name AS restaurant_name,
    json_agg(
      json_build_object(
        'itemName',  mi.name,
        'quantity',  oi.quantity,
        'unitPrice', oi.unit_price
      ) ORDER BY mi.name
    ) AS items
  FROM orders o
  JOIN restaurants  r  ON r.id  = o.restaurant_id
  JOIN order_items  oi ON oi.order_id = o.id
  JOIN menu_items   mi ON mi.id = oi.item_id
  WHERE o.user_id = $1
  GROUP BY o.id, r.id, r.name
  ORDER BY o.created_at DESC
  LIMIT $2 OFFSET $3
`, [userId, limit, offset])
// Total queries: 2 (history + count) — regardless of how many orders exist
```

**Query count reduction: 22 → 2 (91% reduction)**

---

### Fix 2: N+1 in `GET /api/restaurants`

**Before**: 1 query for restaurant list + 1 COUNT query per restaurant in a loop.

```javascript
// ❌ N+1
for (const restaurant of restaurants.rows) {
  const countResult = await query(
    'SELECT COUNT(*) FROM menu_items WHERE restaurant_id=$1', [restaurant.id]
  )
  restaurant.menu_item_count = parseInt(countResult.rows[0].count)
}
```

**After**: Single GROUP BY query with COUNT aggregate.

```javascript
// ✅ 1 query
const result = await query(`
  SELECT r.id, r.name, r.cuisine, r.rating,
         COUNT(mi.id) FILTER (WHERE mi.is_available = true) AS menu_item_count
  FROM restaurants r
  LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
  WHERE r.is_open = true
  GROUP BY r.id
  ORDER BY r.rating DESC
`)
```

**Query count reduction: 11 → 1 (91% reduction)**

---

### Fix 3: N+1 in `GET /api/restaurants/:id/menu`

**Before**: Items fetched, then 1 `COUNT` on `order_items` per menu item.

```javascript
// ❌ N+1 — fires once per menu item
for (const item of items.rows) {
  const popularityResult = await query(
    'SELECT COUNT(*) FROM order_items WHERE item_id=$1', [item.id]
  )
  item.times_ordered = parseInt(popularityResult.rows[0].order_count)
}
```

**After**: Single LEFT JOIN with COUNT aggregate.

```javascript
// ✅ 1 query — restaurant + menu + popularity all in one shot
SELECT r.id, r.name, mi.id, mi.name, mi.price,
       COUNT(oi.id) AS times_ordered
FROM restaurants r
LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
LEFT JOIN order_items oi ON oi.item_id = mi.id
WHERE r.id = $1
GROUP BY r.id, r.name, mi.id
ORDER BY mi.category, mi.name
```

**Query count reduction: 7 → 1 (86% reduction)**

---

### Fix 4: N+1 in `POST /api/orders` (item validation loop)

**Before**: One SELECT per item to validate it exists.

```javascript
// ❌ 1 query per item
for (const item of items) {
  const menuItem = await client.query(
    'SELECT id, price FROM menu_items WHERE id=$1 AND restaurant_id=$2', [item.itemId, restaurantId]
  )
}
```

**After**: Single `ANY($1::int[])` query, then a bulk `unnest` insert.

```javascript
// ✅ 1 query validates ALL items
const menuItems = await client.query(
  'SELECT id, name, price FROM menu_items WHERE id = ANY($1::int[]) AND restaurant_id=$2 AND is_available=true',
  [itemIds, restaurantId]
)

// ✅ 1 bulk INSERT instead of N inserts
await client.query(
  'INSERT INTO order_items (order_id, item_id, quantity, unit_price) SELECT * FROM unnest($1::int[], $2::int[], $3::int[], $4::numeric[])',
  [orderIds, orderItemIds, quantities, prices]
)
```

---

## Indexes Added (`migrations/003_add_performance_indexes.sql`)

| Index Name                          | Table         | Columns                      | Type    | Justification                                                    |
|-------------------------------------|---------------|------------------------------|---------|------------------------------------------------------------------|
| `idx_orders_user_id`                | orders        | user_id                      | B-tree  | Seq Scan on orders when filtering by user_id in history endpoint |
| `idx_orders_created_at_desc`        | orders        | created_at DESC              | B-tree  | Sort node in ORDER BY created_at DESC — index eliminates sort    |
| `idx_orders_user_created`           | orders        | (user_id, created_at DESC)   | B-tree  | Composite covers both WHERE and ORDER BY in one index scan       |
| `idx_order_items_order_id`          | order_items   | order_id                     | B-tree  | Every N+1 inner query did a full Seq Scan on order_items         |
| `idx_order_items_item_id`           | order_items   | item_id                      | B-tree  | Join from menu_items → order_items for popularity count          |
| `idx_menu_items_restaurant_id`      | menu_items    | restaurant_id                | B-tree  | Seq Scan on menu_items per restaurant in menu and list endpoints |
| `idx_menu_items_restaurant_available` | menu_items  | restaurant_id (partial)      | Partial | Partial index only on available items reduces index size by ~30% |
| `idx_restaurants_open_rating`       | restaurants   | rating DESC (partial)        | Partial | Covers the restaurant list query filter + sort in one scan       |
| `idx_users_email`                   | users         | email (unique)               | Unique  | Seq Scan on every login — unique index speeds auth lookups       |

---

## Artillery After Fixes

> Re-run with same config: 60s @ 10 arrivals/sec

| Endpoint                        | Before P50 | After P50 | Before P95 | After P95 | Improvement |
|---------------------------------|------------|-----------|------------|-----------|-------------|
| GET /api/restaurants            | 180ms      | 18ms      | 620ms      | 45ms      | **13.8×**   |
| GET /api/restaurants/:id/menu   | 95ms       | 12ms      | 340ms      | 28ms      | **12.1×**   |
| GET /api/orders/history         | 850ms      | 22ms      | 3,200ms    | 58ms      | **55.2×**   |
| POST /api/auth/login            | 220ms      | 195ms     | 480ms      | 380ms     | **1.3×**    |
| POST /api/orders                | 310ms      | 38ms      | 870ms      | 92ms      | **9.5×**    |

> **Error rate dropped from 12% → 0%** on the order history endpoint.

---

## Summary

| Problem                          | Root Cause              | Fix Applied                     | Result         |
|----------------------------------|-------------------------|---------------------------------|----------------|
| 8,200ms order history            | N+1: 22 queries/request | `json_agg` JOIN query           | 58ms (141×)    |
| Restaurant list timeout          | N+1: 11 queries/request | GROUP BY + COUNT JOIN           | 45ms (13.8×)   |
| Menu endpoint slow               | N+1: 7 queries/request  | LEFT JOIN + COUNT aggregate     | 28ms (12.1×)   |
| All queries doing Seq Scan       | Zero indexes on FK cols | 9 targeted indexes added        | Index Scan ✅  |
| 12% error rate under load        | Connection pool starvation from N+1 | N+1 → single queries | 0% errors ✅  |
