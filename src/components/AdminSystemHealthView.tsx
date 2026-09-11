import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { AdminSystemHealth } from "../types";
import { api } from "../utils/apiClient";
import { formatIsraelDateTime } from "../utils/formatters";

const statusIcon: Record<string, React.ReactNode> = {
  GREEN: <CheckCircle2 size={18} />, YELLOW: <AlertTriangle size={18} />, RED: <XCircle size={18} />
};
const statusLabel: Record<string, string> = {GREEN: "תקין", YELLOW: "אזהרה", RED: "תקלה"};

function StatusRow({label, status}: {label: string; status: "GREEN" | "YELLOW" | "RED"}) {
  return <div className={`system-health-row status-${status.toLowerCase()}`}><span>{label}</span><span className="system-health-badge">{statusIcon[status]}{statusLabel[status]}</span></div>;
}

export default function AdminSystemHealthView() {
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => void api.adminSystemHealth().then((result) => { if (!cancelled) { setHealth(result); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return <main className="admin-page">
    <nav className="breadcrumbs" aria-label="פירורי לחם"><Link to="/admin">לוח הבקרה</Link><span>›</span><span aria-current="page">בריאות מערכת</span></nav>
    <section className="panel">
      <header className="section-heading compact"><div><h1>בריאות מערכת</h1><p>סטטוס חי של רכיבי המערכת. מתעדכן אוטומטית כל 30 שניות.</p></div></header>
      {loading ? <div className="empty-state">בודק סטטוס…</div> : !health ? <div className="empty-state">לא ניתן היה לטעון את סטטוס המערכת.</div> : <>
        <div className="system-health-grid">
          <StatusRow label="API" status={health.api} />
          <StatusRow label="Worker" status={health.worker} />
          <StatusRow label="PostgreSQL" status={health.postgres} />
          <StatusRow label="Redis" status={health.redis} />
          <StatusRow label="MinIO" status={health.minio} />
        </div>
        <dl className="company-stat-row">
          <div><small>Heartbeat אחרון של ה-Worker</small><strong>{health.workerHeartbeatAt ? formatIsraelDateTime(health.workerHeartbeatAt) : "לא זמין"}</strong></div>
          <div><small>מיילים שנכשלו</small><strong>{health.failedEmailCount}</strong></div>
          <div><small>מיילים בתור</small><strong>{health.pendingEmailCount}</strong></div>
          <div><small>גיבוי אחרון</small><strong>{health.lastBackup}</strong></div>
        </dl>
      </>}
    </section>
  </main>;
}
