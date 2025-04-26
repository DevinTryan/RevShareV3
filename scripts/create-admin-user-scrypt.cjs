// Node.js script to insert an admin user using scrypt hashing (matches backend logic)
const { Client } = require('pg');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/revenue_share_calculator';
  const password = 'password123';
  const hashedPassword = await hashPassword(password);

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    const query = `
      INSERT INTO users (username, password, email, role, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password
      RETURNING *;
    `;
    const values = ['admin', hashedPassword, 'admin@talkrealty.com', 'admin'];
    const res = await client.query(query, values);
    if (res.rows.length > 0) {
      console.log('Admin user created or updated:', res.rows[0]);
    } else {
      console.log('Admin user already exists.');
    }
  } catch (err) {
    console.error('Error inserting admin user:', err);
  } finally {
    await client.end();
  }
})();
