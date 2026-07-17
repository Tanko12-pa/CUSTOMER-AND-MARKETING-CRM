import React, { useState, useMemo } from "react";
import { DollarSign, ShieldAlert, Award, TrendingUp, Users, Radio, AlertTriangle, ShieldCheck, History, X, Bell, AlertCircle, ArrowRight } from "lucide-react";
import { Customer, Campaign, SupportTicket, AuditLog } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface KPICardsProps {
  customers: Customer[];
  campaigns: Campaign[];
  tickets: SupportTicket[];
  logs?: AuditLog[];
}

export function KPICards({ customers, campaigns, tickets, logs = [] }: KPICardsProps) {
  const [showTrendHistory, setShowTrendHistory] = useState(false);
  const [alertState, setAlertState] = useState<null | "confirming" | "active">(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  // Scan logs for risk transitions from Low to High/At Risk/Escalated in real-time
  const riskTransitionAlerts = useMemo(() => {
    const alerts: {
      id: string;
      customerName: string;
      oldRisk: string;
      newRisk: string;
      timestamp: string;
      details: string;
    }[] = [];

    logs.forEach(log => {
      // Case 1: Manual Escalate deal
      if (log.action === "DEAL_ESCALATED") {
        // Find name using regex match
        const nameMatch = log.details.match(/initiated:\s*([^.]+)\./i);
        const name = nameMatch ? nameMatch[1].trim() : "Unknown Account";
        alerts.push({
          id: log.id,
          customerName: name,
          oldRisk: "Low Risk",
          newRisk: "Escalated",
          timestamp: log.timestamp,
          details: log.details
        });
      }
      // Case 2: Risk status field change logged under UPDATE_RECORD
      else if (log.changedFields && log.changedFields.dealRiskStatus) {
        const delta = log.changedFields.dealRiskStatus;
        const oldVal = delta.old || "Low Risk";
        const newVal = delta.new || "High Risk";

        const isOldLow = typeof oldVal === "string" && oldVal.toLowerCase().includes("low");
        const isNewHigh = typeof newVal === "string" && (
          newVal.toLowerCase().includes("high") ||
          newVal.toLowerCase().includes("sentiment") ||
          newVal.toLowerCase().includes("escalated") ||
          newVal.toLowerCase().includes("risk")
        );

        if (isOldLow && isNewHigh) {
          const nameMatch = log.details.match(/customer\s+([^.]+)/i);
          const name = nameMatch ? nameMatch[1].trim() : "Unknown Account";
          alerts.push({
            id: log.id,
            customerName: name,
            oldRisk: String(oldVal),
            newRisk: String(newVal),
            timestamp: log.timestamp,
            details: log.details
          });
        }
      }
    });

    // Soft-sort latest first
    return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs]);

  // Active undismissed alerts for real-time toaster alerts
  const activeAlerts = useMemo(() => {
    return riskTransitionAlerts.filter(a => !dismissedAlerts.includes(a.id));
  }, [riskTransitionAlerts, dismissedAlerts]);

  const totalLTV = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);
  const avgLeadScore = Math.round(customers.reduce((sum, c) => sum + c.leadScore, 0) / (customers.length || 1));
  const activeCampaigns = campaigns.filter(c => c.status === "Active").length;
  const atRiskCount = customers.filter(c => c.sentiment === "Negative" || c.dealRiskStatus.includes("High") || c.dealRiskStatus.includes("At Risk") || c.dealRiskStatus.includes("Escalated")).length;
  
  // Predict next quarter sales based on current lead scores & win probability calculations
  const projectedRevenue = Math.round(
    customers.reduce((sum, c) => sum + (c.lifetimeValue || 45000) * (c.winProbability / 100), 0)
  );

  const dismissAlert = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDismissedAlerts(prev => [...prev, id]);
  };

  return (
    <div className="space-y-6" id="kpi-cards-block-container">
      {/* Real-time floating toast notifications container */}
      <div className="fixed top-24 right-6 z-50 max-w-sm w-full space-y-3 pointer-events-none" id="realtime-risk-toasts-overlay">
        <AnimatePresence>
          {activeAlerts.slice(0, 3).map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 35, scale: 0.92, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, x: 90, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="pointer-events-auto bg-[#141416]/95 border-2 border-red-500/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-start gap-3 relative transition-all duration-300 hover:border-red-500/80"
            >
              <div className="p-2 rounded-xl bg-red-950/40 text-red-400 border border-red-900/30 shrink-0">
                <Bell className="w-4 h-4 animate-swing" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between font-sans">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono">Real-Time Risk Alert</span>
                  <button 
                    onClick={(e) => dismissAlert(alert.id, e)}
                    className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h5 className="text-xs font-extrabold text-white">{alert.customerName}</h5>
                <p className="text-[10px] text-[#A1A1AA] leading-relaxed">
                  Account escalated from <strong className="text-emerald-400">{alert.oldRisk}</strong> to <strong className="text-red-400 uppercase font-mono">{alert.newRisk}</strong> state.
                </p>
                <div className="flex items-center gap-1 text-[9px] text-[#71717A] pt-1 font-mono">
                  <span>Timestamp:</span>
                  <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Embedded Real-Time System Risk Alerts Console Header (Full Width banner if risk count exists) */}
      {riskTransitionAlerts.length > 0 && (
        <div 
          className="bg-[#141416] border border-red-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
          id="realtime-risk-summary-status-bar"
        >
          <div className="flex items-center space-x-3.5">
            <div className="relative shrink-0 p-2.5 bg-red-950/30 border border-red-900/45 text-red-400 rounded-xl">
              <AlertCircle className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white font-mono shadow-md">
                {riskTransitionAlerts.length}
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                Real-Time Risk Alerts Center
                <span className="inline-flex h-2 w-2 rounded-full bg-red-400 animate-ping"></span>
              </h4>
              <p className="text-[11px] text-[#A1A1AA] font-sans mt-0.5 leading-relaxed">
                Detected <strong className="text-white font-mono">{riskTransitionAlerts.length}</strong> active account transitions from <strong className="text-emerald-400">Low Risk</strong> directly to <strong className="text-red-400 uppercase">High Risk / Escalated</strong> status.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            <button
              onClick={() => setShowNotificationCenter(!showNotificationCenter)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A0A0B] border border-red-900/30 hover:border-red-500/50 text-xs font-semibold py-1 rounded-xl text-[#E4E4E7] transition-all cursor-pointer"
            >
              <span>{showNotificationCenter ? "Hide Notification Logs [×]" : "View Risk Notification Logs"}</span>
            </button>
            {dismissedAlerts.length > 0 && (
              <button 
                onClick={() => setDismissedAlerts([])}
                className="text-[10px] font-mono text-[#C5A059] hover:underline cursor-pointer"
              >
                Reset Notifications
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expanded view for risk change notification logs */}
      {showNotificationCenter && riskTransitionAlerts.length > 0 && (
        <div className="bg-[#0A0A0B] border-2 border-red-900/30 rounded-2xl p-4.5 space-y-3 shadow-xl animate-fade-in" id="risk-notification-center-logs">
          <div className="flex items-center justify-between border-b border-[#27272A]/70 pb-2 mb-2">
            <span className="text-[10px] font-bold font-mono uppercase text-red-400 tracking-wider flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" /> High Risk Migration Chronicles (Most Recent First)
            </span>
          </div>

          <div className="divide-y divide-[#27272A]/50 space-y-2">
            {riskTransitionAlerts.map((rec) => (
              <div key={rec.id} className="pt-2 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-xs">{rec.customerName}</span>
                    <span className="text-[9px] font-mono bg-red-950/30 border border-red-900/40 text-red-400 px-1.5 py-0.2 rounded uppercase">
                      Escalated
                    </span>
                  </div>
                  <p className="text-[#A1A1AA] italic leading-relaxed text-[11px]">
                    "{rec.details}"
                  </p>
                  <p className="text-[9px] text-[#71717A] font-mono">
                    Audit Signature: {rec.id} | Status: <span className="text-red-400 font-bold">{rec.oldRisk} ➔ {rec.newRisk}</span>
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#71717A] text-right whitespace-nowrap">
                  {new Date(rec.timestamp).toLocaleDateString()} {new Date(rec.timestamp).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Four Core KPI Grid Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="kpi-cards-grid">
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
        <motion.div 
          initial={{ borderColor: "rgb(39, 39, 42)" }}
          animate={riskTransitionAlerts.length > 0 ? {
            borderColor: ["rgb(39, 39, 42)", "rgb(239, 68, 68)", "rgb(39, 39, 42)"],
            boxShadow: [
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0px rgba(239, 68, 68, 0)",
              "0 20px 30px -5px rgba(0, 0, 0, 0.25), 0 10px 15px -5px rgba(0, 0, 0, 0.1), 0 0 15px rgba(239, 68, 68, 0.35)",
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0px rgba(239, 68, 68, 0)"
            ]
          } : {}}
          transition={riskTransitionAlerts.length > 0 ? {
            duration: 2.0,
            repeat: Infinity,
            ease: "easeInOut"
          } : {}}
          className={`bg-[#141416] border border-[#27272A] border-b-4 rounded-2xl p-6 shadow-xl hover:translate-y-[-2px] transition-all duration-350 relative overflow-hidden group ${
            riskTransitionAlerts.length > 0 ? 'border-red-500' : 'border-red-900'
          }`}
          id="kpi-card-atrisk"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-25 transition-opacity">
            <ShieldAlert className="w-16 h-16 text-red-650" />
          </div>
          <div className="flex items-center space-x-3 mb-3">
            <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${riskTransitionAlerts.length > 0 ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-red-950/25 text-red-400"}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">At-Risk Accounts</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-3xl font-bold font-display tracking-tight transition-colors ${riskTransitionAlerts.length > 0 ? "text-red-500 animate-pulse" : "text-red-400"}`}>
              {atRiskCount}
            </span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ml-2 flex items-center gap-1 uppercase tracking-wide border ${
              riskTransitionAlerts.length > 0 
                ? "text-red-500 bg-red-500/10 border-red-500/30 font-extrabold animate-bounce" 
                : "text-red-400 bg-red-950/50 border-red-900/40"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              {riskTransitionAlerts.length > 0 ? "ALERT LOGGED" : "CRITICAL"}
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
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-red-300 font-mono tracking-tight flex items-center gap-1">
                    Speed: +14.8% / hr
                    <History className={`w-2.5 h-2.5 transition-transform text-[#C5A059] shrink-0 ${showTrendHistory ? 'rotate-180' : ''}`} />
                  </span>
                </div>
              </div>

              {/* Management Intervention Primary Action Button */}
              <button
                type="button"
                onClick={() => setAlertState(alertState ? null : "confirming")}
                className={`p-2 rounded-xl text-[10px] font-bold uppercase font-mono tracking-tight cursor-pointer transition-all border flex items-center gap-1.5 shrink-0 ${
                  alertState === "active"
                    ? "bg-emerald-950/50 border-emerald-500 text-emerald-400 animate-pulse"
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
        </motion.div>
      </div>
    </div>
  );
}
