import {
  ADDITIONAL_INCOME_TYPES,
  BORROWER_RELATIONSHIPS,
  DEAL_TYPES,
  EMPLOYMENT_TYPES,
  MARITAL_STATUSES,
  MAX_BORROWERS,
  PROPERTY_REGIONS,
  PROPERTY_TYPES
} from "../domain/clientFields";
import type { Client, ClientBorrower } from "../types";
import { validateAdultBirthDate } from "./age";
import {
  formatAdditionalIncomeType,
  formatBorrowerRelationship,
  formatDealType,
  formatEmploymentType,
  formatMaritalStatus,
  formatPropertyType,
  formatRegion
} from "./formatters";

export interface BorrowerFormState {
  firstName: string;
  lastName: string;
  identityNumber: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  maritalStatus: string;
  numberOfChildren: string;
  childrenAges: string[];
  employmentType: string;
  employerName: string;
  jobTitle: string;
  employmentSeniorityYears: string;
  monthlyNetIncome: string;
  hasAdditionalIncome: "" | "yes" | "no";
  additionalIncomeType: string;
  additionalIncomeAmount: string;
  additionalIncomeDescription: string;
  monthlyLiabilities: string;
  existingMortgageBalance: string;
  existingMortgageMonthlyPayment: string;
}

export interface ClientFormState {
  numberOfBorrowers: string;
  borrowerRelationship: string;
  borrowerRelationshipOther: string;
  householdNumberOfChildren: string;
  householdChildrenAges: string[];
  borrowers: BorrowerFormState[];
  dealType: string;
  propertyType: string;
  propertyTypeOtherDescription: string;
  propertyCity: string;
  propertyRegion: string;
  propertyAddress: string;
  propertyValue: string;
  requestedAmount: string;
  requestedTermMonths: string;
  notes: string;
}

export type ClientFormErrors = Record<string, string>;

export const maritalStatusOptions = MARITAL_STATUSES.map((value) => [value, formatMaritalStatus(value)] as const);
export const employmentTypeOptions = EMPLOYMENT_TYPES.map((value) => [value, formatEmploymentType(value)] as const);
export const additionalIncomeTypeOptions = ADDITIONAL_INCOME_TYPES.map((value) => [value, formatAdditionalIncomeType(value)] as const);
export const borrowerRelationshipOptions = BORROWER_RELATIONSHIPS.map((value) => [value, formatBorrowerRelationship(value)] as const);
export const dealTypeOptions = DEAL_TYPES.map((value) => [value, formatDealType(value)] as const);
export const propertyTypeOptions = PROPERTY_TYPES.map((value) => [value, formatPropertyType(value)] as const);
export const propertyRegionOptions = PROPERTY_REGIONS.map((value) => [value, formatRegion(value)] as const);

export function emptyBorrowerForm(): BorrowerFormState {
  return {
    firstName: "", lastName: "", identityNumber: "", birthDate: "", phone: "", email: "", address: "",
    maritalStatus: "", numberOfChildren: "0", childrenAges: [], employmentType: "", employerName: "",
    jobTitle: "", employmentSeniorityYears: "", monthlyNetIncome: "", hasAdditionalIncome: "",
    additionalIncomeType: "", additionalIncomeAmount: "", additionalIncomeDescription: "",
    monthlyLiabilities: "", existingMortgageBalance: "", existingMortgageMonthlyPayment: ""
  };
}

export function emptyClientForm(): ClientFormState {
  return {
    numberOfBorrowers: "1", borrowerRelationship: "", borrowerRelationshipOther: "",
    householdNumberOfChildren: "0", householdChildrenAges: [], borrowers: [emptyBorrowerForm()],
    dealType: "", propertyType: "", propertyTypeOtherDescription: "", propertyCity: "", propertyRegion: "",
    propertyAddress: "", propertyValue: "", requestedAmount: "", requestedTermMonths: "", notes: ""
  };
}

