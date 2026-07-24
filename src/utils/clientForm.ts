import {
  ADDITIONAL_INCOME_TYPES, BORROWER_RELATIONSHIPS, DEAL_TYPES, EMPLOYMENT_TYPES, LIABILITY_TYPES,
  MARITAL_STATUSES, MAX_BORROWERS, PROPERTY_TYPES
} from "../domain/clientFields";
import type { Client, ClientBorrower, ClientLiability } from "../types";
import { validateAdultBirthDate } from "./age";
import { calculateRemainingCommitmentPeriod } from "./commitmentPeriod";
import {
  formatAdditionalIncomeType, formatBorrowerRelationship, formatDealType, formatEmploymentType,
  formatLiabilityType, formatMaritalStatus, formatPropertyType
} from "./formatters";

export interface LiabilityFormState {
  id?: number;
  type: string;
  otherTypeDescription: string;
  currentBalance: string;
  monthlyPayment: string;
  endDate: string;
  notes: string;
  incompleteLegacy?: boolean;
}

export interface BorrowerFormState {
  firstName: string; lastName: string; identityNumber: string; birthDate: string; phone: string; email: string;
  address: string; maritalStatus: string; numberOfChildren: string; childrenAges: string[];
  employmentType: string; employerName: string; jobTitle: string; employmentSeniorityYears: string;
  monthlyNetIncome: string; hasAdditionalIncome: "" | "yes" | "no"; additionalIncomeType: string;
  additionalIncomeAmount: string; additionalIncomeDescription: string; liabilities: LiabilityFormState[];
}

export interface ClientFormState {
  numberOfBorrowers: string; borrowerRelationship: string; borrowerRelationshipOther: string;
  householdNumberOfChildren: string; householdChildrenAges: string[]; borrowers: BorrowerFormState[];
  householdLiabilities: LiabilityFormState[]; loanPurpose: string; propertyType: string;
  propertyTypeOtherDescription: string; propertyCity: string; propertyAddress: string; propertyValue: string;
  requestedAmount: string; dealDetails: string;
}

export type ClientFormErrors = Record<string, string>;
export const maritalStatusOptions = MARITAL_STATUSES.map((value) => [value, formatMaritalStatus(value)] as const);
export const employmentTypeOptions = EMPLOYMENT_TYPES.map((value) => [value, formatEmploymentType(value)] as const);
export const additionalIncomeTypeOptions = ADDITIONAL_INCOME_TYPES.map((value) => [value, formatAdditionalIncomeType(value)] as const);
export const borrowerRelationshipOptions = BORROWER_RELATIONSHIPS.map((value) => [value, formatBorrowerRelationship(value)] as const);
export const dealTypeOptions = DEAL_TYPES.map((value) => [value, formatDealType(value)] as const);
export const loanPurposeOptions = dealTypeOptions;
export const liabilityTypeOptions = LIABILITY_TYPES.map((value) => [value, formatLiabilityType(value)] as const);
export const propertyTypeOptions = PROPERTY_TYPES.map((value) => [value, formatPropertyType(value)] as const);

export const emptyLiabilityForm = (): LiabilityFormState => ({type: "", otherTypeDescription: "", currentBalance: "", monthlyPayment: "", endDate: "", notes: ""});
export function emptyBorrowerForm(): BorrowerFormState {
  return {firstName: "", lastName: "", identityNumber: "", birthDate: "", phone: "", email: "", address: "", maritalStatus: "", numberOfChildren: "0", childrenAges: [], employmentType: "", employerName: "", jobTitle: "", employmentSeniorityYears: "", monthlyNetIncome: "", hasAdditionalIncome: "", additionalIncomeType: "", additionalIncomeAmount: "", additionalIncomeDescription: "", liabilities: []};
}
export function emptyClientForm(): ClientFormState {
  return {numberOfBorrowers: "1", borrowerRelationship: "", borrowerRelationshipOther: "", householdNumberOfChildren: "0", householdChildrenAges: [], borrowers: [emptyBorrowerForm()], householdLiabilities: [], loanPurpose: "", propertyType: "", propertyTypeOtherDescription: "", propertyCity: "", propertyAddress: "", propertyValue: "", requestedAmount: "", dealDetails: ""};
}

