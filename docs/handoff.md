# Iowa CRWC Visitor Count — Agent Handoff

Updated September 13, 2026. This is the primary project handoff for a future agent and supersedes the September 12 handoff originally saved in `/tmp/handoff`. Read this first, then inspect current code and refresh remote status before making claims about current collection.

## Resume here

September 23 timezone update: user approved assuming Central time and delegated winter behavior. Adopted `America/Chicago` with DST under `assumed-america-chicago-v1`; this is not a vendor-verified contract. `src/source-time.ts` uses Temporal and rejects ambiguous/nonexistent local times and future-at-retrieval instants. Raw timestamps remain intact. All 990 historical rows were backfilled into existing `measured_at`, with zero unresolved rows; no schema migration. Before snapshots, guarded SQL, rollback, and verification are in `work/timezone/`. All 14 tests and both typechecks/builds passed. Collector deployed as `65428399-9acc-4c7b-9f33-fd274926fa84`; dashboard as `b63692b6-5f79-412d-afee-2a0fb11771c0`. Live weekly chart and refresh verified with explicit “Measurement time · Chicago (assumed)” labeling. New collector normalization passed local D1 integration; no post-deployment scheduled insertion was awaited in this turn. Earlier NULL-only/observation-time rules below are historical. Next product work may use assumed Chicago weekday/hour groupings; review raw-key ambiguity before fall-back.

September 23 deployment update: dashboard is live at https://uiowa-crwc-dashboard.atrujic.workers.dev (version `0f1ec40b-1c21-4ec5-b18b-4b2a0079ed9a`). User explicitly authorized deployment. All 11 tests, both typechecks, and build passed. Browser verified September 23 production readings, weekly history, and refresh with no console errors. Collector and schema were unchanged. Earlier statements that the dashboard is not deployed are historical. Source timezone verification remains outstanding.

September 18 implementation update: the read-only dashboard is now built in `dashboard/` (TanStack Start, Tailwind, Recharts). Shared queries are in `src/dashboard.ts`; health rules in `src/dashboard-status.ts`; three additional tests in `test/dashboard.test.ts`. It has its own Worker configuration and isolated local D1 seeded from the discovery snapshot. See [dashboard guide](../dashboard/README.md). No production deployment or database migration has been performed. Earlier “dashboard not started” and waiting instructions below are historical.

September 18 update: step 1 data-readiness analysis is complete. See [data readiness](data-readiness.md) for the refreshed production snapshot, cadence, closure findings, and dashboard display contract, and [source timezone](source-timezone.md) for timezone evidence. The user is ready to start UI planning; the earlier waiting instruction below is historical. No frontend, migration, or deployment was performed in this pass.

**The user has chosen to wait a few days for data to accumulate before starting the dashboard or further analysis. Do not start building merely because this handoff is being read.** No reminder, recurring agent check, or notification automation was created; only the deployed Cloudflare collector is scheduled.

Latest verified snapshot: September 13 at 13:53 UTC / 8:53 AM America/Chicago. Remote D1 contained 69 successful attempts, zero errors, zero conflicts, and 21 inserted measurements. After the earlier outage, 65 consecutive successful attempts covered 03:11:09–13:51:23 UTC (September 12 at 10:11 PM through September 13 at 8:51 AM Chicago). There were no gaps greater than 15 minutes during that resumed period. This is evidence of over ten hours of sustained collection, not a guarantee of future reliability.

When the user returns: check latest remote attempts and gaps, determine whether enough usable history accumulated, then analyze cadence and source timezone before or alongside the agreed basic dashboard. The initial cron failure's root cause is unresolved; see the incident history below. Do not repeat the earlier unsupported claim that a stuck trigger was conclusively fixed.

## Objective and user preferences

Build a small historical occupancy tracker for the University of Iowa Campus Recreation & Wellness Center (CRWC). The priority is reliable data collection, then a basic dashboard, then historical insights. Do not start with predictions, accounts, notifications, or complex infrastructure.

All project files belong in `/Users/atrujic/dev/uiowa-crwc-visitor-count` (`~/dev/uiowa-crwc-visitor-count`). This handoff is saved persistently at `docs/handoff.md`, at the user's request. Temporary files under `/tmp` are not required to resume.

