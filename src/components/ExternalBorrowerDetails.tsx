import {BriefcaseBusiness, CircleUserRound, HandCoins, House, UsersRound} from "lucide-react";
import type {ReactNode} from "react";
import {currentIsraelYear} from "../domain/clientFields";
import {calculateRemainingCommitmentPeriod} from "../utils/commitmentPeriod";
import {
  formatAdditionalIncomeType,
  formatBorrowerRelationship,
  formatCurrency,
  formatDate,
  formatEmploymentType,
  formatLiabilityType,
  formatMaritalStatus
} from "../utils/formatters";

export type ExternalBorrowerMode = "MASKED" | "FULL";

export interface ExternalLiabilityDetails {
  type?: string;
  otherTypeDescription?: string | null;
  currentBalance?: number | null;
  monthlyPayment?: number | null;
  endDate?: string | null;
  financialInstitution?: string | null;
  notes?: string | null;
}

export interface ExternalSelfEmployedDetails {
  businessType?: string | null;
  businessStartYear?: number | null;
  lastAssessedIncome?: number | null;
  assessmentYear?: number | null;
  accountantIncomePreviousYear?: number | null;
  accountantIncomeCurrentYear?: number | null;
  accountantMonthsCount?: number | null;
}

export interface ExternalBorrowerDetailsModel {
  order?: number;
  label?: string;
  firstName?: string;
  lastName?: string;
  identityNumber?: string;
  dateOfBirth?: string;
  age?: number | null;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  streetAddress?: string;
  residenceCity?: string;
  maritalStatus?: string;
  numberOfChildren?: number;
  childrenAges?: number[];
  employment?: {
    employmentType?: string;
    employerName?: string;
    jobTitle?: string;
    employmentSeniorityYears?: number | null;
    monthlyNetIncome?: number | null;
    hasAdditionalIncome?: boolean;
    additionalIncomeType?: string | null;
    additionalIncomeAmount?: number | null;
    additionalIncomeDescription?: string | null;
    additionalIncomes?: Array<{type?: string; monthlyAmount?: number | null; description?: string | null}>;
    selfEmployed?: ExternalSelfEmployedDetails | null;
  };
  liabilities?: ExternalLiabilityDetails[];
}

interface HouseholdDetails {
  numberOfChildren?: number;
  childrenAges?: number[];
}

const missingValue = "לא צוין";

function present(value: ReactNode): ReactNode {
  if (value === null || value === undefined || value === "") return missingValue;
  return value;
}

function optionalCurrency(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? missingValue : formatCurrency(value);
}

function optionalYear(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isInteger(value) ? missingValue : String(value);
}

function childrenAges(children: number | undefined, ages: number[] | undefined): string {
  if (children === 0) return "אין ילדים";
  if (!ages?.length) return missingValue;
  return ages.map((age, index) => `ילד ${index + 1}: ${age}`).join(" · ");
}

function borrowerName(borrower: ExternalBorrowerDetailsModel): string {
  const name = `${borrower.firstName ?? ""} ${borrower.lastName ?? ""}`.trim();
  return name || missingValue;
}

export function DetailField({label, value, wide = false, ltr = false}: {label: string; value: ReactNode; wide?: boolean; ltr?: boolean}) {
  return <div className={`external-detail-field${wide ? " external-detail-field-wide" : ""}`}>
    <dt>{label}</dt>
    <dd dir={ltr ? "ltr" : undefined}>{present(value)}</dd>
  </div>;
}

function DetailsSection({icon, title, children}: {icon: ReactNode; title: string; children: ReactNode}) {
  return <section className="external-borrower-subsection">
    <h4>{icon}<span>{title}</span></h4>
    <dl className="external-detail-grid">{children}</dl>
  </section>;
}

