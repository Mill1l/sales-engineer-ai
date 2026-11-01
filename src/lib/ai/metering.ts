import type { AiProvider } from "./provider";
import { validatedUsage } from "./usage";

export type CallMetrics = {
  id: string; startedAt: string; provider: AiProvider["name"]; model: string; task: "parse" | "email";
  latencyMs: number; error: string | null; usage: ReturnType<typeof validatedUsage>;
  estimatedCostUSD: number | null; costBasis: "mock_no_provider_call" | "peak_uncached_estimate" | "unknown";
  pricingAsOf: string | null; persisted?: boolean;
};
// Official USD peak rates as of 2026-10-31; conservatively count all input as cache MISS.
// https://api-docs.deepseek.com/quick_start/pricing/ — estimates, not billing or a spending cap.
const peakRates: Record<string, { input: number; output: number }> = {
  "deepseek-flash": { input: 0.3, output: 1.2 }, "deepseek-v4-pro": { input: 1.32, output: 3.96 },
};
export function callMetrics(input: Omit<CallMetrics, "usage" | "estimatedCostUSD" | "costBasis" | "pricingAsOf"> & { usage: unknown }): CallMetrics {
  const usage = validatedUsage(input.usage);
  const rates = input.provider === "deepseek" ? peakRates[input.model] : undefined;
  const mock = input.provider === "mock";
  const estimate = !mock && usage && rates ? (usage.inputTokens * rates.input + usage.outputTokens * rates.output) / 1_000_000 : null;
  return { ...input, usage, estimatedCostUSD: mock ? 0 : estimate, costBasis: mock ? "mock_no_provider_call" : estimate === null ? "unknown" : "peak_uncached_estimate", pricingAsOf: rates ? "2026-10-31" : null };
}
