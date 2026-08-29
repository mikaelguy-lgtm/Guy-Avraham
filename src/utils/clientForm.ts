import {
  ADDITIONAL_INCOME_TYPES, BORROWER_RELATIONSHIPS, DEAL_TYPES, LIABILITY_TYPES,
  MAX_BORROWERS, PROPERTY_TYPES, SELECTABLE_EMPLOYMENT_TYPES, SELECTABLE_MARITAL_STATUSES
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
  financialInstitution?: string;
  currentBalance: string;
  monthlyPayment: string;
  endDate: string;
  notes: string;
  incompleteLegacy?: boolean;
}

export interface AdditionalIncomeFormState {
  id?: number;
  type: string;
  monthlyAmount: string;
  description: string;
}

export interface BorrowerFormState {
  id?: number;
  firstName: string; lastName: string; identityNumber: string; birthDate: string; phone: string; email: string;
  address: string; maritalStatus: string; numberOfChildren: string; childrenAges: string[];
  employmentType: string; employerName: string; jobTitle: string; employmentSeniorityYears: string;
  monthlyNetIncome: string; hasAdditionalIncome: "" | "yes" | "no"; additionalIncomeType: string;
  additionalIncomeAmount: string; additionalIncomeDescription: string; additionalIncomes: AdditionalIncomeFormState[]; liabilities: LiabilityFormState[];
  derivedAddressBackup?: string; derivedMaritalStatusBackup?: string;
}

export interface ClientFormState {
  numberOfBorrowers: string; borrowerRelationship: string; borrowerRelationshipOther: string;
  householdNumberOfChildren: string; householdChildrenAges: string[]; borrowers: BorrowerFormState[];
  householdLiabilities: LiabilityFormState[]; loanPurpose: string; propertyType: string;
  propertyTypeOtherDescription: string; propertyCity: string; propertyAddress: string; propertyValue: string;
  requestedAmount: string; dealDetails: string;
}

export type ClientFormErrors = Record<string, string>;
export const maritalStatusOptions = SELECTABLE_MARITAL_STATUSES.map((value) => [value, formatMaritalStatus(value)] as const);
export const employmentTypeOptions = SELECTABLE_EMPLOYMENT_TYPES.map((value) => [value, formatEmploymentType(value)] as const);
export const additionalIncomeTypeOptions = ADDITIONAL_INCOME_TYPES.map((value) => [value, formatAdditionalIncomeType(value)] as const);
export const borrowerRelationshipOptions = BORROWER_RELATIONSHIPS.map((value) => [value, formatBorrowerRelationship(value)] as const);
export const dealTypeOptions = DEAL_TYPES.map((value) => [value, formatDealType(value)] as const);
export const loanPurposeOptions = dealTypeOptions;
export const liabilityTypeOptions = LIABILITY_TYPES.map((value) => [value, formatLiabilityType(value)] as const);
export const propertyTypeOptions = PROPERTY_TYPES.map((value) => [value, formatPropertyType(value)] as const);

export const emptyLiabilityForm = (): LiabilityFormState => ({type: "", otherTypeDescription: "", financialInstitution: "", currentBalance: "", monthlyPayment: "", endDate: "", notes: ""});
export const emptyAdditionalIncomeForm = (): AdditionalIncomeFormState => ({type: "", monthlyAmount: "", description: ""});
export function emptyBorrowerForm(): BorrowerFormState {
  return {firstName: "", lastName: "", identityNumber: "", birthDate: "", phone: "", email: "", address: "", maritalStatus: "", numberOfChildren: "0", childrenAges: [], employmentType: "", employerName: "", jobTitle: "", employmentSeniorityYears: "", monthlyNetIncome: "", hasAdditionalIncome: "no", additionalIncomeType: "", additionalIncomeAmount: "", additionalIncomeDescription: "", additionalIncomes: [], liabilities: []};
}
export function emptyClientForm(): ClientFormState {
  return {numberOfBorrowers: "1", borrowerRelationship: "", borrowerRelationshipOther: "", householdNumberOfChildren: "0", householdChildrenAges: [], borrowers: [emptyBorrowerForm()], householdLiabilities: [], loanPurpose: "", propertyType: "", propertyTypeOtherDescription: "", propertyCity: "", propertyAddress: "", propertyValue: "", requestedAmount: "", dealDetails: ""};
}

