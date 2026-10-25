# Dashboard data readiness

Verified September 18, 2026 against remote D1, covering September 12 22:50 UTC through September 18 13:21 UTC. This note supersedes the older health snapshot in the handoff. Read-only analysis; no deployment, migration, or normalization was performed.

September 23 update: the user approved an America/Chicago assumption including daylight saving. Measurement-time charts and normalized UTC values now supersede the observation-time fallback below. See [source timezone](source-timezone.md) for the adopted policy; the rest of this note records the earlier readiness analysis.

## Decision

Proceed with the basic dashboard. History is sufficient for latest reported counts and recent observations, but not robust weekday baselines. Source timezone remains unverified; use the safe time-display contract below. See [timestamp investigation](source-timezone.md).

## Collection evidence

- 786 attempts: 782 successful (99.5%), four timeouts, zero recorded conflicts.
- 496 distinct measurements across 11 observed areas. All normalized `measured_at` values remain NULL.
- 726 successful polls inserted nothing (92.8% of successes): expected deduplication, not a collection failure.
- The only inter-attempt gap over 15 minutes was the known 230.6-minute startup outage. Since recovery on September 13 at 03:11 UTC, the largest interval between successful polls was 20.2 minutes; isolated timeouts account for these skipped successful observations.
- Each complete UTC day September 14–17 had 144 attempts. The latest poll succeeded at September 18 13:21 UTC.

## Observed measurement cadence

These are gaps between consecutive stored source timestamps on the same source calendar date, excluding pairs where either endpoint reports closed. They are observed update intervals, not a guaranteed schedule or proof that intermediate updates were never missed. Counts include the initial retained reading, which can predate collection. Percentiles use the nearest sample rank (`round((n-1)*p)`).

| Area | Readings | Eligible intervals | Median minutes | P90 minutes | Closed polls / 782 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1st Floor Free Weight Area | 56 | 49 | 82.4 | 139.6 | 0 |
| 2nd Floor Fitness Area | 56 | 49 | 82.4 | 139.6 | 0 |
| 3rd Floor Fitness Area | 56 | 49 | 82.4 | 139.6 | 0 |
| Basketball Courts | 55 | 48 | 85.1 | 149.0 | 0 |
| Track | 56 | 49 | 82.4 | 139.6 | 0 |
| MAC | 53 | 46 | 85.8 | 149.0 | 0 |
| Competition Pool | 38 | 17 | 85.8 | 116.1 | 434 |
| Rec Pool | 31 | 13 | 86.9 | 122.4 | 394 |
| Climbing Wall | 26 | 14 | 85.8 | 151.0 | 461 |
| Bouldering Wall | 55 | 48 | 83.5 | 139.6 | 0 |
| Dive Well | 14 | 6 | 67.1 | 120.9 | 643 |

Core fitness updates have minimum same-day gaps of 38.7 minutes and maximum gaps of 270.7 minutes. Keep ten-minute polling: it finds new readings promptly and there is no need to increase frequency. Charts must not imply continuous measurement.

No source timestamp regressions were observed in successful payloads. Assuming Chicago daylight time solely for analysis, per-area median first-seen lag is 3.9–6.2 minutes, with minima of 0.1–1.0 minutes; no negative first-seen lags were found. This strongly supports UTC−05 for this sample, but does not establish a year-round timezone contract.

## Closure and missing-data findings

- Every successful payload contains the same 11 areas in this sample; do not make eleven a permanent schema requirement.
- Fitness floors, courts, track, MAC, and bouldering have no closed flags in the sample, including long overnight holds. `IsClosed = false` means only “source did not report closed”; it is not reliable evidence of current opening hours.
- There are 30 closed measurement rows, five with nonzero counts. Never turn a closed reading into zero or advertise the retained count as people currently inside.
- Pools, climbing, and dive well have observed closure transitions. Closed readings can keep old timestamps.
- There are no same-timestamp conflicts in this sample. The existing collector nevertheless permits future corrections to appear only in fetch payloads, so current cards should use the latest successful validated payload, with historical rows for charts.

## Dashboard display contract

These are initial product rules, not upstream guarantees.

| Condition | Display and behavior |
| --- | --- |
| Count present, source not marked closed | “Latest reported count”, literal source timestamp, and separately “Last checked … ago”. Do not label this live or infer “Open”. |
| Source says closed | “Reported closed”, qualified by last successful check. Optionally show retained count as a historical reading; never substitute zero. |
| Area absent from latest successful payload | “No current reading”; retain prior reading only as explicitly historical. Never silently carry it forward as current or substitute zero. |
| Valid reported zero | Display 0, distinct from unavailable and closed. |
| Timestamp timezone unresolved | Show literal source date/time labelled “Source time · timezone unverified”. Do not compute “measured … ago” from it. |
| Latest successful poll no more than 15 minutes old | Collector “Up to date”. If a newer attempt failed, add the failure separately. This says nothing about measurement freshness. |
| Latest successful poll 15–30 minutes old | Collector “Delayed”; show age of last success and any latest error. |
| Latest successful poll over 30 minutes old, or none exists | “Collection overdue” or “No successful collection”. Retained counts remain visibly last-known readings. |
| Same source timestamp repeatedly observed for more than 3 hours | For a non-closed area, flag “No new reading observed for at least 3 hours”. Compute this lower bound from UTC first-seen time and the last successful confirming poll, not from naive source time. It is a conservative heuristic, not an opening-hours rule. |

The three-hour rule exceeds the sampled core P90 of roughly 140–149 minutes but will still flag some legitimate long intervals. Always expose the exact source timestamp and collector status. For an initial retained reading, the first-seen timestamp is only a lower bound on age. If collection is overdue, avoid implying the source remained unchanged after our last successful check. A newly reappearing area needs a conservative first-observed reference for its current timestamp; older corrections must not masquerade as fresh measurements.

## Chart contract and timezone follow-up

For the first dashboard, plot distinct observations against UTC `fetched_at`, converted explicitly to America/Chicago for display, with axis title “First observed by collector”. A “Today” filter refers to that observation date, not an asserted measurement date. Tooltips include the literal source timestamp. Use points, no smoothing, no interpolation across gaps, and distinguish closed observations. Do not aggregate an unqualified building total.

After the source timezone contract is established, add a separate reviewed normalization/backfill and use measurement-time charts. Reject ambiguous fall-back and nonexistent spring-forward times rather than silently resolving them. Keep raw timestamps and provenance. See the timestamp note for the unique-key limitation at fall-back. Confirmation from the vendor/university or explicit upstream timezone metadata would resolve this; no outreach has been sent.

## Reproduction and next step

The ignored local snapshot is `work/readiness/d1-snapshot.json`; `work/readiness/analyze.py` produces `work/readiness/analysis.json`. The snapshot contains two Wrangler JSON result sets: `SELECT * FROM occupancy_measurements ORDER BY fetched_at,id;` and `SELECT id,fetched_at,status,error_message,measurements_inserted,conflicting_measurements,raw_response FROM collector_fetches ORDER BY fetched_at,id;`. Analyze successful CRWC payload rows only. Raw snapshot files are discovery artifacts; the findings above are the durable record.

Next: build read queries and the first page using this contract. The UI can proceed without inventing normalized measurement instants. No source or database changes are required for these initial display rules.
