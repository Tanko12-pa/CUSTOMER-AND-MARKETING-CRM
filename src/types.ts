export type LifecycleStage = "Lead" | "MQL" | "SQL" | "Customer" | "Churned";
export type UserRole = "Enterprise Manager" | "Sales Rep" | "Marketer" | "Support Specialist";
export type CustomerTier = "Free" | "Premium" | "Enterprise";
export type SentimentType = "Positive" | "Neutral" | "Negative" | "At Risk";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type TicketStatus = "Open" | "In Progress" | "Resolved";
export type CampaignStatus = "Draft" | "Active" | "Completed";

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

export interface Customer {
  uid: string;
  name: string;
  email: string;
  lifecycleStage: LifecycleStage;
  tier: CustomerTier;
  leadScore: number;
  lifetimeValue: number;
  sentiment: SentimentType;
  lastInteractionDays: number;
  winProbability: number;
  assignedRep: string;
  dealRiskStatus: string;
  createdAt: string;
}

export interface Campaign {
  campaign_id: string;
  title: string;
  targetSegment: string;
  budget: number;
  status: CampaignStatus;
  clicks: number;
  conversations: number;
  revenueGenerated: number;
}

export interface SupportTicket {
  ticket_id: string;
  customer_id: string; // references Customer.uid
  customerName: string;
  issue: string;
  priority: TicketPriority;
  status: TicketStatus;
  sentiment: SentimentType;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  collection: string;
  user: string;
  status: "Success" | "Failed";
  details: string;
}

export interface AIResponse {
  text: string;
  suggestedAction?: any;
  insights?: any;
}
