import type {BusinessCalendarException} from "../domain/lenderDelivery.js";

const timeZone = "Asia/Jerusalem";
const gregorianFormatter = new Intl.DateTimeFormat("en-CA", {timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"});
const hebrewFormatter = new Intl.DateTimeFormat("en-u-ca-hebrew", {timeZone, month: "long", day: "numeric"});

function parts(formatter: Intl.DateTimeFormat, date: Date): Record<string, string> {
  return Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateKey(date: Date): string {
  const value = parts(gregorianFormatter, date);
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function atLocalTime(key: string, hour: number, minute: number): Date {
  const [year, month, day] = key.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desired;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const local = parts(gregorianFormatter, new Date(candidate));
    const represented = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute));
    candidate += desired - represented;
  }
  return new Date(candidate);
}

function isFixedIsraeliHoliday(key: string): boolean {
  const midday = atLocalTime(key, 12, 0);
  const value = parts(hebrewFormatter, midday);
  const day = Number(value.day);
  const month = value.month;
  return (month === "Tishri" && [1, 2, 10, 15, 22].includes(day))
    || (month === "Nisan" && [15, 21].includes(day))
    || (month === "Sivan" && day === 6);
}

export class IsraelBusinessCalendarService {
  private readonly overrides: Map<string, BusinessCalendarException>;

  constructor(exceptions: BusinessCalendarException[] = []) {
    this.overrides = new Map(exceptions.map((exception) => [exception.date, exception]));
  }

  isIsraeliBusinessDay(value: Date | string): boolean {
    const key = typeof value === "string" ? value : dateKey(value);
    const override = this.overrides.get(key);
    if (override?.type === "FORCED_WORKING_DAY") return true;
    if (override) return false;
    const [year, month, day] = key.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday >= 0 && weekday <= 4 && !isFixedIsraeliHoliday(key);
  }

  addIsraeliBusinessDays(value: Date | string, numberOfDays: number): string {
    if (!Number.isInteger(numberOfDays) || numberOfDays < 0) throw new Error("numberOfDays must be a non-negative integer");
    let key = typeof value === "string" ? value : dateKey(value);
    let remaining = numberOfDays;
    while (remaining > 0) {
      key = addDays(key, 1);
      if (this.isIsraeliBusinessDay(key)) remaining -= 1;
    }
    return key;
  }

  calculateResponseDeadline(sentAt: Date, businessDays = 2): Date {
    if (!Number.isInteger(businessDays) || businessDays < 1) throw new Error("businessDays must be a positive integer");
    return atLocalTime(this.addIsraeliBusinessDays(sentAt, businessDays), 18, 0);
  }

  calculateReminderSchedule(_sentAt: Date, deadline: Date): Date {
    return atLocalTime(dateKey(deadline), 9, 0);
  }
}

export const israelDateKey = dateKey;
