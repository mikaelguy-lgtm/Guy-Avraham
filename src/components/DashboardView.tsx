import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, CircleDollarSign, FileClock, FolderCheck, Plus, Search, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Client, CurrentUser } from "../types";
import { api } from "../utils/apiClient";
import { loanPurposeOptions } from "../utils/clientForm";
import { formatClientStatus, formatCurrency, formatDate, formatDealType } from "../utils/formatters";

export default function DashboardView({user, clientsOnly = false}: {user: CurrentUser; clientsOnly?: boolean}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loanPurpose, setLoanPurpose] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => { void api.clients().then((result) => setClients(result.items)).finally(() => setLoading(false)); }, []);
  const visibleClients = useMemo(() => clients.filter((client) => {
    const term = search.trim().toLocaleLowerCase("he");
    const matchesSearch = !term || `${client.firstName} ${client.lastName} ${client.publicCaseNumber}`.toLocaleLowerCase("he").includes(term);
    return matchesSearch && (status === "ALL" || client.status === status) && (loanPurpose === "ALL" || client.loanPurpose === loanPurpose);
  }), [clients, search, status, loanPurpose]);
  const stats = [
    {label: "סך כל הלקוחות", value: clients.length, icon: UsersRound, tone: "cyan"},
    {label: "תיקים בטיוטה", value: clients.filter((client) => client.status === "DRAFT").length, icon: FileClock, tone: "gold"},
    {label: "תיקים שנשלחו", value: clients.filter((client) => client.status === "SUBMITTED" || client.latestSubmissionStatus).length, icon: BriefcaseBusiness, tone: "blue"},
    {label: "תיקים עם הצעה", value: clients.filter((client) => client.offerCount > 0).length, icon: CircleDollarSign, tone: "green"}
  ];

  return <main className="advisor-page">
    {!clientsOnly && <><section className="advisor-hero"><div><span className="eyebrow">בוקר טוב, {user.firstName}</span><h1>ברוך הבא ללוח הבקרה</h1><p>מבט מרוכז על הלקוחות, התיקים וההצעות שלך במקום אחד.</p></div><button type="button" className="primary-action" onClick={() => navigate("/advisor/new")}><Plus size={20} />לקוח חדש</button></section>
      <section className="stats-grid" aria-label="נתוני לוח הבקרה">{stats.map(({label, value, icon: Icon, tone}) => <article className="stat-card" key={label}><span className={`stat-icon ${tone}`}><Icon /></span><span><small>{label}</small><strong>{value}</strong></span></article>)}</section></>}
    <section className="content-card client-list-section">
      <div className="section-heading"><div><span className="eyebrow">ניהול תיקים</span><h2>{clientsOnly ? "לקוחות" : "לקוחות אחרונים"}</h2><p>חיפוש, סינון וכניסה מהירה לכל תיק לקוח.</p></div>{clientsOnly && <button type="button" className="primary-action" onClick={() => navigate("/advisor/new")}><Plus size={18} />לקוח חדש</button>}</div>
      <div className="client-toolbar"><label className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="חיפוש לקוחות" placeholder="חיפוש לפי שם או מספר תיק" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-field"><span>סינון לפי סטטוס</span><select aria-label="סינון לפי סטטוס" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">כל הסטטוסים</option><option value="DRAFT">טיוטה</option><option value="ACTIVE">פעיל</option><option value="SUBMITTED">נשלח לחברות מימון</option><option value="CLOSED">נסגר</option></select></label><label className="filter-field"><span>סינון לפי מטרת הלוואה</span><select aria-label="סינון לפי מטרת הלוואה" value={loanPurpose} onChange={(event) => setLoanPurpose(event.target.value)}><option value="ALL">כל מטרות ההלוואה</option>{loanPurposeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      {loading ? <div className="empty-state">טוען את תיקי הלקוחות…</div> : visibleClients.length === 0 ? <div className="empty-state"><FolderCheck size={34} /><h3>לא נמצאו לקוחות</h3><p>ניתן לשנות את החיפוש או ליצור תיק לקוח חדש.</p></div> : <div className="clients-grid">{visibleClients.map((client) => <article className="client-card" key={client.id}><div className="client-card-top"><span className="client-avatar">{client.firstName.slice(0, 1)}{client.lastName.slice(0, 1)}</span><span className={`status-badge status-${client.status.toLowerCase()}`}>{formatClientStatus(client.status)}</span></div><div><h3>{client.firstName} {client.lastName}</h3><p className="case-number">תיק {client.publicCaseNumber}</p>{client.missingRequiredDocumentCount > 0 && <span className="status-badge status-warning">חסרים {client.missingRequiredDocumentCount} מסמכי חובה</span>}</div><dl className="client-card-data"><div><dt>מטרת ההלוואה</dt><dd>{formatDealType(client.loanPurpose)}</dd></div><div><dt>סכום מבוקש</dt><dd>{formatCurrency(client.requestedAmount)}</dd></div><div><dt>עודכן לאחרונה</dt><dd>{formatDate(client.updatedAt)}</dd></div></dl><button type="button" className="card-link" onClick={() => navigate(`/advisor/clients/${client.id}`)}>פתיחת התיק<ArrowLeft size={17} /></button></article>)}</div>}
    </section>
  </main>;
}
