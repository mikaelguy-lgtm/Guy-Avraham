import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Banknote, Briefcase, Clock3, Handshake, Mail, ShieldAlert, UserCheck, Users, UserPlus } from "lucide-react";
import type { CurrentUser } from "../types";
import type { AdminActivityPoint, AdminAttention, AdminDashboardStats, AdminRecentActivityItem, AdminStatsPeriod } from "../types";
import { api } from "../utils/apiClient";
import { adminEntityLink } from "../utils/adminEntityLink";
import { formatCurrency, formatIsraelDateTime } from "../utils/formatters";
import {useIsraelTimeGreeting} from "../hooks/useIsraelTimeGreeting";

const sections = [
  {to: "/admin/advisors", title: "יועצים", description: "ניהול יועצים והרשאות"},
  {to: "/admin/cases", title: "תיקים", description: "כל התיקים במערכת, לפי סטטוס"},
  {to: "/admin/lenders", title: "חברות מימון", description: "ניהול גופי מימון"},
  {to: "/admin/company-submissions", title: "שליחות לחברות", description: "מעקב אחר מסירה, תגובות וגישה"},
  {to: "/admin/business-calendar", title: "לוח ימי עסקים", description: "חגים וחריגי פעילות בישראל"},
  {to: "/admin/settings", title: "הגדרות מערכת", description: "הגדרות תפעול ואבטחה"},
  {to: "/admin/audit", title: "יומן פעילות", description: "בקרה ואירועי מערכת"}
];

const periodOptions: Array<{value: AdminStatsPeriod; label: string}> = [
  {value: "today", label: "היום"}, {value: "7d", label: "7 ימים"}, {value: "30d", label: "30 ימים"}, {value: "month", label: "החודש"}, {value: "all", label: "הכל"}
];

const activityTypeLabel: Record<string, string> = {
  ADVISOR_REGISTERED: "יועץ חדש נרשם", CASE_CREATED: "תיק חדש נוצר", LENDER_INTERESTED: "חברת מימון הביעה עניין",
  LENDER_NOT_INTERESTED: "חברת מימון בחרה לא להתקדם", DEADLINE_PASSED: "עבר מועד המענה", EMAIL_FAILED: "שליחת מייל נכשלה", PRIVACY_REQUEST: "בקשת פרטיות חדשה"
};

function activityLink(item: AdminRecentActivityItem): string {
  return adminEntityLink(item.entityType, item.entityId);
}

