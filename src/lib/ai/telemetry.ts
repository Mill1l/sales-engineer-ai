import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CallMetrics } from "./metering";
/** Only allowlisted aggregate metadata reaches disk; never input, output, reasoning or key. */
export async function recordCall(metrics: CallMetrics): Promise<CallMetrics> {
  const safe: CallMetrics = { id: metrics.id, startedAt: metrics.startedAt, provider: metrics.provider, model: metrics.model, task: metrics.task, latencyMs: metrics.latencyMs, error: metrics.error, usage: metrics.usage, estimatedCostUSD: metrics.estimatedCostUSD, costBasis: metrics.costBasis, pricingAsOf: metrics.pricingAsOf };
  try {
    const dir = join(process.cwd(), "work");
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, process.env.NODE_ENV === "test" ? "test-ai-call-metrics.jsonl" : "ai-call-metrics.jsonl"), JSON.stringify({ ...safe, testOnly: process.env.NODE_ENV === "test", persisted: true }) + "\n", { mode: 0o600 });
    return { ...safe, persisted: true };
  } catch { return { ...safe, persisted: false }; } // A write failure must not trigger another paid call.
}
