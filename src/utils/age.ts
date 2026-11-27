function parseDateOnly(value: string | Date): {year: number; month: number; day: number} | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate()};
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return {year, month, day};
}

export function calculateAge(birthDate: string | Date, referenceDate = new Date()): number | null {
  const birth = parseDateOnly(birthDate);
  if (!birth || Number.isNaN(referenceDate.getTime())) return null;
  const current = {year: referenceDate.getUTCFullYear(), month: referenceDate.getUTCMonth() + 1, day: referenceDate.getUTCDate()};
  let age = current.year - birth.year;
  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) age -= 1;
  return age;
}

export function validateAdultBirthDate(birthDate: string, referenceDate = new Date()): string | null {
  const parsed = parseDateOnly(birthDate);
  if (!parsed) return "יש להזין תאריך לידה תקין";
  const today = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  const value = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  if (value > today) return "תאריך הלידה אינו יכול להיות בעתיד";
  const age = calculateAge(birthDate, referenceDate);
  if (age === null || age < 18) return "הלווה חייב להיות בן 18 לפחות";
  if (age > 120) return "גיל הלווה אינו יכול לעלות על 120";
  return null;
}
