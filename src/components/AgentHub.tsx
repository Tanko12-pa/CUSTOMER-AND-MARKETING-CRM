import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Database, 
  ArrowRight, 
  Award, 
  VolumeX, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  BadgeCent,
  BookOpen,
  LifeBuoy,
  Cpu,
  Workflow,
  Download,
  Terminal,
  RefreshCw,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AgentHubProps {
  customers: any[];
  campaigns: any[];
  tickets: any[];
  onUpdateState: (type: string, payload: any) => Promise<void>;
}

interface Message {
  sender: "user" | "agent";
  agentType?: string;
  confidence?: number;
  rationale?: string;
  text: string;
}

export function AgentHub({ customers, campaigns, tickets, onUpdateState }: AgentHubProps) {
  const [activeTab, setActiveTab2] = useState<"orchestrator" | "tutor" | "sales" | "marketing" | "support">("orchestrator");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "agent",
      agentType: "orchestrator",
      text: "Hello! I am the CRM Orchestrator Agent. Ask me anything, or toggle specifically to Tutor, Sales, Marketing, or Support specialists. I will direct your needs automatically to the appropriate AI node and fetch coordinates from our Firestore datastore.",
      confidence: 1.0,
      rationale: "Orchestration controller bootstrap initialization successful."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [lastRouteTrace, setLastRouteTrace] = useState<{
    route: string;
    confidence: number;
    rationale: string;
    timestamp: string;
    tokens?: number;
  } | null>(null);

  // Suggested prompt quick triggers
  const suggestedPrompts = {
    orchestrator: [
      { text: "Score my lead pipeline and propose an upgrade plan", icon: Cpu },
      { text: "Draft a compensation draft for our highest priority ticket", icon: Zap },
      { text: "How do I trigger the $5k revenue marketing simulator?", icon: BookOpen }
    ],
    tutor: [
      { text: "Explain the live firestore security rule audit simulation", icon: BookOpen },
      { text: "How are Deal Risk probabilities computed server-side?", icon: BookOpen }
    ],
    sales: [
      { text: "Create an custom email pitch sequence for high-value tiers", icon: Cpu },
      { text: "What prospects have win probabilities below 50%?", icon: Cpu }
    ],
    marketing: [
      { text: "Generate an urgency-driven SMS ad copy sequence", icon: BadgeCent },
      { text: "How do I construct budgets with 2.5x revenue targets?", icon: BadgeCent }
    ],
    support: [
      { text: "Draft an apologetic resolution reply for active webhooks errors", icon: LifeBuoy },
      { text: "What support tickets are currently flagged as High Priority?", icon: LifeBuoy }
    ]
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendChat = async (inputPrompt: string) => {
    if (!inputPrompt.trim()) return;
    const userPrompt = inputPrompt;
    setChatInput("");
    setLoading(true);

    // Append user message
    setMessages(prev => [...prev, { sender: "user", text: userPrompt }]);

    try {
      const response = await fetch("/api/agents/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userPrompt,
          mode: activeTab
        })
      });
      const data = await response.json();

      if (response.ok) {
        setMessages(prev => [...prev, {
          sender: "agent",
          agentType: data.agentUsed,
          confidence: data.confidence,
          rationale: data.rationale,
          text: data.text
        }]);

        // Capture audit log trace info
        setLastRouteTrace({
          route: data.agentUsed,
          confidence: data.confidence,
          rationale: data.rationale,
          timestamp: new Date().toLocaleTimeString(),
          tokens: Math.round(data.text.length * 0.35 + userPrompt.length * 0.35 + 230)
        });
      } else {
        setMessages(prev => [...prev, {
          sender: "agent",
          agentType: "orchestrator",
          text: `Endpoint error: ${data.error || "An abnormal response from CRM servers."}`
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        sender: "agent",
        agentType: "orchestrator",
        text: "Database network failure. Ensure Express dev servers are bound correctly."
      }]);
    } finally {
      setLoading(false);
    }
  };

  // MULTI-AGENT CASCADE ACTION
  const [cascadeStep, setCascadeStep] = useState<number>(0);
  const [cascadeLog, setCascadeLog] = useState<string[]>([]);
  const [cascadeSupportOutput, setCascadeSupportOutput] = useState("");
  const [cascadeMarketingOutput, setCascadeMarketingOutput] = useState("");

  const handleTriggerMultiAgentCascade = async () => {
    setCascadeStep(1);
    setCascadeLog(["[Orchestrator] Initializing multi-agent campaign cascade..."]);
    setCascadeSupportOutput("");
    setCascadeMarketingOutput("");

    // Step 1: Scan for high priority open tickets
    await new Promise(resolve => setTimeout(resolve, 800));
    setCascadeStep(2);
    setCascadeLog(prev => [...prev, "[Orchestrator] Detected high-priority unresolved customer tickets.", "[Support Agent] Formulating empathetic compensation resolution copy..."]);
    
    // Call support agent handler
    try {
      const responseSupport = await fetch("/api/agents/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Draft an apologetic webhook delay resolution addressing the client's tier, proposing complimentary database upgrades.",
          mode: "support"
        })
      });
      const dataSupport = await responseSupport.json();
      setCascadeSupportOutput(dataSupport.text);
    } catch {
      setCascadeSupportOutput("Error generating empathetic resolution draft.");
    }

    // Step 2: Trigger Marketing alignment
    await new Promise(resolve => setTimeout(resolve, 1400));
    setCascadeStep(3);
    setCascadeLog(prev => [...prev, "[Support Agent] Response compiled.", "[Orchestrator] Action synchronized. Routing to Marketing Specialist node...", "[Marketing Agent] Generating proactive re-engagement promo copy..."]);

    try {
      const responsePromo = await fetch("/api/agents/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Develop an exclusive re-engagement promotional copy sequence providing 25% off Yearly Pro subscription coupon codes.",
          mode: "marketing"
        })
      });
      const dataPromo = await responsePromo.json();
      setCascadeMarketingOutput(dataPromo.text);
    } catch {
      setCascadeMarketingOutput("Error generating marketing promo sequence.");
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    setCascadeStep(4);
    setCascadeLog(prev => [...prev, "[Marketing Agent] Re-engagement copies successfully paired.", "🏆 [Orchestrator] Multi-agent cascade completes! Outputs logged and attached side-by-side below."]);
  };

  const getAgentColor = (type?: string) => {
    switch (type) {
      case "tutor": return "text-amber-400 border-amber-900/40 bg-amber-950/25";
      case "sales": return "text-[#C5A059] border-[#C5A059]/30 bg-[#C5A059]/10";
      case "marketing": return "text-cyan-400 border-cyan-900/40 bg-cyan-950/25";
      case "support": return "text-emerald-400 border-emerald-900/40 bg-emerald-950/25";
      default: return "text-[#A1A1AA] border-[#27272A] bg-[#141416]/50";
    }
  };

  const getAgentTitle = (type?: string) => {
    switch (type) {
      case "tutor": return "🎓 CRM Tutor Agent";
      case "sales": return "💼 Pipeline Sales Agent";
      case "marketing": return "📢 Marketing Copy Agent";
      case "support": return "🤝 CX Sentiment Support";
      default: return "🧠 Orchestrator Agent";
    }
  };

  const handleDownloadTranscript = () => {
    const timestampStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    let markdown = `# Multi-Agent CRM Co-Intelligence Transcript\n`;
    markdown += `**Exported on (UTC):** ${timestampStr}\n\n`;
    markdown += `| Message Index | Sender | Agent | Confidence | Answer |\n`;
    markdown += `|---|---|---|---|---|\n`;
    
    messages.forEach((msg, idx) => {
      const senderName = msg.sender === "user" ? "CRM Operator" : "Co-Intelligence Agent";
      const agentRole = msg.agentType ? getAgentTitle(msg.agentType) : "N/A";
      const confStr = msg.confidence ? `${(msg.confidence * 100).toFixed(0)}%` : "100%";
      const cleanText = msg.text.replace(/\r?\n/g, " <br> ");
      markdown += `| #${idx + 1} | ${senderName} | ${agentRole} | ${confStr} | ${cleanText} |\n`;
    });
    
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `multi_agent_copilot_transcript.md`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="co-intelligence-agent-hub">
      
      {/* MODULE HEADER */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] rounded-2xl">
              <Workflow className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display uppercase tracking-wide text-white">Agentic Co-Intelligence Sandbox</h2>
              <p className="text-xs text-[#A1A1AA] font-sans">
                Observe the Orchestrator route client queries autonomously to four dedicated workflows, syncing with Firestore data slices.
              </p>
            </div>
          </div>
          
          <button
            onClick={handleDownloadTranscript}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/30 hover:bg-[#C5A059]/20 font-bold transition-all rounded-xl font-mono cursor-pointer shrink-0"
            title="Download multi-agent communication history"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EX PORT TRANSCRIPT</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ARCHITECTURAL DIAGRAM & KNOWLEDGE BASE SNIPPETS (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* ARCHITECTURAL INTERACTIVE DIAGRAM */}
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-4.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#27272A]/80 pb-2 mb-3">
              <h3 className="text-[10px] font-mono tracking-widest font-bold text-[#A1A1AA] uppercase">
                Agent Routing Map & Link Nodes
              </h3>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            </div>

            {/* DIAGRAM CANVAS */}
            <div className="bg-[#0A0A0B] p-4.5 rounded-xl border border-[#27272A] space-y-4 font-mono text-[10px] relative">
              
              {/* Node 1: FRONTEND */}
              <div className="text-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 relative">
                <span className="block font-bold">FRONTEND CLIENT CONSOLE</span>
                <span className="text-[8px] text-zinc-500 font-sans">akindewum@gmail.com</span>
              </div>

              {/* VERTICAL ROUTE CONNECTOR */}
              <div className="flex justify-center h-4">
                <div className="w-0.5 border-dashed border-zinc-800 h-full"></div>
              </div>

              {/* Node 2: ORCHESTRATOR */}
              <div className={`p-2 rounded-xl text-center transition-all ${
                activeTab === "orchestrator" 
                  ? "bg-[#C5A059]/20 border-[#C5A059] text-white shadow-[0_0_12px_rgba(197,160,89,0.3)] scale-[1.03]" 
                  : "bg-zinc-900/60 border-zinc-800/70 text-zinc-400"
              }`}>
                <span className="font-bold flex items-center justify-center gap-1">
                  <Cpu className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
                  ORCHESTRATOR AGENT
                </span>
                <span className="text-[8.5px] text-[#A1A1AA] font-sans">Intent classifier & confidence router</span>
              </div>

              {/* SPLIT HORIZONTAL CONNECTORS */}
              <div className="relative h-4 flex justify-between items-center bg-transparent px-10">
                <div className="absolute top-0 left-[50%] w-0.5 h-4 border-dashed border-zinc-800"></div>
                <div className="w-full absolute left-4 right-4 top-2 h-0.5 border-dashed border-zinc-800"></div>
              </div>

              {/* Node 3 Grid: FOUR SPECIALIST AGENTS */}
              <div className="grid grid-cols-2 gap-2 text-center text-[9px]">
                
                {/* TUTOR */}
                <div className={`p-1.5 rounded-lg border transition-all ${
                  activeTab === "tutor" || (lastRouteTrace?.route === "tutor")
                    ? "bg-amber-950/40 border-amber-500 text-amber-300 font-bold scale-105 shadow-[0_0_8px_rgba(245,158,11,0.25)]" 
                    : "bg-zinc-900/40 border-zinc-800/50 text-zinc-500"
                }`}>
                  <span>🎓 Tutor</span>
                </div>

                {/* SALES */}
                <div className={`p-1.5 rounded-lg border transition-all ${
                  activeTab === "sales" || (lastRouteTrace?.route === "sales")
                    ? "bg-[#C5A059]/20 border-[#C5A059] text-[#C5A059] font-bold scale-105 shadow-[0_0_8px_rgba(197,160,89,0.25)]" 
                    : "bg-zinc-900/40 border-zinc-800/50 text-zinc-500"
                }`}>
                  <span>💼 Sales</span>
                </div>

                {/* MARKETING */}
                <div className={`p-1.5 rounded-lg border transition-all ${
                  activeTab === "marketing" || (lastRouteTrace?.route === "marketing")
                    ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-bold scale-105 shadow-[0_0_8px_rgba(6,182,212,0.25)]" 
                    : "bg-zinc-900/40 border-zinc-800/50 text-zinc-500"
                }`}>
                  <span>📢 Marketing</span>
                </div>

                {/* SUPPORT */}
                <div className={`p-1.5 rounded-lg border transition-all ${
                  activeTab === "support" || (lastRouteTrace?.route === "support")
                    ? "bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold scale-105 shadow-[0_0_8px_rgba(16,185,129,0.25)]" 
                    : "bg-zinc-900/40 border-zinc-800/50 text-zinc-500"
                }`}>
                  <span>🤝 Support</span>
                </div>

              </div>

              {/* VERTICAL CONNECTOR TO SHARED LAYER */}
              <div className="flex justify-center h-4">
                <div className="w-0.5 border-dashed border-zinc-800 h-full"></div>
              </div>

              {/* Node 4: SHARED DATA LAYER */}
              <div className="p-2 bg-gradient-to-r from-zinc-950 to-zinc-900 border border-[#27272A] rounded-xl text-center text-zinc-400">
                <span className="font-extrabold flex items-center justify-center gap-1 text-white text-[8.5px]">
                  <Database className="w-3.5 h-3.5 text-[#C5A059]" />
                  SHARED TOOL / DATA LAYER
                </span>
                <div className="flex justify-around text-[7.5px] text-zinc-500 font-mono mt-1 pt-1 border-t border-zinc-800/80">
                  <span>Customers: {customers.length}</span>
                  <span>Campaigns: {campaigns.length}</span>
                  <span>Tickets: {tickets.length}</span>
                </div>
              </div>

            </div>

            {/* REAL-TIME DIAGNOSTIC METADATA READOUT */}
            <div className="mt-4 bg-[#0A0A0B]/80 p-3 rounded-xl border border-[#27272A] space-y-2 font-mono text-[9px]">
              <div className="flex justify-between text-[#A1A1AA]">
                <span>ROUTED DECISION STATE:</span>
                <span className="text-[#C5A059] font-bold">
                  {lastRouteTrace ? lastRouteTrace.route.toUpperCase() : "AWAITING PROMPT"}
                </span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>ROUTER CONFIDENCE:</span>
                <span className={lastRouteTrace && lastRouteTrace.confidence > 0.85 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {lastRouteTrace ? `${(lastRouteTrace.confidence * 100).toFixed(0)}%` : "0%"}
                </span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>CONTEXT VOLUMES:</span>
                <span>~{lastRouteTrace ? `${lastRouteTrace.tokens} Tokens` : "0 Tokens (Est)"}</span>
              </div>
              {lastRouteTrace && (
                <div className="text-[8.5px] leading-relaxed border-t border-[#27272A] pt-1.5 mt-1 text-zinc-500">
                  <span className="text-zinc-400 font-bold uppercase block text-[8px] mb-0.5">Router Rationale:</span>
                  "{lastRouteTrace.rationale}"
                </div>
              )}
            </div>

          </div>

          {/* ACTIVE DATABASE SNIPPET (KNOWLEDGE REFERENCE VIEWER) */}
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-4.5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#27272A]/80 pb-2">
              <h3 className="text-[10px] font-mono tracking-widest font-bold text-[#A1A1AA] uppercase">
                Agent Shared Knowledge Context
              </h3>
              <span className="text-[8px] uppercase tracking-wide bg-[#27272A] px-1.5 py-0.5 rounded text-zinc-400 font-mono">
                Memory Active
              </span>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 text-[10px]">
              
              {/* Segment 1: Customers */}
              <div className="bg-[#0A0A0B] p-2 rounded-xl border border-dashed border-[#27272A]">
                <span className="font-bold text-[#C5A059] block mb-1">🗂️ Active Leads ({customers.length})</span>
                <div className="space-y-1 font-mono text-[9px] text-[#A1A1AA]">
                  {customers.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex justify-between border-b border-zinc-900/60 pb-0.5 last:border-none">
                      <span className="truncate max-w-[120px]">{c.name} ({c.lifecycleStage})</span>
                      <span className="text-zinc-300">${c.lifetimeValue?.toLocaleString() || 0} LTV</span>
                    </div>
                  ))}
                  {customers.length > 3 && <span className="text-[8px] text-zinc-500 block italic pt-0.5">+ {customers.length - 3} more accounts passed in prompt payload</span>}
                </div>
              </div>

              {/* Segment 2: Campaigns */}
              <div className="bg-[#0A0A0B] p-2 rounded-xl border border-dashed border-[#27272A]">
                <span className="font-bold text-cyan-400 block mb-1">📢 Active Campaigns ({campaigns.length})</span>
                <div className="space-y-1 font-mono text-[9px] text-[#A1A1AA]">
                  {campaigns.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex justify-between border-b border-zinc-900/60 pb-0.5 last:border-none">
                      <span className="truncate max-w-[125px]">{c.title}</span>
                      <span className={c.status === "Active" ? "text-emerald-400" : "text-zinc-500"}>{c.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Segment 3: Tickets */}
              <div className="bg-[#0A0A0B] p-2 rounded-xl border border-dashed border-[#27272A]">
                <span className="font-bold text-emerald-400 block mb-1">🛠️ Unresolved Incident Logs ({tickets.filter(t => t.status !== "Resolved").length})</span>
                <div className="space-y-1 font-mono text-[9px] text-[#A1A1AA]">
                  {tickets.filter(t => t.status !== "Resolved").slice(0, 2).map((t, i) => (
                    <div key={i} className="flex justify-between border-b border-zinc-900/60 pb-0.5 last:border-none">
                      <span className="truncate max-w-[140px] text-zinc-300">"{t.issue}"</span>
                      <span className="text-red-400">{t.priority}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: CHAT INTERFACE & TEMP QUICK CHANNELS (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6 flex flex-col justify-between min-h-[580px]">
          
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl flex flex-col flex-1 shadow-xl overflow-hidden min-h-[460px]">
            
            {/* AGENT CHANNEL SELECTION HEADERS */}
            <div className="bg-[#0D0D0F] border-b border-[#27272A] px-4.5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-[#C5A059]" />
                <span className="text-xs font-bold tracking-wider font-sans text-white uppercase">
                  Target Communications Endpoint:
                </span>
              </div>

              {/* TABS SELECTOR */}
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab2("orchestrator")}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "orchestrator" 
                      ? "bg-[#C5A059] text-[#0A0A0B] shadow" 
                      : "bg-[#0A0A0B] text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-800"
                  }`}
                  title="ROUTES AUTOMATICALLY"
                >
                  🧠 AUTOMATIC ORCHESTRATOR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab2("tutor")}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "tutor" 
                      ? "bg-amber-500 text-black shadow" 
                      : "bg-[#0A0A0B] text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-800"
                  }`}
                >
                  🎓 TUTOR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab2("sales")}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "sales" 
                      ? "bg-[#C5A059] text-[#0A0A0B] shadow" 
                      : "bg-[#0A0A0B] text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-800"
                  }`}
                >
                  💼 SALES
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab2("marketing")}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "marketing" 
                      ? "bg-cyan-500 text-black shadow" 
                      : "bg-[#0A0A0B] text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-800"
                  }`}
                >
                  📢 MARKETING
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab2("support")}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "support" 
                      ? "bg-emerald-500 text-black shadow" 
                      : "bg-[#0A0A0B] text-zinc-400 hover:text-white hover:bg-white/5 border border-zinc-800"
                  }`}
                >
                  🤝 SUPPORT
                </button>
              </div>
            </div>

            {/* CHAT MESSAGES PANEL */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[380px] bg-[#0A0A0B]/30 scrollbar-thin">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                      msg.sender === "user" 
                        ? "bg-[#C5A059] text-[#0A0A0B] font-medium" 
                        : "bg-[#0A0A0B] border border-[#27272A] text-zinc-100"
                    }`}>
                      
                      {/* Badge indicator on Bot outputs */}
                      {msg.sender === "agent" && (
                        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-zinc-800/80 text-[10px] uppercase font-mono text-zinc-400">
                          <span className={`px-1.5 py-0.5 rounded-md border font-extrabold ${getAgentColor(msg.agentType)}`}>
                            {msg.agentType ? getAgentTitle(msg.agentType) : "Orchestrator"}
                          </span>
                          {msg.confidence && (
                            <span className="font-mono text-zinc-500 font-extrabold">
                              Confidence: {(msg.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans dark-markdown text-zinc-200">
                        {msg.text}
                      </div>

                      {/* Diagnostic routing summary */}
                      {msg.sender === "agent" && msg.rationale && (
                        <div className="text-[9px] font-mono text-zinc-500 mt-2.5 pt-1.5 border-t border-zinc-800 border-dashed">
                          *Trace:* {msg.rationale}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#0A0A0B] border border-[#27272A] rounded-2xl p-4 text-zinc-400 text-xs italic flex items-center space-x-2 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C5A059]" />
                    <span>Query routed successfully. Specialist compiling strategic reply...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* SUGGESTED TRIGGER LIST */}
            <div className="bg-[#0D0D0F]/60 px-4.5 py-3 border-t border-[#27272A] space-y-2">
              <span className="text-[10px] font-mono tracking-widest text-[#A1A1AA] uppercase block font-bold">
                Context Templates ({activeTab.toUpperCase()} ACTIVE)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedPrompts[activeTab]?.map((p, i) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSendChat(p.text)}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#0A0A0B] border border-zinc-800 text-[10.5px] text-zinc-300 hover:text-[#C5A059] hover:border-[#C5A059]/40 transition-all font-sans cursor-pointer text-left"
                    >
                      <Icon className="w-3 h-3 shrink-0 text-[#C5A059]" />
                      <span>{p.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CHAT INPUT FORM */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat(chatInput);
              }}
              className="p-3 bg-[#0D0D0F] border-t border-[#27272A] flex items-center space-x-2"
            >
              <input
                type="text"
                placeholder={
                  activeTab === "orchestrator" 
                    ? "🧠 Ask Orchestrator (Auto-routes to the right specialized agent)..." 
                    : `🔑 Instruct the specialized [${activeTab.toUpperCase()}] agent...`
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#0A0A0B] border border-[#27272A] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-[#C5A059] focus:border-[#C5A059] outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || loading}
                className="p-3 bg-[#C5A059] hover:bg-[#C5A059]/90 disabled:opacity-50 text-[#0A0A0B] font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer"
                title="Send instruction to agents"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </div>

          {/* DUAL CASCADE SPECIAL CONTAINER */}
          <div className="bg-[#141416] border border-zinc-800 rounded-2xl p-4.5 shadow-xl space-y-3 relative">
            <div className="absolute top-0.5 right-4 flex items-center space-x-2">
              <span className="text-[7.5px] tracking-normal font-mono font-bold leading-none shrink-0 px-1.5 py-0.5 bg-red-950/80 text-red-400 rounded border border-red-900">
                ORCHESTRATOR DEMO CASCADE
              </span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1">
                  <Workflow className="w-3.5 h-3.5 text-[#C5A059]" />
                  Multi-Agent Automated Event Cascade
                </h4>
                <p className="text-[10px] text-zinc-400 font-sans">
                  Simulate a real-time sequential multi-step workflow. Trigger an incident ticket resolution AND a related marketing campaign retention promo simultaneously.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTriggerMultiAgentCascade}
                disabled={cascadeStep > 0 && cascadeStep < 4}
                className="w-full md:w-auto bg-[#C5A059]/10 border border-[#C5A059]/30 hover:bg-[#C5A059]/25 text-[#C5A059] text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#C5A059]" />
                <span>Auto-Resolve & Pitch Upgrade Cascade</span>
              </button>
            </div>

            {/* CASCADE VISUAL TIMELINE FEED */}
            {cascadeStep > 0 && (
              <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3.5 space-y-3">
                <div className="font-mono text-[9px] text-[#A1A1AA] space-y-1.5 border-b border-[#27272A] pb-3">
                  {cascadeLog.map((log, lIdx) => (
                    <div key={lIdx} className="flex items-center space-x-2">
                      <span className="inline-block w-1.5 h-1.5 bg-[#C5A059] rounded-full animate-ping"></span>
                      <span>{log}</span>
                    </div>
                  ))}
                  {cascadeStep < 4 && (
                    <div className="flex items-center space-x-2 text-zinc-600 animate-pulse">
                      <span>•</span>
                      <span>Awaiting next state response...</span>
                    </div>
                  )}
                </div>

                {/* SIDE-BY-SIDE SIDE SUMMARY OF IMPACT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  
                  {/* Left Side: Support response */}
                  <div className="bg-zinc-950 p-2.5 rounded-lg border border-dashed border-emerald-900/30">
                    <span className="text-[8.5px] font-mono text-emerald-400 font-bold block mb-1 uppercase">
                      ✓ CX Technical Apology Answer (Support Agent)
                    </span>
                    {cascadeSupportOutput ? (
                      <p className="text-[9.5px] leading-relaxed text-zinc-300 font-sans line-clamp-4">
                        {cascadeSupportOutput}
                      </p>
                    ) : (
                      <div className="h-12 bg-zinc-900/40 rounded animate-pulse"></div>
                    )}
                  </div>

                  {/* Right Side: Marketing Draft */}
                  <div className="bg-zinc-950 p-2.5 rounded-lg border border-dashed border-cyan-900/30">
                    <span className="text-[8.5px] font-mono text-cyan-400 font-bold block mb-1 uppercase">
                      ✓ Targeted Retention Pitch (Marketing Agent)
                    </span>
                    {cascadeMarketingOutput ? (
                      <p className="text-[9.5px] leading-relaxed text-zinc-300 font-sans line-clamp-4">
                        {cascadeMarketingOutput}
                      </p>
                    ) : (
                      <div className="h-12 bg-zinc-900/40 rounded animate-pulse"></div>
                    )}
                  </div>

                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
