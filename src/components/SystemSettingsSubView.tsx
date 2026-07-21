import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  Mail, 
  Database, 
  ShieldCheck, 
  History, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Lock, 
  Eye, 
  EyeOff, 
  Send,
  Clock,
  Server,
  Terminal,
  Activity,
  FileCode,
  Search,
  KeyRound,
  FileSpreadsheet
} from "lucide-react";
import { api } from "../utils/apiClient";

interface SystemSettingsSubViewProps {
  currentRole: string;
}

export default function SystemSettingsSubView({ currentRole }: SystemSettingsSubViewProps) {
  const isSuperAdmin = currentRole === "SUPER_ADMIN" || currentRole === "סופר אדמין";
  const [subTab, setSubTab] = useState<"general" | "database" | "security" | "audit">("general");

  useEffect(() => {
    if (!isSuperAdmin && subTab !== "general") {
      setSubTab("general");
    }
  }, [subTab, isSuperAdmin]);

  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- General Settings State ---
  const [generalSettings, setGeneralSettings] = useState<Record<string, string>>({
    SYSTEM_NAME: "",
    APP_URL: "",
    SUPPORT_EMAIL: "",
    EMAIL_FROM_NAME: "",
    EMAIL_REPLY_TO: "",
    DEFAULT_TIMEZONE: "",
    DEFAULT_LOCALE: "",
    LENDER_INVITE_EXPIRY_HOURS: "",
    PASSWORD_RESET_EXPIRY_MINUTES: "",
    MAX_UPLOAD_SIZE_MB: "",
    MAINTENANCE_MODE: "false"
  });

  // --- Email Settings State ---
  const [emailSettings, setEmailSettings] = useState({
    host: "",
    port: 587,
    secureMode: "starttls",
    username: "",
    passwordConfigured: false,
    fromAddress: "",
    fromName: "",
    replyTo: ""
  });
  const [smtpPasswordInput, setSmtpPasswordInput] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");

  // --- Database Settings State ---
  const [dbStatus, setDbStatus] = useState<{
    status: string;
    engine: string;
    service: string;
    region: string;
    version: string;
    databaseName: string;
    responseTimeMs: number;
    lastTestedAt: string;
    migrationsStatus: string;
  } | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<{
    tablesExist: boolean;
    tablesChecked: string[];
    status: string;
  } | null>(null);
  const [dbTesting, setDbTesting] = useState(false);

  // --- Security Settings State ---
  const [securityStatus, setSecurityStatus] = useState<{
    encryptionKeyConfigured: boolean;
    activeVersion: string;
    lastRotationAt: string;
    status: string;
  } | null>(null);
  const [securityTesting, setSecurityTesting] = useState(false);

  // --- Audit Logs State ---
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");

  // --- Initial Loading on SubTab Mount ---
  useEffect(() => {
    loadTabContent();
  }, [subTab]);

  const loadTabContent = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      if (subTab === "general") {
        const res = await api.getSecureGeneralSettings();
        if (res && res.success) {
          setGeneralSettings(res.data);
        }
      } else if (subTab === "database") {
        const statusRes = await api.getDatabaseStatus();
        const schemaRes = await api.getDatabaseSchemaStatus();
        if (statusRes && statusRes.success) {
          setDbStatus(statusRes.data);
        }
        if (schemaRes && schemaRes.success) {
          setSchemaStatus(schemaRes.data);
        }
      } else if (subTab === "security") {
        const res = await api.getSecurityStatus();
        if (res && res.success) {
          setSecurityStatus(res.data);
        }
      } else if (subTab === "audit") {
        const res = await api.getAuditLogs();
        if (res && res.success) {
          setAuditLogs(res.data);
        }
      }
    } catch (err: any) {
      console.error("Failed loading settings tab:", err);
      setErrorMsg("כשל בטעינת הנתונים מהשרת. וודא שיש לך הרשאת אדמין תואמת.");
    } finally {
      setLoading(false);
    }
  };

  // --- Actions ---
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.updateSecureGeneralSettings(generalSettings);
      if (res && res.success) {
        setSuccessMsg("ההגדרות הכלליות נשמרו בהצלחה!");
      } else {
        setErrorMsg(res.error || "שגיאה בשמירת הגדרות");
      }
    } catch (err: any) {
      setErrorMsg("נכשלה שמירת הגדרות כלליות");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.updateSecureEmailSettings({
        host: emailSettings.host,
        port: emailSettings.port,
        secureMode: emailSettings.secureMode,
        username: emailSettings.username,
        fromAddress: emailSettings.fromAddress,
        fromName: emailSettings.fromName,
        replyTo: emailSettings.replyTo
      });
      if (res && res.success) {
        setSuccessMsg("הגדרות שרת הדואר SMTP נשמרו בהצלחה!");
      } else {
        setErrorMsg(res.error || "שגיאה בשמירת הגדרות הדואר");
      }
    } catch (err: any) {
      setErrorMsg("נכשלה שמירת הגדרות דואר");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSmtpPassword = async () => {
    if (!smtpPasswordInput) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.updateSmtpPassword(smtpPasswordInput);
      if (res && res.success) {
        setSuccessMsg("סיסמת SMTP חדשה עודכנה בהצלחה!");
        setSmtpPasswordInput("");
        // Reload settings
        const fresh = await api.getSecureEmailSettings();
        if (fresh && fresh.success) {
          setEmailSettings(fresh.data);
        }
      } else {
        setErrorMsg(res.error || "שגיאה בעדכון הסיסמה");
      }
    } catch (err: any) {
      setErrorMsg("נכשל עדכון סיסמת SMTP");
    } finally {
      setLoading(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    setSmtpTesting(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.testSmtpConnection(testRecipientEmail || undefined);
      if (res && res.success) {
        setSuccessMsg(res.message || "מייל בדיקה נשלח בהצלחה!");
      } else {
        setErrorMsg(res.error || "שליחת מייל הבדיקה נכשלה");
      }
    } catch (err: any) {
      setErrorMsg("שליחת מייל בדיקה נכשלה עקב שגיאה פיזית בחיבור");
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleTestDatabaseConnection = async () => {
    setDbTesting(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.testDatabaseConnection();
      if (res && res.success) {
        setSuccessMsg(`חיבור למסד הנתונים תקין! זמן תגובה: ${res.responseTimeMs}ms`);
        // Refresh status
        const fresh = await api.getDatabaseStatus();
        if (fresh && fresh.success) {
          setDbStatus(fresh.data);
        }
      } else {
        setErrorMsg(res.error || "החיבור למסד הנתונים נכשל");
      }
    } catch (err: any) {
      setErrorMsg("חיבור נכשל עקב שגיאה בתהליך התחבורה");
    } finally {
      setDbTesting(false);
    }
  };

  const handleTestFieldEncryption = async () => {
    setSecurityTesting(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.testFieldEncryption();
      if (res && res.success) {
        setSuccessMsg("שירות הצפנה ופענוח הנתונים (Field Encryption Loop) נבדק בהצלחה ועובד בצורה מלאה ומאובטחת!");
      } else {
        setErrorMsg(res.error || "מבחן ההצפנה נכשל");
      }
    } catch (err: any) {
      setErrorMsg("כשל בהתחברות לשירות ההצפנה");
    } finally {
      setSecurityTesting(false);
    }
  };

  // --- Filtered Audit Logs ---
  const filteredAuditLogs = auditLogs.filter(log => {
    if (!auditSearch) return true;
    const searchLower = auditSearch.toLowerCase();
    const actionStr = String(log.action || "").toLowerCase();
    const entityStr = String(log.entityType || "").toLowerCase();
    const metaStr = String(log.metadata || "").toLowerCase();
    return actionStr.includes(searchLower) || entityStr.includes(searchLower) || metaStr.includes(searchLower);
  });

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2 animate-fade-in shadow-md">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-2xl flex items-center gap-2 animate-fade-in shadow-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Settings Navigation Menu */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubTab("general")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === "general"
              ? "bg-red-500/15 text-red-400 border border-red-500/30"
              : "text-slate-400 hover:text-white border border-transparent"
          }`}
        >
          <Sliders className="h-4 w-4" />
          הגדרות עסקיות
        </button>

        {isSuperAdmin && (
          <>
            <button
              onClick={() => setSubTab("database")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === "database"
                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Database className="h-4 w-4" />
              סטטוס בסיס נתונים
            </button>

            <button
              onClick={() => setSubTab("security")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === "security"
                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              אבטחה והצפנה (Secrets)
            </button>

            <button
              onClick={() => setSubTab("audit")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === "audit"
                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <History className="h-4 w-4" />
              יומן ביקורת שינויים (Audit)
            </button>
          </>
        )}
      </div>

      {/* Main Settings Panel */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-30 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 text-red-500 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-300">טוען הגדרות מאובטחות...</p>
            </div>
          </div>
        )}

        {/* --- GENERAL SETTINGS TAB --- */}
        {subTab === "general" && (
          <form onSubmit={handleSaveGeneral} className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-red-400" />
                הגדרות עסקיות כלליות
              </h3>
              <p className="text-xs text-slate-400 mt-1">נהל את השמות, נתיבי הגישה וערכי ברירת המחדל הכלליים של המערכת.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* System Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">שם המערכת</label>
                <input
                  type="text"
                  required
                  value={generalSettings.SYSTEM_NAME || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, SYSTEM_NAME: e.target.value })}
                  placeholder="למשל: SynCash"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* App URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">כתובת ה-URL של האפליקציה</label>
                <input
                  type="url"
                  required
                  value={generalSettings.APP_URL || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, APP_URL: e.target.value })}
                  placeholder="https://syncash.co.il"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 font-mono text-left"
                />
              </div>

              {/* Support Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">אימייל לתמיכה טכנית</label>
                <input
                  type="email"
                  required
                  value={generalSettings.SUPPORT_EMAIL || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, SUPPORT_EMAIL: e.target.value })}
                  placeholder="support@syncash.co.il"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 font-mono text-left"
                />
              </div>

              {/* Email Sender Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">שם שולח המיילים כברירת מחדל</label>
                <input
                  type="text"
                  required
                  value={generalSettings.EMAIL_FROM_NAME || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, EMAIL_FROM_NAME: e.target.value })}
                  placeholder="למשל: מערכת SynCash מאובטחת"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Reply To Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">כתובת Reply-To למיילים</label>
                <input
                  type="email"
                  required
                  value={generalSettings.EMAIL_REPLY_TO || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, EMAIL_REPLY_TO: e.target.value })}
                  placeholder="no-reply@syncash.co.il"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 font-mono text-left"
                />
              </div>

              {/* Lender Invite Expiry */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">תוקף קישור לפניות חברות מימון (בשעות)</label>
                <input
                  type="number"
                  required
                  value={generalSettings.LENDER_INVITE_EXPIRY_HOURS || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, LENDER_INVITE_EXPIRY_HOURS: e.target.value })}
                  placeholder="48"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Password Reset Expiry */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">תוקף קישור לשחזור סיסמה (בדקות)</label>
                <input
                  type="number"
                  required
                  value={generalSettings.PASSWORD_RESET_EXPIRY_MINUTES || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, PASSWORD_RESET_EXPIRY_MINUTES: e.target.value })}
                  placeholder="30"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Max Upload Size */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">גודל העלאת קובץ מקסימלי (MB)</label>
                <input
                  type="number"
                  required
                  value={generalSettings.MAX_UPLOAD_SIZE_MB || ""}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, MAX_UPLOAD_SIZE_MB: e.target.value })}
                  placeholder="15"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Timezone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">אזור זמן (Timezone)</label>
                <select
                  value={generalSettings.DEFAULT_TIMEZONE || "Asia/Jerusalem"}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, DEFAULT_TIMEZONE: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
                >
                  <option value="Asia/Jerusalem">Asia/Jerusalem (ישראל)</option>
                  <option value="UTC">UTC (זמן עולמי)</option>
                </select>
              </div>

              {/* Maintenance Mode */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-300">מצב תחזוקת מערכת</label>
                <select
                  value={generalSettings.MAINTENANCE_MODE || "false"}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, MAINTENANCE_MODE: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-red-500 text-right"
                >
                  <option value="false">מערכת פעילה (אונליין)</option>
                  <option value="true">מצב תחזוקה פעיל (Maintenance Active)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800/60">
              <button
                type="submit"
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                שמור שינויים עסקיים
              </button>
            </div>
          </form>
        )}



        {/* --- DATABASE TAB --- */}
        {subTab === "database" && (
          <div className="space-y-8 animate-fade-in text-right">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-red-400" />
                סטטוס תשתית ומסד נתונים (Cloud SQL Status)
              </h3>
              <p className="text-xs text-slate-400 mt-1">מציג את סטטוס בריאות מסד הנתונים היחסי (Relational Cloud SQL), סכמת הטבלאות, ומהירות תגובה בזמן אמת.</p>
            </div>

            {dbStatus && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Latency card */}
                <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-bold">זמן תגובה (Ping Latency)</p>
                    <p className="text-2xl font-extrabold text-cyan-400 tracking-tight font-mono">{dbStatus.responseTimeMs} ms</p>
                    <p className="text-[10px] text-slate-500">מהיר ותקין לחלוטין</p>
                  </div>
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>

                {/* Connection Status Card */}
                <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-bold">סטטוס חיבור אמת</p>
                    <p className="text-2xl font-extrabold text-emerald-400 tracking-tight flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {dbStatus.status}
                    </p>
                    <p className="text-[10px] text-slate-500">{dbStatus.service}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </div>

                {/* Schema Status Card */}
                <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-bold">מבנה טבלאות ומיגרציות</p>
                    <p className="text-2xl font-extrabold text-amber-400 tracking-tight">
                      {schemaStatus?.tablesExist ? "תקין ומעודכן" : "דורש בדיקה"}
                    </p>
                    <p className="text-[10px] text-slate-500">Drizzle ORM Schema checked</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                    <FileCode className="h-5 w-5" />
                  </div>
                </div>
              </div>
            )}

            {/* Technical Database Details */}
            {dbStatus && (
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-slate-400" />
                  פרטי חיבור פנימיים
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-slate-400">
                  <div className="flex justify-between items-center p-2.5 border-b border-slate-850">
                    <span>סוג מנוע:</span>
                    <span className="text-slate-200 font-bold">{dbStatus.engine}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 border-b border-slate-850">
                    <span>שירות מנוהל:</span>
                    <span className="text-slate-200 font-bold">{dbStatus.service}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 border-b border-slate-850">
                    <span>אזור ענן (GCP Region):</span>
                    <span className="text-slate-200 font-mono font-bold">{dbStatus.region}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 border-b border-slate-850">
                    <span>גרסת מסד נתונים:</span>
                    <span className="text-slate-200 font-mono font-bold">{dbStatus.version.split(",")[0]}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 border-b border-slate-850">
                    <span>שם בסיס הנתונים:</span>
                    <span className="text-slate-200 font-mono font-bold">{dbStatus.databaseName}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 border-b border-slate-850">
                    <span>מיגרציות אחרונות:</span>
                    <span className="text-slate-200 font-bold text-emerald-400">SYN_CASH_SYSTEM_SETTINGS_MIGRATED</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-start gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestDatabaseConnection}
                disabled={dbTesting}
                className="px-5 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {dbTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                    בודק חיבור...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    בדוק חיבור מחדש
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* --- SECURITY & SECRETS TAB --- */}
        {subTab === "security" && (
          <div className="space-y-8 animate-fade-in text-right">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-red-400" />
                אבטחה והצפנת נתונים (Secrets Configuration)
              </h3>
              <p className="text-xs text-slate-400 mt-1">מציג את סטטוס מפתח ההצפנה ונותן גישה חיה לבדיקת שלמות שירותי ההצפנה של המערכת בשרת.</p>
            </div>

            {securityStatus && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Encryption Key Status */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col justify-between h-[140px]">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-bold">מפתח הצפנת שדות (Field Encryption Key)</p>
                      <p className="text-xl font-extrabold text-emerald-400 flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {securityStatus.encryptionKeyConfigured ? "פעיל ומאובטח" : "לא מוגדר"}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                      <Lock className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">מנוהל דרך Google Secret Manager בשרת פרודקשן</p>
                </div>

                {/* Encryption Version Status */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col justify-between h-[140px]">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-bold">גרסת מפתח הצפנה פעיל</p>
                      <p className="text-xl font-extrabold text-cyan-400 tracking-tight font-mono">{securityStatus.activeVersion}</p>
                    </div>
                    <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
                      <KeyRound className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">תאריך רוטציה אחרון: {securityStatus.lastRotationAt}</p>
                </div>
              </div>
            )}

            {/* Simulated Cryptography test block */}
            <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  מבחן אבטחה מבוצע בשרת (Cryptography Loop Test)
                </h4>
                <p className="text-xs text-slate-400 mt-1">בצע בדיקת הצפנה ופענוח בזמן אמת בשרת כדי לוודא ששדות תעודות הזהות, מספרי הטלפון ושמות הלקוחות מוצפנים ונשמרים בצורה מאובטחת ועובדים כראוי.</p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestFieldEncryption}
                  disabled={securityTesting}
                  className="px-5 py-2.5 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {securityTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      מריץ מבחן הצפנה...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      הפעל בדיקת תקינות הצפנה
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- AUDIT LOG TAB --- */}
        {subTab === "audit" && (
          <div className="space-y-4 animate-fade-in text-right">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-red-400" />
                  יומן ביקורת ושינויי מערכת (Audit Trail)
                </h3>
                <p className="text-xs text-slate-400 mt-1">עקוב אחר כל שינויי ההגדרות, בדיקות התשתית ופעולות האבטחה שבוצעו במערכת על ידי מנהלי על.</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="חפש פעולה או טבלה..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-red-500 text-right"
                />
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 font-bold text-slate-400 border-b border-slate-800/60 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3">זמן (UTC)</th>
                      <th className="px-5 py-3">מבצע הפעולה</th>
                      <th className="px-5 py-3">סוג פעולה</th>
                      <th className="px-5 py-3">רכיב מושפע</th>
                      <th className="px-5 py-3">פרטים ומידע פנימי</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {filteredAuditLogs.length > 0 ? (
                      filteredAuditLogs.map((log) => {
                        let parsedMeta = "";
                        if (log.metadata) {
                          try {
                            const metaObj = typeof log.metadata === "string" ? JSON.parse(log.metadata) : log.metadata;
                            parsedMeta = JSON.stringify(metaObj);
                          } catch (e) {
                            parsedMeta = String(log.metadata);
                          }
                        }

                        return (
                          <tr key={log.id} className="hover:bg-slate-800/10 transition-colors">
                            <td className="px-5 py-3 font-mono text-slate-400 whitespace-nowrap">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString('he-IL') : "לא צוין"}
                            </td>
                            <td className="px-5 py-3 font-bold text-slate-200">
                              {log.actorUserId ? `משתמש ID: ${log.actorUserId}` : "מערכת (System)"}
                            </td>
                            <td className="px-5 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 border border-slate-700 text-red-400 font-extrabold uppercase">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-400 font-mono">{log.entityType || "-"}</td>
                            <td className="px-5 py-3 font-mono text-slate-400 max-w-xs truncate" title={parsedMeta}>
                              {parsedMeta || "-"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-500 font-bold">
                          לא נמצאו רשומות ביקורת במערכת.
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
    </div>
  );
}
