require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('seed') && !f.includes('003'))
    .sort()

  console.log('🔄 Running migrations...')

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filePath, 'utf8')
    console.log(`  ▶ ${file}`)
    try {
      await pool.query(sql)
      console.log(`  ✅ ${file} completed`)
    } catch (err) {
      console.error(`  ❌ ${file} failed:`, err.message)
      process.exit(1)
    }
  }

  console.log('✅ All migrations complete')
  await pool.end()
}

runMigrations().catch(console.error)
