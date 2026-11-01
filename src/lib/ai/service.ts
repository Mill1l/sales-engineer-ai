import { validateExtraction, parseRequestSchema, emailRequestSchema } from "./contracts";
import { renderCustomerMail } from "./customer-mail";
import { mailFacts, renderMail, validateMailPlan } from "./mail";
import { selectProducts } from "../selection/engine";
import { AiFailure, type AiProvider } from "./provider";
import { validatedUsage } from "./usage";
export { validatedUsage } from "./usage";

export async function boundedCall<T>(call: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([call(controller.signal), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AiFailure("timeout")); }, timeoutMs); })]);
  } catch (error) {
    if (controller.signal.aborted) throw new AiFailure("timeout");
    throw error;
  } finally { if (timer) clearTimeout(timer); }
}
export async function parseInquiry(input: unknown, provider: AiProvider, timeoutMs = 25000) {
  const request = parseRequestSchema.parse(input);
  const result = await boundedCall((signal) => provider.extract(request.inquiry, signal), timeoutMs);
  let extraction;
  try { extraction = validateExtraction(request.inquiry, result.data); } catch { throw new AiFailure("invalid_output"); }
  return { provider: provider.name, extraction, usage: validatedUsage(result.usage) };
}
export async function generateEmail(input: unknown, products: unknown, provider: AiProvider, timeoutMs = 25000) {
  const request = emailRequestSchema.parse(input);
  // Recompute from the server's catalog. Never accept client-supplied statuses, facts or prices.
  const report = selectProducts(products, request.requirements);
  if (!report.ok) throw new AiFailure("invalid_request");
  const facts = mailFacts(report, request.language);
  const result = await boundedCall((signal) => provider.compose(facts, request.language, signal), timeoutMs);
  let plan;
  try { plan = validateMailPlan(result.data, facts); } catch { throw new AiFailure("invalid_output"); }
  return { provider: provider.name, ...renderMail(plan, facts, request.language), customerEmail: renderCustomerMail(report, request.language), facts, selection: report, usage: validatedUsage(result.usage) };
}
