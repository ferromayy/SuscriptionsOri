import type { BillingCycleDays } from "@/lib/subscribers/checkout-schemas";

export function normalizeBillingCycleDays(
  days: number | null | undefined,
): BillingCycleDays {
  if (days === 15 || days === 45) {
    return days;
  }
  return 30;
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Week bounds Sunday 00:00 → Saturday 00:00 (inclusive day range).
 * Matches "semana de domingo a sábado".
 */
export function getSundaySaturdayWeek(
  reference: Date = new Date(),
): { start: Date; end: Date } {
  const day = startOfLocalDay(reference);
  const weekday = day.getDay(); // 0 = Sunday
  const start = new Date(day);
  start.setDate(start.getDate() - weekday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function formatWeekRangeLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  const startLabel = start.toLocaleDateString("es-AR", opts);
  const endLabel = end.toLocaleDateString("es-AR", {
    ...opts,
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export function weekdayLabel(date: Date): string {
  return date.toLocaleDateString("es-AR", { weekday: "long" });
}

/**
 * Next delivery/charge date: cycles of N days counted from subscription start.
 * Changes to cycle days apply from the next upcoming date onward.
 */
export function getNextCycleDate(
  startedAt: string | Date,
  cycleDays: number | null | undefined,
  from: Date = new Date(),
): Date {
  const days = normalizeBillingCycleDays(cycleDays);
  const start = startOfLocalDay(
    typeof startedAt === "string" ? new Date(startedAt) : startedAt,
  );
  const now = startOfLocalDay(from);

  if (Number.isNaN(start.getTime())) {
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + days);
    return fallback;
  }

  const cursor = new Date(start);
  while (cursor.getTime() <= now.getTime()) {
    cursor.setDate(cursor.getDate() + days);
  }
  return cursor;
}

/**
 * Cycle dates that fall on a calendar day within [rangeStart, rangeEnd]
 * (inclusive), using the same cadence as getNextCycleDate (start + k*N).
 */
export function getCycleDatesInRange(
  startedAt: string | Date,
  cycleDays: number | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const days = normalizeBillingCycleDays(cycleDays);
  const start = startOfLocalDay(
    typeof startedAt === "string" ? new Date(startedAt) : startedAt,
  );
  const from = startOfLocalDay(rangeStart);
  const to = startOfLocalDay(rangeEnd);

  if (Number.isNaN(start.getTime()) || from > to) {
    return [];
  }

  const cursor = new Date(start);
  if (cursor.getTime() < from.getTime()) {
    const diffMs = from.getTime() - cursor.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const steps = Math.floor(diffDays / days);
    cursor.setDate(cursor.getDate() + steps * days);
    while (cursor.getTime() < from.getTime()) {
      cursor.setDate(cursor.getDate() + days);
    }
  }

  const dates: Date[] = [];
  while (cursor.getTime() <= to.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + days);
  }
  return dates;
}

/** Local calendar date as YYYY-MM-DD (avoids UTC day shifts). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatCycleDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCycleDateShort(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}
