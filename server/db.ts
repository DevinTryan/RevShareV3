import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Check for environment variable
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set.');
  throw new Error('DATABASE_URL environment variable is not set.');
}

// Create database client
const connection = postgres(process.env.DATABASE_URL);
export const db = drizzle(connection, { schema });

console.log('Database connection established successfully');