-- Migration number: 0001   2026-09-12T20:59:29.900Z
-- Collector timestamps use UTC ISO 8601 strings (for example, 2026-09-12T18:06:34.511Z).
-- Source timestamps are preserved verbatim because their timezone is not yet verified.

-- One row per collection attempt, including unchanged responses and failures.
-- Retain response bodies during discovery to investigate corrections and parsing errors.
CREATE TABLE collector_fetches (
  id INTEGER PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  http_status INTEGER CHECK (http_status BETWEEN 100 AND 599),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  measurements_inserted INTEGER NOT NULL DEFAULT 0 CHECK (measurements_inserted >= 0),
  -- Changed count/closure under an existing source timestamp: preserve in raw_response,
  -- increment this counter, and investigate rather than silently replacing history.
  conflicting_measurements INTEGER NOT NULL DEFAULT 0 CHECK (conflicting_measurements >= 0),
  error_message TEXT,
  raw_response TEXT,
  CHECK (status != 'error' OR error_message IS NOT NULL)
) STRICT;

CREATE INDEX collector_fetches_by_time ON collector_fetches (fetched_at);

-- One row per distinct reported location timestamp, not per poll or whole facility.
CREATE TABLE occupancy_measurements (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL CHECK (facility_id > 0),
  facility_name TEXT NOT NULL CHECK (length(trim(facility_name)) > 0),
  location_id INTEGER NOT NULL CHECK (location_id > 0),
  location_name TEXT NOT NULL CHECK (length(trim(location_name)) > 0),
  visitor_count INTEGER NOT NULL CHECK (visitor_count >= 0),
  is_closed INTEGER NOT NULL CHECK (is_closed IN (0, 1)),
  source_measured_at_raw TEXT NOT NULL CHECK (length(source_measured_at_raw) > 0),
  -- Nullable until the source timezone and any DST ambiguity have been resolved.
  measured_at TEXT,
  -- When the collector first retrieved this source measurement, in UTC.
  fetched_at TEXT NOT NULL,
  UNIQUE (facility_id, location_id, source_measured_at_raw)
) STRICT;

-- Serves facility/day history queries once UTC measurement times are available.
CREATE INDEX occupancy_measurements_by_facility_time
  ON occupancy_measurements (facility_id, measured_at);

-- Fetch logs can be pruned independently; historical measurements have no dependency
-- on their retention. Duplicate inserts should use an explicit ON CONFLICT target.
-- The collector must compare existing count/closure fields before treating a duplicate
-- timestamp as unchanged. Raw timestamp uniqueness is provisional until source behavior
-- (including DST fallback) is understood. Never deduplicate solely by visitor_count.
