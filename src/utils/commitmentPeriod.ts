export interface RemainingCommitmentPeriod {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  label: string;
}

function dateOnly(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(Number.NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function calculateRemainingCommitmentPeriod(endDate: string | Date, currentDate: string | Date = new Date()): RemainingCommitmentPeriod | null {
  const end = dateOnly(endDate);
  const current = dateOnly(currentDate);
  if (Number.isNaN(end.getTime()) || Number.isNaN(current.getTime()) || end < current) return null;
  let years = end.getFullYear() - current.getFullYear();
  let months = end.getMonth() - current.getMonth();
  let days = end.getDate() - current.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  const totalMonths = years * 12 + months;
  const yearLabel = years === 1 ? "שנה" : `${years} שנים`;
  const monthLabel = months === 1 ? "חודש" : `${months} חודשים`;
  const label = years > 0 && months > 0 ? `${yearLabel} ו־${monthLabel}` : years > 0 ? yearLabel : months > 0 ? monthLabel : "פחות מחודש";
  return {years, months, days, totalMonths, label};
}
