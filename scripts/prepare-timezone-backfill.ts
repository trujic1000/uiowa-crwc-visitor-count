import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeSourceTime, TIME_POLICY } from '../src/source-time.ts';

// Read a Wrangler JSON export; only produce guarded SQL. This script never writes to D1.
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/prepare-timezone-backfill.ts snapshot.json [output-directory]');
const data = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(data) || data.length !== 1 || data[0]?.success !== true || !Array.isArray(data[0]?.results)) {
  throw new Error('Expected one successful Wrangler result set. Export failed or had the wrong format; no SQL generated.');
}
const output = resolve(process.argv[3] ?? 'work/timezone');
const updates: string[] = [], rollback: string[] = [];
const unresolved: unknown[] = [];
const quote = (s:string) => `'${s.replaceAll("'", "''")}'`;
let existing = 0;
for (const r of data[0].results) {
  if (!Number.isSafeInteger(r.id) || typeof r.source_measured_at_raw !== 'string' || typeof r.fetched_at !== 'string') throw new Error('Invalid exported row');
  const normalized = normalizeSourceTime(r.source_measured_at_raw,r.fetched_at);
  if (r.measured_at != null) {
    if (r.measured_at !== normalized.measuredAt) throw new Error(`Existing normalization differs for row ${r.id}; review before changing anything`);
    existing++; continue;
  }
  if (!normalized.measuredAt) { unresolved.push({id:r.id,raw:r.source_measured_at_raw,issue:normalized.issue}); continue; }
  const guard = `id = ${r.id} AND source_measured_at_raw = ${quote(r.source_measured_at_raw)} AND fetched_at = ${quote(r.fetched_at)}`;
  updates.push(`UPDATE occupancy_measurements SET measured_at = ${quote(normalized.measuredAt)} WHERE ${guard} AND measured_at IS NULL;`);
  rollback.push(`UPDATE occupancy_measurements SET measured_at = NULL WHERE ${guard} AND measured_at = ${quote(normalized.measuredAt)};`);
}
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'backfill.sql'),`-- ${TIME_POLICY}; raw values unchanged. Idempotent.\n${updates.join('\n')}\nSELECT COUNT(*) AS normalized FROM occupancy_measurements WHERE measured_at IS NOT NULL;\n`);
await writeFile(resolve(output,'rollback.sql'),`-- Restore only the rows changed by this snapshot's backfill.\n${rollback.join('\n')}\n`);
const report = {policy:TIME_POLICY, exported:data[0].results.length, updates:updates.length, alreadyNormalized:existing, unresolved};
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
