import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSourceTime } from '../src/source-time.ts';
const fetched = '2027-01-01T00:00:00.000Z';
test('assumed Chicago uses daylight time in summer and standard time in winter', () => {
  assert.equal(normalizeSourceTime('2026-09-23T13:11:44.857', fetched).measuredAt, '2026-09-23T18:11:44.857Z');
  assert.equal(normalizeSourceTime('2026-01-23T13:11:44.1234567', fetched).measuredAt, '2026-01-23T19:11:44.123Z');
  assert.equal(normalizeSourceTime('2026-09-23T23:59:59', fetched).measuredAt, '2026-09-24T04:59:59.000Z');
});
test('DST overlap and gap remain unresolved; neighboring valid times normalize', () => {
  assert.deepEqual(normalizeSourceTime('2026-11-01T01:30:00', fetched), {measuredAt:null,issue:'ambiguous'});
  assert.deepEqual(normalizeSourceTime('2026-03-08T02:30:00', fetched), {measuredAt:null,issue:'nonexistent'});
  assert.equal(normalizeSourceTime('2026-03-08T01:59:59', fetched).measuredAt, '2026-03-08T07:59:59.000Z');
  assert.equal(normalizeSourceTime('2026-03-08T03:00:00', fetched).measuredAt, '2026-03-08T08:00:00.000Z');
  assert.equal(normalizeSourceTime('2026-11-01T02:00:00', fetched).measuredAt, '2026-11-01T08:00:00.000Z');
});
test('invalid dates, offset-bearing input, and measurements after retrieval stay unresolved', () => {
  for (const raw of ['2026-02-30T12:00:00','2026-09-23T12:00:60','2026-09-23T12:00:00Z','garbage']) {
    assert.equal(normalizeSourceTime(raw,fetched).issue, 'invalid');
  }
  assert.equal(normalizeSourceTime('2026-09-23T13:00:00','2026-09-23T17:59:59Z').issue,'future');
});