const liabilityToForm = (liability: ClientLiability): LiabilityFormState => ({id: liability.id, type: liability.type, otherTypeDescription: liability.otherTypeDescription ?? "", financialInstitution: liability.financialInstitution ?? "", currentBalance: liability.currentBalance === null ? "" : String(liability.currentBalance), monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate ?? "", notes: liability.notes, incompleteLegacy: liability.incompleteLegacy});
function borrowerToForm(borrower: ClientBorrower): BorrowerFormState {
  return {id: borrower.id, firstName: borrower.firstName, lastName: borrower.lastName, identityNumber: borrower.identityNumber, birthDate: borrower.birthDate, phone: borrower.phone, email: borrower.email, address: borrower.address, maritalStatus: borrower.maritalStatus, numberOfChildren: String(borrower.children.numberOfChildren), childrenAges: borrower.children.childrenAges.map(String), employmentType: borrower.employment.employmentType, employerName: borrower.employment.employerName, jobTitle: borrower.employment.jobTitle, employmentSeniorityYears: String(borrower.employment.employmentSeniorityYears), monthlyNetIncome: String(borrower.income.monthlyNetIncome), hasAdditionalIncome: borrower.income.additionalIncomes.length ? "yes" : "no", additionalIncomeType: borrower.income.additionalIncomeType ?? "", additionalIncomeAmount: String(borrower.income.additionalIncomeAmount), additionalIncomeDescription: borrower.income.additionalIncomeDescription ?? "", additionalIncomes: borrower.income.additionalIncomes.map((income) => ({id: income.id, type: income.type, monthlyAmount: String(income.monthlyAmount), description: income.description ?? ""})), liabilities: borrower.liabilities.map(liabilityToForm)};
}
export function clientToForm(client: Client): ClientFormState {
  return {numberOfBorrowers: String(client.numberOfBorrowers), borrowerRelationship: client.borrowerRelationship ?? "", borrowerRelationshipOther: client.borrowerRelationshipOther ?? "", householdNumberOfChildren: String(client.household.numberOfChildren), householdChildrenAges: client.household.childrenAges.map(String), borrowers: client.borrowers.map(borrowerToForm), householdLiabilities: client.householdLiabilities.map(liabilityToForm), loanPurpose: client.loanPurpose, propertyType: client.propertyType, propertyTypeOtherDescription: client.propertyTypeOtherDescription ?? "", propertyCity: client.propertyCity, propertyAddress: client.propertyAddress, propertyValue: String(client.propertyValue), requestedAmount: String(client.requestedAmount), dealDetails: client.dealDetails};
}

export const isNonNegativeIntegerInput = (value: string): boolean => /^\d*$/.test(value);
export const isNonNegativeDecimalInput = (value: string): boolean => /^\d*(?:\.\d*)?$/.test(value);

export function resizeChildrenAges(current: string[], countValue: string): string[] {
  const count = /^\d+$/.test(countValue) ? Math.min(20, Number(countValue)) : current.length;
  return Array.from({length: count}, (_, index) => current[index] ?? "");
}
export function resizeBorrowers(current: BorrowerFormState[], countValue: string): BorrowerFormState[] {
  const count = /^\d+$/.test(countValue) ? Math.max(1, Math.min(MAX_BORROWERS, Number(countValue))) : current.length;
  return Array.from({length: count}, (_, index) => current[index] ?? emptyBorrowerForm());
}
export function moveBorrower(current: BorrowerFormState[], from: number, to: number): BorrowerFormState[] { if (from < 0 || to < 0 || from >= current.length || to >= current.length || from === to) return current; const next = [...current]; const [borrower] = next.splice(from, 1); next.splice(to, 0, borrower); return next; }
export const isSharedHousehold = (relationship: string): boolean => relationship === "MARRIED" || relationship === "COMMON_LAW";
export const usesHouseholdLiabilities = (relationship: string): boolean => relationship === "MARRIED";

