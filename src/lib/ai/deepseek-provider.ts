import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { blankExtractedValues, extractionSchema } from "./contracts";
import { mailPlanSchema } from "./mail";
import { EXTRACTION_INSTRUCTIONS, MAIL_INSTRUCTIONS } from "./prompts";
import { AiFailure, type AiProvider, type ProviderUsage } from "./provider";
import { validatedUsage } from "./usage";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const deepSeekModelSchema = z.enum(["deepseek-flash", "deepseek-v4-pro"]);
export type DeepSeekModel = z.infer<typeof deepSeekModelSchema>;
type Config = { apiKey: string; model: DeepSeekModel; timeoutMs: number; parseMaxTokens: number; emailMaxTokens: number };

export function createDeepSeekProvider(config: Config): AiProvider {
  const model = deepSeekModelSchema.parse(config.model);
  // Reuse the installed SDK for DeepSeek's documented OpenAI-format Chat API, not Responses.parse.
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: DEEPSEEK_BASE_URL, maxRetries: 0, timeout: config.timeoutMs });
  client.logLevel = "off"; // Override SDK debug environment: never log customer payloads or headers.
  const run = async (task: "parse" | "email", content: string, signal: AbortSignal) => {
    let usage: ProviderUsage | undefined;
    try {
      const schema = task === "parse" ? extractionSchema : mailPlanSchema;
      const example = task === "parse" ? { language: "unknown", requirements: blankExtractedValues(), evidence: [] } : { opening: "thank_you", closing: "confirm_details", factIds: ["use_all_supplied_fact_ids"] };
      const response = await client.chat.completions.create({
        model, stream: false, reasoning_effort: "none", // Official non-thinking mode, bounded latency/output.
        max_tokens: task === "parse" ? config.parseMaxTokens : config.emailMaxTokens,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: `${task === "parse" ? EXTRACTION_INSTRUCTIONS : MAIL_INSTRUCTIONS}\nReturn a single JSON object, without markdown. Unknown values must be null. JSON schema (authoritative):\n${JSON.stringify(z.toJSONSchema(schema))}\nJSON format example only (not customer facts):\n${JSON.stringify(example)}` }, { role: "user", content }],
      }, { signal });
      const u = response.usage as (typeof response.usage & { prompt_cache_hit_tokens?: number });
      usage = u ? validatedUsage({ inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens, ...(u.prompt_cache_hit_tokens === undefined ? {} : { cachedInputTokens: u.prompt_cache_hit_tokens }) }) ?? undefined : undefined;
      const choice = response.choices?.[0];
      if (choice?.finish_reason !== "stop" || choice.message?.refusal || choice.message?.tool_calls?.length) throw new AiFailure("invalid_output", usage);
      const text = choice.message.content;
      if (typeof text !== "string" || !text.trim()) throw new AiFailure("empty_output", usage);
      let json: unknown;
      try { json = JSON.parse(text); } catch { throw new AiFailure("invalid_json", usage); }
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new AiFailure("schema_mismatch", usage);
      return { data: parsed.data, usage };
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "APIConnectionTimeoutError")) throw new AiFailure("timeout", usage);
      if (error instanceof AiFailure) throw error;
      throw new AiFailure("provider_unavailable", usage); // Never expose response body, credentials or SDK error text.
    }
  };
  return { name: "deepseek", extract: (inquiry, signal) => run("parse", inquiry, signal), compose: (facts, language, signal) => run("email", JSON.stringify({ language, facts }), signal) };
}