export function BorrowerNameHeading({mode, borrower, index}: {mode: ExternalBorrowerMode; borrower: ExternalBorrowerDetailsModel; index: number}) {
  return <div className="borrower-name-heading">
    <span className="external-borrower-icon"><CircleUserRound /></span>
    <h3>
      <span>{borrower.label ?? `לווה ${borrower.order ?? index + 1}`}</span>
      {mode === "FULL" && <span className="borrower-name-value"> · {borrowerName(borrower)}</span>}
      <span className="borrower-age-inline"> · גיל {borrower.age ?? missingValue}</span>
    </h3>
  </div>;
}

export function BorrowerLiabilitiesList({liabilities = [], mode, emptyMessage = "לא קיימות התחייבויות ללווה זה"}: {liabilities?: ExternalLiabilityDetails[]; mode: ExternalBorrowerMode; emptyMessage?: string}) {
  if (!liabilities.length) return <div className="external-empty-state"><HandCoins /><span>{emptyMessage}</span></div>;
  return <div className="external-liabilities-list">
    {liabilities.map((liability, index) => {
      const remaining = liability.endDate ? calculateRemainingCommitmentPeriod(liability.endDate)?.label : null;
      const formattedType = formatLiabilityType(liability.type ?? "");
      const title = liability.otherTypeDescription ? `${formattedType} — ${liability.otherTypeDescription}` : formattedType;
      return <article className="external-liability-card" key={`${liability.type ?? "liability"}-${index}`}>
        <header><h5>{title}</h5><span>התחייבות {index + 1}</span></header>
        <dl className="external-detail-grid">
          {liability.type !== "ALIMONY" && liability.type !== "RENT" && <DetailField label="יתרה נוכחית" value={optionalCurrency(liability.currentBalance)} />}
          <DetailField label="החזר חודשי" value={optionalCurrency(liability.monthlyPayment)} />
          <DetailField label="תאריך סיום" value={formatDate(liability.endDate)} />
          <DetailField label="תקופה שנותרה" value={remaining ?? missingValue} />
          {mode === "FULL" && liability.financialInstitution && <DetailField label="גוף פיננסי" value={liability.financialInstitution} />}
          {liability.notes && <DetailField label="הערות" value={liability.notes} wide />}
        </dl>
      </article>;
    })}
  </div>;
}

// Full-portal-only: one borrower's personal/household details (name+age
// adjacent, per the product rebuild spec). Income, additional incomes and
// liabilities are rendered as separate top-level sections, not nested here.
export function BorrowerPersonalCard({mode, borrower, index, borrowerRelationship, household}: {mode: ExternalBorrowerMode; borrower: ExternalBorrowerDetailsModel; index: number; borrowerRelationship?: string | null; household?: HouseholdDetails}) {
  const childCount = household?.numberOfChildren ?? borrower.numberOfChildren;
  const childAges = household?.childrenAges ?? borrower.childrenAges;
  return <article className="external-borrower-card" data-borrower-mode={mode.toLowerCase()}>
    <header className="external-borrower-header">
      <BorrowerNameHeading mode={mode} borrower={borrower} index={index} />
    </header>
    <DetailsSection icon={<CircleUserRound />} title="פרטים אישיים">
      {mode === "FULL" && <DetailField label="שם מלא" value={borrowerName(borrower)} />}
      {mode === "FULL" && <DetailField label="מספר תעודת זהות" value={borrower.identityNumber} ltr />}
      {mode === "FULL" && <DetailField label="תאריך לידה" value={formatDate(borrower.dateOfBirth)} />}
      <DetailField label="מצב משפחתי" value={formatMaritalStatus(borrower.maritalStatus ?? "")} />
      {mode === "FULL" && <DetailField label="טלפון" value={borrower.phone} ltr />}
      {mode === "FULL" && <DetailField label="דוא״ל" value={borrower.email} ltr wide />}
      {mode === "FULL" && <DetailField label="עיר מגורים" value={borrower.city} />}
      {mode === "FULL" && <DetailField label="רחוב ומספר בית" value={borrower.streetAddress} wide />}
      {mode === "MASKED" && <DetailField label="עיר מגורים" value={borrower.residenceCity} />}
    </DetailsSection>
    <DetailsSection icon={<UsersRound />} title="משק בית">
      <DetailField label="קשר בין הלווים" value={formatBorrowerRelationship(borrowerRelationship ?? null)} />
      <DetailField label="מספר ילדים" value={childCount === undefined ? missingValue : childCount} />
      <DetailField label="גילאי הילדים" value={childrenAges(childCount, childAges)} wide />
    </DetailsSection>
  </article>;
}