const liabilityToForm = (liability: ClientLiability): LiabilityFormState => ({id: liability.id, type: liability.type, otherTypeDescription: liability.otherTypeDescription ?? "", currentBalance: String(liability.currentBalance), monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate ?? "", notes: liability.notes, incompleteLegacy: liability.incompleteLegacy});
function borrowerToForm(borrower: ClientBorrower): BorrowerFormState {
  return {firstName: borrower.firstName, lastName: borrower.lastName, identityNumber: borrower.identityNumber, birthDate: borrower.birthDate, phone: borrower.phone, email: borrower.email, address: borrower.address, maritalStatus: borrower.maritalStatus, numberOfChildren: String(borrower.children.numberOfChildren), childrenAges: borrower.children.childrenAges.map(String), employmentType: borrower.employment.employmentType, employerName: borrower.employment.employerName, jobTitle: borrower.employment.jobTitle, employmentSeniorityYears: String(borrower.employment.employmentSeniorityYears), monthlyNetIncome: String(borrower.income.monthlyNetIncome), hasAdditionalIncome: borrower.income.hasAdditionalIncome ? "yes" : "no", additionalIncomeType: borrower.income.additionalIncomeType ?? "", additionalIncomeAmount: String(borrower.income.additionalIncomeAmount), additionalIncomeDescription: borrower.income.additionalIncomeDescription ?? "", liabilities: borrower.liabilities.map(liabilityToForm)};
}
export function clientToForm(client: Client): ClientFormState {
  return {numberOfBorrowers: String(client.numberOfBorrowers), borrowerRelationship: client.borrowerRelationship ?? "", borrowerRelationshipOther: client.borrowerRelationshipOther ?? "", householdNumberOfChildren: String(client.household.numberOfChildren), householdChildrenAges: client.household.childrenAges.map(String), borrowers: client.borrowers.map(borrowerToForm), householdLiabilities: client.householdLiabilities.map(liabilityToForm), loanPurpose: client.loanPurpose, propertyType: client.propertyType, propertyTypeOtherDescription: client.propertyTypeOtherDescription ?? "", propertyCity: client.propertyCity, propertyAddress: client.propertyAddress, propertyValue: String(client.propertyValue), requestedAmount: String(client.requestedAmount), dealDetails: client.dealDetails};
}

export function resizeChildrenAges(current: string[], countValue: string): string[] { const count = Math.max(0, Math.min(20, Number.parseInt(countValue, 10) || 0)); return Array.from({length: count}, (_, index) => current[index] ?? ""); }
export function resizeBorrowers(current: BorrowerFormState[], countValue: string): BorrowerFormState[] { const count = Math.max(1, Math.min(MAX_BORROWERS, Number.parseInt(countValue, 10) || 1)); return Array.from({length: count}, (_, index) => current[index] ?? emptyBorrowerForm()); }
export function moveBorrower(current: BorrowerFormState[], from: number, to: number): BorrowerFormState[] { if (from < 0 || to < 0 || from >= current.length || to >= current.length || from === to) return current; const next = [...current]; const [borrower] = next.splice(from, 1); next.splice(to, 0, borrower); return next; }
export const isSharedHousehold = (relationship: string): boolean => relationship === "MARRIED" || relationship === "COMMON_LAW";
export const usesHouseholdLiabilities = (relationship: string): boolean => relationship === "MARRIED";

function required(errors: ClientFormErrors, key: string, value: string, message: string): void { if (!value.trim()) errors[key] = message; }
function numberField(errors: ClientFormErrors, key: string, value: string, message: string, positive = false): void { const number = Number(value); if (!value.trim() || !Number.isFinite(number) || number < 0 || (positive && number <= 0)) errors[key] = message; }
function validateChildren(errors: ClientFormErrors, prefix: string, countValue: string, ages: string[]): void { const count = Number(countValue); if (!Number.isInteger(count) || count < 0) errors[`${prefix}.numberOfChildren`] = "יש להזין מספר ילדים תקין"; if (ages.length !== count) errors[`${prefix}.childrenAges`] = "יש להזין גיל עבור כל ילד"; ages.forEach((age, index) => {if (!Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 120) errors[`${prefix}.childrenAges.${index}`] = `יש להזין גיל תקין לילד ${index + 1}`;}); }
function validateLiabilities(errors: ClientFormErrors, prefix: string, liabilityItems: LiabilityFormState[]): void {
  liabilityItems.forEach((liability, index) => {
    const key = `${prefix}.${index}`;
    required(errors, `${key}.type`, liability.type, "יש לבחור סוג התחייבות");
    if (liability.type === "OTHER_FINANCIAL_ENTITY") required(errors, `${key}.otherTypeDescription`, liability.otherTypeDescription, "יש להזין את שם הגוף או סוג ההתחייבות");
    numberField(errors, `${key}.currentBalance`, liability.currentBalance, "יש להזין יתרה נוכחית");
    numberField(errors, `${key}.monthlyPayment`, liability.monthlyPayment, "יש להזין החזר חודשי");
    if (!calculateRemainingCommitmentPeriod(liability.endDate)) errors[`${key}.endDate`] = "יש להזין תאריך סיום שאינו בעבר";
    required(errors, `${key}.notes`, liability.notes, "יש להזין הערות להתחייבות");
    if (liability.notes.length > 1000) errors[`${key}.notes`] = "ניתן להזין עד 1,000 תווים";
  });
}

