import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../../../shared/schema';

// Define the user schema interface extending the Document interface
export interface IUser extends Document {
  id: number;
  username: string;
  password: string;
  email: string;
  role: UserRole;
  agentId?: number | null;
  createdAt: Date;
  lastLogin: Date | null;
  failedLoginAttempts: number;
  isLocked: boolean;
  lockExpiresAt: Date | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
}

// Create the user schema
const userSchema = new Schema<IUser>({
  id: { type: Number, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    required: true,
    enum: Object.values(UserRole),
    default: UserRole.AGENT
  },
  agentId: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  lockExpiresAt: { type: Date, default: null },
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null }
}, {
  timestamps: true
});

// Create and export the User model
export const User = mongoose.model<IUser>('User', userSchema);