The user wants to learn by running infrastructure commands manually. The established workflow is: agent writes and tests code, explains the next command, user runs local migration/deployment commands and shares output. Later, during cron troubleshooting, the user explicitly said: ‘go ahead and run wrangler commands yourself to figure out what's wrong.’ The agent used that authorization for remote reads, trigger recreation, a diagnostic deployment and cleanup, and the final instrumented collector deployment. Do not ask the user to run every diagnostic command again. Preserve the learning preference for future infrastructure work: explain actions, and do not treat troubleshooting authorization as blanket approval for paid upgrades, unrelated deployments, or schema changes. The user has created a Cloudflare account and authenticated Wrangler locally. No new login or database creation is needed unless fresh evidence indicates otherwise. Do not ask the user to locate the public occupancy widget; it is already identified below. A Deep Research skill selection was accidental and explicitly withdrawn.

## Current stage

- Phase 0, source investigation: public JSON endpoint identified and fetched successfully; timestamp timezone and long-term behavior remain unresolved.
- Phase 1, collector: implemented, tested locally, deployed with a ten-minute cron schedule, and verified running overnight after a diagnostic redeployment. Earlier collection outages remain unexplained.
- Phase 2, cadence analysis: deferred by user until a few days of history accumulate (roughly 2–7 days). Polling cadence is configured; upstream measurement cadence is not established.
- Phase 3, dashboard: not started. There is no frontend or read API yet.
- Historical insights, prediction, and alerts: future work.

MVP is not complete. Remaining MVP requirements include continued verification of unattended reliability, cadence analysis, trustworthy timestamp normalization, and a basic web dashboard.

## Agreed architecture

- TypeScript throughout; Node.js 24+ for local TypeScript execution.
- Separate Cloudflare Worker for scheduled collection.
- Cloudflare D1 / SQLite, direct parameterized SQL, no ORM.
- Future frontend: TanStack Start (React + Vite), Tailwind CSS, Recharts, deployed to Cloudflare Workers.
- Keep the frontend deployment independent from the scheduled collector, sharing D1.
- No Next.js or Vercel. The user wants to try TanStack Start and avoid dependence on Vercel.
- Default polling interval is ten minutes, configurable through Wrangler cron configuration and redeployment. The earlier five-minute proposal was superseded.
- No Redis, queues, Kafka, Kubernetes, user authentication, mobile app, ML, or unnecessary framework layers.

## Verified source

Official facility page:
https://recserv.uiowa.edu/campus-recreation-wellness-center

The official page links this public widget:
https://www.connect2mycloud.com/Widgets/Data/locationCount?type=bar&key=8c72a6a7-d6ee-4520-bc3a-52215462ac23

The widget's JavaScript calls this JSON endpoint using GET:
https://goboardapi.azurewebsites.net/api/FacilityCount/GetCountsByAccount?AccountAPIKey=8c72a6a7-d6ee-4520-bc3a-52215462ac23

No supplied cookies, login, or browser automation were necessary for direct fetching. The query key is published in the official public widget URL, not a private credential. The array contains multiple Iowa facilities; filter numeric `FacilityId === 178` for CRWC.

Relevant fields:

- `FacilityId`, `FacilityName`
- `LocationId`, `LocationName`
- `LastCount` (use this, not `CountOfParticipants`)
- `LastUpdatedDateAndTime`
- `IsClosed`
- `TotalCapacity` (present but not used or independently validated)

The user explicitly confirmed that the count represents people currently inside and the timestamp represents a facility measurement, not a page refresh. The actual endpoint provides measurements per area, not one building-wide total.

Observed CRWC locations:

| ID | Area |
| --- | --- |
| 883 | 1st Floor Free Weight Area |
| 884 | 2nd Floor Fitness Area |
| 885 | 3rd Floor Fitness Area |
| 886 | Basketball Courts |
| 887 | Track |
| 889 | MAC |
| 890 | Competition Pool |
| 891 | Rec Pool |
| 893 | Climbing Wall |
| 10413 | Bouldering Wall |
| 10419 | Dive Well |

Do not hard-code eleven as a permanent required count. Each area has its own source timestamp. Closed areas can retain older timestamps. A summed facility count would be derived from potentially differently aged observations, so any future total requires freshness rules.

