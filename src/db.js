const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err)
})

// Wrapped query that optionally counts queries per request
const query = (text, params, req) => {
  if (req && process.env.LOG_QUERIES === 'true') {
    req._queryCount = (req._queryCount || 0) + 1
  }
  return pool.query(text, params)
}

module.exports = { pool, query }
