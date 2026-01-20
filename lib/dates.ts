export type MonthBucket = {
  key: string; // YYYY-MM
  start: Date; // inclusive, UTC
  end: Date; // exclusive, UTC
};

export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function addMonthsUtc(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0));
}

export function monthKeyUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function defaultMonthRangeUtc(lookbackMonths: number): { start: Date; end: Date } {
  const now = new Date();
  const end = addMonthsUtc(startOfMonthUtc(now), 1);
  const start = addMonthsUtc(end, -lookbackMonths);
  return { start, end };
}

export function iterateMonthBucketsUtc(start: Date, end: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let d = startOfMonthUtc(start); d < end; d = addMonthsUtc(d, 1)) {
    const bucketStart = d;
    const bucketEnd = addMonthsUtc(d, 1);
    buckets.push({ key: monthKeyUtc(bucketStart), start: bucketStart, end: bucketEnd });
  }
  return buckets;
}

export function clampDateUtc(date: Date, min: Date, max: Date): Date {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}
