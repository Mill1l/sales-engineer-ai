import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const sdk = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn(), responses: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: sdk.create } }; responses = { parse: sdk.responses }; constructor(options: unknown) { sdk.options(options); } } }));
import { createDeepSeekProvider } from "../src/lib/ai/deepseek-provider";
import { inquiryDemos } from "../src/lib/ai/demos";
import { generateEmail, parseInquiry } from "../src/lib/ai/service";
import { blankExtractedValues, inputFromExtraction, validateExtraction, type Extraction, type ExtractedValues } from "../src/lib/ai/contracts";
import data from "../src/data/products.json";
import suite from "./fixtures/phase-4b-evaluation.json";
import { catalogSchema } from "../src/lib/catalog-schema";
import { requirementsSchema } from "../src/lib/selection/requirements";
import { selectProducts } from "../src/lib/selection/engine";
import { callMetrics } from "../src/lib/ai/metering";
import { handleAiRequest, serverConfig } from "../src/lib/ai/server";
import { GET } from "../src/app/api/parse/route";
import type { CallLimiter } from "../src/lib/ai/limits";

const products = catalogSchema.parse(data).products;
const chile = inquiryDemos[0];
const provider = () => createDeepSeekProvider({ apiKey: "TEST_ONLY_FAKE_CREDENTIAL", model: "deepseek-flash", timeoutMs: 15000, parseMaxTokens: 4500, emailMaxTokens: 1200 });
const response = (data: unknown, overrides: object = {}) => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(data) } }], usage: { prompt_tokens: 1000, completion_tokens: 200, prompt_cache_hit_tokens: 100 }, ...overrides });
const request = (body: unknown) => new Request("http://localhost:3000/api/parse", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body) });
beforeEach(() => {
  sdk.create.mockReset(); sdk.options.mockReset(); sdk.responses.mockReset();
  vi.stubEnv("AI_PROVIDER", "mock"); vi.stubEnv("AI_ALLOW_PAID_CALLS", "no"); vi.stubEnv("DEEPSEEK_API_KEY", ""); vi.stubEnv("DEEPSEEK_MODEL", "deepseek-flash");
  vi.stubEnv("AI_CALLS_PER_MINUTE", "20"); vi.stubEnv("AI_CALLS_PER_DAY", "100");
  (globalThis as typeof globalThis & { salesEngineerAiLimiter?: CallLimiter }).salesEngineerAiLimiter = undefined;
});
afterEach(() => vi.unstubAllEnvs());

