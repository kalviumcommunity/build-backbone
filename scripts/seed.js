require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function runSeed() {
  const seedFile = path.join(__dirname, '..', 'migrations', '002_seed_data.sql')
  const sql = fs.readFileSync(seedFile, 'utf8')

  console.log('🌱 Seeding database...')
  try {
    await pool.query(sql)
    console.log('✅ Database seeded successfully')
    console.log('   Login with: seed@quickbite.com / password123')
  } catch (err) {
    console.error('❌ Seeding failed:', err.message)
    process.exit(1)
  }

  await pool.end()
}

runSeed().catch(console.error)
