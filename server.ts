import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import Stripe from "stripe";

dotenv.config();

const app = express();

// Conditional body parsing: raw body for Stripe webhooks, json for everything else
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Use your specific Stripe Price IDs from your dashboard
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || ' ',
  yearly: process.env.STRIPE_PRICE_YEARLY || ' '
};

const PORT = 3000;

// Lazy initialization of Stripe to prevent startup crashes if key is missing
let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe | null {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      stripeClient = new Stripe(key);
    }
  }
  return stripeClient;
}

// Lazy initialization of Gemini to prevent startup crashes if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. AI-powered features will utilize smart local heuristic fallbacks.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// In-Memory Database representing CRM Cloud Firestore collections
let mockCustomers = [
  {
    uid: "cust_1",
    name: "Almaric Vance",
    email: "almaric@vanceaerospace.com",
    lifecycleStage: "Customer" as const,
    tier: "Enterprise" as const,
    leadScore: 92,
    lifetimeValue: 125000,
    sentiment: "Positive" as const,
    lastInteractionDays: 3,
    winProbability: 95,
    assignedRep: "Danielle Gold",
    dealRiskStatus: "Low Risk",
    createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
  },
  {
    uid: "cust_2",
    name: "Genevieve Thorne",
    email: "g.thorne@auroralabs.org",
    lifecycleStage: "SQL" as const,
    tier: "Premium" as const,
    leadScore: 78,
    lifetimeValue: 45000,
    sentiment: "Neutral" as const,
    lastInteractionDays: 16, // > 14 days inactivity anomaly
    winProbability: 70,
    assignedRep: "Danielle Gold",
    dealRiskStatus: "Medium Risk: Inactivity Warning",
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
  },
  {
    uid: "cust_3",
    name: "Julian Sterling",
    email: "julian@sterlingventures.cap",
    lifecycleStage: "Lead" as const,
    tier: "Free" as const,
    leadScore: 45,
    lifetimeValue: 0,
    sentiment: "Negative" as const, // "At Risk" because negative
    lastInteractionDays: 22,
    winProbability: 30,
    assignedRep: "Marcus Aurelius",
    dealRiskStatus: "High Risk: Churn Inbound",
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    uid: "cust_4",
    name: "Elena Rostova",
    email: "e.rostova@rostova-logistics.ru",
    lifecycleStage: "Customer" as const,
    tier: "Enterprise" as const,
    leadScore: 88,
    lifetimeValue: 89000,
    sentiment: "Negative" as const,
    lastInteractionDays: 8,
    winProbability: 75,
    assignedRep: "Danielle Gold",
    dealRiskStatus: "At Risk: Negative CSAT",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  },
  {
    uid: "cust_5",
    name: "Takeshi Kovacs",
    email: "t.kovacs@harlansec.world",
    lifecycleStage: "MQL" as const,
    tier: "Free" as const,
    leadScore: 64,
    lifetimeValue: 12000,
    sentiment: "Positive" as const,
    lastInteractionDays: 1,
    winProbability: 85,
    assignedRep: "Marcus Aurelius",
    dealRiskStatus: "Low Risk",
    createdAt: new Date().toISOString(),
  }
];

let mockCampaigns = [
  {
    campaign_id: "camp_1",
    title: "Project Golden Wave Re-activation",
    targetSegment: "Inactive 30 Days",
    budget: 8500,
    status: "Active" as const,
    clicks: 1420,
    conversations: 310,
    revenueGenerated: 62000,
  },
  {
    campaign_id: "camp_2",
    title: "Enterprise Upgrade Masterclass",
    targetSegment: "High-Value Tier",
    budget: 15000,
    status: "Active" as const,
    clicks: 2800,
    conversations: 520,
    revenueGenerated: 185000,
  },
  {
    campaign_id: "camp_3",
    title: "New Signups Onboarding Sweep",
    targetSegment: "New Signups",
    budget: 3000,
    status: "Draft" as const,
    clicks: 0,
    conversations: 0,
    revenueGenerated: 0,
  }
];

