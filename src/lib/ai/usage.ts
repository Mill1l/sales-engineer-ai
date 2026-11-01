import { z } from "zod";
const usageSchema = z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), cachedInputTokens: z.number().int().nonnegative().optional() }).strict().refine((u) => u.cachedInputTokens === undefined || u.cachedInputTokens <= u.inputTokens);
/** Missing or invalid metering is unknown, never proof of zero cost. */
export function validatedUsage(usage: unknown) {
  const parsed = usageSchema.safeParse(usage);
  return parsed.success ? parsed.data : null;
}
