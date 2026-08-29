import {useCallback, useEffect, useState} from "react";
import {Building2, CheckCircle2, Clock3, Phone, User, XCircle} from "lucide-react";
import type {CompanyResponse} from "../types";
import {api, subscribeDeliveryEvents} from "../utils/apiClient";
import {formatDate} from "../utils/formatters";

const decisionLabel: Record<string, string> = {INTERESTED: "מעוניינת", NOT_INTERESTED: "לא מעוניינת"};

function ResponseCard({item}: {item: CompanyResponse}) {
  return <article className={`response-card decision-${item.decisionStatus.toLowerCase()}`}>
    <header>
      <span className="lender-logo"><Building2 /></span>
      <div>
        <h3>{item.companyName}</h3>
        {item.decisionAt && <time className="response-decision-time" dateTime={item.decisionAt}><Clock3 size={14} aria-hidden="true" />{formatDate(item.decisionAt)}</time>}
      </div>
      <span className={`status-badge decision-${item.decisionStatus.toLowerCase()}`}>{decisionLabel[item.decisionStatus]}</span>
    </header>
    {item.decisionContact && <dl>
      <div><dt><User size={14} aria-hidden="true" />איש קשר</dt><dd>{item.decisionContact.name}</dd></div>
      {item.decisionContact.phone && <div><dt><Phone size={14} aria-hidden="true" />טלפון</dt><dd dir="ltr">{item.decisionContact.phone}</dd></div>}
    </dl>}
  </article>;
}

export default function CompanyResponsesView({clientId}: {clientId: number}) {
  const [items, setItems] = useState<CompanyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setItems(await api.companyResponses(clientId)); setError(""); }
    catch { setError("לא ניתן לטעון את תגובות חברות המימון."); }
    finally { setLoading(false); }
  }, [clientId]);
  useEffect(() => {void load();}, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void subscribeDeliveryEvents(controller.signal, () => void load()).catch(() => undefined);
    return () => controller.abort();
  }, [load]);
  if (loading) return <div className="empty-state">טוען תגובות חברות…</div>;
  const interested = items.filter((item) => item.decisionStatus === "INTERESTED");
  const notInterested = items.filter((item) => item.decisionStatus === "NOT_INTERESTED");
  const pendingCount = items.length - interested.length - notInterested.length;
  return <div className="detail-section company-responses">
    <header className="section-heading compact"><div><h2>תגובות חברות מימון</h2><p>לאחר שחברת מימון מקבלת החלטה היא תוצג כאן. שם החברה אינו נחשף לפני קבלת החלטה.</p></div></header>
    {error && <p className="form-message error" role="alert">{error}</p>}
    {!items.length ? <div className="empty-state"><Building2 /><h3>טרם נשלח תיק לחברות מימון</h3><p>לאחר השליחה תופיע כאן התקדמות ההחלטות בזמן אמת.</p></div> : <>
      {pendingCount > 0 && <article className="response-pending-card"><Clock3 aria-hidden="true" /><div><strong>{pendingCount}</strong><span>{pendingCount === 1 ? "חברת מימון טרם השיבה" : "חברות מימון טרם השיבו"}</span></div></article>}
      <section className="response-group">
        <h3 className="response-group-heading interested"><CheckCircle2 size={19} aria-hidden="true" />חברות שמעוניינות<span className="response-group-count">{interested.length}</span></h3>
        {interested.length === 0 ? <p className="empty-inline">אין עדיין חברות מעוניינות.</p> : <div className="response-card-grid">{interested.map((item) => <ResponseCard item={item} key={item.publicId} />)}</div>}
      </section>
      <section className="response-group">
        <h3 className="response-group-heading not-interested"><XCircle size={19} aria-hidden="true" />חברות שאינן מעוניינות<span className="response-group-count">{notInterested.length}</span></h3>
        {notInterested.length === 0 ? <p className="empty-inline">אין עדיין חברות שהשיבו שאינן מעוניינות.</p> : <div className="response-card-grid">{notInterested.map((item) => <ResponseCard item={item} key={item.publicId} />)}</div>}
      </section>
    </>}
  </div>;
}
