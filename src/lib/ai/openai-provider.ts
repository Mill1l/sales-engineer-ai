import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { extractionSchema } from "./contracts";
import { mailPlanSchema } from "./mail";
import type { AiProvider } from "./provider";
import { AiFailure } from "./provider";

import { EXTRACTION_INSTRUCTIONS, MAIL_INSTRUCTIONS } from "./prompts";
export { EXTRACTION_INSTRUCTIONS } from "./prompts";
export function createOpenAiProvider(config: { apiKey: string; model: string; timeoutMs: number; parseMaxTokens: number; emailMaxTokens: number }): AiProvider {
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeoutMs });
  client.logLevel = "off"; // Override SDK debug environment: never log customer payloads or headers.
  const run = async (task: "parse" | "email", content: string, signal: AbortSignal) => {
    try {
      const response = await client.responses.parse({
        model: config.model, store: false,
        max_output_tokens: task === "parse" ? config.parseMaxTokens : config.emailMaxTokens,
        input: [{ role: "system", content: task === "parse" ? EXTRACTION_INSTRUCTIONS : MAIL_INSTRUCTIONS }, { role: "user", content }],
        text: { format: task === "parse" ? zodTextFormat(extractionSchema, "ups_inquiry") : zodTextFormat(mailPlanSchema, "sales_reply_plan") },
      }, { signal });
      if (response.status !== "completed" || response.output_parsed == null) throw new AiFailure("invalid_output");
      return { data: response.output_parsed, usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : undefined };
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "APIConnectionTimeoutError")) throw new AiFailure("timeout");
      if (error instanceof AiFailure) throw error;
      throw new AiFailure("provider_unavailable"); // Never return/log SDK errors containing payloads.
    }
  };
  return { name: "openai", extract: (inquiry, signal) => run("parse", inquiry, signal), compose: (facts, language, signal) => run("email", JSON.stringify({ language, facts }), signal) };
}
