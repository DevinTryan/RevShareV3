import mongoose, { Schema, Document } from 'mongoose';
import { AgentType, CapType, AgentStatus } from '../../../shared/schema';

// Define the agent schema interface extending the Document interface
export interface IAgent extends Document {
  id: number;
  name: string;
  agentCode: string | null;
  agentType: AgentType;
  capType: CapType | null;
  currentCap: number;
  anniversaryDate: Date;
  gciSinceAnniversary: number;
  sponsorId: number | null;
  createdAt: Date;
  currentTier: number;
  totalSalesYTD: number;
  totalGCIYTD: number;
  careerSalesCount: number;
  status: AgentStatus;
  statusChangeDate: Date | null;
  statusChangeReason: string | null;
  lastModifiedBy: number | null;
  lastModifiedAt: Date | null;
}

// Create the agent schema
const agentSchema = new Schema<IAgent>({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  agentCode: { type: String, unique: true, sparse: true },
  agentType: { 
    type: String, 
    required: true,
    enum: Object.values(AgentType)
  },
  capType: { 
    type: String, 
    enum: Object.values(CapType),
    default: null
  },
  currentCap: { type: Number, default: 0 },
  anniversaryDate: { type: Date, required: true },
  gciSinceAnniversary: { type: Number, default: 0 },
  sponsorId: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  currentTier: { type: Number, default: 1 },
  totalSalesYTD: { type: Number, default: 0 },
  totalGCIYTD: { type: Number, default: 0 },
  careerSalesCount: { type: Number, default: 0 },
  status: { 
    type: String, 
    required: true,
    enum: Object.values(AgentStatus),
    default: AgentStatus.ACTIVE
  },
  statusChangeDate: { type: Date, default: null },
  statusChangeReason: { type: String, default: null },
  lastModifiedBy: { type: Number, default: null },
  lastModifiedAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Create and export the Agent model
export const Agent = mongoose.model<IAgent>('Agent', agentSchema);
