import {
  ADDITIONAL_INCOME_TYPES,
  DEAL_TYPES,
  EMPLOYMENT_TYPES,
  MARITAL_STATUSES,
  PROPERTY_REGIONS,
  PROPERTY_TYPES
} from "../domain/clientFields";
import type { Client } from "../types";
import {
  formatAdditionalIncomeType,
  formatDealType,
  formatEmploymentType,
  formatMaritalStatus,
  formatPropertyType,
  formatRegion
} from "./formatters";

export interface ClientFormState {
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
  borrowerCount: string;
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
export const dealTypeOptions = DEAL_TYPES.map((value) => [value, formatDealType(value)] as const);
export const propertyTypeOptions = PROPERTY_TYPES.map((value) => [value, formatPropertyType(value)] as const);
export const propertyRegionOptions = PROPERTY_REGIONS.map((value) => [value, formatRegion(value)] as const);

export function emptyClientForm(): ClientFormState {
  return {
    firstName: "", lastName: "", identityNumber: "", birthDate: "", phone: "", email: "", address: "",
    maritalStatus: "", numberOfChildren: "", childrenAges: [], borrowerCount: "",
    employmentType: "", employerName: "", jobTitle: "", employmentSeniorityYears: "", monthlyNetIncome: "",
    hasAdditionalIncome: "", additionalIncomeType: "", additionalIncomeAmount: "", additionalIncomeDescription: "",
    monthlyLiabilities: "", existingMortgageBalance: "", existingMortgageMonthlyPayment: "",
    dealType: "", propertyType: "", propertyTypeOtherDescription: "", propertyCity: "", propertyRegion: "",
    propertyAddress: "", propertyValue: "", requestedAmount: "", requestedTermMonths: "", notes: ""
  };
}

export function clientToForm(client: Client): ClientFormState {
  return {
    firstName: client.firstName, lastName: client.lastName, identityNumber: client.identityNumber,
    birthDate: client.birthDate, phone: client.phone, email: client.email, address: client.address,
    maritalStatus: client.maritalStatus, numberOfChildren: String(client.numberOfChildren),
    childrenAges: client.childrenAges.map(String), borrowerCount: String(client.borrowerCount),
    employmentType: client.employmentType, employerName: client.employerName, jobTitle: client.jobTitle,
    employmentSeniorityYears: String(client.employmentSeniorityYears), monthlyNetIncome: String(client.monthlyNetIncome),
    hasAdditionalIncome: client.hasAdditionalIncome ? "yes" : "no",
    additionalIncomeType: client.additionalIncomeType ?? "", additionalIncomeAmount: String(client.additionalIncomeAmount),
    additionalIncomeDescription: client.additionalIncomeDescription ?? "", monthlyLiabilities: String(client.monthlyLiabilities),
    existingMortgageBalance: String(client.existingMortgageBalance),
    existingMortgageMonthlyPayment: String(client.existingMortgageMonthlyPayment), dealType: client.dealType,
    propertyType: client.propertyType, propertyTypeOtherDescription: client.propertyTypeOtherDescription ?? "",
    propertyCity: client.propertyCity, propertyRegion: client.propertyRegion, propertyAddress: client.propertyAddress,
    propertyValue: String(client.propertyValue), requestedAmount: String(client.requestedAmount),
    requestedTermMonths: String(client.requestedTermMonths), notes: client.notes
  };
}

function required(errors: ClientFormErrors, key: keyof ClientFormState, value: string, message: string): void {
  if (!value.trim()) errors[key] = message;
}

function numberField(errors: ClientFormErrors, key: keyof ClientFormState, value: string, message: string, options: {positive?: boolean; integer?: boolean} = {}): void {
  if (value.trim() === "") { errors[key] = message; return; }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (options.positive && number <= 0) || (options.integer && !Number.isInteger(number))) errors[key] = message;
}

export function resizeChildrenAges(current: string[], countValue: string): string[] {
  const count = Math.max(0, Math.min(20, Number.parseInt(countValue, 10) || 0));
  return Array.from({length: count}, (_, index) => current[index] ?? "");
}

