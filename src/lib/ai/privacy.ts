import { AiFailure } from "./provider";
/** Defense in depth only; human anonymization is required, not inferred by this filter. */
export function assertDataPolicy(input: { dataPolicy?: "synthetic_or_anonymized"; inquiry?: string; requirements?: unknown }) {
  if (input.dataPolicy !== "synthetic_or_anonymized") throw new AiFailure("data_policy_required");
  const text = input.inquiry ?? JSON.stringify(input.requirements ?? {});
  if (/\bsk-[a-z0-9_-]{12,}\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b\d{11,}\b|\+\d[\d ()-]{8,}\d/i.test(text)) throw new AiFailure("data_policy_required");
}
