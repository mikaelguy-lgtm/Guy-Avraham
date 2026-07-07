import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Info } from "lucide-react";

interface NewClientWizardProps {
  onClientCreated: () => void;
  advisorId?: string;
}

export default function NewClientWizard({ onClientCreated, advisorId }: NewClientWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    idNumber: "",
    email: "",
    phone: "",
    address: "",
    maritalStatus: "",
    childrenCount: "",
    childrenAges: "",
    employmentType: "שכיר",
    employmentTypeOther: "",
    seniority: "",
    income: "",
    workplace: "",
    additionalIncomeType: "",
    additionalIncomeAmount: "",
    expenses: "0",
    expensesLoans: "",
    expensesMortgage: "",
    expensesMortgageBalance: "",
    dealType: "רכישה מקבלן",
    propertyType: "דירה ראשונה",
    propertyValue: "",
    requestedAmount: "",
    financingPercentage: "60",
    notes: ""
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Auto-calculate financing percentage when requestedAmount or propertyValue changes
  useEffect(() => {
    const val = parseFloat(formData.propertyValue);
    const req = parseFloat(formData.requestedAmount);
    if (val > 0 && req > 0) {
      const percentage = Math.round((req / val) * 100);
      setFormData(prev => ({ ...prev, financingPercentage: Math.min(percentage, 100).toString() }));
    }
  }, [formData.propertyValue, formData.requestedAmount]);

  // Auto-calculate total expenses as the sum of loan repayments and mortgage repayments
  useEffect(() => {
    const loans = parseFloat(formData.expensesLoans) || 0;
    const mortgage = parseFloat(formData.expensesMortgage) || 0;
    const total = loans + mortgage;
    setFormData(prev => ({ ...prev, expenses: total.toString() }));
  }, [formData.expensesLoans, formData.expensesMortgage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validateStep = (step: number) => {
    const stepErrors: { [key: string]: string } = {};

    if (step === 1) {
      if (!formData.name) stepErrors.name = "שדה שם מלא הוא חובה";
      if (!formData.idNumber) {
        stepErrors.idNumber = "שדה מספר זהות הוא חובה";
      } else if (!/^\d{9}$/.test(formData.idNumber)) {
        stepErrors.idNumber = "תעודת זהות חייבת להכיל 9 ספרות בדיוק";
      }
      if (!formData.email) {
        stepErrors.email = "שדה דואר אלקטרוני הוא חובה";
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        stepErrors.email = "כתובת דואר אלקטרוני לא תקינה";
      }
      if (!formData.phone) {
        stepErrors.phone = "שדה טלפון נייד הוא חובה";
      }
      if (!formData.address) stepErrors.address = "שדה כתובת מגורים הוא חובה";
      if (!formData.maritalStatus) stepErrors.maritalStatus = "שדה מצב משפחתי הוא חובה";
      if (formData.childrenCount === "" || formData.childrenCount === undefined) {
        stepErrors.childrenCount = "שדה מספר ילדים הוא חובה";
      }
      if (!formData.childrenAges) {
        stepErrors.childrenAges = "שדה גילאי הילדים הוא חובה";
      }
    } else if (step === 2) {
      if (!formData.seniority) stepErrors.seniority = "אנא הזן ותק במקום העבודה";
      if (!formData.income) stepErrors.income = "אנא הזן הכנסה חודשית נטו";
      if (!formData.workplace) stepErrors.workplace = "אנא הזן מקום עבודה";
      if (formData.employmentType === "אחר" && !formData.employmentTypeOther) {
        stepErrors.employmentTypeOther = "אנא הזן פירוט מצב תעסוקתי";
      }
      if (!formData.additionalIncomeType) stepErrors.additionalIncomeType = "אנא הזן סוג הכנסה נוספת";
      if (formData.additionalIncomeAmount === "" || formData.additionalIncomeAmount === undefined) {
        stepErrors.additionalIncomeAmount = "אנא הזן סכום הכנסה נוספת";
      }
      if (formData.expensesLoans === "" || formData.expensesLoans === undefined) {
        stepErrors.expensesLoans = "אנא הזן החזר הלוואות חודשי";
      }
      if (formData.expensesMortgage === "" || formData.expensesMortgage === undefined) {
        stepErrors.expensesMortgage = "אנא הזן החזר משכנתא חודשי";
      }
      if (formData.expensesMortgageBalance === "" || formData.expensesMortgageBalance === undefined) {
        stepErrors.expensesMortgageBalance = "אנא הזן יתרת משכנתא";
      }
    } else if (step === 3) {
      if (!formData.propertyType) stepErrors.propertyType = "אנא בחר סוג נכס";
      if (!formData.propertyValue) stepErrors.propertyValue = "אנא הזן שווי נכס מוערך";
      if (!formData.requestedAmount) stepErrors.requestedAmount = "אנא הזן סכום הלוואה מבוקש";
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleStepNodeClick = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    } else if (step > currentStep) {
      // Validate all steps leading up to the target step
      let isValid = true;
      for (let s = currentStep; s < step; s++) {
        if (!validateStep(s)) {
          isValid = false;
          break;
        }
      }
      if (isValid) {
        setCurrentStep(step);
      }
    }
  };

  const handleFinish = async () => {
    if (!validateStep(3)) return;

    try {
      const finalPayload = {
        ...formData,
        employmentType: formData.employmentType === "אחר" ? formData.employmentTypeOther : formData.employmentType,
        advisorId: advisorId || "advisor-1"
      };

      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload)
      });
      if (response.ok) {
        alert("הלקוח נוסף למערכת בהצלחה! כעת תוכל לנהל את מסמכיו ולשדר את התיק.");
        onClientCreated();
      } else {
        alert("שגיאה בשמירת הלקוח במערכת.");
      }
    } catch (error) {
      console.error("Error creating client", error);
      alert("שגיאה ברשת. לא ניתן לשמור את הלקוח.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full animate-fade-in">
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-white font-sans mb-2">צירוף לקוח חדש</h2>
        <p className="text-slate-400 font-medium text-base">מלא את פרטי הלקוח כדי להתחיל בתהליך בקשת המשכנתא במערכת.</p>
      </div>

      {/* Stepper Display */}
      <div className="flex justify-between items-center mb-10 relative px-8">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -translate-y-1/2 z-0"></div>
        
        {/* Step 1 Node */}
        <div 
          className="relative z-10 flex flex-col items-center gap-2 cursor-pointer group" 
          onClick={() => handleStepNodeClick(1)}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${
            currentStep === 1 
              ? "bg-cyan-600 text-white ring-4 ring-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
              : currentStep > 1 
                ? "bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]" 
                : "bg-slate-800 text-slate-400 border border-slate-700/60"
          }`}>
            {currentStep > 1 ? "✓" : "1"}
          </div>
          <span className={`text-xs font-bold transition-all ${currentStep === 1 ? "text-cyan-400" : "text-slate-400"}`}>
            פרטים אישיים
          </span>
        </div>

        {/* Step 2 Node */}
        <div 
          className="relative z-10 flex flex-col items-center gap-2 cursor-pointer group" 
          onClick={() => handleStepNodeClick(2)}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${
            currentStep === 2 
              ? "bg-cyan-600 text-white ring-4 ring-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
              : currentStep > 2 
                ? "bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]" 
                : "bg-slate-800 text-slate-400 border border-slate-700/60"
          }`}>
            {currentStep > 2 ? "✓" : "2"}
          </div>
          <span className={`text-xs font-bold transition-all ${currentStep === 2 ? "text-cyan-400" : "text-slate-400"}`}>
            תעסוקה והכנסה
          </span>
        </div>

        {/* Step 3 Node */}
        <div 
          className="relative z-10 flex flex-col items-center gap-2 cursor-pointer group" 
          onClick={() => handleStepNodeClick(3)}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${
            currentStep === 3 
              ? "bg-cyan-600 text-white ring-4 ring-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
              : "bg-slate-800 text-slate-400 border border-slate-700/60"
          }`}>
            3
          </div>
          <span className={`text-xs font-bold transition-all ${currentStep === 3 ? "text-cyan-400" : "text-slate-400"}`}>
            נכס ובקשה
          </span>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-xl p-8 shadow-lg">
        
        {/* Step 1 Content: Personal Details */}
        {currentStep === 1 && (
          <div className="step-transition space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">שם מלא</label>
                <input 
                  type="text"
                  name="name"
                  placeholder="לדוגמה: ישראל ישראלי"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.name ? "border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.name && <p className="text-xs text-red-400 font-semibold">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">מספר זהות</label>
                <input 
                  type="text"
                  name="idNumber"
                  placeholder="9 ספרות"
                  value={formData.idNumber}
                  onChange={handleChange}
                  maxLength={9}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.idNumber ? "border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.idNumber && <p className="text-xs text-red-400 font-semibold">{errors.idNumber}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">דואר אלקטרוני</label>
                <input 
                  type="email"
                  name="email"
                  placeholder="example@mail.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.email ? "border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.email && <p className="text-xs text-red-400 font-semibold">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">טלפון נייד</label>
                <input 
                  type="tel"
                  name="phone"
                  placeholder="050-0000000"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.phone ? "border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.phone && <p className="text-xs text-red-400 font-semibold">{errors.phone}</p>}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-sm font-bold text-slate-300">כתובת מגורים</label>
                <input 
                  type="text"
                  name="address"
                  placeholder="רחוב, מספר בית, עיר"
                  value={formData.address}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.address ? "border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.address && <p className="text-xs text-red-400 font-semibold">{errors.address}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">מצב משפחתי *</label>
                <select 
                  name="maritalStatus"
                  value={formData.maritalStatus}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.maritalStatus ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                >
                  <option value="" className="bg-slate-950">בחר מצב משפחתי</option>
                  <option value="רווק/ה" className="bg-slate-950">רווק/ה</option>
                  <option value="נשוי/ה" className="bg-slate-950">נשוי/ה</option>
                  <option value="גרוש/ה" className="bg-slate-950">גרוש/ה</option>
                  <option value="אלמן/ה" className="bg-slate-950">אלמן/ה</option>
                  <option value="אחר" className="bg-slate-950">אחר</option>
                </select>
                {errors.maritalStatus && <p className="text-xs text-red-400 font-semibold">{errors.maritalStatus}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">מספר ילדים *</label>
                <input 
                  type="number"
                  name="childrenCount"
                  placeholder="לדוגמה: 2 (הזן 0 אם אין)"
                  value={formData.childrenCount}
                  onChange={handleChange}
                  min="0"
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.childrenCount ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.childrenCount && <p className="text-xs text-red-400 font-semibold">{errors.childrenCount}</p>}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-sm font-bold text-slate-300">גילאי הילדים *</label>
                <input 
                  type="text"
                  name="childrenAges"
                  placeholder="לדוגמה: 5, 8 (הזן 'אין' או '0' אם אין ילדים)"
                  value={formData.childrenAges}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.childrenAges ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.childrenAges && <p className="text-xs text-red-400 font-semibold">{errors.childrenAges}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 Content: Employment & Income */}
        {currentStep === 2 && (
          <div className="step-transition space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">מצב תעסוקתי *</label>
                <select 
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-3 px-4 text-slate-100 focus:bg-slate-950 text-sm outline-none transition-all"
                >
                  <option value="שכיר" className="bg-slate-950">שכיר</option>
                  <option value="עצמאי" className="bg-slate-950">עצמאי</option>
                  <option value="שכיר בעל שליטה" className="bg-slate-950">שכיר בעל שליטה</option>
                  <option value="פנסיונר" className="bg-slate-950">פנסיונר</option>
                  <option value="אחר" className="bg-slate-950">אחר</option>
                </select>
                
                {formData.employmentType === "אחר" && (
                  <div className="mt-2 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400">פרט מצב תעסוקתי אחר *</label>
                    <input 
                      type="text"
                      name="employmentTypeOther"
                      placeholder="הזן מצב תעסוקתי ידני"
                      value={formData.employmentTypeOther}
                      onChange={handleChange}
                      className={`w-full rounded-lg border bg-slate-950/80 py-2.5 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-xs outline-none transition-all ${
                        errors.employmentTypeOther ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                      }`}
                    />
                    {errors.employmentTypeOther && <p className="text-[11px] text-red-400 font-semibold">{errors.employmentTypeOther}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">ותק במקום העבודה (שנים) *</label>
                <input 
                  type="number"
                  name="seniority"
                  placeholder="לדוגמה: 4"
                  value={formData.seniority}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.seniority ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.seniority && <p className="text-xs text-red-400 font-semibold">{errors.seniority}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">מקום עבודה *</label>
                <input 
                  type="text"
                  name="workplace"
                  placeholder="לדוגמה: אלתא / עצמאי"
                  value={formData.workplace}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.workplace ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.workplace && <p className="text-xs text-red-400 font-semibold">{errors.workplace}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">הכנסה חודשית נטו (₪) *</label>
                <input 
                  type="number"
                  name="income"
                  placeholder="לדוגמה: 12000"
                  value={formData.income}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.income ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.income && <p className="text-xs text-red-400 font-semibold">{errors.income}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">סוג הכנסה נוספת *</label>
                <input 
                  type="text"
                  name="additionalIncomeType"
                  placeholder="לדוגמה: שכירות / קצבה / אין"
                  value={formData.additionalIncomeType}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.additionalIncomeType ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.additionalIncomeType && <p className="text-xs text-red-400 font-semibold">{errors.additionalIncomeType}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">סכום הכנסה נוספת (₪) *</label>
                <input 
                  type="number"
                  name="additionalIncomeAmount"
                  placeholder="הזן 0 אם אין הכנסה נוספת"
                  value={formData.additionalIncomeAmount}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.additionalIncomeAmount ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.additionalIncomeAmount && <p className="text-xs text-red-400 font-semibold">{errors.additionalIncomeAmount}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">החזר הלוואות חודשי (₪) *</label>
                <input 
                  type="number"
                  name="expensesLoans"
                  placeholder="הזן 0 אם אין"
                  value={formData.expensesLoans}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.expensesLoans ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.expensesLoans && <p className="text-xs text-red-400 font-semibold">{errors.expensesLoans}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">החזר משכנתא חודשי (₪) *</label>
                <input 
                  type="number"
                  name="expensesMortgage"
                  placeholder="הזן 0 אם אין משכנתא פעילה"
                  value={formData.expensesMortgage}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.expensesMortgage ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.expensesMortgage && <p className="text-xs text-red-400 font-semibold">{errors.expensesMortgage}</p>}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-sm font-bold text-slate-300">יתרת משכנתא (₪) *</label>
                <input 
                  type="number"
                  name="expensesMortgageBalance"
                  placeholder="יתרת משכנתא לסילוק (הזן 0 אם אין)"
                  value={formData.expensesMortgageBalance}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.expensesMortgageBalance ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                />
                {errors.expensesMortgageBalance && <p className="text-xs text-red-400 font-semibold">{errors.expensesMortgageBalance}</p>}
              </div>

              <div className="md:col-span-2 p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Info className="h-4 w-4 text-cyan-400" />
                  שים לב: סך ההתחייבויות החודשיות יחושב אוטומטית כסכום החזר ההלוואות והחזר המשכנתא החודשי.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 Content: Property & Loan details */}
        {currentStep === 3 && (
          <div className="step-transition space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">סוג העסקה *</label>
                <select 
                  name="dealType"
                  value={formData.dealType}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-3 px-4 text-slate-100 focus:bg-slate-950 text-sm outline-none transition-all"
                >
                  <option value="רכישה מקבלן" className="bg-slate-950">רכישה מקבלן</option>
                  <option value="מחיר למשתכן" className="bg-slate-950">מחיר למשתכן</option>
                  <option value="רכישה יד 2" className="bg-slate-950">רכישה יד 2</option>
                  <option value="שיפוצים" className="bg-slate-950">שיפוצים</option>
                  <option value="איחוד הלוואות" className="bg-slate-950">איחוד הלוואות</option>
                  <option value="מטרה עסקית" className="bg-slate-950">מטרה עסקית</option>
                  <option value="כל מטרה" className="bg-slate-950">כל מטרה</option>
                  <option value="בניה עצמית" className="bg-slate-950">בניה עצמית</option>
                  <option value="עסקה בתוך המשפחה" className="bg-slate-950">עסקה בתוך המשפחה</option>
                  <option value="רכישה/בניה בקיבוץ" className="bg-slate-950">רכישה/בניה בקיבוץ</option>
                  <option value="רכישה מכונס" className="bg-slate-950">רכישה מכונס</option>
                  <option value="משכנתא הפוכה" className="bg-slate-950">משכנתא הפוכה</option>
                  <option value="תמא" className="bg-slate-950">תמא</option>
                  <option value="מחזור" className="bg-slate-950">מחזור</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">סוג הנכס *</label>
                <select 
                  name="propertyType"
                  value={formData.propertyType}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.propertyType ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500"
                  }`}
                >
                  <option value="דירה ראשונה" className="bg-slate-950">דירה ראשונה</option>
                  <option value="נכס יחיד" className="bg-slate-950">נכס יחיד</option>
                  <option value="נכס חליפי" className="bg-slate-950">נכס חליפי</option>
                  <option value="נכס להשקעה" className="bg-slate-950">נכס להשקעה</option>
                  <option value="נכס קיים" className="bg-slate-950">נכס קיים</option>
                </select>
                {errors.propertyType && <p className="text-xs text-red-400 font-semibold">{errors.propertyType}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">שווי הנכס מוערך (₪)</label>
                <input 
                  type="number"
                  name="propertyValue"
                  placeholder="לדוגמה: 2500000"
                  value={formData.propertyValue}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.propertyValue ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.propertyValue && <p className="text-xs text-red-400 font-semibold">{errors.propertyValue}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">סכום הלוואה מבוקש (₪)</label>
                <input 
                  type="number"
                  name="requestedAmount"
                  placeholder="לדוגמה: 1500000"
                  value={formData.requestedAmount}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all ${
                    errors.requestedAmount ? "border-red-500" : "border-slate-800 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                  }`}
                />
                {errors.requestedAmount && <p className="text-xs text-red-400 font-semibold">{errors.requestedAmount}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">אחוז מימון מבוקש</label>
                <div className="flex items-center gap-4 bg-slate-950/80 py-3 px-4 rounded-lg border border-slate-800">
                  <span className="text-base font-bold text-emerald-400">{formData.financingPercentage}%</span>
                  <div className="text-xs text-slate-400">
                    מחושב אוטומטית לפי היחס בין המשכנתא לשווי הנכס.
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-sm font-bold text-slate-300">הערות נוספות ורקע מיוחד (לדוח אשראי וחיתום)</label>
                <textarea 
                  name="notes"
                  rows={4}
                  placeholder="פרט כאן סיבות מיוחדות לפנייה חוץ-בנקאית (למשל: סגירת תיקים, מורכבות משפטית, קשיי הכנסה בבנק רגיל). ה-AI ישתמש בזה כדי לכתוב פנייה מותאמת אישית לכל חברת מימון!"
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-3 px-4 text-slate-100 placeholder-slate-600 focus:bg-slate-950 text-sm outline-none transition-all resize-none"
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {/* Buttons Navigation */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center gap-1 px-5 py-2.5 rounded-lg border text-sm font-bold transition-all ${
              currentStep === 1 
                ? "opacity-0 pointer-events-none" 
                : "border-slate-800 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <ArrowRight className="h-4 w-4" />
            הקודם
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-all shadow-[0_4px_15px_rgba(8,145,178,0.3)] hover:scale-[1.02]"
            >
              המשך
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:scale-[1.02]"
            >
              סיום ושמירה
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
