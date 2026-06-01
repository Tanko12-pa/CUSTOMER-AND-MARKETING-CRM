import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Megaphone, 
  HeartHandshake, 
  Database, 
  HelpCircle, 
  MessageSquareCode, 
  Mic, 
  RefreshCw, 
  Sparkles, 
  Chrome, 
  User, 
  Lock, 
  TrendingUp, 
  Send,
  Loader2,
  LogOut,
  Terminal,
  Download,
  CheckCircle,
  AlertTriangle,
  Info,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { KPICards } from "./components/KPICards";
import { LifecyclePieChart } from "./components/LifecyclePieChart";
import { PipelineVelocityHistogram } from "./components/PipelineVelocityHistogram";
import { SalesModule } from "./components/SalesModule";
import { MarketingModule } from "./components/MarketingModule";
import { SupportModule } from "./components/SupportModule";
import { AudioTranscriber } from "./components/AudioTranscriber";
import { DatabaseExplorer } from "./components/DatabaseExplorer";
import { SubscriptionGate } from "./components/SubscriptionGate";
import { SystemAuditLogs } from "./components/SystemAuditLogs";
import { MutationsAuditFeed } from "./components/MutationsAuditFeed";
import { AgentHub } from "./components/AgentHub";
import { Customer, Campaign, SupportTicket, AuditLog } from "./types";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// High-fidelity local fallback data in case backend database or sync is unreachable
const FALLBACK_CUSTOMERS: Customer[] = [
  {
    uid: "cust_fallback_1",
    name: "Almaric Vance (Vance Aerospace)",
    email: "almaric@vanceaerospace.com",
    lifecycleStage: "Customer",
    tier: "Enterprise",
    leadScore: 92,
    lifetimeValue: 125000,
    sentiment: "Positive",
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
      { month: "Jan", ltv: 100000 },
      { month: "Feb", ltv: 110000 },
      { month: "Mar", ltv: 125000 }
    ],
    contact: {
      phone: "+1-555-0192",
      company: "Vance Aerospace",
      role: "VP of Avionics Platforms",
      marketingConsent: true,
      trackingConsent: true
    },
    account: {
      company: "Vance Aerospace",
      industry: "Aerospace",
      size: "1,500+ employees",
      region: "North America"
    },
    interactions: [
      {
        id: "int_fallback_1",
        channel: "Video Call",
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        agentOrBot: "Danielle Gold",
        sentiment: "Positive",
        summary: "Q3 alignment session completed. Discussed API latency and telemetry integration."
      }
    ],
    opportunity: {
      stage: "Closed Won",
      value: 125000,
      probability: 100,
      expectedCloseDate: "2026-04-15"
    }
  },
  {
    uid: "cust_fallback_2",
    name: "Genevieve Thorne",
    email: "g.thorne@auroralabs.io",
    lifecycleStage: "Lead",
    tier: "Free",
    leadScore: 78,
    lifetimeValue: 0,
    sentiment: "Neutral",
    lastInteractionDays: 5,
    winProbability: 60,
    assignedRep: "Danielle Gold",
    dealRiskStatus: "Medium Risk",
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    stageHistory: {
      Lead: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    }
  }
];

const FALLBACK_CAMPAIGNS: Campaign[] = [
  {
    campaign_id: "camp_fallback_1",
    title: "Vanguard Launch Promo",
    targetSegment: "Enterprise Aerospace",
    budget: 15000,
    status: "Active",
    clicks: 12402,
    conversations: 1408,
    revenueGenerated: 185000,
    revenueTargetGoal: 200000
  }
];

const FALLBACK_TICKETS: SupportTicket[] = [
  {
    ticket_id: "tick_fallback_1",
    customer_id: "cust_fallback_1",
    customerName: "Almaric Vance (Vance Aerospace)",
    issue: "Experiencing higher API transaction delay limits on workspace catalog endpoints.",
    priority: "High",
    status: "Open",
    sentiment: "Neutral",
    createdAt: new Date().toISOString()
  }
];

