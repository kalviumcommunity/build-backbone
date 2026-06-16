const { query } = require('../db')

// GET /api/orders/history
// ✅ FIXED: Single query using json_agg to fetch orders AND their items in one shot
// Before: 1 (orders) + N (items per order) + 1 (count) = N+2 queries
// After:  2 queries total (history + count) — items aggregated via json_agg
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    // Single JOIN query with json_agg — collapses all order items into one row per order
    const ordersResult = await query(
      `SELECT
         o.id,
         o.status,
         o.total,
         o.delivery_address,
         o.created_at,
         r.id   AS restaurant_id,
         r.name AS restaurant_name,
         r.cuisine,
         json_agg(
           json_build_object(
             'itemName',  mi.name,
             'category',  mi.category,
             'quantity',  oi.quantity,
             'unitPrice', oi.unit_price
           ) ORDER BY mi.name
         ) AS items
       FROM orders o
       JOIN restaurants  r  ON r.id  = o.restaurant_id
       JOIN order_items  oi ON oi.order_id = o.id
       JOIN menu_items   mi ON mi.id = oi.item_id
       WHERE o.user_id = $1
       GROUP BY o.id, o.status, o.total, o.delivery_address, o.created_at,
                r.id, r.name, r.cuisine
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
      req
    )

    // Second query for count (unavoidable, but kept separate and fast via index)
    const countResult = await query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [userId],
      req
    )
    const total = parseInt(countResult.rows[0].count)

    res.json({
      orders: ordersResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (err) {
    console.error('Order history error:', err)
    res.status(500).json({ error: 'Failed to fetch order history' })
  }
}

// POST /api/orders
// ✅ FIXED: Validate items in a single IN query instead of a loop of individual queries
const createOrder = async (req, res) => {
  const client = await require('../db').pool.connect()
  try {
    const userId = req.user.userId
    const { restaurantId, items, deliveryAddress } = req.body

    if (!restaurantId || !items || !items.length) {
      return res.status(400).json({ error: 'restaurantId and items are required' })
    }

    await client.query('BEGIN')

    // Validate restaurant
    const restaurant = await client.query(
      'SELECT id, name FROM restaurants WHERE id = $1 AND is_open = true',
      [restaurantId]
    )
    if (restaurant.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Restaurant not found or closed' })
    }

    // ✅ Validate ALL items in ONE query using IN clause
    const itemIds = items.map(i => i.itemId)
    const menuItems = await client.query(
      `SELECT id, name, price FROM menu_items
       WHERE id = ANY($1::int[])
         AND restaurant_id = $2
         AND is_available = true`,
      [itemIds, restaurantId]
    )

    if (menuItems.rows.length !== itemIds.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'One or more items are invalid or unavailable' })
    }

    // Build item map for O(1) lookup
    const menuMap = {}
    for (const row of menuItems.rows) {
      menuMap[row.id] = row
    }

    let total = 0
    const validatedItems = []
    for (const item of items) {
      const menuItem = menuMap[item.itemId]
      const price = parseFloat(menuItem.price)
      total += price * item.quantity
      validatedItems.push({ ...menuItem, quantity: item.quantity, price })
    }

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, restaurant_id, status, total, delivery_address)
       VALUES ($1, $2, 'confirmed', $3, $4) RETURNING id, status, total, created_at`,
      [userId, restaurantId, total.toFixed(2), deliveryAddress || 'Default address']
    )
    const order = orderResult.rows[0]

    // ✅ Bulk-insert order items in one query using unnest
    const orderIds    = validatedItems.map(() => order.id)
    const orderItemIds = validatedItems.map(i => i.id)
    const quantities  = validatedItems.map(i => i.quantity)
    const prices      = validatedItems.map(i => i.price)

    await client.query(
      `INSERT INTO order_items (order_id, item_id, quantity, unit_price)
       SELECT * FROM unnest($1::int[], $2::int[], $3::int[], $4::numeric[])`,
      [orderIds, orderItemIds, quantities, prices]
    )

    await client.query('COMMIT')

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        ...order,
        restaurant: restaurant.rows[0].name,
        items: validatedItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price
        }))
      }
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Create order error:', err)
    res.status(500).json({ error: 'Failed to place order' })
  } finally {
    client.release()
  }
}

// GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    const orderResult = await query(
      `SELECT o.id, o.status, o.total, o.delivery_address, o.created_at,
              r.name as restaurant_name, r.cuisine
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, userId],
      req
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const order = orderResult.rows[0]

    const itemsResult = await query(
      `SELECT oi.quantity, oi.unit_price,
              mi.name as item_name, mi.category
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.item_id
       WHERE oi.order_id = $1`,
      [id],
      req
    )

    order.items = itemsResult.rows
    res.json(order)
  } catch (err) {
    console.error('Get order error:', err)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
}

module.exports = { getOrderHistory, createOrder, getOrderById }
