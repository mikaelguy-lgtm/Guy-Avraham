import { NavLink } from "react-router-dom";
import LegalFooterLinks from "./LegalFooterLinks";

const links = [
  {to: "/admin", label: "לוח בקרה", end: true},
  {to: "/admin/advisors", label: "יועצים"},
  {to: "/admin/clients", label: "לקוחות"},
  {to: "/admin/lenders", label: "חברות מימון"},
  {to: "/admin/company-submissions", label: "שליחות לחברות"},
  {to: "/admin/email-logs", label: "יומן דוא״ל"},
  {to: "/admin/business-calendar", label: "לוח ימי עסקים"},
  {to: "/admin/settings", label: "הגדרות מערכת"},
  {to: "/admin/audit", label: "יומן פעילות"}
];

export default function Sidebar({onLogout}: {onLogout: () => void}) {
  return <aside className="admin-sidebar panel"><nav aria-label="ניווט ניהול"><ul>{links.map((link) => <li key={link.to}><NavLink end={link.end} to={link.to} className={({isActive}) => `admin-nav-link${isActive ? " active" : ""}`}>{link.label}</NavLink></li>)}<li><button type="button" className="admin-nav-link logout-link" onClick={onLogout}>יציאה</button></li></ul></nav><LegalFooterLinks /></aside>;
}
