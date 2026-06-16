const { query } = require('../db')

// GET /api/orders/history
// ❌ CRITICAL N+1 BUG: 1 query for orders + 1 query per order for items = 1 + N queries
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    // Query 1: Fetch orders (no index on user_id → full table scan)
    const ordersResult = await query(
      `SELECT o.id, o.status, o.total, o.delivery_address, o.created_at,
              r.id as restaurant_id, r.name as restaurant_name, r.cuisine
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
      req
    )

    const orders = ordersResult.rows

    // ❌ N+1: For each order, fire a separate query to get its line items
    for (const order of orders) {
      const itemsResult = await query(
        `SELECT oi.quantity, oi.unit_price,
                mi.name as item_name, mi.category
         FROM order_items oi
         JOIN menu_items mi ON mi.id = oi.item_id
         WHERE oi.order_id = $1`,
        [order.id],
        req
      )
      order.items = itemsResult.rows
    }

    // Count total orders (another query, could be combined)
    const countResult = await query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [userId],
      req
    )
    const total = parseInt(countResult.rows[0].count)

    res.json({
      orders,
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
const createOrder = async (req, res) => {
  const client = await require('../db').pool.connect()
  try {
    const userId = req.user.userId
    const { restaurantId, items, deliveryAddress } = req.body

    if (!restaurantId || !items || !items.length) {
      return res.status(400).json({ error: 'restaurantId and items are required' })
    }

    await client.query('BEGIN')

    // Validate restaurant exists
    const restaurant = await client.query(
      'SELECT id, name FROM restaurants WHERE id = $1 AND is_open = true',
      [restaurantId]
    )
    if (restaurant.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Restaurant not found or closed' })
    }

    // Calculate total and validate each item
    let total = 0
    const validatedItems = []

    for (const item of items) {
      const menuItem = await client.query(
        'SELECT id, price, name FROM menu_items WHERE id = $1 AND restaurant_id = $2 AND is_available = true',
        [item.itemId, restaurantId]
      )
      if (menuItem.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Item ${item.itemId} not found or unavailable` })
      }
      const price = parseFloat(menuItem.rows[0].price)
      total += price * item.quantity
      validatedItems.push({ ...menuItem.rows[0], quantity: item.quantity, price })
    }

    // Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, restaurant_id, status, total, delivery_address)
       VALUES ($1, $2, 'confirmed', $3, $4) RETURNING id, status, total, created_at`,
      [userId, restaurantId, total.toFixed(2), deliveryAddress || 'Default address']
    )
    const order = orderResult.rows[0]

    // Insert order items
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.id, item.quantity, item.price]
      )
    }

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
