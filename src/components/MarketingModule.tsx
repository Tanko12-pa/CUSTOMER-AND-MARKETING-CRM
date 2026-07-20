import React, { useState, useEffect } from "react";
import { Campaign } from "../types";
import { 
  Sparkles, 
  Calendar, 
  Plus, 
  Play, 
  Info, 
  BarChart3, 
  HelpCircle, 
  GitCompare, 
  Percent, 
  Target,
  Github,
  GitCommit,
  Loader2,
  Trash2
} from "lucide-react";

interface MarketingModuleProps {
  campaigns: Campaign[];
  onUpdateState: (type: string, payload: any) => Promise<void>;
  currentUser?: any;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

export function MarketingModule({ campaigns, onUpdateState, currentUser, showToast }: MarketingModuleProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newSegment, setNewSegment] = useState("Inactive 30 Days");
  const [newBudget, setNewBudget] = useState(5000);
  const [newTargetGoal, setNewTargetGoal] = useState(12500);
  const [showAddForm, setShowAddForm] = useState(false);

  // A/B testing selection states
  const [selectedVariantAId, setSelectedVariantAId] = useState<string>("");
  const [selectedVariantBId, setSelectedVariantBId] = useState<string>("");

  // Safely auto-select variant defaults on load or update
  useEffect(() => {
    if (campaigns && campaigns.length > 0) {
      if (!selectedVariantAId) {
        setSelectedVariantAId(campaigns[0].campaign_id);
      }
      if (!selectedVariantBId && campaigns.length > 1) {
        setSelectedVariantBId(campaigns[1].campaign_id);
      } else if (!selectedVariantBId && campaigns.length === 1) {
        setSelectedVariantBId(campaigns[0].campaign_id);
      }
    }
  }, [campaigns.length, selectedVariantAId, selectedVariantBId]);

  // Active campaign statistics hover state
  const [hoveredPoint, setHoveredPoint] = useState<{
    campaignId: string;
    title: string;
    openRate: number;
    ctr: number;
    clicks: number;
  } | null>(null);

  // Marketing Gen state
  const [marketingPrompt, setMarketingPrompt] = useState("");
  const [generatedResult, setGeneratedResult] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [campaignTone, setCampaignTone] = useState<"Professional" | "Empathetic" | "Urgency-Driven" | "Conversational">("Professional");

  // Custom multi-assets campaign copywriter states
  const [structuredCampaign, setStructuredCampaign] = useState<{
    subjectLine: string;
    blastHtml: string;
    smsPush: string;
    socialCopy: string;
    rationale: string;
  } | null>(null);
  const [activeAssetTab, setActiveAssetTab] = useState<"email" | "sms" | "social" | "rationale">("email");

  // --- GITHUB INTEGRATION FOR EXPORTING CAMPAIGNS ---
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [pushLoading, setPushLoading] = useState(false);
  const [customPath, setCustomPath] = useState("campaigns/ai-marketing-blast.md");
  const [showPushOptions, setShowPushOptions] = useState(false);

  // Check connection and load repos
  useEffect(() => {
    const checkGithub = async () => {
      if (!currentUser?.email) return;
      try {
        const profileRes = await fetch(`/api/github/profile?email=${encodeURIComponent(currentUser.email)}`);
        const data = await profileRes.json();
        if (data.connected) {
          setGithubConnected(true);
          const reposRes = await fetch(`/api/github/repos?email=${encodeURIComponent(currentUser.email)}`);
          if (reposRes.ok) {
            const repoData = await reposRes.json();
            setGithubRepos(repoData.repos || []);
            if (repoData.repos && repoData.repos.length > 0) {
              setSelectedRepo(repoData.repos[0].name);
            }
          }
        } else {
          setGithubConnected(false);
        }
      } catch (err) {
        console.error("Failed to fetch GitHub state for MarketingModule:", err);
      }
    };
    checkGithub();
  }, [currentUser?.email]);

