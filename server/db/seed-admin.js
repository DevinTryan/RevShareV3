import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seedAdmin() {
  try {
    const db = new Database('database.sqlite');
    
    // Create users table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'agent',
        agent_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if admin exists
    const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('Devin');
    
    if (!existingAdmin) {
      // Hash the password
      const hashedPassword = await bcrypt.hash('Devin1234', 10);
      
      // Insert admin user
      const stmt = db.prepare(`
        INSERT INTO users (username, email, password, role)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run('Devin', 'devin@gmail.com', hashedPassword, 'admin');
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
    
    db.close();
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin(); 