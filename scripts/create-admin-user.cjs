// Node.js script to insert an admin user directly into the Postgres database
const bcrypt = require('bcrypt');
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

(async () => {
  // Fallback to explicit DATABASE_URL if not loaded from .env
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/revenue_share_calculator';
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    const query = `
      INSERT INTO users (username, password, email, role, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (username) DO NOTHING
      RETURNING *;
    `;
    const values = ['admin', hashedPassword, 'admin@talkrealty.com', 'admin'];
    const res = await client.query(query, values);
    if (res.rows.length > 0) {
      console.log('Admin user created:', res.rows[0]);
    } else {
      console.log('Admin user already exists.');
    }
  } catch (err) {
    console.error('Error inserting admin user:', err);
  } finally {
    await client.end();
  }
})();
