const { query } = require('../db')

// GET /api/restaurants
// ✅ FIXED: Single JOIN query with subquery for item count — no loop, 1 query total
const getRestaurants = async (req, res) => {
  try {
    // Single query using a correlated subquery to count menu items
    // Replaces: 1 query for restaurant list + N queries (one per restaurant) for count
    const result = await query(
      `SELECT
         r.id,
         r.name,
         r.cuisine,
         r.address,
         r.rating,
         r.delivery_time,
         r.is_open,
         COUNT(mi.id) FILTER (WHERE mi.is_available = true) AS menu_item_count
       FROM restaurants r
       LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
       WHERE r.is_open = true
       GROUP BY r.id
       ORDER BY r.rating DESC`,
      [],
      req
    )

    res.json({
      count: result.rows.length,
      restaurants: result.rows.map(r => ({
        ...r,
        menu_item_count: parseInt(r.menu_item_count)
      }))
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
// ✅ FIXED: Single JOIN using LEFT JOIN + COUNT — replaces loop of N queries
const getRestaurantMenu = async (req, res) => {
  try {
    const { id } = req.params

    // Single query: restaurant info + all menu items + popularity count via LEFT JOIN
    // Previously: 1 query for restaurant + 1 query for items + N queries for order counts
    const result = await query(
      `SELECT
         r.id AS restaurant_id,
         r.name AS restaurant_name,
         r.cuisine,
         mi.id,
         mi.name,
         mi.description,
         mi.price,
         mi.category,
         mi.is_available,
         COUNT(oi.id) AS times_ordered
       FROM restaurants r
       LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
       LEFT JOIN order_items oi ON oi.item_id = mi.id
       WHERE r.id = $1
       GROUP BY r.id, r.name, r.cuisine, mi.id, mi.name, mi.description, mi.price, mi.category, mi.is_available
       ORDER BY mi.category, mi.name`,
      [id],
      req
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    const firstRow = result.rows[0]
    const restaurant = {
      id: firstRow.restaurant_id,
      name: firstRow.restaurant_name,
      cuisine: firstRow.cuisine
    }

    const menu = result.rows
      .filter(row => row.id !== null)
      .map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        category: row.category,
        is_available: row.is_available,
        times_ordered: parseInt(row.times_ordered)
      }))

    res.json({ restaurant, menu })
  } catch (err) {
    console.error('Get menu error:', err)
    res.status(500).json({ error: 'Failed to fetch menu' })
  }
}

module.exports = { getRestaurants, getRestaurantById, getRestaurantMenu }
