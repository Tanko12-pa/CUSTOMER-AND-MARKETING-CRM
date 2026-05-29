import React, { useState } from "react";
import { Campaign } from "../types";
import { Sparkles, Calendar, Plus, Play, Info, BarChart3, HelpCircle } from "lucide-react";

interface MarketingModuleProps {
  campaigns: Campaign[];
  onUpdateState: (type: string, payload: any) => Promise<void>;
}

export function MarketingModule({ campaigns, onUpdateState }: MarketingModuleProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newSegment, setNewSegment] = useState("Inactive 30 Days");
  const [newBudget, setNewBudget] = useState(5000);
  const [newTargetGoal, setNewTargetGoal] = useState(12500);
  const [showAddForm, setShowAddForm] = useState(false);

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
                      <h4 className="font-bold text-[#E4E4E7] text-sm leading-tight">{camp.title}</h4>
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
                <div className="p-3 bg-[#141416] border-b border-[#27272A] text-xs font-mono text-white flex flex-col gap-1">
                  <span className="text-[#A1A1AA] text-[9px] uppercase tracking-wider block">Generated Campaign Subject</span>
                  <span className="font-bold text-[#C5A059] font-sans">"{structuredCampaign.subjectLine}"</span>
                </div>

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
