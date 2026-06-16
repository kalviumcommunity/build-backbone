# QuickBite API

A Node.js + PostgreSQL backend for the QuickBite food delivery startup (Bangalore).

## The Problem

After a promo pushed signups from 20 → 800 users, the order history page took **8,200ms** to load and had a **12% error rate** under load.

**Root cause:** Classic N+1 query pattern on top of a database with zero indexes.

## What Was Fixed

| Problem | Fix | Result |
|---|---|---|
| N+1 on order history (22 queries/req) | `json_agg` JOIN query | 2 queries → 22ms P50 |
| N+1 on restaurant list (11 queries/req) | GROUP BY + COUNT JOIN | 1 query → 18ms P50 |
| N+1 on menu endpoint (7 queries/req) | LEFT JOIN + COUNT aggregate | 1 query → 12ms P50 |
| Zero indexes on all FK columns | 9 targeted indexes added | Seq Scan → Index Scan |

## Performance Results

| Endpoint | Before P95 | After P95 | Improvement |
|---|---|---|---|
| GET /api/orders/history | 3,200ms | 58ms | **55×** |
| GET /api/restaurants | 620ms | 45ms | **13.8×** |
| GET /api/restaurants/:id/menu | 340ms | 28ms | **12.1×** |
| POST /api/orders | 870ms | 92ms | **9.5×** |

Error rate: **12% → 0%**

## Setup

```bash
npm install
cp .env.example .env
# Fill in your PostgreSQL connection string in .env
npm run migrate
npm run seed
npm run dev
```

Login with: `seed@quickbite.com` / `password123`

## Key Files

- `PROFILING.md` — Full Artillery baseline, EXPLAIN ANALYZE before/after, query counts
- `src/controllers/orderController.fixed.js` — N+1 fix using `json_agg`
- `src/controllers/restaurantController.fixed.js` — N+1 fix using GROUP BY + COUNT
- `migrations/003_add_performance_indexes.sql` — 9 targeted indexes with justifications
- `artillery-baseline.yml` — Load test config (60s @ 10 arrivals/sec)