Sample timestamp: `2026-09-12T12:43:50.763`. It has a date and fractional seconds but NO UTC offset. America/Chicago is the intended facility timezone, but source timezone has not been verified. Never let Node/Workers implicitly parse the naive string as UTC. Preserve the raw value. All current `measured_at` database values are intentionally NULL. UTC `fetched_at` is populated separately.

An Iowa response returned `Cache-Control: no-cache`, with no Age, ETag, or Last-Modified header. This does not prove upstream measurements update on each request. Initial snapshots are in ignored `work/` files. Fetch logs preserve full response bodies, including non-CRWC facilities.

## Files and responsibilities

Paths below are relative to the project root:

- `src/connect2.ts`: endpoint constants, validation, `fetchCrwc()`, and `SourceError` retaining HTTP status/body on parsing and HTTP failures. Validates per-area nonnegative integer counts, IDs, names, closure booleans, and naive calendar timestamps. Rejects missing CRWC data and duplicate locations within a response. One request, default 15-second timeout, no application retries.
- `src/fetch-crwc.ts`: one-shot local CLI probe; prints JSON, reports failures to stderr with nonzero exit code. `CRWC_TIMEOUT_MS` can override timeout.
- `src/collector.ts`: `collect()` creates a fetch log, retrieves data, writes measurements and counters in a D1 transaction, and logs failures.
- `src/worker.ts`: scheduled handler only; logs `collection_started` with `cron`, `scheduledAt`, and `startedAt` BEFORE calling the collector, then awaits collection with D1 and the configured timeout. No public collection HTTP endpoint.
- `wrangler.jsonc`: collector entry point, D1 binding, schedule, timeout, observability.
- `migrations/0001_initial_schema.sql`: already applied locally AND remotely by user. Do not edit this applied migration to change the deployed schema; add a subsequent migration if needed.
- `test/connect2.test.ts`: seven parser/fetch tests.
- `test/collector.test.ts`: one integration test containing multiple collection scenarios in isolated ephemeral local D1.
- `README.md`: local/manual deployment instructions, behavior and verification details.
- `docs/handoff.md`: this resume document.
- `docs/source-investigation.md`: source research, implementation notes, incident chronology, and overnight verification. Earlier sections describe historical states; use the latest dated evidence.
- `work/`: ignored snapshots, dry-run bundle, and isolated smoke-test database.
- `.wrangler/`: ignored user's normal local Wrangler state; preserve it.

During this session `git status` reported that the project directory was not a Git repository. No commits or PRs were created; inspect the current filesystem rather than assuming Git history exists.

Installed dev dependencies: Wrangler 4.131.1 range, TypeScript 5.9 range, Node 24 types, Cloudflare Workers types, Miniflare. The installed Miniflare version is `5.20260911.0-alpha`; tests use its `convertV4MiniflareOptions` helper. TypeScript `skipLibCheck` is enabled because the shipped local runtime declarations reference unresolved internal types. Project source is still typechecked. `package-lock.json` records installed versions.

## Database schema and collection semantics

`occupancy_measurements` is a STRICT table with:

- `id` integer primary key
- facility/location IDs and names
- `visitor_count` nonnegative integer
- `is_closed` integer constrained to 0 or 1
- `source_measured_at_raw` nonempty text
- nullable `measured_at` (future verified UTC normalization)
- `fetched_at` UTC text
- uniqueness on `(facility_id, location_id, source_measured_at_raw)`
- index on `(facility_id, measured_at)`

`collector_fetches` is a STRICT table with:

- `id`, `fetched_at`, `status` (`success` or `error`)
- nullable `http_status`
- `duration_ms`
- `measurements_inserted`, `conflicting_measurements`
- `error_message`, `raw_response`
- index on `fetched_at`

Every run initially inserts an error-state attempt with `Collection did not complete`. This keeps interrupted runs visible. After retrieval, a D1 `batch()` transaction alternates per-location INSERT ... ON CONFLICT DO NOTHING and a fetch-log counter update using SQLite `changes()`. The final statement marks the attempt successful and stores the response. Tests confirmed transactional rollback and concurrent deduplication.

Same location/timestamp and unchanged count/closure: no new historical measurement, but another fetch log.

Same location/timestamp and different count OR closure: retain original historical row, increment conflict count, preserve new response in fetch log. This is deliberate and provisional; do not silently overwrite history. Current closure state may therefore need to be read from recent fetch payloads until a richer correction policy is implemented.

