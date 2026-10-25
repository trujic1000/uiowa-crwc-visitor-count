import { fetchCrwc } from "./connect2.ts";

try {
  const timeoutMs = process.env.CRWC_TIMEOUT_MS === undefined ? 15_000 : Number(process.env.CRWC_TIMEOUT_MS);
  const result = await fetchCrwc({ timeoutMs });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.stderr.write(`CRWC fetch failed: ${message}\n`);
  process.exitCode = 1;
}
