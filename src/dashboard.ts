import { normalizeSourceTime, TIME_POLICY } from './source-time.ts';
import { buildHeatmaps } from './heatmap.ts';
import { collectionStatus } from './dashboard-status.ts';
import type { D1Database } from '@cloudflare/workers-types';
import { parseMeasurements } from './connect2.ts';

export interface HistoryRow {
  location_id: number; location_name: string; visitor_count: number; is_closed: number;
  source_measured_at_raw: string; fetched_at: string; measured_at: string | null;
}
interface FetchRow { fetched_at: string; status: string; raw_response: string | null }
// All reads. No response bodies, credentials, or internal errors cross the server boundary.
export async function readDashboard(db: D1Database, now = new Date().toISOString()) {
  const since = new Date(Date.parse(now) - 7 * 86400_000).toISOString();
  const heatmapSince = new Date(Date.parse(now) - 28 * 86400_000).toISOString();
  const result = await db.batch([
    db.prepare('SELECT fetched_at, status FROM collector_fetches ORDER BY fetched_at DESC, id DESC LIMIT 1'),
    db.prepare("SELECT fetched_at, status, raw_response FROM collector_fetches WHERE status = 'success' ORDER BY fetched_at DESC, id DESC LIMIT 1"),
    db.prepare(`SELECT location_id, location_name, visitor_count, is_closed, source_measured_at_raw, fetched_at, measured_at FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY fetched_at DESC, id DESC) AS rn
      FROM occupancy_measurements WHERE facility_id = 178) WHERE rn = 1 ORDER BY location_id`),
    db.prepare(`SELECT fetched_at, status, raw_response FROM collector_fetches WHERE status = 'success'
      AND fetched_at >= strftime('%Y-%m-%dT%H:%M:%fZ', (SELECT MAX(fetched_at) FROM collector_fetches WHERE status='success'), '-4 hours')
      ORDER BY fetched_at DESC, id DESC LIMIT 1000`),
    db.prepare(`SELECT location_id, location_name, visitor_count, is_closed, source_measured_at_raw, fetched_at, measured_at
      FROM occupancy_measurements WHERE facility_id = 178 AND fetched_at >= ?
      ORDER BY fetched_at DESC, id DESC LIMIT 12001`).bind(since),
    db.prepare(`SELECT location_id, location_name, visitor_count, is_closed, source_measured_at_raw, fetched_at, measured_at
      FROM occupancy_measurements WHERE facility_id = 178 AND location_id IN (883,884,885)
      AND fetched_at >= ? ORDER BY fetched_at DESC, id DESC LIMIT 12001`).bind(heatmapSince),
  ]);
  const attempt = result[0]!.results[0] as unknown as FetchRow | undefined;
  const success = result[1]!.results[0] as unknown as FetchRow | undefined;
  const known = result[2]!.results as unknown as HistoryRow[];
  const current = success ? parseMeasurements(JSON.parse(success.raw_response!)) : [];
  const snapshots = (result[3]!.results as unknown as FetchRow[]).map(r => ({
    at: r.fetched_at, measurements: parseMeasurements(JSON.parse(r.raw_response!)),
  }));
  const ids = [...new Set([...known.map(r => r.location_id), ...current.map(r => r.locationId)])].sort((a,b) => a-b);
  const areas = ids.map(id => {
    const reading = current.find(r => r.locationId === id);
    let unchangedSince = success?.fetched_at ?? null;
    // Walk the contiguous observed run; absence or a correction resets the lower bound.
    for (const snapshot of snapshots) {
      const previous = snapshot.measurements.find(r => r.locationId === id);
      if (!reading || !previous || previous.sourceMeasuredAtRaw !== reading.sourceMeasuredAtRaw ||
          previous.visitorCount !== reading.visitorCount || previous.isClosed !== reading.isClosed) break;
      unchangedSince = snapshot.at;
    }
    return {
      id, name: reading?.locationName ?? known.find(r => r.location_id === id)!.location_name,
      count: reading?.visitorCount ?? null, closed: reading?.isClosed ?? null,
      sourceTime: reading?.sourceMeasuredAtRaw ?? null,
      ...(reading && success ? normalizeSourceTime(reading.sourceMeasuredAtRaw, success.fetched_at) : { measuredAt: null, issue: null }),
      unchanged: !!reading && !reading.isClosed && !!unchangedSince && !!success &&
        Date.parse(success.fetched_at) - Date.parse(unchangedSince) > 3 * 3600_000,
    };
  });
  const history = (result[4]!.results as unknown as HistoryRow[]).slice(0,12000).map(row => {
    // Apply the same policy to older, unbackfilled snapshots and current stored rows.
    const normalized = row.measured_at ? { measuredAt: row.measured_at, issue: null } : normalizeSourceTime(row.source_measured_at_raw, row.fetched_at);
    return { ...row, measured_at: normalized.measuredAt, timeIssue: normalized.issue };
  }).filter(row => row.measured_at === null || row.measured_at >= since)
    .sort((a,b) => (a.measured_at ?? a.fetched_at).localeCompare(b.measured_at ?? b.fetched_at));
  return {
    heatmaps: buildHeatmaps(result[5]!.results.slice(0,12000) as unknown as HistoryRow[], now),
    heatmapsTruncated: result[5]!.results.length > 12000,
    timePolicy: TIME_POLICY,
    generatedAt: now, lastSuccess: success?.fetched_at ?? null,
    lastAttempt: attempt ? { at: attempt.fetched_at, failed: attempt.status !== 'success' } : null,
    status: collectionStatus(success?.fetched_at ?? null, now), areas,
    history,
    historyTruncated: result[4]!.results.length > 12000,
  };
}
export type DashboardData = Awaited<ReturnType<typeof readDashboard>>;