function SelfEmployedFields({selfEmployed}: {selfEmployed: ExternalSelfEmployedDetails}) {
  const businessAge = Number.isInteger(selfEmployed.businessStartYear)
    ? `${Math.max(0, currentIsraelYear() - Number(selfEmployed.businessStartYear))} שנים`
    : missingValue;
  const currentYear = currentIsraelYear();
  const previousYear = currentYear - 1;
  return <>
    <DetailField label="סוג העיסוק" value={selfEmployed.businessType} wide />
    <DetailField label="שנת פתיחת העסק" value={optionalYear(selfEmployed.businessStartYear)} />
    <DetailField label="וותק העסק" value={businessAge} />
    <DetailField label="הכנסה משומה אחרונה" value={optionalCurrency(selfEmployed.lastAssessedIncome)} />
    <DetailField label="שנת השומה" value={optionalYear(selfEmployed.assessmentYear)} />
    <DetailField label={`אישור הכנסות רו״ח ${previousYear}`} value={optionalCurrency(selfEmployed.accountantIncomePreviousYear)} />
    <DetailField label={`הכנסות רו״ח ${currentYear}`} value={optionalCurrency(selfEmployed.accountantIncomeCurrentYear)} />
    <DetailField label="מספר חודשים" value={selfEmployed.accountantMonthsCount === null || selfEmployed.accountantMonthsCount === undefined ? missingValue : selfEmployed.accountantMonthsCount} />
  </>;
}

// Full-portal-only: one borrower's primary income block — salaried fields
// or, for SELF_EMPLOYED, the dedicated self-employed field set.
export function BorrowerIncomeCard({mode, borrower, index}: {mode: ExternalBorrowerMode; borrower: ExternalBorrowerDetailsModel; index: number}) {
  const employment = borrower.employment;
  const isSelfEmployed = employment?.employmentType === "SELF_EMPLOYED";
  return <article className="external-borrower-card" data-borrower-mode={mode.toLowerCase()}>
    <header className="external-borrower-header"><BorrowerNameHeading mode={mode} borrower={borrower} index={index} /></header>
    <DetailsSection icon={<BriefcaseBusiness />} title="הכנסה עיקרית">
      <DetailField label="סוג תעסוקה" value={formatEmploymentType(employment?.employmentType ?? "")} />
      {isSelfEmployed && employment?.selfEmployed ? <SelfEmployedFields selfEmployed={employment.selfEmployed} /> : <>
        {mode === "FULL" && <DetailField label="מעסיק או עסק" value={employment?.employerName} />}
        <DetailField label="תפקיד" value={employment?.jobTitle} />
        <DetailField label="ותק" value={employment?.employmentSeniorityYears === null || employment?.employmentSeniorityYears === undefined ? missingValue : `${employment.employmentSeniorityYears} שנים`} />
      </>}
      <DetailField label="הכנסה חודשית נטו" value={optionalCurrency(employment?.monthlyNetIncome)} />
    </DetailsSection>
  </article>;
}

