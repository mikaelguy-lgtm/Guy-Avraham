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
  Briefcase,
  Mail,
  Settings,
  Send,
  CheckCircle2,
  XCircle,
  Edit,
  ArrowUpDown,
  SlidersHorizontal
} from "lucide-react";
import { Client, AdvisorProfile, Lender } from "../types";
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
  const [adminTab, setAdminTab] = useState<"advisors" | "clients" | "analytics" | "transmission" | "lenders">("advisors");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lenders State
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loadingLenders, setLoadingLenders] = useState<boolean>(false);
  const [editingLenderId, setEditingLenderId] = useState<string | null>(null);
  
  // Lender Form State
  const [lFormId, setLFormId] = useState("");
  const [lFormName, setLFormName] = useState("");
  const [lFormEmail, setLFormEmail] = useState("");
  const [lFormDesc, setLFormDesc] = useState("");
  const [lFormSpecialty, setLFormSpecialty] = useState("");
  const [lFormError, setLFormError] = useState<string | null>(null);

  // Client Edit & Sort State
  const [clientSortByStatus, setClientSortByStatus] = useState<"asc" | "desc" | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [ecName, setEcName] = useState("");
  const [ecIdNumber, setEcIdNumber] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecDealType, setEcDealType] = useState("");
  const [ecPropertyValue, setEcPropertyValue] = useState("");
  const [ecRequestedAmount, setEcRequestedAmount] = useState("");
  const [ecFinancingPercentage, setEcFinancingPercentage] = useState("");
  const [ecStatus, setEcStatus] = useState<"draft" | "active" | "sent" | "closed">("draft");
  const [ecError, setEcError] = useState<string | null>(null);
  const [ecSaving, setEcSaving] = useState(false);

  const [settings, setSettings] = useState<{
    systemSenderEmail: string;
    smtpPassword?: string;
    smtpHost?: string;
    smtpPort?: string | number;
    smtpSecure?: boolean;
    lenderEmails: Record<string, string>;
  }>({
    systemSenderEmail: "requests@syncash-mail.co.il",
    smtpPassword: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    lenderEmails: {
      "BTB": "credit@btb.co.il",
      "Tarya": "underwriting@tarya.co.il",
      "Peninsula": "deals@peninsula.co.il",
      "Gamma": "mortgage@gamma.co.il",
      "Clal": "clalfinance@clal.co.il",
      "Harel": "harelfinance@harel.co.il"
    }
  });
  const [selectedMailIndex, setSelectedMailIndex] = useState<number | null>(null);
  const [customReplyTexts, setCustomReplyTexts] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

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

  const fetchLenders = async () => {
    try {
      setLoadingLenders(true);
      const data = await api.getAdminLenders();
      setLenders(data);
    } catch (error) {
      console.error("Failed to load lenders", error);
    } finally {
      setLoadingLenders(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await api.getAdminSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load admin settings", err);
    }
  };

  useEffect(() => {
    fetchAdvisors();
    fetchLenders();
    fetchSettings();
  }, []);

  const handleAddOrUpdateLender = async (e: React.FormEvent) => {
    e.preventDefault();
    setLFormError(null);
    if (!lFormId || !lFormName || !lFormEmail) {
      setLFormError("נא למלא מזהה, שם ואימייל חברה");
      return;
    }

    try {
      if (editingLenderId) {
        // Update
        await api.updateAdminLender(editingLenderId, {
          name: lFormName,
          email: lFormEmail,
          description: lFormDesc,
          specialty: lFormSpecialty
        });
        setSuccessMessage("חברת המימון עודכנה בהצלחה");
      } else {
        // Add
        await api.addAdminLender({
          id: lFormId,
          name: lFormName,
          email: lFormEmail,
          description: lFormDesc,
          specialty: lFormSpecialty
        });
        setSuccessMessage("חברת המימון נוספה בהצלחה למערכת");
      }

      // Reset form
      setEditingLenderId(null);
      setLFormId("");
      setLFormName("");
      setLFormEmail("");
      setLFormDesc("");
      setLFormSpecialty("");
      
      // Refresh
      fetchLenders();
      fetchSettings();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setLFormError(err.message || "שגיאה בשמירת חברת המימון");
    }
  };

  const handleStartEditLender = (lender: Lender) => {
    setEditingLenderId(lender.id);
    setLFormId(lender.id);
    setLFormName(lender.name);
    setLFormEmail(lender.email);
    setLFormDesc(lender.description || "");
    setLFormSpecialty(lender.specialty || "");
    setLFormError(null);
  };

  const handleToggleLenderStatus = async (lender: Lender) => {
    const newStatus = lender.status === "active" ? "suspended" : "active";
    try {
      await api.updateAdminLender(lender.id, { status: newStatus });
      setSuccessMessage(`סטטוס חברת המימון שונה ל-${newStatus === "active" ? "פעיל" : "מושעה"}`);
      fetchLenders();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert("שגיאה בשינוי סטטוס חברת המימון");
    }
  };

  const handleDeleteLender = async (lenderId: string, lenderName: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את חברת המימון ${lenderName}?`)) return;
    try {
      await api.deleteAdminLender(lenderId);
      setSuccessMessage("חברת המימון נמחקה בהצלחה");
      fetchLenders();
      fetchSettings();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert("שגיאה במחיקת חברת המימון");
    }
  };

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

  const handleStartEditClient = (client: Client) => {
    setEditingClient(client);
    setEcName(client.name || "");
    setEcIdNumber(client.idNumber || "");
    setEcPhone(client.phone || "");
    setEcDealType(client.dealType || "");
    setEcPropertyValue(client.propertyValue || "0");
    setEcRequestedAmount(client.requestedAmount || "0");
    setEcFinancingPercentage(client.financingPercentage || "50");
    setEcStatus(client.status || "draft");
    setEcError(null);
  };

  const handleSaveClientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setEcError(null);
    setEcSaving(true);
    try {
      await api.updateClient(editingClient.id, {
        name: ecName,
        idNumber: ecIdNumber,
        phone: ecPhone,
        dealType: ecDealType,
        propertyValue: ecPropertyValue,
        requestedAmount: ecRequestedAmount,
        financingPercentage: ecFinancingPercentage,
        status: ecStatus
      });
      setSuccessMessage(`פרטי הלקוח ${ecName} עודכנו בהצלחה במערכת`);
      setEditingClient(null);
      onRefreshClients();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setEcError(err.message || "שגיאה בעדכון פרטי הלקוח");
    } finally {
      setEcSaving(false);
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

  // Sorted Clients list (based on clientSortByStatus)
  const displayedClients = [...filteredClients];
  if (clientSortByStatus) {
    displayedClients.sort((a, b) => {
      const statusA = a.status || "";
      const statusB = b.status || "";
      if (clientSortByStatus === "asc") {
        return statusA.localeCompare(statusB);
      } else {
        return statusB.localeCompare(statusA);
      }
    });
  }

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
        <button
          onClick={() => { setAdminTab("transmission"); }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            adminTab === "transmission" ? "text-red-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {adminTab === "transmission" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-full"></span>}
          <span>הגדרות שידור וסימולטור מייל</span>
        </button>
        <button
          onClick={() => { setAdminTab("lenders"); setSearchTerm(""); }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            adminTab === "lenders" ? "text-red-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {adminTab === "lenders" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-full"></span>}
          <span>ניהול חברות מימון ({lenders.length})</span>
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
            {displayedClients.length > 0 ? (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-950/40 text-slate-400 font-bold border-b border-slate-800/60">
                  <tr>
                    <th className="px-4 py-4 text-center w-12">#</th>
                    <th className="px-6 py-4">שם הלקוח / ת.ז</th>
                    <th className="px-6 py-4">היועץ המטפל</th>
                    <th className="px-6 py-4">סוג עסקה וסכום</th>
                    <th className="px-6 py-4">שיעור מימון</th>
                    <th className="px-6 py-4">
                      <button 
                        onClick={() => {
                          if (clientSortByStatus === null) setClientSortByStatus("asc");
                          else if (clientSortByStatus === "asc") setClientSortByStatus("desc");
                          else setClientSortByStatus(null);
                        }}
                        className="flex items-center gap-1.5 hover:text-white font-bold transition-all outline-none"
                      >
                        סטטוס תיק
                        <ArrowUpDown className={`h-3 w-3 ${clientSortByStatus ? "text-cyan-400" : "text-slate-500"}`} />
                        {clientSortByStatus === "asc" && <span className="text-[10px] text-cyan-400 font-extrabold">(א-ת)</span>}
                        {clientSortByStatus === "desc" && <span className="text-[10px] text-cyan-400 font-extrabold">(ת-א)</span>}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-center w-24">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {displayedClients.map((client, index) => {
                    const matchedAdvisor = advisors.find(a => a.id === client.advisorId);
                    
                    return (
                      <tr key={client.id} className="hover:bg-slate-800/10 transition-colors">
                        {/* Numbering */}
                        <td className="px-4 py-4 text-center text-xs font-bold text-slate-500 font-mono">
                          {index + 1}
                        </td>

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

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleStartEditClient(client)}
                            className="p-1.5 text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all cursor-pointer"
                            title="ערוך פרטי לקוח"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <p className="font-bold text-slate-400">לא נמצאו תיקי לקוחות במערכת המתאימים לסינון</p>
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

      {adminTab === "transmission" && (() => {
        const pendingMails: Array<{
          client: Client;
          lenderId: string;
          lenderEmail: string;
          refId: string;
          pitch: string;
        }> = [];

        clients.forEach(c => {
          if (c.lendersState) {
            Object.entries(c.lendersState).forEach(([lenderId, state]) => {
              if (state && state.status === "sent_anonymous") {
                pendingMails.push({
                  client: c,
                  lenderId,
                  lenderEmail: settings.lenderEmails[lenderId] || "credit@lender.co.il",
                  refId: `SYNCASH-CL-${c.id}-LD-${lenderId}`,
                  pitch: state.pitch || "מכתב פנייה אנונימי"
                });
              }
            });
          }
        });

        return (
          <div className="space-y-8 animate-fade-in">
            {/* Email Settings Form */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-md space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 text-red-400 rounded-xl">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">הגדרות כתובות דוא"ל ושידור</h4>
                  <p className="text-xs text-slate-400 mt-0.5">קבע את כתובת השרת השולח ממנו ייצאו הבקשות האנונימיות, ואת המיילים הישירים של חברות המימון.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-right">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300">כתובת מייל גלובלית לשליחת בקשות (Sender Address)</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={settings.systemSenderEmail}
                      onChange={(e) => setSettings({ ...settings, systemSenderEmail: e.target.value })}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
                      placeholder="requests@syncash-mail.co.il"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">כלל יועצי המשכנתאות ישדרו מאחורי הקלעים באמצעות כתובת אנונימית זו.</p>
                </div>

                <div className="space-y-2 col-span-1">
                  <label className="block text-xs font-bold text-slate-300">סיסמת אפליקציה לשליחת מייל (Gmail App Password / SMTP Pass)</label>
                  <input
                    type="password"
                    value={settings.smtpPassword || ""}
                    onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right font-mono"
                    placeholder="הזן סיסמת אפליקציה של גוגל"
                  />
                  <p className="text-[10px] text-slate-500">לשליחה מחשבון ה-Gmail האישי שלך (כמו kiss.my.twins@gmail.com), עליך לייצר בגוגל 'סיסמת אפליקציה' (App Password) בת 16 תווים ללא רווחים ולהזין אותה כאן.</p>
                </div>

                <div className="space-y-2 col-span-1">
                  <label className="block text-xs font-bold text-slate-300">שרת יוצא (SMTP Host)</label>
                  <input
                    type="text"
                    value={settings.smtpHost || "smtp.gmail.com"}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-left font-mono"
                    placeholder="smtp.gmail.com"
                  />
                  <p className="text-[10px] text-slate-500">ברירת המחדל היא smtp.gmail.com עבור Gmail.</p>
                </div>

                <div className="space-y-2 col-span-1">
                  <label className="block text-xs font-bold text-slate-300">פורט שרת יוצא (SMTP Port)</label>
                  <input
                    type="number"
                    value={settings.smtpPort || 465}
                    onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value, 10) || 465 })}
                    className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-left font-mono"
                    placeholder="465"
                  />
                  <p className="text-[10px] text-slate-500">מומלץ 465 עבור חיבור מאובטח (SSL) או 587 (TLS).</p>
                </div>

                <div className="space-y-2 col-span-1 flex items-center pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.smtpSecure !== false}
                      onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                      className="rounded border-slate-800 text-red-500 focus:ring-red-500 h-4 w-4 bg-slate-950"
                    />
                    חיבור מאובטח (SSL / TLS)
                  </label>
                </div>

                <div className="col-span-1 md:col-span-2 border-t border-slate-800/80 my-2 pt-4">
                  <h5 className="text-xs font-bold text-slate-300 mb-3">כתובות דואר ייעודיות לחברות המימון החוץ-בנקאיות</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.keys(settings.lenderEmails).map((lenderId) => (
                      <div key={lenderId} className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">{lenderId}</label>
                        <input
                          type="email"
                          value={settings.lenderEmails[lenderId]}
                          onChange={(e) => {
                            const updatedEmails = { ...settings.lenderEmails, [lenderId]: e.target.value };
                            setSettings({ ...settings, lenderEmails: updatedEmails });
                          }}
                          className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-start">
                <button
                  disabled={savingSettings}
                  onClick={async () => {
                    try {
                      setSavingSettings(true);
                      await api.saveAdminSettings(settings);
                      setSuccessMessage("הגדרות הדואר נשמרו בהצלחה במערכת");
                      setTimeout(() => setSuccessMessage(null), 3000);
                    } catch (err) {
                      console.error(err);
                      alert("שגיאה בשמירת ההגדרות");
                    } finally {
                      setSavingSettings(false);
                    }
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingSettings ? "שומר..." : "שמור הגדרות שידור"}
                </button>
              </div>
            </div>

            {/* SIMULATED INBOUND MAILBOX WEBHOOK */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">סימולטור מענה מחתמי חברות המימון (Inbound Mailbox)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">כאן תוכל להגיב לבקשות האנונימיות שנשלחו לאחרונה על ידי יועצים, ולדמות את מענה החברות.</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400 rounded-full">
                  {pendingMails.length} מיילים ממתינים למענה
                </span>
              </div>

              {pendingMails.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500">
                  <Mail className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400">אין פניות אנונימיות חדשות הממתינות למענה חברות המימון</p>
                  <p className="text-xs text-slate-500 mt-1">כאשר יועץ ישדר תיק מ"זירת ההלוואות", הפניות האנונימיות יופיעו כאן בזמן אמת לסימולציית קבלת מייל חוזר.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* List of pending mails */}
                  <div className="col-span-1 border-l border-slate-800/60 pl-2 lg:pl-6 space-y-3 max-h-[500px] overflow-y-auto">
                    {pendingMails.map((mail, idx) => {
                      const isSelected = selectedMailIndex === idx || (selectedMailIndex === null && idx === 0);
                      if (selectedMailIndex === null && idx === 0) {
                        // Autoselect first item if nothing selected
                        setTimeout(() => setSelectedMailIndex(0), 10);
                      }

                      return (
                        <button
                          key={mail.refId}
                          onClick={() => setSelectedMailIndex(idx)}
                          className={`w-full text-right p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                            isSelected
                              ? "bg-slate-800/40 border-red-500/30 shadow-md shadow-red-500/5"
                              : "bg-slate-950/40 border-slate-850 hover:bg-slate-900/40"
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="text-xs font-extrabold text-red-400">{mail.lenderId}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{mail.refId.substring(11, 23)}...</span>
                          </div>
                          <p className="text-xs font-bold text-slate-200 truncate w-full">עבור לקוח: {mail.client.name}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2 w-full leading-relaxed">{mail.pitch}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected mail details & response panel */}
                  <div className="col-span-1 lg:col-span-2 space-y-4">
                    {selectedMailIndex !== null && pendingMails[selectedMailIndex] && (() => {
                      const mail = pendingMails[selectedMailIndex];
                      const defaultInterestedReply = `שלום רב,\n\nהבקשה האנונימית (${mail.refId}) נבחנה על ידינו בקרן ${mail.lenderId}.\nהנתונים נראים מצוינים ומתאימים לאחוז המימון הרצוי (${mail.client.financingPercentage}%). אנו מביעים עניין רב בהגשת הצעה תחרותית לתיק זה.\nאנא חשוֹף בפנינו את פרטי הקשר והמסמכים של היועץ והלווה על מנת שנוכל להנפיק אישור עקרוני וריביות מוגדרות.\n\nבברכה,\nצוות האשראי, ${mail.lenderId}`;
                      const defaultNotInterestedReply = `שלום רב,\n\nתודה על פנייתכם עבור תיק [${mail.refId}].\nלאחר בחינת הפרטים, לצערנו העסקה חורגת ממגבלות החיתום הנוכחיות של קרן ${mail.lenderId} לתקופה זו (רמת הוצאות גבוהה יחסית לנכס).\nנשמח לבחון פניות נוספות בעתיד.\n\nבברכה,\nמחלקת אשראי, ${mail.lenderId}`;

                      const currentCustomText = customReplyTexts[mail.refId] !== undefined
                        ? customReplyTexts[mail.refId]
                        : defaultInterestedReply;

                      return (
                        <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4 animate-fade-in text-right">
                          <div className="border-b border-slate-800 pb-3 space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
                              <span>אל: {mail.lenderEmail}</span>
                              <span>סימוכין: {mail.refId}</span>
                            </div>
                            <h5 className="text-xs font-extrabold text-slate-300">
                              מאת: {settings.systemSenderEmail} (מערכת SynCash אנונימי)
                            </h5>
                            <h5 className="text-xs font-bold text-slate-300">
                              נושא: בקשת מימון אנונימית חדשה - עבור תיק {mail.client.name.substring(0, 1)}***
                            </h5>
                          </div>

                          {/* Pitch Content Display Box */}
                          <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800 max-h-[160px] overflow-y-auto">
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">{mail.pitch}</p>
                          </div>

                          {/* Reply Form */}
                          <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-slate-400">כתוב את מכתב המענה החוזר מהחתם (Email Reply):</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setCustomReplyTexts({ ...customReplyTexts, [mail.refId]: defaultInterestedReply })}
                                  className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-extrabold text-emerald-400 transition-all cursor-pointer"
                                >
                                  תבנית: מעוניין
                                </button>
                                <button
                                  onClick={() => setCustomReplyTexts({ ...customReplyTexts, [mail.refId]: defaultNotInterestedReply })}
                                  className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-[10px] font-extrabold text-rose-400 transition-all cursor-pointer"
                                >
                                  תבנית: לא מעוניין
                                </button>
                              </div>
                            </div>

                            <textarea
                              value={currentCustomText}
                              onChange={(e) => setCustomReplyTexts({ ...customReplyTexts, [mail.refId]: e.target.value })}
                              className="w-full h-32 p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 font-sans text-right"
                            />

                            <div className="flex gap-3 pt-1">
                              <button
                                onClick={async () => {
                                  try {
                                    await api.simulateLenderReply(mail.refId, "interested", currentCustomText);
                                    setSuccessMessage(`נשלח מענה 'מעוניין' מקרן ${mail.lenderId} בהצלחה!`);
                                    onRefreshClients();
                                    setSelectedMailIndex(null);
                                    setTimeout(() => setSuccessMessage(null), 3000);
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                השב: מעוניין בתיק (Interested)
                              </button>

                              <button
                                onClick={async () => {
                                  try {
                                    await api.simulateLenderReply(mail.refId, "not_interested", currentCustomText);
                                    setSuccessMessage(`נשלח מענה 'לא מעוניין' מקרן ${mail.lenderId}`);
                                    onRefreshClients();
                                    setSelectedMailIndex(null);
                                    setTimeout(() => setSuccessMessage(null), 3000);
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-rose-600 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <XCircle className="h-4 w-4" />
                                השב: לא מעוניין (Decline)
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {adminTab === "lenders" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          {/* Lender Form */}
          <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-md h-fit space-y-4">
            <div>
              <h4 className="text-lg font-bold text-white">
                {editingLenderId ? "עריכת חברת מימון" : "הוספת חברת מימון חדשה"}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {editingLenderId ? "עדכן את פרטי חברת המימון הקיימת" : "הקם חברת מימון חדשה שתקבל בקשות אשראי אנונימיות"}
              </p>
            </div>

            <form onSubmit={handleAddOrUpdateLender} className="space-y-4">
              {lFormError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-lg">
                  ⚠️ {lFormError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">מזהה חברה ייחודי (באנגלית / קצר)</label>
                <input
                  type="text"
                  disabled={!!editingLenderId}
                  value={lFormId}
                  onChange={(e) => setLFormId(e.target.value)}
                  placeholder="לדוגמה: BTB, TARYA, CLAL"
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right disabled:opacity-50 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">שם חברת המימון (בעברית)</label>
                <input
                  type="text"
                  value={lFormName}
                  onChange={(e) => setLFormName(e.target.value)}
                  placeholder="לדוגמה: טריא (Tarya)"
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">אימייל ייעודי לקבלת פניות</label>
                <input
                  type="email"
                  value={lFormEmail}
                  onChange={(e) => setLFormEmail(e.target.value)}
                  placeholder="credit@company.co.il"
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">התמחות חברת המימון (תווית קצרה)</label>
                <input
                  type="text"
                  value={lFormSpecialty}
                  onChange={(e) => setLFormSpecialty(e.target.value)}
                  placeholder="לדוגמה: גישור ורכישה / עצמאיים"
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">תיאור ופרטים נוספים</label>
                <textarea
                  value={lFormDesc}
                  onChange={(e) => setLFormDesc(e.target.value)}
                  placeholder="הסבר על מדיניות אשראי, סוגי בטוחות, מיועד ל..."
                  className="w-full h-24 p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer text-center"
                >
                  {editingLenderId ? "עדכן חברה" : "הוסף חברת מימון"}
                </button>
                {editingLenderId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLenderId(null);
                      setLFormId("");
                      setLFormName("");
                      setLFormEmail("");
                      setLFormDesc("");
                      setLFormSpecialty("");
                      setLFormError(null);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    ביטול
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lenders List */}
          <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-slate-800/60">
              <h4 className="text-lg font-bold text-white">רשימת חברות המימון בזירה</h4>
              <p className="text-xs text-slate-400 mt-1">חברות אלה מוגדרות בזירת ההלוואות. תוכל להוסיף, לערוך, להשהות זמנית או למחוק חברות מהזירה.</p>
            </div>

            <div className="divide-y divide-slate-800/60">
              {loadingLenders ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-xs font-bold animate-pulse">טוען חברות מימון...</p>
                </div>
              ) : lenders.length > 0 ? (
                lenders.map((lender) => (
                  <div key={lender.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-800/10 transition-colors text-right">
                    <div className="space-y-1.5 flex-1 text-right">
                      <div className="flex items-center gap-2 flex-wrap justify-start">
                        <span className="font-bold text-white text-sm">{lender.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 font-mono text-slate-400 border border-slate-800">{lender.id}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          lender.status === "active" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {lender.status === "active" ? "פעיל בזירה" : "מושהה / לא פעיל"}
                        </span>
                        {lender.specialty && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-extrabold uppercase border border-cyan-500/20">
                            {lender.specialty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-normal leading-relaxed">{lender.description || "אין תיאור מורחב לחברה זו."}</p>
                      <div className="text-[11px] text-slate-500 font-mono">
                        📧 מייל שליחה ישיר: <span className="text-slate-300">{lender.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleStartEditLender(lender)}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        ערוך
                      </button>
                      <button
                        onClick={() => handleToggleLenderStatus(lender)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          lender.status === "active"
                            ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-400"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {lender.status === "active" ? "השהה" : "הפעל"}
                      </button>
                      <button
                        onClick={() => handleDeleteLender(lender.id, lender.name)}
                        className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer border border-transparent hover:border-rose-500/10"
                        title="מחק מהמערכת"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-500">
                  <p className="font-bold text-slate-400">טרם הוגדרו חברות מימון במערכת</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Edit Modal Overlay */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-right" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-950/40">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-cyan-400" />
                עריכת פרטי תיק לקוח
              </h3>
              <button 
                onClick={() => setEditingClient(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClientEdit} className="p-6 space-y-4">
              {ecError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-lg">
                  {ecError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">שם הלקוח</label>
                  <input
                    type="text"
                    required
                    value={ecName}
                    onChange={(e) => setEcName(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                {/* ID Number */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">תעודת זהות</label>
                  <input
                    type="text"
                    required
                    value={ecIdNumber}
                    onChange={(e) => setEcIdNumber(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">טלפון</label>
                  <input
                    type="text"
                    required
                    value={ecPhone}
                    onChange={(e) => setEcPhone(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>

                {/* Deal Type */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">סוג עסקה</label>
                  <input
                    type="text"
                    required
                    value={ecDealType}
                    onChange={(e) => setEcDealType(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Property Value */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">שווי נכס (₪)</label>
                  <input
                    type="number"
                    required
                    value={ecPropertyValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEcPropertyValue(val);
                      // Auto-calc financing percentage
                      const req = parseFloat(ecRequestedAmount) || 0;
                      const prop = parseFloat(val) || 1;
                      setEcFinancingPercentage(Math.min(100, Math.round((req / prop) * 100)).toString());
                    }}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>

                {/* Requested Amount */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">סכום מבוקש (₪)</label>
                  <input
                    type="number"
                    required
                    value={ecRequestedAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEcRequestedAmount(val);
                      // Auto-calc financing percentage
                      const req = parseFloat(val) || 0;
                      const prop = parseFloat(ecPropertyValue) || 1;
                      setEcFinancingPercentage(Math.min(100, Math.round((req / prop) * 100)).toString());
                    }}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>

                {/* Financing Percentage */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold font-sans">שיעור מימון (%)</label>
                  <input
                    type="number"
                    required
                    value={ecFinancingPercentage}
                    onChange={(e) => setEcFinancingPercentage(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold font-sans">סטטוס תיק במערכת</label>
                <select
                  value={ecStatus}
                  onChange={(e) => setEcStatus(e.target.value as any)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 py-2.5 px-3 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="draft">טיוטה</option>
                  <option value="active">פעיל</option>
                  <option value="sent">שודר לחברות מימון</option>
                  <option value="closed">תיק סגור (הושלם)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3.5 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={ecSaving}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10"
                >
                  {ecSaving ? "שומר..." : "שמור שינויים"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
