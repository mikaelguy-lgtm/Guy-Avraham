import { ArrowDown, ArrowUp } from "lucide-react";
import type { BorrowerFormState, ClientFormErrors, ClientFormState } from "../utils/clientForm";
import {
  additionalIncomeTypeOptions,
  borrowerRelationshipOptions,
  dealTypeOptions,
  employmentTypeOptions,
  isSharedHousehold,
  maritalStatusOptions,
  propertyRegionOptions,
  propertyTypeOptions
} from "../utils/clientForm";
import { calculateAge } from "../utils/age";
import { calculateTotalMonthlyIncome, calculateTotalMonthlyPayments } from "../utils/clientCalculations";
import { formatCurrency } from "../utils/formatters";

interface Props {
  form: ClientFormState;
  errors: ClientFormErrors;
  step: 1 | 2 | 3;
  onChange: <Key extends keyof ClientFormState>(key: Key, value: ClientFormState[Key]) => void;
  onBorrowerChange: <Key extends keyof BorrowerFormState>(index: number, key: Key, value: BorrowerFormState[Key]) => void;
  onMoveBorrower?: (from: number, to: number) => void;
}

const requiredMark = <b aria-label="שדה חובה">*</b>;

export default function ClientFormFields({form, errors, step, onChange, onBorrowerChange, onMoveBorrower}: Props) {
  const globalField = (key: keyof ClientFormState, label: string, placeholder: string, options: {type?: string; min?: number; max?: number; hint?: string} = {}) => <label className="form-field">
    <span>{label}{requiredMark}</span>
    <input type={options.type ?? "text"} min={options.min} max={options.max} aria-label={label} placeholder={placeholder}
      value={String(form[key])} onChange={(event) => onChange(key, event.target.value as never)} aria-invalid={Boolean(errors[String(key)])} />
    {options.hint && <small>{options.hint}</small>}
    {errors[String(key)] && <em role="alert">{errors[String(key)]}</em>}
  </label>;

  const globalSelect = (key: keyof ClientFormState, label: string, values: ReadonlyArray<readonly [string, string]>) => <label className="form-field">
    <span>{label}{requiredMark}</span>
    <select aria-label={label} value={String(form[key])} onChange={(event) => onChange(key, event.target.value as never)} aria-invalid={Boolean(errors[String(key)])}>
      <option value="">יש לבחור</option>
      {values.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
    </select>
    {errors[String(key)] && <em role="alert">{errors[String(key)]}</em>}
  </label>;

  const borrowerField = (index: number, key: keyof BorrowerFormState, label: string, placeholder: string, options: {type?: string; min?: number; max?: number; hint?: string} = {}) => {
    const errorKey = `borrowers.${index}.${String(key)}`;
    const borrower = form.borrowers[index];
    return <label className="form-field">
      <span>{label}{requiredMark}</span>
      <input type={options.type ?? "text"} min={options.min} max={options.max} aria-label={`${label} - לווה ${index + 1}`} placeholder={placeholder}
        value={String(borrower[key])} onChange={(event) => onBorrowerChange(index, key, event.target.value as never)} aria-invalid={Boolean(errors[errorKey])} />
      {options.hint && <small>{options.hint}</small>}
      {errors[errorKey] && <em role="alert">{errors[errorKey]}</em>}
    </label>;
  };

  const borrowerSelect = (index: number, key: keyof BorrowerFormState, label: string, values: ReadonlyArray<readonly [string, string]>) => {
    const errorKey = `borrowers.${index}.${String(key)}`;
    return <label className="form-field">
      <span>{label}{requiredMark}</span>
      <select aria-label={`${label} - לווה ${index + 1}`} value={String(form.borrowers[index][key])} onChange={(event) => onBorrowerChange(index, key, event.target.value as never)} aria-invalid={Boolean(errors[errorKey])}>
        <option value="">יש לבחור</option>
        {values.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
      </select>
      {errors[errorKey] && <em role="alert">{errors[errorKey]}</em>}
    </label>;
  };

  const childrenFields = (prefix: string, count: string, ages: string[], setCount: (value: string) => void, setAges: (value: string[]) => void) => <div className="responsive-form-grid children-fields">
    <label className="form-field">
      <span>מספר ילדים{requiredMark}</span>
      <input type="number" min={0} max={20} aria-label={`מספר ילדים - ${prefix}`} value={count} onChange={(event) => setCount(event.target.value)} aria-invalid={Boolean(errors[`${prefix}.numberOfChildren`])} />
      {errors[`${prefix}.numberOfChildren`] && <em role="alert">{errors[`${prefix}.numberOfChildren`]}</em>}
    </label>
    {ages.map((age, childIndex) => <label className="form-field" key={childIndex}>
      <span>ילד {childIndex + 1} — גיל{requiredMark}</span>
      <input type="number" min={0} max={120} aria-label={`גיל ילד ${childIndex + 1} - ${prefix}`} value={age} onChange={(event) => {
        const next = [...ages]; next[childIndex] = event.target.value; setAges(next);
      }} aria-invalid={Boolean(errors[`${prefix}.childrenAges.${childIndex}`])} />
      {errors[`${prefix}.childrenAges.${childIndex}`] && <em role="alert">{errors[`${prefix}.childrenAges.${childIndex}`]}</em>}
    </label>)}
  </div>;

  if (step === 1) return <fieldset>
    <legend>פרטים אישיים של הלווים</legend>
    <p className="fieldset-description">בחר את מספר הלווים והזן את פרטי כל לווה. הלווה הראשון מוגדר כלווה הראשי.</p>
    <div className="responsive-form-grid borrower-setup">
      {globalField("numberOfBorrowers", "מספר לווים בתיק", "בין 1 ל-5", {type: "number", min: 1, max: 5})}
      {Number(form.numberOfBorrowers) > 1 && globalSelect("borrowerRelationship", "מה הקשר בין הלווים?", borrowerRelationshipOptions)}
      {form.borrowerRelationship === "OTHER" && globalField("borrowerRelationshipOther", "תיאור הקשר", "תאר את הקשר בין הלווים")}
    </div>
    <div className="borrower-card-list">{form.borrowers.map((borrower, index) => <section className="borrower-card" key={index} data-testid={`borrower-personal-${index + 1}`}>
      <header><div><span className="eyebrow">{index === 0 ? "לווה 1 — הלווה הראשי" : `לווה ${index + 1} — לווה נוסף`}</span><h3>{borrower.firstName || borrower.lastName ? `${borrower.firstName} ${borrower.lastName}` : `פרטי לווה ${index + 1}`}</h3></div>
        {onMoveBorrower && form.borrowers.length > 1 && <div className="borrower-order-actions">
          <button type="button" className="icon-button" aria-label={`העבר לווה ${index + 1} למעלה`} disabled={index === 0} onClick={() => onMoveBorrower(index, index - 1)}><ArrowUp size={17} /></button>
          <button type="button" className="icon-button" aria-label={`העבר לווה ${index + 1} למטה`} disabled={index === form.borrowers.length - 1} onClick={() => onMoveBorrower(index, index + 1)}><ArrowDown size={17} /></button>
        </div>}
      </header>
      {Object.keys(errors).some((key) => key.startsWith(`borrowers.${index}.`)) && <p className="borrower-error-summary" role="alert">יש להשלים את פרטי לווה {index + 1}</p>}
      <div className="responsive-form-grid">
        {borrowerField(index, "firstName", "שם פרטי", "הקלד שם פרטי")}
        {borrowerField(index, "lastName", "שם משפחה", "הקלד שם משפחה")}
        {borrowerField(index, "identityNumber", "מספר תעודת זהות", "9 ספרות ללא מקפים", {hint: "המידע נשמר מוצפן."})}
        <div>{borrowerField(index, "birthDate", "תאריך לידה", "בחר תאריך", {type: "date"})}{borrower.birthDate && calculateAge(borrower.birthDate) !== null && <p className="calculated-age">גיל: <strong>{calculateAge(borrower.birthDate)}</strong></p>}</div>
        {borrowerField(index, "phone", "טלפון", "לדוגמה 050-1234567", {type: "tel"})}
        {borrowerField(index, "email", "דוא״ל", "name@example.co.il", {type: "email"})}
        {borrowerField(index, "address", "כתובת מגורים", "רחוב, מספר ועיר")}
        {borrowerSelect(index, "maritalStatus", "מצב משפחתי", maritalStatusOptions)}
      </div>
      {isSharedHousehold(form.borrowerRelationship) && index === 0 && <div className="household-card">
        <h4>נתוני משק הבית</h4><p>מספר הילדים וגילאיהם נשמרים פעם אחת עבור שני הלווים.</p>
        {childrenFields("household", form.householdNumberOfChildren, form.householdChildrenAges,
          (value) => onChange("householdNumberOfChildren", value), (value) => onChange("householdChildrenAges", value))}
      </div>}
      {isSharedHousehold(form.borrowerRelationship) && index > 0 && <p className="shared-children-note">נתוני הילדים משותפים לשני הלווים ומוזנים תחת הלווה הראשי.</p>}
      {!isSharedHousehold(form.borrowerRelationship) && childrenFields(`borrowers.${index}.children`, borrower.numberOfChildren, borrower.childrenAges,
        (value) => onBorrowerChange(index, "numberOfChildren", value), (value) => onBorrowerChange(index, "childrenAges", value))}
    </section>)}</div>
  </fieldset>;

  if (step === 2) return <fieldset>
    <legend>הכנסות, תעסוקה והתחייבויות</legend>
    <p className="fieldset-description">הזן תמונה פיננסית מלאה עבור כל לווה. הסיכומים בתחתית מחושבים אוטומטית לכל התיק.</p>
    <div className="borrower-card-list">{form.borrowers.map((borrower, index) => <section className="borrower-card" key={index} data-testid={`borrower-financial-${index + 1}`}>
      <header><div><span className="eyebrow">הכנסות והתחייבויות — לווה {index + 1}</span><h3>{`${borrower.firstName} ${borrower.lastName}`.trim() || `פרטי לווה ${index + 1}`}</h3></div></header>
      {Object.keys(errors).some((key) => key.startsWith(`borrowers.${index}.`)) && <p className="borrower-error-summary" role="alert">יש להשלים את פרטי לווה {index + 1}</p>}
      <div className="responsive-form-grid">
        {borrowerSelect(index, "employmentType", "סוג תעסוקה", employmentTypeOptions)}
        {borrowerField(index, "employerName", "שם המעסיק או העסק", "הקלד שם מעסיק או עסק")}
        {borrowerField(index, "jobTitle", "תפקיד", "הקלד את התפקיד")}
        {borrowerField(index, "employmentSeniorityYears", "ותק בשנים", "הזן שנות ותק", {type: "number", min: 0})}
        {borrowerField(index, "monthlyNetIncome", "הכנסה חודשית נטו", "הזן סכום בש״ח", {type: "number", min: 0})}
        {borrowerSelect(index, "hasAdditionalIncome", "האם קיימת הכנסה נוספת", [["yes", "כן"], ["no", "לא"]])}
        {borrower.hasAdditionalIncome === "yes" && borrowerSelect(index, "additionalIncomeType", "סוג הכנסה נוספת", additionalIncomeTypeOptions)}
        {borrower.hasAdditionalIncome === "yes" && borrowerField(index, "additionalIncomeAmount", "סכום הכנסה נוספת חודשי", "הזן סכום בש״ח", {type: "number", min: 0})}
        {borrower.hasAdditionalIncome === "yes" && borrower.additionalIncomeType === "OTHER" && borrowerField(index, "additionalIncomeDescription", "תיאור הכנסה נוספת", "תאר את מקור ההכנסה")}
        {borrowerField(index, "monthlyLiabilities", "התחייבויות חודשיות שאינן משכנתה", "הזן 0 כאשר אין", {type: "number", min: 0})}
        {borrowerField(index, "existingMortgageBalance", "יתרת משכנתה קיימת", "הזן 0 כאשר אין", {type: "number", min: 0})}
        {borrowerField(index, "existingMortgageMonthlyPayment", "החזר משכנתה חודשי", "הזן 0 כאשר אין", {type: "number", min: 0})}
        <div className="form-calculation form-field-wide"><span>סך הכנסה ללווה: <strong>{formatCurrency(calculateTotalMonthlyIncome(borrower.monthlyNetIncome, borrower.hasAdditionalIncome === "yes" ? borrower.additionalIncomeAmount : 0))}</strong></span><span>סך החזרים ללווה: <strong>{formatCurrency(calculateTotalMonthlyPayments(borrower.monthlyLiabilities, borrower.existingMortgageMonthlyPayment))}</strong></span></div>
      </div>
    </section>)}</div>
    <div className="form-calculation aggregate-calculation"><span>סך הכנסות בתיק: <strong>{formatCurrency(form.borrowers.reduce((sum, borrower) => sum + calculateTotalMonthlyIncome(borrower.monthlyNetIncome, borrower.hasAdditionalIncome === "yes" ? borrower.additionalIncomeAmount : 0), 0))}</strong></span><span>סך החזרים בתיק: <strong>{formatCurrency(form.borrowers.reduce((sum, borrower) => sum + calculateTotalMonthlyPayments(borrower.monthlyLiabilities, borrower.existingMortgageMonthlyPayment), 0))}</strong></span></div>
  </fieldset>;

  return <fieldset>
    <legend>נכס ובקשת מימון משותפת</legend>
    <p className="fieldset-description">פרטי העסקה, הנכס ובקשת המימון משותפים לכל הלווים בתיק.</p>
    <div className="responsive-form-grid">
      {globalSelect("dealType", "סוג העסקה", dealTypeOptions)}
      {globalSelect("propertyType", "סוג הנכס", propertyTypeOptions)}
      {form.propertyType === "OTHER" && globalField("propertyTypeOtherDescription", "תיאור סוג הנכס", "תאר את סוג הנכס")}
      {globalField("propertyCity", "עיר", "הקלד את עיר הנכס")}
      {globalSelect("propertyRegion", "אזור", propertyRegionOptions)}
      {globalField("propertyAddress", "כתובת הנכס", "רחוב, מספר ועיר", {hint: "הכתובת המלאה לא תיכלל בתיק האנונימי."})}
      {globalField("propertyValue", "שווי הנכס", "הזן סכום בש״ח", {type: "number", min: 0})}
      {globalField("requestedAmount", "סכום המימון המבוקש", "הזן סכום בש״ח", {type: "number", min: 0})}
      {globalField("requestedTermMonths", "תקופת ההלוואה בחודשים", "לדוגמה 240", {type: "number", min: 1})}
      <label className="form-field form-field-wide"><span>הערות מקצועיות{requiredMark}</span><textarea aria-label="הערות מקצועיות" placeholder="דגשים מקצועיים חשובים לבחינת התיק" rows={5} value={form.notes} onChange={(event) => onChange("notes", event.target.value)} aria-invalid={Boolean(errors.notes)} />{errors.notes && <em role="alert">{errors.notes}</em>}</label>
    </div>
  </fieldset>;
}
