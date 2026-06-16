require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const restaurantRoutes = require('./routes/restaurants')
const orderRoutes = require('./routes/orders')

const app = express()

// ─── Core Middleware ────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Query Counter Middleware (Step 3 from assignment) ──────────────────────
// Counts DB queries per request. Logs if > 5 queries hit a single endpoint.
app.use((req, res, next) => {
  req._queryCount = 0
  res.on('finish', () => {
    if (req._queryCount > 5) {
      console.log(
        `[QUERY COUNT] ${req.method} ${req.path} → ${req._queryCount} queries`
      )
    }
  })
  next()
})

// ─── Request Logger ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`)
  })
  next()
})

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/orders', orderRoutes)

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 QuickBite API running on port ${PORT}`)
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Query logging: ${process.env.LOG_QUERIES === 'true' ? 'ON' : 'OFF'}`)
})

module.exports = app
