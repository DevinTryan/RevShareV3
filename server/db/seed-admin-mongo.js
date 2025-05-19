import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get MongoDB URI from environment variable
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "revenueShareCalculator";

if (!uri) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function seedAdmin() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    // Delete any existing admin users
    await usersCollection.deleteMany({ role: 'admin' });
    console.log('Removed any existing admin users');

    // Check if Devin user exists
    const existingAdmin = await usersCollection.findOne({ username: 'Devin' });

    if (!existingAdmin) {
      // Hash the password
      const hashedPassword = await bcrypt.hash('Devin1234', 10);

      // Create the admin user with required fields
      await usersCollection.insertOne({
        id: 1, // Set a numeric ID
        username: 'Devin',
        email: 'devin@gmail.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        failedLoginAttempts: 0,
        isLocked: false,
        lockExpiresAt: null,
        resetToken: null,
        resetTokenExpiry: null
      });

      console.log('Admin user created successfully');
    } else {
      // Update existing Devin user to be admin
      const hashedPassword = await bcrypt.hash('Devin1234', 10);
      await usersCollection.updateOne(
        { username: 'Devin' },
        {
          $set: {
            id: 1, // Set a numeric ID
            email: 'devin@gmail.com',
            password: hashedPassword,
            role: 'admin',
            updatedAt: new Date(),
            failedLoginAttempts: 0,
            isLocked: false,
            lockExpiresAt: null,
            resetToken: null,
            resetTokenExpiry: null
          }
        }
      );
      console.log('Existing admin user updated');
    }

    await client.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin(); 