// Full-portal-only: one borrower's additional-income list, as a numbered
// list rather than a flat grid.
export function BorrowerAdditionalIncomesCard({mode, borrower, index}: {mode: ExternalBorrowerMode; borrower: ExternalBorrowerDetailsModel; index: number}) {
  const employment = borrower.employment;
  const additionalIncomes = employment?.additionalIncomes ?? (employment?.hasAdditionalIncome && employment.additionalIncomeType ? [{type: employment.additionalIncomeType, monthlyAmount: employment.additionalIncomeAmount, description: employment.additionalIncomeDescription}] : []);
  return <article className="external-borrower-card" data-borrower-mode={mode.toLowerCase()}>
    <header className="external-borrower-header"><BorrowerNameHeading mode={mode} borrower={borrower} index={index} /></header>
    {additionalIncomes.length === 0 ? <div className="external-empty-state"><HandCoins /><span>אין הכנסות נוספות ללווה זה</span></div> : <ol className="external-additional-incomes-list">
      {additionalIncomes.map((income, incomeIndex) => <li key={`${income.type ?? "income"}-${incomeIndex}`}>
        <strong>{formatAdditionalIncomeType(income.type ?? null)}</strong> — {optionalCurrency(income.monthlyAmount)}{income.description ? ` · ${income.description}` : ""}
      </li>)}
    </ol>}
  </article>;
}

// Legacy single-card layout — still used for the masked/initial review,
// which was not in scope for the full-portal section-order rebuild.
export function ExternalBorrowerCard({mode, borrower, index, borrowerRelationship, household}: {mode: ExternalBorrowerMode; borrower: ExternalBorrowerDetailsModel; index: number; borrowerRelationship?: string | null; household?: HouseholdDetails}) {
  const employment = borrower.employment;
  const childCount = household?.numberOfChildren ?? borrower.numberOfChildren;
  const childAges = household?.childrenAges ?? borrower.childrenAges;
  const additionalIncomes = employment?.additionalIncomes ?? (employment?.hasAdditionalIncome && employment.additionalIncomeType ? [{type: employment.additionalIncomeType, monthlyAmount: employment.additionalIncomeAmount, description: employment.additionalIncomeDescription}] : []);
  const additionalIncome = additionalIncomes.reduce((sum, income) => sum + (income.monthlyAmount ?? 0), 0);
  const totalIncome = employment?.monthlyNetIncome === null || employment?.monthlyNetIncome === undefined
    ? null
    : employment.monthlyNetIncome + additionalIncome;
  const hasAdditionalIncome = additionalIncomes.length > 0;
  const isSelfEmployed = employment?.employmentType === "SELF_EMPLOYED";
  return <article className="external-borrower-card" data-borrower-mode={mode.toLowerCase()}>
    <header className="external-borrower-header">
      <BorrowerNameHeading mode={mode} borrower={borrower} index={index} />
    </header>

    <DetailsSection icon={<CircleUserRound />} title="פרטים אישיים">
      {mode === "FULL" && <DetailField label="שם מלא" value={borrowerName(borrower)} />}
      {mode === "FULL" && <DetailField label="מספר תעודת זהות" value={borrower.identityNumber} ltr />}
      {mode === "FULL" && <DetailField label="תאריך לידה" value={formatDate(borrower.dateOfBirth)} />}
      <DetailField label="מצב משפחתי" value={formatMaritalStatus(borrower.maritalStatus ?? "")} />
      {mode === "FULL" && <DetailField label="טלפון" value={borrower.phone} ltr />}
      {mode === "FULL" && <DetailField label="דוא״ל" value={borrower.email} ltr wide />}
      {mode === "FULL" && <DetailField label="עיר מגורים" value={borrower.city} />}
      {mode === "FULL" && <DetailField label="רחוב ומספר בית" value={borrower.streetAddress} wide />}
      {mode === "MASKED" && <DetailField label="עיר מגורים" value={borrower.residenceCity} />}
    </DetailsSection>

    <DetailsSection icon={<UsersRound />} title="משק בית">
      <DetailField label="קשר בין הלווים" value={formatBorrowerRelationship(borrowerRelationship ?? null)} />
      <DetailField label="מספר ילדים" value={childCount === undefined ? missingValue : childCount} />
      <DetailField label="גילאי הילדים" value={childrenAges(childCount, childAges)} wide />
    </DetailsSection>

    <DetailsSection icon={<BriefcaseBusiness />} title="תעסוקה והכנסות">
      <DetailField label="סוג תעסוקה" value={formatEmploymentType(employment?.employmentType ?? "")} />
      {isSelfEmployed && employment?.selfEmployed ? <SelfEmployedFields selfEmployed={employment.selfEmployed} /> : <>
        {mode === "FULL" && <DetailField label="מעסיק או עסק" value={employment?.employerName} />}
        <DetailField label="תפקיד" value={employment?.jobTitle} />
        <DetailField label="ותק" value={employment?.employmentSeniorityYears === null || employment?.employmentSeniorityYears === undefined ? missingValue : `${employment.employmentSeniorityYears} שנים`} />
      </>}
      <DetailField label="הכנסה חודשית נטו" value={optionalCurrency(employment?.monthlyNetIncome)} />
      <DetailField label="האם קיימת הכנסה נוספת" value={hasAdditionalIncome ? "כן" : "לא"} />
      {additionalIncomes.map((income, incomeIndex) => <DetailField key={`${income.type ?? "income"}-${incomeIndex}`} label={`הכנסה נוספת ${incomeIndex + 1}`} value={`${formatAdditionalIncomeType(income.type ?? null)} · ${optionalCurrency(income.monthlyAmount)}${income.description ? ` · ${income.description}` : ""}`} wide />)}
      <DetailField label="סך הכנסה חודשית" value={optionalCurrency(totalIncome)} />
    </DetailsSection>

    <section className="external-borrower-subsection external-borrower-liabilities">
      <h4><HandCoins /><span>התחייבויות</span></h4>
      <BorrowerLiabilitiesList liabilities={borrower.liabilities} mode={mode} />
    </section>
  </article>;
}