Same count with a new timestamp: new measurement.

Failure: store error details and body where possible, emit console error, and throw so Cloudflare marks invocation failed. If D1 itself fails, console logging is the fallback. Future cron invocations still run. There are no application retries. No automatic alerting or retention job exists.

Technical caveat: successful `duration_ms` is computed before executing the final D1 batch, so it excludes that batch's execution time. It should not be described as a complete end-to-end latency metric.

## Cloudflare resources and deployment

- Worker: `uiowa-crwc-collector`
- D1 name: `uiowa-crwc-occupancy`
- D1 ID: `eba86420-0605-4e25-9721-18b911a35843`
- Binding: `DB`, accessible as `env.DB`
- Database creation region reported by Wrangler: ENAM
- Compatibility date: `2026-09-12`
- Cron: `*/10 * * * *`
- Variable: `CRWC_TIMEOUT_MS = "15000"`
- Observability enabled
- `workers_dev: false`, `preview_urls: false`

The first deployment uploaded code but failed to register cron with Cloudflare error 10063 because the account's workers.dev subdomain was not initialized. The user resolved this by visiting Workers & Pages in the dashboard and redeployed successfully. Do not revisit this resolved issue without new evidence.

Latest successful agent deployment:

- Worker: `uiowa-crwc-collector`
- Version ID: `b2185f6d-718f-4926-a377-205f3da33e66`
- Schedule: `*/10 * * * *`
- Change: added the scheduled-handler entry log; collection semantics and schema stayed unchanged.
- Deployment and trigger registration succeeded. Sustained collection was subsequently verified in remote D1.
- Earlier version: `08540301-8716-4e9c-a8c2-83698b3778d4`.
- Account ID used for API diagnostics: `385ad5af879d2ab66c0e2714f4a6a210` (identifier, not a credential).

### Cron incident history and what is actually known

1. The initial registered schedule produced no observed invocations and zero D1 attempts despite a correctly deployed handler and D1 binding. Simply reapplying `wrangler triggers deploy` did not restore observed collection.
2. A temporary `uiowa-crwc-cron-diagnostic` Worker, with no D1 or external fetch dependency and a once-per-minute cron, successfully logged a scheduled event. It also used `workers_dev: false`. Disabled public URLs are therefore not a general barrier to cron execution in this account.
3. With explicit user authorization for direct Wrangler troubleshooting, the agent removed the original collector trigger via a temporary config containing `crons: []`, then reapplied the production config. The API reported a fresh trigger created at `2026-09-12T22:48:15.677419Z`.
4. The unchanged collector then ran at 22:50, 23:00, 23:10, and 23:20 UTC September 12. All four attempts succeeded. The first inserted 11 measurements; the others inserted zero. A live tail showed a successful invocation with 6 ms CPU and no exceptions.
5. The diagnostic Worker was deleted and its local `src/cron-diagnostic.ts` and `wrangler.diagnostic.jsonc` files removed. Do not assume it still exists or ask the user to run those old commands. Ignored temporary troubleshooting files may remain in `work/`.
6. Collection stalled again after `2026-09-12T23:20:35.261Z`. A fresh D1 query around September 13 at 02:39 UTC still showed only four attempts. Trigger and bindings remained correct. Trigger recreation was only a temporary recovery, not a durable fix.
7. General `workersInvocationsAdaptive` analytics returned only three of the four D1-confirmed successes, omitting 23:00. A user-supplied Cloudflare AI investigation reported that dedicated `workersInvocationsScheduled` data was entirely empty, even for confirmed runs. Treat that dedicated-dataset result as externally reported, not independently verified by this agent. Analytics are not a complete execution ledger here.
8. The Cloudflare AI claimed Free cron events could be dropped for capacity and Paid accounts got higher scheduler priority. It subsequently withdrew both claims as unsupported. Do not recommend paying to fix this based on those claims. It also reported the account was Free; that account-plan finding was not independently verified by this agent.
9. The agent added `collection_started` before the first D1 operation, ran checks, and performed a full collector deployment (latest version above). Collection resumed at `2026-09-13T03:11:09.430Z` and continued through the latest verified attempt at `2026-09-13T13:51:23.011Z`.
10. At the September 13 13:53 UTC verification, remote D1 showed 69 attempts total, all successful, 21 inserted measurements, zero conflicts. The only gap over 15 minutes was the known 230.6-minute interval between 23:20 and 03:11 UTC. The resumed period contained 65 attempts over 10 hours 40 minutes.

