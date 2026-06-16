const { query } = require('../db')

// GET /api/restaurants
// BUG: N+1 - fetches each restaurant's item count in a separate loop query
const getRestaurants = async (req, res) => {
  try {
    // Query 1: Get all restaurants
    const restaurants = await query(
      `SELECT id, name, cuisine, address, rating, delivery_time, is_open
       FROM restaurants
       WHERE is_open = true
       ORDER BY rating DESC`,
      [],
      req
    )

    // ❌ N+1 BUG: For each restaurant, fire a separate query to count menu items
    for (const restaurant of restaurants.rows) {
      const countResult = await query(
        'SELECT COUNT(*) FROM menu_items WHERE restaurant_id = $1 AND is_available = true',
        [restaurant.id],
        req
      )
      restaurant.menu_item_count = parseInt(countResult.rows[0].count)
    }

    res.json({
      count: restaurants.rows.length,
      restaurants: restaurants.rows
    })
  } catch (err) {
    console.error('Get restaurants error:', err)
    res.status(500).json({ error: 'Failed to fetch restaurants' })
  }
}

// GET /api/restaurants/:id
const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params
    const result = await query(
      `SELECT id, name, cuisine, address, rating, delivery_time, is_open
       FROM restaurants WHERE id = $1`,
      [id],
      req
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('Get restaurant by id error:', err)
    res.status(500).json({ error: 'Failed to fetch restaurant' })
  }
}

// GET /api/restaurants/:id/menu
// BUG: N+1 - fetches items then for each item fetches category metadata separately
const getRestaurantMenu = async (req, res) => {
  try {
    const { id } = req.params

    // Verify restaurant exists
    const restaurant = await query(
      'SELECT id, name FROM restaurants WHERE id = $1',
      [id],
      req
    )
    if (restaurant.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    // Query 2: Get all menu items for restaurant
    const items = await query(
      `SELECT id, name, description, price, category, is_available
       FROM menu_items
       WHERE restaurant_id = $1
       ORDER BY category, name`,
      [id],
      req
    )

    // ❌ N+1 BUG: for each menu item, fetch its order count from order_items
    for (const item of items.rows) {
      const popularityResult = await query(
        `SELECT COUNT(*) as order_count
         FROM order_items
         WHERE item_id = $1`,
        [item.id],
        req
      )
      item.times_ordered = parseInt(popularityResult.rows[0].order_count)
    }

    res.json({
      restaurant: restaurant.rows[0],
      menu: items.rows
    })
  } catch (err) {
    console.error('Get menu error:', err)
    res.status(500).json({ error: 'Failed to fetch menu' })
  }
}

module.exports = { getRestaurants, getRestaurantById, getRestaurantMenu }
