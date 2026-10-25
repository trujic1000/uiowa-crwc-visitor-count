import type { D1Database, ExportedHandler } from "@cloudflare/workers-types";
import { collect } from "./collector.ts";

interface Env { DB: D1Database; CRWC_TIMEOUT_MS: string; }

export default {
  async scheduled(controller, env) {
    console.log(JSON.stringify({
      event: "collection_started",
      cron: controller.cron,
      scheduledAt: new Date(controller.scheduledTime).toISOString(),
      startedAt: new Date().toISOString(),
    }));
    await collect(env.DB, { timeoutMs: Number(env.CRWC_TIMEOUT_MS) });
  },
} satisfies ExportedHandler<Env>;
