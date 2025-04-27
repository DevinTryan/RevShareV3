import mongoose from 'mongoose';
import { log } from '../vite';

// Use the MongoDB connection string from environment variable or the provided connection string
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://devin:rwSiigf8Kb09BkvG@cluster0.c3xfsbp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "revenueShareCalculator";

// Connect to MongoDB
export async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME
    });
    log('Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    log('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Get the MongoDB connection
export function getMongoDBConnection() {
  return mongoose.connection;
}

// Close the MongoDB connection
export async function closeMongoDBConnection() {
  try {
    await mongoose.connection.close();
    log('MongoDB connection closed');
  } catch (error) {
    log('Error closing MongoDB connection:', error);
    throw error;
  }
}
