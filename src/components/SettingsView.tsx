import React, { useState } from "react";
import { AdvisorProfile } from "../types";
import { 
  User, 
  Settings, 
  ShieldCheck, 
  HelpCircle, 
  Sparkles, 
  Info,
  CheckCircle2,
  Mail
} from "lucide-react";

interface SettingsViewProps {
  profile: AdvisorProfile;
  onUpdateProfile: (updated: AdvisorProfile) => void;
}

export default function SettingsView({ profile, onUpdateProfile }: SettingsViewProps) {
  const [profileForm, setProfileForm] = useState<AdvisorProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(profileForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto text-right">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight font-sans">
          הגדרות מערכת ופרופיל
        </h2>
        <p className="text-slate-400 font-medium mt-1.5">
          נהל את פרטי הקשר האישיים שלך, הצג את סטטוס מפתח ה-API ועיין בתנאי המנוע הייחודיים של SynCash.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Why is it free block */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-2 border-b border-slate-800/60 pb-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              למה הממשק חינמי?
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              מערכת <span className="font-extrabold text-white">SynCash</span> מסופקת בחינם לחלוטין ליועצי משכנתאות מורשים. 
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              אנו מתפרנסים מעמלות קישור והפניה המשולמות ישירות על ידי חברות המימון החוץ-בנקאיות (P2P וקרנות אשראי) עבור תיקים שנסגרים דרך המערכת. 
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              מבנה זה מבטיח כי האינטרסים שלנו ושלך תואמים לחלוטין: אנו עוזרים לך ליצור תחרות אדירה בין הקרנות, ובכך הלקוח שלך מקבל את הריבית הכי נמוכה והתנאים הכי טובים!
            </p>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-300 font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>מערכת SynCash מורשת 2026</span>
            </div>
          </div>

          {/* API key status */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-3 shadow-xl">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">סטטוס חיבור AI</h4>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-white">מנוע חיתום חכם (Gemini)</span>
              {profileForm.disableGemini ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                  כבוי / לא פעיל
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  מחובר ופעיל
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              {profileForm.disableGemini ? (
                "מנוע ה-AI כבוי בהגדרות שלך. הצעות החיתום וניסוח הבקשות יתבצעו לפי תבניות טקסט קבועות מראש."
              ) : (
                "החיבור ל-Gemini 3.5 Flash פעיל ומבצע כתיבה וניתוח אוטומטי של בקשות המימון בזמן אמת."
              )}
            </p>
          </div>
        </div>

        {/* Profile Settings form */}
        <div className="md:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
          <h4 className="text-lg font-bold text-white mb-6 border-b border-slate-800/60 pb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-cyan-400" />
            פרטי היועץ המקצועי
          </h4>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">שם מלא</label>
                <input 
                  type="text" 
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">תפקיד / תואר</label>
                <input 
                  type="text" 
                  value={profileForm.role}
                  onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">חברה / משרד</label>
                <input 
                  type="text" 
                  value={profileForm.company}
                  onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">מספר רישיון יועץ (אופציונלי)</label>
                <input 
                  type="text" 
                  value={profileForm.licenseNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, licenseNumber: e.target.value })}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">דואר אלקטרוני מקצועי</label>
                <input 
                  type="email" 
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">טלפון נייד</label>
                <input 
                  type="tel" 
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right font-medium"
                />
              </div>
            </div>

            {/* AI Underwriting Settings */}
            <div className="pt-5 mt-5 border-t border-slate-800/60 space-y-4">
              <h5 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-cyan-400" />
                מנוע חיתום חכם (Gemini AI)
              </h5>
              <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
                <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!profileForm.disableGemini}
                    onChange={(e) => setProfileForm({ ...profileForm, disableGemini: !e.target.checked })}
                    className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500 h-4 w-4 bg-slate-950"
                  />
                  <span>הפעל מנוע חיתום חכם (Gemini 3.5 Flash)</span>
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed pr-7 font-medium">
                  כאשר אפשרות זו פעילה, המערכת תשתמש בבינה מלאכותית (Gemini) כדי לנתח תיקי לקוחות, לייצר מכתבי אישור עקרוני וריביות מפורטים ולספק ייעוץ חכם. במידה ותכבה אותה, המערכת תשתמש בתבניות טקסט קבועות ופשוטות.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
              <button 
                type="submit"
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 shadow-[0_4px_12px_rgba(8,145,178,0.15)] cursor-pointer"
              >
                שמור שינויים
              </button>
              
              {saved && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-emerald-500/10" />
                  הפרטים נשמרו בהצלחה במערכת!
                </span>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
