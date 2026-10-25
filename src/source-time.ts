import { Temporal } from '@js-temporal/polyfill';

// User-approved assumption, not a verified vendor contract. See docs/source-timezone.md.
export const SOURCE_TIME_ZONE = 'America/Chicago';
export const TIME_POLICY = 'assumed-america-chicago-v1';
export type TimeIssue = 'invalid' | 'ambiguous' | 'nonexistent' | 'future';
export interface NormalizedTime { measuredAt: string | null; issue: TimeIssue | null }

export function normalizeSourceTime(raw: string, fetchedAt: string): NormalizedTime {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?$/.test(raw)) {
    return { measuredAt: null, issue: 'invalid' };
  }
  try {
    const local = Temporal.PlainDateTime.from(raw);
    // Temporal accepts leap seconds by constraining them. Our source contract does not.
    if (Number(raw.slice(17,19)) > 59) return { measuredAt: null, issue: 'invalid' };
    let instant: Temporal.Instant;
    try {
      instant = local.toZonedDateTime(SOURCE_TIME_ZONE, { disambiguation: 'reject' }).toInstant();
    } catch {
      const earlier = local.toZonedDateTime(SOURCE_TIME_ZONE, { disambiguation: 'earlier' });
      return { measuredAt: null, issue: earlier.toPlainDateTime().equals(local) ? 'ambiguous' : 'nonexistent' };
    }
    if (Temporal.Instant.compare(instant, Temporal.Instant.from(fetchedAt)) > 0) {
      return { measuredAt: null, issue: 'future' };
    }
    // Uniform UTC milliseconds match fetched_at formatting. Full source precision stays in raw.
    return { measuredAt: instant.toString({ fractionalSecondDigits: 3 }), issue: null };
  } catch { return { measuredAt: null, issue: 'invalid' }; }
}
