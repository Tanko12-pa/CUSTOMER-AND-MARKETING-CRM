import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import billingRouter from "./src/routes/billing";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import Stripe from "stripe";
import fs from "fs";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from "firebase/firestore";

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:5173", // Your Vite frontend URL
  credentials: true
}));

// Initialize Firebase App & Firestore Backend Connections
let db: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
      ...(firebaseConfig.firestoreDatabaseId ? { databaseId: firebaseConfig.firestoreDatabaseId } : {})
    });
    console.log("SUCCESS: Unified Firebase Backend integrated and database connected.");
  } else {
    console.warn("WARNING: firebase-applet-config.json not found on server root filesystem.");
  }
} catch (error) {
  console.error("CRITICAL: Failed to initialize Firebase backend engine:", error);
}

// Conditional body parsing: raw body for Stripe webhooks, json for everything else
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use(billingRouter);

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

// --- GOOGLE CALENDAR FUNCTION CALLING TOOLS AND HELPER ---
const googleCalendarTools = [
  {
    functionDeclarations: [
      {
        name: "get_current_date_and_time",
        description: "Returns the current system date and time, and fetches any scheduled calendar events from Google Calendar if the token is available.",
        parameters: {
          type: Type.OBJECT,
          properties: {},
          required: []
        }
      },
      {
        name: "create_calendar_event",
        description: "Creates a new calendar event in Google Calendar.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The title of the event" },
            description: { type: Type.STRING, description: "Optional description of the event" },
            startTime: { type: Type.STRING, description: "The ISO string of the start time (e.g., 2026-07-20T17:00:00Z)" },
            endTime: { type: Type.STRING, description: "The ISO string of the end time (e.g., 2026-07-20T18:00:00Z)" }
          },
          required: ["title", "startTime", "endTime"]
        }
      },
      {
        name: "delete_calendar_event",
        description: "Deletes a calendar event from Google Calendar.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            eventId: { type: Type.STRING, description: "The unique ID of the Google Calendar event to delete" }
          },
          required: ["eventId"]
        }
      }
    ]
  }
];

async function generateContentWithCalendar(
  prompt: string,
  systemInstruction: string,
  googleCalendarToken?: string
): Promise<string> {
  const ai = getGeminiClient();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
    // Intelligent, high-fidelity offline simulated response preserving the full UX
    return `### 📅 Simulated Calendar & System Intelligence (Offline Mode)
Google Calendar API is currently simulated because the Gemini API Key is in offline fallback mode.

**Current Date & Time**: ${new Date().toLocaleString()}

**Simulated Calendar Schedule**:
1. 📅 **Enterprise SLA Touchpoint: Almaric Vance** — 10:00 AM (Status: Synced)
2. 📅 **Executive Review: Marketing Retrospective** — 2:00 PM (Status: Synced)

*Connect Google Calendar via the UI to authenticate and query real Google Calendar events directly!*`;
  }

  try {
    const config: any = {
      systemInstruction,
      temperature: 0.3,
      tools: googleCalendarTools
    };

    // First model call to check for tool usage
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config
    });

    const candidate = response.candidates?.[0];
    const firstPart = candidate?.content?.parts?.[0];

    if (firstPart && "functionCall" in firstPart && firstPart.functionCall) {
      const call = firstPart.functionCall;
      const functionName = call.name;
      const args: any = call.args;

      let functionResult: any;

      if (functionName === "get_current_date_and_time") {
        const localDate = new Date().toISOString();
        if (googleCalendarToken) {
          try {
            const calendarResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
                new Date().toISOString()
              )}&maxResults=5`,
              {
                headers: { Authorization: `Bearer ${googleCalendarToken}` }
              }
            );
            if (calendarResponse.ok) {
              const events: any = await calendarResponse.json();
              functionResult = {
                currentDate: localDate,
                calendarEvents: events.items || [],
                status: "Success: Fetched primary calendar events."
              };
            } else {
              functionResult = {
                currentDate: localDate,
                error: `Failed to fetch calendar events: ${calendarResponse.status}`,
                status: "Warning: Google Calendar token invalid or expired."
              };
            }
          } catch (err: any) {
            functionResult = {
              currentDate: localDate,
              error: err.message,
              status: "Warning: Network error connecting to Google Calendar API."
            };
          }
        } else {
          functionResult = {
            currentDate: localDate,
            status: "Offline Mode: Google Calendar token not provided. Please connect Google Calendar."
          };
        }
      } else if (functionName === "create_calendar_event") {
        if (googleCalendarToken) {
          try {
            const calendarResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${googleCalendarToken}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  summary: args.title,
                  description: args.description || "",
                  start: { dateTime: args.startTime },
                  end: { dateTime: args.endTime }
                })
              }
            );
            if (calendarResponse.ok) {
              const created: any = await calendarResponse.json();
              functionResult = {
                status: "Success",
                message: `Successfully created calendar event: ${args.title}`,
                eventId: created.id,
                htmlLink: created.htmlLink
              };
            } else {
              const errBody = await calendarResponse.text();
              functionResult = {
                status: "Error",
                error: `Google Calendar API returned status ${calendarResponse.status}: ${errBody}`
              };
            }
          } catch (err: any) {
            functionResult = {
              status: "Error",
              error: `Network error: ${err.message}`
            };
          }
        } else {
          functionResult = {
            status: "Error",
            error: "Google Calendar not connected. Sign in with Google to create events."
          };
        }
      } else if (functionName === "delete_calendar_event") {
        if (googleCalendarToken) {
          try {
            const calendarResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${args.eventId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${googleCalendarToken}` }
              }
            );
            if (calendarResponse.ok) {
              functionResult = {
                status: "Success",
                message: `Successfully deleted calendar event: ${args.eventId}`
              };
            } else {
              const errBody = await calendarResponse.text();
              functionResult = {
                status: "Error",
                error: `Google Calendar API returned status ${calendarResponse.status}: ${errBody}`
              };
            }
          } catch (err: any) {
            functionResult = {
              status: "Error",
              error: `Network error: ${err.message}`
            };
          }
        } else {
          functionResult = {
            status: "Error",
            error: "Google Calendar not connected. Sign in with Google to delete events."
          };
        }
      }

      // Second model call to supply the function results
      const secondResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: prompt }] },
          response.candidates[0].content, // Send the original model turn
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: functionName,
                  response: functionResult
                }
              }
            ]
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.3
        }
      });

      return secondResponse.text || "Failed to finalize content.";
    }

    return response.text || "No text returned.";
  } catch (err: any) {
    console.error("Error in generateContentWithCalendar:", err);
    throw err;
  }
}

