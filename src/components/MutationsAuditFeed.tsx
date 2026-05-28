import React, { useState } from "react";
import { Terminal, Database, Shield, Search, ChevronDown, ChevronUp, Clock, RefreshCw } from "lucide-react";
import { AuditLog } from "../types";

interface MutationsAuditFeedProps {
  logs: AuditLog[];
  onRefresh: () => Promise<void>;
}

export function MutationsAuditFeed({ logs, onRefresh }: MutationsAuditFeedProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "Success" | "Failed">("all");

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.collection.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || log.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-[#141416] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden mt-8 animate-fade-in" id="mutations-audit-feed-panel">
      {/* Header */}
      <div 
        className="bg-[#0D0D0E] px-6 py-4 flex items-center justify-between border-b border-[#27272A] cursor-pointer hover:bg-[#121214] transition-colors select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            <div className="ml-3.5 p-1.5 bg-[#C5A059]/10 rounded-lg text-[#C5A059]">
              <Terminal className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Live NoSQL Database Mutations Feed</h4>
            <p className="text-[11px] text-[#A1A1AA] font-sans">Real-time telemetry of NoSQL write actions, IAM overrides, and schema compliance triggers</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className="p-1 px-2.5 bg-[#0A0A0B] border border-[#27272A] rounded-lg hover:bg-white/5 text-[10px] text-[#C5A059] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Poll Telemetry</span>
          </button>
          
          <div className="text-[#A1A1AA]">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-4 bg-[#0F0F11]">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0A0A0B] p-3 rounded-xl border border-[#27272A]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#A1A1AA]/70 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter mutations by action, table scope, or customer email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141416] border border-[#27272A] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#C5A059] font-sans"
              />
            </div>

            <div className="flex bg-[#141416] p-0.5 rounded-lg border border-[#27272A] shrink-0 text-[10px] font-bold uppercase font-mono">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer ${filterStatus === "all" ? "bg-[#C5A059] text-black" : "text-[#A1A1AA] hover:text-white"}`}
              >
                All States
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("Success")}
                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer ${filterStatus === "Success" ? "bg-emerald-600 text-white" : "text-[#A1A1AA] hover:text-white"}`}
              >
                Success
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("Failed")}
                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer ${filterStatus === "Failed" ? "bg-rose-900 text-white" : "text-[#A1A1AA] hover:text-white"}`}
              >
                Failure
              </button>
            </div>
          </div>

          {/* Table container */}
          <div className="border border-[#27272A] rounded-xl overflow-hidden bg-[#0A0A0B]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#E4E4E7] border-collapse">
                <thead>
                  <tr className="bg-[#141416] border-b border-[#27272A] text-[9px] font-mono text-[#A1A1AA] uppercase font-bold tracking-wider">
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Action Pattern</th>
                    <th className="py-3 px-4 font-semibold">Target NoSQL Collection</th>
                    <th className="py-3 px-4 font-semibold">Initiator ID</th>
                    <th className="py-3 px-4 font-semibold">Write State</th>
                    <th className="py-3 px-4 font-semibold">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]/50 font-mono text-[11px] leading-relaxed">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => {
                      const displayTime = log.timestamp 
                        ? new Date(log.timestamp).toLocaleTimeString() 
                        : new Date().toLocaleTimeString();

                      return (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-4 text-[#A1A1AA] font-mono shrink-0 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-[#C5A059]" />
                              {displayTime}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-[#E4E4E7] bg-white/[0.05] border border-white/5 py-0.5 px-1.5 rounded text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 shrink-0 whitespace-nowrap">
                            <span className="text-zinc-400 font-bold">&#123;/{log.collection}&#125;</span>
                          </td>
                          <td className="py-2.5 px-4 text-zinc-350 truncate max-w-[140px]" title={log.user}>
                            {log.user}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              log.status === "Success" 
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30" 
                                : "bg-red-955/40 text-red-400 border border-red-900/40"
                            }`}>
                              ● {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[#A1A1AA] font-sans max-w-sm truncate" title={log.details}>
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#71717A] italic font-sans">
                        No database mutations detected matching the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
