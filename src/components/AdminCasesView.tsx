import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { AdminCaseListItem } from "../types";
import { api } from "../utils/apiClient";
import { caseStageLabels, formatClientStatus, formatCurrency, formatDate, formatDealType } from "../utils/formatters";

const statusFilters: Array<{value: string; label: string}> = [
  {value: "", label: "הכל"}, {value: "DRAFT", label: "טיוטה"}, {value: "SUBMITTED", label: "נשלח"}, {value: "WAITING", label: "ממתין לתשובה"},
  {value: "INTERESTED", label: "עם עניין"}, {value: "NOT_INTERESTED", label: "ללא עניין"}, {value: "EXPIRED", label: "פג ללא מענה"},
  {value: "CLOSED", label: "סגור"}, {value: "ARCHIVED", label: "בארכיון"}
];

const PAGE_SIZE = 25;

export default function AdminCasesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<AdminCaseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { setPage(1); }, [status, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api.adminCases({page, pageSize: PAGE_SIZE, status: status || undefined, search: search || undefined})
      .then((result) => { if (!cancelled) { setItems(result.items); setTotal(result.total); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <main className="admin-page cases-page">
    <section className="panel"><header className="section-heading compact"><div><h1>תיקים</h1><p>כל תיקי הלקוחות במערכת, ללא תלות ביועץ.</p></div></header>
      <div className="client-toolbar">
        <label className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="חיפוש לפי מספר תיק או שם יועץ" placeholder="חיפוש לפי מספר תיק או שם יועץ" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      <div className="period-toggle" role="group" aria-label="סינון לפי סטטוס">{statusFilters.map((filter) => <button key={filter.value} type="button" className={filter.value === status ? "active" : ""} onClick={() => setSearchParams(filter.value ? {status: filter.value} : {})}>{filter.label}</button>)}</div>
    </section>

    <section className="panel">
      {loading ? <div className="empty-state">טוען תיקים…</div> : items.length === 0 ? <div className="empty-state">לא נמצאו תיקים התואמים את הסינון.</div> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>מספר תיק</th><th>לקוח</th><th>יועץ</th><th>נוצר</th><th>עודכן</th><th>סכום מבוקש</th><th>שווי נכס</th><th>מטרה</th><th>סטטוס</th><th>נשלח ל-</th><th>ענו</th><th>מעוניינות</th><th>Deadline</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id} className="clickable-row" onClick={() => navigate(`/admin/cases/${item.id}`)}>
          <td>{item.publicCaseNumber}</td>
          <td>{item.clientName}</td>
          <td>{item.advisorName}</td>
          <td>{formatDate(item.createdAt)}</td>
          <td>{formatDate(item.updatedAt)}</td>
          <td>{formatCurrency(item.requestedAmount)}</td>
          <td>{formatCurrency(item.propertyValue)}</td>
          <td>{formatDealType(item.purpose)}</td>
          <td>
            <span className={`status-badge status-${item.caseStage.toLowerCase()}`}>{caseStageLabels[item.caseStage] ?? formatClientStatus(item.caseStage)}</span>
            {item.readiness && (item.readiness.ready
              ? <span className="status-badge status-ready"><CheckCircle2 size={13} /> מוכן לשליחה</span>
              : <span className="status-badge status-warning">חסרים {item.readiness.blockerCount} פרטים/מסמכים</span>)}
          </td>
          <td>{item.submissionCount}</td>
          <td>{item.respondedCount}</td>
          <td>{item.interestedCount}</td>
          <td>{item.earliestDeadline ? formatDate(item.earliestDeadline) : "—"}</td>
        </tr>)}</tbody>
      </table></div>}
      {totalPages > 1 && <div className="pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronRight size={18} />הקודם</button><span>עמוד {page} מתוך {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>הבא<ChevronLeft size={18} /></button></div>}
    </section>
  </main>;
}
