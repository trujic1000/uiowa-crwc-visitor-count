import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmaps } from '../src/heatmap.ts';
import type { HistoryRow } from '../src/dashboard.ts';
const row = (raw: string, count: number, extra: Partial<HistoryRow> = {}): HistoryRow => ({location_id:883, location_name:'Weights', visitor_count:count, is_closed:0, source_measured_at_raw:raw, fetched_at:raw + 'Z', measured_at:null, ...extra});
test('fitness heatmaps weight distinct Chicago days equally and exclude unusable readings', () => {
  const rows = [row('2026-09-14T10:00:00',0), row('2026-09-14T10:10:00',10), row('2026-09-14T10:20:00',20), row('2026-09-21T10:00:00',90), row('2026-09-21T10:00:00',90), row('2026-09-21T10:30:00',999,{is_closed:1}), row('2026-09-21T10:40:00',999,{location_id:887}), row('2026-08-10T10:00:00',999), row('bad',999), row('2026-10-05T10:00:00',999)];
  // Retrieval must occur after the assumed local measurement instant.
  for (const r of rows) if (r.source_measured_at_raw !== 'bad') r.fetched_at = r.source_measured_at_raw.slice(0,10) + 'T20:00:00Z';
  const floors = buildHeatmaps(rows,'2026-09-28T00:00:00Z');
  const cell = floors[0]!.cells.find(c => c.day === 'Mon' && c.hour === 10)!;
  assert.equal(cell.count,50); assert.equal(cell.days,2); assert.equal(cell.readings,4);
  assert.equal(floors.length,3); assert.equal(floors[0]!.cells.length,168);
  assert.equal(floors[1]!.cells.every(c => c.count === null),true);
});
test('heatmaps preserve measured zero and use Chicago weekday/hour at UTC date boundaries', () => {
  const floors = buildHeatmaps([row('2026-09-20T23:15:00',0,{measured_at:'2026-09-21T04:15:00Z'})], '2026-09-22T00:00:00Z');
  const cell = floors[0]!.cells.find(c => c.day === 'Sun' && c.hour === 23)!;
  assert.equal(cell.count,0); assert.equal(cell.days,1);
});
