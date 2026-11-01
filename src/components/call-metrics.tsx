import type { CallMetrics } from "@/lib/ai/metering";
export function CallMetricsNote({ metrics }: { metrics?: CallMetrics }) {
  if (!metrics) return null;
  const basis = metrics.costBasis === "mock_no_provider_call" ? "模拟模式，未调用服务商" : metrics.costBasis === "peak_uncached_estimate" ? "按峰时未缓存费率估算，非实际账单" : "费用依据未知";
  return <p className="ai-privacy">{metrics.provider === "mock" ? "模拟演示" : metrics.provider} · {metrics.model} · 耗时 {metrics.latencyMs} 毫秒 · {metrics.usage ? `输入 ${metrics.usage.inputTokens}／输出 ${metrics.usage.outputTokens} Token` : metrics.provider === "mock" ? "未使用服务商 Token" : "用量未知"} · {metrics.estimatedCostUSD === null ? "费用未知" : `估算费用 ${metrics.estimatedCostUSD.toFixed(6)} 美元`}（{basis}）{metrics.persisted === false ? " · 统计未能保存，请勿仅为补日志再次付费调用。" : " · 已在本地保存匿名用量统计"}</p>;
}
