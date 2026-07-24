import { useEffect, useState } from "react";
import { Bell, Building2, FilePlus2, Files, LayoutDashboard, LogOut, Menu, UserRound, UsersRound, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { CurrentUser } from "../types";
import { api } from "../utils/apiClient";
import SynCashLogo from "./SynCashLogo";

const navigation = [
  {to: "/advisor", label: "לוח בקרה", icon: LayoutDashboard, end: true},
  {to: "/advisor/clients", label: "לקוחות", icon: UsersRound},
  {to: "/advisor/new", label: "תיק חדש", icon: FilePlus2},
  {to: "/advisor/arena", label: "זירת מימון", icon: Building2},
  {to: "/advisor/documents", label: "מסמכים", icon: Files},
  {to: "/advisor/notifications", label: "התראות", icon: Bell},
  {to: "/advisor/profile", label: "פרופיל", icon: UserRound}
];

export default function AdvisorLayout({user}: {user: CurrentUser}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const sidebar = <aside className={`advisor-sidebar${drawerOpen ? " drawer-open" : ""}`} aria-label="ניווט יועץ">
    <div className="sidebar-brand"><SynCashLogo size="md" showSubtitle /></div>
    <nav><ul>{navigation.map(({to, label, icon: Icon, end}) => <li key={to}><NavLink to={to} end={end} className={({isActive}) => `advisor-nav-link${isActive ? " active" : ""}`}><Icon aria-hidden="true" size={20} /><span>{label}</span></NavLink></li>)}</ul></nav>
    <div className="sidebar-footer">
      <div className="advisor-mini-profile"><span className="avatar">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</span><span><strong>{user.firstName} {user.lastName}</strong><small>יועץ משכנתאות</small></span></div>
      <button type="button" className="advisor-nav-link logout-action" onClick={() => void api.logout()}><LogOut aria-hidden="true" size={20} /><span>יציאה</span></button>
    </div>
  </aside>;

  return <div className="advisor-app" dir="rtl">
    <header className="advisor-mobile-header"><SynCashLogo size="sm" showSubtitle={false} /><button type="button" className="icon-button" aria-label={drawerOpen ? "סגירת תפריט" : "פתיחת תפריט"} onClick={() => setDrawerOpen((open) => !open)}>{drawerOpen ? <X /> : <Menu />}</button></header>
    {sidebar}
    {drawerOpen && <button type="button" className="drawer-backdrop" aria-label="סגירת תפריט" onClick={() => setDrawerOpen(false)} />}
    <div className="advisor-main"><Outlet /></div>
  </div>;
}
