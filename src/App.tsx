import React, { useState, useEffect } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import { Client, AdvisorProfile } from "./types";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import NewClientWizard from "./components/NewClientWizard";
import DocumentManager from "./components/DocumentManager";
import LoanArena from "./components/LoanArena";
import SettingsView from "./components/SettingsView";
import AuthScreen from "./components/AuthScreen";
import AdminDashboard from "./components/AdminDashboard";
import SynCashLogo from "./components/SynCashLogo";
import LenderPortal from "./components/LenderPortal";
import { api } from "./utils/apiClient";
import { auth } from "./lib/firebase";
import { Search, Bell, HelpCircle, Settings as SettingsIcon, Menu } from "lucide-react";

function MainAppContent() {
  const [authState, setAuthState] = useState<"INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED" | "DISABLED" | "ERROR">("INITIALIZING");
  const [loggedInAdvisor, setLoggedInAdvisor] = useState<(AdvisorProfile & { id: string; isAdmin?: boolean }) | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [uploadedFileUrls, setUploadedFileUrls] = useState<Record<string, { url: string; type: string; name: string }>>({});

  // Lender invite state handled separately in route wrapper

  // Fetch clients from our unified API
  const fetchClients = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getClients();
      setClients(data);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setLoggedInAdvisor(null);
        setAuthState("UNAUTHENTICATED");
        setLoading(false);
      } else {
        try {
          // Fetch authenticated profile from DB
          const res = await api.getMe();
          if (res) {
            if (res.status === "ACTIVE") {
              const profile = {
                id: String(res.id),
                name: res.firstName || res.email.split("@")[0],
                role: res.role === "SUPER_ADMIN" ? "סופר אדמין" : (res.role === "LENDER_UNDERWRITER" ? "חתם" : "יועץ משכנתאות"),
                isAdmin: res.role === "SUPER_ADMIN" || res.role === "ADMIN",
                phone: res.phone,
                company: res.businessName || "",
                licenseNumber: res.licenseNumber || "",
                disableGemini: res.disableGemini || false
              };
              setLoggedInAdvisor(profile);
              setAuthState("AUTHENTICATED");
            } else {
              setLoggedInAdvisor(null);
              setAuthErrorMessage(
                res.status === "SUSPENDED" 
                  ? "חשבונך מושעה. אנא פנה למנהל המערכת." 
                  : "חשבונך מבוטל או נמחק."
              );
              setAuthState("DISABLED");
            }
          } else {
            setLoggedInAdvisor(null);
            setAuthState("UNAUTHENTICATED");
          }
        } catch (err: any) {
          console.error("Authentication check failed:", err);
          setLoggedInAdvisor(null);
          setAuthErrorMessage(err.message || "שגיאה באימות מול השרת");
          setAuthState("ERROR");
        } finally {
          setLoading(false);
        }
      }
    });

    // Session expiration listener
    const handleExpired = () => {
      setLoggedInAdvisor(null);
      setAuthState("UNAUTHENTICATED");
    };
    window.addEventListener("syncash-session-expired", handleExpired);

    return () => {
      unsubscribe();
      window.removeEventListener("syncash-session-expired", handleExpired);
    };
  }, []);

  useEffect(() => {
    if (authState === "AUTHENTICATED" && loggedInAdvisor) {
      fetchClients();
    }
  }, [authState, loggedInAdvisor]);

  const handleSelectClientFromDashboard = (client: Client, tab: string) => {
    setSelectedClientId(client.id);
    setActiveTab(tab);
  };

  const handleClientCreated = () => {
    fetchClients();
    setActiveTab("dashboard");
  };

  const handleNewRequestClick = () => {
    setActiveTab("new-client");
  };

  const handleUpdateProfile = async (updated: AdvisorProfile) => {
    if (loggedInAdvisor) {
      try {
        const savedProfile = await api.updateAdvisor(loggedInAdvisor.id, updated);
        const newProfile = { ...loggedInAdvisor, ...savedProfile };
        setLoggedInAdvisor(newProfile);
      } catch (err) {
        console.error("Failed to update profile on backend:", err);
        const newProfile = { ...loggedInAdvisor, ...updated };
        setLoggedInAdvisor(newProfile);
      }
    }
  };

  const handleLogout = () => {
    api.logout().catch(err => console.error("Firebase logout failed:", err));
    setLoggedInAdvisor(null);
    setAuthState("UNAUTHENTICATED");
    setActiveTab("dashboard");
  };

  // Legacy lender ref ID conditional render removed

  // Handle various states of authentication
  if (authState === "INITIALIZING" || (authState === "AUTHENTICATED" && loading && !loggedInAdvisor)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6 py-16" dir="rtl">
        <SynCashLogo size="md" showSubtitle={true} showText={true} className="animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-bold tracking-wider">מאתחל את מערכת האבטחה של SynCash...</p>
        </div>
      </div>
    );
  }

  if (authState === "DISABLED") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full space-y-6">
          <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold">✕</span>
          </div>
          <h2 className="text-xl font-bold text-white">גישת החשבון נחסמה</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{authErrorMessage || "חשבונך מושעה או מבוטל במערכת. אנא פנה לתמיכה לקבלת עזרה."}</p>
          <button 
            onClick={handleLogout}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            התנתק וחזור למסך הכניסה
          </button>
        </div>
      </div>
    );
  }

  if (authState === "ERROR") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full space-y-6">
          <div className="h-16 w-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-bold text-white">שגיאה בתהליך ההתחברות</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{authErrorMessage || "לא הצלחנו לאמת את פרטיך מול מסד הנתונים."}</p>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                setAuthState("INITIALIZING");
                auth.currentUser?.getIdToken(true)
                  .then(() => {
                    api.getMe().then(res => {
                      if (res && res.status === "ACTIVE") {
                        setLoggedInAdvisor({
                          id: String(res.id),
                          name: res.firstName || res.email.split("@")[0],
                          role: res.role === "SUPER_ADMIN" ? "סופר אדמין" : (res.role === "LENDER_UNDERWRITER" ? "חתם" : "יועץ משכנתאות"),
                          isAdmin: res.role === "SUPER_ADMIN" || res.role === "ADMIN",
                          phone: res.phone,
                          company: res.businessName || "",
                          licenseNumber: res.licenseNumber || "",
                          disableGemini: res.disableGemini || false
                        });
                        setAuthState("AUTHENTICATED");
                      } else {
                        setAuthState("DISABLED");
                      }
                    }).catch((e) => {
                      setAuthErrorMessage(e.message || "שגיאה בטעינת הנתונים");
                      setAuthState("UNAUTHENTICATED");
                    });
                  })
                  .catch(() => setAuthState("UNAUTHENTICATED"));
              }}
              className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              נסה שוב
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              התנתק
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If no advisor is logged in, intercept with the clean registration/login view
  if (authState === "UNAUTHENTICATED" || !loggedInAdvisor) {
    return (
      <AuthScreen 
        onLoginSuccess={() => {
          setAuthState("INITIALIZING");
          setActiveTab("dashboard");
        }} 
      />
    );
  }

  // Filter clients so standard advisors only see their own, while admins see all!
  const visibleClients = clients.filter(c => loggedInAdvisor.isAdmin || c.advisorId === loggedInAdvisor.id);

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100 overflow-x-hidden antialiased relative">
      
      {/* Visual Flares */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {/* Right Sidebar - Desktop */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }} 
        onNewRequestClick={handleNewRequestClick}
        advisorName={loggedInAdvisor.name}
        isAdmin={loggedInAdvisor.isAdmin}
        onLogout={handleLogout}
      />

      {/* Mobile Drawer/Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all"
        ></div>
      )}

      {/* Mobile Sidebar Content */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }} 
        onNewRequestClick={handleNewRequestClick}
        advisorName={loggedInAdvisor.name}
        isAdmin={loggedInAdvisor.isAdmin}
        onLogout={handleLogout}
        className={`fixed right-0 top-0 h-full w-64 bg-slate-950/95 backdrop-blur-md border-l border-slate-800 z-50 flex-col transform transition-all duration-300 md:hidden ${
          mobileMenuOpen ? "translate-x-0 opacity-100 flex" : "translate-x-full opacity-0 pointer-events-none hidden"
        }`}
      />

      {/* Main Area */}
      <div className="flex-1 md:mr-64 flex flex-col min-h-screen transition-all duration-300">
        
        {/* Top Header Bar */}
        <header className="flex justify-between items-center w-full px-6 md:px-8 h-16 sticky top-0 z-30 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          {/* Right Header Side (RTL) */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-800 md:hidden text-slate-300 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative items-center hidden sm:flex">
              <Search className="absolute right-3.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="חיפוש לקוח או תיק..."
                className="bg-slate-800/60 py-2 pr-10 pl-4 rounded-full border border-slate-700/50 text-xs w-64 text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all focus:bg-slate-800 focus:w-72"
              />
            </div>
          </div>

          {/* Left Header Side (RTL) */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3.5 text-slate-400">
              <button className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
              </button>
              <button 
                onClick={() => setActiveTab("settings")}
                className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setActiveTab("settings")}
                className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-800"></div>

            {/* Advisor User Widget */}
            <div className="flex items-center gap-3">
              <div className="text-left hidden md:block">
                <p className="font-bold text-xs text-white leading-tight text-right">{loggedInAdvisor.name}</p>
                <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider text-right">
                  {loggedInAdvisor.isAdmin ? "SUPER ADMIN" : `VIP • ${loggedInAdvisor.role}`}
                </p>
              </div>
              <img 
                alt={`${loggedInAdvisor.name}`} 
                className="h-9 w-9 rounded-full object-cover ring-2 ring-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]" 
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* Content canvas */}
        <main className="p-6 md:p-8 flex-1 max-w-7xl mx-auto w-full flex flex-col z-10">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-16">
              <SynCashLogo size="md" showSubtitle={true} showText={true} className="animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-bold tracking-wider">טוען את נתוני המערכת של SynCash...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col animate-fade-in">
              {activeTab === "dashboard" && (
                <DashboardView 
                  clients={visibleClients} 
                  onSelectClient={handleSelectClientFromDashboard}
                  advisorName={loggedInAdvisor.name}
                  onRefreshClients={fetchClients}
                />
              )}

              {activeTab === "new-client" && (
                <NewClientWizard 
                  onClientCreated={handleClientCreated}
                  advisorId={loggedInAdvisor.id}
                />
              )}

              {activeTab === "documents" && (
                <DocumentManager 
                  clients={visibleClients}
                  initialSelectedClientId={selectedClientId}
                  onRefreshClients={fetchClients}
                  uploadedFileUrls={uploadedFileUrls}
                  setUploadedFileUrls={setUploadedFileUrls}
                />
              )}

              {activeTab === "arena" && (
                <LoanArena 
                  clients={visibleClients}
                  initialSelectedClientId={selectedClientId}
                  onRefreshClients={fetchClients}
                  advisorId={loggedInAdvisor.id}
                />
              )}

              {activeTab === "settings" && (
                <SettingsView 
                  profile={loggedInAdvisor}
                  onUpdateProfile={handleUpdateProfile}
                />
              )}

              {activeTab === "admin" && loggedInAdvisor.isAdmin && (
                <AdminDashboard 
                  clients={clients} 
                  onRefreshClients={fetchClients}
                  onBackToApp={() => setActiveTab("dashboard")}
                  currentRole={loggedInAdvisor.role}
                />
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="w-full py-6 px-6 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/40 border-t border-slate-800 mt-auto z-10">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="font-bold text-white tracking-tight">SynCash</span>
            <span>&copy; {new Date().getFullYear()}. כל הזכויות שמורות.</span>
          </div>
          <div className="flex gap-5 text-xs text-slate-400 font-semibold">
            <button onClick={() => setActiveTab("settings")} className="hover:text-cyan-400 transition-colors">תנאי שימוש</button>
            <button onClick={() => setActiveTab("settings")} className="hover:text-cyan-400 transition-colors">מדיניות פרטיות</button>
            <button onClick={() => setActiveTab("settings")} className="hover:text-cyan-400 transition-colors">צור קשר</button>
          </div>
        </footer>

      </div>
    </div>
  );
}

