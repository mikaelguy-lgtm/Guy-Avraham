import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Send, 
  Percent, 
  Coins, 
  Clock, 
  ArrowRight, 
  Landmark, 
  ShieldAlert,
  Sparkles
} from "lucide-react";

interface LenderPortalProps {
  refId: string;
  onClose: () => void;
}

interface CaseDetails {
  refId: string;
  clientId: string;
  lenderId: string;
  lenderName: string;
  anonymizedName: string;
  anonymizedId: string;
  dealType: string;
  propertyType: string;
  propertyCity: string;
  propertyStreet?: string;
  propertyValue: string;
  requestedAmount: string;
  financingPercentage: string;
  employmentType: string;
  workplace?: string;
  seniority: string;
  income: string;
  expenses: string;
  notes?: string;
  name?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  documents: Array<{ id: string; name: string; status: string }>;
  currentState?: {
    status: string;
    pitch?: string;
    reply?: string;
    offer?: {
      amount: string;
      rate: string;
      years: string;
    };
  };
}

export default function LenderPortal({ refId, onClose }: LenderPortalProps) {
  const [caseData, setCaseData] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [decision, setDecision] = useState<"offer" | "interested" | "not_interested">("offer");
  const [replyText, setReplyText] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerRate, setOfferRate] = useState("6.5");
  const [offerYears, setOfferYears] = useState("20");

  // Reveal Request State
  const [revealReason, setRevealReason] = useState("");
  const [requestingReveal, setRequestingReveal] = useState(false);

  const handleRequestReveal = async () => {
    try {
      setRequestingReveal(true);
      const res = await fetch(`/api/lenders/invite/${encodeURIComponent(refId)}/identity-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revealReason || "מבקש גישה לצורך אימות זהות ומסמכי מקור" })
      });
      if (!res.ok) {
        throw new Error("בקשת חשיפה נכשלה בשרת");
      }
      
      const detailsRes = await fetch(`/api/lenders/invite/${encodeURIComponent(refId)}`);
      if (detailsRes.ok) {
        const data = await detailsRes.json();
        setCaseData(data);
      }
      alert("בקשת חשיפת הזהות נשלחה בהצלחה ליועץ.");
    } catch (err: any) {
      alert(err.message || "אירעה שגיאה בשליחת הבקשה.");
    } finally {
      setRequestingReveal(false);
    }
  };

  useEffect(() => {
    const fetchCaseDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/lenders/invite/${encodeURIComponent(refId)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "שגיאה בטעינת נתוני התיק");
        }
        const data: CaseDetails = await res.json();
        setCaseData(data);
        
        // Populate default values from client requested terms
        setOfferAmount(data.requestedAmount);
        
        // Populate current response if already replied
        if (data.currentState) {
          if (data.currentState.status === "OFFER_RECEIVED") {
            setDecision("offer");
            if (data.currentState.offer) {
              setOfferAmount(data.currentState.offer.amount);
              setOfferRate(data.currentState.offer.rate);
              setOfferYears(data.currentState.offer.years);
            }
          } else if (data.currentState.status === "IN_REVIEW") {
            setDecision("interested");
          } else if (data.currentState.status === "DECLINED") {
            setDecision("not_interested");
          }
          
          if (data.currentState.reply && !data.currentState.reply.startsWith("הבקשה נשלחה")) {
            setReplyText(data.currentState.reply);
          }
        }
      } catch (err: any) {
        console.error("Failed to load lender case details", err);
        setError(err.message || "מזהה פנייה שגוי או שהפנייה הוסרה מהמערכת.");
      } finally {
        setLoading(false);
      }
    };

    fetchCaseDetails();
  }, [refId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData) return;

    try {
      setSubmitting(true);
      
      let url = `/api/lenders/invite/${encodeURIComponent(refId)}/reply`;
      let payload: any = {};
      
      if (decision === "offer") {
        url = `/api/lenders/invite/${encodeURIComponent(refId)}/offer`;
        payload = {
          amount: offerAmount,
          rate: offerRate,
          years: offerYears,
          notes: replyText.trim()
        };
      } else {
        payload = {
          decision: decision === "interested" ? "interested" : "declined",
          message: replyText.trim()
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "שגיאה בשמירת התגובה בשרת");
      }

      setSuccess(true);
    } catch (err: any) {
      alert(err.message || "אירעה שגיאה בשידור המענה.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-400">טוען תיק פנייה מאובטח...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 p-8 rounded-2xl text-center space-y-6">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">שגיאת אבטחה או גישה</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {error || "לא ניתן לגשת לתיק זה. ייתכן שהקישור פג תוקף, שונה, או שהתיק נמחק על ידי יועץ המשכנתאות המורשה."}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 md:p-8 flex flex-col items-center w-full">
      {/* Top Brand Banner */}
      <div className="max-w-6xl w-full flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-800 pb-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-500 text-white rounded-xl shadow-lg">
            <Landmark className="h-6 w-6" />
          </div>
          <div className="text-right">
            <h2 className="text-lg font-black text-white leading-tight flex items-center gap-1.5">
              <span>פורטל חתמים ושותפים</span>
              <span className="text-[9px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-md font-bold">SynCash Secured</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">ניהול וקבלת הצעות מימון אנונימיות למשכנתאות</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-bold text-slate-300 transition-colors cursor-pointer"
        >
          <span>יציאה מהפורטל</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {success ? (
        <div className="max-w-xl w-full bg-slate-900/40 border border-slate-800 p-8 rounded-2xl text-center space-y-6 my-auto shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-white">המענה התקבל ונשמר בהצלחה!</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              התשובה ופרטי ההצעה שלכם עודכנו בזמן אמת במערכת SynCash.
              יועץ המשכנתאות המנהל את התיק קיבל עדכון ישיר, ובמידה ויבחר לחשוף את זהות הלווה ומסמכיו המלאים - תינתן לכם גישה להורדתם לצורך סגירת התיק.
            </p>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-850 text-right space-y-2 text-xs font-mono">
            <p className="text-slate-400"><span className="font-bold text-slate-300">קוד סימוכין תיק:</span> {caseData.refId}</p>
            <p className="text-slate-400"><span className="font-bold text-slate-300">חברת מימון מגיבה:</span> {caseData.lenderName} ({caseData.lenderId})</p>
            <p className="text-slate-400">
              <span className="font-bold text-slate-300">סוג המענה:</span> {
                decision === "offer" ? "אישור עקרוני מפורט" : 
                decision === "interested" ? "הבעת עניין עקרונית" : "סירוב לתיק"
              }
            </p>
            {decision === "offer" && (
              <p className="text-emerald-400">
                <span className="font-bold text-slate-300">הצעה:</span> ₪{Number(offerAmount).toLocaleString()} בריבית {offerRate}% ל-{offerYears} שנים
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setSuccess(false)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              עדכון מענה קיים
            </button>
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              חזרה ליועץ
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-3 gap-8 text-right">
          
          {/* Main Case Info Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Security Alert Header */}
            <div className="bg-gradient-to-l from-cyan-950/20 to-blue-950/10 border border-cyan-800/30 p-4 rounded-xl flex items-start gap-3.5">
              <ShieldCheck className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white">בקשת אשראי מאובטחת ומסוננת אנונימית</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  הנתונים בתיק זה עברו אנונימיזציה מלאה של פרטי הלקוח ופרטי היועץ, על מנת לשמור על פרטיות הלווה ועסקת השותפות. מסמכי התיק מאומתים במלואם. בהגשת הצעה, התיק יסומן כמאושר עקרונית אצל היועץ.
                </p>
              </div>
            </div>

            {/* Quick Deal Stats Card */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-xl">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">סכום אשראי מבוקש</span>
                <span className="text-lg font-black text-white">₪{Number(caseData.requestedAmount).toLocaleString()}</span>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">שווי בטוחה משוער</span>
                <span className="text-lg font-black text-slate-200">₪{Number(caseData.propertyValue).toLocaleString()}</span>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-cyan-500/20 text-center ring-1 ring-cyan-500/10">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">יחס מימון מבוקש (LTV)</span>
                <span className="text-lg font-black text-cyan-400">{caseData.financingPercentage}%</span>
              </div>
            </div>

            {/* Structured Profile details */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>פרופיל עסקה ובטוחה מפורט</span>
                <FileText className="h-4.5 w-4.5 text-slate-500" />
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">שם הלווה:</span>
                  <span className="text-slate-200 font-bold">{caseData.name || caseData.anonymizedName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">תעודת זהות:</span>
                  <span className="font-mono text-slate-200 font-bold">{caseData.idNumber || caseData.anonymizedId}</span>
                </div>
                {caseData.phone && (
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-400 font-medium">טלפון ליצירת קשר:</span>
                    <span className="font-mono text-slate-200 font-bold">{caseData.phone}</span>
                  </div>
                )}
                {caseData.email && (
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-400 font-medium">דוא"ל:</span>
                    <span className="font-mono text-slate-200 font-bold">{caseData.email}</span>
                  </div>
                )}
                {caseData.address && (
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-400 font-medium">כתובת מגורים:</span>
                    <span className="text-slate-200 font-bold">{caseData.address}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">קוד פנייה אנונימי:</span>
                  <span className="font-mono text-slate-200 font-bold">{caseData.refId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">חברה פונה (לחתם):</span>
                  <span className="text-cyan-400 font-bold">{caseData.lenderName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">סוג העסקה:</span>
                  <span className="text-slate-200 font-bold">{caseData.dealType}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">סוג נכס/בטוחה:</span>
                  <span className="text-slate-200 font-bold">{caseData.propertyType}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">כתובת הנכס לשעבוד:</span>
                  <span className="text-slate-200 font-bold">{caseData.propertyCity} {caseData.propertyStreet || ""}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">מצב תעסוקתי:</span>
                  <span className="text-slate-200 font-bold">{caseData.employmentType} {caseData.workplace ? `(${caseData.workplace})` : ""}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">ותק מוכח:</span>
                  <span className="text-slate-200 font-bold">{caseData.seniority} שנים</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">הכנסה חודשית נטו:</span>
                  <span className="text-white font-bold">₪{Number(caseData.income).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                  <span className="text-slate-400 font-medium">הוצאות שוטפות והלוואות:</span>
                  <span className="text-slate-200 font-bold">₪{Number(caseData.expenses).toLocaleString()}</span>
                </div>
              </div>

              {caseData.notes && (
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-400">הסבר והערות יועץ המשכנתאות (Advisor Insight):</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">{caseData.notes}</p>
                </div>
              )}
            </div>

            {/* Reveal request block inside portal */}
            {!caseData.name && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl text-right">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                  <span>בקשת חשיפת זהות ומסמכי מקור</span>
                  <ShieldCheck className="h-4.5 w-4.5 text-cyan-400" />
                </h3>
                {caseData.currentState?.status === "IDENTITY_REQUESTED" ? (
                  <div className="p-4 bg-cyan-950/20 border border-cyan-800/30 rounded-xl text-center">
                    <p className="text-xs text-cyan-300 font-bold">נשלחה בקשת חשיפת זהות - ממתין לאישור יועץ המשכנתאות</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      אם הנך מעוניין להמשיך בתיק זה ולבחון את מסמכי המקור המקוריים או לבצע אימות זהות (PII), באפשרותך לבקש חשיפת זהות מיועץ המשכנתאות המורשה.
                    </p>
                    <textarea
                      rows={2}
                      value={revealReason}
                      onChange={(e) => setRevealReason(e.target.value)}
                      placeholder="הזן את סיבת הבקשה (לדוגמה: צורך באימות תלושים מול תעודת זהות)"
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500 resize-none text-right font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleRequestReveal}
                      disabled={requestingReveal}
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-850 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>{requestingReveal ? "שולח בקשה..." : "שלח בקשת חשיפת זהות"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Verification & Documents Checkbox list */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>מסמכי התיק המאומתים במערכת ({caseData.documents.length})</span>
                <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">מערכת SynCash אימתה</span>
              </h3>

              <div className="space-y-2 text-xs">
                {caseData.documents.map(d => (
                  <div key={d.id} className="flex justify-between items-center p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="h-4 w-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[9px]">✓</div>
                      <span className="text-slate-300 font-semibold">{d.name}</span>
                    </div>
                    {caseData.name ? (
                      <a
                        href={`/api/documents/download-by-token?token=${encodeURIComponent(refId)}&docId=${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>הורד קובץ מקור</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 rounded-md">
                        מאומת (לבקש חשיפה להורדה)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Action Form Column */}
          <div className="lg:col-span-1 space-y-6">
            
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl h-full">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white">שידור החלטה וריביות</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 text-right">
                
                {/* Decision options selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">סוג המענה ליועץ</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision("offer")}
                      className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                        decision === "offer"
                          ? "bg-cyan-950/20 border-cyan-500/80 ring-1 ring-cyan-500/30"
                          : "border-slate-800/80 hover:bg-slate-900/40 bg-slate-950/20"
                      }`}
                    >
                      <span className="text-xs font-bold text-white">הגש הצעת מימון (אישור עקרוני)</span>
                      <span className="text-[10px] text-slate-400">הגדר גובה הצעה, ריבית שנתית מתוכננת ושנות החזר</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision("interested")}
                      className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                        decision === "interested"
                          ? "bg-amber-950/20 border-amber-500/80 ring-1 ring-amber-500/30"
                          : "border-slate-800/80 hover:bg-slate-900/40 bg-slate-950/20"
                      }`}
                    >
                      <span className="text-xs font-bold text-white font-sans">הבעת עניין בלבד (ללא ריבית)</span>
                      <span className="text-[10px] text-slate-400">סמן את התיק כמעניין ופנה ליועץ לחשיפת מסמכים</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision("not_interested")}
                      className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                        decision === "not_interested"
                          ? "bg-red-950/20 border-red-500/80 ring-1 ring-red-500/30"
                          : "border-slate-800/80 hover:bg-slate-900/40 bg-slate-950/20"
                      }`}
                    >
                      <span className="text-xs font-bold text-white">סירוב לתיק / אי התאמה</span>
                      <span className="text-[10px] text-slate-400">סמן את הבקשה כאינה תואמת את מדיניות הקרן</span>
                    </button>
                  </div>
                </div>

                {/* Offer terms input - only if offer is selected */}
                {decision === "offer" && (
                  <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-850 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 justify-end">
                        <span>סכום הלוואה מאושר (₪)</span>
                        <Coins className="h-3.5 w-3.5 text-cyan-400" />
                      </label>
                      <input
                        type="number"
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-center text-white focus:ring-1 focus:ring-cyan-500"
                        placeholder="לדוגמה: 1500000"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 justify-end">
                        <span>ריבית שנתית מוצעת (%)</span>
                        <Percent className="h-3.5 w-3.5 text-cyan-400" />
                      </label>
                      <input
                        type="text"
                        value={offerRate}
                        onChange={(e) => setOfferRate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-center text-white focus:ring-1 focus:ring-cyan-500"
                        placeholder="6.5"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 justify-end">
                        <span>שנות החזר מוצעות</span>
                        <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      </label>
                      <input
                        type="number"
                        value={offerYears}
                        onChange={(e) => setOfferYears(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-center text-white focus:ring-1 focus:ring-cyan-500"
                        placeholder="20"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Reply comments message */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">הערות ומסר אישי ליועץ המשכנתאות</label>
                  <textarea
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500 resize-none text-right font-medium"
                    placeholder="הקלד כאן את הערות האשראי, דגשים על תנאי האישור או סיבות אי-ההתאמה..."
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? "משדר מענה..." : "שדר מענה רשמי ליועץ"}</span>
                </button>

              </form>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
