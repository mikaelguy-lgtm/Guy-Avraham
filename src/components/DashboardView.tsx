import React, { useState } from "react";
import { Client } from "../types";
import { api } from "../utils/apiClient";
import { 
  Users, 
  FileCheck2, 
  Send, 
  CheckCircle2, 
  TrendingUp, 
  Sparkles, 
  ArrowLeft, 
  Search,
  MessageSquare,
  AlertCircle,
  Pencil,
  X
} from "lucide-react";

interface DashboardViewProps {
  clients: Client[];
  onSelectClient: (client: Client, tab: string) => void;
  advisorName?: string;
  onRefreshClients?: () => void;
}

export default function DashboardView({ 
  clients, 
  onSelectClient, 
  advisorName = "דוד",
  onRefreshClients 
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("default");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [aiSelectedClient, setAiSelectedClient] = useState<string>(clients[0]?.id || "");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswers, setAiAnswers] = useState<{ [clientId: string]: string }>({});
  const [aiLoading, setAiLoading] = useState(false);

  // Filter clients based on search
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.idNumber.includes(searchTerm) ||
    c.phone.includes(searchTerm)
  );

  const statusWeights: Record<string, number> = {
    draft: 1,
    active: 2,
    sent: 3,
    closed: 4
  };

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortBy === "status") {
      return (statusWeights[a.status] || 0) - (statusWeights[b.status] || 0);
    }
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "he");
    }
    if (sortBy === "amount") {
      return Number(b.requestedAmount) - Number(a.requestedAmount);
    }
    return 0; // default (order as received)
  });

  const handleStartEdit = (client: Client) => {
    setEditingClient(client);
    setEditForm({ ...client });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    if (!editForm.name?.trim()) {
      alert("נא להזין שם לקוח");
      return;
    }
    if (!editForm.idNumber?.trim()) {
      alert("נא להזין מספר תעודת זהות");
      return;
    }

    setIsSaving(true);
    try {
      const val = Number(editForm.propertyValue) || 0;
      const reqAmt = Number(editForm.requestedAmount) || 0;
      const pct = val > 0 ? Math.round((reqAmt / val) * 100).toString() : "0";
      
      const updatedData: Partial<Client> = {
        name: editForm.name,
        idNumber: editForm.idNumber,
        phone: editForm.phone || "",
        dealType: editForm.dealType || "רכישה מקבלן",
        propertyCity: editForm.propertyCity || "",
        propertyStreet: editForm.propertyStreet || "",
        propertyValue: editForm.propertyValue || "0",
        requestedAmount: editForm.requestedAmount || "0",
        financingPercentage: pct,
        income: editForm.income || "0",
        expenses: editForm.expenses || "0",
        status: editForm.status || "draft",
        notes: editForm.notes || ""
      };

      await api.updateClient(editingClient.id, updatedData);
      
      if (onRefreshClients) {
        onRefreshClients();
      }
      
      setEditingClient(null);
    } catch (error) {
      console.error("Failed to update client:", error);
      alert("שגיאה בשמירת נתוני הלקוח");
    } finally {
      setIsSaving(false);
    }
  };

  // Compute KPI metrics
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === "active" || c.status === "draft").length;
  const sentToLenders = clients.filter(c => c.status === "sent").length;
  const closedDeals = clients.filter(c => c.status === "closed").length;

  const handleAskAi = async (suggestedQ?: string) => {
    const q = suggestedQ || aiQuestion;
    if (!q || !aiSelectedClient) return;

    setAiLoading(true);
    try {
      const data = await api.askAdvisor(aiSelectedClient, q);
      setAiAnswers(prev => ({
        ...prev,
        [aiSelectedClient]: data.advice
      }));
      setAiQuestion("");
    } catch (error) {
      console.error("Failed to fetch advice", error);
    } finally {
      setAiLoading(false);
    }
  };

  const selectedClientForAi = clients.find(c => c.id === aiSelectedClient);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight font-sans">
          שלום {advisorName}, ברוך הבא ל-<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">SynCash</span>
        </h2>
        <p className="text-slate-400 font-medium mt-1.5">מבט על העסקאות, הגיוסים וסטטוס השדורים שלך לחברות המימון החוץ-בנקאיות.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-between group hover:border-cyan-500/30 transition-all duration-300">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">סך הכל לקוחות</p>
            <h3 className="text-3xl font-bold text-white mt-2 tracking-tight group-hover:text-cyan-400 transition-colors">{totalClients}</h3>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg group-hover:scale-110 transition-transform duration-300">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-between group hover:border-cyan-500/30 transition-all duration-300">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">תיקים בטיפול/טיוטה</p>
            <h3 className="text-3xl font-bold text-cyan-400 mt-2 tracking-tight">{activeClients}</h3>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:scale-110 transition-transform duration-300">
            <FileCheck2 className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-between group hover:border-cyan-500/30 transition-all duration-300">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">שודרו לחברות מימון</p>
            <h3 className="text-3xl font-bold text-amber-400 mt-2 tracking-tight">{sentToLenders}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg group-hover:scale-110 transition-transform duration-300">
            <Send className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-between group hover:border-cyan-500/30 transition-all duration-300">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">תיקים שנסגרו בהצלחה</p>
            <h3 className="text-3xl font-bold text-emerald-400 mt-2 tracking-tight">{closedDeals}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Clients Table */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-lg lg:col-span-2 overflow-hidden">
          <div className="p-6 border-b border-slate-800/80 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <h4 className="text-lg font-bold text-white">תיקי לקוחות במערכת</h4>
              <p className="text-xs text-slate-400 mt-1">לחץ על לקוח כדי לנהל את מסמכיו או לשדר את תיקו.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="חיפוש לקוח לפי שם, ת.ז..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 whitespace-nowrap">מיון:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg bg-slate-950/80 border border-slate-800 py-2 px-3 text-xs text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                >
                  <option value="default">ברירת מחדל (תאריך הוספה)</option>
                  <option value="status">סטטוס תיק</option>
                  <option value="name">שם לקוח (א-ת)</option>
                  <option value="amount">סכום הלוואה (מהגבוה לנמוך)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            {sortedClients.length > 0 ? (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-950/40 text-slate-400 font-bold border-b border-slate-800/60">
                  <tr>
                    <th className="px-4 py-4 text-center w-12">#</th>
                    <th className="px-6 py-4">שם הלקוח</th>
                    <th className="px-6 py-4">פרטי עסקה</th>
                    <th className="px-6 py-4">סטטוס</th>
                    <th className="px-6 py-4">מסמכים</th>
                    <th className="px-6 py-4">פעולות מהירות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {sortedClients.map((client, index) => {
                    const uploadedDocs = client.documents.filter(d => d.status === "uploaded").length;
                    const totalDocs = client.documents.length;
                    const isFullyUploaded = uploadedDocs === totalDocs;

                    return (
                      <tr key={client.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-4 text-center text-slate-500 font-mono text-xs font-bold">{index + 1}</td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-bold text-white text-base">{client.name}</p>
                            <p className="text-xs text-slate-400 font-normal mt-0.5">ת.ז: {client.idNumber} | {client.phone}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-xs text-slate-400">
                              {client.dealType}
                              {client.propertyCity && ` (${client.propertyCity}${client.propertyStreet ? `, ${client.propertyStreet}` : ""})`}
                            </p>
                            <p className="font-semibold text-slate-200 mt-0.5">
                              {Number(client.requestedAmount).toLocaleString()} ₪ מתוך {Number(client.propertyValue).toLocaleString()} ₪
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            client.status === "draft" ? "bg-slate-800 text-slate-400 border border-slate-700/60" :
                            client.status === "active" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                            client.status === "sent" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              client.status === "draft" ? "bg-slate-400" :
                              client.status === "active" ? "bg-cyan-400 animate-pulse" :
                              client.status === "sent" ? "bg-amber-400" :
                              "bg-emerald-400"
                            }`}></span>
                            {client.status === "draft" ? "טיוטה" :
                             client.status === "active" ? "פעיל - מוכן לשדור" :
                             client.status === "sent" ? "שודר - ממתין להצעות" :
                             "תיק סגור"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-850 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${isFullyUploaded ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"}`}
                                style={{ width: `${(uploadedDocs / totalDocs) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-400 font-bold">{uploadedDocs}/{totalDocs}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleStartEdit(client)}
                              title="ערוך פרטי לקוח"
                              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 bg-slate-900 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => onSelectClient(client, "documents")}
                              className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                            >
                              מסמכים
                            </button>
                            <button 
                              onClick={() => onSelectClient(client, "arena")}
                              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-[0_4px_12px_rgba(6,182,212,0.25)] hover:scale-[1.02]"
                            >
                              שדור וזירה
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <AlertCircle className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                <p className="font-bold text-slate-400">לא נמצאו לקוחות במערכת</p>
                <p className="text-xs text-slate-500 mt-1">נסה לשנות את מונח החיפוש או הוסף לקוח חדש.</p>
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden">
            {sortedClients.length > 0 ? (
              <div className="p-4 space-y-4 divide-y divide-slate-800/40">
                {sortedClients.map((client, index) => {
                  const uploadedDocs = client.documents.filter(d => d.status === "uploaded").length;
                  const totalDocs = client.documents.length;
                  const isFullyUploaded = uploadedDocs === totalDocs;

                  return (
                    <div key={client.id} className={`${index > 0 ? "pt-4" : ""} flex flex-col gap-3`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center font-mono text-xs bg-slate-800 border border-slate-700/50 text-slate-400 font-bold h-6 w-6 rounded-md">
                            {index + 1}
                          </span>
                          <div>
                            <h5 className="font-bold text-white text-base leading-snug">{client.name}</h5>
                            <p className="text-xs text-slate-400 font-normal mt-0.5">ת.ז: {client.idNumber} | {client.phone}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          client.status === "draft" ? "bg-slate-800 text-slate-400 border border-slate-700/60" :
                          client.status === "active" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                          client.status === "sent" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${
                            client.status === "draft" ? "bg-slate-400" :
                            client.status === "active" ? "bg-cyan-400 animate-pulse" :
                            client.status === "sent" ? "bg-amber-400" :
                            "bg-emerald-400"
                          }`}></span>
                          {client.status === "draft" ? "טיוטה" :
                           client.status === "active" ? "מוכן לשדור" :
                           client.status === "sent" ? "שודר" :
                           "תיק סגור"}
                        </span>
                      </div>

                      <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-400">סוג עסקה:</span>
                          <span className="font-semibold text-slate-200">{client.dealType}</span>
                        </div>
                        {client.propertyCity && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">נכס:</span>
                            <span className="font-medium text-slate-300">{client.propertyCity}{client.propertyStreet ? `, ${client.propertyStreet}` : ""}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">מימון מבוקש:</span>
                          <span className="font-bold text-cyan-400">₪{Number(client.requestedAmount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">שווי נכס:</span>
                          <span className="font-semibold text-slate-300">₪{Number(client.propertyValue).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">מסמכים:</span>
                          <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${isFullyUploaded ? "bg-emerald-500" : "bg-cyan-500"}`}
                              style={{ width: `${(uploadedDocs / totalDocs) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-slate-400 font-bold">{uploadedDocs}/{totalDocs}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleStartEdit(client)}
                            title="ערוך פרטי לקוח"
                            className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 bg-slate-900 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => onSelectClient(client, "documents")}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 transition-colors"
                          >
                            מסמכים
                          </button>
                          <button 
                            onClick={() => onSelectClient(client, "arena")}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-all shadow-[0_4px_12px_rgba(6,182,212,0.25)]"
                          >
                            שדור וזירה
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <AlertCircle className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="font-bold text-slate-400 text-sm">לא נמצאו לקוחות במערכת</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Mortgage Consultant Section */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-lg p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <Sparkles className="h-5 w-5 text-amber-400 fill-amber-500/30 animate-pulse" />
              <h4 className="text-lg font-bold text-white">היועץ הפיננסי מבוסס AI</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              בחר תיק לקוח וקבל ייעוץ אסטרטגי לגבי סיכויי הגיוס, אסטרטגיית חיתום ואיזו חברה חוץ-בנקאית הכי מתאימה עבורו.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">בחר לקוח לניתוח</label>
              <select 
                value={aiSelectedClient}
                onChange={(e) => setAiSelectedClient(e.target.value)}
                className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              >
                <option value="" className="bg-slate-950">-- בחר לקוח --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-950">{c.name} ({c.employmentType === "self-employed" ? "עצמאי" : "שכיר"})</option>
                ))}
              </select>
            </div>

            {selectedClientForAi && (
              <div className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-lg text-xs space-y-1.5 text-slate-300">
                <p><span className="font-bold text-slate-400">לקוח:</span> {selectedClientForAi.name}</p>
                <p><span className="font-bold text-slate-400">עסקה:</span> {selectedClientForAi.dealType}</p>
                <p><span className="font-bold text-slate-400">שיעור מימון:</span> {selectedClientForAi.financingPercentage}%</p>
                <p><span className="font-bold text-slate-400">הכנסה חודשית:</span> {Number(selectedClientForAi.income).toLocaleString()} ₪</p>
              </div>
            )}

            {/* Answer Display */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-4 min-h-[140px] max-h-[220px] overflow-y-auto text-xs text-slate-300 leading-relaxed font-medium">
              {aiLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-8">
                  <div className="h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 animate-pulse text-center">מנתח את תיק הלקוח ומגבש המלצה...</p>
                </div>
              ) : aiAnswers[aiSelectedClient] ? (
                <div className="space-y-2 whitespace-pre-line">
                  <p className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-cyan-400" />
                    הניתוח הפיננסי של SynCash AI:
                  </p>
                  <p className="text-slate-200">{aiAnswers[aiSelectedClient]}</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-10">
                  <Sparkles className="h-8 w-8 text-slate-700 mb-2" />
                  <p className="font-bold">הניתוח יוצג כאן</p>
                  <p className="text-[10px] text-slate-600 mt-1">שאל שאלה או בחר אחת מהשאלות המוצעות למטה.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 mt-4 pt-4 border-t border-slate-800/80">
            {/* Suggested prompts */}
            {selectedClientForAi && !aiLoading && (
              <div className="flex flex-wrap gap-1.5">
                <button 
                  onClick={() => handleAskAi("אילו חברות חוץ-בנקאיות הכי מתאימות לתיק הזה ולמה?")}
                  className="px-2.5 py-1 rounded-full bg-slate-800/50 hover:bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700/40 text-right transition-colors"
                >
                  🎯 אילו חברות מימון הכי מתאימות?
                </button>
                <button 
                  onClick={() => handleAskAi("מהם האתגרים או נקודות התורפה בתיק זה ואיך כדאי להציג אותו לחברות?")}
                  className="px-2.5 py-1 rounded-full bg-slate-800/50 hover:bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700/40 text-right transition-colors"
                >
                  ⚡ מהם האתגרים בתיק?
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="שאל את ה-AI על התיק..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                disabled={!aiSelectedClient || aiLoading}
                className="flex-1 rounded-lg bg-slate-950/80 border border-slate-800 py-2 px-3 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none disabled:bg-slate-950/20 disabled:text-slate-600 transition-all"
              />
              <button
                onClick={() => handleAskAi()}
                disabled={!aiQuestion || !aiSelectedClient || aiLoading}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:bg-slate-800 disabled:text-slate-600 transition-colors shadow-md"
              >
                שאל
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto text-right flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-400" />
                עריכת פרטי לקוח: {editingClient.name}
              </h3>
              <button 
                type="button"
                onClick={() => setEditingClient(null)}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">שם מלא של הלווה <span className="text-rose-500">*</span></label>
                  <input 
                    type="text"
                    required
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* ID Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">מספר תעודת זהות <span className="text-rose-500">*</span></label>
                  <input 
                    type="text"
                    required
                    value={editForm.idNumber || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, idNumber: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">מספר טלפון</label>
                  <input 
                    type="text"
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">סטטוס תיק</label>
                  <select 
                    value={editForm.status || "draft"}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  >
                    <option value="draft" className="bg-slate-950">טיוטה</option>
                    <option value="active" className="bg-slate-950">פעיל - מוכן לשדור</option>
                    <option value="sent" className="bg-slate-950">שודר - ממתין להצעות</option>
                    <option value="closed" className="bg-slate-950">תיק סגור</option>
                  </select>
                </div>

                {/* Deal Type */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">סוג עסקה</label>
                  <select 
                    value={editForm.dealType || "רכישה מקבלן"}
                    onChange={(e) => setEditForm(prev => ({ ...prev, dealType: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  >
                    <option value="רכישה מקבלן" className="bg-slate-950">רכישה מקבלן</option>
                    <option value="רכישת דירה יד שנייה" className="bg-slate-950">רכישת דירה יד שנייה</option>
                    <option value="בנייה עצמית / שיפוץ" className="bg-slate-950">בנייה עצמית / שיפוץ</option>
                    <option value="מיחזור משכנתא" className="bg-slate-950">מיחזור משכנתא</option>
                    <option value="הלוואה לכל מטרה" className="bg-slate-950">הלוואה לכל מטרה</option>
                  </select>
                </div>

                {/* Income */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">הכנסה חודשית נטו (₪)</label>
                  <input 
                    type="number"
                    value={editForm.income || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, income: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Property Value */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">שווי הנכס המוערך (₪)</label>
                  <input 
                    type="number"
                    value={editForm.propertyValue || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, propertyValue: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Requested Amount */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">סכום ההלוואה המבוקש (₪)</label>
                  <input 
                    type="number"
                    value={editForm.requestedAmount || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, requestedAmount: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Property City */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">עיר הנכס</label>
                  <input 
                    type="text"
                    value={editForm.propertyCity || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, propertyCity: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Property Street */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">רחוב ומספר בית</label>
                  <input 
                    type="text"
                    value={editForm.propertyStreet || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, propertyStreet: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Expenses */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">הוצאות חודשיות קבועות (₪)</label>
                  <input 
                    type="number"
                    value={editForm.expenses || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, expenses: e.target.value }))}
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2.5 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                {/* Calculated financing percentage */}
                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">אחוז מימון מחושב</p>
                    <p className="text-cyan-400 font-black mt-1 text-base">
                      {Number(editForm.propertyValue) > 0 
                        ? Math.round((Number(editForm.requestedAmount) / Number(editForm.propertyValue)) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>

              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">הערות ורקע מיוחד</label>
                <textarea 
                  rows={3}
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg bg-slate-950/80 border border-slate-800 py-2 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all resize-none"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                <button 
                  type="button"
                  disabled={isSaving}
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  ביטול
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-950/40 transition-colors disabled:bg-slate-800 disabled:text-slate-600 flex items-center gap-2"
                >
                  {isSaving && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {isSaving ? "שומר..." : "שמור שינויים"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
    </div>
  );
}
