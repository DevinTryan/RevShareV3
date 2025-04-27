import mongoose, { Schema, Document } from 'mongoose';
import { LeadSource } from '../../../shared/schema';

// Define the transaction schema interface extending the Document interface
export interface ITransaction extends Document {
  id: number;
  agentId: number;
  propertyAddress: string;
  saleAmount: number;
  commissionPercentage: number;
  companyGCI: number;
  transactionDate: Date;
  createdAt: Date;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  transactionType?: string;
  transactionStatus?: string;
  escrowNumber?: string;
  closeDate?: Date;
  leadSource?: LeadSource;
  isCompanyProvided?: boolean;
  isSelfGenerated?: boolean;
  agentCommissionPercentage?: number;
  agentCommissionAmount?: number;
  referralPercentage?: number;
  referralAmount?: number;
  referralType?: string;
  referralAgentName?: string;
  companyDollarAmount?: number;
  convictionAmount?: number;
  officeGrossCommission?: number;
  transactionCoordinatorFee?: number;
  complianceFee?: number;
  depositPostedDate?: Date;
  commissionSplit?: string;
  commissionNotes?: string;
  additionalAgentId?: number;
  additionalAgentFee?: number;
  additionalAgentPercentage?: number;
  additionalAgentCost?: number;
  showingAgentFee?: number;
  showingAgent?: string;
  teamAgentsIncome?: number;
  personalIncome?: number;
  actualCheckAmount?: number;
  agentNameArchived?: string;
  isDisputed?: boolean;
  disputeReason?: string;
  disputeResolvedAt?: Date;
  disputeResolvedBy?: number;
  lastModifiedBy?: number;
  lastModifiedAt?: Date;
}

// Create the transaction schema
const transactionSchema = new Schema<ITransaction>({
  id: { type: Number, required: true, unique: true },
  agentId: { type: Number, required: true },
  propertyAddress: { type: String, required: true },
  saleAmount: { type: Number, required: true },
  commissionPercentage: { type: Number, required: true },
  companyGCI: { type: Number, required: true, default: 0 },
  transactionDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  clientName: { type: String },
  clientEmail: { type: String },
  clientPhone: { type: String },
  transactionType: { type: String, default: 'buyer' },
  transactionStatus: { type: String, default: 'pending' },
  escrowNumber: { type: String },
  closeDate: { type: Date },
  leadSource: { 
    type: String,
    enum: Object.values(LeadSource)
  },
  isCompanyProvided: { type: Boolean, default: false },
  isSelfGenerated: { type: Boolean, default: true },
  agentCommissionPercentage: { type: Number },
  agentCommissionAmount: { type: Number },
  referralPercentage: { type: Number, default: 0 },
  referralAmount: { type: Number, default: 0 },
  referralType: { type: String },
  referralAgentName: { type: String },
  companyDollarAmount: { type: Number, default: 0 },
  convictionAmount: { type: Number, default: 0 },
  officeGrossCommission: { type: Number, default: 0 },
  transactionCoordinatorFee: { type: Number, default: 0 },
  complianceFee: { type: Number, default: 0 },
  depositPostedDate: { type: Date },
  commissionSplit: { type: String },
  commissionNotes: { type: String },
  additionalAgentId: { type: Number },
  additionalAgentFee: { type: Number, default: 0 },
  additionalAgentPercentage: { type: Number, default: 0 },
  additionalAgentCost: { type: Number, default: 0 },
  showingAgentFee: { type: Number, default: 0 },
  showingAgent: { type: String },
  teamAgentsIncome: { type: Number, default: 0 },
  personalIncome: { type: Number, default: 0 },
  actualCheckAmount: { type: Number, default: 0 },
  agentNameArchived: { type: String },
  isDisputed: { type: Boolean, default: false },
  disputeReason: { type: String },
  disputeResolvedAt: { type: Date },
  disputeResolvedBy: { type: Number },
  lastModifiedBy: { type: Number },
  lastModifiedAt: { type: Date }
}, {
  timestamps: true
});

// Create and export the Transaction model
export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
