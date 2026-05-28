import React, { useState, useMemo, useRef, useEffect } from "react";
import { Customer } from "../types";
import { 
  Brain, 
  DollarSign, 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  Send, 
  Check, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Copy,
  Clock
} from "lucide-react";

interface SalesModuleProps {
  customers: Customer[];
  onUpdateState: (type: string, payload: any) => Promise<void>;
  onTriggerIntelligence: (data: { uid: string; dealValue: number; lastInteractionDays: number }) => Promise<void>;
}

export function SalesModule({ customers, onUpdateState, onTriggerIntelligence }: SalesModuleProps) {
  const [filterType, setFilterType] = useState<"all" | "high-risk" | "enterprise" | "in-progress">("all");
  const [selectedUid, setSelectedUid] = useState<string>(customers[0]?.uid || "");
  const [dealValue, setDealValue] = useState<number>(55000);
  const [lastInteraction, setLastInteraction] = useState<number>(5);
  const [runLoading, setRunLoading] = useState(false);

  // Score comparison cache & copy feedback states
  const prevScoresRef = useRef<Record<string, number>>({});
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (customers && customers.length > 0) {
      customers.forEach(c => {
        // Only set if not already tracked so first sync state has initial comparison
        if (prevScoresRef.current[c.uid] === undefined) {
          prevScoresRef.current[c.uid] = c.leadScore;
        }
      });
    }
  }, [customers]);

  const getLeadScoreTrend = (c: Customer) => {
    const prev = prevScoresRef.current[c.uid];
    if (prev === undefined) {
      // Deterministic layout initialization prior to state alterations
      const sum = c.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return sum % 3 === 0 ? "up" : sum % 3 === 1 ? "down" : "stable";
    }
    if (c.leadScore > prev) return "up";
    if (c.leadScore < prev) return "down";
    return "stable";
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const funnelStats = useMemo(() => {
    const counts = { Lead: 0, MQL: 0, SQL: 0, Customer: 0, Churned: 0 };
    customers.forEach(c => {
      if (counts[c.lifecycleStage] !== undefined) {
        counts[c.lifecycleStage]++;
      }
    });
    const total = customers.length || 1;
    return {
      counts,
      percentages: {
        Lead: Math.round((counts.Lead / total) * 100),
        MQL: Math.round((counts.MQL / total) * 100),
        SQL: Math.round((counts.SQL / total) * 100),
        Customer: Math.round((counts.Customer / total) * 100),
        Churned: Math.round((counts.Churned / total) * 100),
      }
    };
  }, [customers]);

  // AI sales prompt states
  const [salesPrompt, setSalesPrompt] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Suggest Fix states
  const [suggestFixLoading, setSuggestFixLoading] = useState<Record<string, boolean>>({});
  const [suggestFixResult, setSuggestFixResult] = useState<Record<string, string>>({});
  const [expandedFixUid, setExpandedFixUid] = useState<string | null>(null);

  // Follow-up Reminders states
  const [reminderTime, setReminderTime] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [reminders, setReminders] = useState<Array<{ id: string; uid: string; customerName: string; time: string; note: string; fired: boolean }>>([]);
  const [activeTriggeredAlert, setActiveTriggeredAlert] = useState<{ id: string; customerName: string; note: string; time: string } | null>(null);

  // Compose / simulated email state
  const [emailForm, setEmailForm] = useState({ subject: "", body: "", sent: false });

  // Filter customers by selected quick-filter criteria
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (filterType === "all") return true;
      if (filterType === "high-risk") {
        return c.dealRiskStatus.toLowerCase().includes("high") || 
               c.dealRiskStatus.toLowerCase().includes("at risk") || 
               c.winProbability <= 45 ||
               c.lastInteractionDays > 14;
      }
      if (filterType === "enterprise") {
        return c.tier === "Enterprise";
      }
      if (filterType === "in-progress") {
        return c.lifecycleStage === "Lead" || c.lifecycleStage === "MQL" || c.lifecycleStage === "SQL";
      }
      return true;
    });
  }, [customers, filterType]);

  // Compute active customer context safely
  const activeCustomer = useMemo(() => {
    return filteredCustomers.find(c => c.uid === selectedUid) || 
           filteredCustomers[0] ||
           customers.find(c => c.uid === selectedUid) || 
           customers[0];
  }, [filteredCustomers, customers, selectedUid]);

  // Handle precise customer updates programmatically
  const handleSelectCustomer = (uid: string) => {
    setSelectedUid(uid);
    const cust = customers.find(c => c.uid === uid);
    if (cust) {
      setDealValue(cust.lifetimeValue || 45000);
      setLastInteraction(cust.lastInteractionDays);
    }
  };

  // Generate automated real-time risk alerts across all accounts
  const automatedAlerts = useMemo(() => {
    const alerts: Array<{ uid: string; customerName: string; reason: string; severity: "critical" | "warning"; rule: string }> = [];
    customers.forEach(c => {
      const isHighStatus = c.dealRiskStatus.toLowerCase().includes("high") || c.dealRiskStatus.toLowerCase().includes("at risk");
      if (isHighStatus || c.winProbability < 40) {
        alerts.push({
          uid: c.uid,
          customerName: c.name,
          reason: `Deal stability critically low (${c.winProbability}%) diagnosed under status "${c.dealRiskStatus}"`,
          severity: "critical",
          rule: "WIN_CONFIDENCE"
        });
      }
      if (c.lastInteractionDays > 14) {
        alerts.push({
          uid: c.uid,
          customerName: c.name,
          reason: `Inactivity breach: ${c.lastInteractionDays} days elapsed without touchpoint updates.`,
          severity: c.lastInteractionDays > 20 ? "critical" : "warning",
          rule: "CONTACT_DORMANCY"
        });
      }
    });
    return alerts;
  }, [customers]);

  const handleRunModel = async () => {
    if (!activeCustomer) return;
    setRunLoading(true);
    await onTriggerIntelligence({
      uid: activeCustomer.uid,
      dealValue: Number(dealValue),
      lastInteractionDays: Number(lastInteraction)
    });
    setRunLoading(false);
  };

  const handleAskSalesAI = async (customPrompt?: string) => {
    const promptToUse = customPrompt || salesPrompt;
    if (!promptToUse.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToUse,
          mode: "sales",
          customerContext: activeCustomer,
          useSearch: false
        })
      });
      const data = await response.json();
      setAiDraft(data.text);
      
      // Auto-extract lines to suggest email subject & body
      const subjectMatch = data.text.match(/Subject:\s*(.*)/i);
      const cleanedBody = data.text.replace(/###[\s\S]*?\n/g, "").replace(/Subject:\s*(.*)/i, "").trim();
      setEmailForm({
        subject: subjectMatch ? subjectMatch[1] : `Special Proposal for ${activeCustomer?.name}`,
        body: cleanedBody || data.text,
        sent: false
      });
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendSimulatedEmail = async () => {
    if (!activeCustomer) return;
    try {
      await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: activeCustomer.email,
          subject: emailForm.subject,
          body: emailForm.body,
          language: "English"
        })
      });
      setEmailForm(prev => ({ ...prev, sent: true }));
      // reload logs list
      onUpdateState("REFRESH_LOGS", {});
    } catch (e) {
      console.error(e);
    }
  };

  const playReminderChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.error("Audio chime error:", err);
    }
  };

  const handleSuggestFix = async (e: React.MouseEvent, alertUid: string) => {
    e.stopPropagation();
    const targetCustomer = customers.find(c => c.uid === alertUid);
    if (!targetCustomer) return;

    setExpandedFixUid(alertUid === expandedFixUid ? null : alertUid);
    if (suggestFixResult[alertUid]) return;

    setSuggestFixLoading(prev => ({ ...prev, [alertUid]: true }));
    try {
      const response = await fetch("/api/gemini/suggest-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: targetCustomer })
      });
      const data = await response.json();
      setSuggestFixResult(prev => ({ ...prev, [alertUid]: data.text }));
    } catch (err) {
      console.error(err);
      setSuggestFixResult(prev => ({ ...prev, [alertUid]: "Could not retrieve copilot recommendation. Check connections." }));
    } finally {
      setSuggestFixLoading(prev => ({ ...prev, [alertUid]: false }));
    }
  };

  const handleAutoEscalate = async () => {
    if (!activeCustomer) return;
    try {
      // 1. Adds audit log and updates risk status database set in Firestore
      await onUpdateState("ESCALATE_DEAL", { uid: activeCustomer.uid });

      // 2. Draft notification email to assigned rep
      setEmailForm({
        subject: `[ESCALATED RISK ALERT] Senior Manager Escalation Notice: ${activeCustomer.name}`,
        body: `Hello ${activeCustomer.assignedRep},\n\nThis is an automated system confirmation that the risk profile for account ${activeCustomer.name} (${activeCustomer.email}) has been set to 'Escalated'.\n\nYour executive management lead has been formally pulled into review parameters.\n\nAction Plan: please review the CRM Audit logs of recent interactions immediately to construct recovery plans.\n\nRespectfully,\nCRM Automation Engine`,
        sent: false
      });

      // 3. Append note to customer notes
      const escalationLine = `- [Manager Escalation set at ${new Date().toLocaleString()}]: Status set Escalated. Owner ${activeCustomer.assignedRep} alerted via drafted notice.`;
      const updatedNotes = activeCustomer.notes ? `${activeCustomer.notes}\n${escalationLine}` : escalationLine;
      await onUpdateState("UPDATE_CUSTOMER", { uid: activeCustomer.uid, notes: updatedNotes });

    } catch (e) {
      console.error(e);
    }
  };

  const handleSetReminder = async () => {
    if (!activeCustomer || !reminderTime) return;

    const targetTime = reminderTime;
    const desc = reminderNote.trim() || `Follow up check-in with ${activeCustomer.name}`;
    
    // Log reminder task note
    const timestampStr = new Date(targetTime).toLocaleString();
    const noteLine = `- [Alert Scheduled for ${timestampStr}]: ${desc}`;
    const updatedNotes = activeCustomer.notes ? `${activeCustomer.notes}\n${noteLine}` : noteLine;
    
    await onUpdateState("UPDATE_CUSTOMER", {
      uid: activeCustomer.uid,
      notes: updatedNotes
    });

    const newReminder = {
      id: `rem_${Date.now()}`,
      uid: activeCustomer.uid,
      customerName: activeCustomer.name,
      time: targetTime,
      note: desc,
      fired: false
    };

    setReminders(prev => [...prev, newReminder]);
    setReminderTime("");
    setReminderNote("");
  };

  const getActivityHistory = (uid: string, lastInteractionDays: number) => {
    const seed = uid.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const history = [];
    for (let i = 0; i < 7; i++) {
      const rand = Math.sin(seed + i) * 0.5 + 0.5;
      const multiplier = lastInteractionDays > 14 ? 0.25 : lastInteractionDays > 7 ? 0.6 : 1.3;
      const base = Math.floor(rand * 5 * multiplier);
      if (i === 6 - lastInteractionDays) {
        history.push(Math.max(1, base));
      } else {
        history.push(base);
      }
    }
    return history;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      reminders.forEach((r) => {
        if (!r.fired && now >= new Date(r.time).getTime()) {
          r.fired = true;
          setReminders(prev => prev.map(rem => rem.id === r.id ? { ...rem, fired: true } : rem));
          
          playReminderChime();
          setActiveTriggeredAlert({
            id: r.id,
            customerName: r.customerName,
            note: r.note,
            time: r.time
          });

          try {
            setTimeout(() => {
              window.alert(`🔔 Follow-up Reminder Fired!\n\nCustomer: ${r.customerName}\nTime: ${new Date(r.time).toLocaleString()}\nTask: ${r.note}`);
            }, 100);
          } catch (e) {
            console.warn("Iframe window.alert restricted:", e);
          }
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reminders]);

  return (
    <div className="space-y-6 w-full animate-fade-in text-sans" id="sales-module-wrapper">
      {/* Sales funnel health summary dashboard */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-5 shadow-xl font-sans" id="sales-funnel-dashboard">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 border-b border-[#27272A]/70 pb-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#C5A059]" />
            <span className="text-sm font-bold uppercase font-display text-[#E4E4E7] tracking-tight">Sales Funnel Health & Diagnostics</span>
          </div>
          <span className="text-[10px] font-mono text-[#A1A1AA] bg-[#0A0A0B] border border-[#27272A] px-2 py-0.5 rounded">Total Funnel Pipeline: {customers.length} Accounts</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* LEAD stage */}
          <div className="bg-[#0A0A0B] border border-[#27272A]/60 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">Leads</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              </div>
              <span className="text-2xl font-black text-white font-mono mt-1.5 block">
                {funnelStats.counts.Lead}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-[#71717A] font-mono">
              <div className="flex justify-between items-center mb-0.5">
                <span>Ratio</span>
                <span>{funnelStats.percentages.Lead}%</span>
              </div>
              <div className="w-full bg-[#141416] h-1 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full transition-all duration-500" style={{ width: `${funnelStats.percentages.Lead}%` }}></div>
              </div>
            </div>
          </div>

          {/* MQL stage */}
          <div className="bg-[#0A0A0B] border border-[#27272A]/60 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">MQL</span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
              </div>
              <span className="text-2xl font-black text-white font-mono mt-1.5 block">
                {funnelStats.counts.MQL}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-[#71717A] font-mono">
              <div className="flex justify-between items-center mb-0.5">
                <span>Ratio</span>
                <span>{funnelStats.percentages.MQL}%</span>
              </div>
              <div className="w-full bg-[#141416] h-1 rounded-full overflow-hidden">
                <div className="bg-violet-400 h-full rounded-full transition-all duration-500" style={{ width: `${funnelStats.percentages.MQL}%` }}></div>
              </div>
            </div>
          </div>

          {/* SQL stage */}
          <div className="bg-[#0A0A0B] border border-[#27272A]/60 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">SQL</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </div>
              <span className="text-2xl font-black text-white font-mono mt-1.5 block">
                {funnelStats.counts.SQL}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-[#71717A] font-mono">
              <div className="flex justify-between items-center mb-0.5">
                <span>Ratio</span>
                <span>{funnelStats.percentages.SQL}%</span>
              </div>
              <div className="w-full bg-[#141416] h-1 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${funnelStats.percentages.SQL}%` }}></div>
              </div>
            </div>
          </div>

          {/* Active Customers */}
          <div className="bg-[#0A0A0B] border border-[#27272A]/60 rounded-xl p-3 flex flex-col justify-between col-span-1">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">Contracts</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <span className="text-2xl font-black text-white font-mono mt-1.5 block">
                {funnelStats.counts.Customer}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-[#71717A] font-mono">
              <div className="flex justify-between items-center mb-0.5">
                <span>Ratio</span>
                <span>{funnelStats.percentages.Customer}%</span>
              </div>
              <div className="w-full bg-[#141416] h-1 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${funnelStats.percentages.Customer}%` }}></div>
              </div>
            </div>
          </div>

          {/* Churned stage */}
          <div className="bg-[#0A0A0B] border border-[#27272A]/60 rounded-xl p-3 flex flex-col justify-between col-span-1">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">Churned</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
              </div>
              <span className="text-2xl font-black text-white font-mono mt-1.5 block">
                {funnelStats.counts.Churned}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-[#71717A] font-mono">
              <div className="flex justify-between items-center mb-0.5">
                <span>Ratio</span>
                <span>{funnelStats.percentages.Churned}%</span>
              </div>
              <div className="w-full bg-[#141416] h-1 rounded-full overflow-hidden">
                <div className="bg-red-400 h-full rounded-full transition-all duration-500" style={{ width: `${funnelStats.percentages.Churned}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="sales-module-container">
      {/* LEFT: Target customer selector & Risk Model */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* 1. AUTOMATED PIPELINE RISK ALERTS */}
        <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A]" id="automated-risk-alerts-panel">
          <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3">
            <div className="flex items-center space-x-2.5">
              <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
              <h3 className="text-sm font-bold text-[#E4E4E7] tracking-tight uppercase font-display">Automated Risk Alerts</h3>
            </div>
            <span className="text-[9px] font-mono bg-red-950/20 text-red-400 border border-red-900/30 px-2.2 py-0.5 rounded font-extrabold uppercase tracking-wide">REAL-TIME RISK ENGINE</span>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {automatedAlerts.length > 0 ? (
              automatedAlerts.map((alert, index) => (
                <div
                  key={`${alert.uid}-${index}`}
                  onClick={() => handleSelectCustomer(alert.uid)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 cursor-pointer ${
                    alert.severity === "critical"
                    ? "bg-red-950/10 border-red-900/40 hover:border-red-900/60"
                    : "bg-amber-950/10 border-amber-900/30 hover:border-amber-900/50"
                  }`}
                  title="Click to load prospect into active intelligence preview"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${alert.severity === "critical" ? "text-red-400" : "text-amber-400"}`} />
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-white truncate">{alert.customerName}</span>
                        <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                          alert.severity === "critical" ? "bg-red-950 text-red-400" : "bg-amber-950 text-amber-400"
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A1A1AA] font-sans leading-normal">
                        {alert.reason}
                      </p>
                    </div>
                  </div>

                  {/* Suggest Fix button integration */}
                  <div className="flex items-center justify-between border-t border-[#27272A]/40 pt-2 mt-1">
                    <span className="text-[9px] font-mono text-[#71717A]">Risk level: {alert.severity}</span>
                    <button
                      onClick={(e) => handleSuggestFix(e, alert.uid)}
                      type="button"
                      className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-black bg-[#C5A059] hover:bg-[#C5A059]/90 rounded-md transition-colors cursor-pointer flex items-center gap-1 shrink-0 shadow-lg font-mono"
                    >
                      <Brain className="w-2.5 h-2.5" />
                      Suggest Fix
                    </button>
                  </div>

                  {/* Collapsible copilot plan detail result */}
                  {expandedFixUid === alert.uid && (
                    <div className="mt-1 pb-1 text-xs border-t border-[#27272A]/50 pt-2 text-[#A1A1AA] space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-[#C5A059] font-mono flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-[#C5A059] animate-pulse" /> Gemini Recovery Plan:
                        </span>
                        <button 
                          onClick={() => setExpandedFixUid(null)} 
                          className="text-[#71717A] hover:text-white text-[10px] font-mono"
                        >
                          ✕ Close
                        </button>
                      </div>
                      {suggestFixLoading[alert.uid] ? (
                        <div className="flex items-center space-x-2 py-2">
                          <div className="w-3 h-3 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin"></div>
                          <span className="font-mono text-[9px] text-[#71717A] animate-pulse">Consulting Gemini Copilot...</span>
                        </div>
                      ) : (
                        <div className="text-[10.5px] max-w-none text-[#D4D4D8] leading-relaxed bg-[#0A0A0B]/85 p-2.5 rounded-lg border border-[#27272A] whitespace-pre-line font-mono select-text">
                          {suggestFixResult[alert.uid]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-7 text-center text-xs text-emerald-400 bg-emerald-950/10 border border-emerald-950/20 rounded-xl space-y-1">
                <Check className="w-5 h-5 mx-auto text-emerald-400" />
                <p className="font-bold font-mono text-[10px] uppercase">CRM Shield Active</p>
                <p className="text-[#A1A1AA] text-[9px] px-4 font-sans leading-relaxed">
                  All active pipelines operate within safe dormancy, interaction limits, and win confidence ratios.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 2. MAIN PROSPECTOR & WIN PREDICTOR */}
        <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A]" id="opportunity-scoring-card">
          <div className="flex items-center space-x-2.5 mb-5 border-b border-[#27272A] pb-3">
            <Brain className="w-5 h-5 text-[#C5A059]" />
            <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight">Opportunity & Win Predictor</h3>
          </div>

          <div className="space-y-4">
            {/* Quick-Filter Segment Pills */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[#A1A1AA] uppercase font-sans">
                Prospecting Segment Filter:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  { id: "all", label: "All Accounts" },
                  { id: "high-risk", label: "⚠️ High-Risk" },
                  { id: "enterprise", label: "⭐ Enterprise-Tier" },
                  { id: "in-progress", label: "⏳ In-Progress Deals" }
                ].map(pill => {
                  const isSelected = filterType === pill.id;
                  const count = customers.filter(c => {
                    if (pill.id === "all") return true;
                    if (pill.id === "high-risk") {
                      return c.dealRiskStatus.toLowerCase().includes("high") || 
                             c.dealRiskStatus.toLowerCase().includes("at risk") || 
                             c.winProbability <= 45 ||
                             c.lastInteractionDays > 14;
                    }
                    if (pill.id === "enterprise") {
                      return c.tier === "Enterprise";
                    }
                    if (pill.id === "in-progress") {
                      return c.lifecycleStage === "Lead" || c.lifecycleStage === "MQL" || c.lifecycleStage === "SQL";
                    }
                    return true;
                  }).length;

                  return (
                    <button
                      key={pill.id}
                      onClick={() => {
                        setFilterType(pill.id as any);
                        const matches = customers.filter(c => {
                          if (pill.id === "all") return true;
                          if (pill.id === "high-risk") {
                            return c.dealRiskStatus.toLowerCase().includes("high") || 
                                   c.dealRiskStatus.toLowerCase().includes("at risk") || 
                                   c.winProbability <= 45 ||
                                   c.lastInteractionDays > 14;
                          }
                          if (pill.id === "enterprise") {
                            return c.tier === "Enterprise";
                          }
                          if (pill.id === "in-progress") {
                            return c.lifecycleStage === "Lead" || c.lifecycleStage === "MQL" || c.lifecycleStage === "SQL";
                          }
                          return true;
                        });
                        if (matches.length > 0) {
                          setSelectedUid(matches[0].uid);
                          setDealValue(matches[0].lifetimeValue || 55000);
                          setLastInteraction(matches[0].lastInteractionDays);
                        }
                      }}
                      type="button"
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                        isSelected 
                        ? "bg-[#C5A059] text-[#0A0A0B] font-extrabold shadow-md" 
                        : "bg-[#0A0A0B] border border-[#27272A] text-[#A1A1AA] hover:text-[#E4E4E7]"
                      }`}
                    >
                      {pill.label} <span className="text-[10px] opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Prospect Click Matrix Card Deck */}
            <div className="space-y-1.5">
              <span className="block text-[10px] uppercase font-mono tracking-wider text-[#71717A]">
                Select Prospect Account ({filteredCustomers.length}):
              </span>
              <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(c => {
                    const isSelected = activeCustomer?.uid === c.uid;
                    const trend = getLeadScoreTrend(c);
                    return (
                      <button
                        key={c.uid}
                        onClick={() => handleSelectCustomer(c.uid)}
                        type="button"
                        className={`p-2 rounded-xl text-left border transition-all truncate text-xs cursor-pointer flex flex-col justify-between h-[64px] ${
                          isSelected 
                          ? "bg-[#C5A059]/10 border-[#C5A059] text-white" 
                          : "bg-[#0A0A0B] border-[#27272A] hover:border-[#71717A]/40 text-[#A1A1AA] hover:text-[#E4E4E7]"
                        }`}
                      >
                        <span className="font-semibold text-white block truncate w-full">{c.name}</span>
                        <div className="flex justify-between items-center text-[9px] font-mono mt-1 w-full text-[#71717A]">
                          <span>{c.tier}</span>
                          <span className="flex items-center space-x-0.5 text-[#A1A1AA]">
                            <span>LS: {c.leadScore}</span>
                            {trend === "up" ? (
                              <ArrowUp className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            ) : trend === "down" ? (
                              <ArrowDown className="w-2.5 h-2.5 text-red-400 shrink-0" />
                            ) : (
                              <span className="text-[#71717A] text-[7px] font-bold shrink-0">─</span>
                            )}
                          </span>
                          <span className={`font-bold ${c.winProbability > 75 ? "text-emerald-400" : c.winProbability > 50 ? "text-amber-400" : "text-red-400"}`}>
                            {c.winProbability}% win
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-4 text-center text-xs font-mono text-[#71717A] bg-[#0A0A0B] border border-[#27272A] rounded-xl">
                    No matching accounts in active segment filter.
                  </div>
                )}
              </div>
            </div>

            {/* Target select drop back fallback */}
            <div>
              <label className="block text-xs font-semibold text-[#A1A1AA] uppercase mb-1.5 font-sans">Or Select Target Dropdown</label>
              <select 
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-4 py-3 text-[#E4E4E7] focus:outline-none focus:border-[#C5A059] text-sm"
                value={activeCustomer?.uid || ""}
                onChange={(e) => handleSelectCustomer(e.target.value)}
              >
                {filteredCustomers.map(c => (
                  <option key={c.uid} value={c.uid}>
                    {c.name} — Stage: {c.lifecycleStage} (Rep: {c.assignedRep})
                  </option>
                ))}
              </select>
            </div>

            {activeCustomer && (
              <div className="bg-[#0A0A0B] rounded-xl p-4 border border-[#27272A] text-sm space-y-3.5">
                <div className="flex justify-between items-center">
                  <span className="text-[#A1A1AA]">Assigned Owner:</span>
                  <span className="text-[#E4E4E7] font-semibold">{activeCustomer.assignedRep}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A1A1AA]">Email Address:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[#E4E4E7] font-mono text-xs truncate max-w-[150px]" title={activeCustomer.email}>
                      {activeCustomer.email}
                    </span>
                    <button
                      onClick={() => handleCopyEmail(activeCustomer.email)}
                      type="button"
                      className="text-zinc-400 hover:text-[#C5A059] p-1 bg-zinc-900 hover:bg-zinc-800 rounded transition-colors border border-zinc-800 cursor-pointer"
                      title="Copy email to clipboard"
                    >
                      {copiedEmail ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A1A1AA] font-sans">Current Lead Score:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[#E4E4E7] font-bold">{activeCustomer.leadScore}/100</span>
                    {getLeadScoreTrend(activeCustomer) === "up" ? (
                      <span className="flex items-center text-[10px] font-bold text-emerald-400 font-mono bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/30">
                        <ArrowUp className="w-2.5 h-2.5 mr-0.5 shrink-0 animate-bounce" /> UP
                      </span>
                    ) : getLeadScoreTrend(activeCustomer) === "down" ? (
                      <span className="flex items-center text-[10px] font-bold text-red-400 font-mono bg-red-950/40 px-1.5 py-0.5 rounded border border-red-900/30">
                        <ArrowDown className="w-2.5 h-2.5 mr-0.5 shrink-0" /> DOWN
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-[#71717A] bg-zinc-900 font-mono px-1.5 py-0.5 rounded border border-zinc-800">STABLE</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A1A1AA] font-sans">Win Predictability:</span>
                  <span className={`font-bold ${activeCustomer.winProbability > 75 ? "text-emerald-400" : activeCustomer.winProbability > 50 ? "text-amber-400" : "text-red-400"}`}>
                    {activeCustomer.winProbability}%
                  </span>
                </div>
                <div className="flex justify-between items-center font-sans">
                  <span className="text-[#A1A1AA]">Risk Status:</span>
                  <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                    (activeCustomer.dealRiskStatus || "").toLowerCase().includes("high") || 
                    (activeCustomer.dealRiskStatus || "").toLowerCase().includes("at risk") 
                    ? "bg-red-950/40 text-red-400 border border-red-900/40 animate-pulse" 
                    : (activeCustomer.dealRiskStatus || "").toLowerCase() === "escalated"
                    ? "bg-purple-950/40 text-purple-400 border border-purple-900/40 uppercase font-black tracking-wide"
                    : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
                  }`}>
                    {activeCustomer.dealRiskStatus}
                  </span>
                </div>

                {/* AUTO-ESCALATE TRIGGER BUTTON (FOR HIGH RISK OR ESCALATABLE DEALS) */}
                {((activeCustomer.dealRiskStatus || "").toLowerCase().includes("high") || 
                  (activeCustomer.dealRiskStatus || "").toLowerCase().includes("at risk") || 
                  activeCustomer.winProbability <= 45) && (
                  <button
                    type="button"
                    onClick={handleAutoEscalate}
                    className="w-full mt-1.5 py-2 px-3 text-xs bg-red-950/30 text-red-400 hover:text-white border border-red-900/40 hover:border-red-500/40 hover:bg-red-950/60 rounded-xl font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 font-mono cursor-pointer shadow-lg"
                    title="Logs manager review instance and automatically pre-drafts check-in copy"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Auto-Escalate to Manager
                  </button>
                )}

                {/* 7-DAY ACTIVITY SPARKLINE VISUALIZATION */}
                <div className="pt-3 border-t border-[#27272A]/70 flex items-center justify-between" id="sparkline-block">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-mono font-bold">7-Day Touches</span>
                    <span className="text-xs text-white block font-sans">
                      {getActivityHistory(activeCustomer.uid, activeCustomer.lastInteractionDays).reduce((a, b) => a + b, 0)} interactions
                    </span>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <svg className="w-[120px] h-[32px] overflow-visible" viewBox="0 0 120 32">
                      <defs>
                        <linearGradient id={`sparkGrad-${activeCustomer.uid}`} x1="0" y1="y1" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C5A059" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#C5A059" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M 0 32 L ${getActivityHistory(activeCustomer.uid, activeCustomer.lastInteractionDays).map((val, idx) => {
                          const maxVal = Math.max(...getActivityHistory(activeCustomer.uid, activeCustomer.lastInteractionDays), 1);
                          const x = (idx / 6) * 120;
                          const y = 30 - (val / maxVal) * 26;
                          return `${x} ${y}`;
                        }).join(" L ")} L 120 32 Z`}
                        fill={`url(#sparkGrad-${activeCustomer.uid})`}
                      />
                      <polyline
                        fill="none"
                        stroke="#C5A059"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={getActivityHistory(activeCustomer.uid, activeCustomer.lastInteractionDays).map((val, idx) => {
                          const maxVal = Math.max(...getActivityHistory(activeCustomer.uid, activeCustomer.lastInteractionDays), 1);
                          const x = (idx / 6) * 120;
                          const y = 30 - (val / maxVal) * 26;
                          return `${x},${y}`;
                        }).join(" ")}
                      />
                      {getActivityHistory(activeCustomer.uid, activeCustomer.lastInteractionDays).map((val, idx) => {
                        const maxVal = Math.max(...getActivityHistory(activeCustomer.uid, activeCustomer.lastInteractionDays), 1);
                        const x = (idx / 6) * 120;
                        const y = 30 - (val / maxVal) * 26;
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r="2.5"
                            className="fill-[#C5A059] stroke-[#0A0A0B] stroke-[1px]"
                          />
                        );
                      })}
                    </svg>
                    <div className="flex justify-between w-[120px] text-[8px] text-[#71717A] font-mono leading-none">
                      <span>7d ago</span>
                      <span>Today</span>
                    </div>
                  </div>
                </div>

                {/* INTERNAL COMPLIANCE NOTES AREA */}
                <div className="pt-3 border-t border-[#27272A]/70 space-y-1.5">
                  <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-mono font-bold block">Internal Notes Field</span>
                  {activeCustomer.notes ? (
                    <div className="bg-[#141416]/50 border border-[#27272A]/40 p-2 text-xs text-[#E4E4E7] font-mono rounded h-[65px] overflow-y-auto whitespace-pre-line leading-relaxed scrollbar-thin select-text">
                      {activeCustomer.notes}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#71717A] italic block font-sans">No compliance notes logged yet. Reminders append automatically.</span>
                  )}
                </div>

                {/* SET FOLLOW-UP REMINDER SECTION */}
                <div className="pt-3 border-t border-[#27272A]/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-mono font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C5A059]" /> Set follow-up reminder
                    </span>
                    <span className="text-[8px] font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded text-zinc-500 uppercase">Alert Sync</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                    <input
                      type="datetime-local"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="bg-[#141416] border border-[#27272A] text-[10px] px-2.5 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-[#C5A059] w-full"
                    />
                    <input
                      type="text"
                      placeholder="Reminder Note..."
                      value={reminderNote}
                      onChange={(e) => setReminderNote(e.target.value)}
                      className="bg-[#141416] border border-[#27272A] text-[10px] px-2.5 py-1.5 rounded-lg text-white focus:outline-none focus:border-[#C5A059] placeholder-zinc-700 w-full"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleSetReminder}
                    disabled={!reminderTime}
                    className="w-full bg-[#C5A059]/10 hover:bg-[#C5A059]/20 border border-[#C5A059]/20 hover:border-[#C5A059]/40 text-[#C5A059] py-1.5 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer"
                  >
                    Set Follow-up Reminder
                  </button>

                  {/* Active scheduled reminders list for customer */}
                  {reminders.filter(r => r.uid === activeCustomer.uid && !r.fired).length > 0 && (
                    <div className="space-y-1 mt-1.5 pt-1.5 border-t border-[#1f1f21]">
                      <span className="text-[9px] font-mono text-[#C5A059] font-bold uppercase">Pending Alerts:</span>
                      {reminders.filter(r => r.uid === activeCustomer.uid && !r.fired).map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-[#141416]/40 p-2 rounded border border-[#27272A]/40 text-[9.5px] font-mono text-zinc-400">
                          <span className="truncate max-w-[140px]">{r.note || "Check-in"}</span>
                          <span>{new Date(r.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3.5 pt-2">
              <div>
                <div className="flex justify-between text-xs font-semibold text-[#A1A1AA] mb-1">
                  <span>PROJECTED DEAL VALUE</span>
                  <span className="font-mono text-[#C5A059] font-bold">${dealValue.toLocaleString()}</span>
                </div>
                <div className="relative flex items-center">
                  <DollarSign className="absolute left-3 w-4 h-4 text-[#A1A1AA]" />
                  <input 
                    type="number"
                    value={dealValue}
                    onChange={(e) => setDealValue(Number(e.target.value))}
                    className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl pl-9 pr-4 py-2.5 text-[#E4E4E7] text-sm focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-[#A1A1AA] mb-1">
                  <span>LAST INTERACTION DAYS ELAPSED</span>
                  <span className="font-mono text-[#C5A059] font-bold">{lastInteraction} Days</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="30"
                  value={lastInteraction}
                  onChange={(e) => setLastInteraction(Number(e.target.value))}
                  className="w-full accent-[#C5A059] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#A1A1AA]/75 font-mono mt-1">
                  <span>Immediate (0d)</span>
                  <span>Risk limit (14d)</span>
                  <span>Critical inactive (30d)</span>
                </div>
              </div>

              <button
                onClick={handleRunModel}
                disabled={runLoading}
                className="w-full bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-bold py-3 px-4 rounded-xl shadow-md transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
                id="run-predictive-risk-trigger"
              >
                <RefreshCw className={`w-4 h-4 ${runLoading ? "animate-spin" : ""}`} />
                <span>Calculate Win Predictability & Update Firestore</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: AI proposal assistance panel */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] flex flex-col h-full" id="ai-proposal-studio">
          <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-3">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-5 h-5 text-[#C5A059]" />
              <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight font-display">AI Proposal & Follow-up Copilot</h3>
            </div>
            <span className="text-[10px] font-mono bg-white/5 text-[#E4E4E7] border border-[#27272A] px-2 py-1 rounded">GEMINI INTELLIGENCE</span>
          </div>

          <div className="space-y-4 flex-1">
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Generate highly personalized corporate sales pitches or client follow-ups instantly by blending automated lifecycle rules and real-time deal data.
            </p>

            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => {
                  setSalesPrompt(`Write a highly compelling enterprise upgrade proposal email for ${activeCustomer?.name} moving them to Enterprise Tier. Offer special deal metrics!`);
                  handleAskSalesAI(`Write a highly compelling enterprise upgrade proposal email for ${activeCustomer?.name} moving them to Enterprise Tier. Offer special deal metrics!`);
                }}
                className="text-xs bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#C5A059] px-3 py-1.5 rounded-lg transition-colors border border-[#C5A059]/20 font-medium cursor-pointer"
              >
                ✨ Upgrade Pitch
              </button>
              <button 
                onClick={() => {
                  setSalesPrompt(`Draft a polite, gentle check-in follow-up message addressing the ${lastInteraction} days of inactivity. Re-establish momentum and build relationship.`);
                  handleAskSalesAI(`Draft a polite, gentle check-in follow-up message addressing the ${lastInteraction} days of inactivity. Re-establish momentum and build relationship.`);
                }}
                className="text-xs bg-white/5 hover:bg-white/10 text-[#E4E4E7] px-3 py-1.5 rounded-lg transition-colors border border-[#27272A] font-medium cursor-pointer"
              >
                🕒 Re-engagement sequence
              </button>
            </div>

            <div className="relative">
              <textarea 
                rows={3}
                value={salesPrompt}
                onChange={(e) => setSalesPrompt(e.target.value)}
                placeholder="Instruct the AI sales assistant manually... e.g., 'Draft a custom discount proposal of 10%.'"
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl p-4 text-sm text-[#E4E4E7] focus:outline-none focus:border-[#C5A059] resize-none pr-12 font-sans"
              />
              <button
                onClick={() => handleAskSalesAI()}
                disabled={aiLoading || !salesPrompt.trim()}
                className="absolute bottom-3 right-3 p-2 bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] rounded-lg disabled:opacity-50 transition-all shadow cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {aiLoading && (
              <div className="flex items-center justify-center py-10 space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059] animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059] animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059] animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                <span className="text-xs text-[#A1A1AA] font-mono pl-1">Gemini is synthesizing proposal...</span>
              </div>
            )}

            {!aiLoading && aiDraft && (
              <div className="mt-4 border border-[#27272A] rounded-xl overflow-hidden shadow-xl" id="sales-draft-email-preview">
                <div className="bg-[#0A0A0B] border-b border-[#27272A] px-4 py-3 flex justify-between items-center">
                  <span className="text-xs font-mono text-[#A1A1AA]">Simulated Email Draft Outlet</span>
                  <span className="text-[10px] bg-[#C5A059]/10 text-[#C5A059] px-2 py-0.5 rounded border border-[#C5A059]/30 font-semibold font-mono">STANDALONE PREVIEW</span>
                </div>
                
                <div className="p-4 space-y-3 bg-[#141416] max-h-[220px] overflow-y-auto text-sm text-[#E4E4E7] font-sans leading-relaxed">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#A1A1AA] mb-0.5">Subject</label>
                    <input 
                      type="text" 
                      value={emailForm.subject} 
                      onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full bg-[#0A0A0B] border border-[#27272A] rounded px-2.5 py-1.5 text-xs text-[#E4E4E7] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#A1A1AA] mb-0.5">Body</label>
                    <textarea 
                      rows={5} 
                      value={emailForm.body} 
                      onChange={(e) => setEmailForm(prev => ({ ...prev, body: e.target.value }))}
                      className="w-full bg-[#0A0A0B] border border-[#27272A] rounded p-2 text-xs text-[#E4E4E7] font-mono"
                    />
                  </div>
                </div>

                <div className="bg-[#050505] px-4 py-2.5 border-t border-[#27272A] flex items-center justify-between">
                  {emailForm.sent ? (
                    <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-semibold">
                      <Check className="w-4 h-4" />
                      <span>Email successfully logged in Firestore!</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-[#A1A1AA]">Auto-routes through GmailApp via App Script.</span>
                      <button
                        onClick={handleSendSimulatedEmail}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-1.5 px-3.5 rounded-lg flex items-center space-x-1 transition-colors shadow shadow-emerald-950 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Log & Send Email</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {activeTriggeredAlert && (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen font-sans">
        <div className="bg-[#141416] border-2 border-[#C5A059] rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 text-center">
          <div className="w-16 h-16 bg-[#C5A059]/10 text-[#C5A059] rounded-full flex items-center justify-center mx-auto border border-[#C5A059]/40 animate-bounce">
            <Clock className="w-7 h-7" />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono tracking-widest text-[#C5A059] uppercase font-bold block">Follow-Up Notification</span>
            <h4 className="text-xl font-black text-white">{activeTriggeredAlert.customerName}</h4>
            <p className="text-[11px] font-mono text-[#71717A]">{new Date(activeTriggeredAlert.time).toLocaleString()}</p>
          </div>
          
          <p className="text-sm text-[#D4D4D8] bg-[#0A0A0B] p-3 rounded-xl border border-[#27272A] whitespace-pre-line leading-relaxed italic">
            "{activeTriggeredAlert.note}"
          </p>
          
          <button
            onClick={() => setActiveTriggeredAlert(null)}
            className="w-full bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] py-2.5 rounded-xl font-bold font-mono uppercase tracking-wider text-xs transition-transform hover:scale-[1.02] active:scale-[95] cursor-pointer shadow-lg"
          >
            Acknowledge & Sync CRM Task
          </button>
        </div>
      </div>
    )}
    </div>
  );
}
