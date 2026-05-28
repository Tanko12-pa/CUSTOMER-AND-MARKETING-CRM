import React from "react";
import { DollarSign, ShieldAlert, Award, TrendingUp, Users, Radio } from "lucide-react";
import { Customer, Campaign, SupportTicket } from "../types";

interface KPICardsProps {
  customers: Customer[];
  campaigns: Campaign[];
  tickets: SupportTicket[];
}

export function KPICards({ customers, campaigns, tickets }: KPICardsProps) {
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
          <span className="text-xs text-red-400 font-medium bg-red-950/50 border border-red-900/40 px-1.5 py-0.5 rounded ml-2">CRITICAL</span>
        </div>
        <p className="text-[10px] text-[#A1A1AA]/60 mt-2 font-mono">Negative CRM Sentiments</p>
      </div>
    </div>
  );
}
