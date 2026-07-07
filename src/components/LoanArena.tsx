import React, { useState } from "react";
import { Client, LenderState } from "../types";
import { api } from "../utils/apiClient";
import { 
  Building2, 
  Send, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Mail, 
  FileCheck2, 
  HelpCircle, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Coins
} from "lucide-react";

interface LoanArenaProps {
  clients: Client[];
  initialSelectedClientId?: string;
  onRefreshClients: (silent?: boolean) => void;
}

// Full list of premium non-bank financing lenders in Israel
const ALL_LENDERS = [
  { id: "BTB", name: "BTB (בנקינג טו ביזנס)", description: "קרן חברתית להלוואות, מצוינת לעסקים, עצמאיים ורכישות מורכבות.", specialty: "עצמאיים ויזמות" },
  { id: "Tarya", name: "טריא (Tarya)", description: "פלטפורמת המימון ההמוני הגדולה בישראל. מעולה לגישורים וקבוצות רכישה.", specialty: "גישורים וקבוצות רכישה" },
  { id: "Peninsula", name: "פנינסולה (Peninsula)", description: "חברת אשראי ציבורית גדולה, מתמחה במימון נדל\"ן וקבוצות רוכשים.", specialty: "מימון יזמי וקבוצות" },
  { id: "Gamma", name: "גמא (Gamma)", description: "מקבוצת הפניקס, פתרונות מימון ומשכנתאות לנכסים מסחריים ויוקרה.", specialty: "מסחרי ונכסי יוקרה" },
  { id: "Clal", name: "כלל מימון (Clal)", description: "זרוע המימון החוץ-בנקאית של כלל ביטוח, אשראי רחב היקף.", specialty: "אחוזי מימון גבוהים" },
  { id: "Harel", name: "הראל אשראי (Harel)", description: "קרן חוב ומימון מבית הראל, מתמחה בפרויקטים ובטוחות מורכבות.", specialty: "תיקים מורכבים במיוחד" }
];

// Simple PMT mortgage calculator helper
// P = Principal (loan amount)
// r = Annual interest rate in percent
// n = Years
function calculateMonthlyPayment(P: number, r: number, n: number): number {
  if (!P || !r || !n) return 0;
  const monthlyRate = (r / 100) / 12;
  const numberOfPayments = n * 12;
  const x = Math.pow(1 + monthlyRate, numberOfPayments);
  const monthly = (P * monthlyRate * x) / (x - 1);
  return isNaN(monthly) ? 0 : Math.round(monthly);
}