function borrowerToForm(borrower: ClientBorrower): BorrowerFormState {
  return {
    firstName: borrower.firstName, lastName: borrower.lastName, identityNumber: borrower.identityNumber,
    birthDate: borrower.birthDate, phone: borrower.phone, email: borrower.email, address: borrower.address,
    maritalStatus: borrower.maritalStatus, numberOfChildren: String(borrower.children.numberOfChildren),
    childrenAges: borrower.children.childrenAges.map(String), employmentType: borrower.employment.employmentType,
    employerName: borrower.employment.employerName, jobTitle: borrower.employment.jobTitle,
    employmentSeniorityYears: String(borrower.employment.employmentSeniorityYears),
    monthlyNetIncome: String(borrower.income.monthlyNetIncome), hasAdditionalIncome: borrower.income.hasAdditionalIncome ? "yes" : "no",
    additionalIncomeType: borrower.income.additionalIncomeType ?? "", additionalIncomeAmount: String(borrower.income.additionalIncomeAmount),
    additionalIncomeDescription: borrower.income.additionalIncomeDescription ?? "", monthlyLiabilities: String(borrower.liabilities.monthlyLiabilities),
    existingMortgageBalance: String(borrower.liabilities.existingMortgageBalance),
    existingMortgageMonthlyPayment: String(borrower.liabilities.existingMortgageMonthlyPayment)
  };
}

export function clientToForm(client: Client): ClientFormState {
  const borrowers = client.borrowers.length ? client.borrowers.map(borrowerToForm) : [borrowerToForm({
    id: 0, borrowerOrder: 1, isPrimary: true, firstName: client.firstName, lastName: client.lastName,
    identityNumber: client.identityNumber, birthDate: client.birthDate, age: null, calculatedAge: null, phone: client.phone, email: client.email,
    address: client.address, maritalStatus: client.maritalStatus, children: {numberOfChildren: client.numberOfChildren, childrenAges: client.childrenAges},
    employment: {employmentType: client.employmentType, employerName: client.employerName, jobTitle: client.jobTitle, employmentSeniorityYears: client.employmentSeniorityYears},
    income: {monthlyNetIncome: client.monthlyNetIncome, hasAdditionalIncome: client.hasAdditionalIncome, additionalIncomeType: client.additionalIncomeType, additionalIncomeAmount: client.additionalIncomeAmount, additionalIncomeDescription: client.additionalIncomeDescription},
    liabilities: {monthlyLiabilities: client.monthlyLiabilities, existingMortgageBalance: client.existingMortgageBalance, existingMortgageMonthlyPayment: client.existingMortgageMonthlyPayment}
  })];
  return {
    numberOfBorrowers: String(client.numberOfBorrowers || borrowers.length),
    borrowerRelationship: client.borrowerRelationship ?? "",
    borrowerRelationshipOther: client.borrowerRelationshipOther ?? "",
    householdNumberOfChildren: String(client.household.numberOfChildren),
    householdChildrenAges: client.household.childrenAges.map(String),
    borrowers,
    dealType: client.dealType, propertyType: client.propertyType,
    propertyTypeOtherDescription: client.propertyTypeOtherDescription ?? "", propertyCity: client.propertyCity,
    propertyRegion: client.propertyRegion, propertyAddress: client.propertyAddress, propertyValue: String(client.propertyValue),
    requestedAmount: String(client.requestedAmount), requestedTermMonths: String(client.requestedTermMonths), notes: client.notes
  };
}

export function resizeChildrenAges(current: string[], countValue: string): string[] {
  const count = Math.max(0, Math.min(20, Number.parseInt(countValue, 10) || 0));
  return Array.from({length: count}, (_, index) => current[index] ?? "");
}

export function resizeBorrowers(current: BorrowerFormState[], countValue: string): BorrowerFormState[] {
  const count = Math.max(1, Math.min(MAX_BORROWERS, Number.parseInt(countValue, 10) || 1));
  return Array.from({length: count}, (_, index) => current[index] ?? emptyBorrowerForm());
}

export function moveBorrower(current: BorrowerFormState[], from: number, to: number): BorrowerFormState[] {
  if (from < 0 || to < 0 || from >= current.length || to >= current.length || from === to) return current;
  const next = [...current];
  const [borrower] = next.splice(from, 1);
  next.splice(to, 0, borrower);
  return next;
}

export function isSharedHousehold(relationship: string): boolean {
  return relationship === "MARRIED" || relationship === "COMMON_LAW";
}

function required(errors: ClientFormErrors, key: string, value: string, message: string): void {
  if (!value.trim()) errors[key] = message;
}

function numberField(errors: ClientFormErrors, key: string, value: string, message: string, options: {positive?: boolean; integer?: boolean} = {}): void {
  if (value.trim() === "") { errors[key] = message; return; }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (options.positive && number <= 0) || (options.integer && !Number.isInteger(number))) errors[key] = message;
}

