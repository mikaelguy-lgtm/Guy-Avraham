import React, { useState, useEffect } from "react";
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
import { Search, Bell, HelpCircle, Settings as SettingsIcon, Menu } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [uploadedFileUrls, setUploadedFileUrls] = useState<Record<string, { url: string; type: string; name: string }>>({});

  // Loaded logged-in advisor session from localStorage
  const [loggedInAdvisor, setLoggedInAdvisor] = useState<(AdvisorProfile & { id: string; isAdmin?: boolean }) | null>(() => {
    const saved = localStorage.getItem("advisor_session");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse advisor session:", e);
      }
    }
    return null;
  });

  // Fetch clients from our Node.js/Express backend
  const fetchClients = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch("/api/clients");
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      } else {
        console.error("Failed to load clients");
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (loggedInAdvisor) {
      fetchClients();
    }
  }, [loggedInAdvisor]);

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

  const handleUpdateProfile = (updated: AdvisorProfile) => {
    if (loggedInAdvisor) {
      const newProfile = { ...loggedInAdvisor, ...updated };
      setLoggedInAdvisor(newProfile);
      localStorage.setItem("advisor_session", JSON.stringify(newProfile));
    }
  };

  const handleLogout = () => {
    setLoggedInAdvisor(null);
    localStorage.removeItem("advisor_session");
    setActiveTab("dashboard");
  };

  // If no advisor is logged in, intercept with the clean registration/login view
  if (!loggedInAdvisor) {
    return (
      <AuthScreen 
        onLoginSuccess={(advisor) => {
          setLoggedInAdvisor(advisor);
          localStorage.setItem("advisor_session", JSON.stringify(advisor));
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
      <div className={`fixed right-0 top-0 h-full w-64 bg-slate-900 z-50 border-l border-slate-800 md:hidden flex flex-col transform transition-transform duration-300 ${
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      }`}>
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
      </div>

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
