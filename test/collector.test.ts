import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { collect } from "../src/collector.ts";

const row = { FacilityId: 178, FacilityName: "CRWC", LocationId: 883, LocationName: "Weights",
  LastCount: 18, LastUpdatedDateAndTime: "2026-09-12T12:43:50.763", IsClosed: false };
const fixture = (rows: unknown): typeof fetch => (async () => Response.json(rows)) as typeof fetch;

test("collector persists, deduplicates, records conflicts/errors and rolls back failed batches in local D1", async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "collector-test", modules: true, script: "export default {fetch(){return new Response('test')}}",
    compatibilityDate: "2026-09-12", d1Databases: ["DB"] }] }));
  try {
    const db = await mf.getD1Database("DB") as unknown as D1Database;
    const sql = await readFile(new URL("../migrations/0001_initial_schema.sql", import.meta.url), "utf8");
    const statements = sql.replace(/--[^\n]*/g, "").split(";").map(s => s.trim()).filter(Boolean);
    await db.batch(statements.map(s => db.prepare(s)));
    const run = (rows: unknown) => collect(db, { fetchImpl: fixture(rows) });
    await run([row]);
    assert.equal((await db.prepare("SELECT measured_at FROM occupancy_measurements").first())?.measured_at, "2026-09-12T17:43:50.763Z");
    await run([row]);
    let logs = (await db.prepare("SELECT * FROM collector_fetches ORDER BY id").all()).results;
    assert.deepEqual(logs.map(l => l.measurements_inserted), [1, 0]);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM occupancy_measurements").first())?.n, 1);
    await run([{ ...row, LastCount: 22, IsClosed: true }]);
    const conflict = await db.prepare("SELECT * FROM collector_fetches ORDER BY id DESC LIMIT 1").first();
    assert.equal(conflict?.conflicting_measurements, 1);
    assert.match(String(conflict?.raw_response), /22/);
    assert.equal((await db.prepare("SELECT visitor_count FROM occupancy_measurements").first())?.visitor_count, 18);
    await run([{ ...row, LastUpdatedDateAndTime: "2026-09-12T13:43:50.763" }]);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM occupancy_measurements").first())?.n, 2);
    await assert.rejects(run([{ ...row, LastCount: null }]));
    let failure = await db.prepare("SELECT * FROM collector_fetches ORDER BY id DESC LIMIT 1").first();
    assert.equal(failure?.status, "error");
    assert.equal(failure?.http_status, 200);
    assert.match(String(failure?.raw_response), /null/);
    await assert.rejects(collect(db, { fetchImpl: (async () => new Response("unavailable", { status: 503 })) as typeof fetch }));
    failure = await db.prepare("SELECT * FROM collector_fetches ORDER BY id DESC LIMIT 1").first();
    assert.equal(failure?.http_status, 503);
    assert.equal(failure?.raw_response, "unavailable");
    await assert.rejects(collect(db, { fetchImpl: (async (_url, init) => {
      await new Promise((_resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("test abort signal did not fire")), 1000);
        init?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(init.signal?.reason); }, { once: true });
      });
      return Response.json([]);
    }) as typeof fetch, timeoutMs: 20 }));
    failure = await db.prepare("SELECT * FROM collector_fetches ORDER BY id DESC LIMIT 1").first();
    assert.equal(failure?.status, "error");
    assert.equal(failure?.http_status, null);
    await db.prepare("CREATE TRIGGER fail_test BEFORE INSERT ON occupancy_measurements WHEN NEW.location_id = 999 BEGIN SELECT RAISE(ABORT, 'test failure'); END").run();
    await assert.rejects(run([{ ...row, LocationId: 998 }, { ...row, LocationId: 999 }]));
    assert.equal((await db.prepare("SELECT count(*) AS n FROM occupancy_measurements WHERE location_id = 998").first())?.n, 0);
    failure = await db.prepare("SELECT * FROM collector_fetches ORDER BY id DESC LIMIT 1").first();
    assert.equal(failure?.status, "error");
    assert.equal(failure?.measurements_inserted, 0);
    await db.prepare("DROP TRIGGER fail_test").run();
    // A later run succeeds after failures. Concurrent repeated observations stay idempotent.
    await Promise.all([run([{ ...row, LocationId: 998 }]), run([{ ...row, LocationId: 998 }])]);
    logs = (await db.prepare("SELECT * FROM collector_fetches ORDER BY id DESC LIMIT 2").all()).results;
    assert.equal(logs.reduce((sum, l) => sum + Number(l.measurements_inserted), 0), 1);
    assert.ok(logs.every(l => l.status === "success"));
  } finally { await mf.dispose(); }
});
