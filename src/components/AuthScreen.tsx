import React, { useState } from "react";
import { Sparkles, Key, Mail, User, Shield, Briefcase, Phone, Award, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { AdvisorProfile } from "../types";
import SynCashLogo from "./SynCashLogo";

interface AuthScreenProps {
  onLoginSuccess: (advisor: AdvisorProfile & { id: string; isAdmin?: boolean }) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("יועץ משכנתאות");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = isLogin ? "/api/advisors/login" : "/api/advisors/register";
    const body = isLogin 
      ? { email, password }
      : { name, role, email, phone, company, licenseNumber, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        onLoginSuccess(data);
      } else {
        setError(data.error || "אירעה שגיאה בביצוע הפעולה");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("שגיאה בחיבור לשרת. נא לנסות שנית.");
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setEmail("admin@syncash.co.il");
    setPassword("admin123");
    setIsLogin(true);
  };

  const handleFillDemoAdvisor = () => {
    setEmail("david.c@syncash.co.il");
    setPassword("123456"); // SynCash default or we can register david on the fly
    setIsLogin(true);
    // Since David is pre-registered, let's write David's email and register him with pass if it fails.
    // Actually, David's email doesn't have a default password set on backend (it was hardcoded state),
    // but the backend uses loadAdvisors which populates DEFAULT_ADVISORS without password. 
    // If we want a demo advisor, we can easily register one or log in as admin! Let's register david.c with "123456" dynamically if needed or show how to register.
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative px-4 py-12 antialiased text-slate-100 overflow-hidden font-sans">
      
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-lg z-10 transition-all duration-300">
        
        {/* Brand Logo and Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-bold text-amber-400 mb-6 shadow-sm">
            <Sparkles className="h-4 w-4 text-amber-400 fill-amber-500/10 animate-pulse" />
            <span>שער ההתחברות והרישום ליועצים • SynCash</span>
          </div>
          
          <SynCashLogo size="lg" showSubtitle={false} showText={true} className="mb-2" />
          
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 mt-3 border-y border-amber-500/20 py-2 w-full max-w-sm tracking-wide">
            "המקום שבו עסקאות טובות מתחילות"
          </h2>
          
          <p className="text-slate-400 font-medium text-xs sm:text-sm mt-3.5 max-w-md mx-auto leading-relaxed">
            פלטפורמה חדשנית המחברת בין יועצי משכנתאות לבין גופי מימון חוץ בנקאים - בצורה חכמה, מדויקת ורווחית.
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden">
          
          {/* Glassmorphic overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setError(null);
              }}
              className={`py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                isLogin 
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="h-4 w-4" />
              התחברות יועץ
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError(null);
              }}
              className={`py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                !isLogin 
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              רישום יועץ חדש
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm font-bold leading-relaxed text-right flex items-start gap-2.5">
              <span className="mt-0.5">⚠️</span>
              <p className="flex-1">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-right">
            
            {/* Common field: Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">כתובת אימייל</label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.co.il"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-left"
                />
              </div>
            </div>

            {/* Registration-only Fields */}
            {!isLogin && (
              <>
                {/* Full Name */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-300">שם מלא</label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ישראל ישראלי"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    />
                  </div>
                </div>

                {/* Role / Job Title */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-300">תפקיד / הגדרה מקצועית</label>
                  <div className="relative">
                    <Briefcase className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="יועץ משכנתאות בכיר"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-300">מספר טלפון נייד</label>
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="050-1234567"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-left"
                    />
                  </div>
                </div>

                {/* Company Name */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-300">שם החברה / משרד</label>
                  <div className="relative">
                    <Shield className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="כהן פתרונות משכנתא בע''מ"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    />
                  </div>
                </div>

                {/* License / Certificate Number */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-300">מספר רישיון יועץ (אופציונלי)</label>
                  <div className="relative">
                    <Award className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="MC-XXXXX"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-left"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">סיסמה מאובטחת</label>
              <div className="relative">
                <Key className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pr-10 pl-11 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-2.5 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-[0_4px_15px_rgba(8,145,178,0.25)] hover:scale-[1.01] active:scale-[0.99] disabled:bg-slate-800 disabled:text-slate-600 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isLogin ? (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>התחבר למערכת</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>צור חשבון והתחל עבודה</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Access Helper Notes for Developers/Reviewers */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">משתמשי הדגמה לבחינה מהירה:</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={handleFillDemoAdmin}
                className="px-3.5 py-1.5 rounded-lg bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 font-bold text-[10px] transition-all flex items-center justify-center gap-1.5"
              >
                <Shield className="h-3 w-3" />
                חיבור מהיר כאדמין (ADMIN)
              </button>
              <button
                onClick={handleFillDemoAdvisor}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-900/30 text-cyan-400 font-bold text-[10px] transition-all flex items-center justify-center gap-1.5"
              >
                <User className="h-3 w-3" />
                יועץ דוגמה: דוד כהן
              </button>
            </div>
            {email === "david.c@syncash.co.il" && (
              <p className="text-[10px] text-emerald-400 mt-2 animate-pulse font-medium">
                * דוד כהן יועץ משכנתאות מוגדר כברירת מחדל. אם טרם יצרת לו סיסמה, תוכל להירשם איתו כחדש או להשתמש ב-ADMIN!
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
