# Source timestamp policy

The API supplies wall-clock timestamps without a UTC offset. The project assumes **America/Chicago**, with UTC−05 during daylight saving and UTC−06 during standard time, under policy `assumed-america-chicago-v1`. This assumption was adopted September 23, 2026; it is not a vendor-verified contract.

## Normalization

`src/source-time.ts` uses Temporal named-zone conversion with `disambiguation: 'reject'`. Nonexistent spring-forward times, ambiguous fall-back times, invalid timestamps, and instants later than first retrieval remain NULL. These records remain available in the readings table but are excluded from measurement-time charts. Normalized UTC values use millisecond precision; full raw source precision is preserved.

The collector writes `measured_at` for new rows. The dashboard uses measurement time for charts and Today filtering, with an explicit Chicago-assumed label. First-observed times remain separately visible. Old local snapshots normalize on read until refreshed. Collector health uses UTC retrieval timestamps.

Never append `Z` to a raw source value or depend on the host machine's timezone. See the [Temporal timezone documentation](https://tc39.es/proposal-temporal/docs/timezone.html) for ambiguity handling.

## Evidence and limitations

Inspection on September 18, 2026 found no timezone metadata in the API response. The public widget parsed timestamps with `new Date(...)` and displayed local clock fields without explicit timezone conversion; that does not establish the original timezone.

A historical sample of 496 distinct readings had no negative first-seen lags under Chicago daylight time, with per-area median lags of 3.9–6.2 minutes. This supports the September offset but does not establish year-round daylight-saving behavior. Vendor documentation, explicit source metadata, or seasonal-transition observations would strengthen the assumption.

The unique key uses location and raw timestamp. If a fall-back hour repeats the exact same raw timestamp, it cannot preserve both instants as separate measurements. Conflicts and raw fetch logs retain evidence; UTC normalization alone does not resolve this identity limitation.

## Historical backfill

`scripts/prepare-timezone-backfill.ts` generates SQL from a Wrangler JSON snapshot. It only fills NULL values, guards the original ID/raw/fetch values, and creates a matching rollback file. Review the generated SQL before applying it. The initial September 23 backfill normalized 990 rows with raw and fetched timestamps unchanged; no schema migration was required.
