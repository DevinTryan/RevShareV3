import { db } from './index';
import { users } from './schema';
import { hashPassword } from '../auth';
import { UserRole } from '@shared/schema';

export async function seedDatabase() {
  try {
    // Check if admin user already exists
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, 'Devin')
    });

    if (!existingAdmin) {
      // Create the admin user
      const hashedPassword = await hashPassword('Devin1234');
      await db.insert(users).values({
        username: 'Devin',
        email: 'devin@gmail.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
      });
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
} 