import type { ClientFormErrors, ClientFormState } from "../utils/clientForm";
import {
  additionalIncomeTypeOptions,
  dealTypeOptions,
  employmentTypeOptions,
  maritalStatusOptions,
  propertyRegionOptions,
  propertyTypeOptions
} from "../utils/clientForm";
import { calculateTotalMonthlyIncome, calculateTotalMonthlyPayments } from "../utils/clientCalculations";
import { formatCurrency } from "../utils/formatters";

interface Props {
  form: ClientFormState;
  errors: ClientFormErrors;
  step: 1 | 2 | 3;
  onChange: <Key extends keyof ClientFormState>(key: Key, value: ClientFormState[Key]) => void;
}

export default function ClientFormFields({form, errors, step, onChange}: Props) {
  const field = (
    key: Exclude<keyof ClientFormState, "childrenAges">,
    label: string,
    placeholder: string,
    options: {type?: string; hint?: string; min?: number} = {}
  ) => <label className="form-field">
    <span>{label}<b aria-label="שדה חובה">*</b></span>
    <input
      type={options.type ?? "text"}
      min={options.min}
      aria-label={label}
      placeholder={placeholder}
      value={form[key]}
      onChange={(event) => onChange(key, event.target.value as ClientFormState[typeof key])}
      aria-invalid={Boolean(errors[key])}
    />
    {options.hint && <small>{options.hint}</small>}
    {errors[key] && <em role="alert">{errors[key]}</em>}
  </label>;

  const select = (key: Exclude<keyof ClientFormState, "childrenAges">, label: string, values: ReadonlyArray<readonly [string, string]>) => <label className="form-field">
    <span>{label}<b aria-label="שדה חובה">*</b></span>
    <select aria-label={label} value={form[key]} onChange={(event) => onChange(key, event.target.value as ClientFormState[typeof key])} aria-invalid={Boolean(errors[key])}>
      <option value="">יש לבחור</option>
      {values.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
    </select>
    {errors[key] && <em role="alert">{errors[key]}</em>}
  </label>;

  if (step === 1) return <fieldset>
    <legend>פרטים אישיים</legend>
    <p className="fieldset-description">פרטי הלקוח הראשי ומבנה משק הבית. כל השדות חובה.</p>
    <div className="responsive-form-grid">
      {field("firstName", "שם פרטי", "הקלד את שם הלקוח")}
      {field("lastName", "שם משפחה", "הקלד את שם המשפחה")}
      {field("identityNumber", "מספר תעודת זהות", "9 ספרות ללא מקפים", {hint: "המידע נשמר מוצפן."})}
      {field("birthDate", "תאריך לידה", "בחר תאריך", {type: "date"})}
      {field("phone", "טלפון", "לדוגמה 050-1234567", {type: "tel"})}
      {field("email", "דוא״ל", "name@example.co.il", {type: "email"})}
      {field("address", "כתובת מגורים", "רחוב, מספר ועיר")}
      {select("maritalStatus", "מצב משפחתי", maritalStatusOptions)}
      {field("numberOfChildren", "מספר ילדים", "הזן 0 כאשר אין ילדים", {type: "number", min: 0})}
      {form.childrenAges.map((age, index) => <label className="form-field" key={index}>
        <span>ילד {index + 1} — גיל<b aria-label="שדה חובה">*</b></span>
        <input type="number" min={0} max={120} aria-label={`גיל ילד ${index + 1}`} placeholder="הזן גיל" value={age} onChange={(event) => {
          const next = [...form.childrenAges]; next[index] = event.target.value; onChange("childrenAges", next);
        }} aria-invalid={Boolean(errors[`childrenAges.${index}`])} />
        {errors[`childrenAges.${index}`] && <em role="alert">{errors[`childrenAges.${index}`]}</em>}
      </label>)}
      {field("borrowerCount", "מספר לווים בתיק", "הזן מספר לווים", {type: "number", min: 1})}
    </div>
  </fieldset>;

  if (step === 2) return <fieldset>
    <legend>תעסוקה, הכנסות והתחייבויות</legend>
    <p className="fieldset-description">הנתונים החודשיים משמשים לחישוב יכולת ההחזר. אפשר להזין 0 כשאין התחייבות.</p>
    <div className="responsive-form-grid">
      {select("employmentType", "סוג תעסוקה", employmentTypeOptions)}
      {field("employerName", "שם המעסיק או העסק", "הקלד שם מעסיק או עסק")}
      {field("jobTitle", "תפקיד", "הקלד את תפקיד הלקוח")}
      {field("employmentSeniorityYears", "ותק בשנים", "הזן שנות ותק", {type: "number", min: 0})}
      {field("monthlyNetIncome", "הכנסה חודשית נטו", "הזן סכום בש״ח", {type: "number", min: 0})}
      {select("hasAdditionalIncome", "האם קיימת הכנסה נוספת", [["yes", "כן"], ["no", "לא"]])}
      {form.hasAdditionalIncome === "yes" && select("additionalIncomeType", "סוג הכנסה נוספת", additionalIncomeTypeOptions)}
      {form.hasAdditionalIncome === "yes" && field("additionalIncomeAmount", "סכום הכנסה נוספת חודשי", "הזן סכום בש״ח", {type: "number", min: 0})}
      {form.hasAdditionalIncome === "yes" && form.additionalIncomeType === "OTHER" && field("additionalIncomeDescription", "תיאור הכנסה נוספת", "תאר את מקור ההכנסה")}
      {field("monthlyLiabilities", "התחייבויות חודשיות", "הזן 0 כאשר אין התחייבויות", {type: "number", min: 0})}
      {field("existingMortgageBalance", "יתרת משכנתה קיימת", "הזן 0 כאשר אין משכנתה", {type: "number", min: 0})}
      {field("existingMortgageMonthlyPayment", "החזר משכנתה חודשי", "הזן 0 כאשר אין החזר", {type: "number", min: 0})}
      <div className="form-calculation form-field-wide">
        <span>סך הכנסה חודשית: <strong>{formatCurrency(calculateTotalMonthlyIncome(form.monthlyNetIncome, form.hasAdditionalIncome === "yes" ? form.additionalIncomeAmount : 0))}</strong></span>
        <span>סך החזרים חודשיים: <strong>{formatCurrency(calculateTotalMonthlyPayments(form.monthlyLiabilities, form.existingMortgageMonthlyPayment))}</strong></span>
      </div>
    </div>
  </fieldset>;

  return <fieldset>
    <legend>נכס ובקשת מימון</legend>
    <p className="fieldset-description">פרטי העסקה, הנכס והמימון המבוקש. כתובת הנכס נשמרת מוצפנת.</p>
    <div className="responsive-form-grid">
      {select("dealType", "סוג העסקה", dealTypeOptions)}
      {select("propertyType", "סוג הנכס", propertyTypeOptions)}
      {form.propertyType === "OTHER" && field("propertyTypeOtherDescription", "תיאור סוג הנכס", "תאר את סוג הנכס")}
      {field("propertyCity", "עיר", "הקלד את עיר הנכס")}
      {select("propertyRegion", "אזור", propertyRegionOptions)}
      {field("propertyAddress", "כתובת הנכס", "הקלד רחוב, מספר ועיר", {hint: "הכתובת המלאה לא תיכלל בתיק האנונימי."})}
      {field("propertyValue", "שווי הנכס", "הזן סכום בש״ח", {type: "number", min: 0})}
      {field("requestedAmount", "סכום המימון המבוקש", "הזן סכום בש״ח", {type: "number", min: 0})}
      {field("requestedTermMonths", "תקופת ההלוואה בחודשים", "לדוגמה 240", {type: "number", min: 1})}
      <label className="form-field form-field-wide">
        <span>הערות מקצועיות<b aria-label="שדה חובה">*</b></span>
        <textarea aria-label="הערות מקצועיות" placeholder="דגשים מקצועיים חשובים לבחינת התיק" rows={5} value={form.notes} onChange={(event) => onChange("notes", event.target.value)} aria-invalid={Boolean(errors.notes)} />
        {errors.notes && <em role="alert">{errors.notes}</em>}
      </label>
    </div>
  </fieldset>;
}