export function validateClientForm(form: ClientFormState, step?: 1 | 2 | 3): ClientFormErrors {
  const errors: ClientFormErrors = {};
  if (!step || step === 1) {
    const count = Number(form.numberOfBorrowers); if (!Number.isInteger(count) || count < 1 || count > MAX_BORROWERS || form.borrowers.length !== count) errors.numberOfBorrowers = `יש להזין מספר לווים בין 1 ל-${MAX_BORROWERS}`;
    if (count > 1) required(errors, "borrowerRelationship", form.borrowerRelationship, "יש לבחור את הקשר בין הלווים");
    if (form.borrowerRelationship === "OTHER") required(errors, "borrowerRelationshipOther", form.borrowerRelationshipOther, "יש לתאר את הקשר בין הלווים");
    if (isSharedHousehold(form.borrowerRelationship)) validateChildren(errors, "household", form.householdNumberOfChildren, form.householdChildrenAges);
    const identities = new Set<string>();
    form.borrowers.forEach((borrower, index) => { const prefix = `borrowers.${index}`; required(errors, `${prefix}.firstName`, borrower.firstName, "יש להזין שם פרטי"); required(errors, `${prefix}.lastName`, borrower.lastName, "יש להזין שם משפחה"); if (!/^\d{9}$/.test(borrower.identityNumber) || identities.has(borrower.identityNumber)) errors[`${prefix}.identityNumber`] = identities.has(borrower.identityNumber) ? "מספר תעודת הזהות כבר קיים בתיק" : "יש להזין 9 ספרות ללא מקפים"; identities.add(borrower.identityNumber); const birthError = validateAdultBirthDate(borrower.birthDate); if (birthError) errors[`${prefix}.birthDate`] = birthError; required(errors, `${prefix}.phone`, borrower.phone, "יש להזין מספר טלפון"); if (!/^\S+@\S+\.\S+$/.test(borrower.email)) errors[`${prefix}.email`] = "יש להזין כתובת דוא״ל תקינה"; required(errors, `${prefix}.address`, borrower.address, "יש להזין כתובת מגורים"); required(errors, `${prefix}.maritalStatus`, borrower.maritalStatus, "יש לבחור מצב משפחתי"); if (!isSharedHousehold(form.borrowerRelationship)) validateChildren(errors, `${prefix}.children`, borrower.numberOfChildren, borrower.childrenAges); });
  }
  if (!step || step === 2) {
    form.borrowers.forEach((borrower, index) => { const prefix = `borrowers.${index}`; required(errors, `${prefix}.employmentType`, borrower.employmentType, "יש לבחור סוג תעסוקה"); required(errors, `${prefix}.employerName`, borrower.employerName, "יש להזין שם מעסיק או עסק"); required(errors, `${prefix}.jobTitle`, borrower.jobTitle, "יש להזין תפקיד"); numberField(errors, `${prefix}.employmentSeniorityYears`, borrower.employmentSeniorityYears, "יש להזין ותק תקין בשנים"); numberField(errors, `${prefix}.monthlyNetIncome`, borrower.monthlyNetIncome, "יש להזין הכנסה חודשית נטו"); if (!borrower.hasAdditionalIncome) errors[`${prefix}.hasAdditionalIncome`] = "יש לבחור האם קיימת הכנסה נוספת"; if (borrower.hasAdditionalIncome === "yes") { required(errors, `${prefix}.additionalIncomeType`, borrower.additionalIncomeType, "יש לבחור סוג הכנסה נוספת"); numberField(errors, `${prefix}.additionalIncomeAmount`, borrower.additionalIncomeAmount, "יש להזין סכום הכנסה נוספת גדול מאפס", true); if (borrower.additionalIncomeType === "OTHER") required(errors, `${prefix}.additionalIncomeDescription`, borrower.additionalIncomeDescription, "יש לתאר את ההכנסה הנוספת"); } if (!usesHouseholdLiabilities(form.borrowerRelationship)) validateLiabilities(errors, `${prefix}.liabilities`, borrower.liabilities); });
    if (usesHouseholdLiabilities(form.borrowerRelationship)) validateLiabilities(errors, "householdLiabilities", form.householdLiabilities);
  }
  if (!step || step === 3) { required(errors, "loanPurpose", form.loanPurpose, "יש לבחור מטרת הלוואה"); required(errors, "propertyType", form.propertyType, "יש לבחור סוג נכס"); if (form.propertyType === "OTHER") required(errors, "propertyTypeOtherDescription", form.propertyTypeOtherDescription, "יש לתאר את סוג הנכס"); required(errors, "propertyCity", form.propertyCity, "יש להזין את עיר הנכס"); required(errors, "propertyAddress", form.propertyAddress, "יש להזין כתובת נכס"); numberField(errors, "propertyValue", form.propertyValue, "יש להזין שווי נכס גדול מאפס", true); numberField(errors, "requestedAmount", form.requestedAmount, "יש להזין סכום מימון גדול מאפס", true); required(errors, "dealDetails", form.dealDetails, "יש להזין פירוט עסקה"); if (form.dealDetails.length > 5000) errors.dealDetails = "ניתן להזין עד 5,000 תווים"; }
  return errors;
}