let mockSupportTickets = [
  {
    ticket_id: "tick_1",
    customer_id: "cust_4",
    customerName: "Elena Rostova",
    issue: "Experiencing API rate delays with CRM Webhooks. Delay spikes up to 4.2 seconds under enterprise workloads, causing message dropping.",
    priority: "High" as const,
    status: "Open" as const,
    sentiment: "Negative" as const,
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    ticket_id: "tick_2",
    customer_id: "cust_3",
    customerName: "Julian Sterling",
    issue: "Wishes to cancel subscription. Expressed frustration over dashboard load times and lacks localized analytics filters.",
    priority: "Urgent" as const,
    status: "In Progress" as const,
    sentiment: "Negative" as const,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  }
];

let mockAuditLogs = [
  {
    id: "log_1",
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    action: "READ_RECORD",
    collection: "customers",
    user: "akindewum@gmail.com",
    status: "Success" as "Success" | "Failed",
    details: "Retrieved customer database for user session index sync.",
  },
  {
    id: "log_2",
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    action: "REVENUE_INSIGHTS_RUN",
    collection: "revenue_intelligence",
    user: "akindewum@gmail.com",
    status: "Success" as "Success" | "Failed",
    details: "Automatically modeled deal risk parameters for Almaric Vance using math matrix thresholds.",
  }
];

// Helper to record audit logs
function addAudit(action: string, collection: string, details: string, user: string = "akindewum@gmail.com", statusStr: "Success" | "Failed" = "Success") {
  mockAuditLogs.unshift({
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    action,
    collection,
    user,
    status: statusStr,
    details
  });
}

interface CRMUser {
  email: string;
  name: string;
  trialStartDate: string; // ISO date string
  plan: "trial" | "monthly" | "yearly" | "none";
  subscriptionActive: boolean;
  subscriptionStartDate?: string;
}

// Global set of simulated database users
let mockUsersList: CRMUser[] = [
  {
    email: "akindewum@gmail.com",
    name: "Akindewum",
    trialStartDate: new Date().toISOString(),
    plan: "trial",
    subscriptionActive: true
  }
];

// Active user session
let currentUserSession: CRMUser | null = null;

// User verification helper for 7-day free trial limit
function checkUserAccess(user: CRMUser): { active: boolean; reason: string; trialDaysLeft: number } {
  if (user.plan === "monthly" || user.plan === "yearly") {
    return { active: user.subscriptionActive, reason: "Active paid user subscription", trialDaysLeft: 0 };
  }
  
  if (user.plan === "trial") {
    const trialStart = new Date(user.trialStartDate).getTime();
    const now = Date.now();
    const elapsedMs = now - trialStart;
    const elapsedDays = elapsedMs / (1000 * 3600 * 24);
    const timeLeft = Math.max(0, 7 - elapsedDays);
    
    if (elapsedDays >= 7) {
      return { active: false, reason: "7-Day Free Trial period has expired", trialDaysLeft: 0 };
    }
    
    return { active: true, reason: `Trial period has ${timeLeft.toFixed(1)} days left`, trialDaysLeft: timeLeft };
  }
  
  return { active: false, reason: "No active plan found", trialDaysLeft: 0 };
}

// API endpoint to retrieve current session details
app.get("/api/auth/session", (req, res) => {
  if (!currentUserSession) {
    return res.json({ loggedIn: false, user: null });
  }
  const diagnostic = checkUserAccess(currentUserSession);
  res.json({
    loggedIn: true,
    user: {
      ...currentUserSession,
      active: diagnostic.active,
      reason: diagnostic.reason,
      trialDaysLeft: diagnostic.trialDaysLeft
    }
  });
});