export function validateClientForm(form: ClientFormState, step?: 1 | 2 | 3): ClientFormErrors {
  const errors: ClientFormErrors = {};
  if (!step || step === 1) {
    required(errors, "firstName", form.firstName, "יש להזין שם פרטי");
    required(errors, "lastName", form.lastName, "יש להזין שם משפחה");
    if (!/^\d{9}$/.test(form.identityNumber)) errors.identityNumber = "יש להזין 9 ספרות ללא מקפים";
    required(errors, "birthDate", form.birthDate, "יש להזין תאריך לידה");
    required(errors, "phone", form.phone, "יש להזין מספר טלפון");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "יש להזין כתובת דוא״ל תקינה";
    required(errors, "address", form.address, "יש להזין כתובת מגורים");
    required(errors, "maritalStatus", form.maritalStatus, "יש לבחור מצב משפחתי");
    numberField(errors, "numberOfChildren", form.numberOfChildren, "יש להזין את מספר הילדים", {integer: true});
    numberField(errors, "borrowerCount", form.borrowerCount, "יש להזין לפחות לווה אחד", {positive: true, integer: true});
    const count = Number(form.numberOfChildren);
    if (Number.isInteger(count) && count >= 0 && form.childrenAges.length !== count) errors.childrenAges = "יש להזין גיל עבור כל ילד";
    form.childrenAges.forEach((age, index) => {
      if (age.trim() === "" || !Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 120) errors[`childrenAges.${index}`] = `יש להזין גיל תקין לילד ${index + 1}`;
    });
  }
  if (!step || step === 2) {
    required(errors, "employmentType", form.employmentType, "יש לבחור סוג תעסוקה");
    required(errors, "employerName", form.employerName, "יש להזין שם מעסיק או עסק");
    required(errors, "jobTitle", form.jobTitle, "יש להזין תפקיד");
    numberField(errors, "employmentSeniorityYears", form.employmentSeniorityYears, "יש להזין ותק בשנים", {integer: true});
    numberField(errors, "monthlyNetIncome", form.monthlyNetIncome, "יש להזין הכנסה חודשית נטו");
    if (!form.hasAdditionalIncome) errors.hasAdditionalIncome = "יש לבחור האם קיימת הכנסה נוספת";
    if (form.hasAdditionalIncome === "yes") {
      required(errors, "additionalIncomeType", form.additionalIncomeType, "יש לבחור סוג הכנסה נוספת");
      numberField(errors, "additionalIncomeAmount", form.additionalIncomeAmount, "יש להזין סכום הכנסה נוספת גדול מאפס", {positive: true});
      if (form.additionalIncomeType === "OTHER") required(errors, "additionalIncomeDescription", form.additionalIncomeDescription, "יש לתאר את ההכנסה הנוספת");
    }
    numberField(errors, "monthlyLiabilities", form.monthlyLiabilities, "יש להזין התחייבויות חודשיות");
    numberField(errors, "existingMortgageBalance", form.existingMortgageBalance, "יש להזין יתרת משכנתה קיימת");
    numberField(errors, "existingMortgageMonthlyPayment", form.existingMortgageMonthlyPayment, "יש להזין החזר משכנתה חודשי");
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
  const hasAdditionalIncome = form.hasAdditionalIncome === "yes";
  return {
    firstName: form.firstName.trim(), lastName: form.lastName.trim(), identityNumber: form.identityNumber.trim(),
    birthDate: form.birthDate, phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(),
    maritalStatus: form.maritalStatus, numberOfChildren: Number(form.numberOfChildren),
    childrenAges: form.childrenAges.map(Number), borrowerCount: Number(form.borrowerCount),
    employmentType: form.employmentType, employerName: form.employerName.trim(), jobTitle: form.jobTitle.trim(),
    employmentSeniorityYears: Number(form.employmentSeniorityYears), monthlyNetIncome: Number(form.monthlyNetIncome),
    hasAdditionalIncome, additionalIncomeType: hasAdditionalIncome ? form.additionalIncomeType : null,
    additionalIncomeAmount: hasAdditionalIncome ? Number(form.additionalIncomeAmount) : 0,
    additionalIncomeDescription: hasAdditionalIncome && form.additionalIncomeType === "OTHER" ? form.additionalIncomeDescription.trim() : null,
    monthlyLiabilities: Number(form.monthlyLiabilities), existingMortgageBalance: Number(form.existingMortgageBalance),
    existingMortgageMonthlyPayment: Number(form.existingMortgageMonthlyPayment), dealType: form.dealType,
    propertyType: form.propertyType,
    propertyTypeOtherDescription: form.propertyType === "OTHER" ? form.propertyTypeOtherDescription.trim() : null,
    propertyCity: form.propertyCity.trim(), propertyRegion: form.propertyRegion, propertyAddress: form.propertyAddress.trim(),
    propertyValue: Number(form.propertyValue), requestedAmount: Number(form.requestedAmount),
    requestedTermMonths: Number(form.requestedTermMonths), notes: form.notes.trim(), status: "ACTIVE"
  };
}
