import { mailFacts, renderMail, type EmailLanguage, type GoodReport } from "./mail";
import { renderCustomerMail } from "./customer-mail";
import type { generateEmail } from "./service";

export type EmailDraft = { subject: string; body: string };
export const cleanEmailRequirements = (report: GoodReport) => Object.fromEntries(Object.entries(report.requirements).filter(([key]) => !["effectiveVA", "vaOrigin", "derivation"].includes(key)));

/** Same renderers as the server: a local fallback must not bypass text attribution. */
export function localEmailOutput(report: GoodReport, language: EmailLanguage): Awaited<ReturnType<typeof generateEmail>> {
  const facts = mailFacts(report, language);
  return { provider: "mock", ...renderMail({ opening: "thank_you", closing: "confirm_details", factIds: facts.map(f => f.id) }, facts, language), customerEmail: renderCustomerMail(report, language), facts, selection: report, usage: null };
}
export const emailClipboardText = (draft: EmailDraft) => `Subject: ${draft.subject}\n\n${draft.body}`;

/** Originals remain verbatim, separately owned. Generated versions keep their safe rendering.
 * Manual draft edits are explicitly unverified and are never recast as generated facts.
 */
export function inquiryRecord(input: {
  review: { inquiry: string; response: unknown } | null;
  report: GoodReport; generatedEmail: unknown;
  editedEmail: (EmailDraft & { version: "customer" | "technical"; manuallyEdited: boolean }) | null;
}) {
  return {
    project: "Sales Engineer AI — independent learning demo",
    dataOwnership: {
      inquiry: "Verbatim customer original; untrusted, not a sales commitment.",
      extraction: "Original extraction evidence for human review; not product facts.",
      confirmedRequirements: "Customer-confirmed requirements; compliance remains subject to product evidence.",
      generatedEmail: "Generated drafts with source-marked customer text; no automatic sending.",
      editedEmail: "User-edited draft; manuallyEdited=true means NOT revalidated.",
    },
    inquiry: input.review?.inquiry ?? null, extraction: input.review?.response ?? null,
    confirmedRequirements: cleanEmailRequirements(input.report), selection: input.report,
    generatedEmail: input.generatedEmail, editedEmail: input.editedEmail,
  };
}
