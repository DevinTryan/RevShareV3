// This script must be run with tsx to support TypeScript imports
import { MongoDBStorage } from './server/storage-mongodb';
import { connectToMongoDB } from './server/db/mongodb';

// Unlock a user account
async function unlockUser(username) {
  try {
    console.log(`Attempting to unlock user: ${username}`);
    
    // Initialize MongoDB connection
    console.log('Initializing MongoDB connection...');
    await connectToMongoDB();
    
    // Create a new storage instance and wait for initialization
    console.log('Initializing MongoDB storage...');
    const storage = new MongoDBStorage();
    
    // Wait a bit for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the user
    const user = await storage.getUserByUsername(username);
    if (!user) {
      console.error(`User not found: ${username}`);
      process.exit(1);
    }
    
    console.log('Current user status:', {
      username: user.username,
      failedLoginAttempts: user.failedLoginAttempts,
      isLocked: user.isLocked,
      lockExpiresAt: user.lockExpiresAt
    });
    
    // Reset lock status
    const updatedUser = await storage.updateUser(user.id, {
      failedLoginAttempts: 0,
      isLocked: false,
      lockExpiresAt: null
    });
    
    console.log('User account unlocked successfully:', {
      username: updatedUser.username,
      failedLoginAttempts: updatedUser.failedLoginAttempts,
      isLocked: updatedUser.isLocked,
      lockExpiresAt: updatedUser.lockExpiresAt
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error unlocking user:', error);
    process.exit(1);
  }
}

// Get username from command line argument or use default
const username = process.argv[2] || 'admin5';
unlockUser(username);
