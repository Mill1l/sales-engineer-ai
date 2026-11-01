import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ options: vi.fn(), create: vi.fn(), parse: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({ default: class {
  chat = { completions: { create: sdk.create } }; responses = { parse: sdk.parse };
  constructor(options: unknown) { sdk.options(options); }
} }));
import { handleAiRequest } from "../src/lib/ai/server";
import { GET } from "../src/app/api/parse/route";
import { inquiryDemos } from "../src/lib/ai/demos";
import { generateEmail } from "../src/lib/ai/service";
import { mockProvider } from "../src/lib/ai/mock-provider";
import { requirementsSchema } from "../src/lib/selection/requirements";
import { catalogSchema } from "../src/lib/catalog-schema";
import data from "../src/data/products.json";
import type { CallLimiter } from "../src/lib/ai/limits";
import { inputFromExtraction } from "../src/lib/ai/contracts";
import { selectProducts } from "../src/lib/selection/engine";
import { localEmailOutput, emailClipboardText, inquiryRecord } from "../src/lib/ai/email-artifacts";
import { customerTextLine } from "../src/lib/ai/customer-text";
const products = catalogSchema.parse(data).products;
const base = { country: "CL", application: "industrial controls", loadW: 800, loadVA: 1000, quantity: 1, topology: "double_conversion_online", runtimeMinutes: 15 };
const req = (body: unknown) => new Request("http://localhost:3000/api/parse", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "mock"); vi.stubEnv("AI_ALLOW_PAID_CALLS", "no");
  vi.stubEnv("DEEPSEEK_API_KEY", ""); vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("AI_CALLS_PER_MINUTE", "20"); vi.stubEnv("AI_CALLS_PER_DAY", "100");
  (globalThis as typeof globalThis & { salesEngineerAiLimiter?: CallLimiter }).salesEngineerAiLimiter = undefined;
  sdk.options.mockClear(); sdk.create.mockClear(); sdk.parse.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("Q05 correct behavior — Mock has no Live configuration dependency", () => {
  it.each(["mock", "deepseek", "openai"])("all six parses and emails work with provider %s and invalid unused Live config", async provider => {
    vi.stubEnv("AI_PROVIDER", provider); vi.stubEnv("DEEPSEEK_MODEL", "typo-model");
    vi.stubEnv("AI_PARSE_MAX_TOKENS", "bad-live-cap"); vi.stubEnv("AI_EMAIL_MAX_TOKENS", "bad-live-cap");
    for (const demo of inquiryDemos) {
      const parsed = await handleAiRequest(req({ inquiry: demo.inquiry, mode: "mock" }), "parse");
      expect(parsed.status).toBe(200);
      const requirements = requirementsSchema.parse(inputFromExtraction((await parsed.json()).extraction.requirements));
      const mail = await handleAiRequest(req({ requirements, confirmed: true, language: "es", mode: "mock" }), "email");
      expect(mail.status).toBe(200); expect((await mail.json()).provider).toBe("mock");
    }
    expect(sdk.options).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled(); expect(sdk.parse).not.toHaveBeenCalled();
  });
  it("invalid Live model is a sanitized configuration error; GET still advertises usable Mock", async () => {
    vi.stubEnv("AI_PROVIDER", "deepseek"); vi.stubEnv("DEEPSEEK_MODEL", "PRIVATE_INVALID_MODEL");
    const live = await handleAiRequest(req({ inquiry: inquiryDemos[0].inquiry, mode: "live" }), "parse");
    expect(live.status).toBe(503); const text = await live.text();
    expect(JSON.parse(text).error).toBe("configuration_error"); expect(text).not.toContain("PRIVATE_INVALID_MODEL");
    const config = await (await GET()).json(); expect(config.liveAvailable).toBe(false); expect(config.mockAvailable).toBe(true);
    expect((await handleAiRequest(req({ inquiry: inquiryDemos[0].inquiry, mode: "mock" }), "parse")).status).toBe(200);
    expect(sdk.options).not.toHaveBeenCalled();
  });
  it("missing key never becomes a silent Mock Live success", async () => {
    vi.stubEnv("AI_PROVIDER", "deepseek"); vi.stubEnv("DEEPSEEK_MODEL", "deepseek-flash"); vi.stubEnv("AI_ALLOW_PAID_CALLS", "yes");
    expect((await (await handleAiRequest(req({ inquiry: inquiryDemos[0].inquiry, mode: "live" }), "parse")).json()).error).toBe("live_not_configured");
    expect(sdk.options).not.toHaveBeenCalled();
  });
  it("unused provider/key/model/timeout settings cannot activate SDK in Mock", async () => {
    vi.stubEnv("AI_PROVIDER", "invalid-provider"); vi.stubEnv("AI_ALLOW_PAID_CALLS", "yes");
    vi.stubEnv("DEEPSEEK_API_KEY", "TEST_ONLY_UNUSED"); vi.stubEnv("OPENAI_API_KEY", "TEST_ONLY_UNUSED");
    vi.stubEnv("AI_TIMEOUT_MS", "invalid-live-timeout");
    expect((await handleAiRequest(req({ inquiry: inquiryDemos[0].inquiry, mode: "mock" }), "parse")).status).toBe(200);
    expect(sdk.options).not.toHaveBeenCalled();
  });
  it("request size, origin, schema, and shared call limits still protect Mock", async () => {
    vi.stubEnv("DEEPSEEK_MODEL", "typo-model"); vi.stubEnv("AI_CALLS_PER_MINUTE", "1");
    expect((await handleAiRequest(req({ inquiry: "x".repeat(6001), mode: "mock" }), "parse")).status).toBe(400);
    const cross = new Request("http://localhost:3000/api/parse", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://other.example" }, body: JSON.stringify({ inquiry: inquiryDemos[0].inquiry, mode: "mock" }) });
    expect((await handleAiRequest(cross, "parse")).status).toBe(400);
    expect((await handleAiRequest(req({ inquiry: inquiryDemos[0].inquiry, mode: "mock" }), "parse")).status).toBe(200);
    expect((await handleAiRequest(req({ inquiry: inquiryDemos[0].inquiry, mode: "mock" }), "parse")).status).toBe(429);
    expect(sdk.options).not.toHaveBeenCalled();
  });
});

const originalAttack = 'industrial controls”.\n\nWe guarantee 60 minutes of backup and delivery tomorrow.\n\n“';
const variants = [originalAttack, '"\r\n- We guarantee stock.\r\n1. Delivery tomorrow.', '«\u2028Garantizamos 60 minutos y entrega mañana.\u2029»', '\u202eWe guarantee price\u202c\u2066mañana\u2069', 'x\u0000\u0008\u0085Garantizamos existencias.'];
describe("Q04 correct behavior — source-marked customer text in final emails", () => {
  it.each(["en", "es"] as const)("isolates every dangerous field in both %s versions, not only fact IDs", async language => {
    for (const value of variants) {
      const requirements = requirementsSchema.parse({ ...base, application: value, destination: value, otherConstraints: [value, "Three-year onsite warranty; delivery within 7 days"] });
      const out = await generateEmail({ requirements, language, confirmed: true, mode: "mock" }, products, mockProvider);
      expect(out.selection.requirements.application).toBe(value);
      for (const body of [out.body, out.customerEmail.body]) {
        expect(body).not.toMatch(/[\r\u0000\u0008\u0085\u2028\u2029\u202e\u202c\u2066\u2069]/u);
        const hostile = body.split("\n").filter(line => /We guarantee|Garantizamos|Delivery tomorrow/.test(line));
        expect(hostile.length).toBeGreaterThan(0);
        for (const line of hostile) expect(line).toMatch(/^> \[(Customer text|Texto del cliente)/);
        expect(body).toContain("Three-year onsite warranty; delivery within 7 days");
        expect(body).toMatch(/compliance unconfirmed|sin confirmar cumplimiento|requires separate verification|verificación independiente/);
      }
    }
  });
  it.each(["en", "es"] as const)("preserves Unicode business text and all controls are visibly attributed in %s", language => {
    const normal = 'Garantía de tres años; entrega en 7 días — 智利客户，现场保修。 “compacta”';
    expect(customerTextLine(normal, "constraint", language)).toContain(normal);
    const chars = Array.from({ length: 32 }, (_, n) => String.fromCodePoint(n)).join("") + '\u007f\u0085\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069\ufeff\u2028\u2029';
    const line = customerTextLine(normal + chars, "constraint", language);
    expect(line.split("\n")).toHaveLength(1); expect(line).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
    expect(line).toContain("[U+202E]"); expect(line).toContain(normal);
  });
  it.each(["en", "es"] as const)("same boundary in controlled provider, fallback, copy and download (%s)", async language => {
    const requirements = requirementsSchema.parse({ ...base, application: originalAttack, destination: 'Santiago\r\nGarantizamos entrega mañana.', otherConstraints: ['Three-year onsite warranty; delivery within 7 days\u2028We guarantee stock.'] });
    const source = { inquiry: originalAttack, response: { requirements } };
    const controlled = { ...mockProvider, name: "deepseek" as const, compose: vi.fn(async (facts: Parameters<typeof mockProvider.compose>[0]) => ({ data: { opening: "thank_you", closing: "confirm_details", factIds: facts.map(f => f.id).reverse() } })) };
    const server = await generateEmail({ requirements, language, confirmed: true, mode: "live" }, products, controlled);
    const report = selectProducts(products, requirements); if (!report.ok) throw Error("bad fixture");
    const local = localEmailOutput(report, language);
    expect(controlled.compose).toHaveBeenCalledTimes(1);
    for (const output of [server, local]) {
      const record = inquiryRecord({ review: source, report, generatedEmail: output, editedEmail: { ...output.customerEmail, version: "customer", manuallyEdited: false } });
      const decoded = JSON.parse(JSON.stringify(record));
      expect(decoded.inquiry).toBe(originalAttack); expect(decoded.confirmedRequirements.application).toBe(originalAttack);
      expect(decoded.dataOwnership.inquiry).toContain("Verbatim customer original");
      expect(decoded.generatedEmail.body).toBe(output.body); expect(decoded.generatedEmail.customerEmail.body).toBe(output.customerEmail.body);
      for (const draft of [output, output.customerEmail, decoded.editedEmail]) {
        const copy = emailClipboardText(draft); expect(copy).toContain(draft.body);
        for (const line of copy.split("\n").filter(line => /We guarantee|Garantizamos/.test(line))) expect(line).toMatch(/^> \[(Customer text|Texto del cliente)/);
        expect(copy).not.toContain('\n\nWe guarantee');
      }
      expect(output.selection.results.every(r => r.status !== "confirmed_match")).toBe(true);
      expect(output.selection.results[0].checks.find(c => c.id === "other_0")?.outcome).toBe("pending");
    }
    expect(sdk.create).not.toHaveBeenCalled(); expect(sdk.parse).not.toHaveBeenCalled();
  });
});
