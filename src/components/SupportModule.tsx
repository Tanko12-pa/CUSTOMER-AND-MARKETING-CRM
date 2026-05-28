import React, { useState } from "react";
import { SupportTicket, Customer } from "../types";
import { MessageSquare, ShieldAlert, Sparkles, Send, CheckSquare, Smile, Frown, Meh, AlertTriangle } from "lucide-react";

interface SupportModuleProps {
  tickets: SupportTicket[];
  customers: Customer[];
  onUpdateState: (type: string, payload: any) => Promise<void>;
}

export function SupportModule({ tickets, customers, onUpdateState }: SupportModuleProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.ticket_id || "");
  const [ticketPrompt, setTicketPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [newTicketIssue, setNewTicketIssue] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [newTicketCustomer, setNewTicketCustomer] = useState(customers[0]?.uid || "");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Customer Self-Service Portal Simulator states
  const [isCustomerPortal, setIsCustomerPortal] = useState(false);
  const [portalCustomerUid, setPortalCustomerUid] = useState(customers[0]?.uid || "");
  const [portalIssueText, setPortalIssueText] = useState("");
  const [portalSentimentResult, setPortalSentimentResult] = useState<{ sentiment: string; severity: string } | null>(null);
  const [portalSentimentLoading, setPortalSentimentLoading] = useState(false);
  const [portalChatInput, setPortalChatInput] = useState("");
  const [portalChatHistory, setPortalChatHistory] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Hello! I am your context-aware CRM dynamic care bot. As an enterprise member of our portal, ask me anything about active incidents, workspace rates, or billing specs!" }
  ]);
  const [portalChatLoading, setPortalChatLoading] = useState(false);
  const [portalFaqCategory, setPortalFaqCategory] = useState("API Credentials & Sandboxes");
  const [portalFaqResult, setPortalFaqResult] = useState<Array<{ q: string; a: string }> | null>(null);
  const [portalFaqLoading, setPortalFaqLoading] = useState(false);

  const activeCustomerContext = customers.find(c => c.uid === portalCustomerUid) || customers[0];

  // Support Portal live async triggers
  const handleAnalyzePortalSentiment = async () => {
    if (!portalIssueText.trim()) return;
    setPortalSentimentLoading(true);
    try {
      const response = await fetch("/api/gemini/support-sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueText: portalIssueText })
      });
      const data = await response.json();
      setPortalSentimentResult({
        sentiment: data.sentiment,
        severity: data.severity
      });
    } catch (e) {
      console.error(e);
    } finally {
      setPortalSentimentLoading(false);
    }
  };

  const handleSendPortalChat = async () => {
    if (!portalChatInput.trim()) return;
    const userText = portalChatInput.trim();
    setPortalChatHistory(prev => [...prev, { sender: "user", text: userText }]);
    setPortalChatInput("");
    setPortalChatLoading(true);
    try {
      const response = await fetch("/api/gemini/support-portal-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          customer: activeCustomerContext
        })
      });
      const data = await response.json();
      setPortalChatHistory(prev => [...prev, { sender: "bot", text: data.text }]);
    } catch (err) {
      console.error(err);
      setPortalChatHistory(prev => [...prev, { sender: "bot", text: "Oops, local network delays. Please retry context sync!" }]);
    } finally {
      setPortalChatLoading(false);
    }
  };

  const handleLoadPortalFaqs = async () => {
    setPortalFaqLoading(true);
    try {
      const response = await fetch("/api/gemini/support-portal-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: portalFaqCategory,
          customer: activeCustomerContext
        })
      });
      const data = await response.json();
      setPortalFaqResult(data.faqs);
    } catch (err) {
      console.error(err);
    } finally {
      setPortalFaqLoading(false);
    }
  };

  const handleCommitPortalTicket = async () => {
    if (!portalIssueText.trim()) return;
    const finalSentiment = portalSentimentResult?.sentiment || "Neutral";
    const finalPriority = portalSentimentResult?.severity === "Severe" ? "Urgent" : portalSentimentResult?.severity === "Moderate" ? "High" : "Medium";
    
    await onUpdateState("ADD_TICKET", {
      customer_id: portalCustomerUid,
      issue: portalIssueText,
      priority: finalPriority,
      status: "Open",
      sentiment: finalSentiment
    });

    setPortalIssueText("");
    setPortalSentimentResult(null);
    alert("🎉 Incident ticket successfully dispatched! Syncing with live support engineers.");
  };

  const activeTicket = tickets.find(t => t.ticket_id === selectedTicketId) || tickets[0];

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketIssue.trim()) return;
    
    // Auto-predict sentiment (fake client side, but we also can do server side. Let's do a crisp client regex for demonstration, or let Gemini classify later)
    let predictedSentiment: "Positive" | "Neutral" | "Negative" = "Neutral";
    const lowerIssue = newTicketIssue.toLowerCase();
    if (lowerIssue.includes("fail") || lowerIssue.includes("error") || lowerIssue.includes("cancel") || lowerIssue.includes("broken") || lowerIssue.includes("slow") || lowerIssue.includes("frustrated")) {
      predictedSentiment = "Negative";
    }

    await onUpdateState("ADD_TICKET", {
      customer_id: newTicketCustomer,
      issue: newTicketIssue,
      priority: newTicketPriority,
      status: "Open",
      sentiment: predictedSentiment
    });

    setNewTicketIssue("");
    setShowCreateForm(false);
  };

  const handleAskAI = async () => {
    if (!activeTicket) return;
    setLoading(true);
    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Draft a highly professional, technically sound response to resolve this ticket: "${activeTicket.issue}". Ensure you provide steps explaining network isolation, API socket bounds, and friendly reassuring customer support gestures.`,
          mode: "support",
          customerContext: activeTicket
        })
      });
      const data = await response.json();
      setAiResponse(data.text);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!activeTicket) return;
    await onUpdateState("UPDATE_TICKET", {
      ticket_id: activeTicket.ticket_id,
      status: "Resolved"
    });
    // Update local list index
    const ticketIdx = tickets.findIndex(t => t.ticket_id === activeTicket.ticket_id);
    if (ticketIdx !== -1) {
      tickets[ticketIdx].status = "Resolved";
    }
    setAiResponse("✅ Ticket resolved and archived in Cloud Firestore. Automated client satisfaction summary dispatched.");
  };

  return (
    <div className="space-y-6 w-full animate-fade-in font-sans" id="support-module-wrapper">
      {/* MODULE WORKSPACE TOGGLE */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#141416] border border-[#27272A] rounded-2xl p-4 shadow-lg">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white tracking-tight">Customer Support & Incident Escalation Engine</h3>
          <p className="text-xs text-[#A1A1AA]">Simulate either corporate support reps, or self-service customer portal views with diagnostic AI workflows.</p>
        </div>
        <div className="flex bg-[#0A0A0B] p-1 rounded-xl border border-[#27272A] shrink-0">
          <button
            type="button"
            onClick={() => setIsCustomerPortal(false)}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${!isCustomerPortal ? "bg-[#C5A059] text-[#0A0A0B]" : "text-[#A1A1AA] hover:text-white"}`}
          >
            Agent Console
          </button>
          <button
            type="button"
            onClick={() => setIsCustomerPortal(true)}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${isCustomerPortal ? "bg-[#C5A059] text-[#0A0A0B]" : "text-[#A1A1AA] hover:text-white"}`}
          >
            Customer Portal
          </button>
        </div>
      </div>

      {!isCustomerPortal ? (
        /* ORIGINAL DUAL PANEL AGENT WORKBENCH */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="support-module-container">
          {/* LEFT: Ticket Tracker & Creator */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A]" id="support-dashboard-card">
              <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-3">
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="w-5 h-5 text-[#C5A059]" />
                  <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight font-display">Support Ticket & CSAT Console</h3>
                </div>

                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-[#0A0A0B] border border-[#27272A] text-[#E4E4E7] hover:bg-white/5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  + File Incident Ticket
                </button>
              </div>

              {showCreateForm && (
                <form onSubmit={handleCreateTicket} className="bg-[#0A0A0B] border border-[#27272A] rounded-2xl p-4 mb-5 space-y-4">
                  <h4 className="text-xs font-bold text-[#E4E4E7] uppercase tracking-wider">File Corporate Incident Form</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 font-sans">Select Reporting Customer</label>
                      <select
                        value={newTicketCustomer}
                        onChange={(e) => setNewTicketCustomer(e.target.value)}
                        className="w-full bg-[#141416] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-[#E4E4E7] focus:outline-[#C5A059] outline-none"
                      >
                        {customers.map(c => (
                          <option key={c.uid} value={c.uid}>
                            {c.name} ({c.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 font-sans">Issue Description</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Describe technical delay, performance rate, subscription, etc."
                        value={newTicketIssue}
                        onChange={(e) => setNewTicketIssue(e.target.value)}
                        className="w-full bg-[#141416] border border-[#27272A] rounded-xl p-3 text-xs text-[#E4E4E7] focus:outline-[#C5A059] outline-none resize-none"
                      />
                    </div>

                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 font-sans">Priority</label>
                        <select
                          value={newTicketPriority}
                          onChange={(e) => setNewTicketPriority(e.target.value as any)}
                          className="bg-[#141416] border border-[#27272A] rounded-xl px-3 py-1.5 text-xs text-[#E4E4E7] focus:outline-[#C5A059] outline-none"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer"
                      >
                        Commit Active Incident
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-3.5">
                {tickets.map((t) => {
                  const isSelected = t.ticket_id === selectedTicketId;
                  const sentimentIcon = t.sentiment === "Negative" ? (
                    <Frown className="w-4 h-4 text-red-400" />
                  ) : t.sentiment === "Positive" ? (
                    <Smile className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Meh className="w-4 h-4 text-amber-400" />
                  );

                  return (
                    <div
                      key={t.ticket_id}
                      onClick={() => setSelectedTicketId(t.ticket_id)}
                      className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${isSelected ? "bg-[#0A0A0B] border-[#C5A059]" : "bg-[#141416] border-[#27272A] hover:border-[#A1A1AA]/45"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold font-mono text-[#A1A1AA]">{t.ticket_id.toUpperCase()}</span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${t.priority === "Urgent" ? "bg-red-955/40 text-red-400 border border-red-900/40" : t.priority === "High" ? "bg-amber-955/40 text-amber-400 border border-amber-900/40" : "bg-[#0A0A0B] text-[#A1A1AA] border border-[#27272A]"}`}>
                            {t.priority}
                          </span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${t.status === "Resolved" ? "bg-emerald-955/40 text-emerald-400 border border-emerald-900/40" : "bg-blue-955/40 text-blue-400 border border-blue-900/40"}`}>
                            {t.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#E4E4E7] font-sans line-clamp-2 leading-relaxed mb-3">
                        {t.issue}
                      </p>

                      <div className="flex items-center justify-between border-t border-[#27272A] pt-2 text-[10px] text-[#A1A1AA] font-mono">
                        <span className="font-sans font-bold text-[#E4E4E7]">{t.customerName}</span>
                        <div className="flex items-center space-x-1.5 bg-[#0A0A0B] px-2 py-0.5 rounded border border-[#27272A]">
                          {sentimentIcon}
                          <span className="uppercase text-[9px]">{t.sentiment} sentiment</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: AI Support Copilot reply builder */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] flex flex-col h-full" id="ai-support-copilot-studio">
              <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-3">
                <div className="flex items-center space-x-2.5">
                  <Sparkles className="w-5 h-5 text-[#C5A059]" />
                  <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight font-display">AI Autonomous Dispatch Agent</h3>
                </div>
                <span className="text-[10px] font-mono bg-emerald-955/40 text-emerald-400 border border-emerald-900/40 px-2 py-1 rounded">24/7 COPILOT ACTIVE</span>
              </div>

              {activeTicket ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="bg-[#0A0A0B] rounded-xl p-4 border border-[#27272A] text-xs text-[#E4E4E7] space-y-1">
                      <div>
                        <span className="font-bold text-[#A1A1AA] uppercase">Selected Incident:</span>{" "}
                        <span className="font-sans text-[#E4E4E7] font-medium">{activeTicket.issue}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#A1A1AA]/70">CUSTOMER REF:</span>{" "}
                        <span className="font-sans text-[#A1A1AA] font-mono">{activeTicket.customer_id}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={handleAskAI}
                        disabled={loading}
                        className="w-full bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2.5 transition-all shadow-md cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#0A0A0B]" />
                        <span>{loading ? "Generating Safe Resolution Protocols..." : "Generate AI Technical Response Copilot"}</span>
                      </button>
                    </div>

                    {loading && (
                      <div className="py-8 flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-[#A1A1AA] font-mono">Formulating low-latency response...</span>
                      </div>
                    )}

                    {!loading && aiResponse && (
                      <div className="mt-4 border border-[#27272A] rounded-2xl overflow-hidden shadow-xl" id="ai-support-response-preview">
                        <div className="bg-red-955/50 border-b border-red-900/45 px-4 py-2 flex items-center justify-between text-[11px] font-mono font-medium text-red-400">
                          <span>SECURE SENTIMENT RESPONSE</span>
                          {activeTicket.sentiment === "Negative" && (
                            <div className="flex items-center space-x-1 uppercase text-red-400 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>At Risk Mitigation Enforced</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4 bg-[#0A0A0B] text-xs text-[#E4E4E7] font-mono leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap">
                          {aiResponse}
                        </div>
                      </div>
                    )}
                  </div>

                  {!loading && aiResponse && activeTicket.status !== "Resolved" && (
                    <div className="pt-4 border-t border-[#27272A]">
                      <button
                        onClick={handleResolveTicket}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow shadow-emerald-950 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>Incorporate Response & Resolve Ticket</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#A1A1AA] font-mono text-center text-xs p-6 border border-dashed border-[#27272A] rounded-2xl">
                  <span>Select an incident ticket from the list to invoke Gemini automated case solvers.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CUSTOMER SELF SERVICE PORTAL ENGINE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="customer-support-portal-container font-sans">
          {/* LEFT: Ticket Submission & Sentiment Gauges */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 border-b border-[#27272A] pb-3 justify-between font-sans">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#C5A059]" />
                  <span className="text-sm font-bold uppercase tracking-wider text-white font-mono">Create support case</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[10px] font-mono text-[#A1A1AA]">Simulating:</span>
                  <select
                    value={portalCustomerUid}
                    onChange={(e) => {
                      setPortalCustomerUid(e.target.value);
                      setPortalSentimentResult(null);
                    }}
                    className="bg-[#0A0A0B] border border-[#27272A] px-2.5 py-1 text-[11px] rounded font-mono text-white focus:outline-none"
                  >
                    {customers.map(c => (
                      <option key={c.uid} value={c.uid}>{c.name} ({c.tier})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TICKET DESCRIPTION FIELD */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider font-mono">Describe your situation (realtime sentiment classified)</label>
                <textarea
                  rows={4}
                  value={portalIssueText}
                  onChange={(e) => setPortalIssueText(e.target.value)}
                  placeholder="Example: We are hitting massive 429 webhook delays in our staging environments, severely halting SLA rates!"
                  className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3 text-xs text-[#E4E4E7] focus:outline-none focus:border-[#C5A059] resize-none font-sans"
                />
              </div>

              {/* SENTIMENT TRIGGER & REALTIME VISUAL GAUGE */}
              <div className="space-y-3 p-4 bg-[#0A0A0B]/50 border border-[#27272A] rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#A1A1AA] uppercase font-mono">AI Real-time Sentiment Detector</span>
                  <button
                    type="button"
                    onClick={handleAnalyzePortalSentiment}
                    disabled={portalSentimentLoading || !portalIssueText.trim()}
                    className="px-2.5 py-1 bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/30 hover:bg-[#C5A059]/20 text-[10px] font-bold uppercase font-mono rounded cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {portalSentimentLoading ? "Detecting..." : "Analyze Live"}
                  </button>
                </div>

                {portalSentimentResult ? (
                  <div className="space-y-3.5 pt-1 animate-fade-in text-xs font-sans">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#141416] p-2.5 rounded border border-[#27272A] space-y-0.5">
                        <span className="text-[9px] font-mono text-[#A1A1AA] uppercase font-bold">Inferred Sentiment:</span>
                        <div className="flex items-center gap-1.5 font-bold">
                          {portalSentimentResult.sentiment === "Negative" ? (
                            <Frown className="w-4 h-4 text-red-400 animate-bounce" />
                          ) : portalSentimentResult.sentiment === "Positive" ? (
                            <Smile className="w-4 h-4 text-emerald-450" />
                          ) : (
                            <Meh className="w-4 h-4 text-amber-405" />
                          )}
                          <span className={portalSentimentResult.sentiment === "Negative" ? "text-red-400" : "text-emerald-400"}>
                            {portalSentimentResult.sentiment}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#141416] p-2.5 rounded border border-[#27272A] space-y-0.5">
                        <span className="text-[9px] font-mono text-[#A1A1AA] uppercase font-bold">Severity level:</span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className={`w-4 h-4 ${portalSentimentResult.severity === "Severe" ? "text-red-400 animate-pulse" : "text-[#C5A059]"}`} />
                          <span className={portalSentimentResult.severity === "Severe" ? "text-red-400 font-extrabold animate-pulse" : "text-zinc-300"}>
                            {portalSentimentResult.severity} Distress
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* GAUGES */}
                    <div className="space-y-1 font-mono">
                      <div className="flex justify-between text-[9px] text-[#A1A1AA] uppercase">
                        <span>Distress Intensity Gauge</span>
                        <span className="font-bold text-white">{portalSentimentResult.severity === "Severe" ? "92%" : portalSentimentResult.severity === "Moderate" ? "56%" : "15%"}</span>
                      </div>
                      <div className="w-full bg-[#141416] h-2.5 rounded-full overflow-hidden border border-[#27272A]/80">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            portalSentimentResult.severity === "Severe" ? "bg-gradient-to-r from-red-500 to-rose-600" : 
                            portalSentimentResult.severity === "Moderate" ? "bg-gradient-to-r from-amber-400 to-amber-500" : 
                            "bg-gradient-to-r from-emerald-400 to-emerald-500"
                          }`}
                          style={{ width: portalSentimentResult.severity === "Severe" ? "92%" : portalSentimentResult.severity === "Moderate" ? "56%" : "15%" }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#71717A] italic block font-sans">Type issue above and trigger 'Analyze Live' to extract distress severity.</span>
                )}
              </div>

              {/* SUBMIT CASE BUTTON */}
              <button
                type="button"
                onClick={handleCommitPortalTicket}
                disabled={!portalIssueText.trim()}
                className="w-full py-3 bg-[#C5A059] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#C5A059]/90 text-[#0A0A0B] text-xs font-bold uppercase font-mono tracking-wider rounded-xl cursor-pointer"
              >
                Dispatch Incident & Set SLA Alerts
              </button>
            </div>

            {/* DYNAMIC FAQ ACCORDIONS TAB */}
            <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl space-y-4 font-sans">
              <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
                <span className="text-sm font-bold uppercase tracking-wider text-white font-mono">Dynamic contextual FAQs list</span>
                <span className="text-[8px] font-mono uppercase bg-[#C5A059]/10 border border-[#C5A059]/35 text-[#C5A059] px-2 py-0.5 rounded font-bold">Generative FAQ</span>
              </div>

              <div className="flex gap-2 text-xs">
                <select
                  value={portalFaqCategory}
                  onChange={(e) => setPortalFaqCategory(e.target.value)}
                  className="flex-1 bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white focus:outline-[#C5A059] h-9"
                >
                  <option value="API Webhook rate limits & 429 Errors">API Webhook rate limits & 429 Errors</option>
                  <option value="Multi-tenant IAM Roles & Security Permissions">Multi-tenant IAM Roles & Security Permissions</option>
                  <option value="Cloud Firestore Rule Violations">Cloud Firestore Rule Violations</option>
                  <option value="Enterprise Billing & Volume SLA Discounts">Enterprise Billing & Volume SLA Discounts</option>
                </select>
                <button
                  type="button"
                  onClick={handleLoadPortalFaqs}
                  disabled={portalFaqLoading}
                  className="px-4 py-2 bg-zinc-900 border border-[#27272A]/60 hover:bg-zinc-800 text-[#C5A059] rounded-xl text-xs font-bold font-mono cursor-pointer disabled:opacity-50 h-9"
                >
                  {portalFaqLoading ? "Compiling..." : "Generate APIs FAQs"}
                </button>
              </div>

              {portalFaqLoading ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-2">
                  <span className="w-5 h-5 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-[#A1A1AA] font-mono">Gemini compiling documentation indexes...</span>
                </div>
              ) : portalFaqResult?.length ? (
                <div className="space-y-2.5 animate-fade-in text-xs font-sans max-h-[220px] overflow-y-auto pr-1">
                  {portalFaqResult.map((faq, idx) => (
                    <div key={idx} className="bg-[#0A0A0B] p-3 rounded-xl border border-[#27272A]">
                      <h5 className="font-bold text-white mb-1">Q: {faq.q}</h5>
                      <p className="text-[#A1A1AA] text-[11px] leading-relaxed">A: {faq.a}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 bg-[#0A0A0B]/30 border border-dashed border-[#27272A] rounded-xl">
                  <span className="text-[10px] text-[#71717A] italic block font-sans">Select a category and trigger compilation to extract contextual FAQs for {activeCustomerContext.name}!</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: AI Virtual Assistant Support Chat */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl flex flex-col justify-between h-[580px] font-sans">
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#27272A] pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-sm font-bold uppercase tracking-wider text-white font-mono">Virtual assistant chat</span>
                  </div>
                  <span className="text-[8px] font-mono bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-zinc-500 uppercase font-bold">Context Sync</span>
                </div>

                {/* USER PROFILE BUBBLE IN STREAM */}
                <div className="bg-[#0A0A0B]/80 p-2.5 rounded-xl border border-[#27272A]/50 text-[10px] font-mono flex justify-between items-center select-none shrink-0">
                  <div>
                    <span className="text-[#A1A1AA] block text-[8px] uppercase">Active User Persona contextualized</span>
                    <span className="text-[#C5A059] font-bold font-sans text-xs">{activeCustomerContext.name}</span>
                    <span className="text-[#71717A]"> ({activeCustomerContext.tier} • LTV: ${activeCustomerContext.lifetimeValue})</span>
                  </div>
                  <span className="text-[9px] text-[#A1A1AA] border border-[#27272A] px-2 py-1 rounded">
                    {tickets.filter(t => t.customer_id === activeCustomerContext.uid).length} open tickets
                  </span>
                </div>

                {/* CHAT MESSAGES DISPLAY */}
                <div className="flex-1 space-y-3.5 overflow-y-auto p-2 scrollbar-thin max-h-[360px] min-h-[220px]">
                  {portalChatHistory.map((chat, idx) => (
                    <div key={idx} className={`flex ${chat.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          chat.sender === "user" 
                            ? "bg-[#C5A059] text-[#0A0A0B] rounded-tr-none font-medium" 
                            : "bg-[#0A0A0B] text-zinc-200 border border-[#27272A] rounded-tl-none font-mono"
                        }`}
                      >
                        {chat.text}
                      </div>
                    </div>
                  ))}

                  {portalChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[#0A0A0B] text-zinc-400 border border-[#27272A] rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-1.5 font-mono">
                        <span className="w-2.5 h-2.5 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>AI formulation processing...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* INPUT BOX */}
              <div className="mt-4 pt-3 border-t border-[#27272A] flex gap-2 shrink-0">
                <input
                  type="text"
                  value={portalChatInput}
                  onChange={(e) => setPortalChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendPortalChat();
                  }}
                  placeholder="Ask care assistant about active rates, rules or subscriptions..."
                  className="flex-1 bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3.5 py-4 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-[#C5A059]"
                />
                <button
                  type="button"
                  onClick={handleSendPortalChat}
                  disabled={portalChatLoading || !portalChatInput.trim()}
                  className="p-3 bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] rounded-xl disabled:opacity-40 cursor-pointer flex items-center justify-center"
                >
                  <Send className="w-4 h-4 shrink-0 font-bold" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