// גרף SVG קליל ללא תלות בספריית chart — הפרויקט אינו כולל כרגע ספריית
// גרפים, ולסדרה קטנה של עד כמה עשרות נקודות אין הצדקה להוסיף אחת.
function ActivityChart({points}: {points: AdminActivityPoint[]}) {
  if (!points.length) return <div className="empty-state">אין נתוני פעילות להצגה בתקופה שנבחרה.</div>;
  const series: Array<{key: keyof AdminActivityPoint; label: string; color: string}> = [
    {key: "new_advisors", label: "יועצים חדשים", color: "#22d3ee"},
    {key: "new_cases", label: "תיקים חדשים", color: "#f99c00"},
    {key: "cases_sent", label: "תיקים שנשלחו", color: "#10b981"},
    {key: "interested", label: "חברות שהביעו עניין", color: "#fb7185"}
  ];
  const max = Math.max(1, ...points.flatMap((point) => series.map((item) => Number(point[item.key]))));
  const width = 640; const height = 180; const padding = 24;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const toY = (value: number) => height - padding - (value / max) * (height - padding * 2);
  return <div className="activity-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="גרף פעילות">
      {series.map((item) => {
        const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${padding + index * stepX},${toY(Number(point[item.key]))}`).join(" ");
        return <path key={item.key} d={path} fill="none" stroke={item.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />;
      })}
    </svg>
    <div className="activity-chart-legend">{series.map((item) => <span key={item.key}><i style={{background: item.color}} />{item.label}</span>)}</div>
  </div>;
}

export default function AdminHome({user}: {user: CurrentUser}) {
  const greeting = useIsraelTimeGreeting(user.firstName);
  const [period, setPeriod] = useState<AdminStatsPeriod>("30d");
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [activity, setActivity] = useState<AdminActivityPoint[]>([]);
  const [recent, setRecent] = useState<AdminRecentActivityItem[]>([]);
  const [attention, setAttention] = useState<AdminAttention | null>(null);
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void Promise.all([api.adminStats(period), api.adminActivityStats(period), api.adminRecentActivity(), api.adminAttention()])
      .then(([statsResult, activityResult, recentResult, attentionResult]) => {
        if (cancelled) return;
        setStats(statsResult); setActivity(activityResult); setRecent(recentResult); setAttention(attentionResult);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, isSuperAdmin]);

  const kpis = stats ? [
    {label: "יועצים סה״כ", value: stats.total_advisors, icon: Users, tone: "cyan"},
    {label: "חשבונות יועצים פעילים", value: stats.active_advisor_accounts, icon: UserCheck, tone: "green"},
    {label: "יועצים חדשים בתקופה", value: stats.new_advisors, icon: UserPlus, tone: "cyan"},
    {label: "תיקים סה״כ", value: stats.total_cases, icon: Briefcase, tone: "blue"},
    {label: "תיקים חדשים בתקופה", value: stats.new_cases, icon: Briefcase, tone: "blue"},
    {label: "תיקים שנשלחו בתקופה", value: stats.sent_in_period, icon: Mail, tone: "gold"},
    {label: "ממתינים לתשובה", value: stats.waiting_for_response, icon: Clock3, tone: "gold"},
    {label: "עם עניין מחברת מימון", value: stats.with_interest, icon: Handshake, tone: "green"},
    {label: "ללא מענה אחרי deadline", value: stats.expired_no_response, icon: ShieldAlert, tone: "danger"},
    {label: "סך מימון מבוקש בתקופה", value: formatCurrency(stats.total_requested), icon: Banknote, tone: "cyan"},
    {label: "מימון מבוקש ממוצע", value: formatCurrency(stats.avg_requested), icon: Banknote, tone: "cyan"}
  ] : [];

  const attentionItems = attention ? [
    {label: "תיקים בטיוטה ללא עדכון מעל שבועיים", value: attention.staleDrafts, to: "/admin/cases?status=DRAFT"},
    {label: "תיקים ללא מענה אחרי המועד", value: attention.pastDeadlineNoResponse, to: "/admin/cases?status=EXPIRED"},
    {label: "מיילים שנכשלו", value: attention.failedEmails, to: "/admin/email-logs"},
    {label: "חשבונות יועצים הדורשים טיפול", value: attention.problemAdvisorAccounts, to: "/admin/advisors"},
    {label: "בקשות פרטיות פתוחות", value: attention.openPrivacyRequests, to: "/admin/settings/privacy-requests"}
  ].filter((item) => item.value > 0) : [];

  return <main className="admin-page">
    <section className="panel"><p className="eyebrow">{user.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}</p><h1>לוח הבקרה</h1><p>{greeting}, מכאן ניתן לנהל את סביבת SynCash בהתאם להרשאות שלך.</p></section>

    {isSuperAdmin && <>
      <section className="panel dashboard-period-bar">
        <span className="eyebrow">תקופה</span>
        <div className="period-toggle" role="group" aria-label="בחירת תקופת זמן">{periodOptions.map((option) => <button key={option.value} type="button" className={option.value === period ? "active" : ""} onClick={() => setPeriod(option.value)}>{option.label}</button>)}</div>
      </section>

      {loading && <div className="empty-state">טוען נתוני דשבורד…</div>}

      {!loading && stats && <section className="stats-grid" aria-label="KPI ראשיים">{kpis.map(({label, value, icon: Icon, tone}) => <article className="stat-card" key={label}><span className={`stat-icon ${tone}`}><Icon /></span><span><small>{label}</small><strong>{value}</strong></span></article>)}</section>}

      {!loading && <section className="panel"><header className="section-heading compact"><div><h2>גרף פעילות</h2><p>יועצים חדשים, תיקים חדשים, תיקים שנשלחו, וחברות שהביעו עניין — לפי {period === "all" ? "שבוע" : "יום"}.</p></div></header><ActivityChart points={activity} /></section>}

      {!loading && attentionItems.length > 0 && <section className="panel"><header className="section-heading compact"><div><h2><AlertTriangle size={20} aria-hidden="true" /> דורש טיפול</h2></div></header><ul className="attention-list">{attentionItems.map((item) => <li key={item.label}><Link to={item.to}><strong>{item.value}</strong><span>{item.label}</span></Link></li>)}</ul></section>}

      {!loading && <section className="panel"><header className="section-heading compact"><div><h2>פעילות אחרונה</h2></div></header>
        {recent.length === 0 ? <div className="empty-state">אין פעילות אחרונה להצגה.</div> : <ul className="recent-activity-list">{recent.map((item, index) => <li key={`${item.type}-${item.entityId}-${index}`}><Link to={activityLink(item)}><span className="recent-activity-type">{activityTypeLabel[item.type] ?? item.type}</span><span className="recent-activity-label">{item.label}</span><time>{formatIsraelDateTime(item.at)}</time></Link></li>)}</ul>}
      </section>}
    </>}

    <section className="admin-card-grid">{sections.map((section) => <Link className="panel admin-card" to={section.to} key={section.to}><h2>{section.title}</h2><p>{section.description}</p></Link>)}</section>
  </main>;
}