export function applyBorrowerRelationship(form: ClientFormState, nextRelationship: string): ClientFormState {
  const enteringMarriage = nextRelationship === "MARRIED" && form.borrowerRelationship !== "MARRIED";
  const leavingMarriage = form.borrowerRelationship === "MARRIED" && nextRelationship !== "MARRIED";
  let householdLiabilities = form.householdLiabilities;
  let borrowers = form.borrowers;

  if (enteringMarriage) {
    const primaryAddress = borrowers[0]?.address ?? "";
    householdLiabilities = householdLiabilities.length ? householdLiabilities : borrowers.flatMap((borrower) => borrower.liabilities);
    borrowers = borrowers.map((borrower, index) => ({
      ...borrower,
      maritalStatus: "MARRIED",
      address: index === 0 ? borrower.address : primaryAddress,
      liabilities: [],
      derivedMaritalStatusBackup: borrower.maritalStatus,
      derivedAddressBackup: index === 0 ? undefined : borrower.address
    }));
  } else if (leavingMarriage) {
    borrowers = borrowers.map((borrower, index) => {
      const {derivedAddressBackup, derivedMaritalStatusBackup, ...rest} = borrower;
      return {
        ...rest,
        maritalStatus: derivedMaritalStatusBackup ?? "",
        address: index === 0 ? borrower.address : derivedAddressBackup ?? "",
        liabilities: index === 0 ? [...borrower.liabilities, ...householdLiabilities] : borrower.liabilities
      };
    });
    householdLiabilities = [];
  }

  return {...form, borrowerRelationship: nextRelationship, householdLiabilities, borrowers};
}

function required(errors: ClientFormErrors, key: string, value: string, message: string): void { if (!value.trim()) errors[key] = message; }
function numberField(errors: ClientFormErrors, key: string, value: string, message: string, positive = false): void { const number = Number(value); if (!value.trim() || !isNonNegativeDecimalInput(value) || !Number.isFinite(number) || (positive && number <= 0)) errors[key] = message; }
function validateChildren(errors: ClientFormErrors, prefix: string, countValue: string, ages: string[]): void { const count = Number(countValue); if (!isNonNegativeIntegerInput(countValue) || !countValue || !Number.isInteger(count) || count > 20) errors[`${prefix}.numberOfChildren`] = "יש להזין מספר ילדים תקין"; if (ages.length !== count) errors[`${prefix}.childrenAges`] = "יש להזין גיל עבור כל ילד"; ages.forEach((age, index) => {if (!isNonNegativeIntegerInput(age) || !age || !Number.isInteger(Number(age)) || Number(age) > 120) errors[`${prefix}.childrenAges.${index}`] = `יש להזין גיל תקין לילד ${index + 1}`;}); }
function validateLiabilities(errors: ClientFormErrors, prefix: string, liabilityItems: LiabilityFormState[]): void {
  liabilityItems.forEach((liability, index) => {
    const key = `${prefix}.${index}`;
    required(errors, `${key}.type`, liability.type, "יש לבחור סוג התחייבות");
    if (liability.type === "OTHER_FINANCIAL_ENTITY") required(errors, `${key}.otherTypeDescription`, liability.otherTypeDescription, "יש להזין את שם הגוף או סוג ההתחייבות");
    if (liability.type !== "ALIMONY" && liability.type !== "RENT") numberField(errors, `${key}.currentBalance`, liability.currentBalance, "יש להזין יתרה נוכחית");
    if (liability.type === "LOAN" || liability.type === "MORTGAGE") required(errors, `${key}.financialInstitution`, liability.financialInstitution ?? "", "יש להזין את הגוף הפיננסי");
    numberField(errors, `${key}.monthlyPayment`, liability.monthlyPayment, "יש להזין החזר חודשי");
    if (!calculateRemainingCommitmentPeriod(liability.endDate)) errors[`${key}.endDate`] = "יש להזין תאריך סיום שאינו בעבר";
    required(errors, `${key}.notes`, liability.notes, "יש להזין הערות להתחייבות");
    if (liability.notes.length > 1000) errors[`${key}.notes`] = "ניתן להזין עד 1,000 תווים";
  });
}