describe("DeepSeek compatibility — SDK replaced; NO network", () => {
  it("uses official base URL, JSON Output, JSON example/schema, no thinking/retry/Responses call", async () => {
    sdk.create.mockResolvedValue(response(chile.extraction));
    const out = await provider().extract(chile.inquiry, new AbortController().signal);
    expect(sdk.options).toHaveBeenCalledWith({ apiKey: "TEST_ONLY_FAKE_CREDENTIAL", baseURL: "https://api.deepseek.com", maxRetries: 0, timeout: 15000 });
    const args = sdk.create.mock.calls[0][0];
    expect(args).toMatchObject({ model: "deepseek-flash", response_format: { type: "json_object" }, reasoning_effort: "none", max_tokens: 4500, stream: false });
    expect(args.messages[0].content).toContain('JSON format example');
    expect(args.messages[0].content).toContain('additionalProperties');
    expect(args.messages[1].content).toBe(chile.inquiry);
    expect(out.usage).toEqual({ inputTokens: 1000, outputTokens: 200, cachedInputTokens: 100 });
    expect(sdk.responses).not.toHaveBeenCalled();
  });
  it("supports Pro through validated model config", async () => {
    vi.stubEnv("AI_PROVIDER", "deepseek"); vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    expect(serverConfig().model).toBe("deepseek-v4-pro");
    sdk.create.mockResolvedValue(response(chile.extraction));
    await createDeepSeekProvider({ apiKey: "TEST", model: "deepseek-v4-pro", timeoutMs: 15000, parseMaxTokens: 4500, emailMaxTokens: 1200 }).extract(chile.inquiry, new AbortController().signal);
    expect(sdk.create.mock.calls[0][0].model).toBe("deepseek-v4-pro");
    vi.stubEnv("DEEPSEEK_MODEL", "invented-model"); expect(() => serverConfig()).toThrow();
  });
  it.each([
    ["empty_output", ""], ["empty_output", "    "], ["invalid_json", "{truncated"], ["invalid_json", '```json\n{}\n```'],
    ["schema_mismatch", "{}"], ["schema_mismatch", "null"], ["schema_mismatch", JSON.stringify({ ...chile.extraction, matched: true })],
  ])("rejects %s before applying any data", async (code, content) => {
    sdk.create.mockResolvedValue(response(null, { choices: [{ finish_reason: "stop", message: { content } }] }));
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toMatchObject({ code, usage: { inputTokens: 1000, outputTokens: 200 } });
  });
  it.each(["length", "content_filter", "tool_calls"])("rejects incomplete/refused finish=%s", async (finish_reason) => {
    sdk.create.mockResolvedValue(response(chile.extraction, { choices: [{ finish_reason, message: { content: JSON.stringify(chile.extraction) } }] }));
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow("invalid_output");
  });
  it("handles null content and missing choices safely", async () => {
    sdk.create.mockResolvedValue(response(null, { choices: [{ finish_reason: "stop", message: { content: null } }] }));
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow("empty_output");
    sdk.create.mockResolvedValue(response(null, { choices: [] }));
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow("invalid_output");
  });
  it("does not return or log sensitive SDK error details; distinguishes timeout", async () => {
    const log = vi.spyOn(console, "error");
    sdk.create.mockRejectedValue(new Error("PRIVATE_CUSTOMER_TEXT TEST_ONLY_FAKE_CREDENTIAL"));
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow(/^provider_unavailable$/);
    const timeout = new Error("private payload"); timeout.name = "APIConnectionTimeoutError"; sdk.create.mockRejectedValue(timeout);
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow(/^timeout$/);
    expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it("bounded timeout aborts a stalled DeepSeek call without retry", async () => {
    sdk.create.mockImplementation((_body, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
    await expect(parseInquiry({ inquiry: chile.inquiry, mode: "live" }, provider(), 5)).rejects.toThrow("timeout");
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it.each(["en", "es"] as const)("keeps %s replies fact-locked and uses the email token cap", async (language) => {
    sdk.create.mockImplementation(async (args) => {
      const { facts } = JSON.parse(args.messages[1].content);
      return response({ opening: "thank_you", closing: "confirm_details", factIds: facts.map((f: { id: string }) => f.id) });
    });
    const requirements = requirementsSchema.parse(inputFromExtraction(validateExtraction(chile.inquiry, chile.extraction).requirements));
    const mail = await generateEmail({ requirements, confirmed: true, language, mode: "live" }, products, provider());
    expect(sdk.create.mock.calls[0][0].max_tokens).toBe(1200);
    expect(mail.selection.results.every((r) => r.status !== "confirmed_match")).toBe(true);
    for (const f of mail.facts) expect(mail.body).toContain(f.text);
  });
  it("rejects hallucinated email IDs or arbitrary technical prose", async () => {
    sdk.create.mockResolvedValue(response({ opening: "thank_you", closing: "confirm_details", factIds: ["stock_5_units"] }));
    const requirements = requirementsSchema.parse(inputFromExtraction(validateExtraction(chile.inquiry, chile.extraction).requirements));
    await expect(generateEmail({ requirements, confirmed: true, language: "es", mode: "live" }, products, provider())).rejects.toThrow("invalid_output");
  });
});

describe("DeepSeek routing, dry-run, privacy and safe metering", () => {
  const enable = () => { vi.stubEnv("AI_PROVIDER", "deepseek"); vi.stubEnv("AI_ALLOW_PAID_CALLS", "yes"); vi.stubEnv("DEEPSEEK_API_KEY", "TEST_ONLY_FAKE_CREDENTIAL"); };
  it("default remains Mock; a key alone does not enable paid requests", async () => {
    vi.stubEnv("AI_PROVIDER", "deepseek"); vi.stubEnv("DEEPSEEK_API_KEY", "TEST_ONLY_FAKE_CREDENTIAL");
    expect((await GET()).status).toBe(200);
    expect(await (await GET()).json()).toMatchObject({ liveAvailable: false, defaultMode: "mock", model: "deepseek-flash" });
    expect((await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live" }), "parse")).status).toBe(503);
    expect(sdk.create).not.toHaveBeenCalled();
  });
  it("rejects live data without anonymization attestation before calling SDK", async () => {
    enable();
    const out = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live" }), "parse");
    expect(out.status).toBe(400); expect((await out.json()).error).toBe("data_policy_required"); expect(sdk.create).not.toHaveBeenCalled();
  });
  it.each(["contact person@example.test", "credential sk-TESTONLYFAKE1234567890", "phone +56 9 1234 5678"])("blocks obvious sensitive content: %s", async (extra) => {
    enable();
    const out = await handleAiRequest(request({ inquiry: `${chile.inquiry} ${extra}`, mode: "live", dataPolicy: "synthetic_or_anonymized" }), "parse");
    expect(out.status).toBe(400); expect(sdk.create).not.toHaveBeenCalled();
  });
  it("records a sanitized success, model, latency, usage and conservative USD estimate", async () => {
    enable(); sdk.create.mockResolvedValue(response(chile.extraction));
    const out = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live", dataPolicy: "synthetic_or_anonymized" }), "parse");
    const value = await out.json(); expect(out.status).toBe(200);
    expect(value.telemetry).toMatchObject({ provider: "deepseek", model: "deepseek-flash", task: "parse", error: null, costBasis: "peak_uncached_estimate", persisted: true });
    expect(value.telemetry.latencyMs).toBeGreaterThanOrEqual(0);
    expect(value.telemetry.estimatedCostUSD).toBeCloseTo(0.00054);
    expect(JSON.stringify(value.telemetry)).not.toMatch(/PRIVATE|TEST_ONLY|1800 W|inquiry|apiKey/);
  });
  it("preserves usage on blank paid outputs and logs error without any payload", async () => {
    enable(); sdk.create.mockResolvedValue(response(null, { choices: [{ finish_reason: "stop", message: { content: " " } }] }));
    const out = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live", dataPolicy: "synthetic_or_anonymized" }), "parse");
    const value = await out.json(); expect(out.status).toBe(502);
    expect(value.telemetry).toMatchObject({ error: "empty_output", usage: { inputTokens: 1000, outputTokens: 200 }, persisted: true });
    expect(value.telemetry.estimatedCostUSD).toBeGreaterThan(0);
  });
  it("records source-validation failures after provider JSON schema success", async () => {
    enable(); const forged = structuredClone(chile.extraction); forged.requirements.otherConstraints.push("UNSUPPORTED");
    sdk.create.mockResolvedValue(response(forged));
    const out = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live", dataPolicy: "synthetic_or_anonymized" }), "parse");
    expect(out.status).toBe(502); expect((await out.json()).telemetry.error).toBe("invalid_output");
  });
  it("records provider errors with unknown token/cost, not a false zero charge", async () => {
    enable(); sdk.create.mockRejectedValue(new Error("PRIVATE_DETAILS"));
    const out = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live", dataPolicy: "synthetic_or_anonymized" }), "parse");
    const value = await out.json(); expect(out.status).toBe(503);
    expect(value.telemetry).toMatchObject({ error: "provider_unavailable", usage: null, estimatedCostUSD: null });
    expect(JSON.stringify(value)).not.toContain("PRIVATE_DETAILS");
  });
  it("Mock works when configured DeepSeek is unavailable and produces no paid SDK calls", async () => {
    enable(); sdk.create.mockRejectedValue(new Error("offline"));
    const out = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "mock" }), "parse");
    expect((await out.json()).telemetry.estimatedCostUSD).toBe(0); expect(sdk.create).not.toHaveBeenCalled();
  });
  it("keeps safe metadata on disk, never source text or keys", () => {
    const lines = readFileSync("work/test-ai-call-metrics.jsonl", "utf8");
    expect(lines).not.toMatch(/TEST_ONLY_FAKE_CREDENTIAL|PRIVATE_CUSTOMER_TEXT|La carga estimada/);
    expect(JSON.parse(lines.trim().split("\n").at(-1)!)).toHaveProperty("latencyMs");
  });
  it("never modifies the real product catalog", () => {
    expect(createHash("sha256").update(readFileSync("src/data/products.json")).digest("hex")).toBe("9caa2e21b8b0988ac1d52a35b472797d092d77ad0f4c9a0c760b2e5979a82baf");
  });
  it("keeps unknown-model and missing-usage estimates unknown; Mock is explicitly zero", () => {
    const input = { id: "test", startedAt: "2026-10-31", provider: "deepseek" as const, model: "unknown", task: "parse" as const, latencyMs: 10, error: null, usage: { inputTokens: 10, outputTokens: 10 } };
    expect(callMetrics(input).estimatedCostUSD).toBeNull();
    expect(callMetrics({ ...input, model: "deepseek-flash", usage: null }).estimatedCostUSD).toBeNull();
    expect(callMetrics({ ...input, provider: "mock" }).estimatedCostUSD).toBe(0);
  });
});

describe("15-case Phase 4B evaluation readiness — simulated responses, NOT Live quality scores", () => {
  it("fixes 15 cases and preserves all original six inquiries exactly", () => {
    expect(suite.cases).toHaveLength(15);
    for (const demo of inquiryDemos) expect(suite.cases.find((c) => c.id === demo.id)?.inquiry).toBe(demo.inquiry);
  });
  it.each(suite.cases)("checks $id through DeepSeek JSON → review boundary → rules → locked reply", async (item) => {
    const entry = item as typeof item & { demoId?: string; seeds?: { field: keyof ExtractedValues; value: unknown; quote: string }[] };
    let oracle: Extraction;
    if (entry.demoId) oracle = inquiryDemos.find((d) => d.id === entry.demoId)!.extraction;
    else {
      const requirements = blankExtractedValues();
      for (const seed of entry.seeds ?? []) (requirements as Record<string, unknown>)[seed.field] = seed.value;
      oracle = { language: entry.language as Extraction["language"], requirements, evidence: (entry.seeds ?? []).map((s) => ({ field: s.field, quote: s.quote, certainty: "known" })) };
    }
    sdk.create.mockResolvedValueOnce(response(oracle));
    const parsed = await parseInquiry({ inquiry: entry.inquiry, mode: "live" }, provider());
    expect(parsed.provider).toBe("deepseek"); expect(parsed.extraction.language).toBe(entry.language);
    expect(parsed.extraction.requirements).toEqual(oracle.requirements);
    expect(parsed.extraction.validForSelection).toBe(entry.selectable);
    const selection = selectProducts(products, inputFromExtraction(parsed.extraction.requirements));
    if (!entry.selectable) { expect(selection.ok).toBe(false); return; }
    if (!selection.ok) throw new Error("Invalid evaluation fixture");
    expect(selection.results.every((r) => r.status !== "confirmed_match")).toBe(true);
    // Explicit test-only stand-in for human approval; the paid smoke script never confirms for a person.
    sdk.create.mockImplementationOnce(async (args) => { const { facts } = JSON.parse(args.messages[1].content); return response({ opening: "thank_you", closing: "confirm_details", factIds: facts.map((f: { id: string }) => f.id) }); });
    const language = entry.language === "es" ? "es" : "en";
    const output = await generateEmail({ requirements: requirementsSchema.parse(inputFromExtraction(parsed.extraction.requirements)), confirmed: true, language, mode: "live" }, products, provider());
    for (const fact of output.facts) expect(output.body).toContain(fact.text);
    expect(output.facts.find((f) => f.id === "commercial_caveat")).toBeDefined();
  });
});
