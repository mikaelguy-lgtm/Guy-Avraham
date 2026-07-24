import { Link } from "react-router-dom";
import type { CurrentUser } from "../types";

const sections = [
  {to: "/admin/advisors", title: "יועצים", description: "ניהול יועצים והרשאות"},
  {to: "/admin/clients", title: "לקוחות", description: "סקירת לקוחות ותיקים"},
  {to: "/admin/lenders", title: "חברות מימון", description: "ניהול גופי מימון"},
  {to: "/admin/settings", title: "הגדרות מערכת", description: "הגדרות תפעול ואבטחה"},
  {to: "/admin/audit", title: "יומן פעילות", description: "בקרה ואירועי מערכת"}
];

export default function AdminHome({user}: {user: CurrentUser}) {
  return <main className="admin-page"><section className="panel"><p className="eyebrow">{user.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}</p><h1>לוח הבקרה</h1><p>שלום {user.firstName}, מכאן ניתן לנהל את סביבת SynCash בהתאם להרשאות שלך.</p></section><section className="admin-card-grid">{sections.map((section) => <Link className="panel admin-card" to={section.to} key={section.to}><h2>{section.title}</h2><p>{section.description}</p></Link>)}</section></main>;
}