function validatePersonalSection(form: ClientFormState, errors: ClientFormErrors): void {
  const count = Number(form.numberOfBorrowers); if (!isNonNegativeIntegerInput(form.numberOfBorrowers) || !form.numberOfBorrowers || !Number.isInteger(count) || count < 1 || count > MAX_BORROWERS || form.borrowers.length !== count) errors.numberOfBorrowers = `יש להזין מספר לווים בין 1 ל-${MAX_BORROWERS}`;
  if (count > 1) required(errors, "borrowerRelationship", form.borrowerRelationship, "יש לבחור את הקשר בין הלווים");
  if (form.borrowerRelationship === "OTHER") required(errors, "borrowerRelationshipOther", form.borrowerRelationshipOther, "יש לתאר את הקשר בין הלווים");
  if (isSharedHousehold(form.borrowerRelationship)) validateChildren(errors, "household", form.householdNumberOfChildren, form.householdChildrenAges);
  const identities = new Set<string>();
  form.borrowers.forEach((borrower, index) => { const prefix = `borrowers.${index}`; required(errors, `${prefix}.firstName`, borrower.firstName, "יש להזין שם פרטי"); required(errors, `${prefix}.lastName`, borrower.lastName, "יש להזין שם משפחה"); if (!/^\d{9}$/.test(borrower.identityNumber) || identities.has(borrower.identityNumber)) errors[`${prefix}.identityNumber`] = identities.has(borrower.identityNumber) ? "מספר תעודת הזהות כבר קיים בתיק" : "יש להזין 9 ספרות ללא מקפים"; identities.add(borrower.identityNumber); const birthError = validateAdultBirthDate(borrower.birthDate); if (birthError) errors[`${prefix}.birthDate`] = birthError; required(errors, `${prefix}.phone`, borrower.phone, "יש להזין מספר טלפון"); if (!/^\S+@\S+\.\S+$/.test(borrower.email)) errors[`${prefix}.email`] = "יש להזין כתובת דוא״ל תקינה"; if (form.borrowerRelationship !== "MARRIED" || index === 0) required(errors, `${prefix}.address`, borrower.address, "יש להזין כתובת מגורים"); if (form.borrowerRelationship !== "MARRIED") required(errors, `${prefix}.maritalStatus`, borrower.maritalStatus, "יש לבחור מצב משפחתי"); if (!isSharedHousehold(form.borrowerRelationship)) validateChildren(errors, `${prefix}.children`, borrower.numberOfChildren, borrower.childrenAges); });
}

function validateIncomeSection(form: ClientFormState, errors: ClientFormErrors): void {
  form.borrowers.forEach((borrower, index) => {
    const prefix = `borrowers.${index}`;
    required(errors, `${prefix}.employmentType`, borrower.employmentType, "יש לבחור סוג תעסוקה");
    required(errors, `${prefix}.employerName`, borrower.employerName, "יש להזין שם מעסיק או עסק");
    required(errors, `${prefix}.jobTitle`, borrower.jobTitle, "יש להזין תפקיד");
    numberField(errors, `${prefix}.employmentSeniorityYears`, borrower.employmentSeniorityYears, "יש להזין ותק תקין בשנים");
    numberField(errors, `${prefix}.monthlyNetIncome`, borrower.monthlyNetIncome, "יש להזין הכנסה חודשית נטו");
    borrower.additionalIncomes.forEach((income, incomeIndex) => {
      const incomePrefix = `${prefix}.additionalIncomes.${incomeIndex}`;
      required(errors, `${incomePrefix}.type`, income.type, "יש לבחור סוג הכנסה נוספת");
      numberField(errors, `${incomePrefix}.monthlyAmount`, income.monthlyAmount, "יש להזין סכום הכנסה נוסף שאינו שלילי");
      if (income.type === "OTHER") required(errors, `${incomePrefix}.description`, income.description, "יש לתאר את ההכנסה הנוספת");
    });
  });
}

function validateLiabilitiesSection(form: ClientFormState, errors: ClientFormErrors): void {
  if (usesHouseholdLiabilities(form.borrowerRelationship)) validateLiabilities(errors, "householdLiabilities", form.householdLiabilities);
  else form.borrowers.forEach((borrower, index) => validateLiabilities(errors, `borrowers.${index}.liabilities`, borrower.liabilities));
}

