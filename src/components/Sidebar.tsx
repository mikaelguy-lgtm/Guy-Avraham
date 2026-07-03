import React from "react";
import { 
  LayoutDashboard, 
  UserPlus, 
  FileText, 
  TrendingUp, 
  Settings, 
  HelpCircle, 
  LogOut, 
  PlusCircle,
  ShieldAlert
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewRequestClick: () => void;
  advisorName: string;
  isAdmin?: boolean;
  onLogout: () => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onNewRequestClick, 
  advisorName, 
  isAdmin, 
  onLogout 
}: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "לוח בקרה", icon: LayoutDashboard },
    { id: "new-client", label: "לקוח חדש", icon: UserPlus },
    { id: "documents", label: "ניהול מסמכים", icon: FileText },
    { id: "arena", label: "זירת הלוואות", icon: TrendingUp },
    { id: "settings", label: "הגדרות", icon: Settings },
  ];

  // If the user has an Admin role, we add a beautiful distinctive ADMIN tab
  const finalMenuItems = [...menuItems];
  if (isAdmin) {
    finalMenuItems.push({ id: "admin", label: "ניהול אדמין ADMIN", icon: ShieldAlert });
  }

  return (
    <aside id="sidebar-nav" className="fixed right-0 top-0 h-full w-64 flex flex-col z-40 bg-slate-950/60 backdrop-blur-md border-l border-slate-800 hidden md:flex transition-all">
      {/* Brand Logo */}
      <div className="p-6 border-b border-slate-800/80">
        <h1 className="font-bold text-2xl tracking-tight text-white font-sans flex items-center gap-2">
          <span className="font-black text-white">SynCash</span>
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-1">מערכת חכמה ליועצי משכנתאות</p>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 mt-6 px-3 space-y-1">
        {finalMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isAdminTab = item.id === "admin";
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isActive 
                  ? isAdminTab
                    ? "bg-rose-500/10 text-rose-400 border-r-4 border-rose-500 shadow-[inset_0_0_8px_rgba(244,63,94,0.05)]"
                    : "bg-cyan-500/10 text-cyan-400 border-r-4 border-cyan-500 shadow-[inset_0_0_8px_rgba(6,182,212,0.05)]" 
                  : isAdminTab
                    ? "text-rose-400/80 hover:bg-rose-950/20 hover:text-rose-200"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-100"
              }`}
            >
              <Icon className={`h-5 w-5 ml-3 ${
                isActive 
                  ? isAdminTab ? "text-rose-400" : "text-cyan-400" 
                  : isAdminTab ? "text-rose-500" : "text-slate-500"
              }`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-800/80">
        <button 
          onClick={onNewRequestClick}
          className="w-full bg-cyan-600 text-white py-3 px-4 rounded-lg font-bold text-sm flex justify-center items-center gap-2 active:scale-95 hover:bg-cyan-500 transition-all shadow-[0_4px_15px_rgba(8,145,178,0.3)] hover:scale-[1.02]"
        >
          <PlusCircle className="h-4 w-4" />
          בקשה חדשה
        </button>

        <div className="mt-6 flex flex-col gap-2 px-2 text-xs font-semibold text-slate-400">
          <button 
            onClick={() => setActiveTab("settings")}
            className="flex items-center gap-2 hover:text-cyan-400 text-right transition-colors"
          >
            <HelpCircle className="h-4 w-4 text-slate-500" />
            עזרה ותמיכה
          </button>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 mt-2 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer text-right w-full bg-transparent border-none outline-none font-semibold text-xs"
          >
            <LogOut className="h-4 w-4 text-rose-500" />
            <span>התנתק</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
