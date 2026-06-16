const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../db')

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' })
    }

    // Check if email already exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email],
      req
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await query(
      `INSERT INTO users (name, email, password, phone, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email`,
      [name, email, hashedPassword, phone || null, address || null],
      req
    )

    const user = result.rows[0]
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({ user, token })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
}

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email],
      req
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
}

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, phone, address, created_at FROM users WHERE id = $1',
      [req.user.userId],
      req
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('Me error:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
}

module.exports = { register, login, me }
