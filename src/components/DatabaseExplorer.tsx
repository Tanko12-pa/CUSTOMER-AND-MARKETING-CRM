import React, { useState } from "react";
import { Customer, Campaign, SupportTicket, AuditLog } from "../types";
import { 
  Database, 
  Shield, 
  FileCode, 
  CheckCircle, 
  Terminal, 
  HelpCircle, 
  HeartHandshake, 
  UserPlus,
  Search,
  Download,
  Trash2,
  CheckSquare,
  Square,
  Filter,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  X,
  FileText
} from "lucide-react";

interface DatabaseExplorerProps {
  customers: Customer[];
  campaigns: Campaign[];
  tickets: SupportTicket[];
  logs: AuditLog[];
  onUpdateState: (type: string, payload: any) => Promise<void>;
}

export function DatabaseExplorer({ customers, campaigns, tickets, logs, onUpdateState }: DatabaseExplorerProps) {
  const [activeTab, setActiveTab] = useState<"explorer" | "rules" | "logs">("explorer");
  const [activeCollection, setActiveCollection] = useState<"customers" | "campaigns" | "support_tickets">("customers");
  
  // Search, filter and multiselect states
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"dealRiskStatus" | "winProbability" | "none">("none");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  // Bulk CSV importing and client-side validation states
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [validatedRecords, setValidatedRecords] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [isImportingInProgress, setIsImportingInProgress] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // File drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  const processCSVFile = (file: File) => {
    setImportFileName(file.name);
    setImportErrors([]);
    setValidatedRecords([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setImportErrors(["Could not read structured content from file."]);
        return;
      }
      
      const rawLines = text.split(/\r?\n/).map(l => l.trim());
      if (rawLines.length === 0 || (rawLines.length === 1 && !rawLines[0])) {
        setImportErrors(["CSV file appears to be completely empty."]);
        return;
      }

      const headers = rawLines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
      
      // Look for positions of mandatory fields: name and email
      const nameIdx = headers.findIndex(h => h.toLowerCase() === "name" || h.toLowerCase() === "fullname" || h.toLowerCase() === "client name");
      const emailIdx = headers.findIndex(h => h.toLowerCase() === "email" || h.toLowerCase() === "corporate email" || h.toLowerCase() === "client email");

      const errorsList: string[] = [];
      if (nameIdx === -1) {
        errorsList.push("Mandatory column header 'Name' is missing in CSV.");
      }
      if (emailIdx === -1) {
        errorsList.push("Mandatory column header 'Email' is missing in CSV.");
      }

      if (errorsList.length > 0) {
        setImportErrors(errorsList);
        return;
      }

      const parsedRecords: any[] = [];
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (let i = 1; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (!line) continue; // Skip blank lines safely

        // Robust comma split taking quotes into account
        const values: string[] = [];
        let currentField = '';
        let insideQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            values.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        values.push(currentField.trim());

        const nameVal = (values[nameIdx] || "").trim().replace(/^["']|["']$/g, "");
        const emailVal = (values[emailIdx] || "").trim().replace(/^["']|["']$/g, "");

        // Client-side validations
        const fileLineNum = i + 1;
        if (!nameVal) {
          errorsList.push(`Line ${fileLineNum}: 'Name' is blank. Name is a mandatory field.`);
          continue;
        }
        if (!emailVal) {
          errorsList.push(`Line ${fileLineNum}: 'Email' is blank. Email is a mandatory field.`);
          continue;
        }
        if (!emailPattern.test(emailVal)) {
          errorsList.push(`Line ${fileLineNum}: '${emailVal}' is not a valid email address format.`);
          continue;
        }

        // Optional indices
        const stageIdx = headers.findIndex(h => h.toLowerCase().includes("stage") || h.toLowerCase().includes("lifecycle"));
        const tierIdx = headers.findIndex(h => h.toLowerCase() === "tier");
        const scoreIdx = headers.findIndex(h => h.toLowerCase().includes("score") || h.toLowerCase().includes("leadscore"));
        const ltvIdx = headers.findIndex(h => h.toLowerCase().includes("ltv") || h.toLowerCase().includes("contract") || h.toLowerCase().includes("value") || h.toLowerCase().includes("lifetimevalue"));
        const repIdx = headers.findIndex(h => h.toLowerCase().includes("rep") || h.toLowerCase().includes("owner") || h.toLowerCase().includes("agent"));
        const sentimentIdx = headers.findIndex(h => h.toLowerCase() === "sentiment");

        const parsedRecord = {
          name: nameVal,
          email: emailVal,
          lifecycleStage: stageIdx !== -1 && values[stageIdx] ? values[stageIdx].replace(/^["']|["']$/g, "") : "Lead",
          tier: tierIdx !== -1 && values[tierIdx] ? values[tierIdx].replace(/^["']|["']$/g, "") : "Free",
          leadScore: scoreIdx !== -1 && !isNaN(Number(values[scoreIdx])) ? Number(values[scoreIdx]) : 60,
          lifetimeValue: ltvIdx !== -1 && !isNaN(Number(values[ltvIdx])) ? Number(values[ltvIdx]) : 0,
          sentiment: sentimentIdx !== -1 && values[sentimentIdx] ? values[sentimentIdx].replace(/^["']|["']$/g, "") : "Neutral",
          lastInteractionDays: 1,
          winProbability: 50,
          assignedRep: repIdx !== -1 && values[repIdx] ? values[repIdx].replace(/^["']|["']$/g, "") : "Danielle Gold",
          dealRiskStatus: "Low Risk",
          createdAt: new Date().toISOString()
        };

        parsedRecords.push(parsedRecord);
      }

      if (errorsList.length > 0) {
        setImportErrors(errorsList);
      }

      if (parsedRecords.length > 0) {
        setValidatedRecords(parsedRecords);
      }
    };
    
    reader.readAsText(file);
  };

  const handleCommitImport = async () => {
    if (validatedRecords.length === 0) return;
    setIsImportingInProgress(true);
    try {
      await onUpdateState("BULK_ADD_CUSTOMERS", { records: validatedRecords });
      setImportFileName("");
      setValidatedRecords([]);
      setImportErrors([]);
      setShowBulkImport(false);
    } catch (err: any) {
      setImportErrors([`Import operation failed: ${err.message || err}`]);
    } finally {
      setIsImportingInProgress(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateStr = "Name,Email,Lifecycle Stage,Tier,Lead Score,LTV ($),Sentiment,Assigned Rep\nSarah Connor,s.connor@cyberdyne.com,Lead,Free,85,0,Positive,Danielle Gold\nJohn Connor,j.connor@cyberdyne.com,Customer,Enterprise,95,120000,Positive,Danielle Gold";
    const blob = new Blob([templateStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "crm_customers_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create user form
  const [frmName, setFrmName] = useState("");
  const [frmEmail, setFrmEmail] = useState("");
  const [frmStage, setFrmStage] = useState<"Lead" | "MQL" | "SQL" | "Customer" | "Churned">("Lead");
  const [frmTier, setFrmTier] = useState<"Free" | "Premium" | "Enterprise">("Free");
  const [frmRep, setFrmRep] = useState("Danielle Gold");
  const [frmScore, setFrmScore] = useState(60);
  const [frmLTV, setFrmLTV] = useState(0);

  // Filtered customer list
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.assignedRep && c.assignedRep.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.uid.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === "All" || c.lifecycleStage === stageFilter;
    return matchesSearch && matchesStage;
  });

  // Risk weighting helper for sorting
  const getRiskWeight = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("high") || s.includes("at risk")) return 3;
    if (s.includes("medium")) return 2;
    if (s.includes("low")) return 1;
    return 0;
  };

  // Sort and filter customer stream
  const sortedCustomers = React.useMemo(() => {
    const list = [...filteredCustomers];
    if (sortBy === "dealRiskStatus") {
      list.sort((a, b) => {
        const weightA = getRiskWeight(a.dealRiskStatus);
        const weightB = getRiskWeight(b.dealRiskStatus);
        if (weightA !== weightB) {
          return sortOrder === "asc" ? weightA - weightB : weightB - weightA;
        }
        return sortOrder === "asc"
          ? (a.dealRiskStatus || "").localeCompare(b.dealRiskStatus || "")
          : (b.dealRiskStatus || "").localeCompare(a.dealRiskStatus || "");
      });
    } else if (sortBy === "winProbability") {
      list.sort((a, b) => {
        const valA = a.winProbability || 0;
        const valB = b.winProbability || 0;
        return sortOrder === "asc" ? valA - valB : valB - valA;
      });
    }
    return list;
  }, [filteredCustomers, sortBy, sortOrder]);

  const handleSort = (field: "dealRiskStatus" | "winProbability") => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getCustomerLogs = (customer: Customer) => {
    const sName = customer.name.toLowerCase();
    const sEmail = customer.email.toLowerCase();
    const sUid = customer.uid.toLowerCase();
    return logs.filter(log => {
      const details = (log.details || "").toLowerCase();
      return details.includes(sName) || details.includes(sEmail) || details.includes(sUid);
    });
  };

  const renderRiskBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("high") || s.includes("at risk")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/50 text-red-400 border border-red-900/40 font-mono font-bold shrink-0 uppercase tracking-wide">
          🚨 {status || "High Risk"}
        </span>
      );
    }
    if (s.includes("medium")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/50 text-amber-400 border border-amber-900/40 font-mono font-bold shrink-0 uppercase tracking-wide">
          ⚠️ {status || "Medium Risk"}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 font-mono font-bold shrink-0 uppercase tracking-wide">
        🛡️ {status || "Low Risk"}
      </span>
    );
  };

  const handleExportToCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = "";

    if (activeCollection === "customers") {
      headers = ["UID", "Name", "Email", "Lifecycle Stage", "Tier", "Lead Score", "LTV ($)", "Sentiment", "Last Interaction (Days)", "Win Probability (%)", "Assigned Rep", "Deal Risk Status", "Created At"];
      rows = filteredCustomers.map(c => [
        c.uid,
        `"${c.name.replace(/"/g, '""')}"`,
        c.email,
        c.lifecycleStage,
        c.tier,
        c.leadScore,
        c.lifetimeValue,
        c.sentiment,
        c.lastInteractionDays,
        c.winProbability,
        `"${c.assignedRep.replace(/"/g, '""')}"`,
        `"${(c.dealRiskStatus || '').replace(/"/g, '""')}"`,
        c.createdAt
      ]);
      filename = `filtered_customers_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeCollection === "campaigns") {
      headers = ["Campaign ID", "Title", "Target Segment", "Budget ($)", "Status", "Clicks", "Conversations", "Revenue Generated ($)"];
      rows = campaigns.map(camp => [
        camp.campaign_id,
        `"${camp.title.replace(/"/g, '""')}"`,
        `"${camp.targetSegment.replace(/"/g, '""')}"`,
        camp.budget,
        camp.status,
        camp.clicks,
        camp.conversations,
        camp.revenueGenerated
      ]);
      filename = `all_campaigns_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeCollection === "support_tickets") {
      headers = ["Ticket ID", "Customer ID", "Customer Name", "Issue", "Priority", "Status", "Sentiment", "Created At"];
      rows = tickets.map(t => [
        t.ticket_id,
        t.customer_id,
        `"${t.customerName.replace(/"/g, '""')}"`,
        `"${t.issue.replace(/"/g, '""')}"`,
        t.priority,
        t.status,
        t.sentiment,
        t.createdAt
      ]);
      filename = `all_support_tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    if (headers.length === 0) return;

    const csvString = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenBulkDeleteConfirm = () => {
    if (selectedUids.length === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const handleBulkDelete = async () => {
    await onUpdateState("DELETE_CUSTOMERS", { uids: selectedUids });
    setSelectedUids([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleToggleSelect = (uid: string) => {
    setSelectedUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const allSelected = filteredCustomers.length > 0 && filteredCustomers.every(c => selectedUids.includes(c.uid));
  const handleSelectAllToggle = () => {
    if (allSelected) {
      // deselect all currently filtered customers
      setSelectedUids(prev => prev.filter(uid => !filteredCustomers.some(fc => fc.uid === uid)));
    } else {
      // select all currently filtered customers
      setSelectedUids(prev => {
        const needed = filteredCustomers.filter(fc => !prev.includes(fc.uid)).map(fc => fc.uid);
        return [...prev, ...needed];
      });
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frmName.trim() || !frmEmail.trim()) return;

    await onUpdateState("ADD_CUSTOMER", {
      name: frmName,
      email: frmEmail,
      lifecycleStage: frmStage,
      tier: frmTier,
      leadScore: Number(frmScore),
      lifetimeValue: Number(frmLTV),
      sentiment: "Neutral",
      lastInteractionDays: 1,
      winProbability: frmStage === "Customer" ? 100 : 50,
      assignedRep: frmRep
    });

    setFrmName("");
    setFrmEmail("");
    setFrmLTV(0);
  };

  return (
    <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] relative" id="firestore-virtual-explorer">
      {showBulkDeleteConfirm && (
        <div className="absolute inset-0 bg-[#0A0A0B]/95 backdrop-blur-sm z-50 rounded-2xl flex items-center justify-center p-6 animate-fade-in" id="bulk-delete-confirm-overlay">
          <div className="bg-[#141416] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-red-950/30 text-red-400 rounded-full border border-red-900/30">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white uppercase tracking-wider font-mono">Confirm Bulk Deletion</h4>
              <p className="text-xs text-[#A1A1AA] mt-1.5 leading-relaxed font-sans">
                You are about to permanently delete <strong className="text-red-400 font-mono text-sm px-1.5 py-0.5 bg-red-950/40 rounded border border-red-900/20">{selectedUids.length}</strong> client record(s) from the Cloud Firestore NoSQL collections.
              </p>
              <p className="text-[11px] text-red-400/80 mt-1.5 font-bold font-mono">
                🚨 WARNING: This administrative action is irreversible!
              </p>
            </div>
            <div className="flex items-center space-x-3 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-[#27272A] bg-[#0A0A0B] hover:bg-white/5 text-xs font-bold text-[#E4E4E7] transition-all cursor-pointer"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                id="do-confirm-bulk-delete-btn"
              >
                Confirm Delete!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between border-b border-[#27272A] pb-4 mb-5 gap-3">
        <div className="flex items-center space-x-2.5">
          <Database className="w-5 h-5 text-[#C5A059]" />
          <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight font-display">Cloud Firestore Database & Security Control</h3>
        </div>

        {/* Tab Controls */}
        <div className="flex space-x-1.5 p-1 bg-[#0A0A0B] border border-[#27272A] rounded-xl text-xs font-semibold" id="control-tabs-flex">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === "explorer" ? "bg-[#141416] text-[#C5A059] border border-[#27272A]/80 shadow-md font-bold" : "text-[#A1A1AA] hover:text-[#E4E4E7]"}`}
          >
            📂 Collections Explorer
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === "rules" ? "bg-[#141416] text-[#C5A059] border border-[#27272A]/80 shadow-md font-bold" : "text-[#A1A1AA] hover:text-[#E4E4E7]"}`}
          >
            🛡️ Firestore Security Rules
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === "logs" ? "bg-[#141416] text-[#C5A059] border border-[#27272A]/80 shadow-md font-bold" : "text-[#A1A1AA] hover:text-[#E4E4E7]"}`}
          >
            📟 Real-Time Audit Logs ({logs.length})
          </button>
        </div>
      </div>

      {activeTab === "explorer" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sub collection selectors */}
          <div className="lg:col-span-3 space-y-2">
            <h4 className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-2 font-sans">Firestore Collections</h4>
            <button
              onClick={() => setActiveCollection("customers")}
              className={`w-full text-left p-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${activeCollection === "customers" ? "bg-[#0A0A0B] border border-[#C5A059] text-[#C5A059] font-bold" : "bg-[#141416] border border-[#27272A] hover:bg-white/5 text-[#A1A1AA]"}`}
            >
              <span>📁 customers</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${activeCollection === "customers" ? "bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20" : "bg-white/5 text-[#E4E4E7]"}`}>
                {filteredCustomers.length !== customers.length ? `${filteredCustomers.length}/${customers.length}` : customers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveCollection("campaigns")}
              className={`w-full text-left p-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${activeCollection === "campaigns" ? "bg-[#0A0A0B] border border-[#C5A059] text-[#C5A059] font-bold" : "bg-[#141416] border border-[#27272A] hover:bg-white/5 text-[#A1A1AA]"}`}
            >
              <span>📁 campaigns</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${activeCollection === "campaigns" ? "bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20" : "bg-white/5 text-[#E4E4E7]"}`}>
                {campaigns.length}
              </span>
            </button>
            <button
              onClick={() => setActiveCollection("support_tickets")}
              className={`w-full text-left p-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${activeCollection === "support_tickets" ? "bg-[#0A0A0B] border border-[#C5A059] text-[#C5A059] font-bold" : "bg-[#141416] border border-[#27272A] hover:bg-white/5 text-[#A1A1AA]"}`}
            >
              <span>📁 support_tickets</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${activeCollection === "support_tickets" ? "bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20" : "bg-white/5 text-[#E4E4E7]"}`}>
                {tickets.length}
              </span>
            </button>

            {/* QUICK DOC ACTIONS */}
            <div className="pt-4 border-t border-[#27272A]">
              <h5 className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-2 font-sans font-semibold">Simulation actions</h5>
              <div className="p-3 bg-[#C5A059]/10 border border-[#C5A059]/20 rounded-xl text-[11px] text-[#C5A059] leading-relaxed">
                Add a new customer profile manually below to see rules-based indexing in action immediately.
              </div>
            </div>
          </div>

          {/* Records tree explorer list */}
          <div className="lg:col-span-5 space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between gap-2 bg-[#0A0A0B] p-2.5 rounded-xl border border-[#27272A] mb-1">
              <h4 className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider font-mono">Document path: /{activeCollection}/{"{UID}"}</h4>
              <button
                onClick={handleExportToCSV}
                className="flex items-center space-x-1.5 px-2 py-1 text-[10px] text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/30 hover:bg-[#C5A059]/20 transition-all rounded font-bold uppercase font-mono cursor-pointer shrink-0"
                title={`Export ${activeCollection} collection directly to offline CSV spreadsheet`}
                type="button"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
            </div>
            
            {activeCollection === "customers" && (
              <div className="space-y-3 bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3 shadow-md">
                {/* Search and filter controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#A1A1AA]" />
                    <input
                      type="text"
                      placeholder="Search name/email/ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-lg pl-8 pr-2 py-1.5 text-[11px] text-[#E4E4E7] placeholder-[#71717A] focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>
                  <div>
                    <select
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-lg p-1.5 text-[11px] text-[#E4E4E7] focus:outline-none focus:border-[#C5A059]"
                    >
                      <option value="All">All Lifecycle Stages</option>
                      <option value="Lead">Lead</option>
                      <option value="MQL">MQL</option>
                      <option value="SQL">SQL</option>
                      <option value="Customer">Customer</option>
                      <option value="Churned">Churned</option>
                    </select>
                  </div>
                </div>

                {/* Sortable Header Bar */}
                <div className="pt-2.5 border-t border-[#27272A] flex items-center justify-between text-[10px] font-mono font-bold text-[#A1A1AA] uppercase select-none">
                  <span className="tracking-wide text-[#71717A] text-[9px]">Click Header To Sort:</span>
                  <div className="flex space-x-1.5" id="customer-table-header-sorter">
                    <button
                      type="button"
                      onClick={() => handleSort("dealRiskStatus")}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${sortBy === "dealRiskStatus" ? "bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/30" : "bg-[#141416] text-[#A1A1AA] border-[#27272A] hover:bg-white/5"}`}
                    >
                      <span>Risk Status</span>
                      <span className="text-[11px] font-bold leading-none">
                        {sortBy === "dealRiskStatus" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort("winProbability")}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${sortBy === "winProbability" ? "bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/30" : "bg-[#141416] text-[#A1A1AA] border-[#27272A] hover:bg-white/5"}`}
                    >
                      <span>Win Rate %</span>
                      <span className="text-[11px] font-bold leading-none">
                        {sortBy === "winProbability" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Bulk Actions & Export to CSV Row */}
                <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-[#27272A]/60 gap-2 text-[11px]">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSelectAllToggle}
                      className="flex items-center space-x-1 text-[#A1A1AA] hover:text-[#E4E4E7] transition-colors"
                      type="button"
                    >
                      {allSelected ? <CheckSquare className="w-4 h-4 text-[#C5A059]" /> : <Square className="w-4 h-4 text-[#52525B]" />}
                      <span className="font-medium text-[10px] uppercase font-mono select-none">Select All ({sortedCustomers.length})</span>
                    </button>

                    {selectedUids.length > 0 && (
                      <button
                        onClick={handleOpenBulkDeleteConfirm}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-red-950/45 text-red-400 border border-red-900/50 hover:bg-red-900/30 transition-all font-bold text-[10px]"
                        type="button"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete ({selectedUids.length})</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExportToCSV}
                    disabled={sortedCustomers.length === 0}
                    className="flex items-center space-x-1 px-2 py-1 text-[11px] text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/30 hover:bg-[#C5A059]/20 transition-all rounded font-bold disabled:opacity-40 disabled:pointer-events-none"
                    type="button"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>
            )}

            {activeCollection === "customers" && sortedCustomers.length === 0 && (
              <div className="text-center py-6 bg-[#0A0A0B] rounded-xl border border-[#27272A] text-xs text-[#A1A1AA] font-mono">
                No customer profiles match your search filters.
              </div>
            )}

            {activeCollection === "customers" && sortedCustomers.map(c => {
              const isSelected = selectedUids.includes(c.uid);
              const isExpanded = expandedUid === c.uid;
              const custLogs = getCustomerLogs(c);

              return (
                <div 
                  key={c.uid} 
                  onClick={() => setExpandedUid(prev => prev === c.uid ? null : c.uid)}
                  className={`bg-[#0A0A0B] border rounded-xl p-3.5 text-xs flex flex-col justify-between hover:border-[#C5A059]/40 transition-all font-sans cursor-pointer ${isExpanded ? "ring-1 ring-[#C5A059]/40 border-[#C5A059]/85 bg-[#121214]" : isSelected ? "border-[#C5A059] bg-[#C5A059]/5" : "border-[#27272A]"}`}
                >
                  <div className="flex items-start space-x-3">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(c.uid);
                      }}
                      className="mt-0.5 text-[#52525B]"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#C5A059] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-[#27272A] hover:text-[#A1A1AA] shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 font-sans">
                      <div className="flex justify-between items-center font-mono text-[10px] text-[#A1A1AA] mb-1.5 gap-2">
                        <span className="truncate">ID: {c.uid}</span>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {renderRiskBadge(c.dealRiskStatus)}
                          <span className="text-[#C5A059] font-bold uppercase font-sans text-[10px]">{c.tier}</span>
                        </div>
                      </div>
                      <div className="flex justify-between mb-1.5 text-[#E4E4E7]">
                        <span className="font-bold truncate text-[13px]">{c.name}</span>
                        <span className="text-[#A1A1AA] font-mono text-[11px] truncate ml-2">{c.email}</span>
                      </div>
                      <div className="flex justify-between text-[#A1A1AA] font-mono mt-1 text-[10px] border-t border-[#27272A]/40 pt-1.5">
                        <span>Score: {c.leadScore}/100</span>
                        <span>LTV: ${c.lifetimeValue.toLocaleString()}</span>
                        <span className="text-[#C5A059] font-sans font-bold">{c.lifecycleStage}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expand-Details Block */}
                  {isExpanded && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="mt-3 bg-[#050506] border border-[#27272A] rounded-xl p-3 text-[11px] text-[#A1A1AA] space-y-3 cursor-default"
                    >
                      {/* Section Title */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#27272A]">
                        <span className="font-bold uppercase text-[#C5A059] text-[9px] tracking-wider font-mono">
                          🔬 Client Diagnostics & Risk Analysis
                        </span>
                        <span className="text-[10px] font-mono text-[#71717A]">{c.assignedRep ? `Rep: ${c.assignedRep}` : "Unassigned"}</span>
                      </div>

                      {/* Diagnostic Metrics Matrix */}
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 bg-[#141416]/60 rounded-lg border border-[#27272A]">
                          <span className="text-[#71717A] block font-mono">WIN PROBABILITY</span>
                          <span className="text-white font-bold">{c.winProbability}%</span>
                        </div>
                        <div className="p-2 bg-[#141416]/60 rounded-lg border border-[#27272A]">
                          <span className="text-[#71717A] block font-mono">LAST INTERACTION</span>
                          <span className="text-white font-bold">{c.lastInteractionDays} Days Ago</span>
                        </div>
                      </div>

                      {/* Risk Factors Breakdown */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-[#E4E4E7] text-[10px] uppercase font-mono block">Detected Risk Factors:</span>
                        <div className="space-y-1">
                          {c.leadScore < 40 ? (
                            <div className="text-[#FBBF24] bg-amber-950/20 px-2.5 py-1.5 rounded text-[10px] border border-[#D97706]/30">
                              ⚠️ <strong>Low Lead Score ({c.leadScore}/100):</strong> Core telemetry profile shows below benchmark engagement. Needs proactive pipeline nurture.
                            </div>
                          ) : (
                            <div className="text-emerald-400 bg-emerald-950/20 px-2.5 py-1.5 rounded text-[10px] border border-[#059669]/30">
                              ✅ <strong>Qualified Score ({c.leadScore}/100):</strong> Lead engagement quotient is active and qualified.
                            </div>
                          )}

                          {c.lastInteractionDays > 10 ? (
                            <div className="text-red-400 bg-red-950/20 px-2.5 py-1.5 rounded text-[10px] border border-red-900/30">
                              🚨 <strong>Stale Conversation ({c.lastInteractionDays} days):</strong> Last recorded interaction window has drifted. Priority interaction advised.
                            </div>
                          ) : (
                            <div className="text-emerald-400 bg-emerald-950/20 px-2.5 py-1.5 rounded text-[10px] border border-[#059669]/30">
                              ✅ <strong>Recent Touchpoint ({c.lastInteractionDays} days):</strong> Fresh CRM database interaction satisfies SLAs.
                            </div>
                          )}

                          {(c.sentiment === "Negative" || c.sentiment === "At Risk") ? (
                            <div className="text-red-400 bg-red-950/20 px-2.5 py-1.5 rounded text-[10px] border border-red-900/30">
                              🚨 <strong>High Attrition Danger:</strong> Semantic CSAT indicator is critical ("{c.sentiment}"). Action plan recommended.
                            </div>
                          ) : (
                            <div className="text-[#A1A1AA] bg-white/5 px-2.5 py-1.5 rounded text-[10px] border border-[#27272A]">
                              💬 <strong>Tone Classification:</strong> NLP score is classified as "{c.sentiment || 'Neutral'}".
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Associated Audit Logs Stream */}
                      <div className="space-y-1.5 pt-1.5 border-t border-[#27272A]">
                        <div className="flex items-center justify-between text-[10px] uppercase font-mono">
                          <span className="font-bold text-[#E4E4E7]">Index Event Feed:</span>
                          <span className="text-[#C5A059] font-bold">{custLogs.length} events</span>
                        </div>
                        {custLogs.length > 0 ? (
                          <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                            {custLogs.map(log => (
                              <div key={log.id} className="bg-[#0A0A0B] p-1.5 rounded border border-[#27272A]/50 font-mono text-[9px] leading-tight flex flex-col gap-1">
                                <div className="flex justify-between text-[#71717A] mb-0.5">
                                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                  <span className="text-[#C5A059]">{log.action}</span>
                                </div>
                                <p className="text-[#E4E4E7] font-sans italic">"{log.details}"</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] italic text-[#71717A] font-sans">No indexed mutations or risk updates logged for this instance in this session.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {activeCollection === "campaigns" && campaigns.map(camp => (
              <div key={camp.campaign_id} className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3.5 text-xs flex flex-col justify-between hover:border-[#C5A059]/30 transition-all font-sans">
                <div className="flex justify-between font-mono text-[10px] text-[#A1A1AA] mb-1.5">
                  <span>ID: {camp.campaign_id}</span>
                  <span className={camp.status === "Active" ? "text-emerald-400 font-bold" : "text-[#A1A1AA]"}>{camp.status.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-[#E4E4E7] font-bold mb-1.5">
                  <span>{camp.title}</span>
                </div>
                <div className="flex justify-between text-[#A1A1AA] font-mono text-[10px] mt-1 border-t border-[#27272A] pt-1.5">
                  <span>Budget: ${camp.budget.toLocaleString()}</span>
                  <span>Clicks: {camp.clicks}</span>
                  <span className="text-emerald-400 font-sans font-bold">ROI: ${camp.revenueGenerated.toLocaleString()}</span>
                </div>
              </div>
            ))}

            {activeCollection === "support_tickets" && tickets.map(t => (
              <div key={t.ticket_id} className="bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3.5 text-xs flex flex-col justify-between hover:border-[#C5A059]/30 transition-all font-sans">
                <div className="flex justify-between font-mono text-[10px] text-[#A1A1AA] mb-1.5">
                  <span>ID: {t.ticket_id}</span>
                  <span className={`font-bold uppercase ${t.priority === "Urgent" ? "text-red-450" : "text-amber-400"}`}>{t.priority}</span>
                </div>
                <div className="text-[#E4E4E7] font-bold mb-1.5">{t.customerName}</div>
                <p className="text-[#A1A1AA] line-clamp-1 text-[11px] font-sans italic mb-1">"{t.issue}"</p>
                <div className="flex justify-between text-[#A1A1AA] font-mono text-[10px] mt-1 border-t border-[#27272A] pt-1.5">
                  <span>Status: <strong className="text-blue-400 font-sans">{t.status}</strong></span>
                  <span>Sentiment: <strong>{t.sentiment}</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* CREATE CUSTOMER DOCK */}
          <div className="lg:col-span-4 bg-[#0A0A0B] rounded-2xl p-4.5 border border-[#27272A] text-xs">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-2 mb-3">
              <div className="flex items-center space-x-2 text-[#C5A059] font-bold uppercase tracking-wider text-[11px] font-display">
                <UserPlus className="w-4 h-4 text-[#C5A059]" />
                <span>{showBulkImport ? "Bulk CSV Importer" : "Register Customer"}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBulkImport(prev => !prev);
                  setImportErrors([]);
                  setValidatedRecords([]);
                  setImportFileName("");
                }}
                className="px-2 py-1 text-[10px] font-bold tracking-wide uppercase bg-zinc-900 border border-zinc-800 hover:border-[#C5A059]/40 hover:text-[#C5A059] rounded text-zinc-400 transition-colors cursor-pointer font-mono"
              >
                {showBulkImport ? "Manual Form" : "Bulk Import CSV"}
              </button>
            </div>

            {!showBulkImport ? (
              <form onSubmit={handleCreateCustomerSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 leading-none font-sans">Full Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sterling Thorne"
                    value={frmName}
                    onChange={(e) => setFrmName(e.target.value)}
                    className="w-full bg-[#141416] border border-[#27272A] rounded-xl p-2.5 text-[#E4E4E7] focus:outline-none focus:border-[#C5A059] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 leading-none font-sans">Corporate Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. s.thorne@corp.com"
                    value={frmEmail}
                    onChange={(e) => setFrmEmail(e.target.value)}
                    className="w-full bg-[#141416] border border-[#27272A] rounded-xl p-2.5 text-[#E4E4E7] focus:outline-none focus:border-[#C5A059] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 leading-none font-sans">Category Status</label>
                    <select
                      value={frmStage}
                      onChange={(e) => setFrmStage(e.target.value as any)}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-xl p-2 focus:outline-none focus:border-[#C5A059] outline-none text-[#E4E4E7]"
                    >
                      <option value="Lead">Lead</option>
                      <option value="MQL">MQL</option>
                      <option value="SQL">SQL</option>
                      <option value="Customer">Customer</option>
                      <option value="Churned">Churned</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 leading-none font-sans">Active Tier</label>
                    <select
                      value={frmTier}
                      onChange={(e) => setFrmTier(e.target.value as any)}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-xl p-2 focus:outline-none focus:border-[#C5A059] outline-none text-[#E4E4E7]"
                    >
                      <option value="Free">Free</option>
                      <option value="Premium">Premium</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 leading-none font-sans">Lead Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={frmScore}
                      onChange={(e) => setFrmScore(Number(e.target.value))}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-xl p-2 text-[#E4E4E7] focus:outline-none focus:border-[#C5A059] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#A1A1AA] mb-1 leading-none font-sans">Initial Contract ($)</label>
                    <input
                      type="number"
                      value={frmLTV}
                      onChange={(e) => setFrmLTV(Number(e.target.value))}
                      className="w-full bg-[#141416] border border-[#27272A] rounded-xl p-2 text-[#E4E4E7] focus:outline-none focus:border-[#C5A059] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] font-bold text-xs py-2.5 rounded-xl transition-all shadow-md cursor-pointer mt-1"
                >
                  Insert Firestore Record
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                  Bulk upload multiple client profiles simultaneously. Required headers are <strong className="text-white">Name</strong> and <strong className="text-white">Email</strong>. Values get validated locally before compilation.
                </p>

                {/* DRAG AND DROP ZONE */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => {
                    const fileInput = document.getElementById("csv-file-browse-trigger");
                    if (fileInput) fileInput.click();
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    dragActive 
                      ? "border-[#C5A059] bg-[#C5A059]/5 scale-[0.99]" 
                      : importFileName 
                        ? "border-emerald-500/50 bg-emerald-950/5" 
                        : "border-[#27272A] hover:border-zinc-700 bg-black/30"
                  }`}
                >
                  <input
                    id="csv-file-browse-trigger"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {importFileName ? (
                    <div className="space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-emerald-400 mx-auto" />
                      <div>
                        <span className="text-xs text-white block truncate max-w-[200px] mx-auto font-mono font-bold">{importFileName}</span>
                        <span className="text-[10px] text-zinc-500 block">Click or drop another file to replace</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <Upload className="w-8 h-8 text-[#C5A059] mx-auto" />
                      <div>
                        <span className="text-xs text-[#E4E4E7] block font-semibold">Drag & drop CSV file here</span>
                        <span className="text-[10px] text-zinc-500 block mt-0.5">or click to browse local folders</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* TEMPLATE DOWNLOADA TRIGGER */}
                <div className="flex items-center justify-between text-[11px] bg-[#141416]/50 p-2.5 rounded-lg border border-[#27272A]">
                  <span className="text-zinc-400 font-mono">Reference Format Layout:</span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-[#C5A059] hover:underline font-bold text-[10px] uppercase font-mono cursor-pointer"
                  >
                    📥 Template.csv
                  </button>
                </div>

                {/* LOCAL CLIENT VALIDATION SUMMARY OUTLET */}
                {importErrors.length > 0 && (
                  <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 space-y-2">
                    <span className="text-[10px] text-red-450 uppercase font-mono tracking-wider font-bold block flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-450 shrink-0" /> Validation issues detected ({importErrors.length})
                    </span>
                    <ul className="text-[10.5px] text-zinc-400 font-mono space-y-1 list-disc list-inside max-h-[85px] overflow-y-auto leading-normal">
                      {importErrors.slice(0, 5).map((err, idx) => (
                        <li key={idx} className="truncate" title={err}>{err}</li>
                      ))}
                      {importErrors.length > 5 && (
                        <li className="text-[9.5px] italic text-zinc-500 font-sans list-none pt-0.5">...and {importErrors.length - 5} additional structured format flags.</li>
                      )}
                    </ul>
                  </div>
                )}

                {validatedRecords.length > 0 && importErrors.length === 0 && (
                  <div className="bg-emerald-950/25 border border-emerald-900/40 rounded-xl p-3 text-center space-y-2.5">
                    <span className="text-xs text-emerald-400 font-bold block">
                      ✓ local validation cleared successfully!
                    </span>
                    <span className="text-[11px] text-zinc-300 block font-mono">
                      Prepared <strong className="text-white font-sans">{validatedRecords.length}</strong> user profiles for database entry.
                    </span>

                    <button
                      type="button"
                      onClick={handleCommitImport}
                      disabled={isImportingInProgress}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-xl transition-all shadow cursor-pointer disabled:opacity-50"
                    >
                      {isImportingInProgress ? "Writing to Firestore..." : `Commit Import to Firestore`}
                    </button>
                  </div>
                )}

                {validatedRecords.length > 0 && importErrors.length > 0 && (
                  <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 text-center space-y-2.5">
                    <span className="text-xs text-amber-500 font-bold block">
                      ⚠️ Partial validation: {validatedRecords.length} profiles valid
                    </span>
                    <span className="text-[10.5px] text-zinc-400 block leading-relaxed">
                      Please rectify the syntax alerts above in your CSV file to complete bulk sync securely.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#0A0A0B] p-4.5 rounded-2xl border border-[#27272A]">
            <div className="flex items-center space-x-3.5">
              <Shield className="w-5 h-5 text-emerald-450" />
              <div>
                <h4 className="font-bold text-[#E4E4E7] text-sm">Active Rules Version: 2 (Enforced)</h4>
                <p className="text-xs text-[#A1A1AA]">Tier-Based Firestore Security Shield guarding client profiles and marketing workflows.</p>
              </div>
            </div>
            <span className="bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 text-[10px] font-mono font-bold px-2 py-1 rounded">
              ✔ HEALTHY SHIELD ACTIVE
            </span>
          </div>

          <div className="bg-[#0A0A0B] border border-[#27272A] rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#050505] px-4 py-2 flex justify-between items-center text-xs font-mono border-b border-[#27272A] text-[#A1A1AA]">
              <span>firestore.rules</span>
              <span className="text-[10px] text-[#A1A1AA]/50">Zero-Trust Security ABAC Enforced</span>
            </div>
            <pre className="p-4 text-xs font-mono text-[#E4E4E7] overflow-x-auto max-h-[300px] leading-relaxed bg-[#050505]">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Help User Tier validation Rule and access checks
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    match /customers/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || getUserTier() == "Enterprise");
      allow write: if request.auth != null && (
        (request.auth.uid == userId) || 
        (getUserTier() == "Enterprise")
      );
    }

    match /marketing_campaigns/{campaignId} {
      allow read, write: if request.auth != null && (
        getUserTier() == "Premium" || getUserTier() == "Enterprise"
      );
    }
  }`}
            </pre>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="bg-[#0A0A0B] border border-[#27272A] rounded-2xl overflow-hidden shadow-2xl p-4 font-mono text-xs text-[#E4E4E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A] mb-3 text-[#A1A1AA] text-[11px]">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[#C5A059]" />
                <span>FIREBASE ACTION AUDIT STREAM — akindewum@gmail.com</span>
              </div>
              <span className="text-emerald-450 tracking-widest text-[10px] animate-pulse">● LIVE TELEMETRY</span>
            </div>

            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {logs.map(l => (
                <div key={l.id} className="border-b border-[#27272A] pb-2 text-[11px]">
                  <div className="flex justify-between text-[#A1A1AA] mb-1">
                    <span>[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-[#C5A059] font-semibold">{l.action}</span>
                    <span className="text-[#A1A1AA]">path: /{l.collection}</span>
                    <span className="text-emerald-400 bg-emerald-950/30 px-1 border border-emerald-900/30 rounded text-[9px] font-bold">OK</span>
                  </div>
                  <p className="text-[#E4E4E7] font-sans italic ml-4">"{l.details}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
