import React, { useState } from "react";
import { 
  Sparkles, 
  Layers, 
  TrendingUp, 
  Compass, 
  Send, 
  RefreshCw, 
  Mail, 
  Video, 
  Check, 
  MousePointerClick, 
  Sliders, 
  Eye, 
  BookOpen, 
  ArrowRight,
  User,
  Activity,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FunnelAutomationProps {
  onUpdateState: (type: string, payload: any) => Promise<void>;
  userEmail?: string;
}

export function FunnelAutomation({ onUpdateState, userEmail }: FunnelAutomationProps) {
  // Input fields
  const [productName, setProductName] = useState("Pro CRM Edge");
  const [targetAudience, setTargetAudience] = useState("Enterprise Tech Leads");
  const [campaignOffer, setCampaignOffer] = useState("Free 30-Day Evaluation License");
  const [creativeTone, setCreativeTone] = useState<"Professional" | "Empathetic" | "Urgency-Driven" | "Conversational">("Professional");
  const [funnelType, setFunnelType] = useState<"Lead Magnet Funnel" | "Quiz Funnel" | "Webinar Funnel">("Lead Magnet Funnel");
  const [useSearch, setUseSearch] = useState(false);

  // loading + results state
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"traffic" | "capture" | "nurture" | "metrics">("traffic");
  
  // Custom simulator states
  const [simTraffic, setSimTraffic] = useState(5000);
  const [activeChatbotMsg, setActiveChatbotMsg] = useState("");
  const [simReport, setSimReport] = useState<{
    clicks: number;
    optInRate: number;
    qualifyRate: number;
    leads: number;
    mqls: number;
    sqls: number;
    conversions: number;
    revenue: number;
  } | null>(null);

  const [activeSocialTab, setActiveSocialTab] = useState<"twitter" | "linkedin" | "facebook">("twitter");
  const [expandedEmailIdx, setExpandedEmailIdx] = useState<number | null>(0);
  
  // Entire generated AI response state
  const [result, setResult] = useState<any>(null);

  // Dynamic reorderable customer journey stages & DnD state tracker
  const [stagesOrder, setStagesOrder] = useState<string[]>(["traffic", "capture", "nurture", "metrics"]);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  const handleGenerateFunnel = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/gemini/funnel-automator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          targetAudience,
          campaignOffer,
          creativeTone,
          funnelType,
          useSearch
        })
      });
      const data = await response.json();
      setResult(data);
      setExpandedEmailIdx(0);
      setActiveTab("traffic");
      
      // Seed simulator
      calculateSimulation(5000, data);
    } catch (err) {
      console.error("Funnel Generation failure:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSimulation = (clicks: number, sourceResult?: any) => {
    // Basic simulation logic based on generated content & weights
    const resToUse = sourceResult || result;
    if (!resToUse) return;

    const baseOptIn = funnelType === "Quiz Funnel" ? 0.32 : funnelType === "Webinar Funnel" ? 0.24 : 0.28;
    const baseQualify = 0.45;
    const baseSQL = 0.35;
    const baseClose = 0.18;

    const leadsCount = Math.floor(clicks * baseOptIn);
    const mqlsCount = Math.floor(leadsCount * baseQualify);
    const sqlsCount = Math.floor(mqlsCount * baseSQL);
    const convCount = Math.floor(sqlsCount * baseClose);
    const simulatedRevenue = convCount * 1450; 

    setSimReport({
      clicks,
      optInRate: baseOptIn * 100,
      qualifyRate: baseQualify * 100,
      leads: leadsCount,
      mqls: mqlsCount,
      sqls: sqlsCount,
      conversions: convCount,
      revenue: simulatedRevenue
    });
  };

  const handleApplySimStats = async () => {
    if (!simReport) return;
    // Push new simulated traffic campaign run into the NoSQL store
    await onUpdateState("ADD_CAMPAIGN", {
      title: `⚡ AI Simulated ${funnelType} Run`,
      targetSegment: targetAudience,
      budget: Math.floor(simTraffic * 0.15),
      clicks: simReport.clicks,
      conversations: simReport.leads,
      revenueGenerated: simReport.revenue,
      revenueTargetGoal: Math.floor(simReport.revenue * 0.85)
    });
    setSyncSuccessMessage(`Successfully applied parameters! A simulated campaign with $${simReport.revenue.toLocaleString()} in revenue has been synced to your local Firestore store.`);
    setTimeout(() => {
      setSyncSuccessMessage(null);
    }, 6000);
  };

  // HTML5 Drag and Drop event handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedStageId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedStageId !== id) {
      setDragOverStageId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedStageId || draggedStageId === targetId) {
      setDraggedStageId(null);
      setDragOverStageId(null);
      return;
    }

    const fromIndex = stagesOrder.indexOf(draggedStageId);
    const toIndex = stagesOrder.indexOf(targetId);

    const newOrder = [...stagesOrder];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedStageId);

    setStagesOrder(newOrder);
    setDraggedStageId(null);
    setDragOverStageId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="automated-funnels-section">
      
      {/* LEFT COLUMN: CONTROL TRAY */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-15 pointer-events-none">
            <Layers className="w-20 h-20 text-[#C5A059]" />
          </div>

          <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-[#27272A]">
            <Sparkles className="w-5 h-5 text-[#C5A059] animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">AI Studio Brain Engine</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1.5 font-mono">Product / Offer Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-[#C5A059] outline-none transition-colors"
                placeholder="e.g. Acme Enterprise SaaS"
                id="funnel-product-name"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1.5 font-mono">Target Audience Segment</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-[#C5A059] outline-none transition-colors"
                placeholder="e.g. CMOs of design agencies"
                id="funnel-target-audience"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1.5 font-mono">Lead Magnet / Lead Incentive</label>
              <input
                type="text"
                value={campaignOffer}
                onChange={(e) => setCampaignOffer(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-[#C5A059] outline-none transition-colors"
                placeholder="e.g. Free Audit Workbook Blueprint"
                id="funnel-campaign-offer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1.5 font-mono">Creative Tone</label>
              <select
                value={creativeTone}
                onChange={(e: any) => setCreativeTone(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2.5 text-xs text-white focus:border-[#C5A059] outline-none transition-colors"
                id="funnel-creative-tone"
              >
                <option value="Professional">🕴️ Executive / Professional</option>
                <option value="Empathetic">🤝 Helpful / Empathetic</option>
                <option value="Urgency-Driven">⏰ Action / Urgency-Driven</option>
                <option value="Conversational">💬 Direct / Conversational</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1.5 font-mono">AI Funnel Routing Model</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: "Lead Magnet Funnel", title: "🎁 Lead Magnet Funnel", desc: "Squeeze page → high-value PDF copy → nurture auto sequence" },
                  { value: "Quiz Funnel", title: "🧩 Interactive Quiz Funnel", desc: "Multi-step qualification quiz → personalized score triggers" },
                  { value: "Webinar Funnel", title: "🎥 Automated Webinar Funnel", desc: "Veo video ad → class registration landing → session pitch" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFunnelType(opt.value as any)}
                    className={`text-left p-3 rounded-xl border text-xs transition-all ${funnelType === opt.value ? "bg-[#C5A059]/10 border-[#C5A059] text-white" : "bg-[#0A0A0B] border-[#27272A] text-zinc-400 hover:border-zinc-700"}`}
                  >
                    <span className="font-bold block text-white mb-0.5">{opt.title}</span>
                    <span className="text-[10px] text-zinc-500 leading-normal block">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={useSearch}
                  onChange={(e) => setUseSearch(e.target.checked)}
                  className="rounded bg-[#0A0A0B] border-[#27272A] text-[#C5A059] focus:ring-[#C5A059] h-4 w-4"
                />
                <span className="font-mono text-xs">Verify facts via real-time search</span>
              </label>
            </div>

            <button
              onClick={handleGenerateFunnel}
              disabled={isLoading}
              className="w-full bg-[#C5A059] hover:bg-[#C5A059]/95 text-black font-bold uppercase tracking-wider text-xs py-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:pointer-events-none mt-4 font-mono"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Funnel...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Core Funnel Journey</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ACADEMICS DESCRIPTION */}
        <div className="bg-[#141416] rounded-2xl p-5 border border-[#27272A] text-zinc-400 text-[11px] leading-relaxed space-y-3">
          <div className="flex items-center space-x-1 text-white font-bold text-xs">
            <BookOpen className="w-4 h-4 text-[#C5A059]" />
            <span>Cohesive Multi-Stage Funnels</span>
          </div>
          <p>
            An AI marketing funnel functions as a centralized engine. Rather than drafting disjointed copy vectors, Google AI Studio generates ad creatives, qualification quizzes, welcome sequences, and predictive scoring rubrics sequentially.
          </p>
          <div className="border-t border-[#27272A]/40 pt-2 text-[10px] font-mono text-zinc-500">
            Node Registry: operator@company.com
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DYNAMIC PREVIEW & TELEMETRY */}
      <div className="lg:col-span-8 flex flex-col justify-between">
        <AnimatePresence mode="wait">
          
          {/* LOAD ANIMATION GRID */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#141416]/90 border border-[#27272A] rounded-2xl p-8 flex-1 flex flex-col items-center justify-center min-h-[500px]"
            >
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full border-4 border-[#C5A059]/20 border-t-[#C5A059] animate-spin"></div>
                <Sparkles className="absolute top-5 left-5 w-6 h-6 text-[#C5A059] animate-ping" />
              </div>
              
              <div className="text-center max-w-md space-y-4">
                <h4 className="text-white font-display text-base font-bold uppercase tracking-wider">
                  Harmonizing Growth Vectors
                </h4>
                <p className="text-xs text-zinc-400 leading-normal font-sans">
                  Google AI Studio is weaving traffic copies, landing structures, chatbot routers, email sequences, and interactive scores into a single unified lifecycle.
                </p>
                
                {/* Simulated Telemetry Streams */}
                <div className="bg-[#0A0A0B] rounded-xl p-4 border border-[#27272A] text-left font-mono text-[9px] text-[#C5A059]/90 space-y-1.5 h-36 overflow-y-hidden">
                  <p className="text-zinc-500 animate-pulse">// CENTRAL INTELLIGENCE STREAMING...</p>
                  <p className="animate-pulse">▶ [Stage 1] Querying gemini-3.5-flash for ad creative variations...</p>
                  <p className="animate-pulse delay-100">▶ Creating customized Veo video ad promotion sequence...</p>
                  <p className="animate-pulse delay-200">▶ [Stage 2] Designing landing FAQ matching: {campaignOffer}</p>
                  <p className="animate-pulse delay-300">▶ [Stage 3] Drafting 5-day email sequence for {targetAudience}</p>
                  <p className="animate-pulse delay-500">✔ Ready to pipe into live CRM database model!</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* INITIAL STATE DISPLAY (EMPTY RESULT) */}
          {!isLoading && !result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#141416] border border-[#27272A] rounded-2xl p-10 flex-1 flex flex-col items-center justify-center text-center min-h-[500px] space-y-4"
            >
              <div className="p-4 bg-[#C5A059]/10 rounded-2xl border border-[#C5A059]/20 text-[#C5A059]">
                <Layers className="w-10 h-10" />
              </div>
              <h4 className="text-white font-bold text-lg font-display uppercase">Configure Your Automated Journey</h4>
              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                Provide your custom target niche parameters on the left panel, choose a routing template, and hit "Generate Journey" to build a complete automated funnel!
              </p>
              <div className="bg-[#0A0A0B] px-4 py-2.5 border border-[#27272A] rounded-xl text-zinc-500 font-mono text-[10px]">
                Powered by gemini-3.5-flash Content Orchestration
              </div>
            </motion.div>
          )}

          {/* GENERATED FUNNEL RESULTS VIEW */}
          {!isLoading && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6 flex-1"
            >
              {/* STAGES BAR HEADER */}
              <div className="bg-[#141416] rounded-2xl p-3 border border-[#27272A] grid grid-cols-4 gap-1 sm:gap-2">
                {stagesOrder.map((stageId, index) => {
                  const nodeDetails = {
                    traffic: { label: "Traffic Engine", icon: TrendingUp },
                    capture: { label: "Lead Capture", icon: MousePointerClick },
                    nurture: { label: "Nurture Seq", icon: Mail },
                    metrics: { label: "CRM Simulator", icon: Sliders }
                  }[stageId as "traffic" | "capture" | "nurture" | "metrics"];

                  if (!nodeDetails) return null;
                  const IconComp = nodeDetails.icon;

                  return (
                    <button
                      key={stageId}
                      type="button"
                      onClick={() => setActiveTab(stageId as any)}
                      className={`py-2 px-1 sm:px-3 rounded-xl transition-all cursor-pointer text-center text-xs border ${activeTab === stageId ? "bg-[#C5A059] border-[#C5A059] text-black font-bold" : "bg-[#0A0A0B] border-transparent text-zinc-400 hover:text-white"}`}
                    >
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                        <IconComp className="w-3.5 h-3.5" />
                        <div className="text-left font-mono">
                          <span className="block text-[8px] opacity-60 font-medium leading-none uppercase">Step {index + 1}</span>
                          <span className="block text-[10px] sm:text-xs font-bold leading-normal">{nodeDetails.label}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* INTERACTIVE CUSTOMER JOURNEY NODE MAPPER */}
              <div className="bg-[#141416] rounded-2xl p-5 border border-[#27272A] space-y-4 shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#27272A]/70 pb-3 gap-2">
                  <div className="flex items-center space-x-2.5">
                    <Layers className="w-5 h-5 text-[#C5A059]" />
                    <div>
                      <h4 className="text-sm font-bold text-[#E4E4E7] uppercase tracking-tight font-display">Interactive Journey Mapper (Node Editor)</h4>
                      <p className="text-[10px] text-zinc-400 leading-none mt-0.5">Drag and drop individual nodes to reorder stage layouts</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-1 rounded-full uppercase self-start sm:self-center font-bold tracking-wider">
                    ⚡ Live Drag-&-Drop Designer
                  </span>
                </div>

                {stagesOrder && (
                  <div className="flex flex-col xl:flex-row items-stretch justify-between gap-4 overflow-x-auto py-2">
                    {stagesOrder.map((stageId, index) => {
                      const isDragged = draggedStageId === stageId;
                      const isOver = dragOverStageId === stageId;

                      const nodeInfo = {
                        traffic: {
                          label: "Traffic Engine",
                          subText: "Organic search tracking, Google Ads, social media layout scripts, and VEO storyboarding.",
                          badge: "ToFU (Marketing)",
                          icon: TrendingUp,
                          stats: "📈 ~12,400 Target Clicks",
                          variantColor: "border-[#C5A059]/40 hover:border-[#C5A059]"
                        },
                        capture: {
                          label: "Lead Capture",
                          subText: "Modern lead qualification routing, custom dialog chatbot scripts, and interactive quiz schema builders.",
                          badge: "MoFU (Middle Stage)",
                          icon: MousePointerClick,
                          stats: "🎯 ~2,800 Active Leads",
                          variantColor: "border-emerald-500/40 hover:border-emerald-400"
                        },
                        nurture: {
                          label: "Nurture Seq",
                          subText: "Personalized sequence messaging, delayed SMS protocols, and automated score trigger trees.",
                          badge: "BoFU (Email/SMS)",
                          icon: Mail,
                          stats: "✉️ 3 Automated Workflows",
                          variantColor: "border-blue-500/40 hover:border-blue-400"
                        },
                        metrics: {
                          label: "CRM Simulator",
                          subText: "Real-time pipeline prediction simulators, on-page SEO audits, and active A/B campaign hypotheses.",
                          badge: "Analytics (Optimization)",
                          icon: Sliders,
                          stats: "📊 ROI Predictive Engine",
                          variantColor: "border-violet-500/40 hover:border-violet-400"
                        }
                      }[stageId as "traffic" | "capture" | "nurture" | "metrics"];

                      if (!nodeInfo) return null;
                      const NodeIcon = nodeInfo.icon;
                      const isCurrentlyActive = activeTab === stageId;

                      return (
                        <React.Fragment key={stageId}>
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, stageId)}
                            onDragOver={(e) => handleDragOver(e, stageId)}
                            onDrop={(e) => handleDrop(e, stageId)}
                            onDragEnd={() => {
                              setDraggedStageId(null);
                              setDragOverStageId(null);
                            }}
                            onClick={() => setActiveTab(stageId as any)}
                            className={`flex-1 min-w-[210px] p-4 bg-[#0A0A0B]/85 border rounded-xl shadow-lg transition-all duration-300 cursor-grab active:cursor-grabbing relative flex flex-col justify-between space-y-4 ${
                              isDragged ? "opacity-30 border-dashed border-zinc-700" : ""
                            } ${
                              isOver ? "border-dashed border-[#C5A059] scale-[1.03] bg-zinc-900/50" : ""
                            } ${
                              isCurrentlyActive ? "border-[#C5A059] ring-2 ring-[#C5A059]/10 bg-[#1e1a14]/30" : `border-[#27272A] ${nodeInfo.variantColor}`
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest leading-none">
                                {nodeInfo.badge}
                              </span>
                              <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono font-bold px-2 py-0.5 rounded-full">
                                STEP {index + 1}
                              </span>
                            </div>

                            {/* Card Content */}
                            <div>
                              <div className="flex items-center space-x-2.5 mb-1.5">
                                <div className="p-1 px-1.5 bg-zinc-900 text-[#C5A059] rounded-lg border border-zinc-800">
                                  <NodeIcon className="w-3.5 h-3.5" />
                                </div>
                                <h5 className="text-xs font-bold text-[#E4E4E7]">{nodeInfo.label}</h5>
                              </div>
                              <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans line-clamp-3">
                                {nodeInfo.subText}
                              </p>
                            </div>

                            {/* Card Footer */}
                            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] font-mono">
                              <span className="text-zinc-500 text-[9px]">{nodeInfo.stats}</span>
                              <span className="text-[#C5A059]/80 font-bold group-hover:text-white uppercase text-[8px] tracking-wider">
                                {isCurrentlyActive ? "● Reading View" : "Click to Inspect"}
                              </span>
                            </div>
                          </div>

                          {index < 3 && (
                            <div className="hidden xl:flex items-center justify-center font-mono text-[#C5A059] opacity-40 select-none self-center">
                              <ArrowRight className="w-4 h-4 animate-pulse" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SYNC NOTIFICATION BANNER */}
              {syncSuccessMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-emerald-950/80 border border-emerald-900 text-emerald-300 p-3.5 rounded-xl flex items-center space-x-3 text-xs font-mono shadow-lg"
                >
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{syncSuccessMessage}</span>
                </motion.div>
              )}

              {/* STAGE CONTAINER CONTENT */}
              <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl flex-1 min-h-[450px]">
                <AnimatePresence mode="wait">
                  
                  {/* STAGE 1: TRAFFIC */}
                  {activeTab === "traffic" && (
                    <motion.div
                      key="traffic"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
                        <div>
                          <span className="text-[10px] text-[#C5A059] font-mono uppercase font-bold tracking-widest block">Top of Funnel (ToFU)</span>
                          <h4 className="text-white font-bold text-base font-display uppercase tracking-tight">AI Traffic Engine</h4>
                        </div>
                        <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase">Gemini Flash Fast ad copy</span>
                      </div>

                      {/* ADS SECTION */}
                      <div className="space-y-4">
                        <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-3">
                          <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono">Google Ads Headlines & Descriptions</h5>
                          <div className="space-y-2">
                            {result.trafficEngine.adsHeadlines?.map((h: string, i: number) => (
                              <div key={i} className="flex items-center space-x-2 border-b border-zinc-900 pb-1.5 last:border-0">
                                <span className="text-[9px] font-mono text-zinc-500">Headline #{i+1}:</span>
                                <span className="text-xs text-zinc-200 font-semibold">{h}</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-zinc-900 space-y-2">
                            {result.trafficEngine.adsDescriptions?.map((d: string, i: number) => (
                              <div key={i} className="space-y-1">
                                <span className="block text-[9px] font-mono text-zinc-500">Description #{i+1}:</span>
                                <span className="block text-xs text-zinc-300 leading-relaxed">{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SOCIAL TAB CONTAINER */}
                        <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl overflow-hidden">
                          <div className="bg-zinc-900/60 px-4 py-2 border-b border-[#27272A] flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#C5A059] font-mono">Social Media Creatives</span>
                            <div className="flex space-x-1.5 text-[9px] font-mono">
                              {["twitter", "linkedin", "facebook"].map((plat) => (
                                <button
                                  key={plat}
                                  onClick={() => setActiveSocialTab(plat as any)}
                                  className={`px-2 py-0.5 rounded cursor-pointer capitalize font-bold ${activeSocialTab === plat ? "bg-[#C5A059] text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                                >
                                  {plat}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="p-4 text-xs text-zinc-300 leading-relaxed font-sans min-h-[70px]">
                            {result.trafficEngine.socialPosts[activeSocialTab]}
                          </div>
                        </div>

                        {/* VEO VIDEO SCRIPT */}
                        <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5 text-[#C5A059]" />
                              Veo Video Creative Script & Storyboard
                            </h5>
                            <span className="text-[8px] bg-red-950/80 border border-red-900 text-red-400 font-bold px-1.5 rounded-full font-mono uppercase">VEO LITE VIDEO GENERATION</span>
                          </div>
                          <p className="text-xs font-bold text-white mb-1">Title: {result.trafficEngine.videoCreative.title}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="block text-[8px] uppercase tracking-wide font-bold text-zinc-500 mb-1 font-mono">Audio Script & Voiceover</span>
                              <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed italic">{result.trafficEngine.videoCreative.veoScript}</p>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="block text-[8px] uppercase tracking-wide font-bold text-zinc-500 mb-1 font-mono">Visual Storyboard Prompt</span>
                              <p className="text-[11px] text-zinc-300 leading-relaxed">{result.trafficEngine.videoCreative.visualStoryboard}</p>
                            </div>
                          </div>
                        </div>

                        {/* SEO BLOG OUTLINE */}
                        <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4">
                          <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono mb-2">Google SEO Blog Post Strategy Outline</h5>
                          <div className="text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-300 font-sans border-l-2 border-[#C5A059] pl-3.5">
                            {result.trafficEngine.seoOutline}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STAGE 2: CAPTURE */}
                  {activeTab === "capture" && (
                    <motion.div
                      key="capture"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
                        <div>
                          <span className="text-[10px] text-[#C5A059] font-mono uppercase font-bold tracking-widest block">Middle of Funnel (MoFU)</span>
                          <h4 className="text-white font-bold text-base font-display uppercase tracking-tight">AI Lead Capture Engine</h4>
                        </div>
                        <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase">Lead qualification builder</span>
                      </div>

                      {/* LANDING PAGE SPECIFICATION */}
                      <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-5 space-y-4">
                        <div className="border-b border-zinc-900 pb-3">
                          <span className="text-[9px] bg-emerald-950/80 text-emerald-400 border border-emerald-900 font-bold px-2 py-0.5 rounded-full uppercase font-mono">AI Generated Landing Page Blueprint</span>
                          <h5 className="text-sm font-bold text-white mt-2.5">{result.leadCapture.landingPageCopy.headline}</h5>
                          <p className="text-xs text-zinc-400 mt-1">{result.leadCapture.landingPageCopy.subheading}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <span className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Value Prop Bullets</span>
                            {result.leadCapture.landingPageCopy.valueProps?.map((v: string, i: number) => (
                              <div key={i} className="flex items-start space-x-2 text-xs text-zinc-300">
                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{v}</span>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-3 bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                            <span className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Interactive Landing FAQS</span>
                            {result.leadCapture.landingPageCopy.faqs?.map((f: any, i: number) => (
                              <div key={i} className="text-[11px] space-y-1">
                                <span className="block font-bold text-white">Q: {f.q}</span>
                                <span className="block text-zinc-400">A: {f.a}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 flex justify-center">
                          <button
                            type="button"
                            className="bg-zinc-900 border border-[#C5A059] text-[#C5A059] text-xs font-mono font-bold uppercase tracking-wider py-2 px-6 rounded-lg pointer-events-none hover:bg-[#C5A059]/10"
                          >
                            🖱️ CTA Trigger: {result.leadCapture.landingPageCopy.cta}
                          </button>
                        </div>
                      </div>

                      {/* CHATBOT SIMULATOR */}
                      <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono">AI Chatbot Qualification Stream Simulator</h5>
                          <span className="text-[8px] bg-zinc-850 text-zinc-400 font-bold px-1.5 py-0.2 rounded font-mono">CRM TRiggers</span>
                        </div>

                        <div className="space-y-2 bg-black rounded-lg p-3.5 border border-zinc-900 text-xs font-mono">
                          <div className="text-zinc-500">// CHATBOT LOG SEQUENCE</div>
                          <div className="text-emerald-400">Bot: "{result.leadCapture.chatbotScript.greeting}"</div>
                          {result.leadCapture.chatbotScript.questions?.map((q: string, i: number) => (
                            <div key={i} className="text-zinc-400 pl-4">
                              <span className="text-zinc-600">Question #{i+1}:</span> "{q}"
                            </div>
                          ))}
                          <div className="pt-2 border-t border-zinc-900 text-[#C5A059] text-[10px]">
                            <strong className="block mb-0.5">Automated Score Routing Protocol:</strong>
                            <span className="whitespace-pre-wrap leading-normal block">{result.leadCapture.chatbotScript.scoreRouting}</span>
                          </div>
                        </div>
                      </div>

                      {/* QUIZ STRUCTURE */}
                      <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-3">
                        <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono">Opal Interactive Qualification Quiz Funnel</h5>
                        <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-900 space-y-3">
                          <p className="text-xs font-bold text-white flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-[#C5A059]" />
                            Quiz Concept: {result.leadCapture.quizSchema.title}
                          </p>
                          <div className="space-y-3 pt-1">
                            {result.leadCapture.quizSchema.questions?.map((q: any, i: number) => (
                              <div key={i} className="space-y-1.5 text-xs">
                                <span className="block font-bold text-zinc-300">Q{i+1}: {q.questionText}</span>
                                <div className="flex flex-wrap gap-1.5 font-mono">
                                  {q.optionsList?.map((opt: string, idx: number) => (
                                    <span key={idx} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-850 px-2 py-0.5 text-[9px] rounded uppercase cursor-pointer">
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                    </motion.div>
                  )}

                  {/* STAGE 3: NURTURE */}
                  {activeTab === "nurture" && (
                    <motion.div
                      key="nurture"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
                        <div>
                          <span className="text-[10px] text-[#C5A059] font-mono uppercase font-bold tracking-widest block">Bottom of Funnel (BoFU)</span>
                          <h4 className="text-white font-bold text-base font-display uppercase tracking-tight">AI Lead Nurturing Engine</h4>
                        </div>
                        <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase">Email & Score Automations</span>
                      </div>

                      {/* EMAIL SEQUENCING */}
                      <div className="space-y-3">
                        <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono">Personalized Email Nurture Sequence (3 Days Tracking)</h5>
                        <div className="space-y-2">
                          {result.nurtureEngine.emailSequence?.map((email: any, idx: number) => (
                            <div 
                              key={idx} 
                              className={`border rounded-xl transition-all overflow-hidden cursor-pointer ${expandedEmailIdx === idx ? "bg-[#0A0A0B] border-[#C5A059]/40" : "bg-[#0A0A0B]/50 border-zinc-900 hover:border-zinc-800"}`}
                              onClick={() => {
                                setExpandedEmailIdx(expandedEmailIdx === idx ? null : idx);
                              }}
                            >
                              <div className="p-3.5 flex items-center justify-between font-sans">
                                <div className="flex items-center space-x-3 text-xs text-white">
                                  <span className="font-mono text-[9px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-md">
                                    {email.delay}
                                  </span>
                                  <span className="font-bold truncate max-w-sm sm:max-w-md">{email.subject}</span>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {expandedEmailIdx === idx ? "Collapse [–]" : "Expand [+]"}
                                </span>
                              </div>

                              {expandedEmailIdx === idx && (
                                <div className="p-4 pt-1 border-t border-zinc-905 bg-black/60 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                  {email.body}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SMS & NOTIFICATIONS */}
                      <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-3">
                        <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono">Direct SMS/Push Notification Triggers</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                          {result.nurtureEngine.smsFollowups?.map((sms: string, idx: number) => (
                            <div key={idx} className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-zinc-400 leading-normal italic">
                              "{sms}"
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SCORING LOGIC */}
                      <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4">
                        <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono mb-2">Lead Scoring & Hot Segment Triggers</h5>
                        <div className="text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-300 font-sans border-l-2 border-[#C5A059] pl-3.5">
                          {result.nurtureEngine.scoringLogic}
                        </div>
                      </div>

                    </motion.div>
                  )}

                  {/* STAGE 4: SIMULATOR / CONVERSION */}
                  {activeTab === "metrics" && (
                    <motion.div
                      key="metrics"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
                        <div>
                          <span className="text-[10px] text-[#C5A059] font-mono uppercase font-bold tracking-widest block">Optimization Engine</span>
                          <h4 className="text-white font-bold text-base font-display uppercase tracking-tight">AI Conversion & CRM Analytics</h4>
                        </div>
                        <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase">Performance audit</span>
                      </div>

                      {/* AB TESTING MODULE */}
                      <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 space-y-3">
                        <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono">Active A/B Test Hypotheses</h5>
                        <div className="space-y-3">
                          {result.optimizationEngine.abTests?.map((ab: any, i: number) => (
                            <div key={i} className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-xs">
                              <span className="block font-bold text-white uppercase text-[9px] mb-1 text-[#C5A059]">Test Grid #{i+1}: {ab.name}</span>
                              <p className="text-zinc-300 leading-normal mb-1 font-sans"><strong>Hypothesis:</strong> {ab.hypothesis}</p>
                              <span className="block text-[10px] font-mono text-zinc-500">Metric Goal Tracked: {ab.metric}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SEO recommendation */}
                      <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4">
                        <h5 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider font-mono mb-2">Real-Time On-Page SEO Audit Recommendation</h5>
                        <div className="text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-300 font-sans border-l-2 border-[#C5A059] pl-3.5">
                          {result.optimizationEngine.seoAudit}
                        </div>
                      </div>

                      {/* WORKPLACE CONVERSION SIMULATOR */}
                      <div className="bg-[#0A0A0B] border border-zinc-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center space-x-2">
                          <Activity className="w-5 h-5 text-[#C5A059] animate-pulse" />
                          <h5 className="text-xs font-bold text-white uppercase tracking-wider">Predictive CRM Funnel Simulator</h5>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans mt-0.5">
                          Simulate the estimated metrics generated by this campaign layout. Enter a target ad-niche click volume and observe real-time pipeline conversion forecasts.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-black/40 p-4 rounded-xl border border-zinc-900">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase font-mono">Simulated Clicks Volume</label>
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="range"
                                min={500}
                                max={20000}
                                step={500}
                                value={simTraffic}
                                onChange={(e) => {
                                  const c = Number(e.target.value);
                                  setSimTraffic(c);
                                  calculateSimulation(c);
                                }}
                                className="w-full accent-[#C5A059] cursor-pointer"
                              />
                              <span className="text-xs font-mono font-bold text-white shrink-0 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded w-16 text-center">{simTraffic}</span>
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={handleApplySimStats}
                              className="bg-[#C5A059] hover:bg-[#C5A059]/90 text-black font-bold uppercase tracking-wide text-[10px] font-mono px-4 py-2.5 rounded-lg cursor-pointer transition-all shrink-0 shadow-md"
                            >
                              Sync Parameters to CRM
                            </button>
                          </div>
                        </div>

                        {simReport && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="block text-[8px] text-zinc-500 uppercase font-bold mb-1">Opt-In Rate</span>
                              <span className="text-xs font-bold text-zinc-300">{simReport.optInRate.toFixed(1)}%</span>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="block text-[8px] text-zinc-500 uppercase font-bold mb-1">Captured Leads</span>
                              <span className="text-xs font-bold text-emerald-500">{simReport.leads}</span>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="block text-[8px] text-zinc-500 uppercase font-bold mb-1">MQLs → SQLs</span>
                              <span className="text-xs font-bold text-violet-400">{simReport.mqls} → {simReport.sqls}</span>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="block text-[8px] text-zinc-500 uppercase font-bold mb-1">Simulated Net LTV</span>
                              <span className="text-xs font-bold text-[#C5A059]">${simReport.revenue.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>

                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