export function ExternalBorrowersSection({mode, title, borrowers = [], borrowerRelationship, household, householdLiabilities = []}: {mode: ExternalBorrowerMode; title: string; borrowers?: ExternalBorrowerDetailsModel[]; borrowerRelationship?: string | null; household?: HouseholdDetails; householdLiabilities?: ExternalLiabilityDetails[]}) {
  const showHouseholdLiabilities = borrowerRelationship === "MARRIED" || householdLiabilities.length > 0;
  const totalBalance = householdLiabilities.reduce((sum, liability) => sum + (liability.currentBalance ?? 0), 0);
  const totalPayments = householdLiabilities.reduce((sum, liability) => sum + (liability.monthlyPayment ?? 0), 0);
  return <section className="external-wide external-borrowers-section" data-testid={`external-borrowers-${mode.toLowerCase()}`}>
    <div className="external-section-heading"><div><span className="eyebrow">{mode === "MASKED" ? "מידע ללא פרטים מזהים" : "מידע מלא לאחר אימות"}</span><h2>{title}</h2></div><span>{borrowers.length} {borrowers.length === 1 ? "לווה" : "לווים"}</span></div>
    <div className="external-borrower-list">
      {borrowers.map((borrower, index) => <ExternalBorrowerCard key={borrower.order ?? borrower.label ?? index} mode={mode} borrower={borrower} index={index} borrowerRelationship={borrowerRelationship} household={household} />)}
    </div>
    {showHouseholdLiabilities && <section className="external-household-liabilities">
      <header><div><House /><div><span className="eyebrow">משותף לכל הלווים</span><h3>התחייבויות משותפות למשק הבית</h3></div></div><dl><DetailField label="סך התחייבויות" value={formatCurrency(totalBalance)} /><DetailField label="סך החזרים" value={formatCurrency(totalPayments)} /></dl></header>
      <BorrowerLiabilitiesList liabilities={householdLiabilities} mode={mode} emptyMessage="לא קיימות התחייבויות משותפות למשק הבית" />
    </section>}
  </section>;
}

