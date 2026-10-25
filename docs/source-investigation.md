# Iowa CRWC visitor count: source investigation

Investigated September 12, 2026. Initial live fetch succeeded; update cadence has not yet been measured.

## Source

Official page: https://recserv.uiowa.edu/campus-recreation-wellness-center

Public widget linked from that page:
https://www.connect2mycloud.com/Widgets/Data/locationCount?type=bar&key=8c72a6a7-d6ee-4520-bc3a-52215462ac23

JSON endpoint (HTTP GET):
https://goboardapi.azurewebsites.net/api/FacilityCount/GetCountsByAccount?AccountAPIKey=8c72a6a7-d6ee-4520-bc3a-52215462ac23

The account key is published in the public widget link. A direct GET succeeded without login, supplied cookies, or special headers. JavaScript execution is unnecessary for collection. The response is an array covering multiple facilities.

## CRWC data

Filter FacilityId === 178. The observed response contained 11 CRWC locations. Preserve each location independently; a building total would be derived, not a directly reported measurement.

Relevant fields:

- FacilityId, FacilityName
- LocationId, LocationName
- LastCount: occupancy, as confirmed by the user
- LastUpdatedDateAndTime: source measurement time, as confirmed by the user
- IsClosed: source closure flag
- TotalCapacity: source capacity value; meaning not independently verified

Example excerpt from the live response:

```json
{
  "LocationId": 883,
  "LocationName": "1st Floor Free Weight Area",
  "FacilityId": 178,
  "FacilityName": "Campus Recreation & Wellness Center",
  "LastCount": 18,
  "LastUpdatedDateAndTime": "2026-09-12T12:43:50.763",
  "IsClosed": false,
  "TotalCapacity": 150
}
```

Timestamps include a date but no UTC offset. Preserve the raw timestamp; verify source timezone before normalization. America/Chicago is the intended facility timezone. Closed locations in the sample retained previous-day timestamps. Do not interpret missing or stale data as zero.

## Implementation decisions

- Project directory: ~/dev/uiowa-crwc-visitor-count
- TypeScript; TanStack Start frontend on Cloudflare Workers
- Separate scheduled collector Worker; shared Cloudflare D1 database
- Direct parameterized SQL; Tailwind CSS; Recharts
- Default polling: every 10 minutes, adjustable through Wrangler schedule configuration
- Persist per-location measurements, with location ID and measurement timestamp as provisional uniqueness key
- Keep discovery fetch logs, including unchanged results and failures
- Detect changed counts under unchanged timestamps rather than silently discarding them
- Keep collection independent of dashboard development

## Remaining investigation

- Confirm timezone and timestamp normalization, including daylight saving ambiguity.
- Measure update cadence and whether timestamps reliably identify measurements.
- Observe repeated responses over several days; the verified Iowa response sends Cache-Control: no-cache. This does not guarantee a new upstream measurement.
- Validate null, empty, malformed, and HTTP error handling with local fixtures; upstream failure behavior is not yet observed.
- Determine freshness rules for derived totals across locations.
- Resolve source timezone before persistent UTC measurement normalization.

Initial status at source investigation: no infrastructure had been created. See the implementation status below for subsequent progress.

## Local probe verification

Implemented `src/fetch-crwc.ts` and `src/connect2.ts`. On September 12, 2026 at 18:06:34 UTC, the probe fetched HTTP 200 and validated 11 CRWC locations. Cache-Control was no-cache; Age, ETag, and Last-Modified headers were absent. The full response is saved locally in ignored `work/live-snapshot.json`. Seven validation/fetch tests and TypeScript checking passed. The probe performs one request per invocation, with a configurable 15-second timeout and no retries. Source timezone and cadence remain unverified.

## Collector implementation status

The user created D1, applied the initial migration locally and remotely, and deployed the scheduled Worker with ten-minute polling. Tests and deployment dry run passed. Two live scheduled-handler runs in isolated local D1 inserted 11 and 0 measurements respectively, confirming idempotency for an unchanged response. This does not establish upstream update cadence. Source timezone remains unresolved and normalized measurement times are intentionally NULL.