function validatePropertySection(form: ClientFormState, errors: ClientFormErrors): void {
  required(errors, "loanPurpose", form.loanPurpose, "יש לבחור מטרת הלוואה"); required(errors, "propertyType", form.propertyType, "יש לבחור סוג נכס"); if (form.propertyType === "OTHER") required(errors, "propertyTypeOtherDescription", form.propertyTypeOtherDescription, "יש לתאר את סוג הנכס"); required(errors, "propertyCity", form.propertyCity, "יש להזין את עיר הנכס"); required(errors, "propertyAddress", form.propertyAddress, "יש להזין כתובת נכס"); numberField(errors, "propertyValue", form.propertyValue, "יש להזין ערך חיובי או 0"); numberField(errors, "requestedAmount", form.requestedAmount, "יש להזין ערך חיובי או 0");
}

function validateDealDetailsSection(form: ClientFormState, errors: ClientFormErrors): void {
  required(errors, "dealDetails", form.dealDetails, "יש להזין פירוט עסקה"); if (form.dealDetails.length > 5000) errors.dealDetails = "ניתן להזין עד 5,000 תווים";
}

export type ClientEditSection = "personal" | "income" | "liabilities" | "property" | "deal-details";

export function validateClientFormSection(form: ClientFormState, section: ClientEditSection): ClientFormErrors {
  const errors: ClientFormErrors = {};
  if (section === "personal") validatePersonalSection(form, errors);
  if (section === "income") validateIncomeSection(form, errors);
  if (section === "liabilities") validateLiabilitiesSection(form, errors);
  if (section === "property") validatePropertySection(form, errors);
  if (section === "deal-details") validateDealDetailsSection(form, errors);
  return errors;
}

export function validateClientForm(form: ClientFormState, step?: 1 | 2 | 3): ClientFormErrors {
  const errors: ClientFormErrors = {};
  if (!step || step === 1) validatePersonalSection(form, errors);
  if (!step || step === 2) { validateIncomeSection(form, errors); validateLiabilitiesSection(form, errors); }
  if (!step || step === 3) { validatePropertySection(form, errors); validateDealDetailsSection(form, errors); }
  return errors;
}

const liabilityPayload = (liability: LiabilityFormState) => ({type: liability.type, otherTypeDescription: liability.type === "OTHER_FINANCIAL_ENTITY" ? liability.otherTypeDescription.trim() : null, financialInstitution: liability.type === "LOAN" || liability.type === "MORTGAGE" ? (liability.financialInstitution ?? "").trim() : null, currentBalance: liability.type === "ALIMONY" || liability.type === "RENT" ? null : Number(liability.currentBalance), monthlyPayment: Number(liability.monthlyPayment), endDate: liability.endDate, notes: liability.notes.trim()});
const personalBorrowerPayload = (borrower: BorrowerFormState, index: number, sharedChildren: boolean, relationship: string, primaryAddress: string) => ({id: borrower.id, order: index + 1, isPrimary: index === 0, firstName: borrower.firstName.trim(), lastName: borrower.lastName.trim(), identityNumber: borrower.identityNumber.trim(), dateOfBirth: borrower.birthDate, phone: borrower.phone.trim(), email: borrower.email.trim(), address: (relationship === "MARRIED" && index > 0 ? primaryAddress : borrower.address).trim(), maritalStatus: relationship === "MARRIED" ? "MARRIED" : borrower.maritalStatus, children: {numberOfChildren: sharedChildren ? 0 : Number(borrower.numberOfChildren), childrenAges: sharedChildren ? [] : borrower.childrenAges.map(Number)}});
const incomeBorrowerPayload = (borrower: BorrowerFormState) => ({id: borrower.id, employment: {employmentType: borrower.employmentType, employerName: borrower.employerName.trim(), jobTitle: borrower.jobTitle.trim(), employmentSeniorityYears: Number(borrower.employmentSeniorityYears)}, income: {monthlyNetIncome: Number(borrower.monthlyNetIncome), additionalIncomes: borrower.additionalIncomes.map((income) => ({type: income.type, monthlyAmount: Number(income.monthlyAmount), description: income.type === "OTHER" ? income.description.trim() : null}))}});

