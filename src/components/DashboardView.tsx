import React, { useState } from "react";
import { Client } from "../types";
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
  AlertCircle
} from "lucide-react";

interface DashboardViewProps {
  clients: Client[];
  onSelectClient: (client: Client, tab: string) => void;
  advisorName?: string;
}

export default function DashboardView({ clients, onSelectClient, advisorName = "דוד" }: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
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
      const res = await fetch(`/api/clients/${aiSelectedClient}/ask-advisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
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
          <div className="p-6 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-lg font-bold text-white">תיקי לקוחות במערכת</h4>
              <p className="text-xs text-slate-400 mt-1">לחץ על לקוח כדי לנהל את מסמכיו או לשדר את תיקו.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="חיפוש לקוח לפי שם, ת.ז..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-10 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredClients.length > 0 ? (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-950/40 text-slate-400 font-bold border-b border-slate-800/60">
                  <tr>
                    <th className="px-6 py-4">שם הלקוח</th>
                    <th className="px-6 py-4">פרטי עסקה</th>
                    <th className="px-6 py-4">סטטוס</th>
                    <th className="px-6 py-4">מסמכים</th>
                    <th className="px-6 py-4">פעולות מהירות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {filteredClients.map((client) => {
                    const uploadedDocs = client.documents.filter(d => d.status === "uploaded").length;
                    const totalDocs = client.documents.length;
                    const isFullyUploaded = uploadedDocs === totalDocs;

                    return (
                      <tr key={client.id} className="hover:bg-slate-800/20 transition-colors">
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
    </div>
  );
}
