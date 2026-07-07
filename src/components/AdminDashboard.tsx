import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserCheck, 
  Coins, 
  Percent, 
  Search, 
  Trash2, 
  FileText, 
  PieChart, 
  ArrowLeft, 
  Building2, 
  ShieldAlert,
  User,
  ExternalLink,
  Briefcase
} from "lucide-react";
import { Client, AdvisorProfile } from "../types";
import { api } from "../utils/apiClient";

// Extends AdvisorProfile with backend ID and metadata
interface SavedAdvisor extends AdvisorProfile {
  id: string;
  registeredAt?: string;
  status?: string;
}

interface AdminDashboardProps {
  clients: Client[];
  onRefreshClients: () => void;
  onBackToApp: () => void;
}

export default function AdminDashboard({ clients, onRefreshClients, onBackToApp }: AdminDashboardProps) {
  const [advisors, setAdvisors] = useState<SavedAdvisor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdvisorFilter, setSelectedAdvisorFilter] = useState<string>("all");
  const [adminTab, setAdminTab] = useState<"advisors" | "clients" | "analytics">("advisors");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load advisors list
  const fetchAdvisors = async () => {
    try {
      setLoading(true);
      const data = await api.getAdvisors();
      setAdvisors(data);
    } catch (error) {
      console.error("Failed to load advisors", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisors();
  }, []);

  const handleDeleteAdvisor = async (advisorId: string, advisorName: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את היועץ ${advisorName}?`)) return;

    try {
      await api.deleteAdvisor(advisorId);
      setSuccessMessage(`היועץ ${advisorName} נמחק בהצלחה`);
      fetchAdvisors();
      onRefreshClients(); // Some client records might be impacted or need refresh
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error deleting advisor:", error);
      alert("שגיאה במחיקת היועץ");
    }
  };

  // 1. Calculate Metrics
  const totalAdvisorsCount = advisors.length;
  const totalClientsCount = clients.length;
  
  const totalRequestedFunding = clients.reduce((sum, c) => sum + Number(c.requestedAmount || 0), 0);
  
  const avgFinancingRatio = clients.length > 0 
    ? (clients.reduce((sum, c) => sum + Number(c.financingPercentage || 0), 0) / clients.length).toFixed(1)
    : "0";

  // Filtered Advisors list
  const filteredAdvisors = advisors.filter(adv => 
    adv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adv.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adv.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (adv.licenseNumber && adv.licenseNumber.includes(searchTerm))
  );

  // Filtered Clients list
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.idNumber.includes(searchTerm);
    const matchesAdvisor = selectedAdvisorFilter === "all" || c.advisorId === selectedAdvisorFilter;
    return matchesSearch && matchesAdvisor;
  });

  // Helper to count clients per advisor
  const getClientsCountForAdvisor = (advisorId: string) => {
    return clients.filter(c => c.advisorId === advisorId).length;
  };

  // Helper to count total requested funding per advisor
  const getAdvisorFundingSum = (advisorId: string) => {
    return clients
      .filter(c => c.advisorId === advisorId)
      .reduce((sum, c) => sum + Number(c.requestedAmount || 0), 0);
  };

  // Distribution by Employment
  const selfEmployedClientsCount = clients.filter(c => c.employmentType === "עצמאי").length;
  const salariedClientsCount = clients.filter(c => c.employmentType === "שכיר").length;

  // Distribution by Deal Status
  const statusCounts = {
    draft: clients.filter(c => c.status === "draft").length,
    active: clients.filter(c => c.status === "active").length,
    sent: clients.filter(c => c.status === "sent").length,
    closed: clients.filter(c => c.status === "closed").length,
  };

  return (
    <div className="space-y-8 animate-fade-in text-right">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 mb-2">
            <ShieldAlert className="h-3 w-3" />
            <span>ממשק ניהול מרכזי • ADMIN PANEL</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight font-sans">
            לוח בקרה ניהולי של מנהל המערכת
          </h2>
          <p className="text-slate-400 font-medium mt-1">ניהול ופיקוח על היועצים, הלקוחות ונפחי המימון של SynCash.</p>
        </div>
        
        <button
          onClick={onBackToApp}
          className="self-start md:self-center px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          חזרה לממשק יועץ
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold rounded-xl animate-pulse">
          ✓ {successMessage}
        </div>
      )}

      {/* ADMIN KPI Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Advisors */}
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-md flex items-center justify-between hover:border-red-500/20 transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">יועצים רשומים במערכת</p>
            <h3 className="text-3xl font-extrabold text-white mt-2 tracking-tight">{totalAdvisorsCount}</h3>
          </div>
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        {/* Total Borrowers / Portfolios */}
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-md flex items-center justify-between hover:border-cyan-500/20 transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">סך הכל תיקי לקוחות</p>
            <h3 className="text-3xl font-extrabold text-cyan-400 mt-2 tracking-tight">{totalClientsCount}</h3>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Total Funding Requested Volume */}
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-md flex items-center justify-between hover:border-emerald-500/20 transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">נפח גיוס הלוואות מבוקש</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2 tracking-tight">
              ₪{totalRequestedFunding.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Coins className="h-6 w-6" />
          </div>
        </div>

        {/* LTV */}
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-md flex items-center justify-between hover:border-amber-500/20 transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">מימון ממוצע (LTV)</p>
            <h3 className="text-3xl font-extrabold text-amber-400 mt-2 tracking-tight">{avgFinancingRatio}%</h3>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Percent className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-800/80 gap-6">
        <button
          onClick={() => { setAdminTab("advisors"); setSearchTerm(""); }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            adminTab === "advisors" ? "text-red-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {adminTab === "advisors" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-full"></span>}
          <span>ניהול יועצים ({advisors.length})</span>
        </button>
        <button
          onClick={() => { setAdminTab("clients"); setSearchTerm(""); }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            adminTab === "clients" ? "text-red-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {adminTab === "clients" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-full"></span>}
          <span>מעקב תיקים כללי ({clients.length})</span>
        </button>
        <button
          onClick={() => { setAdminTab("analytics"); }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            adminTab === "analytics" ? "text-red-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {adminTab === "analytics" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-full"></span>}
          <span>אנליטיקה ופילוחים</span>
        </button>
      </div>

      {/* Content Canvas */}
      {adminTab === "advisors" && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
          
          <div className="p-6 border-b border-slate-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-lg font-bold text-white">רשימת יועצים מחוברים</h4>
              <p className="text-xs text-slate-400 mt-1">כל היועצים שנרשמו במערכת, חברותיהם, מספרי רישיון ומספר התיקים הפעילים שלהם.</p>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="חיפוש לפי שם, חברה, אימייל..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-10 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-right"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs font-bold animate-pulse">טוען נתוני יועצים...</p>
              </div>
            ) : filteredAdvisors.length > 0 ? (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-950/40 text-slate-400 font-bold border-b border-slate-800/60">
                  <tr>
                    <th className="px-6 py-4">שם היועץ / תפקיד</th>
                    <th className="px-6 py-4">פרטי קשר</th>
                    <th className="px-6 py-4">חברה ורישיון</th>
                    <th className="px-6 py-4">תיקים במערכת</th>
                    <th className="px-6 py-4">סכום גיוס כולל</th>
                    <th className="px-6 py-4 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {filteredAdvisors.map((adv) => {
                    const clientCount = getClientsCountForAdvisor(adv.id);
                    const fundingSum = getAdvisorFundingSum(adv.id);
                    
                    return (
                      <tr key={adv.id} className="hover:bg-slate-800/10 transition-colors">
                        {/* Name and Role */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm flex items-center gap-1.5">
                                {adv.name}
                                {adv.id === "advisor-1" && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-extrabold uppercase border border-cyan-500/20">דמו ראשון</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 font-normal mt-0.5">{adv.role}</p>
                            </div>
                          </div>
                        </td>
                        
                        {/* Contact details */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{adv.email}</p>
                            <p className="text-xs text-slate-400 font-normal mt-0.5">{adv.phone || "אין טלפון"}</p>
                          </div>
                        </td>

                        {/* Company and license */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-xs text-slate-200 font-bold">{adv.company || "עצמאי"}</p>
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5">רישיון: {adv.licenseNumber || "לא הוזן"}</p>
                          </div>
                        </td>

                        {/* Number of Clients */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            clientCount > 0 ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-slate-800 text-slate-500 border border-slate-700/50"
                          }`}>
                            <FileText className="h-3.5 w-3.5" />
                            {clientCount} לקוחות
                          </span>
                        </td>

                        {/* Total Funding */}
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-100 text-xs sm:text-sm">
                            ₪{fundingSum.toLocaleString()}
                          </p>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          {adv.id === "advisor-1" ? (
                            <span className="text-[10px] text-slate-500 font-semibold italic">מוגן (מערכת)</span>
                          ) : (
                            <button
                              onClick={() => handleDeleteAdvisor(adv.id, adv.name)}
                              className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                              title="מחק יועץ מהמערכת"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <p className="font-bold text-slate-400">לא נמצאו יועצים העונים לחיפוש שלך</p>
              </div>
            )}
          </div>
        </div>
      )}

      {adminTab === "clients" && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
          
          <div className="p-6 border-b border-slate-800/60 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h4 className="text-lg font-bold text-white">כל תיקי הלקוחות בפלטפורמה</h4>
              <p className="text-xs text-slate-400 mt-1">צפייה בכל הלקוחות המשויכים ליועצים השונים ופילוח לפי יועץ מטפל.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Select Filter Advisor */}
              <select
                value={selectedAdvisorFilter}
                onChange={(e) => setSelectedAdvisorFilter(e.target.value)}
                className="rounded-lg bg-slate-950/80 border border-slate-800 py-2 px-3 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
              >
                <option value="all">כל היועצים</option>
                {advisors.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.company || "ללא חברה"})</option>
                ))}
              </select>

              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="חיפוש לקוח לפי שם, ת.ז..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-right"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredClients.length > 0 ? (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-950/40 text-slate-400 font-bold border-b border-slate-800/60">
                  <tr>
                    <th className="px-6 py-4">שם הלקוח / ת.ז</th>
                    <th className="px-6 py-4">היועץ המטפל</th>
                    <th className="px-6 py-4">סוג עסקה וסכום</th>
                    <th className="px-6 py-4">שיעור מימון</th>
                    <th className="px-6 py-4">סטטוס תיק</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {filteredClients.map((client) => {
                    const matchedAdvisor = advisors.find(a => a.id === client.advisorId);
                    
                    return (
                      <tr key={client.id} className="hover:bg-slate-800/10 transition-colors">
                        {/* Name */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-bold text-white text-sm">{client.name}</p>
                            <p className="text-[11px] text-slate-400 font-normal mt-0.5">ת.ז: {client.idNumber} | {client.phone}</p>
                          </div>
                        </td>

                        {/* Responsible Advisor */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-slate-200 text-xs">
                            <span className="font-bold text-cyan-400">
                              {matchedAdvisor ? matchedAdvisor.name : "יועץ לא מזוהה"}
                            </span>
                            {matchedAdvisor?.company && (
                              <span className="text-slate-500 text-[10px]">({matchedAdvisor.company})</span>
                            )}
                          </div>
                        </td>

                        {/* Deal Type and Amount */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-xs text-slate-300 font-semibold">{client.dealType}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              הלוואה: <span className="font-bold text-slate-100">₪{Number(client.requestedAmount).toLocaleString()}</span>
                            </p>
                          </div>
                        </td>

                        {/* LTV */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-cyan-400" 
                                style={{ width: `${client.financingPercentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-300 font-bold">{client.financingPercentage}%</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            client.status === "draft" ? "bg-slate-800 text-slate-400 border border-slate-700/60" :
                            client.status === "active" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                            client.status === "sent" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {client.status === "draft" ? "טיוטה" :
                             client.status === "active" ? "פעיל" :
                             client.status === "sent" ? "שודר" :
                             "תיק סגור"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <p className="font-bold text-slate-400">לא נמצאו תיקי לקוחות במערכת המאימים לסינון</p>
              </div>
            )}
          </div>
        </div>
      )}

      {adminTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Advisor Clients distribution (Bar Chart) */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-cyan-400" />
                עומס תיקים לפי יועץ משכנתאות
              </h4>
              <p className="text-xs text-slate-400 mt-1">כמות תיקי לקוחות רשומים עבור כל יועץ המחובר למערכת.</p>
            </div>

            <div className="space-y-3.5">
              {advisors.map(adv => {
                const clientCount = getClientsCountForAdvisor(adv.id);
                const maxClients = Math.max(...advisors.map(a => getClientsCountForAdvisor(a.id)), 1);
                const percent = (clientCount / maxClients) * 100;
                
                return (
                  <div key={adv.id} className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-bold text-slate-200">{adv.name} ({adv.company || "עצמאי"})</span>
                      <span className="font-bold text-cyan-400">{clientCount} תיקים</span>
                    </div>
                    <div className="w-full bg-slate-950/80 h-3.5 rounded-full overflow-hidden border border-slate-800 p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deal status distribution */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-400" />
                פילוח תיקים לפי סטטוס עסקה
              </h4>
              <p className="text-xs text-slate-400 mt-1">מצב התיקים הפעילים של יועצי המשכנתאות בפלטפורמה.</p>
            </div>

            <div className="space-y-4">
              {/* Draft */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-600"></span>
                    <span>טיוטה / שלבי התחלה</span>
                  </span>
                  <span className="font-bold">{statusCounts.draft} ({totalClientsCount > 0 ? Math.round((statusCounts.draft/totalClientsCount)*100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-600" style={{ width: `${totalClientsCount > 0 ? (statusCounts.draft/totalClientsCount)*100 : 0}%` }}></div>
                </div>
              </div>

              {/* Active */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400"></span>
                    <span>פעילים / מוכנים לשדור</span>
                  </span>
                  <span className="font-bold">{statusCounts.active} ({totalClientsCount > 0 ? Math.round((statusCounts.active/totalClientsCount)*100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400" style={{ width: `${totalClientsCount > 0 ? (statusCounts.active/totalClientsCount)*100 : 0}%` }}></div>
                </div>
              </div>

              {/* Sent */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                    <span>שודרו לחברות מימון (בהצעה)</span>
                  </span>
                  <span className="font-bold">{statusCounts.sent} ({totalClientsCount > 0 ? Math.round((statusCounts.sent/totalClientsCount)*100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${totalClientsCount > 0 ? (statusCounts.sent/totalClientsCount)*100 : 0}%` }}></div>
                </div>
              </div>

              {/* Closed */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                    <span>עסקאות שנסגרו בהצלחה</span>
                  </span>
                  <span className="font-bold">{statusCounts.closed} ({totalClientsCount > 0 ? Math.round((statusCounts.closed/totalClientsCount)*100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: `${totalClientsCount > 0 ? (statusCounts.closed/totalClientsCount)*100 : 0}%` }}></div>
                </div>
              </div>
            </div>

            {/* Sub summary metrics details */}
            <div className="mt-6 p-4 bg-slate-950/40 rounded-xl border border-slate-850/80 flex justify-around text-center text-xs text-slate-400">
              <div>
                <p className="font-bold text-white text-base">{selfEmployedClientsCount}</p>
                <p className="mt-0.5">לקוחות עצמאיים</p>
              </div>
              <div className="h-8 w-px bg-slate-800"></div>
              <div>
                <p className="font-bold text-white text-base">{salariedClientsCount}</p>
                <p className="mt-0.5">לקוחות שכירים</p>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
