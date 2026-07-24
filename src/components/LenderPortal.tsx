import { useEffect, useState } from "react";
import type { CurrentUser } from "../types";
import { api } from "../utils/apiClient";
import type { AnonymousSubmissionSnapshot } from "../domain/types";
import { snapshotDisplayEntries } from "../utils/snapshotDisplay";
import AuthScreen from "./AuthScreen";

export default function LenderPortal({token, user, onAuthenticated}: {token: string; user: CurrentUser | null; onAuthenticated: (user: CurrentUser) => void}) {
  const [lenderName, setLenderName] = useState("");
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [revealedData, setRevealedData] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => { api.validateInvite(token).then((result) => setLenderName(result.lenderName)).catch((caught) => setError(caught instanceof Error ? caught.message : "INVITE_INVALID")); }, [token]);
  useEffect(() => { if (!user) return; api.consumeInvite(token).then(async (result) => {setSubmissionId(result.submissionId); setSnapshot((await api.lenderSubmission(result.submissionId)).anonymousSnapshot);}).catch(async () => {
    try { const existing = await api.lenderSubmissions(); if (existing[0]) {setSubmissionId(existing[0].id); setSnapshot(existing[0].anonymousSnapshot);} }
    catch (caught) { setError(caught instanceof Error ? caught.message : "INVITE_CONSUME_FAILED"); }
  }); }, [token, user]);
  if (!user) return <><div className="invite-heading" dir="rtl"><h1>{lenderName || "הזמנה מאובטחת"}</h1>{error && <p className="error">{error}</p>}</div><AuthScreen onAuthenticated={onAuthenticated} /></>;
  if (!snapshot || !submissionId) return <main className="auth-shell"><div className="panel">טוען תיק… {error}</div></main>;
  return <main className="portal" dir="rtl"><section className="panel"><h1>תיק מימון אנונימי</h1><dl>{snapshotDisplayEntries(snapshot as unknown as AnonymousSubmissionSnapshot).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className="panel"><h2>בקשת חשיפה</h2><button onClick={() => void api.identityRequest(submissionId, "נדרש לצורך בדיקת החיתום והכנת הצעה", ["FULL_NAME", "PHONE"])}>בקשת שם וטלפון</button><button onClick={() => void api.revealedData(submissionId).then((result) => setRevealedData(result.data)).catch((caught) => setError(caught instanceof Error ? caught.message : "NOT_APPROVED"))}>רענון מידע מאושר</button>{Object.keys(revealedData).length > 0 && <dl>{Object.entries(revealedData).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}</section>
    <section className="panel"><h2>הצעת מימון</h2><button onClick={() => void api.createOffer(submissionId, {amount: snapshot.requestedAmount, interestRate: 6.5, termMonths: 240, conditions: "כפוף לאימות מסמכים"})}>הגשת הצעה</button></section>
  </main>;
}