  const handlePushCampaignToGithub = async () => {
    if (!selectedRepo) {
      if (showToast) showToast("Please select a target repository.", "error");
      return;
    }
    if (!structuredCampaign) return;

    setPushLoading(true);
    try {
      const markdown = `# AI Generated Campaign Copy
**Subject Line:** ${structuredCampaign.subjectLine}

## Email Newsletter Asset (HTML)
\`\`\`html
${structuredCampaign.blastHtml}
\`\`\`

## SMS Text Blast
${structuredCampaign.smsPush}

## Social Media Copy
${structuredCampaign.socialCopy}

## Strategic AI Rationale
${structuredCampaign.rationale}

---
*Created on Customer & Marketing CRM Intelligence Console on ${new Date().toISOString()}*
`;

      const response = await fetch('/api/github/push-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser?.email,
          repo: selectedRepo,
          path: customPath,
          content: markdown,
          message: `Commit AI campaign assets for "${structuredCampaign.subjectLine}"`
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (showToast) {
          showToast(`Campaign pushed successfully to ${selectedRepo}/${customPath}!`, "success");
        }
        setShowPushOptions(false);
      } else {
        if (showToast) {
          showToast(data.error || "Failed to commit campaign file", "error");
        }
      }
    } catch (err) {
      console.error(err);
      if (showToast) {
        showToast("Error committing campaign file to GitHub", "error");
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onUpdateState("ADD_CAMPAIGN", {
      title: newTitle,
      targetSegment: newSegment,
      budget: Number(newBudget),
      revenueTargetGoal: Number(newTargetGoal) || Number(newBudget) * 2.5
    });
    setNewTitle("");
    setShowAddForm(false);
  };

  const handleLaunchCampaign = async (campaignId: string) => {
    await onUpdateState("LAUNCH_CAMPAIGN", { campaign_id: campaignId });
  };

  const handleGenerateCopy = async (customPrompt?: string) => {
    const promptToUse = customPrompt || marketingPrompt;
    if (!promptToUse.trim()) return;
    setGenLoading(true);
    try {
      const response = await fetch("/api/gemini/campaign-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: promptToUse,
          segment: newSegment,
          tone: campaignTone
        })
      });
      const data = await response.json();
      if (data.subjectLine) {
        setStructuredCampaign({
          subjectLine: data.subjectLine,
          blastHtml: data.blastHtml,
          smsPush: data.smsPush,
          socialCopy: data.socialCopy,
          rationale: data.rationale
        });
        setGeneratedResult(data.blastHtml);
      } else {
        setGeneratedResult(data.text || "No copy generated.");
        setStructuredCampaign(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="marketing-module-container">
      {/* LEFT: campaigns list and Funnel display */}
      <div className="lg:col-span-12 xl:col-span-7 space-y-6">
        <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] pb-5" id="campaigns-master-card">
          <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-3">
            <div className="flex items-center space-x-2.5">
              <BarChart3 className="w-5 h-5 text-[#C5A059]" />
              <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight font-display">Ecosystem Campaign Automation Engine</h3>
            </div>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] text-xs font-bold py-2 px-3.5 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Campaign Draft</span>
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddCampaign} className="bg-[#0A0A0B] border border-[#27272A] rounded-2xl p-4 mb-5 space-y-4">
              <h4 className="text-sm font-bold text-[#E4E4E7]">Create Marketing Campaign Document</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1 font-sans">Campaign Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Premium Expansion"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-[#141416] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-[#E4E4E7] focus:outline-[#C5A059] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1 font-sans">Target Segment</label>
                  <select
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value)}
                    className="w-full bg-[#141416] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-[#E4E4E7] focus:outline-[#C5A059] outline-none"
                  >
                    <option value="High-Value Tier">High-Value Tier</option>
                    <option value="Inactive 30 Days">Inactive 30 Days</option>
                    <option value="New Signups">New Signups</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1 font-sans">Budget ($ USD)</label>
                    <input
                      type="number"
                      required
                      value={newBudget}
                      onChange={(e) => {
                        setNewBudget(Number(e.target.value));
                        setNewTargetGoal(Number(e.target.value) * 2.5);
                      }}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-[#E4E4E7] focus:outline-[#C5A059] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1 font-sans">Revenue Target ($ USD)</label>
                    <input
                      type="number"
                      required
                      value={newTargetGoal}
                      onChange={(e) => setNewTargetGoal(Number(e.target.value))}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-[#E4E4E7] focus:outline-[#C5A059] outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-end pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Save Draft to Firestore
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-5">
            {campaigns.map((camp) => {
              // Calculate ROI conversion
              const conversionRate = camp.clicks > 0 ? ((camp.conversations / camp.clicks) * 100).toFixed(1) : "0.0";
              const roi = camp.budget > 0 ? Math.round(((camp.revenueGenerated - camp.budget) / camp.budget) * 100) : 0;

              return (
                <div key={camp.campaign_id} className="border border-[#27272A] rounded-2xl p-4 hover:bg-[#0A0A0B]/50 transition-all duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-[#E4E4E7] text-sm leading-tight">{camp.title}</h4>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete the campaign "${camp.title}"?`)) {
                              onUpdateState("DELETE_CAMPAIGN", { campaign_id: camp.campaign_id });
                            }
                          }}
                          className="text-red-400/60 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-[#A1A1AA] font-mono mt-0.5">Segment: <span className="text-[#C5A059] font-bold font-sans">{camp.targetSegment}</span> | Budget: ${camp.budget.toLocaleString()}</p>
                    </div>
                    <div>
                      {camp.status === "Completed" ? (
                        <span className="bg-emerald-500 text-black border border-emerald-400 font-bold text-[10px] px-2.5 py-1 rounded inline-flex items-center space-x-1 uppercase animate-pulse">
                          🏆 Target Met! Completed
                        </span>
                      ) : camp.status === "Active" ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                            ● ACTIVE ENROLLMENT
                          </span>
                          <button
                            onClick={() => onUpdateState("SIMULATE_REVENUE_GAIN", { campaign_id: camp.campaign_id })}
                            className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1"
                            type="button"
                          >
                            <span>➕ Simulate $5k Gain</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleLaunchCampaign(camp.campaign_id)}
                          className="bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center space-x-1.5 shadow transition-colors cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>ENROLL SEGMENT & LAUNCH</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {(camp.status === "Active" || camp.status === "Completed") ? (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-3 gap-3 text-center bg-[#0A0A0B] p-2.5 border border-[#27272A] rounded-xl">
                        <div>
                          <span className="block text-[10px] font-bold tracking-wider text-[#A1A1AA] font-sans">CLICKS</span>
                          <span className="text-sm font-bold text-[#E4E4E7] font-mono">{camp.clicks.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold tracking-wider text-[#C5A059] font-sans">CONVERSIONS</span>
                          <span className="text-sm font-bold text-[#E4E4E7] font-mono">{camp.conversations.toLocaleString()}</span>
                          <span className="text-[10px] text-[#A1A1AA]/80 block">({conversionRate}%)</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold tracking-wider text-[#C5A059]/80 font-sans">BUDGET ROI</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">+{roi}%</span>
                          <span className="text-[10px] text-[#A1A1AA]/80 block">(${camp.revenueGenerated.toLocaleString()} Gen)</span>
                        </div>
                      </div>

                      {/* Revenue Target Goal Progress */}
                      {(() => {
                        const goal = camp.revenueTargetGoal || (camp.budget * 2.5);
                        const progressPct = Math.min((camp.revenueGenerated / goal) * 100, 100);
                        return (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-[#A1A1AA]">Revenue Progress: <span className="text-[#E4E4E7]">${camp.revenueGenerated.toLocaleString()}</span> / <span className="text-[#C5A059]">${goal.toLocaleString()}</span></span>
                              <span className={camp.status === "Completed" ? "text-emerald-400 font-extrabold flex items-center gap-1 animate-pulse" : "text-[#A1A1AA]"}>
                                {progressPct.toFixed(0)}% {camp.status === "Completed" ? "🎯 TARGET MET" : ""}
                              </span>
                            </div>
                            <div className="w-full bg-[#141416]/80 rounded-full h-2 overflow-hidden border border-[#27272A] relative">
                              <div
                                className={`h-full transition-all duration-500 ${camp.status === "Completed" ? "bg-emerald-500" : "bg-[#C5A059]"}`}
                                style={{ width: `${progressPct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="bg-[#0A0A0B]/30 text-[#A1A1AA] flex items-center justify-center p-3 rounded-xl border border-dashed border-[#27272A] text-xs text-center font-mono">
                      <span>Ready in Firestore drafts. Click "Launch" to start auto-routing to segments.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ACTIVE CAMPAIGN METRICS & VISUALIZATION CARD */}
        {(() => {
          const activeAndCompleted = campaigns.filter(c => c.status === "Active" || c.status === "Completed");
          const totalActiveCount = activeAndCompleted.length;
          
          const avgOpenRate = totalActiveCount > 0 
            ? Number((activeAndCompleted.reduce((acc, curr) => acc + (curr.openRate || 0), 0) / totalActiveCount).toFixed(1))
            : 0;
          const avgCTR = totalActiveCount > 0
            ? Number((activeAndCompleted.reduce((acc, curr) => acc + (curr.ctr || 0), 0) / totalActiveCount).toFixed(1))
            : 0;

          const peakPerformer = totalActiveCount > 0
            ? [...activeAndCompleted].sort((a, b) => (b.ctr || 0) - (a.ctr || 0))[0]
            : null;

          const maxMetricVal = Math.max(
            ...activeAndCompleted.map(c => Math.max(c.openRate || 0, c.ctr || 0)), 
            30
          ) * 1.15;

          const yCoord = (val: number) => {
            const minPlotY = 20;
            const maxPlotY = 200;
            const heightRange = maxPlotY - minPlotY; // 180
            return maxPlotY - (val / maxMetricVal) * heightRange;
          };

          const gridLines = [0, 25, 50, 75, 100].filter(v => v <= maxMetricVal);
          if (gridLines.length < 3) {
            gridLines.push(...[10, 20, 30].filter(v => v <= maxMetricVal && !gridLines.includes(v)));
          }
          gridLines.sort((a,b) => a - b);

          return (
            <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] space-y-5" id="campaign-performance-analytics-visualization">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#27272A] pb-3">
                <div className="flex items-center space-x-2.5">
                  <BarChart3 className="w-5 h-5 text-[#C5A059]" />
                  <div>
                    <h4 className="font-bold text-[#E4E4E7] text-sm font-display">Active Campaign Engagement Telemetry</h4>
                    <p className="text-[11px] text-[#A1A1AA]">Statistical distribution of Open Rates & Click-Through rates</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-mono self-start sm:self-center">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <span className="w-2.5 h-2.5 bg-[#C5A059] rounded-sm inline-block"></span>
                    <span>Open Rate (%)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <span className="w-2.5 h-2.5 bg-[#10B981] rounded-sm inline-block"></span>
                    <span>CTR (%)</span>
                  </span>
                </div>
              </div>

              {/* AGGREGATED METRICS SUMMARY */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider font-bold">Aggregated Avg Open Rate</span>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="text-xl font-bold text-[#C5A059] font-mono">{avgOpenRate}%</span>
                    <span className="text-[9px] text-emerald-400 font-mono">✓ High Health</span>
                  </div>
                </div>
                <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider font-bold">Aggregated Avg CTR</span>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="text-xl font-bold text-emerald-450 font-mono">{avgCTR}%</span>
                    <span className="text-[9px] text-[#C5A059] font-mono">✓ Target Met</span>
                  </div>
                </div>
                <div className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider font-bold">CTR Peak Performer</span>
                  <div className="mt-1">
                    <p className="text-xs font-bold text-[#E4E4E7] truncate">{peakPerformer ? peakPerformer.title : "No Campaign Active"}</p>
                    <div className="flex justify-between items-center text-[9px] text-[#C5A059] font-mono mt-0.5">
                      <span>CTR: {peakPerformer ? `${peakPerformer.ctr}%` : "0%"}</span>
                      <span>Opens: {peakPerformer ? `${peakPerformer.openRate}%` : "0%"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* STUNNING INTERACTIVE SVG CHART SPACE */}
              <div className="relative bg-[#0A0A0B] p-4 rounded-xl border border-[#27272A] overflow-hidden">
                {totalActiveCount === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-center text-zinc-500 font-mono text-xs px-4 leading-relaxed">
                    No active or completed marketing waves detected. Enrolling a segment and launching raw drafts will populate telemetry indicators.
                  </div>
                ) : (
                  <>
                    <svg viewBox="0 0 600 240" className="w-full h-auto overflow-visible select-none">
                      {/* Grid Lines */}
                      {gridLines.map((yVal, idx) => {
                        const yPos = yCoord(yVal);
                        return (
                          <g key={idx} className="opacity-15">
                            <line x1="50" y1={yPos} x2="580" y2={yPos} stroke="#ffffff" strokeWidth="1" strokeDasharray="3 3" />
                            <text x="41" y={yPos + 3.5} fill="#ffffff" fontSize="9.5" textAnchor="end" fontFamily="monospace">{yVal}%</text>
                          </g>
                        );
                      })}

                      {/* Grouped Bars */}
                      {activeAndCompleted.map((camp, idx) => {
                        const itemWidth = 530 / totalActiveCount;
                        const slotX = 50 + idx * itemWidth;
                        
                        const barWidth = Math.min(22, itemWidth * 0.28);
                        const gapCorr = 4;
                        const openRateVal = camp.openRate || 0;
                        const ctrVal = camp.ctr || 0;

                        const openRateY = yCoord(openRateVal);
                        const openRateH = Math.max(2, 200 - openRateY);

                        const ctrY = yCoord(ctrVal);
                        const ctrH = Math.max(2, 200 - ctrY);

                        const openBarX = slotX + itemWidth / 2 - barWidth - gapCorr / 2;
                        const ctrBarX = slotX + itemWidth / 2 + gapCorr / 2;

                        return (
                          <g 
                            key={camp.campaign_id}
                            className="cursor-pointer group"
                            onMouseEnter={() => setHoveredPoint({
                              campaignId: camp.campaign_id,
                              title: camp.title,
                              openRate: openRateVal,
                              ctr: ctrVal,
                              clicks: camp.clicks
                            })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            {/* Column Highlight */}
                            <rect 
                              x={slotX + 5} 
                              y="15" 
                              width={itemWidth - 10} 
                              height="190" 
                              fill="#ffffff" 
                              opacity="0" 
                              className="group-hover:opacity-[0.03] transition-all rounded"
                            />

                            {/* Open Rate Bar */}
                            <rect
                              x={openBarX}
                              y={openRateY}
                              width={barWidth}
                              height={openRateH}
                              fill="#C5A059"
                              rx="3"
                              className="transition-all duration-300 group-hover:brightness-125"
                            />

                            {/* CTR Bar */}
                            <rect
                              x={ctrBarX}
                              y={ctrY}
                              width={barWidth}
                              height={ctrH}
                              fill="#10B981"
                              rx="3"
                              className="transition-all duration-300 group-hover:brightness-125"
                            />

                            {/* Campaign Text Label */}
                            <text
                              x={slotX + itemWidth / 2}
                              y="190"
                              dy="28"
                              fill="#A1A1AA"
                              fontSize="9.5"
                              textAnchor="middle"
                              fontFamily="sans-serif"
                              className="font-medium pointer-events-none group-hover:fill-white transition-colors"
                            >
                              {camp.title.length > 20 ? camp.title.substring(0, 17) + "..." : camp.title}
                            </text>
                          </g>
                        );
                      })}

                      {/* X Axis Base Line */}
                      <line x1="50" y1="200" x2="580" y2="200" stroke="#27272A" strokeWidth="1.5" />
                    </svg>

                    {/* Popover / Overlay dynamic details tooltip */}
                    {hoveredPoint && (
                      <div className="absolute top-2 right-2 bg-black border border-[#27272A] p-2.5 rounded-xl text-[10.5px] font-mono shadow-xl space-y-1 z-10 w-48 animate-fade-in text-left">
                        <p className="font-sans font-bold text-white text-xs truncate border-b border-zinc-800 pb-1 mb-1.5">
                          {hoveredPoint.title}
                        </p>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">EMAIL OPENS:</span>
                          <span className="text-[#C5A059] font-bold">{hoveredPoint.openRate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CLICK-THROUGH:</span>
                          <span className="text-emerald-400 font-bold">{hoveredPoint.ctr}%</span>
                        </div>
                        <div className="flex justify-between mt-1 pt-1 border-t border-zinc-900 text-zinc-400">
                          <span>TOTAL CLICKS:</span>
                          <span className="font-bold text-white">{hoveredPoint.clicks.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* A/B TESTING SPLIT DASHBOARD CARD */}
        {(() => {
          const campA = campaigns.find(c => c.campaign_id === selectedVariantAId);
          const campB = campaigns.find(c => c.campaign_id === selectedVariantBId);

          const clicksA = campA?.clicks || 0;
          const convsA = campA?.conversations || 0;
          const convRateA = clicksA > 0 ? (convsA / clicksA) * 100 : 0;
          const ctrA = campA?.ctr || 0;
          const revA = campA?.revenueGenerated || 0;

          const clicksB = campB?.clicks || 0;
          const convsB = campB?.conversations || 0;
          const convRateB = clicksB > 0 ? (convsB / clicksB) * 100 : 0;
          const ctrB = campB?.ctr || 0;
          const revB = campB?.revenueGenerated || 0;

          // A/B test analysis helper formulas
          const ctrDiff = ctrB - ctrA;
          const convDiff = convRateB - convRateA;

          // Z-score confidence interval check
          let confidenceText = "";
          let confidenceColor = "text-zinc-500 bg-zinc-900 border-zinc-800";
          let statsInsight = "";

          const totalClicks = clicksA + clicksB;
          const totalConvs = convsA + convsB;

          if (clicksA < 30 || clicksB < 30) {
            confidenceText = "Insufficient Sample Volume";
            statsInsight = "One or both campaigns have fewer than 30 clicks. Accumulate more traffic loop parameters to verify scientific significance.";
          } else {
            const p1 = convRateA / 100;
            const p2 = convRateB / 100;
            const pool = totalConvs / totalClicks;
            
            if (pool <= 0 || pool >= 1) {
              confidenceText = "No Variant Lift Detected";
              statsInsight = "Conversions are either zero or identical between trials. Unable to prove statistical variance.";
            } else {
              const se = Math.sqrt(pool * (1 - pool) * ((1 / clicksA) + (1 / clicksB)));
              const z = se > 0 ? Math.abs(p1 - p2) / se : 0;

              if (z >= 1.96) {
                confidenceText = "95% Confidence (High Significance)";
                confidenceColor = "text-emerald-400 bg-emerald-950/45 border-emerald-900";
                statsInsight = `Outstanding! The performance lift is mathematically proven. Variant ${convRateB > convRateA ? 'B' : 'A'} is the clear champion with high reliability.`;
              } else if (z >= 1.64) {
                confidenceText = "90% Confidence (Moderate Significance)";
                confidenceColor = "text-[#C5A059] bg-[#C5A059]/10 border-[#C5A059]/30";
                statsInsight = `The trend strongly favors Variant ${convRateB > convRateA ? 'B' : 'A'}, though there's a minor probability of overlap. Monitor slightly longer before full rollouts.`;
              } else if (z >= 1.0) {
                confidenceText = "70% Confidence (Low Significance)";
                confidenceColor = "text-amber-500/90 bg-amber-950/20 border-amber-900/30";
                statsInsight = "Early indications show variance, but the statistics are still prone to standard noise. Gather a larger data cohort.";
              } else {
                confidenceText = "No Statistical Significance";
                confidenceColor = "text-zinc-500 bg-zinc-950 border-zinc-900";
                statsInsight = "The metrics are extremely close. The differences seen are statistically identical and likely due to sampling variance.";
              }
            }
          }

          return (
            <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] space-y-5" id="campaign-ab-testing-cohort-dashboard">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#27272A] pb-3.5">
                <div className="flex items-center space-x-2.5">
                  <GitCompare className="w-5 h-5 text-[#C5A059]" />
                  <div>
                    <h4 className="font-bold text-[#E4E4E7] text-sm font-display">A/B Testing Cohort Insights & Lift Analytics</h4>
                    <p className="text-[11px] text-[#A1A1AA]">Statistical comparison of marketing creatives pulled from Firestore</p>
                  </div>
                </div>
                
                <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono font-bold px-2.5 py-0.5 rounded-full uppercase self-start sm:self-center tracking-wider">
                  Live Split-Test Workspace
                </span>
              </div>

              {/* VARIANT CONFIG SELECTORS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0A0A0B]/40 p-3 rounded-xl border border-zinc-900">
                <div>
                  <label className="block text-[9px] font-mono font-extrabold uppercase text-[#A1A1AA] mb-1">Variant A (Control creative)</label>
                  <select
                    value={selectedVariantAId}
                    onChange={(e) => setSelectedVariantAId(e.target.value)}
                    className="w-full bg-[#141416] border border-[#27272A] rounded-xl px-2.5 py-1.5 text-xs text-[#E4E4E7] outline-none focus:border-[#C5A059] cursor-pointer"
                  >
                    {campaigns.map((c) => (
                      <option key={c.campaign_id} value={c.campaign_id}>
                        {c.title} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-mono font-extrabold uppercase text-[#A1A1AA] mb-1">Variant B (Challenger creative)</label>
                  <select
                    value={selectedVariantBId}
                    onChange={(e) => setSelectedVariantBId(e.target.value)}
                    className="w-full bg-[#141416] border border-[#27272A] rounded-xl px-2.5 py-1.5 text-xs text-[#E4E4E7] outline-none focus:border-[#C5A059] cursor-pointer"
                  >
                    {campaigns.map((c) => (
                      <option key={c.campaign_id} value={c.campaign_id}>
                        {c.title} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {campaigns.length < 2 ? (
                <div className="p-5 text-center text-zinc-500 font-mono text-xs border border-dashed border-[#27272A] rounded-xl bg-[#0A0A0B]/20">
                  ⚠️ Draft and Launch at least two campaigns to populate comparative A/B Test Lift Analytics.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* SIDE-BY-SIDE STATS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* VARIANT A NODE */}
                    <div className="bg-[#0A0A0B]/60 p-4 rounded-xl border border-zinc-800 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#C5A059]/10 text-[#C5A059] text-[8px] font-mono font-bold uppercase rounded-bl border-l border-b border-[#C5A059]/10">
                        Variant A
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-xs truncate max-w-[85%]">{campA ? campA.title : "Not Selected"}</h5>
                        <p className="text-[9px] font-mono text-[#A1A1AA] mt-0.5">Budget: ${campA?.budget.toLocaleString() || "0"} | Conversions: {convsA}</p>
                      </div>

                      <div className="space-y-3 pt-1">
                        {/* CTR */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>Click-Through Rate (CTR):</span>
                            <span className="font-bold text-[#E4E4E7]">{ctrA.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[#C5A059] h-full transition-all duration-500" style={{ width: `${Math.min(ctrA * 10, 100)}%` }}></div>
                          </div>
                        </div>

                        {/* Conversion Rate */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>Conversion Rate:</span>
                            <span className="font-bold text-[#E4E4E7]">{convRateA.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[#C5A059]/80 h-full transition-all duration-500" style={{ width: `${Math.min(convRateA * 3, 100)}%` }}></div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1 pt-2 border-t border-zinc-900 text-center font-mono">
                        <div className="bg-black/50 p-1.5 rounded border border-zinc-900">
                          <span className="block text-[8px] text-zinc-500">CLICKS</span>
                          <span className="text-xs font-bold text-zinc-300">{clicksA.toLocaleString()}</span>
                        </div>
                        <div className="bg-black/50 p-1.5 rounded border border-zinc-900">
                          <span className="block text-[8px] text-zinc-500">REVENUE</span>
                          <span className="text-xs font-bold text-emerald-500">${revA.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* VARIANT B NODE */}
                    <div className="bg-[#0A0A0B]/60 p-4 rounded-xl border border-zinc-800 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] text-[8px] font-mono font-bold uppercase rounded-bl border-l border-b border-emerald-950">
                        Variant B
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-xs truncate max-w-[85%]">{campB ? campB.title : "Not Selected"}</h5>
                        <p className="text-[9px] font-mono text-[#A1A1AA] mt-0.5">Budget: ${campB?.budget.toLocaleString() || "0"} | Conversions: {convsB}</p>
                      </div>

                      <div className="space-y-3 pt-1">
                        {/* CTR */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>Click-Through Rate (CTR):</span>
                            <span className="font-bold text-white">{ctrB.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[#10B981] h-full transition-all duration-500" style={{ width: `${Math.min(ctrB * 10, 100)}%` }}></div>
                          </div>
                        </div>

                        {/* Conversion Rate */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>Conversion Rate:</span>
                            <span className="font-bold text-white">{convRateB.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[#10B981]/80 h-full transition-all duration-500" style={{ width: `${Math.min(convRateB * 3, 100)}%` }}></div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1 pt-2 border-t border-zinc-900 text-center font-mono">
                        <div className="bg-black/50 p-1.5 rounded border border-zinc-900">
                          <span className="block text-[8px] text-zinc-500">CLICKS</span>
                          <span className="text-xs font-bold text-zinc-300">{clicksB.toLocaleString()}</span>
                        </div>
                        <div className="bg-black/50 p-1.5 rounded border border-zinc-900">
                          <span className="block text-[8px] text-zinc-500">REVENUE</span>
                          <span className="text-xs font-bold text-emerald-500">${revB.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LIFT & STATISTICAL INSIGHTS BOARD */}
                  <div className="p-4 rounded-xl border border-[#27272A] bg-[#0A0A0B]/85 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Cohort Lift Hypotheses Audit</span>
                      <span className={`text-[9px] font-mono font-bold p-1 px-2.5 rounded border ${confidenceColor}`}>
                        {confidenceText}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center py-1">
                      <div className="bg-black p-2 rounded border border-zinc-900">
                        <span className="block text-[8px] text-zinc-500 font-mono">RELATIVE CTR DELTA</span>
                        <span className={`text-sm font-bold font-mono ${ctrDiff >= 0 ? "text-emerald-400" : "text-amber-500"}`}>
                          {ctrDiff >= 0 ? `+${ctrDiff.toFixed(1)}% Lift` : `${ctrDiff.toFixed(1)}% Drop`}
                        </span>
                      </div>
                      <div className="bg-black p-2 rounded border border-zinc-900">
                        <span className="block text-[8px] text-zinc-500 font-mono font-bold">RELATIVE CONV. LIFT</span>
                        <span className={`text-sm font-bold font-mono ${convDiff >= 0 ? "text-emerald-400" : "text-amber-500"}`}>
                          {convDiff >= 0 ? `+${convDiff.toFixed(1)}% Lift` : `${convDiff.toFixed(1)}% Drop`}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 text-[10.5px] leading-relaxed text-zinc-300 font-sans italic border-t border-zinc-900 flex space-x-2">
                      <span className="text-[#C5A059] shrink-0 font-bold uppercase not-italic">✓ Audit Insight:</span>
                      <span>{statsInsight}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* RIGHT: AI Copy Assistant */}
      <div className="lg:col-span-12 xl:col-span-5 space-y-6">
        <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] flex flex-col h-full" id="ad-copy-generator-studio">
          <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-3">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-5 h-5 text-[#C5A059]" />
              <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight font-display">AI Ad & Campaign Copywriter</h3>
            </div>
            <span className="text-[10px] font-mono bg-[#0A0A0B] text-[#C5A059] border border-[#27272A] px-2 py-1 rounded">GEMINI</span>
          </div>

          <p className="text-xs text-[#A1A1AA] mb-4 leading-relaxed">
            Quickly trigger automated creative campaigns, Facebook or LinkedIn ads, or localized SEO assistant drafts using our Gemini-driven models.
          </p>

          <div className="space-y-3.5">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMarketingPrompt("Generate a LinkedIn Ad copy and Facebook ad layout for a high-value software enterprise offering specialized GDPR data safety features. Use an earthy, professional tone.");
                  handleGenerateCopy("Generate a LinkedIn Ad copy and Facebook ad layout for a high-value software enterprise offering specialized GDPR data safety features. Use an earthy, professional tone.");
                }}
                className="text-[11px] bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#C5A059] px-2.5 py-1.5 rounded-lg border border-[#C5A059]/20 transition-colors font-semibold cursor-pointer"
              >
                📝 LinkedIn / FB Ads
              </button>
              <button
                type="button"
                onClick={() => {
                  setMarketingPrompt("Draft an automated campaign email offering a 15% recheck loyalty award to our 'Inactive 30 Days' customer segment. Compose a sharp preview call to action.");
                  handleGenerateCopy("Draft an automated campaign email offering a 15% recheck loyalty award to our 'Inactive 30 Days' customer segment. Compose a sharp preview call to action.");
                }}
                className="text-[11px] bg-white/5 hover:bg-white/10 text-[#E4E4E7] px-2.5 py-1.5 rounded-lg transition-colors border border-[#27272A] font-semibold cursor-pointer"
              >
                ✉️ Loyalty Re-engagement
              </button>
            </div>

            <div>
              <textarea
                rows={3}
                placeholder="Write custom marketing directives... (e.g., 'Compose a newsletter banner copy for new signups')"
                value={marketingPrompt}
                onChange={(e) => setMarketingPrompt(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3.5 text-xs text-[#E4E4E7] outline-none focus:border-[#C5A059] resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono tracking-wider uppercase text-[#A1A1AA] mb-1.5">
                Campaign Tone
              </label>
              <select
                value={campaignTone}
                onChange={(e) => setCampaignTone(e.target.value as any)}
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl p-2.5 text-xs text-[#E4E4E7] outline-none focus:border-[#C5A059] cursor-pointer"
              >
                <option value="Professional">💼 Professional</option>
                <option value="Empathetic">🤝 Empathetic</option>
                <option value="Urgency-Driven">🚨 Urgency-Driven</option>
                <option value="Conversational">💬 Conversational</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="search-ground-mktg"
                checked={useSearch}
                onChange={(e) => setUseSearch(e.target.checked)}
                className="rounded accent-[#C5A059]"
              />
              <label htmlFor="search-ground-mktg" className="text-xs text-[#A1A1AA] select-none cursor-pointer">
                Ground copy using Google Search (latest data/trends)
              </label>
            </div>

            <button
              onClick={() => handleGenerateCopy()}
              disabled={genLoading || !marketingPrompt.trim()}
              className="w-full bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0A0A0B]" />
              <span>{genLoading ? "Co-writing Copy..." : "Craft Multilingual Copy Assets"}</span>
            </button>

            {structuredCampaign ? (
              <div className="mt-4 border border-[#27272A] rounded-2xl overflow-hidden bg-[#0A0A0B] shadow-xl animate-fade-in font-sans">
                {/* Subject Header */}
                <div className="p-3 bg-[#141416] border-b border-[#27272A] text-xs font-mono text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[#A1A1AA] text-[9px] uppercase tracking-wider block">Generated Campaign Subject</span>
                    <span className="font-bold text-[#C5A059] font-sans">"{structuredCampaign.subjectLine}"</span>
                  </div>
                  {githubConnected && (
                    <div className="flex items-center gap-2 mt-1 sm:mt-0 shrink-0">
                      <button
                        onClick={() => setShowPushOptions(!showPushOptions)}
                        className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-white text-[#C5A059] rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>Export to GitHub</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Push Options Expansion */}
                {githubConnected && showPushOptions && (
                  <div className="p-3 bg-[#0D0D0E] border-b border-[#27272A] text-xs space-y-3 font-sans text-left animate-fade-in">
                    <span className="text-[10px] text-[#C5A059] font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                      <GitCommit className="w-3.5 h-3.5 text-[#C5A059]" />
                      Push Campaign Markdown File
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-zinc-500 font-mono block mb-1">Target Repository</label>
                        {githubRepos.length === 0 ? (
                          <div className="text-[10px] text-zinc-500 font-mono italic">No repositories found. Create one under Billing & Integrations first.</div>
                        ) : (
                          <select
                            value={selectedRepo}
                            onChange={(e) => setSelectedRepo(e.target.value)}
                            className="w-full bg-[#141416] border border-[#27272A] rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059] font-mono"
                          >
                            {githubRepos.map((r: any) => (
                              <option key={r.name} value={r.name}>{r.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="text-[9px] text-zinc-500 font-mono block mb-1">Commit Path in Repo</label>
                        <input
                          type="text"
                          value={customPath}
                          onChange={(e) => setCustomPath(e.target.value)}
                          className="w-full bg-[#141416] border border-[#27272A] rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059] font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowPushOptions(false)}
                        className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePushCampaignToGithub}
                        disabled={pushLoading || !selectedRepo}
                        className="px-3 py-1 bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] rounded-lg text-[10px] font-extrabold uppercase flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                      >
                        {pushLoading ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Pushing...</span>
                          </>
                        ) : (
                          <span>Commit File</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub Asset Tabs */}
                <div className="flex bg-[#141416]/55 border-b border-[#27272A] p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveAssetTab("email")}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                      activeAssetTab === "email" ? "bg-zinc-850 text-[#C5A059] border border-zinc-700" : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    ✉️ Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAssetTab("sms")}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                      activeAssetTab === "sms" ? "bg-zinc-850 text-[#C5A059] border border-zinc-700" : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    💬 SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAssetTab("social")}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                      activeAssetTab === "social" ? "bg-zinc-850 text-[#C5A059] border border-zinc-700" : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    📢 Social
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAssetTab("rationale")}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                      activeAssetTab === "rationale" ? "bg-zinc-850 text-[#C5A059] border border-zinc-700" : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    🎯 Strategy
                  </button>
                </div>

                {/* Tab content view */}
                <div className="p-4 text-xs font-mono text-[#E4E4E7] leading-relaxed max-h-[220px] overflow-y-auto whitespace-pre-wrap select-all bg-[#0A0A0B]/50">
                  {activeAssetTab === "email" && structuredCampaign.blastHtml}
                  {activeAssetTab === "sms" && structuredCampaign.smsPush}
                  {activeAssetTab === "social" && structuredCampaign.socialCopy}
                  {activeAssetTab === "rationale" && (
                    <div className="font-sans text-xs text-zinc-300 space-y-2">
                      <p className="font-bold text-[#C5A059] uppercase text-[10px] font-mono tracking-wider">AI Rationale & Targeting Strategy</p>
                      <p className="leading-relaxed font-sans">{structuredCampaign.rationale}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : generatedResult ? (
              <div className="mt-4 border border-[#27272A] rounded-xl bg-[#0A0A0B] p-4 font-mono text-xs text-[#E4E4E7] max-h-[200px] overflow-y-auto leading-relaxed whitespace-pre-wrap select-all">
                {generatedResult}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