// Full-portal-only: personal-details section (#6) — one card per borrower,
// no income/liabilities embedded.
export function ExternalBorrowersPersonalSection({title, borrowers = [], borrowerRelationship, household}: {title: string; borrowers?: ExternalBorrowerDetailsModel[]; borrowerRelationship?: string | null; household?: HouseholdDetails}) {
  return <section className="external-wide external-borrowers-section" data-testid="external-borrowers-personal">
    <div className="external-section-heading"><div><span className="eyebrow">מידע מלא לאחר אימות</span><h2>{title}</h2></div><span>{borrowers.length} {borrowers.length === 1 ? "לווה" : "לווים"}</span></div>
    <div className="external-borrower-list">
      {borrowers.map((borrower, index) => <BorrowerPersonalCard key={borrower.order ?? borrower.label ?? index} mode="FULL" borrower={borrower} index={index} borrowerRelationship={borrowerRelationship} household={household} />)}
    </div>
  </section>;
}

// Full-portal-only: primary-income section (#7) — one card per borrower.
export function ExternalBorrowersIncomeSection({borrowers = []}: {borrowers?: ExternalBorrowerDetailsModel[]}) {
  return <section className="external-wide external-borrowers-section" data-testid="external-borrowers-income">
    <div className="external-section-heading"><div><h2>הכנסות</h2></div></div>
    <div className="external-borrower-list">
      {borrowers.map((borrower, index) => <BorrowerIncomeCard key={borrower.order ?? borrower.label ?? index} mode="FULL" borrower={borrower} index={index} />)}
    </div>
  </section>;
}

// Full-portal-only: additional-incomes section (#8) — one numbered list per borrower.
export function ExternalBorrowersAdditionalIncomesSection({borrowers = []}: {borrowers?: ExternalBorrowerDetailsModel[]}) {
  return <section className="external-wide external-borrowers-section" data-testid="external-borrowers-additional-incomes">
    <div className="external-section-heading"><div><h2>הכנסות נוספות</h2></div></div>
    <div className="external-borrower-list">
      {borrowers.map((borrower, index) => <BorrowerAdditionalIncomesCard key={borrower.order ?? borrower.label ?? index} mode="FULL" borrower={borrower} index={index} />)}
    </div>
  </section>;
}

// Full-portal-only: liabilities section (#9) — per-borrower cards plus the
// shared household block when relevant.
export function ExternalBorrowersLiabilitiesSection({borrowers = [], borrowerRelationship, householdLiabilities = []}: {borrowers?: ExternalBorrowerDetailsModel[]; borrowerRelationship?: string | null; householdLiabilities?: ExternalLiabilityDetails[]}) {
  const showHouseholdLiabilities = borrowerRelationship === "MARRIED" || householdLiabilities.length > 0;
  const totalBalance = householdLiabilities.reduce((sum, liability) => sum + (liability.currentBalance ?? 0), 0);
  const totalPayments = householdLiabilities.reduce((sum, liability) => sum + (liability.monthlyPayment ?? 0), 0);
  return <section className="external-wide external-borrowers-section" data-testid="external-borrowers-liabilities">
    <div className="external-section-heading"><div><h2>התחייבויות</h2></div></div>
    <div className="external-borrower-list">
      {borrowers.map((borrower, index) => <article className="external-borrower-card" data-borrower-mode="full" key={borrower.order ?? borrower.label ?? index}>
        <header className="external-borrower-header"><BorrowerNameHeading mode="FULL" borrower={borrower} index={index} /></header>
        <BorrowerLiabilitiesList liabilities={borrower.liabilities} mode="FULL" />
      </article>)}
    </div>
    {showHouseholdLiabilities && <section className="external-household-liabilities">
      <header><div><House /><div><span className="eyebrow">משותף לכל הלווים</span><h3>התחייבויות משותפות למשק הבית</h3></div></div><dl><DetailField label="סך התחייבויות" value={formatCurrency(totalBalance)} /><DetailField label="סך החזרים" value={formatCurrency(totalPayments)} /></dl></header>
      <BorrowerLiabilitiesList liabilities={householdLiabilities} mode="FULL" emptyMessage="לא קיימות התחייבויות משותפות למשק הבית" />
    </section>}
  </section>;
}
