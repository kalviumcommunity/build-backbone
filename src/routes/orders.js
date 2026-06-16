const express = require('express')
const router = express.Router()
const { getOrderHistory, createOrder, getOrderById } = require('../controllers/orderController.fixed')
const { authenticate } = require('../middleware/auth')

// All order routes require authentication
router.use(authenticate)

// GET /api/orders/history
router.get('/history', getOrderHistory)

// POST /api/orders
router.post('/', createOrder)

// GET /api/orders/:id
router.get('/:id', getOrderById)

module.exports = router
