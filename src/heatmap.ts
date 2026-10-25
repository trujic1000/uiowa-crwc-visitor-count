import { normalizeSourceTime } from './source-time.ts';
import type { HistoryRow } from './dashboard.ts';

export const FITNESS_FLOORS = [
  { id: 883, name: '1st Floor Free Weight Area' },
  { id: 884, name: '2nd Floor Fitness Area' },
  { id: 885, name: '3rd Floor Fitness Area' },
];
const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function median(values: number[]) {
  const sorted = [...values].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

// Give each calendar day equal weight, even if one day has more readings.
export function buildHeatmaps(rows: HistoryRow[], now: string) {
  const cutoff = Date.parse(now) - 28 * 86400_000;
  return FITNESS_FLOORS.map(floor => {
    const buckets = new Map<string, Map<string, number[]>>();
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.location_id !== floor.id || row.is_closed) continue;
      const key = row.source_measured_at_raw;
      if (seen.has(key)) continue;
      seen.add(key);
      const time = row.measured_at ?? normalizeSourceTime(key, row.fetched_at).measuredAt;
      if (!time || !Number.isFinite(Date.parse(time)) || Date.parse(time) < cutoff || Date.parse(time) > Date.parse(now)) continue;
      const parts = Object.fromEntries(clock.formatToParts(new Date(time)).map(p => [p.type, p.value]));
      const bucket = `${weekdays.indexOf(parts.weekday!)}/${Number(parts.hour)}`;
      const date = `${parts.year}-${parts.month}-${parts.day}`;
      if (!buckets.has(bucket)) buckets.set(bucket, new Map());
      const days = buckets.get(bucket)!;
      if (!days.has(date)) days.set(date, []);
      days.get(date)!.push(row.visitor_count);
    }
    const cells = weekdays.flatMap((day, weekday) => Array.from({length:24}, (_, hour) => {
      const days = buckets.get(`${weekday}/${hour}`);
      const values = days ? [...days.values()] : [];
      return { day, hour, days: values.length, readings: values.reduce((n,v) => n + v.length, 0), count: values.length ? median(values.map(median)) : null };
    }));
    return { ...floor, cells };
  });
}
export type FitnessHeatmaps = ReturnType<typeof buildHeatmaps>;
