import type { EmailLanguage, MailFact } from "./mail";

export type ProviderUsage = { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
export type ProviderResult = { data: unknown; usage?: ProviderUsage };
export interface AiProvider {
  readonly name: "mock" | "openai" | "deepseek";
  extract(inquiry: string, signal: AbortSignal): Promise<ProviderResult>;
  compose(facts: MailFact[], language: EmailLanguage, signal: AbortSignal): Promise<ProviderResult>;
}
export class AiFailure extends Error {
  constructor(public readonly code: "timeout" | "provider_unavailable" | "invalid_output" | "mock_scenario_only" | "live_not_configured" | "configuration_error" | "invalid_request" | "empty_output" | "invalid_json" | "schema_mismatch" | "data_policy_required", public readonly usage?: ProviderUsage) { super(code); }
}
