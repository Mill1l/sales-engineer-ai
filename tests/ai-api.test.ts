import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ parse: vi.fn(), options: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({ default: class { responses = { parse: sdk.parse }; constructor(options: unknown) { sdk.options(options); } } }));
import { createOpenAiProvider, EXTRACTION_INSTRUCTIONS } from "../src/lib/ai/openai-provider";
import { handleAiRequest } from "../src/lib/ai/server";
import { GET } from "../src/app/api/parse/route";
import { inquiryDemos } from "../src/lib/ai/demos";
import { inputFromExtraction, validateExtraction } from "../src/lib/ai/contracts";
import { requirementsSchema } from "../src/lib/selection/requirements";
import type { CallLimiter } from "../src/lib/ai/limits";

const chile = inquiryDemos[0];
const request = (body: unknown) => new Request("http://localhost:3000/api/parse", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body) });
beforeEach(() => {
  sdk.parse.mockReset(); sdk.options.mockReset();
  vi.stubEnv("AI_PROVIDER", "mock"); vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("AI_CALLS_PER_MINUTE", "20"); vi.stubEnv("AI_CALLS_PER_DAY", "100");
  (globalThis as typeof globalThis & { salesEngineerAiLimiter?: CallLimiter }).salesEngineerAiLimiter = undefined;
});
afterEach(() => vi.unstubAllEnvs());

describe("official SDK adapter without network calls", () => {
  const provider = () => createOpenAiProvider({ apiKey: "TEST_ONLY_NOT_A_KEY", model: "test-model", timeoutMs: 15000, parseMaxTokens: 4500, emailMaxTokens: 1200 });
  it("uses Responses strict structured output, server config, no storage and no retries", async () => {
    sdk.parse.mockResolvedValue({ status: "completed", output_parsed: chile.extraction, usage: { input_tokens: 100, output_tokens: 200 } });
    const result = await provider().extract(chile.inquiry, new AbortController().signal);
    expect(sdk.options).toHaveBeenCalledWith({ apiKey: "TEST_ONLY_NOT_A_KEY", maxRetries: 0, timeout: 15000 });
    const args = sdk.parse.mock.calls[0][0];
    expect(args).toMatchObject({ model: "test-model", max_output_tokens: 4500, store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(args.input[0].content).toBe(EXTRACTION_INSTRUCTIONS);
    expect(args.input[1].content).toBe(chile.inquiry);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 200 });
  });
  it("uses the independent email token cap and constrained mail-plan format", async () => {
    sdk.parse.mockResolvedValue({ status: "completed", output_parsed: { opening: "thank_you", closing: "confirm_details", factIds: ["test"] } });
    await provider().compose([{ id: "test", text: "Unverified stock", kind: "verification" }], "es", new AbortController().signal);
    expect(sdk.parse.mock.calls[0][0]).toMatchObject({ max_output_tokens: 1200, text: { format: { type: "json_schema", strict: true, name: "sales_reply_plan" } } });
  });
  it.each([{ status: "incomplete", output_parsed: {} }, { status: "completed", output_parsed: null }])("rejects truncated/refused outputs", async (response) => {
    sdk.parse.mockResolvedValue(response);
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow("invalid_output");
  });
  it("redacts provider errors and classifies SDK timeout", async () => {
    sdk.parse.mockRejectedValue(new Error("SECRET_KEY and PRIVATE_CUSTOMER_TEXT"));
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow(/^provider_unavailable$/);
    const timeout = new Error("sensitive provider details"); timeout.name = "APIConnectionTimeoutError";
    sdk.parse.mockRejectedValue(timeout);
    await expect(provider().extract(chile.inquiry, new AbortController().signal)).rejects.toThrow(/^timeout$/);
  });
});

describe("route boundary, privacy and default Mock behavior", () => {
  it("advertises availability without exposing the server key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "TEST_ONLY_PRIVATE_PLACEHOLDER");
    const response = await GET();
    const body = await response.text();
    expect(body).not.toContain("TEST_ONLY_PRIVATE_PLACEHOLDER");
    expect(JSON.parse(body).liveAvailable).toBe(false);
  });
  it("completes Mock parsing with no API key and no SDK request", async () => {
    const response = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "mock" }), "parse");
    expect(response.status).toBe(200);
    expect((await response.json()).extraction.requirements.quantity).toBe(5);
    expect(sdk.parse).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects Live without configuration rather than pretending to call AI", async () => {
    const response = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live" }), "parse");
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("live_not_configured");
    expect(sdk.parse).not.toHaveBeenCalled();
  });
  it("rejects oversized inquiry, missing confirmation and forged result properties", async () => {
    expect((await handleAiRequest(request({ inquiry: "x".repeat(6001), mode: "mock" }), "parse")).status).toBe(400);
    expect((await handleAiRequest(request({ confirmed: false, requirements: {}, mode: "mock", language: "es" }), "email")).status).toBe(400);
    expect((await handleAiRequest(request({ inquiry: chile.inquiry, mode: "mock", matched: true }), "parse")).status).toBe(400);
  });
  it("enforces a process-wide basic call cap before paid calls", async () => {
    vi.stubEnv("AI_CALLS_PER_MINUTE", "1");
    expect((await handleAiRequest(request({ inquiry: chile.inquiry, mode: "mock" }), "parse")).status).toBe(200);
    const second = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "mock" }), "parse");
    expect(second.status).toBe(429); expect(second.headers.get("Retry-After")).toBe("60");
  });
  it("returns sanitized Live failures and does not log private text", async () => {
    vi.stubEnv("AI_PROVIDER", "openai"); vi.stubEnv("OPENAI_API_KEY", "TEST_ONLY_PRIVATE_PLACEHOLDER");
    sdk.parse.mockRejectedValue(new Error("TEST_ONLY_PRIVATE_PLACEHOLDER PRIVATE_CUSTOMER_TEXT"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleAiRequest(request({ inquiry: chile.inquiry, mode: "live" }), "parse");
    const body = await response.text();
    expect(response.status).toBe(503); expect(body).not.toContain("PRIVATE");
    expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it("recomputes an email using only the server catalog", async () => {
    const requirements = requirementsSchema.parse({ ...inputFromExtraction(validateExtraction(chile.inquiry, chile.extraction).requirements), loadPerUnitConfirmed: true });
    const response = await handleAiRequest(request({ requirements, confirmed: true, mode: "mock", language: "es" }), "email");
    expect(response.status).toBe(200);
    const output = await response.json();
    expect(output.selection.results.some((r: { status: string }) => r.status === "confirmed_match")).toBe(false);
    expect(output.body).toContain("No hay una coincidencia completamente confirmada");
  });
});
