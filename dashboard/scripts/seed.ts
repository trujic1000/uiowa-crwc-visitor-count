import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Local-only importer. A production snapshot is never committed or served as a static asset.
const root = fileURLToPath(new URL('../../', import.meta.url));
const dashboard = resolve(root, 'dashboard');
const snapshot = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(root, 'work/readiness/d1-snapshot.json');
const data = JSON.parse(await readFile(snapshot, 'utf8'));
const measurements = data[0].results as Record<string, unknown>[];
const fetches = data[1].results as Record<string, unknown>[];
const schema = await readFile(resolve(root, 'migrations/0001_initial_schema.sql'), 'utf8');
const quote = (v: unknown) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`;
const insert = (table: string, columns: string[], row: Record<string, unknown>) =>
  `INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES (${columns.map(c => quote(row[c])).join(',')});`;
const columns = ['id','facility_id','facility_name','location_id','location_name','visitor_count','is_closed','source_measured_at_raw','measured_at','fetched_at'];
const lines = [schema.replaceAll('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ').replaceAll('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS '),
  ...measurements.map(r => insert('occupancy_measurements',columns,r)),
  ...fetches.map(r => insert('collector_fetches', ['id','fetched_at','status','duration_ms','measurements_inserted','conflicting_measurements','error_message','raw_response'], {...r,duration_ms:0}))];
await mkdir(resolve(root,'work/dashboard'),{recursive:true});
const sql = resolve(root,'work/dashboard/seed.sql');
await writeFile(sql,lines.join('\n'));
const result = spawnSync(process.execPath, [resolve(dashboard,'node_modules/wrangler/bin/wrangler.js'), 'd1','execute','DB','--local','--config',resolve(dashboard,'wrangler.jsonc'),'--file',sql], {
  cwd: dashboard, encoding:'utf8', maxBuffer: 16 * 1024 * 1024, env:{...process.env, WRANGLER_LOG_PATH:'/tmp/crwc-dashboard-wrangler.log'},
});
if(result.status !== 0) { console.error(result.stderr || result.stdout || result.error); process.exit(result.status ?? 1); }
console.log(`Imported ${measurements.length} readings and ${fetches.length} attempts into dashboard LOCAL D1. Collector data is untouched.`);
