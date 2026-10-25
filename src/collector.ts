import { normalizeSourceTime } from './source-time.ts';
import type { D1Database } from "@cloudflare/workers-types";
import { fetchCrwc, SourceError } from "./connect2.ts";

export async function collect(db: D1Database, options: Parameters<typeof fetchCrwc>[0] = {}) {
  const started = Date.now();
  const fetchedAt = new Date(started).toISOString();
  let attemptId: number | undefined;
  let httpStatus: number | null = null;
  let rawResponse: string | null = null;
  try {
    // An interrupted run remains visible as an incomplete error attempt.
    const attempt = await db.prepare(`INSERT INTO collector_fetches
      (fetched_at, status, duration_ms, error_message)
      VALUES (?, 'error', 0, 'Collection did not complete') RETURNING id`).bind(fetchedAt).first<{ id: number }>();
    if (!attempt) throw new Error("Could not create fetch log");
    attemptId = attempt.id;
    const source = await fetchCrwc(options);
    httpStatus = source.responseMetadata.status;
    rawResponse = source.rawResponse;
    const statements = [];
    for (const m of source.measurements) {
      statements.push(db.prepare(`INSERT INTO occupancy_measurements
        (facility_id, facility_name, location_id, location_name, visitor_count, is_closed,
         source_measured_at_raw, measured_at, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (facility_id, location_id, source_measured_at_raw) DO NOTHING`)
        .bind(m.facilityId, m.facilityName, m.locationId, m.locationName, m.visitorCount,
          Number(m.isClosed), m.sourceMeasuredAtRaw, normalizeSourceTime(m.sourceMeasuredAtRaw, source.fetchedAt).measuredAt, source.fetchedAt));
      // changes() refers to the immediately preceding insert in this transaction.
      statements.push(db.prepare(`UPDATE collector_fetches SET
        measurements_inserted = measurements_inserted + changes(),
        conflicting_measurements = conflicting_measurements + EXISTS (
          SELECT 1 FROM occupancy_measurements WHERE facility_id = ? AND location_id = ?
          AND source_measured_at_raw = ? AND (visitor_count != ? OR is_closed != ?)
        ) WHERE id = ?`).bind(m.facilityId, m.locationId, m.sourceMeasuredAtRaw,
          m.visitorCount, Number(m.isClosed), attemptId));
    }
    statements.push(db.prepare(`UPDATE collector_fetches SET status = 'success',
      error_message = NULL, http_status = ?, raw_response = ?, duration_ms = ? WHERE id = ?
      RETURNING id, measurements_inserted, conflicting_measurements`)
      .bind(httpStatus, rawResponse, Date.now() - started, attemptId));
    // D1 batch is transactional: a failed statement rolls back all measurements/counters.
    const results = await db.batch<{ id: number; measurements_inserted: number; conflicting_measurements: number }>(statements);
    const summary = results.at(-1)?.results[0];
    console.log(JSON.stringify({ event: "collection_complete", ...summary }));
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof SourceError) {
      httpStatus = error.httpStatus;
      rawResponse = error.rawResponse;
    }
    if (attemptId !== undefined) {
      try {
        await db.prepare(`UPDATE collector_fetches SET status = 'error', error_message = ?,
          http_status = ?, raw_response = ?, duration_ms = ? WHERE id = ?`)
          .bind(message, httpStatus, rawResponse, Date.now() - started, attemptId).run();
      } catch (logError) {
        console.error(JSON.stringify({ event: "fetch_log_failed", error: String(logError) }));
      }
    }
    console.error(JSON.stringify({ event: "collection_failed", attemptId, error: message }));
    throw error; // Mark this invocation failed; later cron invocations still run.
  }
}
