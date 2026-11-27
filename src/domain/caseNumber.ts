import {randomInt} from "node:crypto";

// מספר תיק לתצוגה בלבד (לא מפתח, לא הרשאה): "SC-" + 7 ספרות אקראיות, הראשונה 1–9.
// קצר וקריא בטלפון ובמייל, ואקראי (לא רץ) כדי לא לחשוף לגופי המימון את נפח התיקים במערכת.
// ייחודיות נאכפת ע"י ה-unique constraint על clients.public_case_number; התנגשות → מספר חדש.
// תיקים קיימים שומרים את המספר הארוך הקודם (SC- + 16 תווים) — שום היסטוריה לא נכתבת מחדש.
export const CASE_NUMBER_PREFIX = "SC-";
export const CASE_NUMBER_DIGITS = 7;

export function generateCaseNumber(random: (min: number, max: number) => number = randomInt): string {
  const lowest = 10 ** (CASE_NUMBER_DIGITS - 1);
  return `${CASE_NUMBER_PREFIX}${random(lowest, lowest * 10)}`;
}

export function isPublicCaseNumberConflict(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 3; current = (current as {cause?: unknown}).cause, depth += 1) {
    const {code, constraint} = current as {code?: unknown; constraint?: unknown};
    if (code === "23505" && typeof constraint === "string" && constraint.includes("public_case_number")) return true;
  }
  return false;
}
