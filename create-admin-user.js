import { storage } from './server/storage.js';
import { hashPassword } from './server/security.js';
import { UserRole } from './shared/schema.js';

// Create a test admin user
async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    // Check if user already exists
    const existingUser = await storage.getUserByUsername('admin');
    if (existingUser) {
      console.log('Admin user already exists');
      process.exit(0);
    }
    
    // Hash the password
    const hashedPassword = await hashPassword('Admin123!');
    
    // Create the user
    const user = await storage.createUser({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      createdAt: new Date(),
      lastLogin: null,
      failedLoginAttempts: 0,
      isLocked: false,
      lockExpiresAt: null,
      resetToken: null,
      resetTokenExpiry: null
    });
    
    console.log('Admin user created successfully:', user);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the function
createAdminUser();
