export interface AgeBreakdown {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalWeeks: number;
  remainingDaysAfterWeeks: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  birthWeekday: string;
  targetWeekday: string;
  daysUntilNextBirthday: number;
  nextBirthdayWeekday: string;
  isBirthdayToday: boolean;
}

export interface AgeCalculationResult {
  valid: boolean;
  error?: string;
  breakdown?: AgeBreakdown;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseIsoDate(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function resolveBirthdayInYear(birthMonth: number, birthDay: number, year: number): Date {
  if (birthMonth === 2 && birthDay === 29 && !isLeapYear(year)) {
    // Standard civil convention for Feb 29 in non-leap years: March 1
    return new Date(Date.UTC(year, 2, 1));
  }
  return new Date(Date.UTC(year, birthMonth - 1, birthDay));
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateExactAge(birthDateStr: string, targetDateStr: string): AgeCalculationResult {
  if (!birthDateStr) {
    return { valid: false, error: 'Please select a date of birth.' };
  }
  if (!targetDateStr) {
    return { valid: false, error: 'Please select a target calculation date.' };
  }

  const birth = parseIsoDate(birthDateStr);
  const target = parseIsoDate(targetDateStr);

  if (!birth) {
    return { valid: false, error: 'Date of birth is not a valid calendar date.' };
  }
  if (!target) {
    return { valid: false, error: 'Target date is not a valid calendar date.' };
  }
  if (birth.year < 1900 || target.year > 2200) {
    return { valid: false, error: 'Please enter dates between the years 1900 and 2200.' };
  }

  const birthUtc = new Date(Date.UTC(birth.year, birth.month - 1, birth.day));
  const targetUtc = new Date(Date.UTC(target.year, target.month - 1, target.day));

  if (birthUtc.getTime() > targetUtc.getTime()) {
    return { valid: false, error: 'Date of birth cannot be later than the target date.' };
  }

  let years = target.year - birth.year;
  let months = target.month - birth.month;
  let days = target.day - birth.day;

  if (days < 0) {
    months -= 1;
    const prevMonth = target.month === 1 ? 12 : target.month - 1;
    const prevMonthYear = target.month === 1 ? target.year - 1 : target.year;
    days += daysInMonth(prevMonthYear, prevMonth);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const MS_PER_DAY = 86_400_000;
  const totalDays = Math.round((targetUtc.getTime() - birthUtc.getTime()) / MS_PER_DAY);
  const totalMonths = years * 12 + months;
  const totalWeeks = Math.floor(totalDays / 7);
  const remainingDaysAfterWeeks = totalDays % 7;
  const totalHours = totalDays * 24;
  const totalMinutes = totalHours * 60;

  let nextBirthday = resolveBirthdayInYear(birth.month, birth.day, target.year);
  const isBirthdayToday = nextBirthday.getTime() === targetUtc.getTime();
  if (nextBirthday.getTime() <= targetUtc.getTime()) {
    nextBirthday = resolveBirthdayInYear(birth.month, birth.day, target.year + 1);
  }

  const daysUntilNextBirthday = isBirthdayToday
    ? 0
    : Math.round((nextBirthday.getTime() - targetUtc.getTime()) / MS_PER_DAY);

  return {
    valid: true,
    breakdown: {
      years,
      months,
      days,
      totalMonths,
      totalWeeks,
      remainingDaysAfterWeeks,
      totalDays,
      totalHours,
      totalMinutes,
      birthWeekday: WEEKDAYS[birthUtc.getUTCDay()],
      targetWeekday: WEEKDAYS[targetUtc.getUTCDay()],
      daysUntilNextBirthday,
      nextBirthdayWeekday: WEEKDAYS[nextBirthday.getUTCDay()],
      isBirthdayToday,
    },
  };
}