### Remote cron verification — September 12, 2026

The original deployed cron was visible in the dashboard and API, but remote D1 contained zero attempts and a connected tail showed no invocations. The deployed version exported `scheduled` and had the correct D1 binding. Reapplying the existing trigger did not produce an observed run. A separate minimal diagnostic Worker successfully logged a scheduled event with `workers_dev: false`, demonstrating that a public HTTP URL was not required in this account.

With user authorization to run Wrangler diagnostics directly, the agent removed the collector's cron registration using a temporary config with `crons: []`, then reapplied `wrangler.jsonc`. The API confirmed a new trigger creation time of `2026-09-12T22:48:15.677419Z`. The unchanged collector version `08540301-8716-4e9c-a8c2-83698b3778d4` subsequently ran successfully at `2026-09-12T22:50:35.468Z` (5:50 PM Chicago time). Tail reported `outcome: ok`, 6 ms CPU, no exceptions, and 11 inserted measurements with zero conflicts. A remote D1 query verified the successful attempt and 11 rows across 11 locations.

Collection recovered after trigger recreation; the underlying Cloudflare cause is not proven. One successful unattended run is verified, not long-term reliability. The original ten-minute schedule remains configured. The temporary diagnostic Worker was deleted after verification, and its local source/config were removed.

### Collection stalled again — September 13, 2026 UTC

At approximately `2026-09-13T02:39:20Z` (September 12, 9:39 PM Chicago time), a fresh remote D1 query found only four attempts: 22:50, 23:00, 23:10, and 23:20 UTC. All succeeded; the first inserted 11 measurements and subsequent runs inserted zero, with no conflicts. There were no attempts after `2026-09-12T23:20:35.261Z`, leaving approximately 19 expected ten-minute runs unrecorded at the time of the check.

The Cloudflare API still returned the unchanged `*/10 * * * *` trigger created at 22:48 UTC and the correct D1 binding with full log sampling. A Workers invocation analytics query returned successful invocation records and no error records for the investigated period; this analytics result did not include every D1-confirmed successful run, so it is supporting evidence rather than a complete execution ledger. Observed CPU times in the returned records were below 7 ms. The precise cause remains unresolved. Trigger recreation was a temporary recovery, not a demonstrated durable fix. No further trigger reset or production code change was made during this check. Reliable unattended collection remains an open MVP requirement.

### Subsequent diagnostic deployment

The user supplied a Cloudflare AI investigation reporting that the dedicated Cron Events dataset was also empty, despite the four D1-confirmed runs. That report is not independent proof of absent execution: failure before the first D1 insert remains possible, and analytics are incomplete. Claims about paid scheduler priority and dropped Free-plan events were withdrawn by that AI as unsupported.

Added a `collection_started` console event at scheduled-handler entry, before calling `collect()`, including the cron expression, scheduled time, and handler start time. All eight tests, typechecking, and the deployment dry run passed. Deployed version `b2185f6d-718f-4926-a377-205f3da33e66` with the existing ten-minute schedule. This is a diagnostic deployment, not a verified fix. A start log without a D1 attempt would place the failure after handler entry; absence of both still cannot distinguish undelivered events from startup or logging failures conclusively.

### Overnight verification — September 13, 2026

At 13:53 UTC (8:53 AM Chicago), remote D1 showed 69 successful attempts in total, zero errors, zero conflicts, and 21 inserted measurements. Collection resumed at 03:11:09 UTC and continued through 13:51:23 UTC: 65 attempts over 10 hours 40 minutes. A query using LAG across all attempt timestamps found only the previously known 230.6-minute outage; there were no subsequent gaps greater than 15 minutes. This verifies sustained overnight collection after the diagnostic deployment, but does not establish the original root cause or prove that the added logging fixed it.
