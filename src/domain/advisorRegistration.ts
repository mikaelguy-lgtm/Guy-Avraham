import { z } from "zod";

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

export function normalizeIsraeliPhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (/^0\d{8,9}$/.test(compact)) return `+972${compact.slice(1)}`;
  if (/^\+972\d{8,9}$/.test(compact)) return compact;
  return compact;
}

const personNameSchema = z.string().transform(normalizeName).pipe(
  z.string().min(2, "יש להזין לפחות 2 תווים").max(100, "ניתן להזין עד 100 תווים").regex(/^[\p{L}'’ -]+$/u, "ניתן להזין אותיות בלבד")
);

const emailSchema = z.string().transform(normalizeEmail).pipe(z.string().email("כתובת הדוא״ל אינה תקינה").max(320));
const phoneSchema = z.string().transform(normalizeIsraeliPhone).pipe(z.string().regex(/^\+972\d{8,9}$/, "יש להזין מספר טלפון ישראלי תקין"));
const businessNameSchema = z.string().transform(normalizeName).pipe(z.string().min(2, "יש להזין לפחות 2 תווים").max(150, "ניתן להזין עד 150 תווים"));

export const advisorRegistrationApiSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  businessName: businessNameSchema,
  acceptTerms: z.literal(true, {error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות"})
}).strict();

export const advisorProfileSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: phoneSchema,
  businessName: businessNameSchema
}).strict();

export const passwordSchema = z.string()
  .min(10, "הסיסמה חייבת לכלול לפחות 10 תווים")
  .regex(/[A-Z]/, "הסיסמה חייבת לכלול אות גדולה באנגלית")
  .regex(/[a-z]/, "הסיסמה חייבת לכלול אות קטנה באנגלית")
  .regex(/\d/, "הסיסמה חייבת לכלול מספר")
  .regex(/[^A-Za-z0-9\s]/, "הסיסמה חייבת לכלול תו מיוחד")
  .regex(/^\S+$/, "הסיסמה אינה יכולה לכלול רווחים");

export const advisorRegistrationFormSchema = advisorRegistrationApiSchema.extend({
  password: passwordSchema,
  confirmPassword: z.string().min(1, "יש לאמת את הסיסמה")
}).refine((value) => value.password === value.confirmPassword, {path: ["confirmPassword"], message: "הסיסמאות אינן זהות"});

export type AdvisorRegistrationInput = z.infer<typeof advisorRegistrationApiSchema>;

export function passwordRequirements(password: string, confirmPassword: string) {
  return [
    {key: "length", label: "לפחות 10 תווים", met: password.length >= 10, field: "password" as const},
    {key: "uppercase", label: "אות גדולה באנגלית", met: /[A-Z]/.test(password), field: "password" as const},
    {key: "lowercase", label: "אות קטנה באנגלית", met: /[a-z]/.test(password), field: "password" as const},
    {key: "number", label: "מספר אחד לפחות", met: /\d/.test(password), field: "password" as const},
    {key: "special", label: "תו מיוחד", met: /[^A-Za-z0-9\s]/.test(password), field: "password" as const},
    {key: "spaces", label: "ללא רווחים", met: password.length > 0 && !/\s/.test(password), field: "password" as const},
    {key: "match", label: "הסיסמאות זהות", met: password.length > 0 && password === confirmPassword, field: "confirmPassword" as const}
  ];
}

export function passwordStrength(password: string, confirmPassword = ""): {score: number; label: string} {
  const score = passwordRequirements(password, confirmPassword).filter((requirement) => requirement.met).length;
  return {score, label: score <= 2 ? "חלשה" : score <= 4 ? "בינונית" : score <= 6 ? "חזקה" : "חזקה מאוד"};
}
