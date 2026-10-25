# Occupancy data source

Source inspected September 12, 2026.

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

Timestamps include a date but no UTC offset. Preserve the raw timestamp. Normalization assumes America/Chicago, including daylight saving; see [timestamp policy](source-timezone.md). Closed locations in the sample retained previous-day timestamps. Do not interpret missing or stale data as zero.

## Implementation decisions

- TypeScript; TanStack Start frontend on Cloudflare Workers
- Separate scheduled collector Worker; shared Cloudflare D1 database
- Direct parameterized SQL; Tailwind CSS; Recharts
- Default polling: every 10 minutes, adjustable through Wrangler schedule configuration
- Persist per-location measurements, with location ID and measurement timestamp as provisional uniqueness key
- Keep discovery fetch logs, including unchanged results and failures
- Detect changed counts under unchanged timestamps rather than silently discarding them
- Keep collection independent of dashboard development

## Source limitations

The endpoint reports the latest reading, so polling cannot recover updates missed between requests. Source timestamps and closure flags may remain unchanged overnight. A successful poll confirms retrieval, not a fresh measurement or current opening hours.

The collector preserves raw responses and records conflicts when counts or closure flags change under an existing timestamp. Missing or invalid counts fail validation instead of becoming zero.