// In-Memory Database representing CRM Cloud Firestore collections
let mockCustomers: any[] = [
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
    stageHistory: {
      Lead: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
      MQL: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
      SQL: new Date(Date.now() - 32 * 24 * 3600 * 1000).toISOString(),
      Customer: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
    },
    growthTrends: [
      { month: "Dec", ltv: 55000 },
      { month: "Jan", ltv: 70000 },
      { month: "Feb", ltv: 85000 },
      { month: "Mar", ltv: 100000 },
      { month: "Apr", ltv: 115000 },
      { month: "May", ltv: 125000 }
    ],
    contact: {
      phone: "+1 (415) 888-2931",
      company: "Vance Aerospace",
      role: "VP of Engineering",
      marketingConsent: true,
      trackingConsent: true
    },
    account: {
      company: "Vance Aerospace",
      industry: "Aerospace & Defense",
      size: "Enterprise (5000+ employees)",
      region: "Americas (North America)"
    },
    interactions: [
      { id: "int_1", channel: "Email", timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Danielle Gold", sentiment: "Positive" as const, summary: "Reviewed proposal for seat license upgrade. Expecting approval." },
      { id: "int_2", channel: "Web Form", timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), agentOrBot: "System", sentiment: "Positive" as const, summary: "Consent verified for tracking and product marketing automation." },
      { id: "int_3", channel: "Call", timestamp: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Danielle Gold", sentiment: "Neutral" as const, summary: "Annual sync regarding security compliance checklist. All green." }
    ],
    opportunity: {
      stage: "Contract Negotiation",
      value: 125000,
      probability: 95,
      expectedCloseDate: "2026-06-15"
    }
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
    stageHistory: {
      Lead: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
      MQL: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
      SQL: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    },
    growthTrends: [
      { month: "Dec", ltv: 10000 },
      { month: "Jan", ltv: 18000 },
      { month: "Feb", ltv: 25000 },
      { month: "Mar", ltv: 32000 },
      { month: "Apr", ltv: 38000 },
      { month: "May", ltv: 45000 }
    ],
    contact: {
      phone: "+1 (617) 555-0812",
      company: "Aurora Labs",
      role: "Director of Product Security",
      marketingConsent: true,
      trackingConsent: false
    },
    account: {
      company: "Aurora Labs",
      industry: "Biotech & Genomics",
      size: "Mid-Market (500-1000 employees)",
      region: "Americas (East Coast)"
    },
    interactions: [
      { id: "int_4", channel: "Support Chat", timestamp: new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Support Bot", sentiment: "Neutral" as const, summary: "Inquired about GDPR compliance paperwork and data sovereignty options." },
      { id: "int_5", channel: "Email", timestamp: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Danielle Gold", sentiment: "Positive" as const, summary: "Introductory demo session completed. Requested sandbox credentials." }
    ],
    opportunity: {
      stage: "Proposal Sent",
      value: 45000,
      probability: 70,
      expectedCloseDate: "2026-06-10"
    }
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
    stageHistory: {
      Lead: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    },
    growthTrends: [
      { month: "Dec", ltv: 0 },
      { month: "Jan", ltv: 0 },
      { month: "Feb", ltv: 0 },
      { month: "Mar", ltv: 0 },
      { month: "Apr", ltv: 0 },
      { month: "May", ltv: 0 }
    ],
    contact: {
      phone: "+44 20 7946 0958",
      company: "Sterling Ventures",
      role: "Managing Partner",
      marketingConsent: false,
      trackingConsent: false
    },
    account: {
      company: "Sterling Ventures",
      industry: "Venture Capital",
      size: "Small (50-200 employees)",
      region: "EMEA (London)"
    },
    interactions: [
      { id: "int_6", channel: "Support Chat", timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Support Bot", sentiment: "Negative" as const, summary: "Encountered dashboard loading slowness. Expressed intent to close the account if latency persists." },
      { id: "int_7", channel: "Email", timestamp: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Marcus Aurelius", sentiment: "Negative" as const, summary: "Sent email requesting billing invoice clarification. No response received for 5 days." }
    ],
    opportunity: {
      stage: "Lead Qualification",
      value: 12000,
      probability: 10,
      expectedCloseDate: "2026-06-01"
    }
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
    stageHistory: {
      Lead: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
      MQL: new Date(Date.now() - 52 * 24 * 3600 * 1000).toISOString(),
      SQL: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
      Customer: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    growthTrends: [
      { month: "Dec", ltv: 35000 },
      { month: "Jan", ltv: 48000 },
      { month: "Feb", ltv: 59000 },
      { month: "Mar", ltv: 72000 },
      { month: "Apr", ltv: 80000 },
      { month: "May", ltv: 89000 }
    ],
    contact: {
      phone: "+7 495 123-4567",
      company: "Rostova Logistics",
      role: "Global Head of Infrastructure",
      marketingConsent: true,
      trackingConsent: true
    },
    account: {
      company: "Rostova Logistics",
      industry: "Logistics & Supply Chain",
      size: "Enterprise (10000+ employees)",
      region: "EMEA (Eastern Europe)"
    },
    interactions: [
      { id: "int_8", channel: "Email", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Danielle Gold", sentiment: "Negative" as const, summary: "Emailed reporting critical message drops on core webhook streams. Needs immediate diagnostic support." },
      { id: "int_9", channel: "Call", timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), agentOrBot: "Danielle Gold", sentiment: "Neutral" as const, summary: "Configured webhook endpoint and discussed high-availability clustering." }
    ],
    opportunity: {
      stage: "Renewal Review",
      value: 89000,
      probability: 55,
      expectedCloseDate: "2026-07-20"
    }
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
    stageHistory: {
      Lead: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      MQL: new Date().toISOString()
    },
    growthTrends: [
      { month: "Dec", ltv: 2000 },
      { month: "Jan", ltv: 4000 },
      { month: "Feb", ltv: 6000 },
      { month: "Mar", ltv: 8000 },
      { month: "Apr", ltv: 10000 },
      { month: "May", ltv: 12000 }
    ],
    contact: {
      phone: "+81 3 5555 0143",
      company: "Harlan Security",
      role: "Lead Threat Modeler",
      marketingConsent: true,
      trackingConsent: true
    },
    account: {
      company: "Harlan Security",
      industry: "Cybersecurity",
      size: "Enterprise (2000+ employees)",
      region: "APAC (Tokyo)"
    },
    interactions: [
      { id: "int_10", channel: "Web Form", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), agentOrBot: "System", sentiment: "Positive" as const, summary: "Downloaded technical whitepapers on multi-tenant isolation architectures." }
    ],
    opportunity: {
      stage: "Ecosystem Evaluation",
      value: 12000,
      probability: 85,
      expectedCloseDate: "2026-06-30"
    }
  }
];

let mockCampaigns = [
  {
    campaign_id: "camp_1",
    title: "Project Golden Wave Re-activation",
    targetSegment: "Inactive 30 Days",
    budget: 8500,
    status: "Active" as "Draft" | "Active" | "Completed",
    clicks: 1420,
    conversations: 310,
    revenueGenerated: 62000,
    revenueTargetGoal: 70000,
    openRate: 34.2,
    ctr: 5.6,
  },
  {
    campaign_id: "camp_2",
    title: "Enterprise Upgrade Masterclass",
    targetSegment: "High-Value Tier",
    budget: 15000,
    status: "Active" as "Draft" | "Active" | "Completed",
    clicks: 2800,
    conversations: 520,
    revenueGenerated: 185000,
    revenueTargetGoal: 200000,
    openRate: 42.1,
    ctr: 7.8,
  },
  {
    campaign_id: "camp_3",
    title: "New Signups Onboarding Sweep",
    targetSegment: "New Signups",
    budget: 3000,
    status: "Draft" as "Draft" | "Active" | "Completed",
    clicks: 0,
    conversations: 0,
    revenueGenerated: 0,
    revenueTargetGoal: 10000,
    openRate: 0,
    ctr: 0,
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
    user: "operator@company.com",
    status: "Success" as "Success" | "Failed",
    details: "Retrieved customer database for user session index sync.",
  },
  {
    id: "log_2",
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    action: "REVENUE_INSIGHTS_RUN",
    collection: "revenue_intelligence",
    user: "operator@company.com",
    status: "Success" as "Success" | "Failed",
    details: "Automatically modeled deal risk parameters for Almaric Vance using math matrix thresholds.",
  }
];

// Helper function to recursively strip undefined properties so Firestore writes never fail
function cleanUndefined(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// Helper to record audit logs
function addAudit(action: string, collection: string, details: string, user: string = currentUserSession?.email || "operator@company.com", statusStr: "Success" | "Failed" = "Success", changedFields?: Record<string, { old: any; new: any }>) {
  const newLog = cleanUndefined({
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    action,
    collection,
    user,
    status: statusStr,
    details,
    changedFields
  });
  mockAuditLogs.unshift(newLog);
  if (db) {
    setDoc(doc(db, "audit_logs", newLog.id), newLog).catch(err => {
      console.error("Failed to write audit log to Firestore:", err);
    });
  }
}

interface CRMUser {
  email: string;
  name: string;
  trialStartDate?: string; // ISO date string
  plan?: string;
  subscriptionActive?: boolean;
  subscriptionStartDate?: string;
  stripeCustomerId?: string;
}

// Global set of simulated database users
let mockUsersList: CRMUser[] = [
  {
    email: "operator@company.com",
    name: "CRM Operator",
    trialStartDate: new Date().toISOString(),
    plan: "trial",
    subscriptionActive: true
  }
];

// Active user session
let currentUserSession: CRMUser | null = null;

// User verification helper for unlimited un-gated CRM access
function checkUserAccess(user: CRMUser): { active: boolean; reason: string; trialDaysLeft: number } {
  const isSubscriber = user.subscriptionActive || user.plan === "monthly" || user.plan === "yearly" || user.plan === "standard";
  if (isSubscriber) {
    return { active: true, reason: "Active Premium Subscriber", trialDaysLeft: 0 };
  }
  
  if (user.plan === "none") {
    return { active: false, reason: "Account has no active subscription plan", trialDaysLeft: 0 };
  }

  // Calculate trial expiration (7 days from trialStartDate)
  const startMs = user.trialStartDate ? new Date(user.trialStartDate).getTime() : Date.now();
  const durationMs = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  const expiresMs = startMs + durationMs;
  const nowMs = Date.now();
  
  const trialDaysLeft = Math.max(0, (expiresMs - nowMs) / (1000 * 3600 * 24));
  const active = nowMs <= expiresMs;
  
  return {
    active,
    reason: active ? `Trial active with ${Math.ceil(trialDaysLeft)} days left` : "Trial expired",
    trialDaysLeft
  };
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

// Create/Register brand new user with instant standard access
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
        subscriptionActive: false
      };
      mockUsersList.push(newUser);
      currentUserSession = newUser;
      if (db) {
        setDoc(doc(db, "users", cleanEmail), newUser).catch(err => {
          console.error("Failed to write new user to Firestore:", err);
        });
      }
    }

    addAudit("USER_REGISTERED", "users", `User registered & signed in: ${email}`);

    const diagnostic = checkUserAccess(currentUserSession);
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
      return res.status(404).json({ success: false, error: "No user account registered under this email. Please click 'Register' first!" });
    }

    currentUserSession = user;
    addAudit("USER_LOGGED_IN", "users", `User signed in: ${email}`);

    const diagnostic = checkUserAccess(user);
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

// Dynamic subscription activation (Empty placeholders for compatibility if hit)
app.post("/api/auth/confirm-subscription", async (req, res) => {
  try {
    const { email, plan } = req.body;
    if (!email || !plan) {
      return res.status(400).json({ success: false, error: "Email and plan are required" });
    }
    const cleanEmail = email.trim().toLowerCase();
    let userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === cleanEmail);
    
    if (userIndex !== -1) {
      mockUsersList[userIndex].plan = plan;
      mockUsersList[userIndex].subscriptionActive = true;
      mockUsersList[userIndex].subscriptionStartDate = new Date().toISOString();
      currentUserSession = mockUsersList[userIndex];
      if (db) {
        await setDoc(doc(db, "users", cleanEmail), { plan, hasActiveSubscription: true }, { merge: true });
      }
      addAudit("SUBSCRIPTION_SUCCESS", "users", `User subscription confirmed: ${cleanEmail} upgraded to plan ${plan}`);
      res.json({ success: true, user: mockUsersList[userIndex] });
    } else {
      const newUser: CRMUser = {
        email: cleanEmail,
        name: email.split("@")[0],
        plan: plan,
        subscriptionActive: true,
        subscriptionStartDate: new Date().toISOString(),
        trialStartDate: new Date().toISOString()
      };
      mockUsersList.push(newUser);
      currentUserSession = newUser;
      if (db) {
        await setDoc(doc(db, "users", cleanEmail), { name: newUser.name, email: cleanEmail, plan, hasActiveSubscription: true, trialStartDate: newUser.trialStartDate }, { merge: true });
      }
      addAudit("SUBSCRIPTION_SUCCESS", "users", `User subscription created & confirmed: ${cleanEmail} upgraded to plan ${plan}`);
      res.json({ success: true, user: newUser });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to simulate expiration - deprecated and bypassed
app.post("/api/auth/simulate-expiration", async (req, res) => {
  try {
    if (currentUserSession) {
      currentUserSession.plan = "none";
      currentUserSession.subscriptionActive = false;
      currentUserSession.trialStartDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // Expired 3 days ago
      
      const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === currentUserSession!.email.toLowerCase());
      if (userIndex !== -1) {
        mockUsersList[userIndex] = currentUserSession;
      }
      if (db) {
        await setDoc(doc(db, "users", currentUserSession.email.toLowerCase()), { plan: "none", hasActiveSubscription: false, trialExpiresAt: Date.now() - 24 * 3600 * 1000 }, { merge: true });
      }
    }
    res.json({ success: true, user: currentUserSession });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restore trial - deprecated and bypassed
app.post("/api/auth/simulate-restore-trial", async (req, res) => {
  try {
    if (currentUserSession) {
      currentUserSession.plan = "trial";
      currentUserSession.subscriptionActive = false;
      currentUserSession.trialStartDate = new Date().toISOString();
      
      const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === currentUserSession!.email.toLowerCase());
      if (userIndex !== -1) {
        mockUsersList[userIndex] = currentUserSession;
      }
      if (db) {
        await setDoc(doc(db, "users", currentUserSession.email.toLowerCase()), { plan: "trial", hasActiveSubscription: false, trialExpiresAt: Date.now() + 7 * 24 * 3600 * 1000 }, { merge: true });
      }
    }
    res.json({ success: true, user: currentUserSession });
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
      res.status(500).json({ error: "Stripe is not currently configured on this workspace. Please define STRIPE_SECRET_KEY in settings." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync backend CRM state with Google Cloud Firestore database
app.post("/api/sync-backend-crm-state", async (req, res) => {
  const { userId } = req.body;
  try {
    console.log(`Synchronization triggered on backend CRM state by user session: ${userId || "unknown"}`);
    await syncFirestoreData();
    addAudit("SYNC_BACKEND_STATE", "users", `Synchronized CRM state with Cloud Firestore for session: ${userId || "unknown"}`);
    res.json({
      success: true,
      message: "Backend state synced successfully",
      customersCount: mockCustomers.length,
      campaignsCount: mockCampaigns.length,
      ticketsCount: mockSupportTickets.length,
      auditLogsCount: mockAuditLogs.length
    });
  } catch (error: any) {
    console.error("Failed to sync backend CRM state on endpoint:", error);
    res.status(500).json({ success: false, error: error.message || "An error occurred during synchronization." });
  }
});

// REST Api to retrieve current state
app.get("/api/state", async (req, res) => {
  if (db) {
    try {
      const tempCustomers: any[] = [];
      const customersSn = await getDocs(collection(db, "customers"));
      customersSn.forEach(d => {
        tempCustomers.push(d.data() as any);
      });
      mockCustomers = tempCustomers;
    } catch (err) {
      console.warn("Failed to fetch customers from Firestore. Retaining in-memory mock state.", err);
    }

    try {
      const tempCampaigns: any[] = [];
      const campaignsSn = await getDocs(collection(db, "marketing_campaigns"));
      campaignsSn.forEach(d => {
        tempCampaigns.push(d.data() as any);
      });
      mockCampaigns = tempCampaigns;
    } catch (err) {
      console.warn("Failed to fetch campaigns from Firestore. Retaining in-memory mock state.", err);
    }

    try {
      const tempTickets: any[] = [];
      const ticketsSn = await getDocs(collection(db, "support_tickets"));
      ticketsSn.forEach(d => {
        tempTickets.push(d.data() as any);
      });
      mockSupportTickets = tempTickets;
    } catch (err) {
      console.warn("Failed to fetch support tickets from Firestore. Retaining in-memory mock state.", err);
    }

    try {
      const tempLogs: any[] = [];
      const logsSn = await getDocs(collection(db, "audit_logs"));
      logsSn.forEach(d => {
        tempLogs.push(d.data() as any);
      });
      mockAuditLogs = tempLogs;
      mockAuditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      console.warn("Failed to fetch audit logs from Firestore. Retaining in-memory mock state.", err);
    }
  }

  res.json({
    customers: mockCustomers,
    campaigns: mockCampaigns,
    supportTickets: mockSupportTickets,
    auditLogs: mockAuditLogs,
  });
});

// REST Api to update user metadata or state
app.post("/api/update-state", async (req, res) => {
  try {
    const { type, payload } = req.body;
    
    if (type === "ADD_CUSTOMER") {
      const stage = payload.lifecycleStage || "Lead";
      const now = new Date().toISOString();
      const newCust = {
        uid: `cust_${Date.now()}`,
        name: payload.name || "Unnamed Client",
        email: payload.email || "unknown@company.com",
        lifecycleStage: stage,
        tier: payload.tier || "Free",
        leadScore: Number(payload.leadScore) || 50,
        lifetimeValue: Number(payload.lifetimeValue) || 0,
        sentiment: payload.sentiment || "Neutral",
        lastInteractionDays: Number(payload.lastInteractionDays) || 0,
        winProbability: Number(payload.winProbability) || 50,
        assignedRep: payload.assignedRep || "Danielle Gold",
        dealRiskStatus: payload.lastInteractionDays > 14 ? "High Risk: Inactive" : "Low Risk",
        createdAt: now,
        stageHistory: {
          [stage]: now
        }
      };
      
      // Enforce the rule: negative sentiment implies "At Risk"
      if (newCust.sentiment === "Negative") {
        newCust.dealRiskStatus = "At Risk: Negative Sentiment";
      }

      mockCustomers.push(newCust);
      if (db) {
        await setDoc(doc(db, "customers", newCust.uid), newCust);
      }
      addAudit("CREATE_RECORD", "customers", `Added customer ${newCust.name} (${newCust.email})`);
    } else if (type === "BULK_ADD_CUSTOMERS") {
      const records = payload.records || [];
      const importedList = [];
      for (const record of records) {
        const uniqueId = `cust_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const stage = record.lifecycleStage || "Lead";
        const createdVal = record.createdAt || new Date().toISOString();
        const newCust = {
          uid: record.uid || uniqueId,
          name: record.name || "Unnamed Client",
          email: record.email || "unknown@company.com",
          lifecycleStage: stage,
          tier: record.tier || "Free",
          leadScore: Number(record.leadScore) || 50,
          lifetimeValue: Number(record.lifetimeValue) || 0,
          sentiment: record.sentiment || "Neutral",
          lastInteractionDays: Number(record.lastInteractionDays) || 0,
          winProbability: Number(record.winProbability) || 50,
          assignedRep: record.assignedRep || "Danielle Gold",
          dealRiskStatus: record.dealRiskStatus || (Number(record.lastInteractionDays) > 14 ? "High Risk: Inactive" : "Low Risk"),
          createdAt: createdVal,
          stageHistory: record.stageHistory || {
            [stage]: createdVal
          }
        };
        if (newCust.sentiment === "Negative") {
          newCust.dealRiskStatus = "At Risk: Negative Sentiment";
        }
        mockCustomers.push(newCust);
        if (db) {
          await setDoc(doc(db, "customers", newCust.uid), newCust);
        }
        importedList.push(newCust);
      }
      addAudit("BULK_IMPORT_CSV", "customers", `Successfully bulk imported ${records.length} customers via CSV file upload.`);
    } else if (type === "UPDATE_CUSTOMER") {
      const idx = mockCustomers.findIndex(c => c.uid === payload.uid);
      if (idx !== -1) {
        const oldRecord = { ...mockCustomers[idx] };
        const changedFields: Record<string, { old: any; new: any }> = {};
        
        Object.keys(payload).forEach(key => {
          if (payload[key] !== undefined && oldRecord[key as keyof typeof oldRecord] !== payload[key]) {
            changedFields[key] = {
              old: oldRecord[key as keyof typeof oldRecord],
              new: payload[key]
            };
          }
        });

        const oldStage = oldRecord.lifecycleStage;
        const newStage = payload.lifecycleStage;
        const updatedHistory = { ...(oldRecord.stageHistory || {}) };
        if (newStage && newStage !== oldStage) {
          updatedHistory[newStage] = new Date().toISOString();
        }

        mockCustomers[idx] = {
          ...mockCustomers[idx],
          ...payload,
          stageHistory: updatedHistory
        };
        // Re-enforce sentiment checks
        if (mockCustomers[idx].sentiment === "Negative") {
          mockCustomers[idx].dealRiskStatus = "At Risk: Negative Sentiment";
          changedFields["dealRiskStatus"] = {
            old: oldRecord.dealRiskStatus,
            new: "At Risk: Negative Sentiment"
          };
        }
        if (db) {
          await setDoc(doc(db, "customers", payload.uid), mockCustomers[idx]);
        }
        addAudit("UPDATE_RECORD", "customers", `Updated customer ${mockCustomers[idx].name}`, currentUserSession?.email || "operator@company.com", "Success", changedFields);
      }
    } else if (type === "DELETE_CUSTOMERS") {
      const uidsToDelete = payload.uids || [];
      const originalCount = mockCustomers.length;
      mockCustomers = mockCustomers.filter(c => !uidsToDelete.includes(c.uid));
      const deletedCount = originalCount - mockCustomers.length;
      if (db) {
        for (const uid of uidsToDelete) {
          await deleteDoc(doc(db, "customers", uid));
        }
      }
      addAudit("DELETE_RECORDS", "customers", `Bulk deleted ${deletedCount} customer profile(s) via database admin console.`);
    } else if (type === "DELETE_CAMPAIGN") {
      const campId = payload.campaign_id;
      mockCampaigns = mockCampaigns.filter(c => c.campaign_id !== campId);
      if (db) {
        await deleteDoc(doc(db, "marketing_campaigns", campId));
      }
      addAudit("DELETE_RECORD", "marketing_campaigns", `Deleted marketing campaign: ${campId}`);
    } else if (type === "DELETE_TICKET") {
      const ticketId = payload.ticket_id;
      mockSupportTickets = mockSupportTickets.filter(t => t.ticket_id !== ticketId);
      if (db) {
        await deleteDoc(doc(db, "support_tickets", ticketId));
      }
      addAudit("DELETE_RECORD", "support_tickets", `Deleted support ticket: ${ticketId}`);
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
      if (db) {
        await setDoc(doc(db, "support_tickets", newTicket.ticket_id), newTicket);
      }
      
      // If negative ticket sentiment, auto mark customer sentiment as at risk
      if (customer && newTicket.sentiment === "Negative") {
        customer.sentiment = "Negative" as const;
        customer.dealRiskStatus = "At Risk: Active Negative Support Ticket";
        if (db) {
          await setDoc(doc(db, "customers", customer.uid), customer);
        }
      }
      
      addAudit("CREATE_RECORD", "support_tickets", `Added support ticket for ${newTicket.customerName}`);
    } else if (type === "UPDATE_TICKET") {
      const idx = mockSupportTickets.findIndex(t => t.ticket_id === payload.ticket_id);
      if (idx !== -1) {
        const oldRecord = { ...mockSupportTickets[idx] };
        const changedFields: Record<string, { old: any; new: any }> = {};

        Object.keys(payload).forEach(key => {
          if (payload[key] !== undefined && oldRecord[key as keyof typeof oldRecord] !== payload[key]) {
            changedFields[key] = {
              old: oldRecord[key as keyof typeof oldRecord],
              new: payload[key]
            };
          }
        });

        mockSupportTickets[idx] = {
          ...mockSupportTickets[idx],
          ...payload,
        };
        if (db) {
          await setDoc(doc(db, "support_tickets", payload.ticket_id), mockSupportTickets[idx]);
        }
        addAudit("UPDATE_RECORD", "support_tickets", `Updated support ticket ${payload.ticket_id} to status ${payload.status || 'Updated'}`, currentUserSession?.email || "operator@company.com", "Success", changedFields);
      }
    } else if (type === "LAUNCH_CAMPAIGN") {
      const idx = mockCampaigns.findIndex(camp => camp.campaign_id === payload.campaign_id);
      if (idx !== -1) {
        mockCampaigns[idx].status = "Active";
        mockCampaigns[idx].clicks += 150;
        mockCampaigns[idx].conversations += 20;
        mockCampaigns[idx].revenueGenerated += 5000;
        mockCampaigns[idx].openRate = Number((28.5 + Math.random() * 12.0).toFixed(1));
        mockCampaigns[idx].ctr = Number((4.1 + Math.random() * 3.5).toFixed(1));
        
        const goal = mockCampaigns[idx].revenueTargetGoal || (mockCampaigns[idx].budget * 2.5);
        if (mockCampaigns[idx].revenueGenerated >= goal) {
          mockCampaigns[idx].status = "Completed";
          addAudit("CAMPAIGN_AUTO_COMPLETED", "marketing_campaigns", `Campaign "${mockCampaigns[idx].title}" hit target goal of $${goal.toLocaleString()}! Reclassified status to Completed.`);
        } else {
          addAudit("LAUNCH_CAMPAIGN", "marketing_campaigns", `Enrolled segment and launched campaign "${mockCampaigns[idx].title}"`);
        }
        
        if (db) {
          await setDoc(doc(db, "marketing_campaigns", payload.campaign_id), mockCampaigns[idx]);
        }
      }
    } else if (type === "SIMULATE_REVENUE_GAIN") {
      const idx = mockCampaigns.findIndex(camp => camp.campaign_id === payload.campaign_id);
      if (idx !== -1) {
        mockCampaigns[idx].clicks += 75;
        mockCampaigns[idx].conversations += 12;
        mockCampaigns[idx].revenueGenerated += 5000;
        mockCampaigns[idx].openRate = Math.min(Number(((mockCampaigns[idx].openRate || 25) + 1.2 + Math.random() * 0.8).toFixed(1)), 100);
        mockCampaigns[idx].ctr = Math.min(Number(((mockCampaigns[idx].ctr || 3.5) + 0.3 + Math.random() * 0.4).toFixed(1)), 100);
        
        const goal = mockCampaigns[idx].revenueTargetGoal || (mockCampaigns[idx].budget * 2.5);
        if (mockCampaigns[idx].revenueGenerated >= goal) {
          mockCampaigns[idx].status = "Completed";
          addAudit("CAMPAIGN_AUTO_COMPLETED", "marketing_campaigns", `Campaign "${mockCampaigns[idx].title}" met target limit of $${goal.toLocaleString()}! Transformed status to Completed.`);
        } else {
          addAudit("SIMULATE_REVENUE_GAIN", "marketing_campaigns", `Simulated additional revenue conversion for "${mockCampaigns[idx].title}" (+$5,000 generated revenue).`);
        }
        
        if (db) {
          await setDoc(doc(db, "marketing_campaigns", payload.campaign_id), mockCampaigns[idx]);
        }
      }
    } else if (type === "ADD_CAMPAIGN") {
      const budgetVal = Number(payload.budget) || 1000;
      const newCamp = {
        campaign_id: `camp_${Date.now()}`,
        title: payload.title,
        targetSegment: payload.targetSegment || "New Signups",
        budget: budgetVal,
        status: "Draft" as const,
        clicks: 0,
        conversations: 0,
        revenueGenerated: 0,
        revenueTargetGoal: Number(payload.revenueTargetGoal) || (budgetVal * 2.5),
        openRate: 0,
        ctr: 0
      };
      mockCampaigns.push(newCamp);
      if (db) {
        await setDoc(doc(db, "marketing_campaigns", newCamp.campaign_id), newCamp);
      }
      addAudit("CREATE_RECORD", "marketing_campaigns", `Created marketing campaign draft "${newCamp.title}" with target goal of $${newCamp.revenueTargetGoal.toLocaleString()}`);
    } else if (type === "ESCALATE_DEAL") {
      const idx = mockCustomers.findIndex(c => c.uid === payload.uid);
      if (idx !== -1) {
        mockCustomers[idx].dealRiskStatus = "Escalated";
        if (db) {
          await setDoc(doc(db, "customers", payload.uid), mockCustomers[idx]);
        }
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

app.post("/api/gemini/summarize-customer", async (req, res) => {
  try {
    const { uid } = req.body;
    const customer = mockCustomers.find(c => c.uid === uid);
    if (!customer) return res.status(404).json({ error: "Customer profiles not found" });
    
    const interactionsStr = (customer.interactions || [])
      .map(i => `[${i.channel} - ${i.sentiment}] ${i.agentOrBot}: ${i.summary}`)
      .join("\n");
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      const fallbackBullets = [
        `Maintained active connectivity through ${customer.interactions?.[0]?.channel || 'direct outreach'} loops.`,
        `Primary representative owner matches assigned sales specialist ${customer.assignedRep}.`,
        `Engagement rating is successfully modeled as ${customer.sentiment} with score rating of ${customer.leadScore}.`,
        `Current workspace deal value is tracked securely in sub-entities at $${customer.lifetimeValue.toLocaleString()}.`,
        `System flag indicates ${customer.dealRiskStatus} with win likelihood currently hovering around ${customer.winProbability}%.`
      ];
      return res.json({ summary: fallbackBullets.map(b => `- ${b}`).join("\n") });
    }
    
    const ai = getGeminiClient();
    const systemPrompt = "You are a seasoned enterprise growth banker. Summarize all recent interactions into a 'Last 30 days in 5 bullets' view. Keep every bullet extremely highly-polished, precise, and professional. Every single bullet must start with a minus sign '- '. Do not output anything other than the five bullets.";
    const prompt = `Summarize these recent customer interactions for ${customer.name} (${customer.email}):\n${interactionsStr}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { systemInstruction: systemPrompt }
    });
    res.json({ summary: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/score-lead", async (req, res) => {
  try {
    const { uid } = req.body;
    const customer = mockCustomers.find(c => c.uid === uid);
    if (!customer) return res.status(404).json({ error: "Customer profile not found" });
    
    const engagementStr = `Lead Score: ${customer.leadScore}, Win Probability: ${customer.winProbability}%, Last Interaction: ${customer.lastInteractionDays} days ago`;
    const firmographicsStr = `Account: ${customer.account?.company}, Industry: ${customer.account?.industry}, Size: ${customer.account?.size}, Region: ${customer.account?.region}. Role of buyer: ${customer.contact?.role}`;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      let rating = "Medium";
      if (customer.leadScore > 80) rating = "High";
      if (customer.leadScore < 50) rating = "Low";
      
      const fallbackRationale = `Calculated lead rank as ${rating} based on active score index metrics. Customer profile reflects ${customer.account?.size || 'active'} size footprint in the ${customer.account?.industry || 'enterprise'} market. Last contact elapsed ${customer.lastInteractionDays} day(s) with clear consent metrics established.`;
      return res.json({ rating, rationale: fallbackRationale });
    }
    
    const ai = getGeminiClient();
    const systemPrompt = "You are a seasoned enterprise growth banker. Inspect customer profile details and score/rank lead conversion potential as either High, Medium, or Low, and write a professional rationale. Return response strictly in JSON matching schema: { rating: 'High' | 'Medium' | 'Low', rationale: '...' }";
    const prompt = `Review Lead and rank it:\nEngagement: ${engagementStr}\nFirmographics: ${firmographicsStr}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rating: { type: Type.STRING },
            rationale: { type: Type.STRING }
          },
          required: ["rating", "rationale"]
        }
      }
    });
    const result = JSON.parse(response.text || "{}");
    res.json({ rating: result.rating, rationale: result.rationale });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/detect-churn", async (req, res) => {
  try {
    const { uid } = req.body;
    const customer = mockCustomers.find(c => c.uid === uid);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    
    const interactionsStr = (customer.interactions || [])
      .map(i => `[${i.channel} - ${i.sentiment}] ${i.summary}`)
      .join("\n");
    const riskMetric = `Days since last contact: ${customer.lastInteractionDays}. Deal Risk Matrix indicates: ${customer.dealRiskStatus}. Customer Sentiment matches: ${customer.sentiment}`;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      let atRisk = false;
      if (customer.sentiment === "Negative" || customer.lastInteractionDays > 14) {
        atRisk = true;
      }
      const fallbackRationale = atRisk 
        ? `Churn threat flagged as AT-RISK due to negative buyer sentiment metrics and inactivity duration of ${customer.lastInteractionDays} days. Recommend scheduling an immediate high-touch CSM alignment call.`
        : `Low churn risk. Engagement logs are verified within standard SLA levels. Product utilization activity matches premium limits.`;
      
      return res.json({ atRisk, rationale: fallbackRationale });
    }
    
    const ai = getGeminiClient();
    const systemPrompt = "You are a seasoned growth banker and customer success strategist. Analyze the user engagement records and decide if they represent an active Churn Threat (atRisk = True/False), providing a tailored rationale and mitigation steps. Return strictly JSON matching: { atRisk: boolean, rationale: '...' }";
    const prompt = `Review customer engagement metrics and detect Churn Risk:\n${riskMetric}\nInteractions History:\n${interactionsStr}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            atRisk: { type: Type.BOOLEAN },
            rationale: { type: Type.STRING }
          },
          required: ["atRisk", "rationale"]
        }
      }
    });
    const result = JSON.parse(response.text || "{}");
    res.json({ atRisk: result.atRisk, rationale: result.rationale });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/campaign-builder", async (req, res) => {
  try {
    const { audience, offer, mix, tone, language, persona, useSearch, theme, segment } = req.body;
    
    const finalAudience = audience || segment || "Inactive 30 Days";
    const finalTone = tone || "Professional";
    const finalTheme = theme || offer || "General campaign outreach";
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      const mockCampaignOutput = {
        subjectLine: `🚀 [${finalTone}] Special Offer for our ${finalAudience}`,
        blastHtml: `Dear Customer,\n\nWe are pleased to introduce our latest updates. Tailored in a ${finalTone} tone specifically for our ${finalAudience} segment, we guarantee low-latency telemetry security.\n\nDirective description: ${finalTheme}\n\nBest regards,\nYour Growth Team`,
        smsPush: `SMS [${finalTone}]: Get instant secured access regarding ${finalTheme}. Reply YES to sign up!`,
        socialCopy: `Check out our latest ${finalAudience} campaign! Handcrafted with an emphasis on being ${finalTone}. #growth #telemetry`,
        rationale: `Strategy: We leveraged an intensive ${finalTone} appeal to engage the ${finalAudience} cohort and prompt lead score uplift.`,
        emails: {
          welcome: `Subject: Welcome to the Future of Security [${language || 'en'}]\n\nHello, we are excited to have you onboard. As a leading player in the ${finalAudience} space, you will benefit from our special product: ${finalTheme}. This represents a unique milestone towards compliance.`,
          nurture: `Subject: Unlocking full potential and scalability [${language || 'en'}]\n\nDid you know that teams utilizing our specialized solution (${finalTheme}) experience a 50% decrease in integration delays? Let's discuss details.`,
          reactivation: `Subject: Special offer for your sandbox telemetry [${language || 'en'}]\n\nWe noticed a brief pause in your sandbox audit logs. To assist reactivation, here is a custom voucher for ${finalTheme} today.`
        },
        ads: {
          search: `Special Offer: ${finalTheme} for ${finalAudience}. Secure, scalable, with robust telemetry built in.`,
          display: `Empowering ${persona || "Enterprise"} Teams - Secure ${finalTheme} sandbox integration.`,
          social: `Are you a ${persona || "Budget-conscious manager"} looking to automate? Integrate our latest ${finalTheme} and simplify auditing.`
        },
        landingPage: {
          headline: `Automate Your Production Compliance with ${finalTheme}`,
          valueProp: `Engineered specifically for the needs of ${finalAudience}, enabling instant SOC2 auditing and low-latency API streams.`,
          faqs: `Q: Is ${finalTheme} fully GDPR compliant?\nA: Yes, certified and validated across all EMEA and APAC regional datastores.`,
          cta: `Start Your ${finalTheme} 30-Day Evaluation`
        },
        shortMessages: `SMS: Urgent! Get instant secure access to our customized offer: ${finalTheme}. Reply YES to consult our rep.`,
        abTests: [
          { variant: "Variant A (Benefit-led)", hypothesis: `Focusing on the high-availability and security of '${finalTheme}' will yield 22% higher conversions for enterprise decision-makers.` },
          { variant: "Variant B (Urgency-led)", hypothesis: `Using a limited-time trial expiration badge for ${finalTheme} will increase click conversion rates among mobile users by 12%.` }
        ]
      };
      return res.json(mockCampaignOutput);
    }
    
    const ai = getGeminiClient();
    const systemPrompt = "You are an avant-garde chief of growth marketing. Given a campaign brief, theme, target segment, and tone, you write comprehensive content assets. Return response strictly in JSON matching the specified schema. Output content in the requested language translated perfectly.";
    const prompt = `Compose a marketing campaign with these parameters:
      - Topic/Theme Directive: ${finalTheme}
      - Target Segment: ${finalAudience}
      - Copy Tone: ${finalTone}
      - Language: ${language || "English"}
      - Target Persona: ${persona || "Customer"}
      - Use Google Search Grounding: ${useSearch ? 'True' : 'False'}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        tools: useSearch ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjectLine: { type: Type.STRING },
            blastHtml: { type: Type.STRING },
            smsPush: { type: Type.STRING },
            socialCopy: { type: Type.STRING },
            rationale: { type: Type.STRING },
            emails: {
              type: Type.OBJECT,
              properties: {
                welcome: { type: Type.STRING },
                nurture: { type: Type.STRING },
                reactivation: { type: Type.STRING }
              },
              required: ["welcome", "nurture", "reactivation"]
            },
            ads: {
              type: Type.OBJECT,
              properties: {
                search: { type: Type.STRING },
                display: { type: Type.STRING },
                social: { type: Type.STRING }
              },
              required: ["search", "display", "social"]
            },
            landingPage: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                valueProp: { type: Type.STRING },
                faqs: { type: Type.STRING },
                cta: { type: Type.STRING }
              },
              required: ["headline", "valueProp", "faqs", "cta"]
            },
            shortMessages: { type: Type.STRING },
            abTests: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  variant: { type: Type.STRING },
                  hypothesis: { type: Type.STRING }
                },
                required: ["variant", "hypothesis"]
              }
            }
          },
          required: ["subjectLine", "blastHtml", "smsPush", "socialCopy", "rationale", "emails", "ads", "landingPage", "shortMessages", "abTests"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/funnel-automator", async (req, res) => {
  try {
    const { productName, targetAudience, campaignOffer, creativeTone, funnelType, useSearch } = req.body;
    
    const name = productName || "Enterprise Workspace Solution";
    const audience = targetAudience || "High-Value Decision Makers";
    const offer = campaignOffer || "Gated 30-Day Dev Trial License";
    const tone = creativeTone || "Professional";
    const typeSelected = funnelType || "Lead Magnet Funnel";
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      const mockResult = {
        trafficEngine: {
          adsHeadlines: [
            `🚀 Modern CRM Automation - 30-Day Evaluation`,
            `💡 High-Performance CRM for ${audience}`,
            `⚡ Scale with compliance: Custom ${name}`
          ],
          adsDescriptions: [
            `Power up your workflow with ${name}, designed for teams supporting ${audience}. Get automated campaign workflows instantly!`,
            `Maximize conversions. Reduce API transaction delays. Try our specialized ${typeSelected} campaign offer: ${offer}.`
          ],
          socialPosts: {
            twitter: `Are you managing high-touch pipelines for ${audience}? Learn how our central ${name} automates landing pages, copy variations, and email nurturing sequences. #growth #marketing`,
            linkedin: `How do search-lead teams automate campaigns without losing tone precision? With the ${name} workspace. We have tailored specific triggers for the ${audience} segment. Check it out today.`,
            facebook: `Go beyond boring CRMs. Integrate ${name} with real-time analytics to track and convert your leads automatically. Try the ${offer} now!`
          },
          videoCreative: {
            title: `Veo Video Promo: ${name}`,
            veoScript: `[SCENE 1: Visual of an empty developer sandbox workspace. Deep ambient synth tracks playing.]\nVoiceover (Kore): "Struggling with multi-touch pipeline leakage? Meet ${name}."\n[SCENE 2: Fast-cut collage of elegant code editing, live telemetry monitors, and custom dashboard charts.]\nVoiceover: "The central intelligence brain that scores, segments, and nurtures prospects in real-time."\n[SCENE 3: Logo screen showing 'Secured Workspace' and active evaluation labels.]\nVoiceover: "Click now to claim your ${offer} in Google AI Studio."`,
            visualStoryboard: `Frame 1: Extreme close-up of user selecting CRM dashboard filters. Focus on the responsive 78% conversion velocity indicator.\nFrame 2: Over-the-shoulder view of a manager viewing the interactive D3 pie chart. A notification chime sounds as a SQL lead completes a qualification quiz.\nFrame 3: Clean sleek splash screen with interactive logo: 'Start 30-Day Evaluation Now'.`
          },
          seoOutline: `### SEO Content Guide for ${name}\n- **Target Keyword**: Automated CRM funnels for ${audience}\n- **Suggested URL**: /blog/automate-marketing-funnels-with-${name.toLowerCase().replace(/\s+/g, '-')}\n- **Meta Title**: How to Automate Funnels with ${name} | CRM Analytics\n- **Introduction Outline**: Introduce why standard CRM platforms fail to bridge paid ads to lead capture. Detail ${typeSelected} methodology.\n- **Subheading 1**: Understanding ${audience} Behavior\n- **Subheading 2**: Setting Lead-Scoring Rules for ${offer}\n- **Call-To-Action**: Download the full interactive quiz framework.`
        },
        leadCapture: {
          landingPageCopy: {
            headline: `Empower Your Revenue Team with ${name}`,
            subheading: `The multi-touch CRM workspace meticulously designed to turn cold clicks into customer accounts. Customized for ${audience}.`,
            valueProps: [
              `Instant qualification matching and database scoring`,
              `Seamless real-time Google Grounding support`,
              `SOC2 Level Compliance validation out-of-the-box`
            ],
            faqs: [
              { q: `What is included in the ${offer}?`, a: `You get full access to the AI sandbox console, customer logs telemetry, and daily digests with custom trigger capabilities.` },
              { q: `Is it compatible with Firebase and Postgres?`, a: `Yes, has natively responsive syncing for high-fidelity offline fallbacks and active cloud databases.` }
            ],
            cta: `Claim Your ${offer} Now`
          },
          chatbotScript: {
            greeting: `Hello! I am your central ${name} qualification bot. Are you exploring custom setups for yourself or your team?`,
            questions: [
              `What is your typical monthly ad budget for targeting ${audience}?`,
              `Are you currently storing leads in Firebase or secondary Google Sheets?`,
              `Would you like to auto-apply our customized: ${offer}?`
            ],
            scoreRouting: `IF budget > $5,000 AND Lead answers Yes to auto-apply -> Route to HIGH-PRIORITY MQL pipeline (leadScore +35).\nELSE -> Route to default nurturing sequence (leadScore +10).`
          },
          quizSchema: {
            title: `Determine Your CRM Automation Maturity Index`,
            questions: [
              { questionText: `How do you rate your current ${typeSelected} performance?`, optionsList: [`Excellent (No manual work)`, `Moderate (We write copy manually)`, `Low (No structured sequence)`] },
              { questionText: `How are you scoring leads from your ads?`, optionsList: [`Standard rules`, `We use AI or predictive scoreboards`, `No clear metrics`] }
            ]
          }
        },
        nurtureEngine: {
          emailSequence: [
            { subject: `📬 Day 1: Access Granted // Your ${offer}`, body: `Hello Operator,\n\nWelcome back. Your access to ${name} has been provisioned. We hope you leverage this specialized solution for targeting ${audience} with a robust ${tone} tone.\n\nEnjoy,\nCRM Support Team`, delay: "Immediate" },
            { subject: `📊 Day 3: Stop Losing Lead Momentum`, body: `Did you know that teams utilizing our specialized ${typeSelected} experience a 50% decrease in manual tracking delays? Let's check how your lead score dashboard is performing.`, delay: "2 Days Later" },
            { subject: `🕒 Day 5: Final reminder regarding your evaluation`, body: `Don't miss the chance of locking in your enterprise SLA. We are offering a limited session-extension. Just click reply to coordinate a custom workspace preview!`, delay: "4 Days Later" }
          ],
          smsFollowups: [
            `💬 SMS: Hello from ${name}! Your special offer (${offer}) is active. Click here to check active telemetry.`,
            `⏰ SMS Reminder: Your evaluation period ends in 48 hours. Secure your workspace now!`
          ],
          scoringLogic: `#### Unified Marketing to Sales Handoff Trigger Protocol\n1. User visits landing page: +5 leadScore\n2. User completes the CRM maturity quiz: +20 leadScore\n3. Conversational chatbot validates budget > target threshold: Promote node to SQL stage and alert assignee rep Danielle Gold.`
        },
        optimizationEngine: {
          abTests: [
            { name: "Benefit-Led vs Urgency-Led Headers", hypothesis: `A benefit focus explaining low-latency telemetry will increase opt-ins by 18% compared to trial countdown deadlines.`, metric: "Conversion rate on lead opt-in form" },
            { name: "Two-Step Option Quiz vs One-Shot CTA", hypothesis: `Chunking qualification questions into an interactive quiz yields 25% richer CRM metadata profiles.`, metric: "Lead form submission rate" }
          ],
          seoAudit: `#### SEO On-Page Optimization Recommendations\n- **Target Title Length**: 58 characters\n- **Current H1**: Setup your funnel copy with ${name}\n- **Missing Alt Tags**: Ensure all illustration elements in the landing page feature highly descriptive referrerPolicy keywords.\n- **Internal Links**: Add clear link routing pointing customer support FAQs back to the billing license page.`,
          analyticsSimulatorRules: `#### Funnel Simulation Telemetry Rules\n- Baseline Click-Through Rate: 4.2% on Google Search Ads\n- Chatbot Completion Rate: 65% on entry trigger\n- SQL Conversion Probability: 15% following automated follow-ups`
        }
      };
      return res.json(mockResult);
    }
    
    const ai = getGeminiClient();
    const systemPrompt = `You are a world-class growth expert and funnel architect. Given a product outline, target niche, offer, tone, and campaign style, you generate content assets for each funnel stage.
Ensure all outputs are perfectly tailored to the requested inputs.
Your response MUST be valid JSON strictly matching the defined responseSchema properties. Do not include markdown wraps around the JSON in your response. Ensure all text outputs are complete and polished.`;

    const prompt = `Construct an automated marketing funnel using the central brain of Google AI Studio:
Product Name: ${name}
Target Audience Segment: ${audience}
Core Offer / Incentive: ${offer}
Tone of Voice: ${tone}
Funnel Type Model: ${typeSelected}
Use search grounding context if requested: ${useSearch ? "Yes" : "No"}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        tools: useSearch ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trafficEngine: {
              type: Type.OBJECT,
              properties: {
                adsHeadlines: { type: Type.ARRAY, items: { type: Type.STRING } },
                adsDescriptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                socialPosts: {
                  type: Type.OBJECT,
                  properties: {
                    twitter: { type: Type.STRING },
                    linkedin: { type: Type.STRING },
                    facebook: { type: Type.STRING }
                  },
                  required: ["twitter", "linkedin", "facebook"]
                },
                videoCreative: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    veoScript: { type: Type.STRING },
                    visualStoryboard: { type: Type.STRING }
                  },
                  required: ["title", "veoScript", "visualStoryboard"]
                },
                seoOutline: { type: Type.STRING }
              },
              required: ["adsHeadlines", "adsDescriptions", "socialPosts", "videoCreative", "seoOutline"]
            },
            leadCapture: {
              type: Type.OBJECT,
              properties: {
                landingPageCopy: {
                  type: Type.OBJECT,
                  properties: {
                    headline: { type: Type.STRING },
                    subheading: { type: Type.STRING },
                    valueProps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    faqs: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          q: { type: Type.STRING },
                          a: { type: Type.STRING }
                        },
                        required: ["q", "a"]
                      }
                    },
                    cta: { type: Type.STRING }
                  },
                  required: ["headline", "subheading", "valueProps", "faqs", "cta"]
                },
                chatbotScript: {
                  type: Type.OBJECT,
                  properties: {
                    greeting: { type: Type.STRING },
                    questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    scoreRouting: { type: Type.STRING }
                  },
                  required: ["greeting", "questions", "scoreRouting"]
                },
                quizSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    questions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          questionText: { type: Type.STRING },
                          optionsList: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["questionText", "optionsList"]
                      }
                    }
                  },
                  required: ["title", "questions"]
                }
              },
              required: ["landingPageCopy", "chatbotScript", "quizSchema"]
            },
            nurtureEngine: {
              type: Type.OBJECT,
              properties: {
                emailSequence: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      subject: { type: Type.STRING },
                      body: { type: Type.STRING },
                      delay: { type: Type.STRING }
                    },
                    required: ["subject", "body", "delay"]
                  }
                },
                smsFollowups: { type: Type.ARRAY, items: { type: Type.STRING } },
                scoringLogic: { type: Type.STRING }
              },
              required: ["emailSequence", "smsFollowups", "scoringLogic"]
            },
            optimizationEngine: {
              type: Type.OBJECT,
              properties: {
                abTests: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      hypothesis: { type: Type.STRING },
                      metric: { type: Type.STRING }
                    },
                    required: ["name", "hypothesis", "metric"]
                  }
                },
                seoAudit: { type: Type.STRING },
                analyticsSimulatorRules: { type: Type.STRING }
              },
              required: ["abTests", "seoAudit", "analyticsSimulatorRules"]
            }
          },
          required: ["trafficEngine", "leadCapture", "nurtureEngine", "optimizationEngine"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/support-sentiment", async (req, res) => {
  try {
    const { issue } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      let intensity = 40;
      let classification = "Neutral";
      const lowerIssue = issue.toLowerCase();
      if (lowerIssue.includes("broken") || lowerIssue.includes("fail") || lowerIssue.includes("frustrated") || lowerIssue.includes("error") || lowerIssue.includes("slow") || lowerIssue.includes("cancel") || lowerIssue.includes("crash")) {
        intensity = 88;
        classification = "Negative";
      }
      return res.json({ intensity, classification });
    }
    
    const ai = getGeminiClient();
    const systemPrompt = "You are an empathetic CX support specialist. Analyze this support ticket, classify the sentiment (Positive, Neutral, Negative) and rate distress intensity (0 to 100). Return strictly JSON: { intensity: number, classification: 'Positive' | 'Neutral' | 'Negative' }";
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: issue,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intensity: { type: Type.INTEGER },
            classification: { type: Type.STRING }
          },
          required: ["intensity", "classification"]
        }
      }
    });
    const result = JSON.parse(response.text || "{}");
    res.json({ intensity: result.intensity, classification: result.classification });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/support-portal-chat", async (req, res) => {
  try {
    const { message, customer } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      const customerName = customer ? customer.name : "Valued Member";
      const currentTier = customer ? customer.tier : "Free";
      const activeTicketsStr = (mockSupportTickets.filter(t => t.customer_id === customer?.uid && (t.status as string) !== "Resolved"))
        .map(t => `${t.ticket_id} (Issue: ${t.issue.substring(0, 40)}...)`)
        .join(", ");
      
      let answer = `Hello ${customerName}! I am your empathetic virtual assistant. I see you are on our ${currentTier} tier. `;
      if (activeTicketsStr) {
        answer += `Regarding your active ticket reference: [${activeTicketsStr}], I will immediately sync with engineering to expedite. I've noted your distress level and escalated it with your dedicated success rep: ${customer?.assignedRep || 'Danielle Gold'}.`;
      } else {
        answer += `Your enterprise workspaces look perfectly operational under SLA guidelines. How else can I assist you with catalog setups, developer sandboxes, or billing details?`;
      }
      return res.json({ answer });
    }
    
    const ai = getGeminiClient();
    const activeTickets = mockSupportTickets.filter(t => t.customer_id === customer?.uid);
    const clientContext = {
      name: customer?.name,
      email: customer?.email,
      tier: customer?.tier,
      assignedRep: customer?.assignedRep,
      activeTickets
    };
    
    const systemPrompt = `You are an empathetic customer concierge. You are context-aware and know the customer profile details: ${JSON.stringify(clientContext)}. Be highly helpful, address their concerns friendly, and offer precise developer troubleshooting tips.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: { systemInstruction: systemPrompt }
    });
    res.json({ answer: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/support-portal-faq", async (req, res) => {
  try {
    const { catalog, customer } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MOCK_KEY" || apiKey === "") {
      const fallbackGuide = `### Personalized Troubleshooting FAQ For: ${catalog.toUpperCase()}\n\n` +
        `#### 1. How do I authenticate my client workspace inside ${catalog}?\n` +
        `Confirm your client API keys are properly loaded in the header. For ${customer?.tier || 'Enterprise'} tier members, tasks are routed directly to elite high-performance regional bounds.\n\n` +
        `#### 2. Resolving low-latency webhook drop bounds on ${catalog}\n` +
        `Ensure your server respects standard keep-alive guidelines. If messages drop under high workload volumes, check your SOC2 analytics logs to balance concurrent events.\n\n` +
        `#### 3. Where can I find billing invoices and credit status?\n` +
        `Check with your dedicated representative, ${customer?.assignedRep || 'Danielle Gold'}, to dispatch invoice records to: ${customer?.email || 'your registered company email'}.`;
      return res.json({ faq: fallbackGuide });
    }
    
    const ai = getGeminiClient();
    const systemPrompt = `You are a professional empathetic support engineer. Generate a highly personalized troubleshooting troubleshooting guide/FAQ based on the customer catalog option: '${catalog}' and their active account details: Name=${customer?.name}, Tier=${customer?.tier}, Email=${customer?.email}. Produce a crisp Markdown structure with headings, bullet points, and helpful developer steps.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate personalized troubleshooting FAQ for ${catalog}`,
      config: { systemInstruction: systemPrompt }
    });
    res.json({ faq: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Primary Server-Side Gemini endpoint
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { prompt, mode, customerContext, useSearch, googleCalendarToken } = req.body;

    let systemInstruction = "You are the Executive Revenue Intelligence Engine for a Next-Gen CRM. Optimize responses with elegant, structured, high-contrast, data-dense layout tables inside your output. You also have tools to fetch Google Calendar events, create events, and delete events.";
    
    if (mode === "sales") {
      systemInstruction = `You are an AI Sales Agent for CUSTOMER AND MARKETING CRM. 
You focus on lead scoring, follow-up recommendations, upsell pitches, contract values, and deal risk metrics.
We have current client context: ${JSON.stringify(customerContext || {})}.
Produce an amazing structured pitch/analytics response with actionable steps. You can also fetch or create Google Calendar events.`;
    } else if (mode === "marketing") {
      systemInstruction = `You are an AI Marketing Agent. 
You are an expert of ad copies, email campaigns, re-engagement workflows, target segments, and multi-touch attribution. 
Provide creative, targeted campaigns, segmentation tips, or copy draft sequences. You can also fetch or create Google Calendar events.`;
    } else if (mode === "support") {
      systemInstruction = `You are an AI Customer Support Agent with high EQ and deep compliance rules.
Analyze customer complaints carefully. Note sentiment.
Provide a customer ticket response with resolution notes and detailed instructions. You can also fetch or create Google Calendar events.`;
    } else if (mode === "analytics") {
      systemInstruction = `You are an AI Revenue Analytics Specialist. 
Analyze numbers, project LTV, compute risk models, detect pipeline anomalies, and present your findings in beautiful markdown layout format. You can also fetch or create Google Calendar events.`;
    }

    const text = await generateContentWithCalendar(prompt, systemInstruction, googleCalendarToken);
    res.json({ text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to provide a dense context of active CRM databases for specialist agents
function getCRMSummaryContext() {
  const customerCount = mockCustomers.length;
  const campaignCount = mockCampaigns.length;
  const ticketCount = mockSupportTickets.length;
  
  const highRiskCustomers = mockCustomers.filter(c => c.winProbability < 50 || (c.dealRiskStatus && c.dealRiskStatus.toLowerCase().includes("risk")));
  const activeCampaigns = mockCampaigns.filter(c => c.status === "Active");
  const openTickets = mockSupportTickets.filter(t => (t.status as string) !== "Resolved");

  return {
    stats: {
      totalCustomers: customerCount,
      totalCampaigns: campaignCount,
      totalTickets: ticketCount,
      highRiskCount: highRiskCustomers.length,
      activeCampaignsCount: activeCampaigns.length,
      openTicketsCount: openTickets.length
    },
    customersSnippet: mockCustomers.map(c => ({
      name: c.name,
      lifecycleStage: c.lifecycleStage,
      tier: c.tier,
      leadScore: c.leadScore,
      lifetimeValue: c.lifetimeValue,
      dealRiskStatus: c.dealRiskStatus,
      winProbability: c.winProbability,
      assignedRep: c.assignedRep
    })),
    campaignsSnippet: mockCampaigns.map(c => ({
      title: c.title,
      targetSegment: c.targetSegment,
      status: c.status,
      budget: c.budget,
      revenueGenerated: c.revenueGenerated,
      revenueTargetGoal: c.revenueTargetGoal
    })),
    ticketsSnippet: mockSupportTickets.map(t => ({
      customerName: t.customerName,
      issue: t.issue,
      priority: t.priority,
      status: t.status,
      sentiment: t.sentiment
    }))
  };
}

// RESTful AI-Powered Multi-Agent Hub Endpoint 
app.post("/api/agents/hub", async (req, res) => {
  try {
    const { prompt, mode, useSearch, googleCalendarToken } = req.body;
    const dbContext = getCRMSummaryContext();
    const apiKey = process.env.GEMINI_API_KEY;
    const hasApiKey = apiKey && apiKey !== "MOCK_KEY" && apiKey !== "";

    // 1. INTENT ORCHESTRATION & ROUTING STEP
    let targetAgent: "tutor" | "sales" | "marketing" | "support" = "tutor";
    let confidence = 1.0;
    let rationale = "Directly selected by the CRM operator.";

    if (mode === "orchestrator") {
      if (hasApiKey) {
        try {
          const ai = getGeminiClient();
          const classificationPrompt = `
Analyze this CRM operator query:
"${prompt}"

Determine which of the four specialized CRM agents is the single best fit to process this prompt:
- tutor: Choose this for general product training, explanations, guides on how features work, or questions about Firestore simulation and subscription tiers.
- sales: Choose this for prospect leads, pipelines, contract values, upsells, scoring, deal risks, or reps.
- marketing: Choose this for campaigns, newsletter email copies, social posts, coupons, budget goals, or target segment performance.
- support: Choose this for helpdesk issues, customer complaints, FAQ troubleshooting guides, or technical ticket replies.

Respond strictly in this JSON format (no other introduction, formatting, or extra text):
{
  "agent": "tutor" | "sales" | "marketing" | "support",
  "confidence": <number between 0.1 and 1.0>,
  "rationale": "<brief explanation of why this agent was selected>"
}
`;
          const routingResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: classificationPrompt,
            config: { 
              responseMimeType: "application/json",
              temperature: 0.1
            }
          });
          
          const rawJSON = routingResponse.text.trim();
          const parsed = JSON.parse(rawJSON);
          if (parsed && ["tutor", "sales", "marketing", "support"].includes(parsed.agent)) {
            targetAgent = parsed.agent as any;
            confidence = parsed.confidence || 0.9;
            rationale = parsed.rationale || "Automated vector-intent matches.";
          }
        } catch (e: any) {
          console.warn("Orchestrator AI classification failed, falling back to local heuristic routing:", e.message);
          // Fallback to local routing
          const lower = prompt.toLowerCase();
          if (lower.match(/lead|sale|deal|pipeline|prospect|score|contract|pitch|winner|revenue|LTV|money/)) {
            targetAgent = "sales";
            confidence = 0.88;
            rationale = "Heuristic keyword detector identified sales/deal parameters.";
          } else if (lower.match(/campaign|ad|marketing|email|newsletter|promote|segment|clicks|budget|funnel/)) {
            targetAgent = "marketing";
            confidence = 0.92;
            rationale = "Heuristic keyword detector identified campaign/promotional parameters.";
          } else if (lower.match(/ticket|complain|support|cx|issue|frequently|error|bug|resolved|incident|apology|help/)) {
            targetAgent = "support";
            confidence = 0.95;
            rationale = "Heuristic keyword detector identified customer support/incident parameters.";
          } else {
            targetAgent = "tutor";
            confidence = 0.82;
            rationale = "Defaulted to CRM training tutor for general conceptual questions.";
          }
        }
      } else {
        // Direct local heuristic routing (offline mode)
        const lower = prompt.toLowerCase();
        if (lower.match(/lead|sale|deal|pipeline|prospect|score|contract|pitch|winner|revenue|LTV|money/)) {
          targetAgent = "sales";
          confidence = 0.88;
          rationale = "Heuristic keyword matches (lead, sale, pipeline, deal) routed user to Sales Specialist.";
        } else if (lower.match(/campaign|ad|marketing|email|newsletter|promote|segment|clicks|budget|funnel/)) {
          targetAgent = "marketing";
          confidence = 0.92;
          rationale = "Heuristic keyword matches (campaign, ad, marketing, segment) routed user to Marketing Agent.";
        } else if (lower.match(/ticket|complain|support|cx|issue|frequently|error|bug|resolved|incident|apology|help/)) {
          targetAgent = "support";
          confidence = 0.95;
          rationale = "Heuristic keyword matches (ticket, complain, support, issue) routed user to Sentiment Support Agent.";
        } else {
          targetAgent = "tutor";
          confidence = 0.82;
          rationale = "Defaulted to CRM Tutor Agent based on learning & conceptual request signatures.";
        }
      }
    } else {
      // Direct selection mode
      targetAgent = mode as any;
      confidence = 1.0;
      rationale = `Operator manually engaged the specialized [${mode.toUpperCase()} AGENT] view.`;
    }

    // 2. RUN INTEL WORKFLOW FOR THE SELECTED SPECIALIST AGENT
    let systemInstruction = "";
    if (targetAgent === "tutor") {
      systemInstruction = `
You are the CRM Co-Intelligence Tutor Agent. Your goal is to explain and teach the user how to use this advanced CRM!
Knowledge bounds:
- Deal Risk Metrics: Predicts deals at risk (under 50% score) based on last interaction days (>14).
- Firestore Admin: Simulates database mutations, bulk importing CSV spreadsheets, and auditing security rules.
- Marketing Funnel: Automates budget targets (target is roughly budget * 2.5) with simulation of $5k gain increments.
- Transcriber: Multilingual real-time translation with sentiment analytics.
- Pricing Tiers: Trial mode expires in 7 days. Paid plans (Monthly and Yearly) unlock premium models.

Be encouraging, detail-oriented, and write beautiful Markdown responses with clean headings, code snippets, and direct lists.
Active CRM State Statistics for your reference: ${JSON.stringify(dbContext.stats)}
`;
    } else if (targetAgent === "sales") {
      systemInstruction = `
You are the CRM AI Sales Specialist. You analyze deal pipelines, recommend lead qualification scores, and formulate upsell pitches.
Review our live customer list below to formulate hyper-personalized recommendations or pitch outlines. Never invent customers not in the database!
Use actual customer names and stages in your response.

Active Customer Profiles Database:
${JSON.stringify(dbContext.customersSnippet)}

Rules:
- High Risk deals are those with lastInteractionDays > 14 or winProbability < 50.
- Scoring is between 0 and 100.
Always format your output in a professional dashboard style with tabular breakdowns or key deal bullet points!
`;
    } else if (targetAgent === "marketing") {
      systemInstruction = `
You are the CRM AI Marketing Specialist. You compose engaging ad copies, plan email re-engagement cadences, and establish budgets.
Review our active marketing campaigns to suggest concrete steps, review budgets, or draft high-converting templates.

Active Campaigns Database:
${JSON.stringify(dbContext.campaignsSnippet)}

Rules:
- Ensure the user's revenueTargetGoal is approximately 2.5x of campaign budget.
Provide creative, copywriter-grade examples of ad/email/SMS copies with placeholders, custom tones (Professional, Empathetic, Urgency-Driven), and actionable segmentation advice.
`;
    } else if (targetAgent === "support") {
      systemInstruction = `
You are the CRM CX Support Agent. You have exceptionally high EQ, understand compliance boundaries, and resolve customer complaints gracefully.
Review the live ticket pipeline to draft helpful troubleshooting guides or customer support replies.

Support Tickets Pipeline Database:
${JSON.stringify(dbContext.ticketsSnippet)}

Rules:
- Address customers by name, apologize sincerely, offer a compensation or precise fix, and show system validation notes.
`;
    }

    // Prepare response
    let finalOutput = "";
    if (hasApiKey) {
      finalOutput = await generateContentWithCalendar(prompt, systemInstruction, googleCalendarToken);
    } else {
      // Advanced, data-aligned offline response generator to preserve premium UX offline
      if (targetAgent === "tutor") {
        finalOutput = `### 🎓 CRM Tutor: Knowledge Base & Simulation Guide
Welcome to your CRM Guide. I have analyzed our current system configuration:
- **Total active customers**: ${dbContext.stats.totalCustomers} registered
- **Revenue campaigns**: ${dbContext.stats.totalCampaigns} active/draft
- **Troubleshooting tickets**: ${dbContext.stats.totalTickets} tickets open

#### 💡 Interactive FAQ & Best Practices:
1. **How do I simulate a Deal Risk Alert?**
   Navigate to the **AI for Sales** tab. Clicking any customer profile will show their Deal Risk assessment. If **Last Interaction Days > 14**, the CRM Shield triggers an \`AT RISK: Low Contact Speed\` flag. Click "Recalculate Win Probability" to run server-side metrics.
2. **How does the Marketing Revenue Target simulator work?**
   Create a Campaign with a budget, and the system auto-calculates a **2.5x revenue goal**. Once active, click **"➕ Simulate $5k Gain"** to generate deal conversions. When progress reaches 100%, the campaign completes, triggering a \`Completed\` audit trail.
3. **What does the Transcriber do?**
   It allows you to record custom customer audio pitches, runs multilingual voice detection, flags key customer sentiment (Positive, Negative), and auto-creates registered customer profiles in the NoSQL Datastore.

*Note: In local sandbox mode, you can toggle active plans using the header controls.*`;
      } else if (targetAgent === "sales") {
        const topCustomer = dbContext.customersSnippet[0] || { name: "Prospect Node", lifecycleStage: "Lead" as const, leadScore: 65, lifetimeValue: 0, winProbability: 50, assignedRep: "Danielle Gold", tier: "Premium" as const, dealRiskStatus: "Low Risk" };
        const riskList = dbContext.customersSnippet.filter((c: any) => c.winProbability < 50);
        finalOutput = `### 💼 CRM Sales Specialist: Pipeline Intelligence Output
Scanning the sales portfolio (**${dbContext.stats.totalCustomers} customer accounts**):
- **Identified Deals at Risk**: **${dbContext.stats.highRiskCount}** (Win Prob < 50%)

#### 🎯 Prospect Highlight: ${topCustomer.name} (${topCustomer.lifecycleStage})
- **Lead Score**: \`${topCustomer.leadScore}/100\`
- **LTV Value**: \`$${topCustomer.lifetimeValue.toLocaleString()}\`
- **Win Probability**: \`${topCustomer.winProbability}%\`
- **Assigned Account Executive**: \`${topCustomer.assignedRep || "Danielle Gold"}\`

#### 📈 Strategic Qualification Score & Follow-up Plan:
1. **Deal Qualification Score**: **${topCustomer.leadScore > 75 ? "A-Grade" : "B-Grade"}**
2. **Risk Mitigation Recommendation**:
   ${riskList.length > 0 ? `We have ${riskList.length} accounts experiencing stall. For **${riskList[0].name}**, dispatch a custom Migration and Security compliance quote immediately to recover momentum.` : `All current pipelines are running within safe margins (No stale communication thresholds breached).`}
3. **Upsell Script Structure**:
   *"Hello ${topCustomer.name}, as your database capacity grows, upgrading to our full Enterprise Multi-region node unlocks dedicated Firebase sync nodes. We can coordinate an onboarding briefing tomorrow at 10 AM PST."*`;
      } else if (targetAgent === "marketing") {
        const activeCamp = dbContext.campaignsSnippet.find((c: any) => c.status === "Active") || { title: "Golden Wave Re-activation", targetSegment: "Inactive 30 Days", budget: 8500 };
        finalOutput = `### 📢 CRM Marketing Specialist: Ad & Re-engagement Campaign Outline
Configuring brand marketing matrix (**${dbContext.stats.totalCampaigns} registered campaigns**):
- **Revenue generated to date**: \`$${dbContext.campaignsSnippet.reduce((acc, c) => acc + c.revenueGenerated, 0).toLocaleString()}\`

#### ⚡ Creative Ad Draft for Active Segment: \`${activeCamp.targetSegment}\`
**Campaign Title**: ${activeCamp.title} (Targeted Re-engagement)
- **Proposed Budget**: \`$${activeCamp.budget.toLocaleString()}\`
- **Automated Revenue Target**: \`$${(activeCamp.budget * 2.5).toLocaleString()}\`

#### 📝 Optimized Copies:
1. **💼 Professional Email Subject**: *"Synchronize your core databases in real-time - Upgrade inside"*
   - *Body*: "Hi {{Name}}, are manual updates stalling your sales team? With CRM Pro, your NoSQL databases sync immediately so you never miss transactional signups. Start your trial today..."
2. **🚨 Urgency-Driven SMS copy**: *"⏰ Limited Offer: Lock in 30% savings on secure yearly plans with SOC2-certified clusters. Upgrade in 1 click at: [Domain]. Text STOP to opt-out."*
3. **💬 Conversational Social Post**: *"Stop fighting database lag! 🛠️ CRM Pro's sandboxed rule-simulation enables your system managers to test security rules live before shipping. Read the handbook to learn how client-centric dev teams deploy with confidence!"*`;
      } else if (targetAgent === "support") {
        const openTickets = dbContext.ticketsSnippet.filter((t: any) => t.status !== "Resolved");
        const activeTicket = openTickets[0] || { customerName: "Earthy Client", issue: "Database synchronization delay", priority: "High" };
        finalOutput = `### 🤝 Customer Support CX Specialist: Incident & FAQ Resolution
Analyzing helpdesk metrics (**${dbContext.stats.totalTickets} total tickets**, **${dbContext.stats.openTicketsCount} Unresolved**):

#### 🚨 active Incident Resolution: "${activeTicket.issue}"
- **Impacted Account**: \`${activeTicket.customerName}\`
- **Priority Tier**: \`${activeTicket.priority}\`

#### ✉️ Empathetic Customer Apology Copy:
*"Hello ${activeTicket.customerName},*

*Thank you for reaching out to CRM support. We apologize sincerely for the technical delay you encountered during the CSV database sync routine.*

*Our systems team has audited the transaction nodes. We have adjusted socket buffer thresholds on client gateways, allowing your bulk entries to process at maximum rate immediately.*

*Please test committing the CSV once more. If you run into any further validation alerts, our lead administrator Danielle Gold is available for a direct screenshare to verify compliance rule logs.*

*Best Regards,*
*Earthy CRM Support Suite"*`;
      }
    }

    res.json({
      agentUsed: targetAgent,
      confidence: confidence,
      rationale: rationale,
      text: finalOutput
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Email Daily Digest endpoint triggering server-side summarizing routine for enterprise owners

app.post("/api/email-daily-digest", async (req, res) => {
  try {
    const { ownerEmail } = req.body;
    const recipient = ownerEmail || currentUserSession?.email || "operator@company.com";

    // 1. Gather high-risk deals from customer database
    const highRiskDeals = mockCustomers.filter(c => {
      const risk = (c.dealRiskStatus || "").toLowerCase();
      return risk.includes("high") || risk.includes("at risk") || c.winProbability <= 45 || c.lastInteractionDays > 14;
    });

    // 2. Gather active campaigns
    const activeCampaigns = mockCampaigns.filter(camp => camp.status === "Active");

    const ai = getGeminiClient();

    const prompt = `You are the Lead Revenue Operations Analyst & AI Chief Automation Officer.
Process and summarize the following sales and marketing diagnostics:
---
TODAY'S HIGH-RISK DEALS IN JEOPARDY:
${highRiskDeals.length > 0 
  ? highRiskDeals.map(d => `- **${d.name}** (${d.email}): Win Conf: ${d.winProbability}%, Status: "${d.dealRiskStatus}", Days Dormant: ${d.lastInteractionDays}d`).join('\n')
  : "No critical high-risk deals currently active in pipeline."}

ACTIVE CAMPAIGNS UNDER MONITORING:
${activeCampaigns.length > 0
  ? activeCampaigns.map(c => `- **"${c.title}"** (Budget: $${c.budget}): generated ${c.clicks} clicks, ${c.conversations} deals, and $${c.revenueGenerated} in booked pipeline revenue.`).join('\n')
  : "No active marketing campaigns running today."}
---

Your goal is to build a beautiful, high-impact Enterprise Operations Daily Digest briefing email addressed to the enterprise account owner: ${recipient}.
Please format the email beautifully with these exact headers:
- **Subject**: Enter a captivating, highly professional subject line (e.g., [REVENUE INSIGHTS] Enterprise Operations Digest: Critical Pipeline Risks & Campaign Diagnostics)
- **To**: ${recipient}
- **Date**: ${new Date().toLocaleDateString()}
- **Body**: A structured multi-section analysis covering high-risk deals with recommendations, active campaigns tracking, and a sharp checklist of next actionable steps (Owner assignment check-ins) to accelerate pipeline speed. Keep it crisp, clean, and professional.`;

    let digestText = "";
    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
          systemInstruction: "You are the Revenue Intelligence System. Synthesize CRM pipeline alerts into a crisp daily email digest briefing."
        }
      });
      digestText = response.text || "";
    } else {
      // Local fallback template with high-fidelity real details of the active records
      digestText = `Subject: [REVENUE INSIGHTS] Enterprise CRM Daily Digest: Pipeline Hazards & Campaign Growth

To: ${recipient}
Date: ${new Date().toLocaleDateString()}

Dear Enterprise Account Owner,

This is your automated server-side revenue operations digest for today. Below is a detailed summary of high-risk deals in jeopardy and active campaigns currently logged in your CRM:

---

### 🚨 SECTION 1: HIGH-RISK PIPELINE DEALS DEEP DIVE (${highRiskDeals.length} Alerts)
${highRiskDeals.length > 0 
  ? highRiskDeals.map(d => `* **${d.name}** (${d.email})
    - Win Probability: ${d.winProbability}% (CRITICAL)
    - Days Dormant: ${d.lastInteractionDays} days of inactivity
    - Current Threat Category: "${d.dealRiskStatus}"
    - Recommended mitigation: dispatch immediate outreach or auto-escalate owner parameters.`).join('\n\n')
  : "Great news! All active pipelines are currently classified as Low Risk and operating within normal activity constraints."}

---

### 📈 SECTION 2: ACTIVE MARKETING CAMPAIGNS (${activeCampaigns.length} Active)
${activeCampaigns.length > 0
  ? activeCampaigns.map(c => `* **"${c.title}"** (Segment: ${c.targetSegment})
    - Budget allocation: $${c.budget}
    - Click-through analytics: ${c.clicks} clicks
    - Conversions: ${c.conversations} qualified opportunities
    - Booked pipeline revenue: $${c.revenueGenerated.toLocaleString()} (ROI positive)`).join('\n\n')
  : "There are currently no active marketing campaigns running in the pipeline."}

---

### 🛡️ SECTION 3: REVENUE RETENTION IMMEDIATE ACTIONS
1. Re-assign dormant deals exceeding 14 days to high-performing reps.
2. Schedule review of sentiment data on negative customer accounts.
3. Scale active marketing campaigns showing conversions higher than average.

Sincerely,
Revenue Ops Intelligence Engine (AI Console)`;
    }

    addAudit("DAILY_DIGEST_GENERATED", "users", `Daily briefing processed and dispatched to owner: ${recipient}. Analyzed ${highRiskDeals.length} high-risk deals and ${activeCampaigns.length} campaigns.`);

    res.json({
      success: true,
      recipient,
      digestSubject: digestText.includes("Subject:") ? digestText.split("Subject:")[1].split("\n")[0].trim() : `[REVENUE INSIGHTS] Enterprise Operations Digest: PIPELINE_RISK_ALERTS`,
      digestBody: digestText
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

// Cancel active premium tier subscription
app.post("/api/billing/cancel-subscription", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Missing user email parameter." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (userIndex !== -1) {
      mockUsersList[userIndex].plan = "none";
      mockUsersList[userIndex].subscriptionActive = false;
      if (currentUserSession?.email.toLowerCase() === cleanEmail) {
        currentUserSession = mockUsersList[userIndex];
      }
      addAudit("SUBSCRIPTION_CANCELED", "users", `User cancelled active premium tier subscription: ${cleanEmail}`);
      if (db) {
        await setDoc(doc(db, "users", cleanEmail), { plan: "none", hasActiveSubscription: false }, { merge: true });
      }
      res.json({ success: true, user: mockUsersList[userIndex] });
    } else {
      res.status(404).json({ success: false, error: "User profile not found in database." });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1. STRIPE CHECKOUT SESSION CREATION ---
app.post('/api/checkout/create-session', async (req, res) => {
  const { plan, userId } = req.body; // 'monthly' or 'yearly'

  if (!plan || !userId) {
    return res.status(400).json({ error: "Missing plan or userId parameters." });
  }

  const stripe = getStripeClient();
  const cleanEmail = userId.trim().toLowerCase();

  if (!stripe) {
    return res.status(400).json({ error: "Stripe integration is not configured. Please define STRIPE_SECRET_KEY in settings." });
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
      success_url: `${req.headers.origin || "http://localhost:3000"}/?stripe_success=true&plan=${plan}&email=${encodeURIComponent(cleanEmail)}`,
      cancel_url: `${req.headers.origin || "http://localhost:3000"}/?stripe_cancel=true`,
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
    console.error(`❌ Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the specific events enabled in your Stripe dashboard
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      console.log(`💰 Checkout completed for session: ${session.id}`);
      
      const userId = session.client_reference_id || session.customer_email || (session.customer_details && session.customer_details.email);
      const stripeCustomerId = session.customer;
      
      if (userId) {
        const userIndex = mockUsersList.findIndex(u => u.email.toLowerCase() === userId.toLowerCase());
        if (userIndex !== -1) {
          const planSelected = session.metadata?.plan || "monthly";
          mockUsersList[userIndex].plan = planSelected;
          mockUsersList[userIndex].subscriptionActive = true;
          mockUsersList[userIndex].stripeCustomerId = stripeCustomerId;
          mockUsersList[userIndex].subscriptionStartDate = new Date().toISOString();
          
          if (currentUserSession?.email.toLowerCase() === userId.toLowerCase()) {
            currentUserSession = mockUsersList[userIndex];
          }
          
          if (db) {
            try {
              await setDoc(doc(db, "users", userId.toLowerCase()), {
                plan: planSelected,
                subscriptionActive: true,
                stripeCustomerId: stripeCustomerId,
                subscriptionStartDate: mockUsersList[userIndex].subscriptionStartDate
              }, { merge: true });
            } catch (fsErr: any) {
              console.error("Firestore update failed on checkout completed:", fsErr.message);
            }
          }
          
          addAudit("STRIPE_SUBSCRIPTION_SUCCESS", "users", `Stripe Webhook: User ${userId} successfully subscribed under client ID ${stripeCustomerId}`);
        }
      }
      break;
    }

    case 'customer.subscription.created': {
      const subCreated = event.data.object as any;
      console.log(`🆕 Subscription created: ${subCreated.id}`);
      const customerId = subCreated.customer;
      addAudit("STRIPE_SUBSCRIPTION_CREATED", "users", `Stripe Webhook: Subscription created ${subCreated.id} for Stripe Customer ${customerId}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subDeleted = event.data.object as any;
      console.log(`😢 Subscription ended: ${subDeleted.id}`);
      const customerId = subDeleted.customer;
      
      const userIndex = mockUsersList.findIndex(u => u.stripeCustomerId === customerId);
      if (userIndex !== -1) {
        const userId = mockUsersList[userIndex].email;
        mockUsersList[userIndex].plan = "none";
        mockUsersList[userIndex].subscriptionActive = false;
        
        if (currentUserSession?.email.toLowerCase() === userId.toLowerCase()) {
          currentUserSession = mockUsersList[userIndex];
        }
        
        if (db) {
          try {
            await setDoc(doc(db, "users", userId.toLowerCase()), {
              plan: "none",
              subscriptionActive: false
            }, { merge: true });
          } catch (fsErr: any) {
            console.error("Firestore update failed on subscription deleted:", fsErr.message);
          }
        }
        
        addAudit("SUBSCRIPTION_CANCELED", "users", `Stripe Webhook: Subscription canceled for user ${userId}`);
      }
      break;
    }

    case 'invoice.paid': {
      const invoicePaid = event.data.object as any;
      console.log(`✅ Invoice paid: ${invoicePaid.id}`);
      const customerId = invoicePaid.customer;
      
      const userIndex = mockUsersList.findIndex(u => u.stripeCustomerId === customerId);
      if (userIndex !== -1) {
        const userId = mockUsersList[userIndex].email;
        mockUsersList[userIndex].subscriptionActive = true;
        
        if (currentUserSession?.email.toLowerCase() === userId.toLowerCase()) {
          currentUserSession = mockUsersList[userIndex];
        }
        
        if (db) {
          try {
            await setDoc(doc(db, "users", userId.toLowerCase()), {
              subscriptionActive: true
            }, { merge: true });
          } catch (fsErr: any) {
            console.error("Firestore update failed on invoice paid:", fsErr.message);
          }
        }
        
        addAudit("INVOICE_PAID", "users", `Stripe Webhook: Invoice paid for user ${userId}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoiceFailed = event.data.object as any;
      console.log(`⚠️ Invoice payment failed: ${invoiceFailed.id}`);
      const customerId = invoiceFailed.customer;
      
      const userIndex = mockUsersList.findIndex(u => u.stripeCustomerId === customerId);
      if (userIndex !== -1) {
        const userId = mockUsersList[userIndex].email;
        mockUsersList[userIndex].subscriptionActive = false;
        
        if (currentUserSession?.email.toLowerCase() === userId.toLowerCase()) {
          currentUserSession = mockUsersList[userIndex];
        }
        
        if (db) {
          try {
            await setDoc(doc(db, "users", userId.toLowerCase()), {
              subscriptionActive: false
            }, { merge: true });
          } catch (fsErr: any) {
            console.error("Firestore update failed on invoice payment failed:", fsErr.message);
          }
        }
        
        addAudit("INVOICE_PAYMENT_FAILED", "users", `Stripe Webhook: Payment failed for user ${userId}`);
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Lookup function checking status of logged-in trial or subscribed users in mock CRM database
async function checkUserSubscriptionStatus(userId: string): Promise<boolean> {
  let user = mockUsersList.find(u => u.email.toLowerCase() === userId.toLowerCase());
  if (!user && db) {
    try {
      const userDoc = await getDoc(doc(db, "users", userId.toLowerCase()));
      if (userDoc.exists()) {
        user = userDoc.data() as CRMUser;
        mockUsersList.push(user);
      }
    } catch (err) {
      console.error("Failed to read user from Firestore for subscription check:", err);
    }
  }
  if (!user) return false;
  
  // Reuse core validation engine
  const diagnostic = checkUserAccess(user);
  return diagnostic.active;
}

// Master synchronized loader to seat Firestore tables
async function syncFirestoreData() {
  if (!db) {
    console.log("No Firebase database available for synchronization. Continuing with memory backend.");
    return;
  }
  try {
    console.log("Synchronizing Firestore collections...");
    
    // 1. Users
    try {
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      if (usersSnapshot.empty) {
        console.log("Firestore empty: Seeding users...");
        for (const u of mockUsersList) {
          await setDoc(doc(db, "users", u.email.toLowerCase()), u);
        }
      } else {
        const tempUsers: any[] = [];
        usersSnapshot.forEach(docSnap => {
          tempUsers.push(docSnap.data() as any);
        });
        mockUsersList = tempUsers;
      }
    } catch (usersErr) {
      console.warn("Failed to sync users collection from Firestore. Retaining in-memory mock state.", usersErr);
    }

    // 2. Customers
    try {
      const customersCollection = collection(db, "customers");
      const customersSnapshot = await getDocs(customersCollection);
      if (customersSnapshot.empty) {
        console.log("Firestore empty: Seeding customers...");
        for (const c of mockCustomers) {
          await setDoc(doc(db, "customers", c.uid), c);
        }
      } else {
        const tempCustomers: any[] = [];
        customersSnapshot.forEach(docSnap => {
          tempCustomers.push(docSnap.data() as any);
        });
        mockCustomers = tempCustomers;
      }
    } catch (custErr) {
      console.warn("Failed to sync customers collection from Firestore. Retaining in-memory mock state.", custErr);
    }

    // 3. Campaigns
    try {
      const campaignsCollection = collection(db, "marketing_campaigns");
      const campaignsSnapshot = await getDocs(campaignsCollection);
      if (campaignsSnapshot.empty) {
        console.log("Firestore empty: Seeding marketing campaigns...");
        for (const camp of mockCampaigns) {
          await setDoc(doc(db, "marketing_campaigns", camp.campaign_id), camp);
        }
      } else {
        const tempCampaigns: any[] = [];
        campaignsSnapshot.forEach(docSnap => {
          tempCampaigns.push(docSnap.data() as any);
        });
        mockCampaigns = tempCampaigns;
      }
    } catch (campErr) {
      console.warn("Failed to sync campaigns collection from Firestore. Retaining in-memory mock state.", campErr);
    }

    // 4. Support Tickets
    try {
      const ticketsCollection = collection(db, "support_tickets");
      const ticketsSnapshot = await getDocs(ticketsCollection);
      if (ticketsSnapshot.empty) {
        console.log("Firestore empty: Seeding support tickets...");
        for (const ticket of mockSupportTickets) {
          await setDoc(doc(db, "support_tickets", ticket.ticket_id), ticket);
        }
      } else {
        const tempTickets: any[] = [];
        ticketsSnapshot.forEach(docSnap => {
          tempTickets.push(docSnap.data() as any);
        });
        mockSupportTickets = tempTickets;
      }
    } catch (ticketErr) {
      console.warn("Failed to sync support tickets collection from Firestore. Retaining in-memory mock state.", ticketErr);
    }

    // 5. Audit Logs
    try {
      const logsCollection = collection(db, "audit_logs");
      const logsSnapshot = await getDocs(logsCollection);
      if (logsSnapshot.empty) {
        console.log("Firestore empty: Seeding audit logs...");
        for (const log of mockAuditLogs) {
          await setDoc(doc(db, "audit_logs", log.id), log);
        }
      } else {
        const tempLogs: any[] = [];
        logsSnapshot.forEach(docSnap => {
          tempLogs.push(docSnap.data() as any);
        });
        mockAuditLogs = tempLogs;
        mockAuditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch (logErr) {
      console.warn("Failed to sync audit logs collection from Firestore. Retaining in-memory mock state.", logErr);
    }

    console.log("Cloud Firestore CRM database synchronization cycle executed.");
  } catch (err) {
    console.error("Warning: Unhandled error in syncFirestoreData. Falling back to robust in-memory state:", err);
  }
}

// --- 3. UNLOCKED CRM ENDPOINT (REPLACED AS REQUESTED) ---
app.post('/api/generate-content', async (req, res) => {
  const { prompt, userId, googleCalendarToken } = req.body;

  try {
    if (userId) {
      const isSubscribed = await checkUserSubscriptionStatus(userId);
      if (!isSubscribed) {
        return res.status(403).json({ error: "Access Denied. Active subscription required to access premium CRM agents." });
      }
    }

    const systemInstruction = "You are a Premium CRM agent with executive privileges. You have tools to get the current date/time, list calendar events, create calendar events, and delete calendar events on behalf of the user.";
    const result = await generateContentWithCalendar(prompt, systemInstruction, googleCalendarToken);

    res.json({ result });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to generate content." });
  }
});

// --- GITHUB INTEGRATION ENDPOINTS ---

interface GitHubTokenData {
  token: string;
  username: string;
  avatarUrl: string;
  scopes: string[];
  connectedAt: string;
}

const githubTokens: { [email: string]: GitHubTokenData } = {};
const mockCreatedRepos: { [email: string]: Array<{ name: string; description: string; private: boolean; html_url: string }> } = {};

// 1. Get auth URL
app.get('/api/auth/github/url', (req, res) => {
  const email = (req.query.email as string || "").trim().toLowerCase();
  const origin = req.query.origin || req.headers.origin || "http://localhost:3000";
  
  if (!email) {
    return res.status(400).json({ error: "Email parameter is required to initiate connection" });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/github/callback`;

  const stateObj = { email, origin };
  const encodedState = Buffer.from(JSON.stringify(stateObj)).toString("base64");

  if (!clientId || !clientSecret || clientId.trim() === "" || clientSecret.trim() === "") {
    // Missing credentials - redirect to mock simulator
    const simUrl = `${origin}/api/auth/github/simulate?state=${encodedState}`;
    return res.json({ simulated: true, url: simUrl });
  }

  // Real OAuth URL
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,write:repo_hook,public_repo&state=${encodedState}`;
  res.json({ simulated: false, url: authUrl });
});

// 2. Simulated consent screen
app.get('/api/auth/github/simulate', (req, res) => {
  const { state } = req.query;
  res.send(`
    <html>
      <head>
        <title>Authorize CRM-Automation-Engine</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; }
        </style>
      </head>
      <body class="bg-[#0d1117] text-[#c9d1d9] min-h-screen flex items-center justify-center p-4">
        <div class="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-lg p-6 shadow-xl space-y-6">
          <div class="text-center space-y-2">
            <div class="flex justify-center items-center gap-4">
              <span class="text-3xl">🤖</span>
              <span class="text-2xl text-[#8b949e]">⚡</span>
              <svg class="w-10 h-10 text-white fill-current" viewBox="0 0 16 16" version="1.1" aria-hidden="true"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
            </div>
            <h1 class="text-xl font-bold text-white mt-4 font-sans">Authorize CRM-Automation-Engine</h1>
            <p class="text-xs text-[#8b949e]">by <span class="text-white">Akindewum</span> wants to access your GitHub account</p>
          </div>
          <hr class="border-[#30363d]" />
          
          <div class="space-y-4">
            <p class="text-xs text-[#8b949e] font-semibold uppercase tracking-wider">Requested Permissions (Full Write Access):</p>
            <div class="space-y-3">
              <div class="flex gap-3 text-sm">
                <span class="text-[#3fb950] text-lg shrink-0">✓</span>
                <div>
                  <strong class="text-white block">Full repository control (repo, public_repo)</strong>
                  <span class="text-xs text-[#8b949e]">Grant read and write access to code, commit status, repository hooks, and collaborator access for public and private repositories.</span>
                </div>
              </div>
              <div class="flex gap-3 text-sm">
                <span class="text-[#3fb950] text-lg shrink-0">✓</span>
                <div>
                  <strong class="text-white block">Write repository hooks (write:repo_hook)</strong>
                  <span class="text-xs text-[#8b949e]">Create and modify webhooks on your behalf to notify CRM channels of git push events.</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-[#0d1117] p-3 rounded text-[11px] border border-[#30363d] space-y-1 font-mono">
            <div class="text-[#8b949e]">Redirecting to:</div>
            <div class="text-[#58a6ff] truncate">/api/auth/github/callback</div>
          </div>
          
          <div class="flex gap-3 pt-2">
            <button onclick="window.close()" class="flex-1 py-2 px-4 rounded-md border border-[#30363d] text-sm font-medium hover:bg-[#21262d] transition-colors">Cancel</button>
            <button onclick="authorize()" class="flex-1 py-2 px-4 rounded-md bg-[#238636] text-white text-sm font-semibold hover:bg-[#2ea043] transition-colors shadow">Grant Permissions</button>
          </div>
        </div>
        
        <script>
          function authorize() {
            const params = new URLSearchParams(window.location.search);
            const state = params.get('state');
            window.location.href = '/api/auth/github/callback?code=mock_oauth_code_123&state=' + encodeURIComponent(state || '');
          }
        </script>
      </body>
    </html>
  `);
});

// 3. Callback URL
app.get('/api/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send("Authorization code is missing");
  }

  let userEmail = "anonymous";
  let origin = "";
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state as string, "base64").toString("utf-8"));
      userEmail = decoded.email || "anonymous";
      origin = decoded.origin || "";
    }
  } catch (e) {
    console.error("Failed to parse OAuth state:", e);
  }

  let accessToken = "";
  let errorMsg = "";
  let githubUser: any = null;

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (code === "mock_oauth_code_123" || !clientId || !clientSecret || clientId.trim() === "" || clientSecret.trim() === "") {
    // Handle mockup simulation login
    accessToken = "mock_github_access_token_abc123xyz";
    githubUser = {
      login: "sandbox-developer",
      avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4" // GitHub Octocat logo!
    };
  } else {
    // Real oauth code exchange
    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          state
        })
      });
      const tokenData = await tokenResponse.json() as any;
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
      } else {
        errorMsg = tokenData.error_description || tokenData.error || "Failed to exchange token";
      }
    } catch (err: any) {
      errorMsg = err.message || "Failed to fetch access token";
    }

    if (accessToken) {
      try {
        const userProfileResponse = await fetch("https://api.github.com/user", {
          headers: {
            "Authorization": `token ${accessToken}`,
            "User-Agent": "CRM-Automation-App"
          }
        });
        if (userProfileResponse.ok) {
          githubUser = await userProfileResponse.json();
        } else {
          errorMsg = "Failed to fetch user profile from GitHub API";
        }
      } catch (err: any) {
        errorMsg = err.message || "Connection error retrieving profile";
      }
    }
  }

  const success = !!accessToken && !!githubUser;
  if (success && githubUser) {
    const githubData: GitHubTokenData = {
      token: accessToken,
      username: githubUser.login,
      avatarUrl: githubUser.avatar_url,
      scopes: ["repo", "write:repo_hook", "public_repo"],
      connectedAt: new Date().toISOString()
    };
    githubTokens[userEmail.toLowerCase()] = githubData;
    if (db) {
      await setDoc(doc(db, "users", userEmail.toLowerCase()), { github: githubData }, { merge: true });
    }
    addAudit("GITHUB_CONNECTED", "users", `Connected GitHub account: ${githubUser.login} for operator ${userEmail}`);
  }

  // Render popup response script to close popup and notify page
  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'GITHUB_OAUTH_SUCCESS', 
              success: ${success}, 
              error: "${errorMsg}" 
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>GitHub authorization complete. This window should close automatically.</p>
      </body>
    </html>
  `);
});

// 4. Get connected profile
app.get('/api/github/profile', async (req, res) => {
  const email = (req.query.email as string || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (githubTokens[email]) {
    return res.json({ connected: true, ...githubTokens[email] });
  }

  if (db) {
    try {
      const userSnap = await getDoc(doc(db, "users", email));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.github) {
          githubTokens[email] = userData.github;
          return res.json({ connected: true, ...userData.github });
        }
      }
    } catch (err) {
      console.error("Failed to fetch github from Firestore:", err);
    }
  }

  res.json({ connected: false });
});

// 5. Disconnect GitHub
app.post('/api/github/disconnect', async (req, res) => {
  const email = (req.body.email as string || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  delete githubTokens[email];
  if (db) {
    try {
      await setDoc(doc(db, "users", email), { github: null }, { merge: true });
    } catch (err) {
      console.error("Failed to remove github in Firestore:", err);
    }
  }

  addAudit("GITHUB_DISCONNECTED", "users", `Disconnected GitHub account for operator ${email}`);
  res.json({ success: true });
});

// 6. Get repositories
app.get('/api/github/repos', async (req, res) => {
  const email = (req.query.email as string || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  let connection = githubTokens[email];
  if (!connection && db) {
    try {
      const userSnap = await getDoc(doc(db, "users", email));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.github) {
          githubTokens[email] = userData.github;
          connection = userData.github;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!connection) {
    return res.status(401).json({ error: "GitHub account not connected" });
  }

  const isMock = connection.token.startsWith("mock_");
  if (isMock) {
    const list = [
      { name: "customer-marketing-campaigns", description: "Storage for AI generated CRM campaigns and drafts", private: false, html_url: `https://github.com/${connection.username}/customer-marketing-campaigns` },
      { name: "telemetry-leads-backup", description: "Weekly backups of marketing automation segments", private: true, html_url: `https://github.com/${connection.username}/telemetry-leads-backup` },
      ...(mockCreatedRepos[email] || [])
    ];
    return res.json({ repos: list });
  }

  try {
    const reposResponse = await fetch("https://api.github.com/user/repos?type=owner&sort=updated", {
      headers: {
        "Authorization": `token ${connection.token}`,
        "User-Agent": "CRM-Automation-App"
      }
    });
    if (reposResponse.ok) {
      const repos = await reposResponse.json() as any[];
      const formatted = repos.map(r => ({
        name: r.name,
        description: r.description,
        private: r.private,
        html_url: r.html_url
      }));
      res.json({ repos: formatted });
    } else {
      res.status(reposResponse.status).json({ error: "Failed to fetch repositories from GitHub" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Create repository
app.post('/api/github/create-repo', async (req, res) => {
  const { email, name, description, isPrivate } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Email and repository name are required" });
  }
  const cleanEmail = email.trim().toLowerCase();

  let connection = githubTokens[cleanEmail];
  if (!connection && db) {
    try {
      const userSnap = await getDoc(doc(db, "users", cleanEmail));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.github) {
          githubTokens[cleanEmail] = userData.github;
          connection = userData.github;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!connection) {
    return res.status(401).json({ error: "GitHub account not connected" });
  }

  const isMock = connection.token.startsWith("mock_");
  if (isMock) {
    const newRepo = {
      name: name.trim().toLowerCase().replace(/\s+/g, "-"),
      description: description || "",
      private: !!isPrivate,
      html_url: `https://github.com/${connection.username}/${name.trim().toLowerCase().replace(/\s+/g, "-")}`
    };
    if (!mockCreatedRepos[cleanEmail]) {
      mockCreatedRepos[cleanEmail] = [];
    }
    mockCreatedRepos[cleanEmail].push(newRepo);
    addAudit("GITHUB_REPO_CREATED", "users", `Created simulated GitHub repository: ${newRepo.name}`);
    return res.json({ success: true, repo: newRepo });
  }

  try {
    const createResponse = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        "Authorization": `token ${connection.token}`,
        "User-Agent": "CRM-Automation-App",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description || "Created via Customer & Marketing CRM",
        private: !!isPrivate,
        auto_init: true
      })
    });

    if (createResponse.ok) {
      const r = await createResponse.json() as any;
      const formatted = {
        name: r.name,
        description: r.description,
        private: r.private,
        html_url: r.html_url
      };
      addAudit("GITHUB_REPO_CREATED", "users", `Created GitHub repository: ${formatted.name}`);
      res.json({ success: true, repo: formatted });
    } else {
      const errData = await createResponse.json() as any;
      res.status(createResponse.status).json({ error: errData.message || "Failed to create repository" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Push File (Write permissions!)
app.post('/api/github/push-file', async (req, res) => {
  const { email, repo, path: filePath, content, message } = req.body;
  if (!email || !repo || !filePath || !content) {
    return res.status(400).json({ error: "Missing required parameters (email, repo, path, content)" });
  }
  const cleanEmail = email.trim().toLowerCase();

  let connection = githubTokens[cleanEmail];
  if (!connection && db) {
    try {
      const userSnap = await getDoc(doc(db, "users", cleanEmail));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.github) {
          githubTokens[cleanEmail] = userData.github;
          connection = userData.github;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!connection) {
    return res.status(401).json({ error: "GitHub account not connected" });
  }

  const isMock = connection.token.startsWith("mock_");
  if (isMock) {
    addAudit("GITHUB_FILE_PUSHED", "users", `Simulated write permission: successfully committed file '${filePath}' to '${repo}'`);
    return res.json({ 
      success: true, 
      simulated: true,
      commit: {
        sha: "mock_commit_sha_88f9a0c1",
        html_url: `https://github.com/${connection.username}/${repo}/commit/mock_commit_sha_88f9a0c1`
      }
    });
  }

  try {
    const owner = connection.username;
    // Check if file already exists to retrieve its current SHA
    let sha: string | undefined = undefined;
    try {
      const existingResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        headers: {
          "Authorization": `token ${connection.token}`,
          "User-Agent": "CRM-Automation-App"
        }
      });
      if (existingResponse.ok) {
        const existingData = await existingResponse.json() as any;
        sha = existingData.sha;
      }
    } catch (err) {
      // Ignore
    }

    // Push the file contents
    const putResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers: {
        "Authorization": `token ${connection.token}`,
        "User-Agent": "CRM-Automation-App",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message || `Committed ${filePath} from CRM engine`,
        content: Buffer.from(content).toString("base64"),
        sha
      })
    });

    if (putResponse.ok) {
      const data = await putResponse.json() as any;
      addAudit("GITHUB_FILE_PUSHED", "users", `Successfully committed file '${filePath}' to repository '${repo}'`);
      res.json({
        success: true,
        simulated: false,
        commit: {
          sha: data.commit?.sha || "unknown",
          html_url: data.commit?.html_url || `https://github.com/${owner}/${repo}`
        }
      });
    } else {
      const errData = await putResponse.json() as any;
      res.status(putResponse.status).json({ error: errData.message || "Failed to commit file to GitHub" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Configure Vite middleware in development
async function startServer() {
  await syncFirestoreData();

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