export default function LoanArena({ clients, initialSelectedClientId, onRefreshClients }: LoanArenaProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>(initialSelectedClientId || clients[0]?.id || "");
  const [selectedLenders, setSelectedLenders] = useState<string[]>(["BTB", "Tarya"]);
  const [transmissionStep, setTransmissionStep] = useState<number>(0); // 0=idle, 1=analyzing, 2=drafting, 3=transmitting, 4=done
  const [currentLenderTab, setCurrentLenderTab] = useState<string>("");

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const toggleLender = (lenderId: string) => {
    setSelectedLenders(prev => 
      prev.includes(lenderId) 
        ? prev.filter(id => id !== lenderId)
        : [...prev, lenderId]
    );
  };

  const handleTransmit = async () => {
    if (!selectedClientId) return;
    if (selectedLenders.length === 0) {
      alert("אנא בחר לפחות חברת מימון אחת לשידור התיק.");
      return;
    }

    // Step 1: Start Visual Simulation of "Behind the scenes" transmission
    setTransmissionStep(1);
    
    // Simulate compilation
    setTimeout(() => {
      setTransmissionStep(2);
    }, 1500);

    // Simulate sending emails
    setTimeout(() => {
      setTransmissionStep(3);
    }, 3000);

    // Call unified api client logic to construct cover letters and replies!
    setTimeout(async () => {
      try {
        await api.sendToLenders(selectedClientId, selectedLenders);
        onRefreshClients(true);
        setTransmissionStep(4);
        // Set first sent lender as active tab to show response
        setCurrentLenderTab(selectedLenders[0]);
      } catch (error) {
        console.error("Transmission request failed", error);
        alert("שגיאה בשידור התיק לחברות המימון.");
        setTransmissionStep(0);
      }
    }, 4500);
  };

  const isTransmitting = transmissionStep > 0 && transmissionStep < 4;

  return (
    <div className="space-y-8 animate-fade-in text-right">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight font-sans">
          זירת הלוואות ושידור תיקים
        </h2>
        <p className="text-slate-400 font-medium mt-1.5">
          כאן תוכל לשדר בלחיצת כפתור אחת את תיק הלקוח והמסמכים המלאים לכל חברות החוץ-בנקאיות בארץ. המערכת תייצר תחרות ותגרום להן להילחם על התיק שלך!
        </p>
      </div>

      {/* Select Client Section */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 w-full lg:w-auto">
            <label className="block text-xs font-bold text-slate-300">בחר תיק לקוח לשידור והשוואה</label>
            <select 
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setTransmissionStep(0); // reset simulation state
              }}
              className="w-full lg:w-80 rounded-xl border border-slate-800 py-3 px-4 text-xs sm:text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 bg-slate-950/80 outline-none text-right"
            >
              <option value="" className="bg-slate-950">-- בחר לקוח --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-950 text-slate-200">
                  {c.name} ({c.dealType})
                </option>
              ))}
            </select>
          </div>

          {selectedClient && (
            <div className="flex flex-col items-center lg:items-end gap-2.5 w-full lg:w-auto">
              <div className="grid grid-cols-3 gap-6 text-xs sm:text-sm text-slate-300 font-semibold bg-slate-950/60 py-4 px-6 rounded-xl border border-slate-800/60 w-full lg:w-auto">
                <div className="text-center px-2">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">שווי נכס מוערך</p>
                  <p className="text-white font-extrabold mt-1 text-sm sm:text-base">₪{Number(selectedClient.propertyValue).toLocaleString()}</p>
                </div>
                <div className="border-r border-slate-800/80 h-full self-center"></div>
                <div className="text-center px-2">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">סכום הלוואה מבוקש</p>
                  <p className="text-white font-extrabold mt-1 text-sm sm:text-base">₪{Number(selectedClient.requestedAmount).toLocaleString()}</p>
                </div>
                <div className="border-r border-slate-800/80 h-full self-center"></div>
                <div className="text-center px-2">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">אחוז מימון מבוקש</p>
                  <p className="text-cyan-400 font-black mt-1 text-sm sm:text-base">{selectedClient.financingPercentage}%</p>
                </div>
              </div>
              {selectedClient.propertyCity && (
                <div className="text-[11px] text-slate-400 bg-slate-950/30 px-3.5 py-1.5 rounded-lg border border-slate-800/50 font-semibold self-center lg:self-end">
                  כתובת הנכס לשעבוד: <span className="text-slate-200">{selectedClient.propertyCity}{selectedClient.propertyStreet ? `, ${selectedClient.propertyStreet}` : ""}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedClient ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Right Column: Setup transmission */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-6 lg:col-span-1 h-fit shadow-xl">
            <h4 className="text-base font-extrabold text-white border-b border-slate-800/60 pb-3 flex items-center justify-between">
              <span>הגדרת שידור אלקטרוני</span>
              <Sparkles className="h-4.5 w-4.5 text-cyan-400" />
            </h4>

            {/* Check document compliance */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-300">
                <FileCheck2 className="h-4 w-4 text-cyan-400" />
                <span>מוכנות מסמכי חובה לתיק</span>
              </div>
              <div className="space-y-2 text-xs text-slate-400">
                {selectedClient.documents.map(d => (
                  <div key={d.id} className="flex justify-between items-center border-b border-slate-900/50 pb-1.5 last:border-0 last:pb-0">
                    <span>{d.name}</span>
                    <span className={d.status === "uploaded" ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>
                      {d.status === "uploaded" ? "הועלה ✓" : "חסר מסמך ⚠"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Choose Lenders */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">בחר חברות מימון לשידור ({selectedLenders.length})</label>
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {ALL_LENDERS.map(lender => {
                  const isChecked = selectedLenders.includes(lender.id);
                  const isSent = selectedClient.lendersState[lender.id]?.status !== "not_sent" && selectedClient.lendersState[lender.id] !== undefined;

                  return (
                    <div 
                      key={lender.id}
                      onClick={() => toggleLender(lender.id)}
                      className={`p-3.5 rounded-xl border text-right cursor-pointer transition-all ${
                        isChecked 
                          ? "bg-cyan-950/20 border-cyan-500/80 ring-1 ring-cyan-500/30" 
                          : "border-slate-800/80 hover:border-slate-700 bg-slate-950/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by div click
                            className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer bg-slate-950"
                          />
                          <span className="font-bold text-xs sm:text-sm text-white">{lender.name}</span>
                        </div>
                        <span className="text-[9px] bg-slate-800 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-slate-700/60">
                          {lender.specialty}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 mr-6 leading-relaxed font-medium">{lender.description}</p>
                      {isSent && (
                        <div className="mr-6 mt-1.5 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 fill-emerald-500/10" />
                          <span>תיק משודר לחברה זו</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TRANSMIT TRIGGER BUTTON */}
            <div>
              {isTransmitting ? (
                <div className="w-full bg-cyan-950/20 border border-cyan-800/30 p-5 rounded-xl text-center space-y-3 shadow-inner">
                  <div className="h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="font-bold text-xs sm:text-sm text-cyan-400 animate-pulse leading-relaxed">
                    {transmissionStep === 1 ? "מנתח את נתוני התיק וכושר ההחזר..." :
                     transmissionStep === 2 ? "ה-AI מנסח פנייה חכמה ומקצועית לחברות..." :
                     "משדר קבצים במייל מאחורי הקלעים וממתין לחתמים..."}
                  </p>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-1000"
                      style={{ width: `${transmissionStep * 25}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleTransmit}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex justify-center items-center gap-2 shadow-lg transition-all active:scale-95 shadow-[0_4px_15px_rgba(8,145,178,0.25)] cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  שידור התיק לכל חברות המימון
                </button>
              )}
              <p className="text-[10px] text-slate-500 text-center mt-2.5 font-semibold">
                * השידור נשלח אלקטרונית ישירות לתיבת המייל המאובטחת של החתמים בקרנות.
              </p>
            </div>
          </div>

          {/* Left Column: Results or Empty state */}
          <div className="lg:col-span-2 space-y-6">
            {selectedClient.status === "sent" || selectedClient.status === "closed" ? (
              <div className="space-y-6 animate-fade-in">
                
                {/* Side-by-side comparative table */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-400" />
                    השוואת הצעות מימון (זירת התחרות)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {ALL_LENDERS.filter(l => selectedClient.lendersState[l.id]?.status === "offer_received").map(lender => {
                      const state = selectedClient.lendersState[lender.id];
                      const monthlyPayment = calculateMonthlyPayment(
                        parseFloat(state.offer?.amount || "0"),
                        parseFloat(state.offer?.rate || "0"),
                        parseFloat(state.offer?.years || "20")
                      );

                      return (
                        <div key={lender.id} className="bg-slate-950/60 border-2 border-slate-800 hover:border-cyan-500/50 p-5 rounded-xl transition-all relative overflow-hidden">
                          <div className="absolute top-0 left-0 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold py-1 px-3.5 rounded-br-xl border-r border-b border-emerald-500/20">
                            התקבלה הצעה!
                          </div>
                          
                          <div className="flex items-center gap-2.5 mb-3 pt-2">
                            <Building2 className="h-5 w-5 text-slate-400" />
                            <h5 className="font-extrabold text-white text-sm sm:text-base">{lender.name}</h5>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 text-center">
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">סכום מאושר</p>
                              <p className="text-xs sm:text-sm font-black text-white mt-0.5">
                                ₪{Number(state.offer?.amount).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">ריבית שנתית</p>
                              <p className="text-xs sm:text-sm font-black text-emerald-400 mt-0.5">
                                {state.offer?.rate}%
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">תקופה</p>
                              <p className="text-xs sm:text-sm font-black text-white mt-0.5">
                                {state.offer?.years} שנים
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-3.5">
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold">החזר חודשי משוער</p>
                              <p className="text-sm sm:text-base font-black text-cyan-400">
                                ₪{monthlyPayment.toLocaleString()} בחודש
                              </p>
                            </div>

                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => alert("ההצעה אושרה בהצלחה! מייל אישור נשלח לחברת המימון לגיבוש מסמכי ההלוואה המלאים.")}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                אישור הצעה
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cover letter & Lenders detail tab */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
                  {/* Tabs headers */}
                  <div className="bg-slate-950/60 border-b border-slate-800/80 flex overflow-x-auto">
                    <button 
                      onClick={() => setCurrentLenderTab("")}
                      className={`px-5 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                        currentLenderTab === "" 
                          ? "border-cyan-500 text-cyan-400 bg-slate-900/20" 
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      ✉ מכתב הפנייה (Cover Pitch)
                    </button>
                    {ALL_LENDERS.filter(l => selectedClient.lendersState[l.id]?.status !== "not_sent" && selectedClient.lendersState[l.id] !== undefined).map(lender => {
                      const state = selectedClient.lendersState[lender.id];
                      return (
                        <button
                          key={lender.id}
                          onClick={() => setCurrentLenderTab(lender.id)}
                          className={`px-5 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                            currentLenderTab === lender.id 
                              ? "border-cyan-500 text-cyan-400 bg-slate-900/20" 
                              : "border-transparent text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <Building2 className="h-4 w-4 text-slate-400" />
                          {lender.name}
                          {state.status === "offer_received" && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab Body */}
                  <div className="p-6">
                    {currentLenderTab === "" ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800/40">
                          <h5 className="font-bold text-white text-sm sm:text-base">מכתב הפנייה המקצועי שנוצר על ידי AI</h5>
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-300 font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-cyan-500/20">
                            <Sparkles className="h-3 w-3 text-cyan-400 fill-cyan-400/10" />
                            מנוסח ומשופר ב-AI
                          </span>
                        </div>
                        {/* Render the generated pitch text beautifully */}
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-medium max-h-[350px] overflow-y-auto">
                          {selectedClient.lendersState[Object.keys(selectedClient.lendersState)[0]]?.pitch || "פניית אשראי חוץ-בנקאית מפורטת למשכנתא."}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                          <div>
                            <h5 className="font-bold text-white text-sm sm:text-base">
                              תשובת חברת המימון: {ALL_LENDERS.find(l => l.id === currentLenderTab)?.name}
                            </h5>
                            <p className="text-xs text-slate-500 mt-0.5">
                              התקבל במייל חוזר מאובטח דרך שרת SynCash.
                            </p>
                          </div>
                          
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                            selectedClient.lendersState[currentLenderTab]?.status === "offer_received" 
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          }`}>
                            {selectedClient.lendersState[currentLenderTab]?.status === "offer_received" ? "התקבלה הצעה רשמית" : "בבחינת חתם"}
                          </span>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                          {selectedClient.lendersState[currentLenderTab]?.reply}
                        </div>

                        {selectedClient.lendersState[currentLenderTab]?.offer && (
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                            <h6 className="font-bold text-emerald-400 text-xs sm:text-sm mb-2.5">סיכום מסחרי של ההצעה:</h6>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-300">
                              <p className="flex items-center gap-1.5"><span className="text-slate-500">סכום מאושר:</span> <span className="font-bold text-white">₪{Number(selectedClient.lendersState[currentLenderTab].offer?.amount).toLocaleString()}</span></p>
                              <p className="flex items-center gap-1.5"><span className="text-slate-500">ריבית שנתית:</span> <span className="font-bold text-emerald-400">{selectedClient.lendersState[currentLenderTab].offer?.rate}%</span></p>
                              <p className="flex items-center gap-1.5"><span className="text-slate-500">תקופת הלוואה:</span> <span className="font-bold text-white">{selectedClient.lendersState[currentLenderTab].offer?.years} שנים</span></p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
                <Mail className="h-12 w-12 text-slate-600 animate-pulse" />
                <h5 className="font-extrabold text-white text-base sm:text-lg">תיק זה טרם שודר לחברות מימון</h5>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  סמן את חברות המימון הרלוונטיות עבור <span className="text-white font-bold">{selectedClient.name}</span> מצד ימין, ולחץ על כפתור "שידור התיק" כדי להתחיל לקבל הצעות תחרותיות בזמן אמת!
                </p>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-16 text-center text-slate-500 space-y-3.5 shadow-xl">
          <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-1 animate-pulse" />
          <p className="font-bold text-slate-300 text-base sm:text-lg">לא נבחר תיק לקוח</p>
          <p className="text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">אנא בחר תיק לקוח מהתפריט העליון על מנת להכין שידור ולקבל הצעות מחברות המימון.</p>
        </div>
      )}

    </div>
  );
}