function LenderInviteRouteWrapper() {
  const { token } = useParams<{ token: string }>();
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("טוקן הזמנה חסר");
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/lender/validate-invite?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "קישור ההזמנה פג תוקף או שאינו קיים");
        }
        setIsValid(true);
      } catch (err: any) {
        console.error("Token validation failed:", err);
        setError(err.message || "שגיאה בתהליך אימות קישור ההזמנה");
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6" dir="rtl">
        <SynCashLogo size="md" showSubtitle={true} showText={true} className="animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-bold">מאמת את קישור ההזמנה המאובטח...</p>
        </div>
      </div>
    );
  }

  if (error || !isValid || !token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full space-y-6">
          <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold">✕</span>
          </div>
          <h2 className="text-xl font-bold text-white">קישור ההזמנה פג תוקף או שאינו קיים</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error || "מזהה הפנייה אינו תקין או שההזמנה בוטלה על ידי היועץ."}</p>
          <button 
            onClick={() => { window.location.href = "/"; }}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            חזור לדף הבית
          </button>
        </div>
      </div>
    );
  }

  return (
    <LenderPortal 
      refId={token} 
      onClose={() => {
        window.location.href = "/";
      }} 
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/lender/invite/:token" element={<LenderInviteRouteWrapper />} />
      <Route path="*" element={<MainAppContent />} />
    </Routes>
  );
}
