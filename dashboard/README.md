# CRWC dashboard

TanStack Start + React, Tailwind, and Recharts. This is an independent Cloudflare Worker named `uiowa-crwc-dashboard`, sharing the collector's D1 in production. It has no cron and performs only SELECT queries. Collector commands and configuration remain at the project root.

## Local preview

From the project root:

```sh
npm --prefix dashboard ci
npm --prefix dashboard run seed
npm --prefix dashboard run dev
```

Open http://127.0.0.1:3000. The seed command defaults to the ignored, real September 18 snapshot at `work/readiness/d1-snapshot.json`. It imports into **dashboard/.wrangler/state**, separate from the collector's local data. It cannot use remote D1. Repeated imports skip existing IDs. The importer sets local fetch duration to zero because the analysis export omitted duration; no dashboard metric uses that field.

The preview shows a local-data banner. Refresh reloads the local database; it does not fetch the upstream service or production D1. Old snapshots correctly show collection overdue. The source measurements themselves are never time-shifted. If the snapshot is unavailable, create an empty local database by running `./node_modules/.bin/wrangler d1 execute DB --local --config wrangler.jsonc --file ../migrations/0001_initial_schema.sql` from the `dashboard/` directory, or obtain another read-only export.

To refresh the snapshot, run from the project root using its authenticated Wrangler installation:

```sh
mkdir -p work/readiness
WRANGLER_LOG_PATH=/tmp/crwc-wrangler.log ./node_modules/.bin/wrangler d1 execute DB --remote --json --command "SELECT * FROM occupancy_measurements ORDER BY fetched_at,id; SELECT id,fetched_at,status,error_message,measurements_inserted,conflicting_measurements,raw_response FROM collector_fetches ORDER BY fetched_at,id;" > work/readiness/d1-snapshot.json
npm --prefix dashboard run seed
```

For a new snapshot path: `npm --prefix dashboard run seed -- /absolute/path/snapshot.json`.

## Behavior

- Server-rendered area cards use the latest successful validated payload. Missing areas display no current reading; closed areas do not display a fabricated zero. An older stored history record never overrides a correction in that payload.
- Area cards switch the chart and readings table. Today uses the assumed Chicago measurement date; the other range is the trailing seven days. Charts plot normalized measurement timestamps under the documented America/Chicago assumption. Closed observations use cross markers and retained-count labels.
- Source wall clocks are normalized with Chicago daylight-saving rules (an assumption, not a verified vendor contract). Ambiguous, nonexistent, invalid, and future-at-first-retrieval times remain unresolved and are excluded from charts. Raw source timestamps and separate first-observed times remain visible.
- Collector health is based on last success: up to date ≤15 minutes, delayed ≤30, overdue thereafter. A failed most-recent attempt is shown separately. Time labels update every 30 seconds and data refreshes every minute while the page is visible.
- Unchanged-reading badges use matching count/closure/timestamp across successful payloads in a four-hour window, anchored to the last success. Absence or corrections reset that conservative run. No source timestamp is implicitly parsed as UTC.
- Fetch bodies and error details stay on the server. Responses are no-store. SQL uses fixed queries and a bound history cutoff. History is capped at 12,000 rows with an explicit truncation notice.
- Rows in the seven-day retrieval window are filtered by normalized measurement time; unresolved rows remain visible in the table. The latest-area query scans stored measurements; the seven-day query currently uses the existing facility index. For this small first release no remote migration is needed. Add a fetched-time index and bounded per-area pagination if history size/traffic justifies it. Fetch-log retention must preserve enough recent payloads for freshness and current-state reads.

## Fitness-floor heatmaps

The dashboard includes separate weekday/hour heatmaps for the 1st Floor Free Weight Area and 2nd/3rd Floor Fitness Areas. The window is the trailing 28 × 24 hours, grouped by assumed America/Chicago measurement time. Each cell is the median of the daily hourly medians; calendar days have equal weight. It uses distinct stored source measurements, excludes reported-closed and unresolved readings, and never fills gaps or carries counts forward. Genuine zeros remain visible. Cells with fewer than three distinct days have dotted borders and limited-data details. Selecting a cell exposes its exact aggregate, distinct-day count, and measurement count. All floors share a color scale; colors represent people, not percent capacity.

The server reads at most 12,001 recent fitness-floor rows and returns aggregates for at most 12,000 with an explicit truncation notice. No migration or collector change is needed. A stale local snapshot can yield sparse or empty heatmaps as it ages out of the window.

## Checks and deployment

```sh
npm test
npm run typecheck
npm --prefix dashboard run typecheck
npm --prefix dashboard run build
```

The first two run from the project root and include local D1 integration coverage. Root dependencies must also be installed because the dashboard shares the read model and parser in `src/`.

To preview the compiled Worker locally: `npm --prefix dashboard run preview`. Production preview mode omits the development banner but still uses local D1. Do not mistake that for a deployed site.

When ready to publish, run `npm --prefix dashboard run deploy`. This builds and deploys **only** the dashboard Worker using its own configuration; it does not redeploy the collector or migrate D1. Production reads the actual shared database and public access is through the new dashboard's workers.dev URL. Deployed September 23, 2026 at https://uiowa-crwc-dashboard.atrujic.workers.dev. Version: `b63692b6-5f79-412d-afee-2a0fb11771c0`. Production page, weekly history, and refresh were verified against current D1 readings.

Implementation follows the [TanStack Start setup guide](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch) and [Cloudflare integration guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/), checked September 18, 2026.

October 7, 2026: Fitness-floor heatmaps deployed to production, version `b9039b9c-0e70-41b1-b48a-28f85fde2bb1`. Production verified showing all three floor heatmaps and current collection data. Local preview stopped.
