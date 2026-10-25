import { SOURCE_TIME_ZONE, TIME_POLICY } from './source-time.ts';
export const ENDPOINT = "https://goboardapi.azurewebsites.net/api/FacilityCount/GetCountsByAccount?AccountAPIKey=8c72a6a7-d6ee-4520-bc3a-52215462ac23";
export const CRWC_FACILITY_ID = 178;

export interface Measurement {
  facilityId: number;
  facilityName: string;
  locationId: number;
  locationName: string;
  visitorCount: number;
  sourceMeasuredAtRaw: string;
  isClosed: boolean;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validLocalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [number, number, number, number, number, number];
  if (year < 1000 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseMeasurements(payload: unknown): Measurement[] {
  if (!Array.isArray(payload)) throw new Error("Expected a JSON array from Connect2");
  const seen = new Set<number>();
  const measurements: Measurement[] = [];
  for (const row of payload) {
    if (!object(row) || !Number.isSafeInteger(row.FacilityId)) {
      throw new Error("Malformed facility record in Connect2 response");
    }
    if (row.FacilityId !== CRWC_FACILITY_ID) continue;
    if (typeof row.LocationId !== "number" || !Number.isSafeInteger(row.LocationId) || row.LocationId <= 0 ||
        typeof row.FacilityName !== "string" || !row.FacilityName.trim() ||
        typeof row.LocationName !== "string" || !row.LocationName.trim() ||
        typeof row.LastCount !== "number" || !Number.isSafeInteger(row.LastCount) || row.LastCount < 0 ||
        !validLocalTimestamp(row.LastUpdatedDateAndTime) || typeof row.IsClosed !== "boolean") {
      throw new Error(`Invalid CRWC measurement for location ${String(row.LocationId)}`);
    }
    if (seen.has(row.LocationId)) throw new Error(`Duplicate location ${row.LocationId} in response`);
    seen.add(row.LocationId);
    measurements.push({facilityId: CRWC_FACILITY_ID, facilityName: row.FacilityName.trim(),
      locationId: row.LocationId, locationName: row.LocationName.trim(), visitorCount: row.LastCount,
      sourceMeasuredAtRaw: row.LastUpdatedDateAndTime, isClosed: row.IsClosed});
  }
  if (!measurements.length) throw new Error("No CRWC measurements returned; this is not zero occupancy");
  return measurements.sort((a, b) => a.locationId - b.locationId);
}

export class SourceError extends Error {
  httpStatus: number | null;
  rawResponse: string | null;
  constructor(message: string, httpStatus: number | null, rawResponse: string | null) {
    super(message);
    this.name = "SourceError";
    this.httpStatus = httpStatus;
    this.rawResponse = rawResponse;
  }
}

export async function fetchCrwc(options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be a positive integer");
  const response = await (options.fetchImpl ?? fetch)(ENDPOINT, {
    headers: { Accept: "application/json", "User-Agent": "uiowa-crwc-visitor-count/0.1 (public occupancy research)" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  let rawResponse: string;
  try { rawResponse = await response.text(); }
  catch (error) { throw new SourceError(`Could not read response: ${String(error)}`, response.status, null); }
  if (!response.ok) throw new SourceError(`Connect2 returned HTTP ${response.status}`, response.status, rawResponse);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/(?:[\w.-]+\+)?json(?:;|$)/i.test(contentType)) {
    throw new SourceError(`Expected JSON content type, received ${contentType || "none"}`, response.status, rawResponse);
  }
  let rawPayload: unknown;
  let measurements: Measurement[];
  try {
    rawPayload = JSON.parse(rawResponse);
    measurements = parseMeasurements(rawPayload);
  } catch (error) {
    throw new SourceError(error instanceof Error ? error.message : String(error), response.status, rawResponse);
  }
  const fetchedAt = new Date().toISOString();
  return { fetchedAt, source: ENDPOINT, sourceTimezone: SOURCE_TIME_ZONE, timePolicy: TIME_POLICY,
    timezoneNote: "Source timestamps have no offset. America/Chicago with daylight saving is assumed by user decision, not verified by the vendor; raw timestamps are preserved.",
    responseMetadata: {
      status: response.status, date: response.headers.get("date"),
      cacheControl: response.headers.get("cache-control"), age: response.headers.get("age"),
      etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"),
    }, measurements, rawPayload, rawResponse };
}
