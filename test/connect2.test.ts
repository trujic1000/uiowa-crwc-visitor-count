import test from "node:test";
import assert from "node:assert/strict";
import { fetchCrwc, parseMeasurements } from "../src/connect2.ts";

const row = { FacilityId: 178, FacilityName: "Campus Recreation & Wellness Center", LocationId: 883,
  LocationName: "1st Floor Free Weight Area", LastCount: 18,
  LastUpdatedDateAndTime: "2026-09-12T12:43:50.763", IsClosed: false };

function mock(response: Response): typeof fetch { return (async () => response) as typeof fetch; }

test("selects CRWC and preserves closed areas, zero counts and raw timestamps", () => {
  const result = parseMeasurements([{ FacilityId: 184 }, row, { ...row, LocationId: 10419, LastCount: 0, IsClosed: true }]);
  assert.equal(result.length, 2);
  assert.equal(result[0]?.sourceMeasuredAtRaw, row.LastUpdatedDateAndTime);
  assert.equal(result[1]?.visitorCount, 0);
  assert.equal(result[1]?.isClosed, true);
});

test("rejects absent facilities, malformed payloads and duplicate locations", () => {
  for (const payload of [null, {}, [], [{ FacilityId: 184 }], [null], [row, row]]) {
    assert.throws(() => parseMeasurements(payload));
  }
});

test("rejects missing, negative, fractional and string counts", () => {
  for (const LastCount of [undefined, null, -1, 1.5, "18", NaN]) {
    assert.throws(() => parseMeasurements([{ ...row, LastCount }]));
  }
});

test("checks calendar dates and preserves midnight and ambiguous DST wall times without inventing UTC", () => {
  for (const stamp of ["2026-02-30T12:00:00", "12:05 PM", "2026-09-12T24:00:00", "2026-09-12T12:00:00Z"]) {
    assert.throws(() => parseMeasurements([{ ...row, LastUpdatedDateAndTime: stamp }]));
  }
  for (const stamp of ["2026-09-13T00:00:00", "2026-11-01T01:30:00", "2024-02-29T12:00:00"]) {
    assert.equal(parseMeasurements([{ ...row, LastUpdatedDateAndTime: stamp }])[0]?.sourceMeasuredAtRaw, stamp);
  }
});

test("captures metadata and original payload on successful fetch", async () => {
  const result = await fetchCrwc({ fetchImpl: mock(Response.json([row], { headers: { "cache-control": "no-cache" } })) });
  assert.equal(result.measurements.length, 1);
  assert.deepEqual(result.rawPayload, [row]);
  assert.equal(result.responseMetadata.cacheControl, "no-cache");
  assert.equal(result.sourceTimezone, 'America/Chicago');
  assert.equal(result.timePolicy, 'assumed-america-chicago-v1');
  assert.match(result.fetchedAt, /Z$/);
});

test("fails on HTTP errors, HTML, invalid JSON and network errors without retries", async () => {
  await assert.rejects(fetchCrwc({ fetchImpl: mock(new Response("", { status: 503 })) }), /HTTP 503/);
  await assert.rejects(fetchCrwc({ fetchImpl: mock(new Response("<html>")) }), /content type/);
  await assert.rejects(fetchCrwc({ fetchImpl: mock(new Response("bad", { headers: { "content-type": "application/json" } })) }));
  let calls = 0;
  const failing = (async () => { calls++; throw new Error("network down"); }) as typeof fetch;
  await assert.rejects(fetchCrwc({ fetchImpl: failing }), /network down/);
  assert.equal(calls, 1);
});

test("passes a bounded abort signal and validates timeout configuration", async () => {
  let signal: AbortSignal | null | undefined;
  const fetchImpl = (async (_url, init) => { signal = init?.signal; return Response.json([row]); }) as typeof fetch;
  await fetchCrwc({ fetchImpl, timeoutMs: 100 });
  assert.ok(signal instanceof AbortSignal);
  for (const timeoutMs of [0, -1, NaN, 1.5]) await assert.rejects(fetchCrwc({ timeoutMs }), /positive integer/);
});
