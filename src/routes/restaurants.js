const express = require('express')
const router = express.Router()
const {
  getRestaurants,
  getRestaurantById,
  getRestaurantMenu
} = require('../controllers/restaurantController.fixed')

// GET /api/restaurants
router.get('/', getRestaurants)

// GET /api/restaurants/:id
router.get('/:id', getRestaurantById)

// GET /api/restaurants/:id/menu
router.get('/:id/menu', getRestaurantMenu)

module.exports = router
