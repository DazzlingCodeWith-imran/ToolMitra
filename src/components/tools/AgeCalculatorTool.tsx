import { AlertCircle, Calendar, Check, Copy, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { calculateExactAge, getTodayIsoDate } from '@/src/utils/ageCalculator';

export function AgeCalculatorTool() {
  const [todayIso, setTodayIso] = useState<string>('2026-11-23');
  const [birthDate, setBirthDate] = useState<string>('1998-06-15');
  const [targetDate, setTargetDate] = useState<string>('2026-11-23');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const current = getTodayIsoDate();
    setTodayIso(current);
    setTargetDate(current);
  }, []);

  const result = useMemo(
    () => calculateExactAge(birthDate, targetDate),
    [birthDate, targetDate],
  );

  const handleCopySummary = async () => {
    if (!result.valid || !result.breakdown) return;
    const b = result.breakdown;
    const summary = `Age: ${b.years} years, ${b.months} months, ${b.days} days | Total days: ${b.totalDays.toLocaleString()} | Next birthday: ${
      b.isBirthdayToday ? 'Today' : `in ${b.daysUntilNextBirthday} days`
    }`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="dob-input"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Date of Birth
            </label>
            <input
              id="dob-input"
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="target-date-input"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Calculate Age As Of
              </label>
              <button
                type="button"
                onClick={() => setTargetDate(todayIso)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Today</span>
              </button>
            </div>
            <input
              id="target-date-input"
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        {!result.valid && result.error && (
          <div
            role="alert"
            className="mt-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{result.error}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result.valid && result.breakdown && (
        <div className="space-y-6">
          {/* Primary Result Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Exact Age
                </p>
                <p className="mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums text-slate-900 sm:text-4xl dark:text-slate-50">
                  {result.breakdown.years}{' '}
                  <span className="font-sans text-lg font-medium text-slate-500 dark:text-slate-400">
                    {result.breakdown.years === 1 ? 'year' : 'years'}
                  </span>{' '}
                  {result.breakdown.months}{' '}
                  <span className="font-sans text-lg font-medium text-slate-500 dark:text-slate-400">
                    {result.breakdown.months === 1 ? 'month' : 'months'}
                  </span>{' '}
                  {result.breakdown.days}{' '}
                  <span className="font-sans text-lg font-medium text-slate-500 dark:text-slate-400">
                    {result.breakdown.days === 1 ? 'day' : 'days'}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Summary</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>
                  {result.breakdown.isBirthdayToday ? (
                    <strong className="font-semibold text-slate-900 dark:text-slate-100">
                      Birthday falls on the target date!
                    </strong>
                  ) : (
                    <>
                      Next birthday in{' '}
                      <strong className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {result.breakdown.daysUntilNextBirthday}
                      </strong>{' '}
                      {result.breakdown.daysUntilNextBirthday === 1 ? 'day' : 'days'} (
                      {result.breakdown.nextBirthdayWeekday})
                    </>
                  )}
                </span>
              </div>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <span>Born on a {result.breakdown.birthWeekday}</span>
            </div>
          </div>

          {/* Equivalent Units Table */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Months</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {result.breakdown.totalMonths.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Weeks</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {result.breakdown.totalWeeks.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                  +{result.breakdown.remainingDaysAfterWeeks}d
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Days</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {result.breakdown.totalDays.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Hours</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {result.breakdown.totalHours.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Minutes</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {result.breakdown.totalMinutes.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