function validateChildren(errors: ClientFormErrors, prefix: string, countValue: string, ages: string[]): void {
  numberField(errors, `${prefix}.numberOfChildren`, countValue, "יש להזין מספר ילדים תקין", {integer: true});
  const count = Number(countValue);
  if (Number.isInteger(count) && count >= 0 && ages.length !== count) errors[`${prefix}.childrenAges`] = "יש להזין גיל עבור כל ילד";
  ages.forEach((age, index) => {
    if (age.trim() === "" || !Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 120) errors[`${prefix}.childrenAges.${index}`] = `יש להזין גיל תקין לילד ${index + 1}`;
  });
}

export function validateClientForm(form: ClientFormState, step?: 1 | 2 | 3): ClientFormErrors {
  const errors: ClientFormErrors = {};
  if (!step || step === 1) {
    numberField(errors, "numberOfBorrowers", form.numberOfBorrowers, `יש להזין מספר לווים בין 1 ל-${MAX_BORROWERS}`, {positive: true, integer: true});
    const borrowerCount = Number(form.numberOfBorrowers);
    if (borrowerCount < 1 || borrowerCount > MAX_BORROWERS || form.borrowers.length !== borrowerCount) errors.numberOfBorrowers = `יש להזין מספר לווים בין 1 ל-${MAX_BORROWERS}`;
    if (borrowerCount > 1) required(errors, "borrowerRelationship", form.borrowerRelationship, "יש לבחור את הקשר בין הלווים");
    if (form.borrowerRelationship === "OTHER") required(errors, "borrowerRelationshipOther", form.borrowerRelationshipOther, "יש לתאר את הקשר בין הלווים");
    if (isSharedHousehold(form.borrowerRelationship)) validateChildren(errors, "household", form.householdNumberOfChildren, form.householdChildrenAges);
    const identities = new Set<string>();
    form.borrowers.forEach((borrower, index) => {
      const prefix = `borrowers.${index}`;
      required(errors, `${prefix}.firstName`, borrower.firstName, "יש להזין שם פרטי");
      required(errors, `${prefix}.lastName`, borrower.lastName, "יש להזין שם משפחה");
      if (!/^\d{9}$/.test(borrower.identityNumber)) errors[`${prefix}.identityNumber`] = "יש להזין 9 ספרות ללא מקפים";
      else if (identities.has(borrower.identityNumber)) errors[`${prefix}.identityNumber`] = "מספר תעודת הזהות כבר קיים בתיק";
      identities.add(borrower.identityNumber);
      const birthDateError = validateAdultBirthDate(borrower.birthDate);
      if (birthDateError) errors[`${prefix}.birthDate`] = birthDateError;
      required(errors, `${prefix}.phone`, borrower.phone, "יש להזין מספר טלפון");
      if (!/^\S+@\S+\.\S+$/.test(borrower.email)) errors[`${prefix}.email`] = "יש להזין כתובת דוא״ל תקינה";
      required(errors, `${prefix}.address`, borrower.address, "יש להזין כתובת מגורים");
      required(errors, `${prefix}.maritalStatus`, borrower.maritalStatus, "יש לבחור מצב משפחתי");
      if (!isSharedHousehold(form.borrowerRelationship)) validateChildren(errors, `${prefix}.children`, borrower.numberOfChildren, borrower.childrenAges);
    });
  }
  if (!step || step === 2) {
    form.borrowers.forEach((borrower, index) => {
      const prefix = `borrowers.${index}`;
      required(errors, `${prefix}.employmentType`, borrower.employmentType, "יש לבחור סוג תעסוקה");
      required(errors, `${prefix}.employerName`, borrower.employerName, "יש להזין שם מעסיק או עסק");
      required(errors, `${prefix}.jobTitle`, borrower.jobTitle, "יש להזין תפקיד");
      numberField(errors, `${prefix}.employmentSeniorityYears`, borrower.employmentSeniorityYears, "יש להזין ותק תקין בשנים", {integer: true});
      numberField(errors, `${prefix}.monthlyNetIncome`, borrower.monthlyNetIncome, "יש להזין הכנסה חודשית נטו");
      if (!borrower.hasAdditionalIncome) errors[`${prefix}.hasAdditionalIncome`] = "יש לבחור האם קיימת הכנסה נוספת";
      if (borrower.hasAdditionalIncome === "yes") {
        required(errors, `${prefix}.additionalIncomeType`, borrower.additionalIncomeType, "יש לבחור סוג הכנסה נוספת");
        numberField(errors, `${prefix}.additionalIncomeAmount`, borrower.additionalIncomeAmount, "יש להזין סכום הכנסה נוספת גדול מאפס", {positive: true});
        if (borrower.additionalIncomeType === "OTHER") required(errors, `${prefix}.additionalIncomeDescription`, borrower.additionalIncomeDescription, "יש לתאר את ההכנסה הנוספת");
      }
      numberField(errors, `${prefix}.monthlyLiabilities`, borrower.monthlyLiabilities, "יש להזין התחייבויות חודשיות");
      numberField(errors, `${prefix}.existingMortgageBalance`, borrower.existingMortgageBalance, "יש להזין יתרת משכנתה קיימת");
      numberField(errors, `${prefix}.existingMortgageMonthlyPayment`, borrower.existingMortgageMonthlyPayment, "יש להזין החזר משכנתה חודשי");
    });
  }
  if (!step || step === 3) {
    required(errors, "dealType", form.dealType, "יש לבחור סוג עסקה");
    required(errors, "propertyType", form.propertyType, "יש לבחור סוג נכס");
    if (form.propertyType === "OTHER") required(errors, "propertyTypeOtherDescription", form.propertyTypeOtherDescription, "יש לתאר את סוג הנכס");
    required(errors, "propertyCity", form.propertyCity, "יש להזין את עיר הנכס");
    required(errors, "propertyRegion", form.propertyRegion, "יש לבחור אזור");
    required(errors, "propertyAddress", form.propertyAddress, "יש להזין כתובת נכס");
    numberField(errors, "propertyValue", form.propertyValue, "יש להזין שווי נכס גדול מאפס", {positive: true});
    numberField(errors, "requestedAmount", form.requestedAmount, "יש להזין סכום מימון גדול מאפס", {positive: true});
    numberField(errors, "requestedTermMonths", form.requestedTermMonths, "יש להזין תקופת הלוואה בחודשים", {positive: true, integer: true});
    required(errors, "notes", form.notes, "יש להזין הערות מקצועיות");
  }
  return errors;
}

