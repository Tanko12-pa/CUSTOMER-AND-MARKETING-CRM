import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  Receipt, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  AlertTriangle, 
  Download, 
  ExternalLink,
  ShieldAlert,
  Calendar,
  DollarSign,
  Sparkles,
  Github,
  GitBranch,
  GitCommit,
  FolderPlus,
  Plus,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BillingManagementProps {
  currentUser: any;
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  onRefreshStates: () => Promise<void>;
}

export function BillingManagement({ 
  currentUser, 
  setCurrentUser, 
  showToast,
  onRefreshStates 
}: BillingManagementProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeInvoiceStatement, setActiveInvoiceStatement] = useState<any | null>(null);

  // --- GITHUB INTEGRATION STATES & HANDLERS ---
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubProfile, setGithubProfile] = useState<any>(null);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubRepoLoading, setGithubRepoLoading] = useState(false);
  const [activeRepo, setActiveRepo] = useState("");
  const [showCreateRepoModal, setShowCreateRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [createRepoLoading, setCreateRepoLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushMessage, setTestPushMessage] = useState("Setup initial telemetry backups from CRM platform");
  const [testPushPath, setTestPushPath] = useState("backups/crm-audit-test.json");
  const [testPushContent, setTestPushContent] = useState(JSON.stringify({ 
    platform: "Customer & Marketing CRM",
    telemetryState: "Healthy",
    writePermissionsGranted: true,
    timestamp: new Date().toISOString()
  }, null, 2));

  // Fetch GitHub connection status
  const fetchGithubProfile = async () => {
    if (!currentUser?.email) return;
    setGithubLoading(true);
    try {
      const response = await fetch(`/api/github/profile?email=${encodeURIComponent(currentUser.email)}`);
      const data = await response.json();
      if (data.connected) {
        setGithubConnected(true);
        setGithubProfile(data);
        // Fetch repositories
        fetchGithubRepos();
      } else {
        setGithubConnected(false);
        setGithubProfile(null);
        setGithubRepos([]);
      }
    } catch (err) {
      console.error("Failed to fetch GitHub profile:", err);
    } finally {
      setGithubLoading(false);
    }
  };

  const fetchGithubRepos = async () => {
    if (!currentUser?.email) return;
    setGithubRepoLoading(true);
    try {
      const response = await fetch(`/api/github/repos?email=${encodeURIComponent(currentUser.email)}`);
      if (response.ok) {
        const data = await response.json();
        setGithubRepos(data.repos || []);
        if (data.repos && data.repos.length > 0 && !activeRepo) {
          setActiveRepo(data.repos[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch GitHub repos:", err);
    } finally {
      setGithubRepoLoading(false);
    }
  };

  useEffect(() => {
    fetchGithubProfile();
  }, [currentUser?.email]);

  const handleConnectGithub = async () => {
    try {
      const email = currentUser?.email || "anonymous";
      const origin = window.location.origin;
      const response = await fetch(`/api/auth/github/url?email=${encodeURIComponent(email)}&origin=${encodeURIComponent(origin)}`);
      if (!response.ok) {
        throw new Error("Failed to retrieve authorization URL");
      }
      const { url, simulated } = await response.json();
      
      if (simulated) {
        showToast("Developer API keys missing in settings. Activating Sandbox Simulator.", "info");
      } else {
        showToast("Redirecting to GitHub with write:repo_hook and repo permissions...", "info");
      }

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const authWindow = window.open(
        url,
        "github_oauth_popup",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
      );

      if (!authWindow) {
        showToast("Popup blocked by browser. Please enable popups to authenticate GitHub.", "error");
      }
    } catch (error: any) {
      console.error("GitHub connection error:", error);
      showToast(error.message || "Failed to start GitHub authentication", "error");
    }
  };

  // Listen for popup message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        if (event.data.success) {
          showToast("Successfully authenticated with GitHub! Write permissions active.", "success");
          fetchGithubProfile();
          onRefreshStates(); // Sync system audit logs
        } else {
          showToast(`GitHub connection failed: ${event.data.error || "Unknown Error"}`, "error");
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentUser?.email]);

  const handleDisconnectGithub = async () => {
    if (!window.confirm("Disconnect GitHub account? Your write credentials will be purged.")) return;
    try {
      const response = await fetch('/api/github/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser?.email })
      });
      if (response.ok) {
        showToast("GitHub account disconnected.", "success");
        setGithubConnected(false);
        setGithubProfile(null);
        setGithubRepos([]);
        onRefreshStates();
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to disconnect GitHub.", "error");
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    setCreateRepoLoading(true);
    try {
      const response = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser?.email,
          name: newRepoName.trim(),
          description: newRepoDesc,
          isPrivate: newRepoPrivate
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast(`Created repository ${data.repo.name} successfully!`, "success");
        setShowCreateRepoModal(false);
        setNewRepoName("");
        setNewRepoDesc("");
        setNewRepoPrivate(false);
        await fetchGithubRepos();
        setActiveRepo(data.repo.name);
        onRefreshStates();
      } else {
        showToast(data.error || "Failed to create repository", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error creating repository", "error");
    } finally {
      setCreateRepoLoading(false);
    }
  };

  const handleTestPush = async () => {
    if (!activeRepo) {
      showToast("Please select a repository first.", "error");
      return;
    }
    setTestPushLoading(true);
    try {
      const response = await fetch('/api/github/push-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser?.email,
          repo: activeRepo,
          path: testPushPath,
          content: testPushContent,
          message: testPushMessage
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast(`Successfully committed '${testPushPath}' to ${activeRepo}!`, "success");
        onRefreshStates();
      } else {
        showToast(data.error || "Failed to commit file", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error committing file", "error");
    } finally {
      setTestPushLoading(false);
    }
  };

  // Generate dynamic invoice list based on current user plan
  const mockInvoices = [
    {
      id: "INV-2026-1042",
      date: "2026-06-01",
      amount: currentUser.plan === "yearly" ? "$199.99" : "$19.99",
      status: currentUser.subscriptionActive ? "Paid" : "Failed",
      method: "Card ending in 4242",
      item: currentUser.plan === "yearly" ? "Enterprise Yearly Subscription" : "Pro Monthly Subscription"
    },
    {
      id: "INV-2026-1031",
      date: "2026-05-01",
      amount: "$19.99",
      status: "Paid",
      method: "Card ending in 4242",
      item: "Pro Monthly Subscription"
    },
    {
      id: "INV-2026-1018",
      date: "2026-04-01",
      amount: "$19.99",
      status: "Paid",
      method: "Card ending in 4242",
      item: "Pro Monthly Subscription"
    }
  ].filter(inv => {
    // Hidden if they are only trialing or have never paid
    if (currentUser.plan === "trial" || (!currentUser.subscriptionActive && currentUser.plan === "none")) {
      return false; // Return empty invoice history
    }
    // Only show current year invoice if yearly subscription
    if (currentUser.plan === "yearly") {
      return inv.id === "INV-2026-1042";
    }
    return true;
  });

  const handleCreateStripeSession = async (plan: "monthly" | "yearly") => {
    setLoading(plan);
    try {
      showToast(`Initiating secure Stripe Checkout for Pro ${plan} tier...`, "info");
      const response = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId: currentUser.email }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect directly to Stripe Secure Checkout
      } else if (data.error) {
        showToast(data.error, "error");
      } else {
        showToast("Unable to establish Stripe connections. Check API registers.", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("Server communication breakdown on Stripe module.", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm("Are you absolutely sure you want to cancel your CRM Pro subscription? You will lose unlimited access to our executive AI Agents after your current cycle ends.")) {
      return;
    }
    setLoading("cancel");
    try {
      const response = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email }),
      });
      const data = await response.json();
      if (data.success) {
        setCurrentUser((prev: any) => ({
          ...prev,
          plan: "none",
          active: false,
          subscriptionActive: false,
          trialDaysLeft: 0
        }));
        showToast("Premium subscription cancelled successfully.", "success");
        await onRefreshStates();
      } else {
        showToast(data.error || "Failed to cancel subscription.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to connect to billing server.", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6" id="billing-management-workspace">
      {/* 1. STATE INSIGHT HERO CARD */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/5 rounded-bl-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider block">Membership & Licensing</span>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#C5A059]" />
              Self-Serve Subscription Control Tower
            </h2>
            <p className="text-sm text-[#A1A1AA] max-w-xl">
              Audit license terms, view historic ledger statements, toggle tiers, or initiate cancel requests directly synced with custom Stripe rules.
            </p>
          </div>
          <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl px-5 py-3 text-right">
            <span className="text-xs text-[#71717A] block">Current Plan Status</span>
            <div className="flex items-center gap-2 mt-1 justify-end">
              <span className={`w-2.5 h-2.5 rounded-full ${currentUser.subscriptionActive ? "bg-emerald-500 animate-pulse" : currentUser.active ? "bg-amber-400" : "bg-red-500"}`} />
              <strong className="text-white capitalize font-mono text-base tracking-wide">
                {currentUser.plan === "none" ? "No Plan" : currentUser.plan || "Standard Pro"}
              </strong>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1 font-mono">
              Workspace Owner: {currentUser.email}
            </span>
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#27272A]/80">
          <div className="bg-[#0A0A0B]/60 p-3.5 rounded-xl border border-[#27272A]/40">
            <span className="text-[10px] text-[#71717A] uppercase block font-mono">Pricing Term</span>
            <span className="text-sm text-white font-bold block mt-1">
              {currentUser.plan === "yearly" ? "$199.99 / Year" : currentUser.plan === "monthly" ? "$19.99 / Month" : currentUser.plan === "trial" ? "7-Day Free Evaluation" : "$0.00 / Idle"}
            </span>
          </div>
          <div className="bg-[#0A0A0B]/60 p-3.5 rounded-xl border border-[#27272A]/40">
            <span className="text-[10px] text-[#71717A] uppercase block font-mono">Authorization Level</span>
            <span className="text-sm text-white font-bold block mt-1 flex items-center gap-1.5">
              {currentUser.subscriptionActive ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Unlimited SOC2 Pro
                </>
              ) : currentUser.active ? (
                <>
                  <Calendar className="w-4 h-4 text-amber-400" /> Active Trial ({Math.ceil(currentUser.trialDaysLeft)}d Left)
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-500" /> Telemetry Suspended
                </>
              )}
            </span>
          </div>
          <div className="bg-[#0A0A0B]/60 p-3.5 rounded-xl border border-[#27272A]/40">
            <span className="text-[10px] text-[#71717A] uppercase block font-mono">Renewal Indicator</span>
            <span className="text-sm text-[#A1A1AA] font-mono block mt-1">
              {currentUser.subscriptionActive ? "Auto-renews dynamically" : "Trial limits apply"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CHOOSE PLANS OR UPGRADE TIERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* MONTHLY TIER PANEL */}
        <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden transition-all duration-300 hover:border-[#C5A059]/30">
          {currentUser.plan === "monthly" && (
            <div className="absolute top-3 right-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider font-mono">
              Active Member
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Pro Monthly Suite</h3>
              <p className="text-xs text-[#A1A1AA]">Best value for nimble enterprise builders requiring sandbox access.</p>
            </div>
            <div className="flex items-baseline space-x-1 py-1">
              <span className="text-3xl font-extrabold text-white font-mono">$19.99</span>
              <span className="text-xs text-[#71717A] font-medium font-mono">/ month</span>
            </div>
            
            <div className="border-t border-[#27272A]/60 pt-4">
              <ul className="text-xs space-y-2.5 text-[#E4E4E7]">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Unlimited NoSQL Firestore mutations simulation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Five executive server-side AI specialists (Gemini)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Interactive sales win-rates & pipeline velocity logic</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Secure automated real-time audit trails</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => handleCreateStripeSession("monthly")}
            disabled={currentUser.plan === "monthly" || loading !== null}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              currentUser.plan === "monthly"
                ? "bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed"
                : "bg-white hover:bg-neutral-200 text-[#0A0A0B] font-extrabold shadow-lg shadow-white/5 active:scale-[0.98]"
            }`}
          >
            {loading === "monthly" ? "Connecting Stripe..." : currentUser.plan === "monthly" ? "Active License" : "Upgrade Monthly"}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* YEARLY TIER PANEL - GOLD EDITION */}
        <div className="bg-[#141416] border-2 border-[#C5A059]/40 rounded-2xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden transition-all duration-300 hover:border-[#C5A059]/80 shadow-2xl">
          <div className="absolute -right-12 -top-1 px-14 py-2 rotate-45 bg-[#C5A059] text-[#0A0A0B] text-[8px] font-black tracking-widest uppercase font-mono shadow-md">
            Save 17%
          </div>
          {currentUser.plan === "yearly" && (
            <div className="absolute top-3 right-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider font-mono">
              Active Member
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#C5A059] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C5A059]" />
                Pro Yearly Ultimate
              </h3>
              <p className="text-xs text-[#A1A1AA]">Engineered for full annual compliance control and high throughput limiters.</p>
            </div>
            <div className="flex items-baseline space-x-1 py-1">
              <span className="text-3xl font-extrabold text-white font-mono">$199.99</span>
              <span className="text-xs text-[#71717A] font-medium font-mono">/ year</span>
            </div>

            <div className="border-t border-[#27272A]/60 pt-4">
              <ul className="text-xs space-y-2.5 text-[#E4E4E7]">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Everything listed under Pro Monthly</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Priority fast-track server-side Gemini tokens</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Unlimited bulk CSV imports & NoSQL auditing</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Dedicated compliance executive support SLA channel</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => handleCreateStripeSession("yearly")}
            disabled={currentUser.plan === "yearly" || loading !== null}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              currentUser.plan === "yearly"
                ? "bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed"
                : "bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-extrabold shadow-lg shadow-[#C5A059]/10 active:scale-[0.98]"
            }`}
          >
            {loading === "yearly" ? "Connecting Stripe..." : currentUser.plan === "yearly" ? "Active License" : "Upgrade Yearly"}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* 3. INVOICES HISTORY TRACKER */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-xl overflow-hidden">
        <div className="border-b border-[#27272A] px-5 py-4 flex items-center justify-between">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#C5A059]" />
            Statement History Ledger
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            Generated billing events
          </span>
        </div>

        {mockInvoices.length === 0 ? (
          <div className="p-8 text-center text-[#71717A] space-y-2">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800/80 flex items-center justify-center mx-auto">
              <Receipt className="w-4 h-4 text-zinc-700" />
            </div>
            <p className="text-xs">No active paid statements registered under this operator profile yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#27272A]/60 text-[#71717A] font-mono uppercase text-[9px] bg-[#0A0A0B]/40">
                  <th className="px-5 py-3">Invoice ID</th>
                  <th className="px-5 py-3">Billing Cycle</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Payment State</th>
                  <th className="px-5 py-3 text-center">Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]/40">
                {mockInvoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-zinc-900/20">
                    <td className="px-5 py-3.5 font-mono text-white font-medium">{inv.id}</td>
                    <td className="px-5 py-3.5 text-[#A1A1AA]">{inv.date}</td>
                    <td className="px-5 py-3.5 text-[#A1A1AA] font-mono">{inv.item}</td>
                    <td className="px-5 py-3.5 text-white font-mono font-bold">{inv.amount}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 font-bold ${inv.status === "Paid" ? "text-emerald-400" : "text-rose-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${inv.status === "Paid" ? "bg-emerald-400" : "bg-rose-400"}`} />
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button 
                        onClick={() => setActiveInvoiceStatement(inv)}
                        className="px-2 py-1 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white border border-[#333] hover:border-[#444] rounded text-[10px] cursor-pointer transition-all inline-flex items-center gap-1 font-medium font-sans"
                      >
                        <Download className="w-3 h-3" /> View Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. DEVELOPER INTEGRATIONS CONSOLE */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-xl overflow-hidden" id="github-developer-ecosystem">
        <div className="border-b border-[#27272A] px-5 py-4 flex items-center justify-between bg-[#141416]">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <Github className="w-4 h-4 text-[#C5A059]" />
            GitHub Developer Ecosystem
          </span>
          <span className="bg-[#C5A059]/10 border border-[#C5A059]/20 text-[#C5A059] text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
            Write Permissions Enabled
          </span>
        </div>

        {githubLoading ? (
          <div className="p-12 text-center text-[#71717A] space-y-3">
            <Loader2 className="w-6 h-6 text-[#C5A059] animate-spin mx-auto" />
            <p className="text-xs font-mono">Synchronizing connection states with GitHub services...</p>
          </div>
        ) : !githubConnected ? (
          <div className="p-8 text-center max-w-xl mx-auto space-y-5">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto shadow-inner">
              <Github className="w-6 h-6 text-zinc-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white font-sans">Connect GitHub Integration</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Unlock automated exports, commit generated markdown marketing campaigns, backup system database telemetry, or register secure repository commit-webhooks.
              </p>
            </div>

            <div className="bg-[#0A0A0B] border border-[#27272A] p-4 rounded-xl text-left space-y-2.5">
              <span className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono block">Requested Authorization Scopes</span>
              <ul className="text-[11px] space-y-2 text-[#A1A1AA] font-sans">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">repo</strong> (Full control of private & public repositories)
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">write:repo_hook</strong> (Full permissions to edit & deploy repository webhooks)
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">public_repo</strong> (Write public repositories, pull/commit content)
                  </div>
                </li>
              </ul>
            </div>

            <button
              onClick={handleConnectGithub}
              className="px-5 py-2.5 bg-white text-[#0A0A0B] font-extrabold hover:bg-neutral-200 border border-transparent rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Github className="w-4 h-4" />
              Connect GitHub Account
            </button>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Connection Credentials Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-4">
                <span className="text-[10px] text-[#71717A] uppercase tracking-wider font-mono block">Connection Profile</span>
                
                <div className="flex items-center gap-3">
                  <img 
                    src={githubProfile?.avatarUrl || "https://github.com/identicons/dummy.png"} 
                    alt="GitHub Avatar" 
                    className="w-12 h-12 rounded-xl border border-[#27272A] bg-zinc-800"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    {githubProfile?.username ? (
                      <h4 className="text-sm font-bold text-white font-sans">
                        <a
                          href={`https://github.com/${encodeURIComponent(githubProfile.username)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${githubProfile.username}'s GitHub profile (opens in a new tab)`}
                          className="inline-flex items-center gap-1.5 hover:text-[#C5A059] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C5A059]"
                        >
                          {githubProfile.username}
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      </h4>
                    ) : (
                      <h4 className="text-sm font-bold text-white font-sans">GitHub account connected</h4>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono block">Connected: {githubProfile?.connectedAt ? new Date(githubProfile.connectedAt).toLocaleDateString() : "Active"}</span>
                  </div>
                </div>

                <div className="border-t border-[#27272A]/80 pt-3 space-y-2">
                  <span className="text-[9px] text-[#71717A] uppercase tracking-wider font-mono block">Active Session Token Scopes</span>
                  <div className="flex flex-wrap gap-1.5">
                    {githubProfile?.scopes?.map((scope: string) => (
                      <span key={scope} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-mono text-zinc-400">
                        {scope}
                      </span>
                    )) || (
                      <>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-mono text-zinc-400">repo</span>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-mono text-zinc-400">write:repo_hook</span>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-mono text-zinc-400">public_repo</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleDisconnectGithub}
                    className="w-full py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 hover:border-red-500 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Disconnect Integration
                  </button>
                </div>
              </div>

              <div className="bg-[#0A0A0B]/60 border border-[#27272A]/40 rounded-xl p-4 text-[11px] text-[#A1A1AA] leading-relaxed space-y-1.5">
                <span className="text-[9px] text-[#71717A] uppercase tracking-wider font-mono block">Developer Notice</span>
                <p>
                  Because this application is operating in a secure preview container sandbox, write operations are channeled via the authorized API gateway. All transaction audits are saved into Firestore.
                </p>
              </div>
            </div>

            {/* Repository and Write Actions Card */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#71717A] uppercase tracking-wider font-mono">Target Repository Settings</span>
                  <button
                    onClick={() => setShowCreateRepoModal(true)}
                    className="px-2 py-1 bg-zinc-900 hover:bg-[#C5A059] hover:text-[#0A0A0B] text-[#C5A059] border border-zinc-800 hover:border-transparent rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3 h-3" /> Create New Repo
                  </button>
                </div>

                {githubRepoLoading ? (
                  <div className="py-6 text-center text-zinc-500 text-[11px] font-mono flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#C5A059] animate-spin" />
                    Querying repository index...
                  </div>
                ) : githubRepos.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-[11px] space-y-2">
                    <p>No active repositories linked to this account found.</p>
                    <button
                      onClick={() => setShowCreateRepoModal(true)}
                      className="px-3 py-1.5 bg-[#C5A059] text-[#0A0A0B] font-bold text-[10px] uppercase rounded-lg cursor-pointer"
                    >
                      Initialize Sandbox Repo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 font-sans">
                    <div>
                      <label className="text-[10px] text-zinc-500 font-mono block mb-1">Select Connected Repository</label>
                      <select
                        value={activeRepo}
                        onChange={(e) => setActiveRepo(e.target.value)}
                        className="w-full bg-[#141416] border border-[#27272A] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#C5A059] font-mono"
                      >
                        {githubRepos.map((r: any) => (
                          <option key={r.name} value={r.name}>
                            {r.name} {r.private ? "🔒 (Private)" : "🌐 (Public)"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="border-t border-[#27272A]/80 pt-3 space-y-3">
                      <span className="text-[10px] text-[#71717A] uppercase tracking-wider font-mono block">Verify Commit & Write Permissions</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-zinc-500 font-mono block mb-0.5">Commit Commit Path</label>
                          <input 
                            type="text" 
                            value={testPushPath}
                            onChange={(e) => setTestPushPath(e.target.value)}
                            className="w-full bg-[#141416] border border-[#27272A] rounded-lg p-1.5 text-[11px] text-white focus:outline-none focus:border-[#C5A059] font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-zinc-500 font-mono block mb-0.5">Commit message</label>
                          <input 
                            type="text" 
                            value={testPushMessage}
                            onChange={(e) => setTestPushMessage(e.target.value)}
                            className="w-full bg-[#141416] border border-[#27272A] rounded-lg p-1.5 text-[11px] text-white focus:outline-none focus:border-[#C5A059]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] text-zinc-500 font-mono block mb-0.5">File Content Payload (JSON / Plain text)</label>
                        <textarea
                          rows={4}
                          value={testPushContent}
                          onChange={(e) => setTestPushContent(e.target.value)}
                          className="w-full bg-[#141416] border border-[#27272A] rounded-lg p-2 text-[10px] text-white focus:outline-none focus:border-[#C5A059] font-mono resize-none leading-normal"
                        />
                      </div>

                      <button
                        onClick={handleTestPush}
                        disabled={testPushLoading}
                        className="w-full py-2 bg-[#C5A059] hover:bg-[#C5A059]/90 disabled:bg-zinc-800 disabled:text-zinc-500 text-[#0A0A0B] rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        {testPushLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Committing backup payload...</span>
                          </>
                        ) : (
                          <>
                            <GitCommit className="w-3.5 h-3.5" />
                            <span>Commit Telemetry Backup File</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* CREATE REPO MODAL DIALOG */}
      <AnimatePresence>
        {showCreateRepoModal && (
          <div className="fixed inset-0 bg-[#000]/70 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141416] border border-[#27272A] p-5 rounded-2xl w-full max-w-sm shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                <span className="font-bold text-white text-sm flex items-center gap-1.5 font-sans">
                  <FolderPlus className="w-4 h-4 text-[#C5A059]" />
                  Create GitHub Repository
                </span>
                <button 
                  onClick={() => setShowCreateRepoModal(false)}
                  className="text-zinc-500 hover:text-white font-bold cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateRepo} className="space-y-3.5 text-xs text-left">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-mono block">Repository Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. crm-marketing-vault"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-lg p-2 text-white focus:outline-none focus:border-[#C5A059] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-mono block">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="E.g. System telemetry backups and generated email assets"
                    value={newRepoDesc}
                    onChange={(e) => setNewRepoDesc(e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-lg p-2 text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="newRepoPrivate"
                    checked={newRepoPrivate}
                    onChange={(e) => setNewRepoPrivate(e.target.checked)}
                    className="rounded bg-[#0A0A0B] border-[#27272A] text-[#C5A059] focus:ring-[#C5A059] focus:ring-offset-[#141416]"
                  />
                  <label htmlFor="newRepoPrivate" className="text-[11px] text-[#A1A1AA] cursor-pointer font-sans select-none">
                    Make this repository Private (🔒)
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-[#27272A]/80">
                  <button
                    type="button"
                    onClick={() => setShowCreateRepoModal(false)}
                    className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 font-bold rounded-lg uppercase text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createRepoLoading || !newRepoName}
                    className="px-3.5 py-1.5 bg-[#C5A059] text-[#0A0A0B] font-extrabold rounded-lg uppercase text-[10px] flex items-center gap-1 disabled:opacity-50"
                  >
                    {createRepoLoading ? (
                      <>
                        <Loader2 className="w-3 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>Create Repository</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. DANGER ZONE */}
      {(currentUser.plan === "monthly" || currentUser.plan === "yearly") && (
        <div className="bg-red-955/10 border border-red-900/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <div>
              <h4 className="text-sm font-bold text-red-400">Database Safety & Downgrade Center</h4>
              <p className="text-xs text-[#A1A1AA]">Proceed with caution. Downgrading licenses terminates multi-agent orchestration capability immediately.</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-red-900/20 pt-4">
            <div className="text-xs text-[#A1A1AA] max-w-lg">
              Upon cancellation, your CRM limits revert back to single-user inactive sandbox. Ongoing background campaigns or automated risk recalculation queries will wrap up on the next checkout timestamp.
            </div>
            <button
              onClick={handleCancelSubscription}
              disabled={loading === "cancel"}
              className="py-2 px-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-white border border-red-900/40 hover:border-red-500 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer transition-all active:scale-[0.98]"
            >
              {loading === "cancel" ? "Cancelling..." : "Cancel Subscription"}
            </button>
          </div>
        </div>
      )}

      {/* INVOICE MODAL POPUP */}
      <AnimatePresence>
        {activeInvoiceStatement && (
          <div className="fixed inset-0 bg-[#000]/70 flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141416] border border-[#27272A] p-6 rounded-2xl w-full max-w-md shadow-2xl relative space-y-6 font-sans text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
                <span className="font-bold text-white text-sm flex items-center gap-1">
                  <Receipt className="w-4 h-4 text-[#C5A059]" />
                  CRM Billing Statement
                </span>
                <span className="font-mono text-[10px] text-zinc-500">{activeInvoiceStatement.id}</span>
              </div>

              <div className="space-y-4 font-sans">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Workspace Registered Email</span>
                  <span className="text-white font-mono font-medium">{currentUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Statement Date</span>
                  <span className="text-white font-mono font-medium">{activeInvoiceStatement.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Product Line</span>
                  <span className="text-white font-sans font-medium">{activeInvoiceStatement.item}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Payment Method</span>
                  <span className="text-white font-sans font-medium">{activeInvoiceStatement.method}</span>
                </div>
                <hr className="border-[#27272A]" />
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-white">Total Charge Amount</span>
                  <span className="font-black font-mono text-[#C5A059]">{activeInvoiceStatement.amount} (USD)</span>
                </div>
              </div>

              <div className="flex justify-between items-center bg-[#0A0A0B] p-3 rounded-lg border border-[#27272A]/60">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Ledger Transaction Code</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Charged successfully
                </span>
              </div>

              <div className="flex justify-end gap-3.5">
                <button 
                  onClick={() => setActiveInvoiceStatement(null)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 rounded-xl font-bold cursor-pointer transition-all uppercase text-[10px]"
                >
                  Close Statement
                </button>
                <button 
                  onClick={() => {
                    window.print();
                    showToast("Redirecting statement format to system print channels.", "success");
                  }}
                  className="px-4 py-2 bg-[#C5A059] text-[#0A0A0B] rounded-xl font-black cursor-pointer hover:bg-[#C5A059]/90 transition-all uppercase text-[10px]"
                >
                  Print PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