export function clientPersonalPayload(form: ClientFormState): Record<string, unknown> {
  const sharedChildren = isSharedHousehold(form.borrowerRelationship);
  return {numberOfBorrowers: Number(form.numberOfBorrowers), borrowerRelationship: Number(form.numberOfBorrowers) > 1 ? form.borrowerRelationship : null, borrowerRelationshipOther: form.borrowerRelationship === "OTHER" ? form.borrowerRelationshipOther.trim() : null, household: {numberOfChildren: sharedChildren ? Number(form.householdNumberOfChildren) : 0, childrenAges: sharedChildren ? form.householdChildrenAges.map(Number) : []}, borrowers: form.borrowers.map((borrower, index) => personalBorrowerPayload(borrower, index, sharedChildren, form.borrowerRelationship, form.borrowers[0]?.address ?? ""))};
}
export const clientIncomePayload = (form: ClientFormState): Record<string, unknown> => ({borrowers: form.borrowers.map(incomeBorrowerPayload)});
export const clientLiabilitiesPayload = (form: ClientFormState): Record<string, unknown> => ({borrowerRelationship: Number(form.numberOfBorrowers) > 1 ? form.borrowerRelationship : null, borrowers: form.borrowers.map((borrower) => ({id: borrower.id, liabilities: usesHouseholdLiabilities(form.borrowerRelationship) ? [] : borrower.liabilities.map(liabilityPayload)})), householdLiabilities: usesHouseholdLiabilities(form.borrowerRelationship) ? form.householdLiabilities.map(liabilityPayload) : []});
export const clientPropertyPayload = (form: ClientFormState): Record<string, unknown> => ({loanPurpose: form.loanPurpose, property: {propertyType: form.propertyType, propertyTypeOtherDescription: form.propertyType === "OTHER" ? form.propertyTypeOtherDescription.trim() : null, city: form.propertyCity.trim(), address: form.propertyAddress.trim(), value: Number(form.propertyValue)}, loanRequest: {requestedAmount: Number(form.requestedAmount)}});
export const clientDealDetailsPayload = (form: ClientFormState): Record<string, unknown> => ({dealDetails: form.dealDetails.trim()});
export const hasClientFormChanges = (initial: ClientFormState, current: ClientFormState): boolean => JSON.stringify(initial) !== JSON.stringify(current);

export function clientFormPayload(form: ClientFormState): Record<string, unknown> {
  const sharedChildren = isSharedHousehold(form.borrowerRelationship); const householdScope = usesHouseholdLiabilities(form.borrowerRelationship);
  return {numberOfBorrowers: Number(form.numberOfBorrowers), borrowerRelationship: Number(form.numberOfBorrowers) > 1 ? form.borrowerRelationship : null, borrowerRelationshipOther: form.borrowerRelationship === "OTHER" ? form.borrowerRelationshipOther.trim() : null, household: {numberOfChildren: sharedChildren ? Number(form.householdNumberOfChildren) : 0, childrenAges: sharedChildren ? form.householdChildrenAges.map(Number) : []}, borrowers: form.borrowers.map((borrower, index) => ({...personalBorrowerPayload(borrower, index, sharedChildren, form.borrowerRelationship, form.borrowers[0]?.address ?? ""), ...incomeBorrowerPayload(borrower), liabilities: householdScope ? [] : borrower.liabilities.map(liabilityPayload)})), householdLiabilities: householdScope ? form.householdLiabilities.map(liabilityPayload) : [], loanPurpose: form.loanPurpose, property: {propertyType: form.propertyType, propertyTypeOtherDescription: form.propertyType === "OTHER" ? form.propertyTypeOtherDescription.trim() : null, city: form.propertyCity.trim(), address: form.propertyAddress.trim(), value: Number(form.propertyValue)}, loanRequest: {requestedAmount: Number(form.requestedAmount)}, dealDetails: form.dealDetails.trim(), status: "ACTIVE"};
}