export function clientFormPayload(form: ClientFormState): Record<string, unknown> {
  const sharedHousehold = isSharedHousehold(form.borrowerRelationship);
  return {
    numberOfBorrowers: Number(form.numberOfBorrowers),
    borrowerRelationship: Number(form.numberOfBorrowers) > 1 ? form.borrowerRelationship : null,
    borrowerRelationshipOther: form.borrowerRelationship === "OTHER" ? form.borrowerRelationshipOther.trim() : null,
    household: {
      numberOfChildren: sharedHousehold ? Number(form.householdNumberOfChildren) : 0,
      childrenAges: sharedHousehold ? form.householdChildrenAges.map(Number) : []
    },
    borrowers: form.borrowers.map((borrower, index) => {
      const hasAdditionalIncome = borrower.hasAdditionalIncome === "yes";
      return {
        order: index + 1, isPrimary: index === 0,
        firstName: borrower.firstName.trim(), lastName: borrower.lastName.trim(), identityNumber: borrower.identityNumber.trim(),
        dateOfBirth: borrower.birthDate, phone: borrower.phone.trim(), email: borrower.email.trim(), address: borrower.address.trim(),
        maritalStatus: borrower.maritalStatus,
        children: {numberOfChildren: sharedHousehold ? 0 : Number(borrower.numberOfChildren), childrenAges: sharedHousehold ? [] : borrower.childrenAges.map(Number)},
        employment: {employmentType: borrower.employmentType, employerName: borrower.employerName.trim(), jobTitle: borrower.jobTitle.trim(), employmentSeniorityYears: Number(borrower.employmentSeniorityYears)},
        income: {monthlyNetIncome: Number(borrower.monthlyNetIncome), hasAdditionalIncome, additionalIncomeType: hasAdditionalIncome ? borrower.additionalIncomeType : null, additionalIncomeAmount: hasAdditionalIncome ? Number(borrower.additionalIncomeAmount) : 0, additionalIncomeDescription: hasAdditionalIncome && borrower.additionalIncomeType === "OTHER" ? borrower.additionalIncomeDescription.trim() : null},
        liabilities: {monthlyLiabilities: Number(borrower.monthlyLiabilities), existingMortgageBalance: Number(borrower.existingMortgageBalance), existingMortgageMonthlyPayment: Number(borrower.existingMortgageMonthlyPayment)}
      };
    }),
    property: {propertyType: form.propertyType, propertyTypeOtherDescription: form.propertyType === "OTHER" ? form.propertyTypeOtherDescription.trim() : null, city: form.propertyCity.trim(), region: form.propertyRegion, address: form.propertyAddress.trim(), value: Number(form.propertyValue)},
    loanRequest: {dealType: form.dealType, requestedAmount: Number(form.requestedAmount), requestedTermMonths: Number(form.requestedTermMonths)},
    notes: form.notes.trim(), status: "ACTIVE"
  };
}
