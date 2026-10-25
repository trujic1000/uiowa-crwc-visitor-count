# Iowa CRWC Visitor Count

A historical occupancy tracker and dashboard for the University of Iowa Campus Recreation & Wellness Center.

Live dashboard: [CRWC occupancy](https://uiowa-crwc-dashboard.atrujic.workers.dev). Reads production D1 directly.

## Preview the dashboard

```sh
npm --prefix dashboard run seed
npm --prefix dashboard run dev
```

Open http://127.0.0.1:3000. This uses a saved production snapshot in an isolated local database. See [dashboard setup](dashboard/README.md) for dependency installation, refreshing the snapshot, checks, and eventual deployment.

## Run the probe

Requires Node.js 24 or newer. Node runs the TypeScript directly; no build step is needed.

```sh
npm install
npm run fetch
npm test
npm run typecheck
```

The probe makes one public GET request, validates CRWC records, and prints JSON. It does not poll or write to a database. Errors go to stderr with a nonzero exit code. No login or API secret is needed; the source account key is publicly linked by Iowa Recreational Services.

To save a discovery snapshot:

```sh
mkdir -p work
npm run --silent fetch > work/snapshot.json
```

Set `CRWC_TIMEOUT_MS` to change the default 15-second request timeout. There are no automatic retries.

Output includes per-location measurements, fetch time in UTC, selected HTTP cache metadata, and the original response array (including other facilities). Raw source timestamps have no timezone offset. As of September 23, they are interpreted under the user-approved America/Chicago assumption, including daylight saving; see `docs/source-timezone.md`. The probe preserves raw values and reports that assumption. Missing/invalid counts cause a failed probe rather than zero-valued measurements. Closure flags and old timestamps are preserved. No building-wide total is fabricated from differently aged measurements.

## Stack

TanStack Start, TypeScript, Tailwind CSS, Recharts; Cloudflare Workers and D1 with direct SQL. A separate scheduled collector uses a configurable 10-minute interval. The D1 database and initial migration have been created locally and remotely. The collector is deployed and collecting every ten minutes. The dashboard is implemented in `dashboard/` and deployed separately; see its [setup guide](dashboard/README.md).

See `docs/source-investigation.md` for the endpoint, observed fields, and collection decisions.

## Run the collector locally

The source probe remains available as `npm run fetch`. The Worker entry point is
`src/worker.ts`, which calls `src/collector.ts` on scheduled events.

Start the local Worker (local cron does not run automatically):

```sh
npm run dev
```

In another terminal, trigger a scheduled event twice:

```sh
curl "http://localhost:8787/cdn-cgi/local/scheduled"
curl "http://localhost:8787/cdn-cgi/local/scheduled"
```

Inspect the results from the project directory:

```sh
npx wrangler d1 execute DB --local --command "SELECT id, status, measurements_inserted, conflicting_measurements, error_message FROM collector_fetches ORDER BY id DESC LIMIT 5;"
npx wrangler d1 execute DB --local --command "SELECT location_name, visitor_count, is_closed, source_measured_at_raw FROM occupancy_measurements ORDER BY id DESC LIMIT 15;"
```

A fresh database should receive 11 measurements based on the current source. An unchanged second response should insert zero measurements and create another successful fetch log. If the source updates between runs, new measurements are expected. Stop the dev server with Ctrl+C.

## Deploy manually

```sh
npm test
npm run typecheck
npm run check:deploy
npm run deploy
```

`check:deploy` only bundles and validates; `deploy` publishes the Worker and activates the schedule. The existing database schema needs no further migration for this collector.

The `triggers.crons` setting in `wrangler.jsonc` defaults to `*/10 * * * *` (every ten minutes). Edit that setting and redeploy to adjust polling. Schedule changes may take up to 15 minutes to propagate. `CRWC_TIMEOUT_MS` controls the upstream request timeout. The Worker has no public HTTP collection endpoint; workers.dev and preview URLs are disabled.

After deployment, watch logs with `npx wrangler tail`. After a scheduled run, repeat the inspection queries with `--remote` instead of `--local`. Stopping local development does not stop the deployed collector.

## Data and failure behavior

Each run creates an attempt log before fetching. Measurements and successful log counters are committed together in one D1 batch transaction. An unchanged timestamp produces no new measurement. If its count or closure flag differs, the original measurement is retained and the discrepancy is counted in the fetch log; the full source response preserves the changed fields. New timestamps with identical counts remain separate measurements.

HTTP errors and invalid payloads preserve their response body where available. Network failures record an error without a body. A database outage is also logged to Worker console output if D1 cannot store the failure. Failed runs throw so Cloudflare can report the invocation as failed; future scheduled invocations still run. The application performs no retries. If execution is interrupted, an attempt can remain marked `Collection did not complete`.

`measured_at` is normalized to UTC using the assumed America/Chicago timezone. Ambiguous DST times, nonexistent times, invalid values, and future-at-retrieval times remain NULL. `source_measured_at_raw` retains the source value. Changes to closure state without a timestamp change are preserved in discovery logs, not new historical rows. Fetch-log retention and automatic failure notifications are not configured yet.

## Verification

Eight tests cover parsing and collection, including actual local D1 transactions, duplicates, same-timestamp conflicts, invalid data, HTTP errors, timeouts, concurrency, and rollback. Integration tests use an isolated ephemeral database. A live scheduled-handler smoke test in `work/smoke` inserted 11 measurements on the first run and zero on the unchanged second run, with two successful fetch logs. The normal local development database and remote database were not modified by that smoke test.

References: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
and https://developers.cloudflare.com/d1/worker-api/d1-database/