**Interpretation:** collection is healthy at the latest verified snapshot. The original failure and later recovery are correlated with trigger recreation/redeployment, but the internal cause is not proven. There is no evidence the added log itself repaired scheduling. No D1 attempt can mean no delivery OR failure before the first insert. A `collection_started` log without a D1 row narrows failure to after handler entry; absence of both still leaves delivery, startup, and logging failure possibilities. Successful observed runs used roughly 4–7 ms CPU; that does not rule out unobserved failures.

Do not repeatedly reset a healthy trigger. If a stall recurs, capture timestamps, D1 results, version and trigger metadata, and available logs before changing state. Do not declare a fix from a single recovered run. Never paste Wrangler credentials into output or documents.

## Tests completed

- `npm test`: eight tests passed, including real local D1 integration scenarios: first insert, repeat deduplication, same-timestamp conflict, identical count/new timestamp, invalid payload, HTTP 503, abort timeout, transaction rollback, and concurrent repeated observations.
- `npm run typecheck`: passed.
- `npm run check:deploy`: passed for latest instrumented version; Worker bundle approximately 8.25 KiB, gzip 2.80 KiB; deployed startup time 4 ms.
- Agent's two live scheduled-handler runs against separate `work/smoke` D1: first inserted 11, second inserted 0; both successful with zero conflicts.
- User independently repeated this in their normal local database: first inserted 11, second 0, both success, zero conflicts, NULL error.
- Latest instrumented deployment succeeded and overnight remote execution was verified as detailed above.
- In the restricted agent shell, the local D1 test initially failed with `listen EPERM` on loopback. It passed when rerun with required sandbox permission; this was an environment restriction, not an application failure. Wrangler network calls also required network permission in that environment. `WRANGLER_LOG_PATH=/tmp/crwc-wrangler.log` avoids attempts to write logs outside permitted paths.

## What to do when the user returns

The immediate action now is to let the deployed collector accumulate data. The user explicitly deferred building until a few days have passed. No agent monitoring automation was requested or installed.

1. **Refresh collection health first.** Use the read-only summary, recent-attempt, and gap queries below. Compare latest `fetched_at` with the actual current UTC time. A zero-insert success is healthy deduplication, not a failed poll. Historical gaps and a stale most-recent attempt are different checks: LAG cannot detect an ongoing outage after the final row.
2. **Analyze roughly 2–7 days of usable history.** Measure per-location source update intervals, unchanged responses, same-timestamp conflicts, errors, closures, and stalls. Examine preserved fetch payloads as well as deduplicated rows. At the last snapshot 69 polls yielded 21 distinct rows; do not infer an hourly upstream cadence from that overnight sample. A latest-values-only source cannot recover measurements missed between polls.
3. **Verify source timezone.** Establish evidence for timezone, define DST ambiguity/nonexistent-time policy, then add an appropriate migration/script to backfill normalized UTC `measured_at`. Review before remote changes. Do not modify the applied initial migration or manufacture UTC values from naive timestamps.
4. **Build the basic dashboard when the user is ready.** Agreed stack: TanStack Start, React/Vite, Tailwind, Recharts; a frontend Worker independent from the collector sharing D1. No frontend or read API exists yet. First views: latest reported per-area occupancy, source freshness, collector health, today's history chart, and recent readings. Distinguish measured time from fetched time, missing from zero, and closed from stale. Avoid smooth fictional precision and unqualified building totals.
5. **Add maintenance.** Decide fetch-log retention after discovery, establish backup/export, and detect missed/failed collection runs. Preserve long-term measurements. No external notifications have been authorized. No retention, backup schedule, or alerting system exists currently.
6. **Later, with adequate history:** comparable weekday/time medians, weekly heatmap, current versus typical with sample counts. Prediction, accounts, and alerts are outside the initial MVP scope.

## Resume and operational commands

Run from `/Users/atrujic/dev/uiowa-crwc-visitor-count`.

Use `--json` for unambiguous machine-readable output. During initial debugging a successful non-JSON query with zero rows displayed only execution metadata; the explicit count query removes ambiguity.

