import { db } from './index';
import { migrate } from 'drizzle-orm/better-sqlite3/migrate';
import { seedDatabase } from './seed';

async function runMigrations() {
  try {
    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');

    console.log('Running database seeding...');
    await seedDatabase();
    console.log('Database seeding completed');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

runMigrations(); 