// Create/Register brand new user with 7-Day Free Trial (Completely disconnected from Stripe)
app.post("/api/auth/register-trial", (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    let existingUser = mockUsersList.find(u => u.email.toLowerCase() === cleanEmail);

    if (existingUser) {
      // Sign in already existing user
      currentUserSession = existingUser;
    } else {
      // Register completely new user
      const newUser: CRMUser = {
        name: name.trim(),
        email: cleanEmail,
        trialStartDate: new Date().toISOString(),
        plan: "trial",
        subscriptionActive: true
      };
      mockUsersList.push(newUser);
      currentUserSession = newUser;
    }

    const diagnostic = checkUserAccess(currentUserSession);
    addAudit("USER_REGISTERED_TRIAL", "users", `User registered & signed in with 100% free 7-day trial: ${email}`);

    res.json({
      success: true,
      user: {
        ...currentUserSession,
        active: diagnostic.active,
        reason: diagnostic.reason,
        trialDaysLeft: diagnostic.trialDaysLeft
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quick login endpoint
app.post("/api/auth/login", (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = mockUsersList.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({ success: false, error: "No user account registered under this email. Please click 'Start 7-Day Free Trial' first!" });
    }

    currentUserSession = user;
    const diagnostic = checkUserAccess(user);
    addAudit("USER_LOGGED_IN", "users", `User signed in: ${email}`);

    res.json({
      success: true,
      user: {
        ...user,
        active: diagnostic.active,
        reason: diagnostic.reason,
        trialDaysLeft: diagnostic.trialDaysLeft
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  currentUserSession = null;
  res.json({ success: true });
});

// Dynamic subscription activation (Stripe completion or direct bypass callback)
app.post("/api/auth/confirm-subscription", (req, res) => {
  try {
    const { email, plan } = req.body;
    if (!email || !plan) {
      return res.status(400).json({ success: false, error: "Email and plan type required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex !== -1) {
      mockUsersList[userIndex].plan = plan;
      mockUsersList[userIndex].subscriptionActive = true;
      mockUsersList[userIndex].subscriptionStartDate = new Date().toISOString();
      
      if (currentUserSession?.email.toLowerCase() === cleanEmail) {
        currentUserSession = mockUsersList[userIndex];
      }
      
      const diagnostic = checkUserAccess(mockUsersList[userIndex]);
      addAudit("SUBSCRIPTION_ACTIVATED", "users", `User successfully activated ${plan} tier: ${cleanEmail}`);

      res.json({
        success: true,
        user: {
          ...mockUsersList[userIndex],
          active: diagnostic.active,
          reason: diagnostic.reason,
          trialDaysLeft: diagnostic.trialDaysLeft
        }
      });
    } else {
      res.status(404).json({ success: false, error: "User profile not found in current sandbox memory." });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to simulate the passage of time for trial expiration testing purposes
app.post("/api/auth/simulate-expiration", (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : (currentUserSession ? currentUserSession.email.toLowerCase() : "");
    const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex !== -1) {
      // Shift registered time 8 days back to make it expired
      mockUsersList[userIndex].plan = "trial";
      mockUsersList[userIndex].trialStartDate = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
      mockUsersList[userIndex].subscriptionActive = false;
      
      if (currentUserSession?.email.toLowerCase() === cleanEmail) {
        currentUserSession = mockUsersList[userIndex];
      }
      
      const diagnostic = checkUserAccess(mockUsersList[userIndex]);
      addAudit("SIMULATED_TRIAL_EXPIRATION", "users", `DevConsole: Fast-forwarded timezone clocks to force trial expiration for ${cleanEmail}`);

      res.json({
        success: true,
        user: {
          ...mockUsersList[userIndex],
          active: diagnostic.active,
          reason: diagnostic.reason,
          trialDaysLeft: diagnostic.trialDaysLeft
        }
      });
    } else {
      res.status(404).json({ success: false, error: "No active user matches search query." });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restore free trial date to now
app.post("/api/auth/simulate-restore-trial", (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : (currentUserSession ? currentUserSession.email.toLowerCase() : "");
    const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex !== -1) {
      mockUsersList[userIndex].plan = "trial";
      mockUsersList[userIndex].trialStartDate = new Date().toISOString();
      mockUsersList[userIndex].subscriptionActive = true;
      
      if (currentUserSession?.email.toLowerCase() === cleanEmail) {
        currentUserSession = mockUsersList[userIndex];
      }

      const diagnostic = checkUserAccess(mockUsersList[userIndex]);
      addAudit("SIMULATED_TRIAL_RESTORE", "users", `DevConsole: Restored trial period clocks to now for ${cleanEmail}`);

      res.json({
        success: true,
        user: {
          ...mockUsersList[userIndex],
          active: diagnostic.active,
          reason: diagnostic.reason,
          trialDaysLeft: diagnostic.trialDaysLeft
        }
      });
    } else {
      res.status(404).json({ success: false, error: "No active user matches search query." });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create standard Stripe checkout session OR redirect to mockup completion callbacks
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { plan, email } = req.body;
    if (!plan || !email) {
      return res.status(400).json({ error: "Missing plan or user email address context." });
    }

    const stripe = getStripeClient();
    const cleanEmail = email.trim().toLowerCase();

    if (stripe) {
      // Real Stripe session deployment
      const priceAmount = plan === "monthly" ? 1999 : 19999;
      const planName = plan === "monthly" ? "Monthly Subscription" : "Yearly Subscription";
      const intervalType = plan === "monthly" ? "month" : "year";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: cleanEmail,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `CRM Pro ${planName}`,
                description: `Unlimited SOC-2 standard database dashboarding on CRM suite.`
              },
              unit_amount: priceAmount,
              recurring: {
                interval: intervalType
              }
            },
            quantity: 1
          }
        ],
        mode: "subscription",
        success_url: `${req.headers.origin}/?stripe_success=true&plan=${plan}&email=${encodeURIComponent(cleanEmail)}`,
        cancel_url: `${req.headers.origin}/?stripe_cancel=true`,
      });

      res.json({ success: true, url: session.url });
    } else {
      // Elegant, immersive localized fallback. No Secret code is found, trigger standard beautiful simulated Stripe screen
      const url = `/?simulated_stripe=true&plan=${plan}&email=${encodeURIComponent(cleanEmail)}`;
      res.json({ success: true, url });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// REST Api to retrieve current state
app.get("/api/state", (req, res) => {
  res.json({
    customers: mockCustomers,
    campaigns: mockCampaigns,
    supportTickets: mockSupportTickets,
    auditLogs: mockAuditLogs,
  });
});

// REST Api to update user metadata or state
app.post("/api/update-state", (req, res) => {
  try {
    const { type, payload } = req.body;
    
    if (type === "ADD_CUSTOMER") {
      const newCust = {
        uid: `cust_${Date.now()}`,
        name: payload.name || "Unnamed Client",
        email: payload.email || "unknown@company.com",
        lifecycleStage: payload.lifecycleStage || "Lead",
        tier: payload.tier || "Free",
        leadScore: Number(payload.leadScore) || 50,
        lifetimeValue: Number(payload.lifetimeValue) || 0,
        sentiment: payload.sentiment || "Neutral",
        lastInteractionDays: Number(payload.lastInteractionDays) || 0,
        winProbability: Number(payload.winProbability) || 50,
        assignedRep: payload.assignedRep || "Danielle Gold",
        dealRiskStatus: payload.lastInteractionDays > 14 ? "High Risk: Inactive" : "Low Risk",
        createdAt: new Date().toISOString()
      };
      
      // Enforce the rule: negative sentiment implies "At Risk"
      if (newCust.sentiment === "Negative") {
        newCust.dealRiskStatus = "At Risk: Negative Sentiment";
      }

      mockCustomers.push(newCust);
      addAudit("CREATE_RECORD", "customers", `Added customer ${newCust.name} (${newCust.email})`);
    } else if (type === "UPDATE_CUSTOMER") {
      const idx = mockCustomers.findIndex(c => c.uid === payload.uid);
      if (idx !== -1) {
        mockCustomers[idx] = {
          ...mockCustomers[idx],
          ...payload,
        };
        // Re-enforce sentiment checks
        if (mockCustomers[idx].sentiment === "Negative") {
          mockCustomers[idx].dealRiskStatus = "At Risk: Negative Sentiment";
        }
        addAudit("UPDATE_RECORD", "customers", `Updated customer ${mockCustomers[idx].name}`);
      }
    } else if (type === "DELETE_CUSTOMERS") {
      const uidsToDelete = payload.uids || [];
      const originalCount = mockCustomers.length;
      mockCustomers = mockCustomers.filter(c => !uidsToDelete.includes(c.uid));
      const deletedCount = originalCount - mockCustomers.length;
      addAudit("DELETE_RECORDS", "customers", `Bulk deleted ${deletedCount} customer profile(s) via database admin console.`);
    } else if (type === "ADD_TICKET") {
      const customer = mockCustomers.find(c => c.uid === payload.customer_id);
      const newTicket = {
        ticket_id: `tick_${Date.now()}`,
        customer_id: payload.customer_id,
        customerName: customer ? customer.name : "Unknown",
        issue: payload.issue,
        priority: payload.priority || "Medium",
        status: payload.status || "Open",
        sentiment: payload.sentiment || "Neutral",
        createdAt: new Date().toISOString()
      };
      mockSupportTickets.push(newTicket);
      
      // If negative ticket sentiment, auto mark customer sentiment as at risk
      if (customer && newTicket.sentiment === "Negative") {
        customer.sentiment = "Negative" as const;
        customer.dealRiskStatus = "At Risk: Active Negative Support Ticket";
      }
      
      addAudit("CREATE_RECORD", "support_tickets", `Added support ticket for ${newTicket.customerName}`);
    } else if (type === "LAUNCH_CAMPAIGN") {
      const idx = mockCampaigns.findIndex(camp => camp.campaign_id === payload.campaign_id);
      if (idx !== -1) {
        mockCampaigns[idx].status = "Active";
        mockCampaigns[idx].clicks += 150;
        mockCampaigns[idx].conversations += 20;
        mockCampaigns[idx].revenueGenerated += 5000;
        addAudit("LAUNCH_CAMPAIGN", "marketing_campaigns", `Enrolled segment and launched campaign "${mockCampaigns[idx].title}"`);
      }
    } else if (type === "ADD_CAMPAIGN") {
      const newCamp = {
        campaign_id: `camp_${Date.now()}`,
        title: payload.title,
        targetSegment: payload.targetSegment || "New Signups",
        budget: Number(payload.budget) || 1000,
        status: "Draft" as const,
        clicks: 0,
        conversations: 0,
        revenueGenerated: 0
      };
      mockCampaigns.push(newCamp);
      addAudit("CREATE_RECORD", "marketing_campaigns", `Created marketing campaign draft "${newCamp.title}"`);
    } else if (type === "ESCALATE_DEAL") {
      const idx = mockCustomers.findIndex(c => c.uid === payload.uid);
      if (idx !== -1) {
        mockCustomers[idx].dealRiskStatus = "Escalated";
        addAudit("DEAL_ESCALATED", "customers", `Manager escalation initiated: ${mockCustomers[idx].name}. Risk marked Escalated. Subject line draft generated.`);
      }
    }

    res.json({ success: true, customers: mockCustomers, campaigns: mockCampaigns, supportTickets: mockSupportTickets, auditLogs: mockAuditLogs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run Revenue Intelligence Model (Win Probabilities & Deal Risk Matrix calculation)
app.post("/api/revenue-intelligence", (req, res) => {
  try {
    const { uid, dealValue, lastInteractionDays } = req.body;
    
    // Inactivity modeling threshold calculations
    let winProbability = 85;
    let dealRiskStatus = "Low Risk";

    if (lastInteractionDays > 14) {
      winProbability -= 30;
      dealRiskStatus = "High Risk: Inactivity Anomaly";
    }
    if (dealValue > 50000 && lastInteractionDays > 7) {
      winProbability -= 15;
      dealRiskStatus = "Medium Risk: High Value Attention Required";
    }

    winProbability = Math.max(0, winProbability);

    // Patch the DB
    const idx = mockCustomers.findIndex(c => c.uid === uid);
    if (idx !== -1) {
      mockCustomers[idx].winProbability = winProbability;
      mockCustomers[idx].dealRiskStatus = dealRiskStatus;
      mockCustomers[idx].lifetimeValue = dealValue;
      mockCustomers[idx].lastInteractionDays = lastInteractionDays;
      addAudit("REVENUE_INSIGHTS_RUN", "revenue_intelligence", `Model calculated win rate ${winProbability}% for ${mockCustomers[idx].name}`);
    }

    res.json({
      status: "Success",
      winProbability,
      dealRiskStatus,
      customers: mockCustomers,
      auditLogs: mockAuditLogs
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Primary Server-Side Gemini endpoint
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { prompt, mode, customerContext, useSearch } = req.body;
    const ai = getGeminiClient();

    let systemInstruction = "You are the Executive Revenue Intelligence Engine for a Next-Gen CRM. Optimize responses with elegant, structured, high-contrast, data-dense layout tables inside your output.";
    
    if (mode === "sales") {
      systemInstruction = `You are an AI Sales Agent for CUSTOMER AND MARKETING CRM. 
You focus on lead scoring, follow-up recommendations, upsell pitches, contract values, and deal risk metrics.
We have current client context: ${JSON.stringify(customerContext || {})}.
Produce an amazing structured pitch/analytics response with actionable steps.`;
    } else if (mode === "marketing") {
      systemInstruction = `You are an AI Marketing Agent. 
You are an expert of ad copies, email campaigns, re-engagement workflows, target segments, and multi-touch attribution. 
Provide creative, targeted campaigns, segmentation tips, or copy draft sequences.`;
    } else if (mode === "support") {
      systemInstruction = `You are an AI Customer Support Agent with high EQ and deep compliance rules.
Analyze customer complaints carefully. Note sentiment.
Provide a customer ticket response with resolution notes and detailed instructions.`;
    } else if (mode === "analytics") {
      systemInstruction = `You are an AI Revenue Analytics Specialist. 
Analyze numbers, project LTV, compute risk models, detect pipeline anomalies, and present your findings in beautiful markdown layout format.`;
    }

    // Prepare config, optional search grounding
    const config: any = {
      systemInstruction,
      temperature: 0.3
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    let response;
    
    if (process.env.GEMINI_API_KEY) {
      // Real API generation
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config
      });
    } else {
      // Intelligent mock fallback answering logically to preserve user UX
      let mockText = "";
      if (mode === "sales") {
        mockText = `### Sales Intelligence Insights (Local Mode)
**Target**: ${customerContext?.name || "Target Prospect"}
**Identified Stage**: ${customerContext?.lifecycleStage || "Qualified Lead"}

1. **AI Lead Qualification Score**: **88/100** — High-tier intent shown.
2. **Deal Upgrade Recommendation**: 
   - Propose custom package up-scaling based on current active contract size.
   - Recommended Follow-up: "Send customized migration proposal detailing specialized localized analytics matrices."
   
*Note: Configured with low-latency executive fallback.*`;
      } else if (mode === "marketing") {
        mockText = `### AI Marketing Campaign Copy Draft
**Subject: Turn Data into Growth (Exclusive offer inside 🎁)**

Hey! We noticed you've been optimizing workflows but haven't tapped into the core Firebase database integration. Here is a custom, automated campaign preview tailored to your segment:

- **Key Value Proposition**: Real-time Firestore synchronizations without update gaps.
- **Conversion CTA**: Click "Launch Campaign" to re-enroll inactive nodes immediately.

*Targeting Segment: Inactive 30 Days*`;
      } else if (mode === "support") {
        mockText = `### AI Autonomous Technical Support Case Reply
**Status**: Case Routed to Specialist Queue | Sentiment Score: **Negatively Charged**

*Dear ${customerContext?.name || "Valued Client"},*

We apologize sincerely for the webhook API rate latency issue you experienced. Our Enterprise team was alerted instantly (TriggerEvent: Deal At Risk Flagged). 

**Immediate Fixes Underway**:
- Adjusting socket buffers on route queues.
- Isolating non-critical audit reports into background workers.

*Let us know if you have further concerns.*`;
      } else {
        mockText = `### Executive Action Intelligence
Our analytics predict a **18.5% win-probability lift** by actively initiating personalized, audio-summarized touchpoints across the Enterprise segment. 
Configure the **Earthy Luxe Comfort controls** via the buttons panel to trigger dynamic automations.`;
      }

      response = { text: mockText };
    }

    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Suggest Fix endpoint supporting mitigation generated by Gemini Copilot
app.post("/api/gemini/suggest-fix", async (req, res) => {
  try {
    const { customer } = req.body;
    if (!customer) {
      return res.status(400).json({ error: "Missing customer context for generating mitigation plan." });
    }

    const ai = getGeminiClient();

    const prompt = `You are a legendary Customer Success & Deal Recovery Specialist Copilot.
Analyze this high-risk customer data from our CRM:
- Name: ${customer.name}
- Email: ${customer.email}
- Lifecycle Stage: ${customer.lifecycleStage}
- Tier: ${customer.tier}
- Lead Score: ${customer.leadScore}/100
- Projected Lifetime Value (LTV): $${customer.lifetimeValue}
- Win Probability: ${customer.winProbability || 0}%
- Last Interaction Days Elapsed: ${customer.lastInteractionDays} days
- Account Owner: ${customer.assignedRep}
- Current Risk Status: ${customer.dealRiskStatus}

Generate an extremely actionable, specific 3-bullet point mitigation plan to address this risk. 
Make each bullet point start with a strong action verb and provide a highly personalized suggestion based on their specific metrics (e.g. if they have long inactivity, address email outreach; if low lead score, address feature trials; etc.). Keeping it brief and professional with markdown.`;

    let planText = "";
    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
          systemInstruction: "You are the Executive Revenue Intelligence Engine for a Next-Gen CRM. Give a bulleted recovery mitigation plan."
        }
      });
      planText = response.text || "";
    } else {
      // Local premium mock recovery plan based on specific customer metrics
      const actionBullets = [];
      if (customer.lastInteractionDays > 14) {
        actionBullets.push(`- **Re-engage Immediately**: Account Owner **${customer.assignedRep}** must dispatch a personalized touchpoint email to **${customer.email}** targeting their ${customer.tier} features, as they have been dormant for ${customer.lastInteractionDays} days.`);
      } else {
        actionBullets.push(`- **Schedule Strategy Call**: Contact **${customer.name}** within 24 hours to review general satisfaction and address negative indicators or rate constraints.`);
      }
      
      if (customer.winProbability < 50) {
        actionBullets.push(`- **Propose Custom Trial Extension**: Offer a 15-day premium sandbox license or structural rate-limit upgrade to restore win confidence from its current low of ${customer.winProbability}%.`);
      } else {
        actionBullets.push(`- **Qualify Upsell Path**: Leverage their stable ${customer.leadScore}/100 lead score to initiate structured upgrade negotiations to Enterprise/Premium.`);
      }

      actionBullets.push(`- **Enforce SLA Alignment**: Initiate internal case verification regarding their status "${customer.dealRiskStatus}" with support engineering to resolve webhooks delay.`);

      planText = `### AI Copilot Mitigation Plan for **${customer.name}**\n\n${actionBullets.join("\n")}\n\n*Generated by Gemini Copilot in local fallback mode.*`;
    }

    res.json({ text: planText });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Transcription / Multilingual Audio translation engine simulator
app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { language, sourceName, mockAudioPrompt } = req.body;
    const ai = getGeminiClient();

    const translationPrompt = `You are a high-thought multilingual transcribing assistant. 
Transcribe and translate this sound recording file simulated text safely. The source speaker matches: ${sourceName}.
Source speaking is: "${mockAudioPrompt}" in ${language}.
Analyze the transcription, separate key participants, sentiment, and provide a crisp translation to English, plus CRM recommendations.`;

    let responseText = "";

    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: translationPrompt,
        config: {
          temperature: 0.1
        }
      });
      responseText = response.text || "";
    } else {
      // Local premium mock responder
      responseText = `### 🎙️ Audio Transcription & Multilingual Summary

**Speaker**: ${sourceName}
**Language Detected**: ${language}
**Verbatim Transcript**: "${mockAudioPrompt}"

**English Translation**:
"Hey, the translation software looks amazing. I need help resolving our database setup and custom Firebase security rules. Can you verify if our Premium Tier lists GDPR privacy controls?"

**CRM Diagnostic Insights**:
- **Sentiment**: Neutral/Positive Contentment
- **Action Item**: Enforce compliance status upgrade and trigger the automated recheck workflow.`;
    }

    // Auto add audit log for transcription
    addAudit("AUDIO_TRANSCRIPTION", "customers", `Transcribed voice recording for ${sourceName} in ${language}.`);

    res.json({ text: responseText, logs: mockAuditLogs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Securely check email sending logs
app.post("/api/gmail/send", (req, res) => {
  const { recipient, subject, body, language } = req.body;
  addAudit("GMAIL_SENT", "customers", `Sent automated ${language} email titled "${subject}" to ${recipient}`);
  res.json({ success: true, logs: mockAuditLogs });
});

// --- 1. STRIPE CHECKOUT SESSION CREATION ---
app.post('/api/checkout/create-session', async (req, res) => {
  const { plan, userId } = req.body; // 'monthly' or 'yearly'

  if (!plan || !userId) {
    return res.status(400).json({ error: "Missing plan or userId parameters." });
  }

  const stripe = getStripeClient();
  const cleanEmail = userId.trim().toLowerCase();

  // If Stripe key is missing, fall back to simulated checkout session flow gracefully
  if (!stripe) {
    const url = `/?simulated_stripe=true&plan=${plan}&email=${encodeURIComponent(cleanEmail)}`;
    return res.json({ url });
  }

  try {
    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId && priceId.trim() !== "" ? priceId : undefined,
          price_data: (!priceId || priceId.trim() === "") ? {
            currency: 'usd',
            product_data: {
              name: `CRM Pro ${plan === "monthly" ? "Monthly" : "Yearly"} Subscription`,
              description: 'Access premium enterprise sales tracking and AI agents'
            },
            unit_amount: plan === 'monthly' ? 1999 : 19999,
            recurring: {
              interval: plan === 'monthly' ? 'month' : 'year'
            }
          } : undefined,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin || process.env.FRONTEND_URL || "http://localhost:3000"}/?stripe_success=true&plan=${plan}&email=${encodeURIComponent(cleanEmail)}`,
      cancel_url: `${req.headers.origin || process.env.FRONTEND_URL || "http://localhost:3000"}/?stripe_cancel=true`,
      client_reference_id: cleanEmail,
      customer_email: cleanEmail,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 2. STRIPE WEBHOOK TO HANDLE PAYMENTS ---
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripe = getStripeClient();

  if (!stripe) {
    return res.status(400).send("Webhook Error: Stripe client is not configured.");
  }

  let event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    }
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful subscriptions
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const userId = session.client_reference_id || session.customer_email;
    const stripeCustomerId = session.customer;
    
    if (userId) {
      const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === userId.toLowerCase());
      if (userIndex !== -1) {
        mockUsersList[userIndex].plan = "monthly"; // Upgrade the user to paying plan
        mockUsersList[userIndex].subscriptionActive = true;
        mockUsersList[userIndex].subscriptionStartDate = new Date().toISOString();
        if (currentUserSession?.email.toLowerCase() === userId.toLowerCase()) {
          currentUserSession = mockUsersList[userIndex];
        }
        addAudit("STRIPE_SUBSCRIPTION_SUCCESS", "users", `Stripe Webhook: User ${userId} successfully subscribed under client ID ${stripeCustomerId}`);
      }
    }
    console.log(`User ${userId} successfully subscribed with customer ID ${stripeCustomerId}`);
  }

  res.json({ received: true });
});

// Lookup function checking status of logged-in trial or subscribed users in mock CRM database
async function checkUserSubscriptionStatus(userId: string): Promise<boolean> {
  const user = mockUsersList.find(u => u.email.toLowerCase() === userId.toLowerCase());
  if (!user) return false;
  
  // Reuse core validation engine
  const diagnostic = checkUserAccess(user);
  return diagnostic.active;
}

// --- 3. PROTECTED AI GENERATION ENDPOINT ---
app.post('/api/generate-content', async (req, res) => {
  const { prompt, userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  // Database verification step
  const isUserSubscribed = await checkUserSubscriptionStatus(userId); 

  if (!isUserSubscribed) {
    return res.status(403).json({ 
      error: "Subscription required.", 
      message: "Please upgrade your account to use AI features." 
    });
  }

  try {
    const ai = getGeminiClient();
    // Generate content using the new Google Gen AI SDK syntax with recommended model
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    res.json({ result: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to generate content." });
  }
});

// Configure Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CUSTOMER AND MARKETING CRM server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
