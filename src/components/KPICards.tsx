import React, { useState } from "react";
import { DollarSign, ShieldAlert, Award, TrendingUp, Users, Radio, AlertTriangle, ShieldCheck, History } from "lucide-react";
import { Customer, Campaign, SupportTicket } from "../types";

interface KPICardsProps {
  customers: Customer[];
  campaigns: Campaign[];
  tickets: SupportTicket[];
}

export function KPICards({ customers, campaigns, tickets }: KPICardsProps) {
  const [showTrendHistory, setShowTrendHistory] = useState(false);
  const [alertState, setAlertState] = useState<null | "confirming" | "active">(null);

  const totalLTV = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);
  const avgLeadScore = Math.round(customers.reduce((sum, c) => sum + c.leadScore, 0) / (customers.length || 1));
  const activeCampaigns = campaigns.filter(c => c.status === "Active").length;
  const atRiskCount = customers.filter(c => c.sentiment === "Negative" || c.dealRiskStatus.includes("High") || c.dealRiskStatus.includes("At Risk")).length;
  
  // Predict next quarter sales based on current lead scores & win probability calculations
  const projectedRevenue = Math.round(
    customers.reduce((sum, c) => sum + (c.lifetimeValue || 45000) * (c.winProbability / 100), 0)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" id="kpi-cards-grid">
      {/* CARD 1 */}
      <div 
        className="bg-[#141416] border border-[#27272A] border-b-4 border-[#C5A059] rounded-2xl p-6 shadow-xl hover:translate-y-[-2px] transition-all duration-300 relative overflow-hidden group"
        id="kpi-card-ltv"
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-25 transition-opacity">
          <DollarSign className="w-16 h-16 text-[#C5A059]" />
        </div>
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
            <DollarSign className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Total Booked LTV</span>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-display text-[#E4E4E7] tracking-tight">
            ${totalLTV.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-500 font-medium font-sans">+18.4%</span>
        </div>
        <p className="text-[10px] text-[#A1A1AA]/60 mt-2 font-mono">Simulated Firestore live sync</p>
      </div>

      {/* CARD 2 */}
      <div 
        className="bg-[#141416] border border-[#27272A] border-b-4 border-[#C5A059] rounded-2xl p-6 shadow-xl hover:translate-y-[-2px] transition-all duration-300 relative overflow-hidden group"
        id="kpi-card-projected"
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-25 transition-opacity">
          <TrendingUp className="w-16 h-16 text-[#C5A059]" />
        </div>
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Sales Forecast (Q3)</span>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-display text-[#E4E4E7] tracking-tight">
            ${projectedRevenue.toLocaleString()}
          </span>
          <span className="text-xs text-[#C5A059] font-medium font-sans">AI Weighted</span>
        </div>
        <p className="text-[10px] text-[#A1A1AA]/60 mt-2 font-mono">Weighted by Win Probability</p>
      </div>

      {/* CARD 3 */}
      <div 
        className="bg-[#141416] border border-[#27272A] border-b-4 border-stone-650 rounded-2xl p-6 shadow-xl hover:translate-y-[-2px] transition-all duration-300 relative overflow-hidden group"
        id="kpi-card-campaigns"
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-25 transition-opacity">
          <Radio className="w-16 h-16 text-[#A1A1AA]" />
        </div>
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2.5 rounded-xl bg-white/5 text-[#E4E4E7]">
            <Radio className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Active Campaigns</span>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-display text-[#E4E4E7] tracking-tight">
            {activeCampaigns}
          </span>
          <span className="text-xs text-[#A1A1AA] font-medium">/ {campaigns.length} total</span>
        </div>
        <p className="text-[10px] text-[#A1A1AA]/60 mt-2 font-mono">Premium/Enterprise segments</p>
      </div>

      {/* CARD 4 */}
      <div 
        className="bg-[#141416] border border-[#27272A] border-b-4 border-red-900 rounded-2xl p-6 shadow-xl hover:translate-y-[-2px] transition-all duration-300 relative overflow-hidden group"
        id="kpi-card-atrisk"
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-25 transition-opacity">
          <ShieldAlert className="w-16 h-16 text-red-650" />
        </div>
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2.5 rounded-xl bg-red-950/25 text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">At-Risk Accounts</span>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold font-display text-red-400 tracking-tight">
            {atRiskCount}
          </span>
          <span className="text-xs text-red-400 font-medium bg-red-950/50 border border-red-900/40 px-1.5 py-0.5 rounded ml-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            CRITICAL
          </span>
        </div>

        {/* Animated churn risk velocity trend indicator */}
        <div className="mt-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-1.5">
            <div 
              className="flex-1 flex items-center space-x-2 bg-red-950/20 border border-red-900/30 rounded-xl p-2 cursor-pointer hover:bg-red-950/40 transition-colors" 
              id="at-risk-trend-velocity-indicator"
              onClick={() => setShowTrendHistory(!showTrendHistory)}
              title="Click to toggle churn risk trend history"
            >
              <TrendingUp className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-red-300 font-mono tracking-tight flex items-center gap-1">
                  Speed: +14.8% / hr
                  <History className={`w-2.5 h-2.5 transition-transform text-[#C5A059] ${showTrendHistory ? 'rotate-180' : ''}`} />
                </span>
              </div>
            </div>

            {/* Management Intervention Primary Action Button */}
            <button
              type="button"
              onClick={() => setAlertState(alertState ? null : "confirming")}
              className={`p-2 rounded-xl text-[10px] font-bold uppercase font-mono tracking-tight cursor-pointer transition-all border flex items-center gap-1.5 shrink-0 ${
                alertState === "active"
                  ? "bg-emerald-950/50 border-emerald-500 text-emerald-400 animate-pulse animate-duration-1000"
                  : "bg-red-900/80 border-red-700 hover:bg-red-800 text-white shadow-lg"
              }`}
              title="Trigger high-priority management intervention alert workflow"
              id="management-intervention-trigger-btn"
            >
              <AlertTriangle className="w-3 h-3 text-white" />
              <span>SLA Intervene</span>
            </button>
          </div>

          {/* Trend History Timeline Toggle View */}
          {showTrendHistory && (
            <div className="bg-[#0A0A0B] border border-red-900/20 rounded-xl p-2.5 space-y-1.5 text-[9px] font-mono text-[#A1A1AA] animate-fade-in" id="trend-history-logs">
              <p className="text-[#C5A059] font-bold uppercase text-[8px] tracking-wider border-b border-[#27272A] pb-1">Churn Velocity Log (Today)</p>
              <div className="flex justify-between">
                <span>16:00 (Current)</span>
                <span className="text-red-400 font-bold">+14.8% / hr</span>
              </div>
              <div className="flex justify-between">
                <span>14:00</span>
                <span className="text-red-450 font-bold">+11.2% / hr</span>
              </div>
              <div className="flex justify-between">
                <span>12:00</span>
                <span className="text-amber-500 font-bold">+6.5% / hr</span>
              </div>
              <div className="flex justify-between">
                <span>10:00 (Base)</span>
                <span className="text-emerald-500 font-bold">+1.2% / hr</span>
              </div>
            </div>
          )}

          {/* Workflow confirmation overlay or input panel */}
          {alertState === "confirming" && (
            <div className="bg-[#1C1616] border border-red-500/40 rounded-xl p-3 space-y-2 animate-fade-in text-xs font-sans" id="intervention-confirmation-panel">
              <div className="space-y-1">
                <p className="font-bold text-white font-mono text-[10px] uppercase tracking-wider text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Confirm Intervention Flow
                </p>
                <p className="text-[10px] text-[#A1A1AA] leading-relaxed">
                  Log high-priority SLA intervention ticket and push SMS alert to CSM account owners?
                </p>
              </div>
              <div className="flex items-center space-x-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAlertState(null)}
                  className="flex-1 py-1 px-2 border border-[#27272A] rounded-lg bg-[#0A0A0B] text-[9px] font-mono text-[#A1A1AA] hover:text-white cursor-pointer"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAlertState("active");
                  }}
                  className="flex-1 py-1 px-2 rounded-lg bg-red-650 hover:bg-red-700 text-white text-[9px] font-bold font-mono uppercase cursor-pointer"
                >
                  Log SLA Alert
                </button>
              </div>
            </div>
          )}

          {alertState === "active" && (
            <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-xl p-3 space-y-1.5 text-xs font-sans text-emerald-400 animate-fade-in" id="intervention-active-panel">
              <div className="flex items-center space-x-1.5 font-bold font-mono text-[10px] uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Intervention SLA Sent!</span>
              </div>
              <p className="text-[10px] text-zinc-300 leading-relaxed font-sans">
                Logged to high-priority mutations audit log. Dispatch complete to account executive queue.
              </p>
              <button
                type="button"
                onClick={() => setAlertState(null)}
                className="text-[9px] text-emerald-400/80 hover:text-white font-mono uppercase underline tracking-wider cursor-pointer font-bold block"
              >
                [Clear Alert State]
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[#A1A1AA]/60 mt-2 font-mono">Negative CRM Sentiments</p>
      </div>
    </div>
  );
}
