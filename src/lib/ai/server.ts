import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createDeepSeekProvider, deepSeekModelSchema } from "./deepseek-provider";
import { recordCall } from "./telemetry";
import { callMetrics, type CallMetrics } from "./metering";
import { assertDataPolicy } from "./privacy";
import type { AiProvider, ProviderResult } from "./provider";
import { createOpenAiProvider } from "./openai-provider";
import { mockProvider } from "./mock-provider";
import { AiFailure } from "./provider";
import { CallLimiter, readLimitedJson } from "./limits";
import { emailRequestSchema, parseRequestSchema } from "./contracts";
import { parseInquiry, generateEmail } from "./service";
import { getCatalog } from "../catalog";

const numericEnv = (value: string | undefined, fallback: number, min: number, max: number) => z.coerce.number().int().min(min).max(max).parse(value || fallback);
export function serverConfig(mode: "mock" | "live" = "live") {
  try {
    // Request safety limits apply to both modes. Unused provider settings do not.
    const limits = {
      perMinute: numericEnv(process.env.AI_CALLS_PER_MINUTE, 20, 1, 60),
      perDay: numericEnv(process.env.AI_CALLS_PER_DAY, 100, 1, 1000),
    };
    if (mode === "mock") return { ...limits, providerName: "mock" as const, enabled: false, apiKey: "", model: "mock-fixture", timeoutMs: 25000, parseMaxTokens: 4500, emailMaxTokens: 1200 };
    const providerName = z.enum(["mock", "openai", "deepseek"]).parse(process.env.AI_PROVIDER || "mock");
    if (providerName === "mock") return { ...limits, providerName, enabled: false, apiKey: "", model: "mock-fixture", timeoutMs: 25000, parseMaxTokens: 4500, emailMaxTokens: 1200 };
    const model = providerName === "openai" ? process.env.OPENAI_MODEL?.trim() || "gpt-6-luna" : deepSeekModelSchema.parse(process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash");
    return {
      providerName,
      enabled: process.env.AI_ALLOW_PAID_CALLS === "yes",
      apiKey: (providerName === "deepseek" ? process.env.DEEPSEEK_API_KEY ?? "" : providerName === "openai" ? process.env.OPENAI_API_KEY ?? "" : "").trim(),
      model,
      timeoutMs: numericEnv(process.env.AI_TIMEOUT_MS, 25000, 1000, 28000),
      parseMaxTokens: numericEnv(process.env.AI_PARSE_MAX_TOKENS, 4500, 500, 6000),
      emailMaxTokens: numericEnv(process.env.AI_EMAIL_MAX_TOKENS, 1200, 200, 2000),
      ...limits,
    };
  } catch { throw new AiFailure("configuration_error"); } // No environment values in errors/logs.
}
const state = globalThis as typeof globalThis & { salesEngineerAiLimiter?: CallLimiter };
const messages = {
  configuration_error: "Server AI configuration is invalid. Check provider, model, token/timeout limits and call limits, then restart. No provider request was sent. Unused Live settings do not affect Mock requests.",
  empty_output: "The provider returned blank content. Nothing was applied; retry manually or use Mock.",
  invalid_json: "The provider returned invalid JSON. Nothing was applied; continue with Mock/manual input.",
  schema_mismatch: "The provider JSON does not match the required schema. Nothing was applied.",
  data_policy_required: "Live calls accept only synthetic or manually anonymized data. Confirm the data policy and remove credentials/contact details before retrying.",
  timeout: "AI call timed out. Retry later, select a Mock demo or continue manually.",
  provider_unavailable: "AI service is unavailable. No automatic paid retry was made. Mock/manual mode remains available.",
  invalid_output: "The AI response failed schema, source-evidence or fact-consistency validation. Review manually or use a Mock demo.",
  mock_scenario_only: "Mock extraction supports the six labeled demo inquiries only. Use an exact demo, manual input, or configured Live mode.",
  live_not_configured: "Live paid calls are not explicitly enabled or the server API key is missing. No API request was sent.",
  invalid_request: "Invalid request. Check the required inputs, confirmation and input length.",
};
export async function handleAiRequest(request: Request, task: "parse" | "email") {
  const headers = { "Cache-Control": "no-store" };
  let telemetry: CallMetrics | undefined;
  try {
    const raw = await readLimitedJson(request);
    const input = task === "parse" ? parseRequestSchema.parse(raw) : emailRequestSchema.parse(raw);
    const config = serverConfig(input.mode);
    state.salesEngineerAiLimiter ??= new CallLimiter(config.perMinute, config.perDay);
    if (!state.salesEngineerAiLimiter.take()) return Response.json({ error: "rate_limited", message: "Local process call limit reached. Wait before retrying; manual selection remains available." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    if (input.mode === "live" && (!config.enabled || !config.apiKey)) throw new AiFailure("live_not_configured");
    if (input.mode === "live") assertDataPolicy(input);
    const provider = input.mode === "mock" ? mockProvider : config.providerName === "deepseek" ? createDeepSeekProvider({ ...config, model: deepSeekModelSchema.parse(config.model) }) : createOpenAiProvider(config);
    let observed: ProviderResult | undefined;
    const wrapped: AiProvider = { name: provider.name,
      extract: async (inquiry, signal) => { observed = await provider.extract(inquiry, signal); return observed; },
      compose: async (facts, language, signal) => { observed = await provider.compose(facts, language, signal); return observed; },
    };
    const start = performance.now();
    const metadata = { id: randomUUID(), startedAt: new Date().toISOString(), provider: provider.name, model: provider.name === "mock" ? "mock-fixture" : config.model, task };
    try {
      const output = task === "parse" ? await parseInquiry(input, wrapped, config.timeoutMs) : await generateEmail(input, getCatalog().products, wrapped, config.timeoutMs);
      telemetry = await recordCall(callMetrics({ ...metadata, latencyMs: Math.round(performance.now() - start), error: null, usage: observed?.usage }));
      return Response.json({ ...output, telemetry }, { headers });
    } catch (error) {
      telemetry = await recordCall(callMetrics({ ...metadata, latencyMs: Math.round(performance.now() - start), error: error instanceof AiFailure ? error.code : "invalid_request", usage: observed?.usage ?? (error instanceof AiFailure ? error.usage : undefined) }));
      throw error;
    }
  } catch (error) {
    const code = error instanceof AiFailure ? error.code : "invalid_request";
    return Response.json({ error: code, message: messages[code], ...(telemetry ? { telemetry } : {}) }, { status: code === "timeout" ? 504 : ["provider_unavailable", "live_not_configured", "configuration_error"].includes(code) ? 503 : ["invalid_output", "empty_output", "invalid_json", "schema_mismatch"].includes(code) ? 502 : 400, headers });
  }
}
