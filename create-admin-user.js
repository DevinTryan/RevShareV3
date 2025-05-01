// This script must be run with tsx to support TypeScript imports
import { MongoDBStorage } from './server/storage-mongodb';
import { hashPassword } from './server/security';
import { UserRole } from './shared/schema';
import { connectToMongoDB } from './server/db/mongodb';

// Create a test admin user
async function createAdminUser() {
  try {
    console.log('Initializing MongoDB connection...');
    await connectToMongoDB();
    
    // Create a new storage instance and wait for initialization
    console.log('Initializing MongoDB storage...');
    const storage = new MongoDBStorage();
    
    // Wait a bit for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Creating admin user...');
    
    // Check if user already exists
    const existingUser = await storage.getUserByUsername('admin');
    if (existingUser) {
      console.log('Admin user already exists:', existingUser);
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
