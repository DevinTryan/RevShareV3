import mongoose, { Schema, Document } from 'mongoose';

// Define the revenue share schema interface extending the Document interface
export interface IRevenueShare extends Document {
  id: number;
  transactionId: number;
  agentId: number;
  amount: number;
  tier: number;
  percentage: number;
  createdAt: Date;
  lastModifiedBy: number | null;
  lastModifiedAt: Date | null;
}

// Create the revenue share schema
const revenueShareSchema = new Schema<IRevenueShare>({
  id: { type: Number, required: true, unique: true },
  transactionId: { type: Number, required: true },
  agentId: { type: Number, required: true },
  amount: { type: Number, required: true },
  tier: { type: Number, required: true },
  percentage: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  lastModifiedBy: { type: Number, default: null },
  lastModifiedAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Create and export the RevenueShare model
export const RevenueShare = mongoose.model<IRevenueShare>('RevenueShare', revenueShareSchema);