Summary:

```sh
npx wrangler d1 execute DB --remote --json --command "SELECT COUNT(*) AS attempts, MIN(fetched_at) AS first_attempt, MAX(fetched_at) AS latest_attempt, SUM(status = 'error') AS errors, SUM(measurements_inserted) AS inserted, SUM(conflicting_measurements) AS conflicts FROM collector_fetches;"
```

Historical gaps greater than 15 minutes (also separately compare latest attempt to now):

```sh
npx wrangler d1 execute DB --remote --json --command "SELECT fetched_at, previous_at, ROUND((julianday(fetched_at)-julianday(previous_at))*1440,1) AS gap_minutes FROM (SELECT fetched_at, LAG(fetched_at) OVER (ORDER BY fetched_at) AS previous_at FROM collector_fetches) WHERE (julianday(fetched_at)-julianday(previous_at))*1440 > 15 ORDER BY fetched_at DESC LIMIT 20;"
```

Recent remote attempts:

```sh
npx wrangler d1 execute DB --remote --command "SELECT id, fetched_at, status, measurements_inserted, conflicting_measurements, error_message FROM collector_fetches ORDER BY id DESC LIMIT 10;"
```

Inspect remote measurements:

```sh
npx wrangler d1 execute DB --remote --command "SELECT location_name, visitor_count, is_closed, source_measured_at_raw, fetched_at FROM occupancy_measurements ORDER BY id DESC LIMIT 20;"
```

Watch future remote logs:

```sh
npx wrangler tail uiowa-crwc-collector --format json
```

Tail captures future events, not past history. Look for `collection_started`, `collection_complete`, `collection_failed`, and `fetch_log_failed`, along with invocation outcome and CPU time. Stopping tail does not stop the deployed cron. Observed invocations have been offset from exact ten-minute boundaries; judge gaps using actual attempt times and do not require second-zero execution.

Inspect deployment metadata:

```sh
npx wrangler deployments list --name uiowa-crwc-collector
npx wrangler versions view b2185f6d-718f-4926-a377-205f3da33e66 --name uiowa-crwc-collector --json
```

The version ID above is the latest known at handoff time; use the current deployment's version if it changes. The trigger API is `GET /accounts/{account_id}/workers/scripts/uiowa-crwc-collector/schedules`; use existing authenticated tooling and never expose credentials.

Run one local source probe:

```sh
npm run fetch
```

Start local Worker; local cron does not execute automatically:

```sh
npm run dev
```

In another terminal, trigger it:

```sh
curl "http://localhost:8787/cdn-cgi/local/scheduled"
```

For local database inspection, substitute `--local` for `--remote`. Ctrl+C stops local development, not the deployed schedule. Local data is not automatically copied to remote D1.

Checks and manual deployment after changes:

```sh
npm test
npm run typecheck
npm run check:deploy
npm run deploy
```

Only the last command publishes changes. Change the cron in `wrangler.jsonc` and redeploy to adjust frequency. The existing migration requires no reapplication for the current collector code.

## Cost expectations previously discussed

Expected collector-only cost is $0/month if the account remains on Workers Free. The user-supplied Cloudflare AI report identified the account as Free; this agent did not independently verify billing. No paid upgrade was made. Ten-minute polling is 144 scheduled runs/day and at most 1,584 new per-location rows/day at the current eleven locations, plus log updates and index writes. These are estimates, not measured billing metrics. Logs store full source payloads and need eventual retention management. Do not promise unlimited free storage or future frontend traffic capacity.

Official documentation checked during this work:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://tanstack.com/start/latest/docs/framework/react/guide/hosting

As checked September 12, 2026, Free allowances include 100,000 Worker requests/day, 5 million D1 rows read/day, and 100,000 D1 rows written/day. Free limits can block service instead of automatically billing overages. Paid Workers starts at $5/month. Verify current limits and actual account plan before revising cost guidance.

## Suggested prompt for the next session

The user subsequently chose to accumulate a few weeks of history before building.

> Read `docs/handoff.md` in this project. We paused to let occupancy data accumulate. First check current remote collection health and historical gaps, then summarize how much usable history we have and whether we are ready for cadence/timezone analysis and the basic dashboard. Preserve raw measurement timestamps until the source timezone is verified.
