import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { readDashboard } from '../src/dashboard.ts';
import { collectionStatus } from '../src/dashboard-status.ts';
import { chicagoDay, sourceTime } from '../dashboard/src/lib/format.ts';

const now = '2026-09-18T15:00:00.000Z';
const row = { FacilityId:178, FacilityName:'CRWC', LocationId:883, LocationName:'Weights', LastCount:0,
  LastUpdatedDateAndTime:'2026-09-18T06:00:00', IsClosed:false };

test('collector health ages independently from measurement age, with explicit boundaries', () => {
  assert.equal(collectionStatus(null,now),'No successful collection');
  assert.equal(collectionStatus('2026-09-18T14:45:00.000Z',now),'Up to date');
  assert.equal(collectionStatus('2026-09-18T14:44:59.000Z',now),'Delayed');
  assert.equal(collectionStatus('2026-09-18T14:30:00.000Z',now),'Delayed');
  assert.equal(collectionStatus('2026-09-18T14:29:59.000Z',now),'Collection overdue');
});

test('Chicago observation dates respect midnight and DST without parsing source wall times', () => {
  assert.equal(chicagoDay('2026-09-18T04:59:00Z'),'2026-09-17');
  assert.equal(chicagoDay('2026-09-18T05:00:00Z'),'2026-09-18');
  assert.equal(chicagoDay('2026-01-18T05:59:00Z'),'2026-01-17');
  assert.equal(chicagoDay('2026-01-18T06:00:00Z'),'2026-01-18');
  assert.equal(sourceTime('2026-03-08T02:30:00'),'2026-03-08 · 02:30:00');
});

test('D1 read model preserves zero, missing, closure corrections and conservative unchanged runs', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({workers:[{name:'dashboard-test',modules:true,script:"export default {fetch(){return new Response('test')}}",compatibilityDate:'2026-09-12',d1Databases:['DB']}]}));
  try {
    const db = await mf.getD1Database('DB') as unknown as D1Database;
    const schema = await readFile(new URL('../migrations/0001_initial_schema.sql',import.meta.url),'utf8');
    await db.batch(schema.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
    let result = await readDashboard(db,now);
    assert.equal(result.status,'No successful collection'); assert.deepEqual(result.areas,[]); assert.deepEqual(result.history,[]);
    const measurement = (id:number,count:number,at:string) => db.prepare(`INSERT INTO occupancy_measurements (facility_id,facility_name,location_id,location_name,visitor_count,is_closed,source_measured_at_raw,fetched_at) VALUES (178,'CRWC',?,'Weights',?,0,?,?)`).bind(id,count,row.LastUpdatedDateAndTime,at).run();
    const log = (at:string,rows:unknown[]) => db.prepare(`INSERT INTO collector_fetches (fetched_at,status,duration_ms,raw_response) VALUES (?,'success',0,?)`).bind(at,JSON.stringify(rows)).run();
    await measurement(883,0,'2026-09-18T11:00:00.000Z');
    await measurement(884,12,'2026-09-18T11:00:00.000Z');
    await measurement(885,7,'2026-09-01T11:00:00.000Z');
    await log('2026-09-18T11:00:00.000Z',[row]);
    await log('2026-09-18T14:50:00.000Z',[row]);
    result = await readDashboard(db,now);
    assert.equal(result.areas[0]?.measuredAt,'2026-09-18T11:00:00.000Z');
    assert.equal(result.history.find(r=>r.location_id===883)?.measured_at,'2026-09-18T11:00:00.000Z');
    assert.equal(result.areas[0]?.count,0); assert.equal(result.areas[0]?.unchanged,true);
    assert.equal(result.areas[1]?.count,null); assert.equal(result.areas[1]?.closed,null);
    assert.equal(result.history.length,2); // Old observations excluded; known areas retained.
    await log('2026-09-18T14:51:00.000Z',[{...row,LastCount:9,IsClosed:true}]);
    result = await readDashboard(db,now);
    assert.equal(result.areas[0]?.count,9); assert.equal(result.areas[0]?.closed,true); assert.equal(result.areas[0]?.unchanged,false);
    assert.equal(result.history.find(r=>r.location_id===883)?.visitor_count,0); // No silent rewrite of history.
    assert.ok(!JSON.stringify(result).includes('raw_response'));
    await log('2026-09-18T14:52:00.000Z',[{...row,LocationId:884}]);
    await log('2026-09-18T14:53:00.000Z',[row]);
    await db.prepare(`INSERT INTO collector_fetches (fetched_at,status,duration_ms,error_message) VALUES (?,'error',0,'private diagnostic')`).bind('2026-09-18T14:59:00.000Z').run();
    result = await readDashboard(db,now);
    assert.equal(result.areas[0]?.unchanged,false); // Reappearance is not three hours of observed stability.
    assert.equal(result.lastAttempt?.failed,true); assert.equal(result.status,'Up to date');
    assert.ok(!JSON.stringify(result).includes('private diagnostic'));
  } finally { await mf.dispose(); }
});