const FALLBACK_AUDIT: AuditLog[] = [
  {
    id: "audit_fallback_1",
    timestamp: new Date().toISOString(),
    action: "OFFLINE_FALLBACK_ACTIVE",
    collection: "system",
    user: "system",
    status: "Success",
    details: "Detected offline preview container. Activated high-fidelity localized mock CRM dataset."
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"agents" | "sales" | "marketing" | "support" | "audio" | "database" | "audit">("agents");
  
  // Interactive D3 Pie Chart selected filter
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Unified Toast notification system states
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>([]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };
  
  // Dynamic CRM Core states loaded from Backend
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscription & authorization state variables
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkoutSimulated, setCheckoutSimulated] = useState<{ plan: "monthly" | "yearly"; email: string } | null>(null);
  const [chatMode, setChatMode] = useState<"standard" | "premium">("standard");

  // Gemini assistant chatbot state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "gemini"; text: string }>>([
    { 
      sender: "gemini", 
      text: "Welcome to the Executive Revenue Intelligence suite. Ask me to qualification-score prospects, compose targeted campaigns, or draft incident replies." 
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);

  const handleDownloadChatHistory = () => {
    if (chatMessages.length === 0) return;
    const timestampStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    const operatorEmail = currentUser?.email || "akindewum@gmail.com";
    
    let markdown = `# CRM Revenue Copilot Chat Transcript\n`;
    markdown += `**Exported on (UTC):** ${timestampStr}\n`;
    markdown += `**Operator:** ${operatorEmail}\n\n`;
    markdown += `---\n\n`;
    
    chatMessages.forEach((msg) => {
      const senderName = msg.sender === "gemini" ? "Gemini CRM Agent" : "You";
      markdown += `### ${senderName}\n${msg.text}\n\n`;
    });
    
    markdown += `---\n`;
    markdown += `*Generated by Customer & Marketing CRM Intelligence Console.*\n`;
    
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crm_copilot_transcript_${new Date().toISOString().slice(0, 10)}.md`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    const downloadUrl = url; // clean up declaration
  };

  // Sync state data from Express Server API
  const syncStateData = async () => {
    setLoading(true);
    try {
      if (currentUser && (currentUser.uid || currentUser.email)) {
        try {
          const syncResponse = await fetch('/api/sync-backend-crm-state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: currentUser.uid || currentUser.email })
          });
          const syncData = await syncResponse.json();
          console.log("Backend state synced:", syncData);
        } catch (err) {
          console.error("Failed to sync backend CRM state:", err);
        }
      }

      const response = await fetch("/api/state");
      const data = await response.json();
      setCustomers(data.customers || FALLBACK_CUSTOMERS);
      setCampaigns(data.campaigns || FALLBACK_CAMPAIGNS);
      setTickets(data.supportTickets || FALLBACK_TICKETS);
      setAuditLogs(data.auditLogs || FALLBACK_AUDIT);
    } catch (error) {
      console.warn("Failed to sync backend CRM state from server. Activating client-side in-memory CRM fallback...", error);
      setCustomers(FALLBACK_CUSTOMERS);
      setCampaigns(FALLBACK_CAMPAIGNS);
      setTickets(FALLBACK_TICKETS);
      setAuditLogs(FALLBACK_AUDIT);
    } finally {
      setLoading(false);
    }
  };

  // Auth, trial, and Stripe session triggers
  const handleRegisterTrial = async (name: string, email: string) => {
    console.log("Trial registration handled by client-side Auth module for:", name, email);
  };

  const handleLogin = async (email: string) => {
    console.log("Login handled by client-side Auth module for:", email);
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    try {
      await auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setCheckoutSimulated(null);
    } catch (e) {
      console.error("Logout err:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClearCacheAndCookies = async () => {
    setAuthLoading(true);
    try {
      // 1. Firebase Auth Sign-out
      await auth.signOut();

      // 2. Clear backend user session
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (err) {
        console.warn("Backend state reset endpoint issue:", err);
      }

      // 3. Clear window's localStorage & sessionStorage
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch (err) {
        console.warn("Storage api reset rejected:", err);
      }

      // 4. Clear client-side browser cookies recursively
      try {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        }
      } catch (err) {
        console.warn("Cookies purge rejected:", err);
      }

      showToast("App cookies, cache, and sandbox store successfully purged!", "success");
      
      // Delay slightly for toast visibility and then hard reload the path
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname;
      }, 1000);
    } catch (e) {
      console.error("Purge action failed:", e);
      showToast("Failed to clean client-side state files.", "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectPlan = async (plan: "monthly" | "yearly") => {
    if (!currentUser) return;
    setAuthLoading(true);
    try {
      const response = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId: currentUser.email }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.success && data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error("Billing session link creation err:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirmSubscription = async (email: string, plan: "monthly" | "yearly") => {
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/confirm-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan }),
      });
      const data = await response.json();
      if (data.success && auth.currentUser) {
        // Also update Firestore directly
        const userRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userRef, {
          plan: plan,
          hasActiveSubscription: true
        }, { merge: true });

        setCurrentUser((prev: any) => ({
          ...prev,
          plan: plan,
          active: true,
          subscriptionActive: true
        }));
        setCheckoutSimulated(null);
        await syncStateData();
      }
    } catch (e) {
      console.error("Subscription confirmation error:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSimulateExpiration = async () => {
    if (!currentUser || !currentUser.uid) return;
    setAuthLoading(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        trialExpiresAt: Date.now() - 24 * 3600 * 1000, // Expired 1 day ago
        hasActiveSubscription: false,
        plan: "none"
      }, { merge: true });

      // Clean local state and sync
      await syncStateData();
    } catch (e) {
      console.error("Simulation error:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSimulateRestoreTrial = async () => {
    if (!currentUser || !currentUser.uid) return;
    setAuthLoading(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const trialDuration = 7 * 24 * 60 * 60 * 1000;
      await setDoc(userRef, {
        trialExpiresAt: Date.now() + trialDuration,
        hasActiveSubscription: false,
        plan: "trial"
      }, { merge: true });

      // Sync state and finish
      await syncStateData();
    } catch (e) {
      console.error("Restore trial simulation error:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    // Read and triage query parameters from Stripe Redirect callbacks
    const params = new URLSearchParams(window.location.search);
    const simStripe = params.get("simulated_stripe");
    const plan = params.get("plan") as "monthly" | "yearly";
    const email = params.get("email");

    if (simStripe === "true" && plan && email) {
      setCheckoutSimulated({ plan, email });
    }

    const stripeSuccess = params.get("stripe_success");
    if (stripeSuccess === "true" && plan && email) {
      handleConfirmSubscription(email, plan);
      // Clean query searches after callback
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    syncStateData();

    // Firebase Auth State listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            const trialExpiresAt = data.trialExpiresAt;
            const hasActiveSubscription = data.hasActiveSubscription || data.plan === "monthly" || data.plan === "yearly";
            const isExpired = Date.now() > trialExpiresAt;
            const userPlan = (data.plan as "trial" | "monthly" | "yearly" | "none") || "trial";
            const trialDaysLeft = Math.max(0, (trialExpiresAt - Date.now()) / (1000 * 3600 * 24));

            setCurrentUser({
              email: firebaseUser.email || "guest-operator@company.com",
              name: data.name || firebaseUser.displayName || "Guest Operator",
              uid: firebaseUser.uid,
              trialStartDate: new Date().toISOString(),
              plan: "standard",
              active: true,
              trialDaysLeft: 0,
              subscriptionActive: true
            });
          } else {
            // First time register doc sync fallback
            const trialExpiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000; // 100 years
            const userData = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Guest Operator",
              email: firebaseUser.email || "guest-operator@company.com",
              trialExpiresAt: trialExpiresAt,
              hasActiveSubscription: true,
              plan: "standard"
            };
            await setDoc(userRef, userData);
            setCurrentUser({
              email: userData.email,
              name: userData.name,
              uid: firebaseUser.uid,
              trialStartDate: new Date().toISOString(),
              plan: "standard",
              active: true,
              trialDaysLeft: 0,
              subscriptionActive: true
            });
          }
        } catch (err) {
          console.error("Firestore user sync error:", err);
          setCurrentUser(null);
        } finally {
          setAuthLoading(false);
        }
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Post changes to state server
  const handleUpdateState = async (type: string, payload: any) => {
    try {
      const response = await fetch("/api/update-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload })
      });
      const data = await response.json();
      if (data.success) {
        setCustomers(data.customers);
        setCampaigns(data.campaigns);
        setTickets(data.supportTickets);
        setAuditLogs(data.auditLogs);
      }
    } catch (e) {
      console.error("Failed to mutate database state:", e);
    }
  };

  // Trigger win probability / risk calculation route
  const handleTriggerIntelligence = async (payload: { uid: string; dealValue: number; lastInteractionDays: number }) => {
    try {
      const response = await fetch("/api/revenue-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.status === "Success") {
        setCustomers(data.customers);
        setAuditLogs(data.auditLogs);
      }
    } catch (e) {
      console.error("Failed to execute revenue intelligence calculation:", e);
    }
  };

  // Premium subscription-gated AI generator requested by user
  const generateAIContent = async (userPrompt: string, userId: string) => {
    const response = await fetch('/api/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: userPrompt, userId })
    });

    if (response.status === 403) {
      showToast("You need an active subscription to perform this action.", "error");
      return;
    }

    const data = await response.json();
    return data.result;
  };

  // General Chatbot submit
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);

    try {
      if (chatMode === "premium") {
        const userId = currentUser?.email || "akindewum@gmail.com";
        const result = await generateAIContent(userMsg, userId);
        if (result) {
          setChatMessages(prev => [...prev, { sender: "gemini", text: result }]);
        } else {
          // If 403 or failure occurred and result was undefined, we append a helpful guide
          setChatMessages(prev => [...prev, { sender: "gemini", text: "Subscription verification failed. Upgrade your account using the pricing panel to use Premium features." }]);
        }
      } else {
        const response = await fetch("/api/gemini/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: userMsg,
            mode: "analytics",
            useSearch: useSearchGrounding
          })
        });
        const data = await response.json();
        setChatMessages(prev => [...prev, { sender: "gemini", text: data.text }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: "gemini", text: "I ran into a connection anomaly analyzing telemetry. Please verify server endpoints." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070708] text-[#E4E4E7] flex flex-col items-center justify-center space-y-4 font-sans" id="subscription-preloading-loader">
        <Loader2 className="w-10 h-10 text-[#C5A059] animate-spin" />
        <p className="text-[#A1A1AA] font-mono text-xs uppercase tracking-widest animate-pulse font-bold">
          Checking CRM Credentials...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <SubscriptionGate
        onRegisterTrial={handleRegisterTrial}
        onLogin={handleLogin}
        onSelectPlan={handleSelectPlan}
        currentUser={currentUser}
        checkoutSimulated={checkoutSimulated}
        onConfirmSimulatedSubscription={handleConfirmSubscription}
        loading={authLoading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] flex flex-col font-sans" id="crm-app-root">
      
      {/* CRM STATUS HEADER CONTROLLER BANNER */}
      <div className="bg-[#121214] border-b border-[#27272A] text-xs px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 font-sans relative z-10" id="crm-sandbox-header">
        <div className="flex items-center space-x-2">
          <span className="shrink-0 p-1 bg-[#C5A059]/10 text-[#C5A059] rounded-lg">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <span className="text-[#E4E4E7] font-medium font-sans">
            Active Operator: <strong className="text-white font-mono">{currentUser.email}</strong>
          </span>
          <span className="text-[#71717A] font-mono font-medium">|</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 px-2 py-0.5 rounded-full font-bold font-mono text-[10px] uppercase">
            ⭐ Standard Plan: Unlimited Workspace Enabled
          </span>
        </div>

        {/* Sandbox Dev Console Simulator controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleClearCacheAndCookies}
            className="bg-amber-950/20 hover:bg-amber-950/40 text-amber-500 hover:text-amber-400 border border-amber-900/40 px-2.5 py-1 rounded cursor-pointer text-[10px] font-mono transition-colors flex items-center gap-1"
            title="Clean all caches, local storage, session storage and cookies from this app"
          >
            <Trash2 className="w-3 h-3" /> Clear Cache & Cookies
          </button>
          <button
            onClick={handleLogout}
            className="bg-[#141416] hover:bg-white/5 text-[#A1A1AA] hover:text-white px-2.5 py-1 rounded border border-[#27272A] cursor-pointer text-[10px] font-mono transition-colors flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> Log Out
          </button>
        </div>
      </div>
      
      {/* BRAND HEADER & EXECUTIVE METRICS BANNER */}
      <header className="bg-[#050505] text-[#E4E4E7] border-b border-[#27272A] py-5 px-6 relative" id="crm-luxury-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 bg-[#0A0A0B] border border-[#C5A059]/30 rounded-2xl overflow-hidden shadow-md flex items-center justify-center shrink-0">
              <img 
                src="/src/assets/images/crm_growth_logo_1780197622333.png" 
                alt="CUSTOMER AND MARKETING CRM Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-display tracking-tight uppercase text-white flex items-center gap-1.5">
                Customer & Marketing CRM
                <span className="text-xs bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/30 font-bold font-sans px-2 py-0.5 rounded-full uppercase ml-1.5 normal-case tracking-normal">
                  Pro Engine v3.5
                </span>
              </h1>
              <p className="text-xs text-[#A1A1AA] font-mono mt-0.5">
                Secured Workspace Node // Admin auth: <span className="underline">akindewum@gmail.com</span>
              </p>
            </div>
          </div>

          {/* Quick Info & Sync Status Button */}
          <div className="flex items-center space-x-3 self-end md:self-auto">
            <button
              onClick={syncStateData}
              className="bg-[#141416] hover:bg-white/5 text-[#E4E4E7] font-mono text-xs px-3 py-2 rounded-xl flex items-center space-x-1.5 transition-all border border-[#27272A] cursor-pointer"
              id="sync-state-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sync Cloud State</span>
            </button>
            <div className="bg-[#C5A059]/10 border border-[#C5A059]/30 px-3 py-1.5 rounded-xl flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse"></span>
              <span className="text-[10px] uppercase font-bold text-[#C5A059] font-mono leading-none">Firebase active</span>
            </div>
          </div>

        </div>
      </header>

      {/* CORE KPI CARDS & ANALYTICS CLUSTER */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6" id="dashboard-analytics-region">
        <KPICards customers={customers} campaigns={campaigns} tickets={tickets} logs={auditLogs} />

        {/* PIPELINE DATA VISUALIZER DISPLAY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <LifecyclePieChart 
              customers={customers} 
              selectedStage={selectedStage} 
              onSelectStage={(stage) => {
                setSelectedStage(stage);
                if (stage) {
                  showToast(`Pipeline filter active: Isolated ${stage} stage accounts.`, "info");
                } else {
                  showToast("Cleared active pipeline filter.", "info");
                }
              }} 
            />
          </div>
          <div className="lg:col-span-4 bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl flex flex-col justify-between" id="pipeline-active-velocity-card">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
                <h3 className="text-sm font-bold text-[#E4E4E7] tracking-tight">Active Pipeline Velocity</h3>
              </div>
              <p className="text-[10px] text-[#C5A059] font-mono uppercase">Real-time Lead Progression</p>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Pipeline stages represent lifecycle tracking nodes from initial interaction to won enterprise customer accounts. Filters configured in the distribution monitor automatically sync with CRM workspaces.
              </p>
              
              <div className="space-y-3.5 pt-2">
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                    <span>Conversion Target Velocity</span>
                    <span className="text-[#C5A059] font-bold">78%</span>
                  </div>
                  <div className="w-full bg-[#1c1c1e] h-2 rounded-full overflow-hidden border border-[#27272A]">
                    <div className="bg-[#C5A059] h-full rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                    <span>MQL to SQL Progression</span>
                    <span className="text-[#8B5CF6] font-bold">64%</span>
                  </div>
                  <div className="w-full bg-[#1c1c1e] h-2 rounded-full overflow-hidden border border-[#27272A]">
                    <div className="bg-[#8B5CF6] h-full rounded-full" style={{ width: '64%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#27272A]/40 pt-4 mt-6 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-mono">
                SLA Compliance Metrics
              </span>
              <span className="text-[10px] text-emerald-500 font-mono font-bold uppercase">
                Synced
              </span>
            </div>
          </div>
        </div>

        {/* COMPLEMENTARY PIPELINE VELOCITY HISTOGRAMS */}
        <PipelineVelocityHistogram customers={customers} />
      </div>

      {/* MAIN DIVISION: BUTTON PANEL NAV & ACTIVE SCREEN GRID */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8" id="crm-primary-main-region">
        
        {/* TAB BUTTONS PANEL (LEFT COLUMN / COLUMN 3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[#141416] p-4.5 rounded-2xl border border-[#27272A] shadow-xl animate-fade-in" id="tab-buttons-panel">
            <h3 className="text-xs font-bold text-[#A1A1AA] uppercase tracking-widest mb-3 px-1.5 font-sans">Applet Control Panel</h3>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => setActiveTab("agents")}
                className={`w-full text-left p-3.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-all duration-300 cursor-pointer ${activeTab === "agents" ? "bg-[#0A0A0B] border-l-4 border-[#C5A059] text-[#C5A059] shadow-md" : "bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#E4E4E7]"}`}
              >
                <MessageSquareCode className="w-4 h-4 shrink-0 text-[#C5A059]" />
                <span>AI Co-Intelligence Hub</span>
              </button>

              <button
                onClick={() => setActiveTab("sales")}
                className={`w-full text-left p-3.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-all duration-300 cursor-pointer ${activeTab === "sales" ? "bg-[#0A0A0B] border-l-4 border-[#C5A059] text-[#0A0A0B] shadow-md" : "bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#E4E4E7]"}`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span>AI for Sales</span>
              </button>

              <button
                onClick={() => setActiveTab("marketing")}
                className={`w-full text-left p-3.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-all duration-300 cursor-pointer ${activeTab === "marketing" ? "bg-[#0A0A0B] border-l-4 border-[#C5A059] text-[#C5A059] shadow-md" : "bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#E4E4E7]"}`}
              >
                <Megaphone className="w-4 h-4 shrink-0" />
                <span>AI for Marketing</span>
              </button>

              <button
                onClick={() => setActiveTab("support")}
                className={`w-full text-left p-3.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-all duration-300 cursor-pointer ${activeTab === "support" ? "bg-[#0A0A0B] border-l-4 border-[#C5A059] text-[#C5A059] shadow-md" : "bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#E4E4E7]"}`}
              >
                <HeartHandshake className="w-4 h-4 shrink-0" />
                <span>Customer Support (CX)</span>
              </button>

              <button
                onClick={() => setActiveTab("audio")}
                className={`w-full text-left p-3.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-all duration-300 cursor-pointer ${activeTab === "audio" ? "bg-[#0A0A0B] border-l-4 border-[#C5A059] text-[#C5A059] shadow-md" : "bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#E4E4E7]"}`}
              >
                <Mic className="w-4 h-4 shrink-0" />
                <span>Multilingual Transcriber</span>
              </button>

              <button
                onClick={() => setActiveTab("database")}
                className={`w-full text-left p-3.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-all duration-300 cursor-pointer ${activeTab === "database" ? "bg-[#0A0A0B] border-l-4 border-[#C5A059] text-[#C5A059] shadow-md" : "bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#E4E4E7]"}`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>Firestore Admin Console</span>
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`w-full text-left p-3.5 rounded-xl text-sm font-bold flex items-center space-x-3 transition-all duration-300 cursor-pointer ${activeTab === "audit" ? "bg-[#0A0A0B] border-l-4 border-[#C5A059] text-[#C5A059] shadow-md" : "bg-transparent text-[#A1A1AA] hover:bg-white/5 hover:text-[#E4E4E7]"}`}
              >
                <Terminal className="w-4 h-4 shrink-0" />
                <span>System Audit Logs</span>
              </button>
            </div>
          </div>

          {/* INTEGRATED PERSISTENT COPILOT CHATBOT PANEL */}
          <div className="bg-[#141416] rounded-2xl border border-[#27272A] shadow-xl p-4 flex flex-col min-h-[300px]" id="copilot-instant-messenger">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-2 mb-3">
              <span className="text-xs font-bold text-[#A1A1AA] uppercase tracking-widest flex items-center gap-1 font-sans">
                <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                Revenue Copilot
              </span>
              <button
                type="button"
                onClick={handleDownloadChatHistory}
                disabled={chatMessages.length === 0}
                className="flex items-center space-x-1 px-2 py-1 rounded text-[9px] font-mono uppercase bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/30 hover:bg-[#C5A059]/20 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer font-bold shrink-0"
                title="Download Chat History as Markdown"
              >
                <Download className="w-2.5 h-2.5" />
                <span>Download Chat</span>
              </button>
            </div>

            {/* COMPACT SEGMENTED CONTROL */}
            <div className="grid grid-cols-2 gap-1 bg-[#0A0A0B] p-1 rounded-xl mb-3 border border-[#27272A]">
              <button
                type="button"
                onClick={() => setChatMode("standard")}
                className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${chatMode === "standard" ? "bg-[#C5A059] text-[#0A0A0B]" : "text-[#A1A1AA] hover:text-white hover:bg-white/5"}`}
              >
                Standard Chat
              </button>
              <button
                type="button"
                onClick={() => setChatMode("premium")}
                className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${chatMode === "premium" ? "bg-[#C5A059] text-[#0A0A0B]" : "text-[#A1A1AA] hover:text-white hover:bg-white/5"}`}
                title="Premium content generation gated by active Stripe subscription"
              >
                <span>Premium AI</span>
                <span className="text-[7px] px-1 py-0.2 bg-red-950/80 text-red-400 rounded border border-red-900 tracking-normal font-mono font-bold leading-none shrink-0">SUBSCRIPTION</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[220px] mb-3 text-xs pr-1 font-sans">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`p-2.5 rounded-xl leading-relaxed ${msg.sender === "gemini" ? "bg-[#0A0A0B] text-[#E4E4E7] border border-[#27272A]" : "bg-[#C5A059] text-[#0A0A0B] ml-6 font-medium"}`}>
                  <strong className="block uppercase text-[9px] mb-0.5 opacity-60">
                    {msg.sender === "gemini" ? "Gemini CRM Agent" : "You"}
                  </strong>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="p-2.5 rounded-xl bg-[#0A0A0B] text-[#A1A1AA] italic animate-pulse border border-[#27272A]">
                  Gemini thinking...
                </div>
              )}
            </div>

            <form onSubmit={handleSendChat} className="space-y-2">
              <div className="flex items-center space-x-1.5">
                <input
                  type="checkbox"
                  id="ground-search"
                  checked={useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="rounded accent-[#C5A059] text-xs h-3 w-3 cursor-pointer"
                />
                <label htmlFor="ground-search" className="text-[10px] text-[#A1A1AA] cursor-pointer select-none font-mono">
                  Ground via Google Search
                </label>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder={chatMode === "premium" ? "🔑 Premium prompt (tests subscription status)..." : "Ask and learn client stats..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-[#E4E4E7] focus:border-[#C5A059] outline-none pr-10"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="absolute right-2 top-1.5 p-1 bg-[#C5A059] text-[#0A0A0B] rounded-lg hover:bg-[#C5A059]/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ACTIVE SCREEN WORKSPACE (RIGHT COLUMN / COLUMN 9) */}
        <div className="lg:col-span-9" id="crm-workspace-viewer">
          {loading ? (
            <div className="bg-[#141416] rounded-2xl shadow-xl p-12 text-center border border-[#27272A] min-h-[400px] flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[#A1A1AA] font-mono text-sm leading-none">Initializing CRM NoSQL Datastore Schema...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full"
              >
                {activeTab === "agents" && (
                  <AgentHub 
                    customers={customers} 
                    campaigns={campaigns} 
                    tickets={tickets} 
                    onUpdateState={handleUpdateState} 
                  />
                )}

                {activeTab === "sales" && (
                  <div className="space-y-4">
                    {selectedStage && (
                      <div className="bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-xl p-3.5 flex justify-between items-center text-xs animate-fade-in">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
                          <span className="text-[#E4E4E7] font-medium">
                            Isolating Pipeline Stage: <strong className="text-[#C5A059] font-bold uppercase">{selectedStage}</strong> ({customers.filter(c => c.lifecycleStage === selectedStage).length} accounts)
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedStage(null)}
                          className="px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase bg-[#C5A059]/20 hover:bg-[#C5A059]/30 text-[#C5A059] border border-[#C5A059]/40 rounded-lg transition-all cursor-pointer font-mono"
                        >
                          Clear Filter [×]
                        </button>
                      </div>
                    )}
                    <SalesModule 
                      customers={selectedStage ? customers.filter(c => c.lifecycleStage === selectedStage) : customers} 
                      onUpdateState={handleUpdateState} 
                      onTriggerIntelligence={handleTriggerIntelligence} 
                    />
                  </div>
                )}

                {activeTab === "marketing" && (
                  <MarketingModule 
                    campaigns={campaigns} 
                    onUpdateState={handleUpdateState} 
                  />
                )}

                {activeTab === "support" && (
                  <SupportModule 
                    tickets={tickets} 
                    customers={customers}
                    onUpdateState={handleUpdateState} 
                    showToast={showToast}
                  />
                )}

                {activeTab === "audio" && (
                  <AudioTranscriber 
                    onUpdateState={handleUpdateState} 
                    customers={customers} 
                    showToast={showToast}
                  />
                )}

                {activeTab === "database" && (
                  <DatabaseExplorer 
                    customers={customers} 
                    campaigns={campaigns} 
                    tickets={tickets} 
                    logs={auditLogs}
                    onUpdateState={handleUpdateState} 
                    showToast={showToast}
                  />
                )}

                {activeTab === "audit" && (
                  <SystemAuditLogs 
                    logs={auditLogs}
                    onRefresh={syncStateData}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

      </main>

      {/* Real-Time Database Mutations & Audit Logs component */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        <MutationsAuditFeed logs={auditLogs} onRefresh={syncStateData} />
      </div>

      {/* FOOTER CO-DESIGN INFORMATION */}
      <footer className="bg-[#050505] border-t border-[#27272A] py-6 px-4 text-center mt-auto text-xs text-[#A1A1AA] font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span>CUSTOMER AND MARKETING CRM © 2026 // CO-INTELLIGENCE PROTOCOL ACTIVE</span>
          <div className="flex space-x-4">
            <span className="flex items-center gap-1">🛡️ SOC2 Verified</span>
            <span className="flex items-center gap-1">🔒 GDPR Compliant</span>
            <span className="flex items-center gap-1">📦 Firestore Sandbox enabled</span>
          </div>
        </div>
      </footer>

      {/* Unified Toast Notification Overlay */}
      <div 
        className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full"
        id="unified-toast-overlay-container"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ scale: 0.9, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: -15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={`p-4 rounded-xl shadow-2xl border flex items-center space-x-3 pointer-events-auto bg-zinc-900/95 backdrop-blur border-[#27272A] ${
                toast.type === "success"
                  ? "border-emerald-500/40 text-emerald-300"
                  : toast.type === "error"
                  ? "border-red-500/40 text-red-300"
                  : "border-[#C5A059]/40 text-[#E4E4E7]"
              }`}
            >
              {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
              {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-[#C5A059] shrink-0" />}
              <div className="flex-1 text-xs font-semibold leading-relaxed font-sans">
                {toast.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