const liabilityPayload = (liability: LiabilityFormState) => ({type: liability.type, otherTypeDescription: liability.type === "OTHER_FINANCIAL_ENTITY" ? liability.otherTypeDescription.trim() : null, currentBalance: Number(liability.currentBalance), monthlyPayment: Number(liability.monthlyPayment), endDate: liability.endDate, notes: liability.notes.trim()});
export function clientFormPayload(form: ClientFormState): Record<string, unknown> {
  const sharedChildren = isSharedHousehold(form.borrowerRelationship); const householdScope = usesHouseholdLiabilities(form.borrowerRelationship);
  return {numberOfBorrowers: Number(form.numberOfBorrowers), borrowerRelationship: Number(form.numberOfBorrowers) > 1 ? form.borrowerRelationship : null, borrowerRelationshipOther: form.borrowerRelationship === "OTHER" ? form.borrowerRelationshipOther.trim() : null, household: {numberOfChildren: sharedChildren ? Number(form.householdNumberOfChildren) : 0, childrenAges: sharedChildren ? form.householdChildrenAges.map(Number) : []}, borrowers: form.borrowers.map((borrower, index) => { const hasAdditionalIncome = borrower.hasAdditionalIncome === "yes"; return {order: index + 1, isPrimary: index === 0, firstName: borrower.firstName.trim(), lastName: borrower.lastName.trim(), identityNumber: borrower.identityNumber.trim(), dateOfBirth: borrower.birthDate, phone: borrower.phone.trim(), email: borrower.email.trim(), address: borrower.address.trim(), maritalStatus: borrower.maritalStatus, children: {numberOfChildren: sharedChildren ? 0 : Number(borrower.numberOfChildren), childrenAges: sharedChildren ? [] : borrower.childrenAges.map(Number)}, employment: {employmentType: borrower.employmentType, employerName: borrower.employerName.trim(), jobTitle: borrower.jobTitle.trim(), employmentSeniorityYears: Number(borrower.employmentSeniorityYears)}, income: {monthlyNetIncome: Number(borrower.monthlyNetIncome), hasAdditionalIncome, additionalIncomeType: hasAdditionalIncome ? borrower.additionalIncomeType : null, additionalIncomeAmount: hasAdditionalIncome ? Number(borrower.additionalIncomeAmount) : 0, additionalIncomeDescription: hasAdditionalIncome && borrower.additionalIncomeType === "OTHER" ? borrower.additionalIncomeDescription.trim() : null}, liabilities: householdScope ? [] : borrower.liabilities.map(liabilityPayload)};}), householdLiabilities: householdScope ? form.householdLiabilities.map(liabilityPayload) : [], loanPurpose: form.loanPurpose, property: {propertyType: form.propertyType, propertyTypeOtherDescription: form.propertyType === "OTHER" ? form.propertyTypeOtherDescription.trim() : null, city: form.propertyCity.trim(), address: form.propertyAddress.trim(), value: Number(form.propertyValue)}, loanRequest: {requestedAmount: Number(form.requestedAmount)}, dealDetails: form.dealDetails.trim(), status: "ACTIVE"};
}
