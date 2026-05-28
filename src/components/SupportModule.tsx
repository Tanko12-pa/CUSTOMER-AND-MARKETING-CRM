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
                <Smile className="w-4 h-4 text-emerald-450" />
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
  );
}
