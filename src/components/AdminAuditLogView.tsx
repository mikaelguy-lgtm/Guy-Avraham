import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuditLogEntry } from "../types";
import { api } from "../utils/apiClient";
import { adminEntityLink } from "../utils/adminEntityLink";
import { formatIsraelDateTime } from "../utils/formatters";

const entityTypeLabel: Record<string, string> = {
  client: "תיק", user: "משתמש", company_submission: "שליחה לחברה", notification: "התראה", system_settings: "הגדרות מערכת"
};

export default function AdminAuditLogView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    setLoading(true);
    void api.adminAuditLogs({limit: 200, action: action || undefined, entityType: entityType || undefined, since: since || undefined, until: until || undefined})
      .then(setEntries).finally(() => setLoading(false));
  }, [action, entityType, since, until]);

  const actionOptions = [...new Set(entries.map((entry) => entry.action))].sort();
  const entityTypeOptions = [...new Set(entries.map((entry) => entry.entityType).filter((value): value is string => Boolean(value)))].sort();

  return <main className="admin-page">
    <nav className="breadcrumbs" aria-label="פירורי לחם"><Link to="/admin">לוח הבקרה</Link><span>›</span><span aria-current="page">יומן פעילות</span></nav>
    <section className="panel">
      <header className="section-heading compact"><div><h1>יומן פעילות</h1><p>מעקב אחר פעולות ניהוליות ואירועי מערכת. אינו מציג מידע אישי או פיננסי מזוהה.</p></div></header>
      <div className="client-toolbar">
        <label className="filter-field"><span>מתאריך</span><input type="date" value={since} onChange={(event) => setSince(event.target.value)} /></label>
        <label className="filter-field"><span>עד תאריך</span><input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
        <label className="filter-field"><span>פעולה</span><select value={action} onChange={(event) => setAction(event.target.value)}><option value="">כל הפעולות</option>{actionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <label className="filter-field"><span>סוג ישות</span><select value={entityType} onChange={(event) => setEntityType(event.target.value)}><option value="">כל הסוגים</option>{entityTypeOptions.map((option) => <option key={option} value={option}>{entityTypeLabel[option] ?? option}</option>)}</select></label>
      </div>
    </section>
    <section className="panel">
      {loading ? <div className="empty-state">טוען יומן…</div> : entries.length === 0 ? <div className="empty-state">לא נמצאו רשומות התואמות את הסינון.</div> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>זמן</th><th>מבצע</th><th>תפקיד</th><th>פעולה</th><th>ישות</th><th>מזהה / מספר תיק</th></tr></thead>
        <tbody>{entries.map((entry) => <tr key={entry.id}>
          <td>{formatIsraelDateTime(entry.createdAt)}</td>
          <td>{entry.actorName ?? "מערכת"}</td>
          <td>{entry.actorRole ?? "—"}</td>
          <td>{entry.action}</td>
          <td>{entry.entityType ? entityTypeLabel[entry.entityType] ?? entry.entityType : "—"}</td>
          <td>{entry.caseNumber ?? (entry.entityId ? <Link to={adminEntityLink(entry.entityType, entry.entityId)}>{`#${entry.entityId}`}</Link> : "—")}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </main>;
}
